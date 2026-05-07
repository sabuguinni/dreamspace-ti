'use client'

import { useState } from 'react'
import type { FicheiroSecreto } from '@/lib/types'

interface Props {
  nome: string
  ficheiro: FicheiroSecreto
  onClose: () => void
}

const TABS = [
  { key: 'historia',  label: 'História real' },
  { key: 'ferida',    label: 'Ferida central' },
  { key: 'motivo',    label: 'Motivo verdadeiro' },
  { key: 'sessao',    label: 'A tua sessão' },
] as const

type TabKey = typeof TABS[number]['key']

export function FicheiroModal({ nome, ficheiro, onClose }: Props) {
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
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t flex justify-end"
          style={{ borderColor: 'var(--border)' }}
        >
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
