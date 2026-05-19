import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { lookupUser, debit } from '@/lib/aiCreditsClient'
import { z } from 'zod'

const PatchSchema = z.object({
  estado: z.enum(['em_curso', 'concluida', 'arquivada']).optional(),
  voice_transcript: z.array(z.string()).optional(),
  voice_duration_minutes: z.number().int().min(1).max(240).optional(),
})

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: sessao, error } = await supabase
    .from('sessoes_avatar')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !sessao) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })

  const { data: mensagens } = await supabase
    .from('mensagens')
    .select('*')
    .eq('sessao_avatar_id', id)
    .order('ordem', { ascending: true })

  return NextResponse.json({ sessao, mensagens: mensagens ?? [] })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { estado, voice_transcript, voice_duration_minutes } = parsed.data

  // Fetch existing session for notas_evolucao merge
  const { data: existing } = await supabase
    .from('sessoes_avatar')
    .select('notas_evolucao')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  const notas = ((existing?.notas_evolucao ?? {}) as Record<string, unknown>)
  const notasUpdate: Record<string, unknown> = { ...notas }

  if (voice_transcript && voice_transcript.length > 0) {
    notasUpdate.voice_transcript = voice_transcript
  }
  if (voice_duration_minutes) {
    notasUpdate.voice_duration_minutes = voice_duration_minutes
  }

  const update: Record<string, unknown> = {}
  if (estado) {
    update.estado = estado
    if (estado === 'concluida') update.ficheiro_revelado = true
  }
  update.notas_evolucao = notasUpdate

  const { data, error } = await supabase
    .from('sessoes_avatar')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error || !data) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })

  // Debit gemini_live credits on conclude (non-blocking)
  if (estado === 'concluida' && voice_duration_minutes) {
    debitVoiceCredits(user.email ?? '', voice_duration_minutes, id).catch(err => {
      console.error('[avatar/sessoes] Credit debit failed:', err)
    })
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { error } = await supabase
    .from('sessoes_avatar')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'Erro ao apagar sessão' }, { status: 500 })
  return NextResponse.json({ success: true })
}

async function debitVoiceCredits(email: string, minutes: number, sessaoId: string) {
  if (!email) return
  try {
    const lmsUser = await lookupUser(email)
    if (!lmsUser || lmsUser.isAdmin) return
    await debit(
      lmsUser.userId,
      'gemini_live',
      minutes,
      `Sessão de voz avatar ${sessaoId.slice(0, 8)} (${minutes} min)`
    )
  } catch (err: unknown) {
    // Non-critical — log but don't block the conclude response
    console.error('[avatar/sessoes] debitVoiceCredits error:', (err as Error).message)
  }
}
