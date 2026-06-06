'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSessoesAnamnese, useApagarSessaoAnamnese } from '@/lib/hooks/useAnamnese'
import { getAnamneseAvatarPublico } from '@/lib/anamnese/avataresPublicos'
import { AnamneseAvatarFoto } from '@/components/anamnese/AnamneseAvatarFoto'

function scoreColor(score: number): string {
  if (score >= 85) return 'oklch(0.55 0.18 145)'
  if (score >= 65) return 'oklch(0.65 0.18 65)'
  if (score >= 40) return 'oklch(0.631 0.118 65)'
  return 'oklch(0.52 0.22 25)'
}

export default function AnamneseHistoricoPage() {
  const { data: sessoes, isLoading } = useSessoesAnamnese()
  const apagar = useApagarSessaoAnamnese()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const concluidas = (sessoes ?? []).filter(s => s.estado === 'concluida')

  function handleConfirmDelete() {
    if (!confirmDeleteId) return
    apagar.mutate(confirmDeleteId, { onSuccess: () => setConfirmDeleteId(null) })
  }

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium" style={{ fontFamily: 'var(--font-lora)', color: 'var(--primary)' }}>
            Histórico de Anamneses
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            As tuas sessões de anamnese concluídas e respectivas avaliações.
          </p>
        </div>
        <Link
          href="/anamnese"
          className="text-xs shrink-0 px-3 h-8 inline-flex items-center rounded-md border transition-colors"
          style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}
        >
          ← Anamnese
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-lg border p-4 animate-pulse" style={{ background: 'var(--card)', borderColor: 'var(--border)', height: '5rem' }} />
          ))}
        </div>
      ) : concluidas.length === 0 ? (
        <div className="rounded-lg border p-10 text-center space-y-3" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Ainda não tens anamneses concluídas.</p>
          <Link
            href="/anamnese"
            className="inline-flex items-center justify-center rounded-md px-4 h-8 text-xs font-medium"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            Iniciar uma sessão →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {concluidas.map(sessao => {
            const avatar = getAnamneseAvatarPublico(sessao.avatar_id)
            const cor = avatar?.cor ?? 'oklch(0.45 0.1 250)'
            const score = sessao.score_final
            const classificacao = sessao.relatorio?.classificacao
            const data = new Date(sessao.created_at).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })

            return (
              <div key={sessao.id} className="rounded-lg border p-4 flex items-center gap-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <AnamneseAvatarFoto imagem={avatar?.imagem} nome={avatar?.nome} cor={cor} size={44} textClass="text-sm" />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    {avatar?.nome ?? sessao.avatar_id}{avatar ? `, ${avatar.idade} anos` : ''}
                    <span className="ml-2 text-xs font-normal" style={{ color: 'var(--muted-foreground)' }}>· {sessao.modo === 'voz' ? '🎤 voz' : '⌨️ texto'}</span>
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{data}</p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>{avatar?.area}</p>
                </div>

                {typeof score === 'number' && (
                  <div className="shrink-0 flex flex-col items-center gap-0.5">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ border: `2px solid ${scoreColor(score)}`, color: scoreColor(score) }}>
                      {score}
                    </div>
                    {classificacao && <span className="text-[10px]" style={{ color: scoreColor(score) }}>{classificacao}</span>}
                  </div>
                )}

                <div className="shrink-0 flex flex-col gap-1.5">
                  <Link
                    href={`/anamnese/${sessao.id}`}
                    className="inline-flex items-center justify-center rounded-md px-3 h-8 text-xs font-medium transition-colors"
                    style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                  >
                    Ver relatório
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

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-xl border p-6 space-y-4 max-w-sm w-full mx-4 shadow-xl" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="space-y-1.5">
              <p className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>Apagar sessão?</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>Esta acção é irreversível. A conversa e o relatório serão apagados.</p>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDeleteId(null)} disabled={apagar.isPending} className="px-3 h-8 rounded-md text-xs border transition-colors disabled:opacity-50" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>Cancelar</button>
              <button type="button" onClick={handleConfirmDelete} disabled={apagar.isPending} className="px-3 h-8 rounded-md text-xs font-medium transition-colors disabled:opacity-50" style={{ background: 'oklch(0.52 0.22 25)', color: 'white' }}>{apagar.isPending ? 'A apagar…' : 'Apagar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
