'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { SessaoSupervisor, MetodoTerapeutico } from '@/lib/types'

const QUERY_KEY = ['sessoes_supervisor']

type SessaoComCount = SessaoSupervisor & {
  mensagens: { count: number }[] | null
}

export function useSessoesSupervisor() {
  const supabase = createClient()
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<SessaoComCount[]> => {
      const { data, error } = await supabase
        .from('sessoes_supervisor')
        .select('*, mensagens!sessao_supervisor_id(count)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as SessaoComCount[]
    },
  })
}

export function useSessaoSupervisor(id: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: [...QUERY_KEY, id],
    queryFn: async () => {
      const res = await fetch(`/api/supervisor/sessoes/${id}`)
      if (!res.ok) throw new Error('Sessão não encontrada')
      return res.json() as Promise<{ sessao: SessaoSupervisor; mensagens: import('@/lib/types').Mensagem[] }>
    },
    enabled: !!id,
  })
}

export interface CriarSessaoInput {
  sonho_texto: string
  caso_descricao?: string | null
  metodo_escolhido?: MetodoTerapeutico
  sonho_id?: string | null
}

export function useCriarSessaoSupervisor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CriarSessaoInput): Promise<SessaoSupervisor> => {
      const res = await fetch('/api/supervisor/sessoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Erro ao criar sessão')
      }
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useApagarSessaoSupervisor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/supervisor/sessoes/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao apagar sessão')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useConcluirSessao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<SessaoSupervisor> => {
      const res = await fetch(`/api/supervisor/sessoes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'concluida' }),
      })
      if (!res.ok) throw new Error('Erro ao concluir sessão')
      return res.json()
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: QUERY_KEY })
      qc.setQueryData([...QUERY_KEY, data.id], (old: { sessao: SessaoSupervisor; mensagens: unknown[] } | undefined) =>
        old ? { ...old, sessao: data } : old
      )
    },
  })
}
