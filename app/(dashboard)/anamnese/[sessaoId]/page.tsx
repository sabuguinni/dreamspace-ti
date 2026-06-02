'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useSessaoAnamnese } from '@/lib/hooks/useAnamnese'
import { ChatAnamnese } from '@/components/anamnese/ChatAnamnese'
import { getAnamneseAvatarPublico } from '@/lib/anamnese/avataresPublicos'
import { Skeleton } from '@/components/ui/skeleton'

export default function AnamneseSessaoPage() {
  const { sessaoId } = useParams<{ sessaoId: string }>()
  const { data: sessao, isLoading, error } = useSessaoAnamnese(sessaoId)

  const avatar = sessao ? getAnamneseAvatarPublico(sessao.avatar_id) : undefined

  return (
    <div className="flex flex-col" style={{ marginTop: '-0.5rem' }}>
      <nav className="text-xs mb-3 flex items-center gap-1.5" style={{ color: 'var(--muted-foreground)' }}>
        <Link href="/anamnese" className="hover:underline">Anamnese</Link>
        <span>›</span>
        <span>{avatar?.nome ?? 'Sessão'}</span>
      </nav>

      {isLoading && <Skeleton className="w-full rounded-lg" style={{ height: 'calc(100dvh - 9rem)' }} />}

      {!isLoading && (error || !sessao) && (
        <div className="rounded-lg border p-8 text-center space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Sessão não encontrada.</p>
          <Link href="/anamnese" className="text-sm underline" style={{ color: 'var(--primary)' }}>Voltar à Anamnese</Link>
        </div>
      )}

      {!isLoading && sessao && <ChatAnamnese sessao={sessao} />}
    </div>
  )
}
