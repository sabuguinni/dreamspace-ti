'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useSonhos } from '@/lib/hooks/useSonhos'
import { SonhoCard } from '@/components/diario/SonhoCard'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

function DiarioSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-lg border p-5 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/4" />
          <Skeleton className="h-12 w-full" />
        </div>
      ))}
    </div>
  )
}

export default function DiarioPage() {
  const { data: sonhos, isLoading } = useSonhos()
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!sonhos) return []
    let result = sonhos
    if (activeTag) {
      result = result.filter(s => s.tags.includes(activeTag))
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      result = result.filter(s =>
        s.titulo?.toLowerCase().includes(q) ||
        s.texto.toLowerCase().includes(q) ||
        s.notas?.toLowerCase().includes(q) ||
        s.tags.some(t => t.includes(q))
      )
    }
    return result
  }, [sonhos, query, activeTag])

  const allTags = useMemo(() => {
    if (!sonhos) return []
    const tagSet = new Set<string>()
    sonhos.forEach(s => s.tags.forEach(t => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [sonhos])

  function toggleTag(tag: string) {
    setActiveTag(prev => (prev === tag ? null : tag))
  }

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium" style={{ fontFamily: 'var(--font-lora)', color: 'var(--primary)' }}>
            Diário de Sonhos
          </h1>
          {!isLoading && sonhos && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              {sonhos.length} {sonhos.length === 1 ? 'registo' : 'registos'}
            </p>
          )}
        </div>
        <Link
          href="/diario/novo"
          className="inline-flex items-center justify-center rounded-md px-4 h-9 text-sm font-medium transition-colors"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          + Novo sonho
        </Link>
      </div>

      {/* Search */}
      <Input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Pesquisar no diário…"
        className="text-sm"
      />

      {/* Tag filter strip */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allTags.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-all"
              style={{
                background: activeTag === tag
                  ? 'oklch(0.375 0.132 288 / 0.18)'
                  : 'var(--card)',
                color: 'oklch(0.375 0.132 288)',
                border: `1px solid ${activeTag === tag ? 'oklch(0.375 0.132 288 / 0.5)' : 'oklch(0.375 0.132 288 / 0.2)'}`,
              }}
            >
              #{tag}
            </button>
          ))}
          {activeTag && (
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className="text-xs underline"
              style={{ color: 'var(--muted-foreground)' }}
            >
              limpar filtro
            </button>
          )}
        </div>
      )}

      {isLoading && <DiarioSkeleton />}

      {!isLoading && filtered.length === 0 && sonhos?.length === 0 && (
        <div className="rounded-lg border p-12 text-center space-y-4"
          style={{ borderColor: 'var(--border)', background: 'var(--card)', borderStyle: 'dashed' }}>
          <p className="text-3xl">🌙</p>
          <div className="space-y-1">
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              O teu diário está vazio
            </p>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Regista o teu primeiro sonho enquanto ainda está fresco na memória.
            </p>
          </div>
          <Link
            href="/diario/novo"
            className="inline-flex items-center justify-center rounded-md px-5 h-9 text-sm font-medium"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            Registar primeiro sonho
          </Link>
        </div>
      )}

      {!isLoading && filtered.length === 0 && (sonhos?.length ?? 0) > 0 && (
        <div className="rounded-lg border p-8 text-center"
          style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Nenhum sonho encontrado para "{activeTag ?? query}".
          </p>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(sonho => (
            <SonhoCard
              key={sonho.id}
              sonho={sonho}
              activeTag={activeTag}
              onTagClick={toggleTag}
            />
          ))}
        </div>
      )}
    </div>
  )
}
