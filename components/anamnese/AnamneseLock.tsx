'use client'

import Link from 'next/link'

interface Props {
  sessoesConcluidas: number
  necessarias: number
}

export function AnamneseLock({ sessoesConcluidas, necessarias }: Props) {
  const pct = Math.min(100, Math.round((sessoesConcluidas / necessarias) * 100))

  return (
    <div
      className="rounded-xl border p-8 max-w-lg space-y-6"
      style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
    >
      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0"
          style={{ background: '#3D2B00', color: '#C9A961', border: '1px solid #C9A961' }}
        >
          🔒
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-medium" style={{ fontFamily: 'var(--font-lora)', color: 'var(--foreground)' }}>
            Anamnese Supervisionada
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            Esta funcionalidade fica disponível após {necessarias} sessões do Supervisor de Sonhos com avaliação acima de 70.
            {' '}Tens <span className="font-medium" style={{ color: 'var(--foreground)' }}>{sessoesConcluidas}</span> {sessoesConcluidas === 1 ? 'sessão com score > 70' : 'sessões com score > 70'}.
          </p>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="space-y-1.5">
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--muted)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#C9A961' }} />
        </div>
        <p className="text-xs text-right" style={{ color: 'var(--muted-foreground)' }}>
          {sessoesConcluidas} / {necessarias} sessões com score &gt; 70
        </p>
      </div>

      <Link
        href="/supervisor"
        className="inline-flex items-center gap-1.5 rounded-lg px-4 h-9 text-sm font-medium transition-colors"
        style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
      >
        Ir para o Supervisor de Sonhos →
      </Link>
    </div>
  )
}
