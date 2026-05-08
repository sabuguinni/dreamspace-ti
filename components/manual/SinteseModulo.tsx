import Link from 'next/link'

interface Props {
  resumo: string[]
  ponteModulo: string
  ponteSlug: string
  ponteTitulo: string
}

export function SinteseModulo({ resumo, ponteModulo, ponteSlug, ponteTitulo }: Props) {
  return (
    <div
      className="rounded-xl border mt-10 p-6 space-y-4"
      style={{ borderColor: 'oklch(0.26 0.15 252 / 0.3)', background: 'oklch(0.26 0.15 252 / 0.04)' }}
    >
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'oklch(0.26 0.15 252)' }}>
        Síntese do Módulo
      </p>

      <ul className="space-y-2">
        {resumo.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0 mt-2"
              style={{ background: 'oklch(0.26 0.15 252 / 0.6)' }}
            />
            {item}
          </li>
        ))}
      </ul>

      <div
        className="rounded-lg p-4 flex items-start justify-between gap-4"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted-foreground)' }}>
            Próximo módulo
          </p>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            {ponteModulo} — {ponteTitulo}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {ponteModulo === 'Módulo II'
              ? 'Freud transforma o sonho de curiosidade filosófica em ferramenta de trabalho. Veremos como.'
              : ponteModulo === 'Módulo IV'
              ? 'Hillman propõe ficar com a imagem tal como ela é, sem a reduzir a símbolo ou a causa. Uma revolução na leitura dos sonhos.'
              : 'O próximo módulo aprofunda o que aprendeste aqui.'}
          </p>
        </div>
        <Link
          href={`/manual/${ponteSlug}`}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md px-4 h-8 text-xs font-medium transition-colors"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          Ir para o módulo
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 6h8M7 3l3 3-3 3" />
          </svg>
        </Link>
      </div>
    </div>
  )
}
