'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ANAMNESE_AVATARES_PUBLICOS } from '@/lib/anamnese/avataresPublicos'
import { useCriarSessaoAnamnese } from '@/lib/hooks/useAnamnese'

export function AvatarSelectorAnamnese() {
  const router = useRouter()
  const criar = useCriarSessaoAnamnese()
  const [criandoId, setCriandoId] = useState<string | null>(null)

  async function handleEscolher(avatarId: string) {
    if (criandoId) return
    setCriandoId(avatarId)
    try {
      const sessao = await criar.mutateAsync(avatarId)
      router.push(`/anamnese/${sessao.id}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar sessão'
      toast.error(msg)
      setCriandoId(null)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {ANAMNESE_AVATARES_PUBLICOS.map(avatar => {
        const isLoading = criandoId === avatar.id
        return (
          <button
            key={avatar.id}
            type="button"
            onClick={() => handleEscolher(avatar.id)}
            disabled={!!criandoId}
            className="text-left rounded-xl border p-5 space-y-3 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
            style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-base font-semibold text-white shrink-0"
                style={{ background: avatar.cor }}
              >
                {avatar.nome[0]}
              </div>
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
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium"
              style={{ color: isLoading ? 'var(--muted-foreground)' : avatar.cor }}
            >
              {isLoading ? 'A preparar sessão…' : 'Iniciar anamnese →'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
