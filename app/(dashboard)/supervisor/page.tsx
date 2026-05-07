'use client'

import Link from 'next/link'
import { useSessoesSupervisor } from '@/lib/hooks/useSupervisor'
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
            <SessaoCard key={sessao.id} sessao={sessao} />
          ))}
        </div>
      )}
    </div>
  )
}
