'use client'

import { useState, useRef } from 'react'
import { useRetirosVoice } from '@/lib/hooks/useRetirosVoice'
import { getCharacter, type CharacterConfig } from '@/lib/characters'

interface RetirosVoiceAvatarProps {
  characterId: string
  /** Optional: auto-speak this text once setup is complete */
  initialMessage?: string
}

const STATE_LABELS: Record<string, string> = {
  idle: 'Inactivo',
  connecting: 'A ligar…',
  ready: 'Pronto',
  speaking: 'A falar…',
  reconnecting: 'A reconectar…',
  error: 'Erro',
  closed: 'Sessão terminada',
}

const STATE_COLOURS: Record<string, string> = {
  idle: 'var(--muted-foreground)',
  connecting: 'oklch(0.631 0.118 65)',
  ready: 'oklch(0.48 0.08 148)',
  speaking: 'oklch(0.42 0.12 288)',
  reconnecting: 'oklch(0.631 0.118 65)',
  error: 'oklch(0.55 0.18 25)',
  closed: 'var(--muted-foreground)',
}

export function RetirosVoiceAvatar({ characterId, initialMessage }: RetirosVoiceAvatarProps) {
  const character = getCharacter(characterId) as CharacterConfig | undefined
  const { connect, disconnect, speak, state, isSetupComplete, isSpeaking, transcript, error } =
    useRetirosVoice()

  const [inputText, setInputText] = useState('')
  const initialSentRef = useRef(false)

  const handleStart = () => {
    connect(characterId)
    // initialMessage will be spoken via useEffect-like logic below
    // We can't use useEffect here since state changes asynchronously
  }

  const handleSpeak = () => {
    const text = inputText.trim()
    if (!text || !isSetupComplete) return
    speak(text)
    setInputText('')
  }

  // Speak initial message once setup is complete
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSpeak()
    }
  }

  // Fire initial message when ready (called from onSetupComplete via state transition)
  // We track this with a ref to avoid double-firing
  if (isSetupComplete && initialMessage && !initialSentRef.current) {
    initialSentRef.current = true
    // Defer to next tick so the component can finish rendering
    setTimeout(() => speak(initialMessage), 100)
  }

  const stateColour = STATE_COLOURS[state] ?? 'var(--muted-foreground)'

  return (
    <div
      className="rounded-xl border p-5 space-y-4 flex flex-col"
      style={{ background: 'var(--card)', borderColor: 'var(--border)', minWidth: '320px', maxWidth: '480px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-semibold shrink-0"
            style={{ background: stateColour + '22', color: stateColour, border: `1.5px solid ${stateColour}` }}
          >
            {character?.label?.slice(0, 2) ?? '?'}
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              {character?.name ?? characterId}
            </p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {character?.description ?? ''}
            </p>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: stateColour,
              boxShadow: isSpeaking ? `0 0 6px ${stateColour}` : 'none',
              animation: state === 'connecting' || state === 'reconnecting' ? 'pulse 1s infinite' : 'none',
            }}
          />
          <span className="text-xs" style={{ color: stateColour }}>
            {STATE_LABELS[state] ?? state}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ color: 'oklch(0.55 0.18 25)', background: 'oklch(0.97 0.02 25)' }}>
          {error}
        </p>
      )}

      {/* Transcript */}
      {transcript && (
        <div
          className="rounded-lg p-3 text-xs leading-relaxed"
          style={{ background: 'var(--background)', color: 'var(--muted-foreground)', minHeight: '60px', maxHeight: '160px', overflowY: 'auto' }}
        >
          <span className="font-medium" style={{ color: 'var(--foreground)' }}>
            {character?.name ?? characterId}:{' '}
          </span>
          {transcript}
        </div>
      )}

      {/* Controls */}
      {state === 'idle' || state === 'error' || state === 'closed' ? (
        <button
          type="button"
          onClick={handleStart}
          className="rounded-lg px-4 py-2.5 text-sm font-medium transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          {state === 'error' || state === 'closed' ? '🔄 Reconectar' : '🎙️ Iniciar conversa'}
        </button>
      ) : (
        <div className="space-y-2">
          {/* Text input for speak */}
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isSetupComplete ? `Diz algo para ${character?.name ?? 'o personagem'}…` : 'A aguardar…'}
              disabled={!isSetupComplete || isSpeaking}
              className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none transition-colors"
              style={{
                background: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
                opacity: !isSetupComplete ? 0.5 : 1,
              }}
            />
            <button
              type="button"
              onClick={handleSpeak}
              disabled={!isSetupComplete || !inputText.trim() || isSpeaking}
              className="rounded-lg px-3 py-2 text-sm font-medium transition-all disabled:opacity-40"
              style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              ▶
            </button>
          </div>

          {/* Disconnect */}
          <button
            type="button"
            onClick={disconnect}
            className="w-full rounded-lg px-4 py-1.5 text-xs transition-all hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
          >
            Terminar sessão
          </button>
        </div>
      )}
    </div>
  )
}
