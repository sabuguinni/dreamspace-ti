'use client'

const LABELS: Record<number, string> = {
  1: 'Angustiante',
  2: 'Perturbador',
  3: 'Inquietante',
  4: 'Neutro-negativo',
  5: 'Neutro',
  6: 'Neutro-positivo',
  7: 'Agradável',
  8: 'Positivo',
  9: 'Muito positivo',
  10: 'Transformador',
}

interface EmocaoSliderProps {
  value: number | null
  onChange: (v: number | null) => void
}

export function EmocaoSlider({ value, onChange }: EmocaoSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          Score emocional
        </span>
        {value != null ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: 'oklch(0.631 0.118 65)' }}>
              {value}/10
            </span>
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              — {LABELS[value]}
            </span>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-xs underline"
              style={{ color: 'var(--muted-foreground)' }}
            >
              limpar
            </button>
          </div>
        ) : (
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>opcional</span>
        )}
      </div>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={value ?? 5}
        onChange={e => onChange(Number(e.target.value))}
        onFocus={() => { if (value == null) onChange(5) }}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{
          accentColor: 'oklch(0.631 0.118 65)',
          background: value != null
            ? `linear-gradient(to right, oklch(0.631 0.118 65) ${(((value ?? 5) - 1) / 9) * 100}%, var(--border) ${(((value ?? 5) - 1) / 9) * 100}%)`
            : 'var(--border)',
        }}
      />
      <div className="flex justify-between text-xs" style={{ color: 'var(--muted-foreground)' }}>
        <span>1 — Angustiante</span>
        <span>10 — Transformador</span>
      </div>
    </div>
  )
}
