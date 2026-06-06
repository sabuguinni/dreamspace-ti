'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSessoesAnamneseAdmin, type SessaoAnamneseAdmin } from '@/lib/hooks/useAnamnese'
import { getAnamneseAvatarPublico } from '@/lib/anamnese/avataresPublicos'
import { AnamneseAvatarFoto } from '@/components/anamnese/AnamneseAvatarFoto'
import { RelatorioAnamneseView } from '@/components/anamnese/RelatorioAnamnese'

function scoreColor(score: number): string {
  if (score >= 85) return 'oklch(0.55 0.18 145)'
  if (score >= 65) return 'oklch(0.65 0.18 65)'
  if (score >= 40) return 'oklch(0.631 0.118 65)'
  return 'oklch(0.52 0.22 25)'
}

function alunoInfo(profiles: unknown): { nome: string; email: string } {
  const p = (Array.isArray(profiles) ? profiles[0] : profiles) as { nome_completo?: string; email?: string } | null
  return { nome: p?.nome_completo ?? 'Aluno', email: p?.email ?? '' }
}

export default function AnamneseAdminPage() {
  const { data: sessoes, isLoading, error } = useSessoesAnamneseAdmin()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const forbidden = error instanceof Error && error.message === 'forbidden'

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium" style={{ fontFamily: 'var(--font-lora)', color: 'var(--primary)' }}>
            Anamneses dos Alunos
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Vista de formador — progresso e relatórios de todas as anamneses concluídas.
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

      {forbidden ? (
        <div className="rounded-lg border p-10 text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            🔒 Esta vista é restrita a formadores.
          </p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-lg border p-4 animate-pulse" style={{ background: 'var(--card)', borderColor: 'var(--border)', height: '5rem' }} />
          ))}
        </div>
      ) : (sessoes ?? []).length === 0 ? (
        <div className="rounded-lg border p-10 text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Ainda não há anamneses concluídas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(sessoes as SessaoAnamneseAdmin[]).map(sessao => {
            const avatar = getAnamneseAvatarPublico(sessao.avatar_id)
            const cor = avatar?.cor ?? 'oklch(0.45 0.1 250)'
            const score = sessao.score_final
            const classificacao = sessao.relatorio?.classificacao
            const aluno = alunoInfo(sessao.profiles)
            const data = new Date(sessao.created_at).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })
            const expanded = expandedId === sessao.id

            return (
              <div key={sessao.id} className="rounded-lg border overflow-hidden" style={{ background: 'var(--card)', borderColor: expanded ? `${cor}88` : 'var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : sessao.id)}
                  className="w-full text-left p-4 flex items-center gap-4 transition-colors"
                >
                  <AnamneseAvatarFoto imagem={avatar?.imagem} nome={avatar?.nome} cor={cor} size={44} textClass="text-sm" />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                      {aluno.nome}
                    </p>
                    {aluno.email && (
                      <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{aluno.email}</p>
                    )}
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      {avatar?.nome ?? sessao.avatar_id} · {data} · {sessao.modo === 'voz' ? '🎤 voz' : '⌨️ texto'}
                    </p>
                  </div>

                  {typeof score === 'number' && (
                    <div className="shrink-0 flex flex-col items-center gap-0.5">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ border: `2px solid ${scoreColor(score)}`, color: scoreColor(score) }}>
                        {score}
                      </div>
                      {classificacao && <span className="text-[10px]" style={{ color: scoreColor(score) }}>{classificacao}</span>}
                    </div>
                  )}

                  <span className="shrink-0 text-xs" style={{ color: 'var(--muted-foreground)' }}>{expanded ? '▲' : '▼'}</span>
                </button>

                {expanded && (
                  <div className="border-t p-5" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
                    {sessao.relatorio ? (
                      <RelatorioAnamneseView relatorio={sessao.relatorio} />
                    ) : (
                      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Sem relatório disponível para esta sessão.</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
