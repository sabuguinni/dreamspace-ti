'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { SonhoDiario } from '@/lib/types'

const QUERY_KEY = ['sonhos']

export function useSonhos() {
  const supabase = createClient()
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<SonhoDiario[]> => {
      const { data, error } = await supabase
        .from('sonhos_diario')
        .select('*')
        .order('data_sonho', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useSonho(id: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: [...QUERY_KEY, id],
    queryFn: async (): Promise<SonhoDiario> => {
      const { data, error } = await supabase
        .from('sonhos_diario')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export interface CriarSonhoInput {
  data_sonho: string
  titulo?: string | null
  texto: string
  emocao_score?: number | null
  notas?: string | null
  tags: string[]
}

export function useCriarSonho() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CriarSonhoInput): Promise<SonhoDiario> => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('sonhos_diario')
        .insert({ ...input, user_id: user!.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useEditarSonho() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CriarSonhoInput> & { id: string }): Promise<SonhoDiario> => {
      const { data, error } = await supabase
        .from('sonhos_diario')
        .update(input)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: QUERY_KEY })
      qc.setQueryData([...QUERY_KEY, data.id], data)
    },
  })
}

export function useApagarSonho() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sonhos_diario').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
