'use client'

import { labelErro, type RelatorioAnamnese as Relatorio } from '@/lib/anamnese/types'

const CLASSIFICACAO_COR: Record<string, string> = {
  Excelente: 'oklch(0.55 0.18 145)',
  Bom: 'oklch(0.65 0.18 65)',
  'A Desenvolver': 'oklch(0.631 0.118 65)',
  Crítico: 'oklch(0.52 0.22 25)',
}

function corScore(score: number): string {
  if (score >= 85) return 'oklch(0.55 0.18 145)'
  if (score >= 65) return 'oklch(0.65 0.18 65)'
  if (score >= 40) return 'oklch(0.631 0.118 65)'
  return 'oklch(0.52 0.22 25)'
}

export function RelatorioAnamneseView({ relatorio }: { relatorio: Relatorio }) {
  const cor = corScore(relatorio.score)
  const corClass = CLASSIFICACAO_COR[relatorio.classificacao] ?? cor

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="space-y-1">
        <p className="text-xs font-medium tracking-widest uppercase" style={{ color: 'var(--muted-foreground)' }}>
          Relatório de sessão — Anamnese
        </p>
        <h2 className="text-xl font-medium" style={{ fontFamily: 'var(--font-lora)', color: 'var(--foreground)' }}>
          {relatorio.avatar}
        </h2>
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Duração: {relatorio.duracao_minutos} min
        </p>
      </div>

      {/* Score */}
      <div
        className="rounded-2xl border p-5 flex items-center gap-5"
        style={{ borderColor: `${corClass}55`, background: 'var(--card)', borderLeft: `4px solid ${corClass}` }}
      >
        <div
          className="flex items-center justify-center w-20 h-20 rounded-full border-4 text-2xl font-bold shrink-0"
          style={{ borderColor: cor, color: cor, background: `${cor}14` }}
        >
          {relatorio.score}
        </div>
        <div className="space-y-0.5">
          <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
            Score final
          </p>
          <p className="text-lg font-semibold" style={{ color: corClass }}>
            {relatorio.classificacao}
          </p>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {relatorio.score} / 100
          </p>
        </div>
      </div>

      {/* Suficiência da sessão — explica por que o score foi limitado */}
      {relatorio.nota_suficiencia && (
        <div className="rounded-xl border p-4" style={{ borderColor: '#C9A96155', background: '#3D2B0010' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#B8924A' }}>
            Suficiência da sessão
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
            {relatorio.nota_suficiencia}
          </p>
        </div>
      )}

      {/* Passos da metodologia explorados */}
      {relatorio.cobertura_metodologia && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
            Passos da metodologia
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {([
              ['simbolo', 'Significado do símbolo'],
              ['episodio', 'Episódio concreto'],
              ['corpo', 'Sensação corporal'],
              ['latente', 'Conteúdo latente'],
            ] as const).map(([key, label]) => {
              const ok = relatorio.cobertura_metodologia?.[key]
              return (
                <div key={key} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
                  <span style={{ color: ok ? 'oklch(0.55 0.18 145)' : 'oklch(0.52 0.22 25)' }}>{ok ? '✓' : '✗'}</span>
                  <span style={{ color: ok ? 'var(--foreground)' : 'var(--muted-foreground)' }}>{label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Intervenções do Supervisor */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
          Intervenções do Supervisor ({relatorio.resumo_intervencoes.total})
        </p>
        {relatorio.resumo_intervencoes.total === 0 ? (
          <p className="text-sm" style={{ color: 'oklch(0.55 0.18 145)' }}>
            ✓ Nenhuma intervenção necessária — conduziste a anamnese para o interior sem ficar no manifesto.
          </p>
        ) : (
          <div className="space-y-1.5">
            {relatorio.resumo_intervencoes.por_tipo.map(item => (
              <div
                key={item.tipo}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
              >
                <span style={{ color: 'var(--foreground)' }}>
                  <span style={{ color: '#C9A961' }}>●</span> {labelErro(item.tipo)}
                </span>
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  ×{item.contagem}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Momentos críticos */}
      {relatorio.momentos_criticos.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
            Momentos críticos
          </p>
          <div className="space-y-3">
            {relatorio.momentos_criticos.map((m, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-1.5" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Turno {m.turno}</p>
                {m.pergunta_terapeuta && (
                  <p className="text-sm italic" style={{ color: 'var(--foreground)' }}>«{m.pergunta_terapeuta}»</p>
                )}
                <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                  <span className="font-medium" style={{ color: 'oklch(0.52 0.22 25)' }}>O que aconteceu: </span>
                  {m.o_que_aconteceu}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                  <span className="font-medium" style={{ color: 'oklch(0.55 0.18 145)' }}>Alternativa: </span>
                  {m.o_que_deveria_ter_acontecido}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* O que fizeste bem */}
      {relatorio.pontos_positivos.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'oklch(0.55 0.18 145)' }}>
            O que fizeste bem
          </p>
          <ul className="space-y-1">
            {relatorio.pontos_positivos.map((p, i) => (
              <li key={i} className="text-sm flex gap-1.5 items-start" style={{ color: 'var(--foreground)' }}>
                <span style={{ color: 'oklch(0.55 0.18 145)', marginTop: '0.15em' }}>✓</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Nota do Supervisor */}
      {relatorio.nota_pedagogica && (
        <div className="rounded-xl border p-4" style={{ borderColor: '#C9A96155', background: '#3D2B0010' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#B8924A' }}>
            Nota do Supervisor
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
            {relatorio.nota_pedagogica}
          </p>
        </div>
      )}

      {/* Próxima sessão sugerida */}
      {relatorio.proxima_sessao_sugerida && (
        <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--muted-foreground)' }}>
            Próxima sessão sugerida
          </p>
          <p className="text-sm" style={{ color: 'var(--foreground)' }}>{relatorio.proxima_sessao_sugerida}</p>
        </div>
      )}
    </div>
  )
}
