'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { SessaoAvatar, Mensagem } from '@/lib/types'

const QK_BASE = ['sessoes_avatar']

type SessaoComMensagens = { sessao: SessaoAvatar; mensagens: Mensagem[] }

// ── Active session for a given avatar slug ────────────────────────────────────

export function useAvatarSessaoAtiva(slug: string) {
  return useQuery({
    queryKey: [...QK_BASE, 'ativa', slug],
    queryFn: async (): Promise<SessaoComMensagens | null> => {
      const res = await fetch(`/api/avatar/sessoes?slug=${slug}`)
      if (!res.ok) throw new Error('Erro ao carregar sessão')
      const data = await res.json() as { sessao: SessaoAvatar | null; mensagens: Mensagem[] }
      if (!data.sessao) return null
      return { sessao: data.sessao, mensagens: data.mensagens }
    },
    enabled: !!slug,
    staleTime: 0,
  })
}

// ── Load a specific session by ID ─────────────────────────────────────────────

export function useAvatarSessao(id: string | null) {
  return useQuery({
    queryKey: [...QK_BASE, id],
    queryFn: async (): Promise<SessaoComMensagens> => {
      const res = await fetch(`/api/avatar/sessoes/${id}`)
      if (!res.ok) throw new Error('Sessão não encontrada')
      return res.json() as Promise<SessaoComMensagens>
    },
    enabled: !!id,
  })
}

// ── Create new avatar session (returns sessao + opening message) ──────────────

export function useCriarAvatarSessao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (avatar_slug: string): Promise<SessaoComMensagens> => {
      const res = await fetch('/api/avatar/sessoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_slug }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Erro ao criar sessão')
      }
      return res.json()
    },
    onSuccess: (data, slug) => {
      qc.setQueryData([...QK_BASE, 'ativa', slug], data)
      qc.setQueryData([...QK_BASE, data.sessao.id], data)
    },
  })
}

// ── List all sessions (for a future history view) ────────────────────────────

export function useAvatarSessoes() {
  const supabase = createClient()
  return useQuery({
    queryKey: QK_BASE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessoes_avatar')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as SessaoAvatar[]
    },
  })
}

// ── Delete session ────────────────────────────────────────────────────────────

export function useApagarSessaoAvatar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/avatar/sessoes/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao apagar sessão')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_BASE }),
  })
}

// ── Conclude session ──────────────────────────────────────────────────────────

export function useConcluirAvatarSessao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<SessaoAvatar> => {
      const res = await fetch(`/api/avatar/sessoes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'concluida' }),
      })
      if (!res.ok) throw new Error('Erro ao concluir sessão')
      return res.json()
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: QK_BASE })
      qc.setQueryData([...QK_BASE, data.id], (old: SessaoComMensagens | undefined) =>
        old ? { ...old, sessao: data } : old
      )
    },
  })
}
