'use client'

import Link from 'next/link'
import type { SonhoDiario } from '@/lib/types'
import { EmocaoScore } from './EmocaoScore'

interface SonhoCardProps {
  sonho: SonhoDiario
  activeTag?: string | null
  onTagClick?: (tag: string) => void
}

function formatDataSonho(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function SonhoCard({ sonho, activeTag, onTagClick }: SonhoCardProps) {
  const titulo = sonho.titulo?.trim() || sonho.texto.slice(0, 60) + (sonho.texto.length > 60 ? '…' : '')

  return (
    <div
      className="rounded-lg border p-5 space-y-3 transition-colors hover:border-primary/30 group relative"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5 flex-1 min-w-0">
          <Link
            href={`/diario/${sonho.id}`}
            className="text-sm font-medium leading-tight line-clamp-2 hover:underline block"
            style={{ color: 'var(--foreground)' }}
          >
            {titulo}
          </Link>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {formatDataSonho(sonho.data_sonho)}
          </p>
        </div>
        <Link
          href={`/diario/${sonho.id}`}
          className="shrink-0 text-xs font-medium transition-opacity opacity-0 group-hover:opacity-100"
          style={{ color: 'var(--primary)' }}
          aria-label="Ver sonho"
        >
          Ver →
        </Link>
      </div>

      <p className="text-sm line-clamp-3 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
        {sonho.texto}
      </p>

      {sonho.emocao_score != null && (
        <EmocaoScore score={sonho.emocao_score} size="sm" />
      )}

      {sonho.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sonho.tags.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => onTagClick?.(tag)}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: activeTag === tag
                  ? 'oklch(0.375 0.132 288 / 0.2)'
                  : 'oklch(0.375 0.132 288 / 0.08)',
                color: 'oklch(0.375 0.132 288)',
                border: `1px solid ${activeTag === tag ? 'oklch(0.375 0.132 288 / 0.4)' : 'oklch(0.375 0.132 288 / 0.2)'}`,
              }}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
