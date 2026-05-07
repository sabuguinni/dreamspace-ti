'use client'

interface EmocaoScoreProps {
  score: number | null
  size?: 'sm' | 'md'
}

export function EmocaoScore({ score, size = 'md' }: EmocaoScoreProps) {
  if (score == null) return null
  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'
  return (
    <div className="flex items-center gap-1" title={`Score emocional: ${score}/10`}>
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          className={`rounded-full inline-block ${dotSize} transition-colors`}
          style={{
            background: i < score
              ? 'oklch(0.631 0.118 65)'
              : 'var(--border)',
          }}
        />
      ))}
      <span className="text-xs ml-1" style={{ color: 'var(--muted-foreground)' }}>
        {score}/10
      </span>
    </div>
  )
}
