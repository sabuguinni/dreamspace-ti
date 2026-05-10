import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { lookupUser } from '@/lib/aiCreditsClient'

/** GET /api/credits — saldo do utilizador autenticado */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const lmsUser = await lookupUser(user.email!).catch(() => null)
  if (!lmsUser) {
    return NextResponse.json({ balanceCents: 0, hasBalance: false, noAccount: true })
  }
  return NextResponse.json({
    balanceCents: lmsUser.balanceCents,
    hasBalance: lmsUser.hasBalance,
    userId: lmsUser.userId,
  })
}
