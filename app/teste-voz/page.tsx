'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { RetirosVoiceAvatar } from '@/components/RetirosVoiceAvatar'
import { RETIROS_CHARACTERS } from '@/lib/characters'

// Greetings for each character shown on startup
const INITIAL_MESSAGES: Record<string, string> = {
  facilitador:
    'Bem-vindos. Encontrem um lugar confortável e, quando estiverem prontos, respirem fundo. Estamos aqui juntos neste espaço.',
  companheiro:
    'Olá. Ainda estou a integrar o que vivi esta manhã. Tens tido momentos assim, de ficar sem palavras?',
}

function TesteVozInner() {
  const searchParams = useSearchParams()
  const isDebug = process.env.NODE_ENV === 'development' || searchParams.get('debug') === '1'

  const [selectedId, setSelectedId] = useState<string>(RETIROS_CHARACTERS[0].id)

  if (!isDebug) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Esta página está disponível apenas em modo de desenvolvimento.
        </p>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen p-8 space-y-8"
      style={{ background: 'var(--background)' }}
    >
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-medium" style={{ fontFamily: 'var(--font-lora)', color: 'var(--primary)' }}>
          Teste de Voz — TI Retiros
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Sistema Gemini Live TTS · staging · <code className="text-xs">?debug=1</code> para aceder em produção
        </p>
      </div>

      {/* Character selector */}
      <div className="space-y-2">
        <p className="text-xs font-medium tracking-widest uppercase" style={{ color: 'var(--muted-foreground)' }}>
          Personagem
        </p>
        <div className="flex flex-wrap gap-2">
          {RETIROS_CHARACTERS.map(char => (
            <button
              key={char.id}
              type="button"
              onClick={() => setSelectedId(char.id)}
              className="rounded-lg border px-4 py-2 text-sm transition-all"
              style={{
                borderColor: selectedId === char.id ? 'var(--primary)' : 'var(--border)',
                background: selectedId === char.id ? 'var(--primary)' : 'var(--card)',
                color: selectedId === char.id ? 'var(--primary-foreground)' : 'var(--foreground)',
              }}
            >
              {char.label}
              <span className="ml-1.5 text-xs opacity-60">{char.voiceName}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Avatar */}
      <div>
        <RetirosVoiceAvatar
          key={selectedId}
          characterId={selectedId}
          initialMessage={INITIAL_MESSAGES[selectedId]}
        />
      </div>

      {/* Technical info */}
      <div
        className="rounded-lg border p-4 space-y-1 text-xs"
        style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
      >
        <p className="font-medium" style={{ color: 'var(--foreground)' }}>Info técnica</p>
        <p>Modelo: <code>gemini-2.5-flash-native-audio-latest</code></p>
        <p>Socket.IO path: <code>/api/socket.io</code></p>
        <p>Modo: TTS puro (sem microfone)</p>
        <p>Evento: <code>gemini:speak</code> → <code>clientContent.turnComplete=true</code></p>
        <p>Output: PCM 24kHz Int16 base64 → resample → AudioContext</p>
        <p>Língua: Português de Portugal (forçado no system prompt server-side)</p>
      </div>
    </div>
  )
}

export default function TesteVozPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>A carregar…</p>
      </div>
    }>
      <TesteVozInner />
    </Suspense>
  )
}
