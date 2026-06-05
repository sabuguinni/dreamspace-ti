import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { lookupUser } from '@/lib/aiCreditsClient'
import { isMissingAnamneseTable } from '@/lib/anamnese/serverUtils'

// GET /api/anamnese/admin/sessoes — lista cross-user (formador) de TODAS as anamneses
// concluídas, com o aluno. Só para admins (isAdmin no LMS). Usa service client para
// contornar o RLS owner-scoped de sessoes_anamnese.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const isAdmin = (await lookupUser(user.email ?? '').catch(() => null))?.isAdmin ?? false
  if (!isAdmin) return NextResponse.json({ error: 'Acesso restrito a formadores.' }, { status: 403 })

  const service = await createServiceClient()
  const { data, error } = await service
    .from('sessoes_anamnese')
    .select('id, user_id, avatar_id, score_final, relatorio, estado, modo, duracao_minutos, created_at, profiles(nome_completo, email)')
    .eq('estado', 'concluida')
    .order('created_at', { ascending: false })

  if (error) {
    if (isMissingAnamneseTable(error)) return NextResponse.json({ sessoes: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ sessoes: data ?? [] })
}
