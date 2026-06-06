'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ANAMNESE_AVATARES_PUBLICOS, getAnamneseAvatarPublico } from '@/lib/anamnese/avataresPublicos'
import { useCriarSessaoAnamnese } from '@/lib/hooks/useAnamnese'
import { AnamneseAvatarFoto } from './AnamneseAvatarFoto'

type Modo = 'escrito' | 'voz'

export function AvatarSelectorAnamnese() {
  const router = useRouter()
  const criar = useCriarSessaoAnamnese()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const selected = selectedId ? getAnamneseAvatarPublico(selectedId) : undefined

  async function handleCriar(modo: Modo) {
    if (!selectedId || isCreating) return
    setIsCreating(true)
    try {
      const sessao = await criar.mutateAsync({ avatar_id: selectedId, modo })
      router.push(`/anamnese/${sessao.id}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar sessão'
      toast.error(msg)
      setIsCreating(false)
    }
  }

  // ── Passo 2: seleção de modo (Escrito / Voz) ─────────────────────────────────
  if (selected) {
    const cor = selected.cor
    return (
      <div className="rounded-xl border p-6 space-y-6" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        {/* Cliente escolhido + voltar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AnamneseAvatarFoto imagem={selected.imagem} nome={selected.nome} cor={cor} size={44} textClass="text-base" />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{selected.nome}, {selected.idade} anos</p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{selected.area}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            disabled={isCreating}
            className="text-xs underline disabled:opacity-50"
            style={{ color: 'var(--muted-foreground)' }}
          >
            ← Trocar cliente
          </button>
        </div>

        {/* Cartões de modo */}
        <div className="space-y-3">
          <p className="text-sm font-medium" style={{ fontFamily: 'var(--font-lora)', color: 'var(--foreground)' }}>
            Como queres conduzir a anamnese com {selected.nome}?
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleCriar('escrito')}
              disabled={isCreating}
              className="rounded-xl border p-5 text-left space-y-1.5 transition-all hover:scale-[1.02] active:scale-[0.99] disabled:opacity-60"
              style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
            >
              <p className="text-base font-medium" style={{ color: 'var(--foreground)' }}>💬 Escrito</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                Conduzes a anamnese por escrito. O cliente e o Supervisor respondem em texto. Sem custos de voz.
              </p>
              <p className="text-xs font-medium" style={{ color: 'oklch(0.631 0.118 65)' }}>Gratuito</p>
            </button>

            <button
              type="button"
              onClick={() => handleCriar('voz')}
              disabled={isCreating}
              className="rounded-xl border p-5 text-left space-y-1.5 transition-all hover:scale-[1.02] active:scale-[0.99] disabled:opacity-60"
              style={{ borderColor: cor, background: 'var(--background)' }}
            >
              <p className="text-base font-medium" style={{ color: 'var(--foreground)' }}>🎤 Voz</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                O cliente fala com voz própria e o Supervisor intervém em voz. Mais imersivo, próximo da prática real.
              </p>
              <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Síntese de voz por turno falado</p>
            </button>
          </div>

          {isCreating && (
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>A preparar sessão…</p>
          )}
        </div>
      </div>
    )
  }

  // ── Passo 1: escolher cliente ────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {ANAMNESE_AVATARES_PUBLICOS.map(avatar => (
        <button
          key={avatar.id}
          type="button"
          onClick={() => setSelectedId(avatar.id)}
          className="text-left rounded-xl border p-5 space-y-3 transition-all hover:scale-[1.01] active:scale-[0.99]"
          style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
        >
          <div className="flex items-center gap-3">
            <AnamneseAvatarFoto imagem={avatar.imagem} nome={avatar.nome} cor={avatar.cor} size={44} textClass="text-base" />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                {avatar.nome}, {avatar.idade} anos
              </p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {avatar.area}
              </p>
            </div>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            {avatar.descricao}
          </p>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: avatar.cor }}>
            Escolher →
          </span>
        </button>
      ))}
    </div>
  )
}
