'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useAvatarSessoes, useApagarSessaoAvatar } from '@/lib/hooks/useAvatar'
import { FicheiroModal } from '@/components/avatar/FicheiroModal'
import { getAvatar } from '@/lib/content/avatares'
import type { SessaoAvatar, AvatarReport } from '@/lib/types'

function scoreColor(score: number): string {
  if (score >= 70) return 'oklch(0.52 0.18 148)'
  if (score >= 50) return 'oklch(0.72 0.16 72)'
  return 'oklch(0.52 0.22 25)'
}

export default function HistoricoPage() {
  const { data: sessoes, isLoading } = useAvatarSessoes()
  const apagar = useApagarSessaoAvatar()
  const [ficheiroSessao, setFicheiroSessao] = useState<SessaoAvatar | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const concluidas = (sessoes ?? []).filter(s => s.estado === 'concluida')

  function handleConfirmDelete() {
    if (!confirmDeleteId) return
    apagar.mutate(confirmDeleteId, {
      onSuccess: () => setConfirmDeleteId(null),
    })
  }

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-medium"
            style={{ fontFamily: 'var(--font-lora)', color: 'var(--primary)' }}
          >
            Histórico de Sessões
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Sessões de treino concluídas com os avatares.
          </p>
        </div>
        <Link
          href="/avatares"
          className="text-xs shrink-0 px-3 h-8 inline-flex items-center rounded-md border transition-colors"
          style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}
        >
          ← Avatares
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="rounded-lg border p-4 animate-pulse"
              style={{ background: 'var(--card)', borderColor: 'var(--border)', height: '5rem' }}
            />
          ))}
        </div>
      ) : concluidas.length === 0 ? (
        <div
          className="rounded-lg border p-10 text-center space-y-3"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Ainda não tens sessões concluídas.
          </p>
          <Link
            href="/avatares"
            className="inline-flex items-center justify-center rounded-md px-4 h-8 text-xs font-medium"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            Iniciar uma sessão →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {concluidas.map(sessao => {
            const avatar = getAvatar(sessao.avatar_slug)
            if (!avatar) return null
            const notas = (sessao.notas_evolucao ?? {}) as Record<string, unknown>
            const score = notas.avatar_report_score as number | undefined
            const data = new Date(sessao.created_at).toLocaleDateString('pt-PT', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })
            const dicebearSrc = `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(avatar.nome)}`

            return (
              <div
                key={sessao.id}
                className="rounded-lg border p-4 flex items-center gap-4"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                {/* Avatar image */}
                <Image
                  src={dicebearSrc}
                  alt={avatar.nome}
                  width={44}
                  height={44}
                  className="rounded-full shrink-0"
                  unoptimized
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    {avatar.nome}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {data}
                  </p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>
                    {avatar.competenciaTreinada}
                  </p>
                </div>

                {/* Score badge */}
                {score !== undefined && (
                  <div
                    className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{
                      border: `2px solid ${scoreColor(score)}`,
                      color: scoreColor(score),
                    }}
                  >
                    {score}
                  </div>
                )}

                {/* Actions */}
                <div className="shrink-0 flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFicheiroSessao(sessao)}
                    className="inline-flex items-center justify-center rounded-md px-3 h-8 text-xs font-medium transition-colors"
                    style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                  >
                    Ver ficheiro
                  </button>
                  <Link
                    href={`/avatares/${avatar.slug}?new=1`}
                    className="inline-flex items-center justify-center rounded-md px-3 h-8 text-xs font-medium border transition-colors"
                    style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                  >
                    Nova sessão
                  </Link>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(sessao.id)}
                    className="inline-flex items-center justify-center rounded-md px-3 h-8 text-xs font-medium border transition-colors"
                    style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                    title="Apagar sessão"
                  >
                    🗑️ Apagar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* FicheiroModal */}
      {ficheiroSessao && (() => {
        const avatar = getAvatar(ficheiroSessao.avatar_slug)
        if (!avatar) return null
        const notas = (ficheiroSessao.notas_evolucao ?? {}) as Record<string, unknown>
        const report = (notas.avatar_report ?? null) as AvatarReport | null
        return (
          <FicheiroModal
            sessaoId={ficheiroSessao.id}
            nome={avatar.nome}
            ficheiro={avatar.ficheiroSecreto}
            report={report}
            isLoadingReport={false}
            onClose={() => setFicheiroSessao(null)}
          />
        )
      })()}

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
