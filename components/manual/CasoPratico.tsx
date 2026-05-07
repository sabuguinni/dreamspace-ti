'use client'

import Link from 'next/link'

interface Props {
  personagem: string
  perfil: string
  sonho: string
  analise: string[]
  aplicacao: string[]
  notaPratica?: string
  withSupervisor?: boolean
}

export function CasoPratico({ personagem, perfil, sonho, analise, aplicacao, notaPratica, withSupervisor = true }: Props) {
  return (
    <div
      className="rounded-xl border my-8 overflow-hidden"
      style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
    >
      {/* Header */}
      <div
        className="px-5 py-3 flex items-center justify-between gap-3"
        style={{ background: 'oklch(0.26 0.15 252 / 0.06)', borderBottom: '1px solid var(--border)' }}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'oklch(0.26 0.15 252)' }}>
            Caso Prático
          </p>
          <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--foreground)' }}>
            {personagem}
          </p>
        </div>
        <p className="text-xs text-right max-w-[60%]" style={{ color: 'var(--muted-foreground)' }}>
          {perfil}
        </p>
      </div>

      <div className="p-5 space-y-4">
        {/* Sonho */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>
            O sonho
          </p>
          <p
            className="text-sm leading-relaxed italic"
            style={{ fontFamily: 'var(--font-jetbrains)', color: 'var(--foreground)', fontSize: '0.8125rem' }}
          >
            &ldquo;{sonho}&rdquo;
          </p>
        </div>

        {/* Análise */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>
            Leitura terapêutica
          </p>
          <ol className="space-y-1.5 list-decimal list-inside">
            {analise.map((item, i) => (
              <li key={i} className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
                {item}
              </li>
            ))}
          </ol>
        </div>

        {/* Aplicação */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>
            Passos de intervenção
          </p>
          <ol className="space-y-1.5 list-decimal list-inside">
            {aplicacao.map((item, i) => (
              <li key={i} className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
                {item}
              </li>
            ))}
          </ol>
        </div>

        {/* Nota prática */}
        {notaPratica && (
          <div
            className="rounded-md px-4 py-3 text-sm leading-relaxed italic"
            style={{
              background: 'oklch(0.9 0.04 85 / 0.5)',
              borderLeft: '3px solid oklch(0.72 0.17 65)',
              color: 'var(--foreground)',
            }}
          >
            <span className="not-italic font-medium text-xs uppercase tracking-wide mr-2" style={{ color: 'oklch(0.55 0.17 65)' }}>
              Nota prática
            </span>
            {notaPratica}
          </div>
        )}

        {/* Botão supervisor */}
        {withSupervisor && (
          <div className="pt-1">
            <Link
              href={`/supervisor/nova?sonho_texto=${encodeURIComponent(sonho)}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium underline-offset-2 hover:underline transition-colors"
              style={{ color: 'var(--primary)' }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="6" r="5" />
                <path d="M6 4v4M4 6h4" />
              </svg>
              Trabalhar este caso com o Supervisor
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
