'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
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

type AvatarMode = 'text' | 'voice'

function AvatarSessaoInner() {
  const { slug } = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const forceNew = searchParams.get('new') === '1'
  const avatar = getAvatar(slug)

  const { data: ativaData, isLoading: isLoadingAtiva } = useAvatarSessaoAtiva(slug)
  const { mutateAsync: criarSessao } = useCriarAvatarSessao()

  const [sessao, setSessao] = useState<SessaoAvatar | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [created, setCreated] = useState(false)
  // null = not yet chosen; set by mode selection screen
  const [selectedMode, setSelectedMode] = useState<AvatarMode | null>(null)

  useEffect(() => {
    if (created) return

    // Returning to existing session — skip mode selection
    if (!forceNew && ativaData) {
      setSessao(ativaData.sessao)
      setMensagens(ativaData.mensagens)
      setCreated(true)
      return
    }

    // Still checking for existing session
    if (!forceNew && isLoadingAtiva) return

    // New session: wait until user picks a mode
    if (selectedMode === null) return

    // Mode chosen — create the session
    setCreated(true)
    criarSessao(slug).then(data => {
      setSessao(data.sessao)
      setMensagens(data.mensagens)
      if (forceNew) router.replace(`/avatares/${slug}`)
    }).catch(() => {
      // leave sessao as null — error state rendered below
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingAtiva, ativaData, forceNew, created, selectedMode])

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

  const color = AVATAR_COLORS[avatar.slug] ?? { bg: 'oklch(0.42 0.08 252)', fg: 'white' }

  // ── Phase 1: loading existing session check ──────────────────────────────────
  if (!forceNew && isLoadingAtiva) {
    return <ChatSkeleton nome={avatar.nome} slug={avatar.slug} profissao={avatar.profissao} idade={avatar.idade} />
  }

  // ── Phase 2: mode selection (only for new sessions / forceNew) ───────────────
  const needsModeSelection = selectedMode === null && (!ativaData || forceNew)
  if (needsModeSelection) {
    return (
      <div
        className="rounded-lg border overflow-hidden flex flex-col items-center justify-center"
        style={{ height: 'calc(100dvh - 9rem)', borderColor: 'var(--border)', background: 'var(--card)' }}
      >
        <div className="max-w-sm w-full px-6 space-y-8 text-center">
          <div className="space-y-2">
            <p className="text-lg font-medium" style={{ fontFamily: 'var(--font-lora)', color: 'var(--foreground)' }}>
              Como queres treinar com {avatar.nome}?
            </p>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Escolhe o modo antes de começar a sessão
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button
              type="button"
              onClick={() => setSelectedMode('text')}
              className="rounded-xl border p-5 text-left space-y-1.5 transition-all hover:scale-[1.02] active:scale-[0.99]"
              style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
            >
              <p className="text-base font-medium" style={{ color: 'var(--foreground)' }}>
                💬 Treino em Texto
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                Troca de mensagens escrita com {avatar.nome}. Gratuito, sem custos de voz.
              </p>
              <p className="text-xs font-medium" style={{ color: 'oklch(0.631 0.118 65)' }}>
                Gratuito
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMode('voice')}
              className="rounded-xl border p-5 text-left space-y-1.5 transition-all hover:scale-[1.02] active:scale-[0.99]"
              style={{ borderColor: color.bg, background: 'var(--background)' }}
            >
              <p className="text-base font-medium" style={{ color: 'var(--foreground)' }}>
                🎤 Treino com Voz
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                Sessão de voz em tempo real com {avatar.nome} via Gemini Live. Mais imersivo e próximo da prática clínica real.
              </p>
              <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                0.02€/min de voz activa
              </p>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Phase 3: creating / loading session ──────────────────────────────────────
  if (!sessao) {
    return <ChatSkeleton nome={avatar.nome} slug={avatar.slug} profissao={avatar.profissao} idade={avatar.idade} />
  }

  // ── Phase 4: chat ready ───────────────────────────────────────────────────────
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
        initialMode={selectedMode ?? undefined}
      />
    </div>
  )
}

export default function AvatarSessaoPage() {
  const { slug } = useParams<{ slug: string }>()
  const avatar = getAvatar(slug)

  return (
    <div className="flex flex-col" style={{ marginTop: '-0.5rem' }}>
      <nav className="text-xs mb-3 flex items-center justify-between" style={{ color: 'var(--muted-foreground)' }}>
        <div>
          <Link href="/avatares" className="hover:underline">Avatares</Link>
          <span className="mx-1.5">›</span>
          <span>{avatar?.nome ?? slug}</span>
        </div>
        <Link
          href={`/avatares/${slug}?new=1`}
          className="text-xs px-2.5 h-7 inline-flex items-center rounded border transition-colors hover:border-primary/40"
          style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}
        >
          + Nova sessão
        </Link>
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
