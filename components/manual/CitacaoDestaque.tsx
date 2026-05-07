interface Props {
  texto: string
  autor: string
  obra?: string
}

export function CitacaoDestaque({ texto, autor, obra }: Props) {
  return (
    <blockquote
      className="my-8"
      style={{ borderLeft: '4px solid oklch(0.26 0.15 252 / 0.5)', paddingLeft: '1.5rem' }}
    >
      <p
        className="leading-relaxed mb-3"
        style={{
          fontFamily: 'var(--font-lora)',
          fontSize: '1.0625rem',
          fontStyle: 'italic',
          color: 'var(--foreground)',
        }}
      >
        &ldquo;{texto}&rdquo;
      </p>
      <footer className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
        — {autor}{obra && <span className="italic">, {obra}</span>}
      </footer>
    </blockquote>
  )
}
