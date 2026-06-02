import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { lookupUser } from '@/lib/aiCreditsClient'
import { ANAMNESE_DESBLOQUEIO_MINIMO } from '@/lib/anamnese/types'

// GET /api/anamnese/estado — estado de desbloqueio da funcionalidade
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { count } = await supabase
    .from('sessoes_supervisor')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('estado', 'concluida')

  const sessoesConcluidas = count ?? 0

  // Admins (formadores) têm a funcionalidade sempre desbloqueada para testar
  const isAdmin = (await lookupUser(user.email ?? '').catch(() => null))?.isAdmin ?? false

  return NextResponse.json({
    desbloqueada: isAdmin || sessoesConcluidas >= ANAMNESE_DESBLOQUEIO_MINIMO,
    sessoesConcluidas,
    necessarias: ANAMNESE_DESBLOQUEIO_MINIMO,
  })
}
