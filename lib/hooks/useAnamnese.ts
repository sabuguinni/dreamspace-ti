'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { SessaoAnamnese } from '@/lib/anamnese/types'

const QK = ['sessoes_anamnese']

export interface AnamneseEstado {
  desbloqueada: boolean
  sessoesConcluidas: number
  necessarias: number
  isAdmin?: boolean
}

export interface SessaoAnamneseAdmin extends SessaoAnamnese {
  profiles: { nome_completo: string; email: string } | null
}

// ── Estado de desbloqueio ──────────────────────────────────────────────────────

export function useAnamneseEstado() {
  return useQuery({
    queryKey: [...QK, 'estado'],
    queryFn: async (): Promise<AnamneseEstado> => {
      const res = await fetch('/api/anamnese/estado')
      if (!res.ok) throw new Error('Erro ao carregar estado')
      return res.json()
    },
  })
}

// ── Lista de sessões ───────────────────────────────────────────────────────────

export function useSessoesAnamnese() {
  return useQuery({
    queryKey: QK,
    queryFn: async (): Promise<SessaoAnamnese[]> => {
      const res = await fetch('/api/anamnese/sessao')
      if (!res.ok) throw new Error('Erro ao carregar sessões')
      const data = await res.json() as { sessoes: SessaoAnamnese[] }
      return data.sessoes ?? []
    },
  })
}

// ── Lista cross-user (admin/formador) ────────────────────────────────────────

export function useSessoesAnamneseAdmin() {
  return useQuery({
    queryKey: [...QK, 'admin'],
    queryFn: async (): Promise<SessaoAnamneseAdmin[]> => {
      const res = await fetch('/api/anamnese/admin/sessoes')
      if (res.status === 403) throw new Error('forbidden')
      if (!res.ok) throw new Error('Erro ao carregar sessões')
      const data = await res.json() as { sessoes: SessaoAnamneseAdmin[] }
      return data.sessoes ?? []
    },
    retry: false,
  })
}

// ── Sessão individual ──────────────────────────────────────────────────────────

export function useSessaoAnamnese(id: string | null) {
  return useQuery({
    queryKey: [...QK, id],
    queryFn: async (): Promise<SessaoAnamnese> => {
      const res = await fetch(`/api/anamnese/sessao/${id}`)
      if (!res.ok) throw new Error('Sessão não encontrada')
      const data = await res.json() as { sessao: SessaoAnamnese }
      return data.sessao
    },
    enabled: !!id,
  })
}

// ── Criar sessão ───────────────────────────────────────────────────────────────

export interface CriarAnamneseResult {
  sessao: SessaoAnamnese
}

export function useCriarSessaoAnamnese() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { avatar_id: string; modo: 'escrito' | 'voz' }): Promise<SessaoAnamnese> => {
      const res = await fetch('/api/anamnese/sessao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Erro ao criar sessão')
      }
      const data = await res.json() as CriarAnamneseResult
      return data.sessao
    },
    onSuccess: (sessao) => {
      qc.setQueryData([...QK, sessao.id], sessao)
      qc.invalidateQueries({ queryKey: QK })
    },
  })
}

// ── Apagar sessão ──────────────────────────────────────────────────────────────

export function useApagarSessaoAnamnese() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/anamnese/sessao/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao apagar sessão')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  })
}
