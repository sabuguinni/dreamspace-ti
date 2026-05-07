'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getAvatar } from '@/lib/content/avatares'
import { useAvatarSessaoAtiva, useCriarAvatarSessao } from '@/lib/hooks/useAvatar'
import { AvatarChat } from '@/components/avatar/AvatarChat'
import { Skeleton } from '@/components/ui/skeleton'
import type { SessaoAvatar, Mensagem } from '@/lib/types'

const AVATAR_COLORS: Record<string, { bg: string; fg: string }> = {
  mariana: { bg: 'oklch(0.26 0.15 252)', fg: 'white' },
  carlos:  { bg: 'oklch(0.38 0.05 245)', fg: 'white' },
  miguel:  { bg: 'oklch(0.38 0.18 288)', fg: 'white' },
  beatriz: { bg: 'oklch(0.48 0.08 148)', fg: 'white' },
}

function ChatSkeleton({ nome, slug, profissao, idade }: { nome: string; slug: string; profissao: string; idade: number }) {
  const color = AVATAR_COLORS[slug] ?? { bg: 'oklch(0.42 0.08 252)', fg: 'white' }
  return (
    <div
      className="rounded-lg border overflow-hidden flex flex-col"
      style={{ height: 'calc(100dvh - 9rem)', borderColor: 'var(--border)' }}
    >
      {/* Header skeleton */}
      <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
            style={{ background: color.bg, color: color.fg }}>
            {nome[0]}
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{nome}, {idade} anos</p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{profissao}</p>
          </div>
        </div>
        <Skeleton className="h-4 w-24" />
      </div>
      {/* Messages area */}
      <div className="flex-1 p-6 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="inline-flex gap-1">
            <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: color.bg, animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: color.bg, animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: color.bg, animationDelay: '300ms' }} />
          </div>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{nome} está a preparar a sessão…</p>
        </div>
      </div>
      {/* Input area */}
      <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  )
}

function AvatarSessaoInner() {
  const { slug } = useParams<{ slug: string }>()
  const avatar = getAvatar(slug)

  const { data: ativaData, isLoading: isLoadingAtiva } = useAvatarSessaoAtiva(slug)
  const { mutateAsync: criarSessao, isPending: isCriando } = useCriarAvatarSessao()

  const [sessao, setSessao] = useState<SessaoAvatar | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [created, setCreated] = useState(false)

  // Once the active-session query resolves, either use it or create a new one
  useEffect(() => {
    if (isLoadingAtiva || created) return

    if (ativaData) {
      setSessao(ativaData.sessao)
      setMensagens(ativaData.mensagens)
      setCreated(true)
      return
    }

    // No active session — create one (only once)
    setCreated(true)
    criarSessao(slug).then(data => {
      setSessao(data.sessao)
      setMensagens(data.mensagens)
    }).catch(() => {
      // leave sessao as null — error state rendered below
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingAtiva, ativaData])

  if (!avatar) {
    return (
      <div className="space-y-3">
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Avatar não encontrado.</p>
        <Link href="/avatares" className="text-sm underline" style={{ color: 'var(--primary)' }}>
          Ver avatares
        </Link>
      </div>
    )
  }

  const isLoading = isLoadingAtiva || isCriando || !sessao

  if (isLoading) {
    return (
      <ChatSkeleton
        nome={avatar.nome}
        slug={avatar.slug}
        profissao={avatar.profissao}
        idade={avatar.idade}
      />
    )
  }

  return (
    <div
      className="rounded-lg border overflow-hidden flex"
      style={{ height: 'calc(100dvh - 9rem)', borderColor: 'var(--border)' }}
    >
      <AvatarChat
        sessaoId={sessao.id}
        sessaoInicial={sessao}
        mensagensIniciais={mensagens}
        avatarNome={avatar.nome}
        avatarSlug={avatar.slug}
        avatarIdade={avatar.idade}
        avatarProfissao={avatar.profissao}
        ficheiro={avatar.ficheiroSecreto}
      />
    </div>
  )
}

export default function AvatarSessaoPage() {
  const { slug } = useParams<{ slug: string }>()
  const avatar = getAvatar(slug)

  return (
    <div className="flex flex-col" style={{ marginTop: '-0.5rem' }}>
      <nav className="text-xs mb-3" style={{ color: 'var(--muted-foreground)' }}>
        <Link href="/avatares" className="hover:underline">Avatares</Link>
        <span className="mx-1.5">›</span>
        <span>{avatar?.nome ?? slug}</span>
      </nav>
      <Suspense fallback={
        avatar ? (
          <ChatSkeleton
            nome={avatar.nome}
            slug={avatar.slug}
            profissao={avatar.profissao}
            idade={avatar.idade}
          />
        ) : <Skeleton className="h-96 w-full rounded-lg" />
      }>
        <AvatarSessaoInner />
      </Suspense>
    </div>
  )
}
