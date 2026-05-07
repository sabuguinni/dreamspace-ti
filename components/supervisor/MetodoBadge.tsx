import { METODO_LABELS, type MetodoTerapeutico } from '@/lib/types'

export function MetodoBadge({ metodo }: { metodo: MetodoTerapeutico }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        background: 'oklch(0.272 0.082 252 / 0.08)',
        color: 'var(--primary)',
        border: '1px solid oklch(0.272 0.082 252 / 0.2)',
      }}
    >
      {METODO_LABELS[metodo]}
    </span>
  )
}
