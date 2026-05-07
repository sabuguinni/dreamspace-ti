'use client'

import { Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useSessaoSupervisor } from '@/lib/hooks/useSupervisor'
import { SessaoChat } from '@/components/supervisor/SessaoChat'
import { Skeleton } from '@/components/ui/skeleton'

function ChatSkeleton() {
  return (
    <div
      className="flex flex-col lg:flex-row gap-0 rounded-lg border overflow-hidden"
      style={{ height: 'calc(100dvh - 9rem)', borderColor: 'var(--border)' }}
    >
      <div
        className="lg:w-72 p-5 space-y-5 border-b lg:border-b-0 lg:border-r"
        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
      >
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-32 rounded-full" />
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-16 w-3/4 rounded-2xl" />
          <Skeleton className="h-24 w-4/5 rounded-2xl ml-auto" />
        </div>
        <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}

function SessaoChatInner() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const initialInput = searchParams.get('m') ?? undefined

  const { data, isLoading, error } = useSessaoSupervisor(id)

  if (isLoading) return <ChatSkeleton />

  if (error || !data?.sessao) {
    return (
      <div className="space-y-3 pt-1">
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Sessão não encontrada.
        </p>
        <Link href="/supervisor" className="text-sm underline" style={{ color: 'var(--primary)' }}>
          Voltar ao Supervisor
        </Link>
      </div>
    )
  }

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ height: 'calc(100dvh - 9rem)', borderColor: 'var(--border)', display: 'flex' }}
    >
      <SessaoChat
        sessaoId={id}
        sessaoInicial={data.sessao}
        mensagensIniciais={data.mensagens}
        initialInput={initialInput}
      />
    </div>
  )
}

export default function SessaoChatPage() {
  return (
    <div className="flex flex-col" style={{ marginTop: '-0.5rem' }}>
      <nav className="text-xs mb-3" style={{ color: 'var(--muted-foreground)' }}>
        <Link href="/supervisor" className="hover:underline">Supervisor</Link>
        <span className="mx-1.5">›</span>
        <span>Sessão</span>
      </nav>
      <Suspense fallback={<ChatSkeleton />}>
        <SessaoChatInner />
      </Suspense>
    </div>
  )
}
