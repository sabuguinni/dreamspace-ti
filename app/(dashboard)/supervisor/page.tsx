'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSessoesSupervisor, useApagarSessaoSupervisor } from '@/lib/hooks/useSupervisor'
import { SessaoCard } from '@/components/supervisor/SessaoCard'
import { Skeleton } from '@/components/ui/skeleton'

function SupervisorSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-lg border p-5 space-y-3"
          style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <div className="flex justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex justify-between">
            <Skeleton className="h-5 w-32 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function SupervisorPage() {
  const { data: sessoes, isLoading } = useSessoesSupervisor()
  const apagar = useApagarSessaoSupervisor()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  function handleConfirmDelete() {
    if (!confirmDeleteId) return
    apagar.mutate(confirmDeleteId, {
      onSuccess: () => setConfirmDeleteId(null),
    })
  }

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium" style={{ fontFamily: 'var(--font-lora)', color: 'var(--primary)' }}>
            Supervisor de IA
          </h1>
          {!isLoading && sessoes && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              {sessoes.length} {sessoes.length === 1 ? 'sessão' : 'sessões'}
            </p>
          )}
        </div>
        <Link
          href="/supervisor/nova"
          className="inline-flex items-center justify-center rounded-md px-4 h-9 text-sm font-medium transition-colors"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          + Nova sessão
        </Link>
      </div>

      {isLoading && <SupervisorSkeleton />}

      {!isLoading && sessoes?.length === 0 && (
        <div
          className="rounded-lg border p-12 text-center space-y-4"
          style={{ borderColor: 'var(--border)', background: 'var(--card)', borderStyle: 'dashed' }}
        >
          <div className="space-y-1">
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              Ainda não tens sessões de Supervisão
            </p>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Leva um sonho ao Supervisor para praticar a reflexão socrática em 4 níveis.
            </p>
          </div>
          <Link
            href="/supervisor/nova"
            className="inline-flex items-center justify-center rounded-md px-5 h-9 text-sm font-medium"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            Iniciar primeira sessão
          </Link>
        </div>
      )}

      {!isLoading && sessoes && sessoes.length > 0 && (
        <div className="space-y-3">
          {sessoes.map(sessao => (
            <SessaoCard
              key={sessao.id}
              sessao={sessao}
              onDelete={setConfirmDeleteId}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="rounded-xl border p-6 space-y-4 max-w-sm w-full mx-4 shadow-xl"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="space-y-1.5">
              <p className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>
                Apagar sessão?
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                Esta acção é irreversível. Todas as mensagens desta sessão serão apagadas.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                disabled={apagar.isPending}
                className="px-3 h-8 rounded-md text-xs border transition-colors disabled:opacity-50"
                style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={apagar.isPending}
                className="px-3 h-8 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
                style={{ background: 'oklch(0.52 0.22 25)', color: 'white' }}
              >
                {apagar.isPending ? 'A apagar…' : 'Apagar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
