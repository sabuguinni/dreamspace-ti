const FLAG_LABELS: Record<string, string> = {
  interpretacao_prematura: 'Interpretação prematura',
  heroismo_terapeutico: 'Heroísmo terapêutico',
  projeccao_terapeuta: 'Projecção do terapeuta',
  ausencia_aterragem: 'Ausência de aterragem',
  lente_unica: 'Lente única',
}

export function FlagBadge({ flag }: { flag: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        background: 'oklch(0.55 0.14 42 / 0.1)',
        color: 'oklch(0.45 0.14 42)',
        border: '1px solid oklch(0.55 0.14 42 / 0.25)',
      }}
    >
      {FLAG_LABELS[flag] ?? flag}
    </span>
  )
}
