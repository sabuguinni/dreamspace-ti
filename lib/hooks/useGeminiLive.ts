'use client'

/**
 * useGeminiLive — Dreams adaptation of the LMS hook.
 *
 * Key differences vs LMS version:
 * - sessionId is string (UUID) not number
 * - Socket.IO path: /api/socket.io (same)
 * - No external apiKey required (stays server-side)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { io as socketIO, type Socket } from 'socket.io-client'

export type GeminiLiveState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'
  | 'closed'

interface UseGeminiLiveOptions {
  model?: string
  /** For avatar sessions: the avatar's system prompt (sent to server, then to Gemini).
   *  For supervisor sessions: leave empty — the server uses its own server-side prompt. */
  systemPrompt: string
  voiceName: string
  sessionId: string
  /**
   * 'supervisor'     → bidirectional voice; server uses its own secure prompt.
   * 'supervisor_stt' → STT-only hybrid mode; Gemini transcribes user audio,
   *                    onUserSpeechFinal fires when the user finishes a turn.
   * 'avatar'         → default bidirectional voice with client system prompt.
   */
  type?: 'supervisor' | 'supervisor_stt' | 'avatar'
  onAudioChunk: (pcmBase64: string) => void
  onTextResponse: (text: string) => void
  onTranscription: (text: string, isUser: boolean) => void
  onTurnComplete: () => void
  onError: (error: string) => void
  /**
   * Called when Gemini VAD detects end of user speech in 'supervisor_stt' mode.
   * Receives the complete transcription of the user's turn.
   */
  onUserSpeechFinal?: (text: string) => void
}

// ─── Audio helpers ────────────────────────────────────────────────────────────

function float32ToInt16(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length)
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]))
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return int16Array
}

function resampleAudio(audioData: Float32Array, sourceRate: number, targetRate: number): Float32Array {
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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGeminiLive(options: UseGeminiLiveOptions | null) {
  const [state, setState] = useState<GeminiLiveState>('idle')
  const socketRef = useRef<Socket | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const playbackContextRef = useRef<AudioContext | null>(null)
  const playbackQueueRef = useRef<AudioBuffer[]>([])
  const isPlayingRef = useRef(false)
  const transcriptRef = useRef<string[]>([])

  const optionsRef = useRef(options)
  optionsRef.current = options

  // STT-only mode: accumulates user speech between VAD boundaries
  const sttBufferRef = useRef<string>('')

  // Whether audio capture is paused (used to suppress echo while AI speaks)
  const capturePausedRef = useRef(false)

  /**
   * Call this synchronously inside an onClick handler to pre-create the
   * AudioContext while the browser still treats this as a user gesture.
   * Prevents autoplay-policy blocking on first audio chunk.
   */
  const resumePlayback = useCallback(() => {
    if (!playbackContextRef.current) {
      const ctx = new AudioContext()
      playbackContextRef.current = ctx
      return
    }
    if (playbackContextRef.current.state === 'suspended') {
      playbackContextRef.current.resume().catch(() => {})
    }
  }, [])

  const playNextInQueue = useCallback(() => {
    if (!playbackContextRef.current || playbackQueueRef.current.length === 0) {
      isPlayingRef.current = false
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
      ctx.resume().then(() => source.start()).catch(() => { isPlayingRef.current = false })
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
      for (let i = 0; i < int16Array.length; i++) float32Array[i] = int16Array[i] / 32768.0

      const outputRate = playbackContextRef.current.sampleRate
      const resampled = resampleAudio(float32Array, 24000, outputRate)
      const audioBuffer = playbackContextRef.current.createBuffer(1, resampled.length, outputRate)
      audioBuffer.getChannelData(0).set(resampled)

      playbackQueueRef.current.push(audioBuffer)
      if (!isPlayingRef.current) playNextInQueue()
    },
    [playNextInQueue]
  )

  const cleanup = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    if (playbackContextRef.current) {
      playbackContextRef.current.close().catch(() => {})
      playbackContextRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
    }
    playbackQueueRef.current = []
    isPlayingRef.current = false
  }, [])

  const startAudioCapture = useCallback(
    (context: AudioContext, stream: MediaStream, socket: Socket) => {
      console.log('[mic] startAudioCapture — pipeline iniciada, paused=' + capturePausedRef.current) // TEMP debug
      let lastMicLog = 0
      const source = context.createMediaStreamSource(stream)
      const processor = context.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        const now = Date.now()
        if (now - lastMicLog > 1500) { lastMicLog = now; console.log('[mic] tick paused=' + capturePausedRef.current + ' connected=' + socket.connected) } // TEMP debug
        if (!socket.connected || capturePausedRef.current) return
        const inputData = e.inputBuffer.getChannelData(0)
        const resampled = resampleAudio(inputData, context.sampleRate, 16000)
        const int16 = float32ToInt16(resampled)
        const base64Audio = arrayBufferToBase64(int16.buffer as ArrayBuffer)
        socket.emit('gemini:audio', { audio: base64Audio, mimeType: 'audio/pcm;rate=16000' })
      }

      source.connect(processor)
      processor.connect(context.destination)
    },
    []
  )

  const connect = useCallback(async () => {
    const opts = optionsRef.current
    if (!opts) return

    setState('connecting')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      mediaStreamRef.current = stream

      const inputContext = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = inputContext

      if (!playbackContextRef.current) {
        playbackContextRef.current = new AudioContext()
      }

      const socketUrl = window.location.origin
      const socket = socketIO(socketUrl, {
        path: '/api/socket.io',
        transports: ['websocket', 'polling'],
      })
      socketRef.current = socket

      socket.on('connect', () => {
        const model = opts.model || 'gemini-2.5-flash-native-audio-latest'
        socket.emit('gemini:connect', {
          sessionId: opts.sessionId,
          model,
          // For supervisor modes: server uses its own secure prompt; we send empty string.
          systemPrompt: (opts.type === 'supervisor' || opts.type === 'supervisor_stt') ? '' : opts.systemPrompt,
          voiceName: opts.voiceName,
          type: opts.type ?? 'avatar',
        })
      })

      socket.on('gemini:setupComplete', () => {
        setState('connected')
        startAudioCapture(inputContext, stream, socket)
      })

      socket.on('gemini:reconnecting', (data: { attempt: number }) => {
        console.log(`[GeminiLive] Reconnecting (attempt ${data.attempt})…`)
        setState('reconnecting')
      })

      socket.on('gemini:resumed', () => {
        setState('connected')
      })

      socket.on('gemini:goAway', () => {
        // backend handles reconnect transparently
      })

      socket.on('gemini:serverContent', (content: Record<string, unknown>) => {
        const o = optionsRef.current
        if (!o) return

        const isSttMode = o.type === 'supervisor_stt'

        // Audio / text output from model — only relevant in non-STT modes
        if (!isSttMode) {
          const modelTurn = content.modelTurn as { parts?: { inlineData?: { data: string }; text?: string }[] } | undefined
          if (modelTurn?.parts) {
            for (const part of modelTurn.parts) {
              if (part.inlineData?.data) {
                o.onAudioChunk(part.inlineData.data)
                enqueueAudio(part.inlineData.data)
              }
              if (part.text) o.onTextResponse(part.text)
            }
          }

          if (content.interrupted) {
            playbackQueueRef.current = []
            isPlayingRef.current = false
          }
        }

        // User speech transcription
        const inputTranscription = content.inputTranscription as { text?: string } | undefined
        if (inputTranscription?.text) {
          if (isSttMode) {
            // Acumula a transcrição. Os deltas do Gemini já trazem os espaços correctos —
            // NÃO acrescentar ' ' (fragmentava palavras: "Entã o , quan tas").
            sttBufferRef.current += inputTranscription.text
            o.onTranscription(inputTranscription.text, true)
          } else {
            o.onTranscription(inputTranscription.text, true)
            transcriptRef.current.push(`[Terapeuta]: ${inputTranscription.text}`)
          }
        }

        // Model audio transcription — only for bidirectional audio modes
        if (!isSttMode) {
          const outputTranscription = content.outputTranscription as { text?: string } | undefined
          if (outputTranscription?.text) {
            o.onTranscription(outputTranscription.text, false)
            transcriptRef.current.push(`[Avatar]: ${outputTranscription.text}`)
          }
        }

        // Turn complete
        if (content.turnComplete) {
          if (isSttMode) {
            // In STT mode, turnComplete means the user finished speaking.
            // Deliver the complete accumulated transcription.
            const finalText = sttBufferRef.current.trim()
            sttBufferRef.current = ''
            if (finalText && o.onUserSpeechFinal) o.onUserSpeechFinal(finalText)
          } else {
            o.onTurnComplete()
          }
        }
      })

      socket.on('gemini:error', (data: { message: string }) => {
        setState('error')
        opts.onError(data.message || 'Erro na ligação ao serviço de voz.')
      })

      socket.on('gemini:closed', (data: { code: number; reason: string }) => {
        setState('closed')
        cleanup()
      })

      socket.on('connect_error', (err: Error) => {
        setState('error')
        opts.onError('Erro ao ligar ao servidor. Verifica a tua ligação.')
      })

      socket.on('disconnect', (reason: string) => {
        if (reason !== 'io client disconnect') {
          setState('closed')
          cleanup()
        }
      })
    } catch (error: unknown) {
      setState('error')
      const msg = (error as Error)?.message?.toLowerCase() || ''
      let userMessage = 'Erro ao ligar ao serviço de voz.'
      if (msg.includes('not found') || msg.includes('notfounderror') || msg.includes('requested device')) {
        userMessage = 'Microfone não encontrado. Liga um microfone e tenta novamente.'
      } else if (msg.includes('permission') || msg.includes('notallowed') || msg.includes('denied')) {
        userMessage = 'Permissão de microfone negada. Autoriza o acesso ao microfone nas definições do browser.'
      } else if (msg.includes('insecure') || msg.includes('secure context')) {
        userMessage = 'O microfone requer uma ligação segura (HTTPS).'
      }
      opts?.onError(userMessage)
    }
  }, [enqueueAudio, startAudioCapture, cleanup])

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('gemini:disconnect')
      socketRef.current.disconnect()
      socketRef.current = null
    }
    cleanup()
    setState('idle')
  }, [cleanup])

  const getTranscript = useCallback(() => transcriptRef.current.slice(), [])
  const clearTranscript = useCallback(() => { transcriptRef.current = [] }, [])

  /** Pause mic capture while AI audio is playing (prevents echo). */
  const pauseCapture = useCallback(() => { console.log('[mic] pauseCapture'); capturePausedRef.current = true }, [])
  /** Resume mic capture after AI audio finishes. */
  const resumeCapture = useCallback(() => { console.log('[mic] resumeCapture'); capturePausedRef.current = false }, [])
  /** Clear the STT accumulation buffer (e.g. after manual send in supervisor_stt mode). */
  const clearSttBuffer = useCallback(() => { sttBufferRef.current = '' }, [])
  /** Envia um turno de TEXTO ao Gemini (ex.: trigger de abertura no modo avatar). */
  const sendText = useCallback((text: string) => { socketRef.current?.emit('gemini:text', { text }) }, [])

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.emit('gemini:disconnect')
        socketRef.current.disconnect()
      }
      cleanup()
    }
  }, [cleanup])

  return {
    state,
    connect,
    disconnect,
    getTranscript,
    clearTranscript,
    resumePlayback,
    pauseCapture,
    resumeCapture,
    clearSttBuffer,
    sendText,
  }
}
