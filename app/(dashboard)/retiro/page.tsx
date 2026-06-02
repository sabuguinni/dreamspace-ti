'use client'

import { RetirosVoiceAvatar } from '@/components/RetirosVoiceAvatar'

// ─── Cena actual do retiro ────────────────────────────────────────────────────

const CENA = {
  titulo: 'Tarde de Integração',
  hora: '16h00',
  local: 'Sala de Convívio',
  descricao:
    'A sessão da manhã terminou há pouco. O grupo reúne-se livremente no espaço comum antes do jantar. A luz da tarde atravessa as janelas. Há silêncio e partilha. Podes aproximar-te de quem sentires.',
}

// Mensagem inicial de cada personagem ao iniciar a ligação
const INITIAL_MESSAGES: Record<string, string> = {
  facilitador:
    'Bem-vindos. Encontrem um lugar confortável e, quando estiverem prontos, respirem fundo. Estamos aqui juntos neste espaço.',
  companheiro:
    'Olá. Ainda estou a integrar o que vivi esta manhã. Tens tido momentos assim, de ficar sem palavras?',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RetiroPage() {
  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">

      {/* Cabeçalho */}
      <div>
        <h1
          className="text-2xl font-medium"
          style={{ fontFamily: 'var(--font-lora)', color: 'var(--primary)' }}
        >
          Retiro Transpessoal
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Simulação imersiva com personagens IA — voz em tempo real via Gemini Live
        </p>
      </div>

      {/* Contexto da cena */}
      <div
        className="rounded-xl border p-5 space-y-3"
        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className="text-xs font-medium tracking-widest uppercase"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Cena activa
          </span>
          <span style={{ color: 'var(--muted-foreground)' }}>·</span>
          <span
            className="text-sm font-medium"
            style={{ fontFamily: 'var(--font-lora)', color: 'var(--foreground)' }}
          >
            {CENA.titulo} — {CENA.hora}
          </span>
          <span style={{ color: 'var(--muted-foreground)' }}>·</span>
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {CENA.local}
          </span>
        </div>

        <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
          {CENA.descricao}
        </p>

        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          ✦ Modo TTS puro — o personagem fala, tu respondes por escrito. Sem microfone necessário.
        </p>
      </div>

      {/* Personagens */}
      <div>
        <p
          className="text-xs font-medium tracking-widest uppercase mb-3"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Presentes no espaço
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RetirosVoiceAvatar
            characterId="facilitador"
            initialMessage={INITIAL_MESSAGES.facilitador}
          />
          <RetirosVoiceAvatar
            characterId="companheiro"
            initialMessage={INITIAL_MESSAGES.companheiro}
          />
        </div>
      </div>

      {/* Nota de rodapé */}
      <p className="text-xs pb-4" style={{ color: 'var(--muted-foreground)' }}>
        Cada personagem é uma sessão de voz independente. Inicia a conversa com um e depois com o outro, ou mantém ambos activos em simultâneo.
      </p>

    </div>
  )
}
