'use client'

import Link from 'next/link'
import type { SessaoSupervisor } from '@/lib/types'
import { MetodoBadge } from './MetodoBadge'

type SessaoComCount = SessaoSupervisor & { mensagens?: { count: number }[] | null }

const ESTADO_LABELS: Record<string, { label: string; color: string }> = {
  em_curso:  { label: 'Em curso',  color: 'oklch(0.48 0.15 145)' },
  concluida: { label: 'Concluída', color: 'oklch(0.50 0.02 249)' },
  arquivada: { label: 'Arquivada', color: 'oklch(0.50 0.02 249)' },
}

export function SessaoCard({
  sessao,
  onDelete,
}: {
  sessao: SessaoComCount
  onDelete?: (id: string) => void
}) {
  const excerpt = sessao.sonho_texto.slice(0, 100) + (sessao.sonho_texto.length > 100 ? '…' : '')
  const msgCount = sessao.mensagens?.[0]?.count ?? null
  const estado = ESTADO_LABELS[sessao.estado] ?? ESTADO_LABELS.em_curso
  const data = new Date(sessao.created_at).toLocaleDateString('pt-PT', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="relative group">
      <Link
        href={`/supervisor/${sessao.id}`}
        className="block rounded-lg border p-5 space-y-3 transition-colors hover:border-primary/30"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{data}</p>
          <div className="flex items-center gap-2 shrink-0 pr-6">
            {msgCount !== null && (
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {msgCount} {msgCount === 1 ? 'mensagem' : 'mensagens'}
              </span>
            )}
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              style={{
                background: `${estado.color} / 0.1`,
                color: estado.color,
                border: `1px solid ${estado.color} / 0.25`,
              }}
            >
              {estado.label}
            </span>
          </div>
        </div>

        <p className="text-sm leading-relaxed line-clamp-2" style={{ color: 'var(--foreground)' }}>
          {excerpt}
        </p>

        <div className="flex items-center justify-between">
          <MetodoBadge metodo={sessao.metodo_escolhido} />
          <span
            className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: 'var(--primary)' }}
          >
            Abrir →
          </span>
        </div>
      </Link>

      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(sessao.id)}
          className="absolute top-2.5 right-2.5 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-all z-10"
          style={{ color: 'var(--muted-foreground)' }}
          title="Apagar sessão"
          aria-label="Apagar sessão"
        >
          🗑️
        </button>
      )}
    </div>
  )
}
