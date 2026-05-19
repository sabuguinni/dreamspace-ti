'use client'

import { useState } from 'react'
import type { FicheiroSecreto, AvatarReport } from '@/lib/types'

interface Props {
  sessaoId: string
  nome: string
  ficheiro: FicheiroSecreto
  report?: AvatarReport | null
  isLoadingReport?: boolean
  onClose: () => void
}

const TABS = [
  { key: 'historia',   label: 'História real' },
  { key: 'ferida',     label: 'Ferida central' },
  { key: 'motivo',     label: 'Motivo verdadeiro' },
  { key: 'sessao',     label: 'A tua sessão' },
  { key: 'desempenho', label: 'O teu desempenho' },
] as const

type TabKey = typeof TABS[number]['key']

const DIMENSOES: { key: keyof AvatarReport; label: string }[] = [
  { key: 'abordagemSocratica',        label: 'Abordagem Socrática' },
  { key: 'escutaAtiva',               label: 'Escuta Activa' },
  { key: 'respeitoSimbologiaPessoal', label: 'Respeito pela Simbologia Pessoal' },
  { key: 'evitouInterpretacaoDirecta',label: 'Evitou Interpretação Directa' },
  { key: 'criouEspacoSeguro',         label: 'Criou Espaço Seguro' },
  { key: 'progressoComAvatar',        label: 'Progresso com o Avatar' },
]

function scoreColor(score: number): string {
  if (score >= 70) return 'oklch(0.52 0.18 148)'  // green
  if (score >= 50) return 'oklch(0.72 0.16 72)'   // yellow
  return 'oklch(0.52 0.22 25)'                    // red
}

export function FicheiroModal({ sessaoId, nome, ficheiro, report, isLoadingReport, onClose }: Props) {
  const [tab, setTab] = useState<TabKey>('historia')
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  function toggle(item: string) {
    setChecked(prev => ({ ...prev, [item]: !prev[item] }))
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
    >
      {/* Panel */}
      <div
        className="w-full max-w-lg rounded-xl shadow-xl flex flex-col"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          maxHeight: '85vh',
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b flex items-start justify-between gap-4"
          style={{ borderColor: 'var(--border)' }}
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-widest mb-0.5" style={{ color: 'var(--muted-foreground)' }}>
              Ficheiro psicológico
            </p>
            <h2
              className="text-lg font-medium"
              style={{ fontFamily: 'var(--font-lora)', color: 'var(--primary)' }}
            >
              O que não sabias sobre a {nome}
            </h2>
          </div>
        </div>

        {/* Tabs */}
        <div
          className="flex border-b overflow-x-auto shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors"
              style={{
                color: tab === t.key ? 'var(--primary)' : 'var(--muted-foreground)',
                borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
                background: 'transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {tab === 'historia' && (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
                {ficheiro.historiaReal}
              </p>
              <div
                className="rounded-md p-4 text-sm leading-relaxed"
                style={{
                  background: 'oklch(0.375 0.132 288 / 0.06)',
                  borderLeft: '3px solid oklch(0.375 0.132 288 / 0.5)',
                  color: 'var(--foreground)',
                }}
              >
                <p className="text-xs font-medium mb-1" style={{ color: 'oklch(0.375 0.132 288)' }}>
                  Chave terapêutica
                </p>
                {ficheiro.chaveTerapeutica}
              </div>
            </div>
          )}

          {tab === 'ferida' && (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
              {ficheiro.feridaCentral}
            </p>
          )}

          {tab === 'motivo' && (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
              {ficheiro.motivoVerdadeiroDaTerapia}
            </p>
          )}

          {tab === 'sessao' && (
            <div className="space-y-3">
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Auto-avaliação honesta — não é gravada. Marca o que conseguiste nesta sessão.
              </p>
              <ul className="space-y-2.5">
                {ficheiro.indicadoresProgresso.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggle(item)}
                      className="mt-0.5 w-4 h-4 rounded shrink-0 border flex items-center justify-center transition-colors"
                      style={{
                        background: checked[item] ? 'var(--primary)' : 'transparent',
                        borderColor: checked[item] ? 'var(--primary)' : 'var(--border)',
                      }}
                    >
                      {checked[item] && (
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <span
                      className="text-sm leading-snug"
                      style={{ color: checked[item] ? 'var(--foreground)' : 'var(--muted-foreground)' }}
                    >
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === 'desempenho' && (
            <div className="space-y-5">
              {isLoadingReport ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <span className="inline-flex gap-1">
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--primary)', animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--primary)', animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--primary)', animationDelay: '300ms' }} />
                  </span>
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    A gerar relatório de desempenho…
                  </p>
                </div>
              ) : !report ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    O relatório ainda não está disponível.
                  </p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    Fecha e abre novamente o ficheiro daqui a momentos.
                  </p>
                </div>
              ) : (
                <>
                  {/* Score circle */}
                  <div className="flex flex-col items-center gap-2 pb-2">
                    <div
                      className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold"
                      style={{
                        border: `4px solid ${scoreColor(report.overallScore)}`,
                        color: scoreColor(report.overallScore),
                        background: 'var(--card)',
                      }}
                    >
                      {report.overallScore}
                    </div>
                    <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
                      Pontuação global
                    </p>
                  </div>

                  {/* Summary */}
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
                    {report.summary}
                  </p>

                  {/* 6 Dimensions */}
                  <div className="space-y-4 pt-1">
                    {DIMENSOES.map(({ key, label }) => {
                      const dim = report[key] as { score: number; feedback: string } | undefined
                      if (!dim) return null
                      const s = Math.min(100, Math.max(0, dim.score ?? 0))
                      return (
                        <div key={key} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{label}</span>
                            <span className="text-xs font-bold" style={{ color: scoreColor(s) }}>{s}/100</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                            <div
                              className="h-1.5 rounded-full transition-all"
                              style={{ width: `${s}%`, background: scoreColor(s) }}
                            />
                          </div>
                          {dim.feedback && (
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                              {dim.feedback}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Techniques detected */}
                  {Array.isArray(report.techniquesDetected) && report.techniquesDetected.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
                        Técnicas detectadas
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {report.techniquesDetected.map(t => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded-full text-xs"
                            style={{ background: 'oklch(0.375 0.132 288 / 0.1)', color: 'oklch(0.375 0.132 288)', border: '1px solid oklch(0.375 0.132 288 / 0.3)' }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Strengths */}
                  {Array.isArray(report.strengths) && report.strengths.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
                        Pontos fortes
                      </p>
                      <ul className="space-y-1">
                        {report.strengths.map(s => (
                          <li key={s} className="flex items-start gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
                            <span style={{ color: 'oklch(0.52 0.18 148)' }}>✓</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Improvements */}
                  {Array.isArray(report.improvements) && report.improvements.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
                        Áreas a melhorar
                      </p>
                      <ul className="space-y-1">
                        {report.improvements.map(imp => (
                          <li key={imp} className="flex items-start gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
                            <span style={{ color: 'oklch(0.72 0.16 72)' }}>→</span>
                            <span>{imp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Critical errors (only if non-empty) */}
                  {Array.isArray(report.criticalErrors) && report.criticalErrors.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'oklch(0.52 0.22 25)' }}>
                        Erros críticos
                      </p>
                      <ul className="space-y-1">
                        {report.criticalErrors.map(e => (
                          <li key={e} className="flex items-start gap-2 text-sm" style={{ color: 'oklch(0.52 0.22 25)' }}>
                            <span>!</span>
                            <span>{e}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Next steps */}
                  {report.nextSteps && (
                    <div
                      className="rounded-md p-4 text-sm leading-relaxed"
                      style={{
                        background: 'oklch(0.26 0.15 252 / 0.06)',
                        borderLeft: '3px solid oklch(0.26 0.15 252 / 0.5)',
                        color: 'var(--foreground)',
                      }}
                    >
                      <p className="text-xs font-medium mb-1" style={{ color: 'oklch(0.26 0.15 252)' }}>
                        Próximos passos
                      </p>
                      {report.nextSteps}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t flex items-center justify-between gap-3 flex-wrap"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex gap-2">
            {report && (
              <button
                type="button"
                onClick={() => {
                  fetch('/api/avatar/sessoes/' + sessaoId + '/pdf?tipo=relatorio')
                    .then(r => r.ok ? r.blob() : null)
                    .then(blob => { if (!blob) return; const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'relatorio-avatar-' + sessaoId.slice(0, 8) + '.pdf'; a.click(); URL.revokeObjectURL(url); })
                    .catch(() => {});
                }}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium border transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--background)' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Relatório PDF
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                fetch('/api/avatar/sessoes/' + sessaoId + '/pdf?tipo=transcript')
                  .then(r => r.ok ? r.blob() : null)
                  .then(blob => { if (!blob) return; const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'transcricao-avatar-' + sessaoId.slice(0, 8) + '.pdf'; a.click(); URL.revokeObjectURL(url); })
                  .catch(() => {});
              }}
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium border transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--background)' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Transcrição PDF
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md px-5 h-9 text-sm font-medium transition-colors"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            Fechar e ver sessão
          </button>
        </div>
      </div>
    </div>
  )
}
