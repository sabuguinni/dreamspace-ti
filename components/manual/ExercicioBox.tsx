interface Props {
  titulo: string
  instrucoes: string[]
  duracao: string
}

export function ExercicioBox({ titulo, instrucoes, duracao }: Props) {
  return (
    <div
      className="rounded-lg my-6"
      style={{
        background: 'oklch(0.98 0.015 85)',
        borderLeft: '4px solid oklch(0.72 0.17 65)',
        padding: '1rem 1.25rem',
      }}
    >
      <div className="flex items-start gap-2.5 mb-3">
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          stroke="oklch(0.55 0.17 65)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          className="shrink-0 mt-0.5"
        >
          <path d="M11 2l3 3-8 8H3v-3L11 2z" />
          <path d="M9 4l3 3" />
        </svg>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'oklch(0.55 0.17 65)' }}>
            Exercício
          </p>
          <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--foreground)' }}>
            {titulo}
          </p>
        </div>
        <span
          className="ml-auto text-xs shrink-0"
          style={{ color: 'var(--muted-foreground)' }}
        >
          {duracao}
        </span>
      </div>
      <ol className="space-y-1.5 list-decimal list-inside ml-1">
        {instrucoes.map((instrucao, i) => (
          <li key={i} className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
            {instrucao}
          </li>
        ))}
      </ol>
    </div>
  )
}
