'use client'

/**
 * useRetirosVoice — TTS-only voice hook for TI Retiros characters.
 *
 * Differences vs useGeminiLive:
 * - NO microphone / audio capture
 * - connect(characterId) resolves character server-side (system prompt never touches browser)
 * - speak(text) emits gemini:speak to make the character say something
 * - Simplified state: isConnected / isSetupComplete / isSpeaking / transcript / error
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { io as socketIO, type Socket } from 'socket.io-client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type RetirosVoiceState =
  | 'idle'
  | 'connecting'
  | 'ready'          // setupComplete received, can call speak()
  | 'speaking'       // model is generating / playing audio
  | 'reconnecting'
  | 'error'
  | 'closed'

export interface UseRetirosVoiceReturn {
  connect: (characterId: string) => void
  disconnect: () => void
  speak: (text: string) => void
  state: RetirosVoiceState
  isConnected: boolean
  isSetupComplete: boolean
  isSpeaking: boolean
  transcript: string
  error: string | null
}

// ─── Audio helpers ────────────────────────────────────────────────────────────

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

function resampleAudio(
  audioData: Float32Array,
  sourceRate: number,
  targetRate: number
): Float32Array {
  if (sourceRate === targetRate) return audioData
  const ratio = sourceRate / targetRate
  const newLength = Math.round(audioData.length / ratio)
  const result = new Float32Array(newLength)
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio
    const srcFloor = Math.floor(srcIndex)
    const srcCeil = Math.min(srcFloor + 1, audioData.length - 1)
    const t = srcIndex - srcFloor
    result[i] = audioData[srcFloor] * (1 - t) + audioData[srcCeil] * t
  }
  return result
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRetirosVoice(): UseRetirosVoiceReturn {
  const [state, setState] = useState<RetirosVoiceState>('idle')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)

  const socketRef = useRef<Socket | null>(null)
  const playbackContextRef = useRef<AudioContext | null>(null)
  const playbackQueueRef = useRef<AudioBuffer[]>([])
  const isPlayingRef = useRef(false)
  const transcriptAccRef = useRef<string>('')

  // ─── Playback ─────────────────────────────────────────────────────────────

  const playNextInQueue = useCallback(() => {
    if (!playbackContextRef.current || playbackQueueRef.current.length === 0) {
      isPlayingRef.current = false
      setState(prev => prev === 'speaking' ? 'ready' : prev)
      return
    }
    isPlayingRef.current = true
    const buffer = playbackQueueRef.current.shift()!
    const source = playbackContextRef.current.createBufferSource()
    source.buffer = buffer
    source.connect(playbackContextRef.current.destination)
    source.onended = () => playNextInQueue()
    const ctx = playbackContextRef.current
    if (ctx.state === 'suspended') {
      ctx.resume()
        .then(() => source.start())
        .catch(() => { isPlayingRef.current = false })
    } else {
      source.start()
    }
  }, [])

  const enqueueAudio = useCallback(
    (pcmBase64: string) => {
      if (!playbackContextRef.current) return
      const pcmData = base64ToArrayBuffer(pcmBase64)
      const int16Array = new Int16Array(pcmData)
      const float32Array = new Float32Array(int16Array.length)
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0
      }
      const outputRate = playbackContextRef.current.sampleRate
      const resampled = resampleAudio(float32Array, 24000, outputRate)
      const audioBuffer = playbackContextRef.current.createBuffer(1, resampled.length, outputRate)
      audioBuffer.getChannelData(0).set(resampled)
      playbackQueueRef.current.push(audioBuffer)
      if (!isPlayingRef.current) {
        setState('speaking')
        playNextInQueue()
      }
    },
    [playNextInQueue]
  )

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    if (playbackContextRef.current) {
      playbackContextRef.current.close().catch(() => {})
      playbackContextRef.current = null
    }
    playbackQueueRef.current = []
    isPlayingRef.current = false
  }, [])

  // ─── Connect ──────────────────────────────────────────────────────────────

  /**
   * Call inside a user-gesture handler (onClick).
   * Creates AudioContext (autoplay unlock) and connects to Gemini via proxy.
   */
  const connect = useCallback(
    (characterId: string) => {
      if (socketRef.current) return // already connected

      setState('connecting')
      setError(null)

      // Create/resume AudioContext inside user gesture — required by autoplay policy
      if (!playbackContextRef.current) {
        playbackContextRef.current = new AudioContext()
      } else if (playbackContextRef.current.state === 'suspended') {
        playbackContextRef.current.resume().catch(() => {})
      }

      const socketUrl = window.location.origin
      const socket = socketIO(socketUrl, {
        path: '/api/socket.io',
        transports: ['websocket', 'polling'],
      })
      socketRef.current = socket

      socket.on('connect', () => {
        socket.emit('gemini:connect', {
          sessionId: `retiros-${Date.now()}`,
          model: 'gemini-2.5-flash-native-audio-latest',
          type: 'retiros',
          characterId,
          // voiceName is resolved server-side from characterId — not needed here
          voiceName: '',
          systemPrompt: '',  // always ignored for type='retiros'
        })
      })

      socket.on('gemini:setupComplete', () => {
        setState('ready')
      })

      socket.on('gemini:reconnecting', () => {
        setState('reconnecting')
      })

      socket.on('gemini:resumed', () => {
        setState('ready')
      })

      socket.on('gemini:goAway', () => {
        // backend handles reconnection transparently
      })

      socket.on('gemini:serverContent', (content: Record<string, unknown>) => {
        // Audio chunks
        type Part = { inlineData?: { data: string }; text?: string }
        type ModelTurn = { parts?: Part[] }
        const modelTurn = content.modelTurn as ModelTurn | undefined
        if (modelTurn?.parts) {
          for (const part of modelTurn.parts) {
            if (part.inlineData?.data) {
              enqueueAudio(part.inlineData.data)
            }
          }
        }

        // Clear queue on interrupted (user barge-in / cancellation)
        if (content.interrupted) {
          playbackQueueRef.current = []
          isPlayingRef.current = false
          setState('ready')
        }

        // Transcript of what the character said
        type Transcription = { text?: string }
        const outputTranscription = content.outputTranscription as Transcription | undefined
        if (outputTranscription?.text) {
          transcriptAccRef.current += outputTranscription.text
          setTranscript(transcriptAccRef.current)
        }

        if (content.turnComplete) {
          // Audio playback continues via queue; state updates to ready when queue drains
          if (!isPlayingRef.current) setState('ready')
        }
      })

      socket.on('gemini:error', (data: { message: string }) => {
        setState('error')
        setError(data.message || 'Erro na ligação ao serviço de voz.')
      })

      socket.on('gemini:closed', () => {
        setState('closed')
        cleanup()
      })

      socket.on('connect_error', (err: Error) => {
        setState('error')
        setError('Erro ao ligar ao servidor: ' + err.message)
      })

      socket.on('disconnect', (reason: string) => {
        if (reason !== 'io client disconnect') {
          setState('closed')
          cleanup()
        }
      })
    },
    [enqueueAudio, cleanup]
  )

  // ─── Speak ────────────────────────────────────────────────────────────────

  /**
   * Instruct the character to say the given text.
   * Only works after connect() and setupComplete.
   */
  const speak = useCallback((text: string) => {
    const socket = socketRef.current
    if (!socket || !socket.connected) {
      console.warn('[useRetirosVoice] speak() called before connect()')
      return
    }
    socket.emit('gemini:speak', { text })
  }, [])

  // ─── Disconnect ───────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('gemini:disconnect')
      socketRef.current.disconnect()
      socketRef.current = null
    }
    cleanup()
    setState('idle')
    setError(null)
  }, [cleanup])

  // ─── Cleanup on unmount ───────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.emit('gemini:disconnect')
        socketRef.current.disconnect()
        socketRef.current = null
      }
      cleanup()
    }
  }, [cleanup])

  return {
    connect,
    disconnect,
    speak,
    state,
    isConnected: state !== 'idle' && state !== 'error' && state !== 'closed',
    isSetupComplete: state === 'ready' || state === 'speaking',
    isSpeaking: state === 'speaking',
    transcript,
    error,
  }
}
