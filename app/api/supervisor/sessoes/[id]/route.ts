import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { lookupUser, debit } from '@/lib/aiCreditsClient'
import { z } from 'zod'

const PatchSchema = z.object({
  estado: z.enum(['em_curso', 'concluida', 'arquivada']).optional(),
  flags_detectados: z.array(z.string()).optional(),
  voice_transcript: z.array(z.string()).optional(),
  voice_duration_minutes: z.number().int().min(1).max(240).optional(),
})

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: sessao, error: sessaoErr } = await supabase
    .from('sessoes_supervisor')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (sessaoErr || !sessao) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })

  const { data: mensagens } = await supabase
    .from('mensagens')
    .select('*')
    .eq('sessao_supervisor_id', id)
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

  const { estado, flags_detectados, voice_transcript, voice_duration_minutes } = parsed.data

  // Build the update for sessoes_supervisor
  const update: Record<string, unknown> = {}
  if (estado) update.estado = estado
  if (flags_detectados) update.flags_detectados = flags_detectados

  const { data, error } = await supabase
    .from('sessoes_supervisor')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error || !data) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })

  // Persist voice transcript as mensagens (non-blocking, best-effort)
  if (voice_transcript && voice_transcript.length > 0) {
    persistVoiceTranscript(supabase, id, voice_transcript).catch(err => {
      console.error('[supervisor/sessoes PATCH] Failed to persist voice transcript:', err)
    })
  }

  // Debit gemini_live credits on conclude (non-blocking)
  if (estado === 'concluida' && voice_duration_minutes) {
    debitVoiceCredits(user.email ?? '', voice_duration_minutes, id).catch(err => {
      console.error('[supervisor/sessoes PATCH] Credit debit failed:', err)
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
    .from('sessoes_supervisor')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'Erro ao apagar sessão' }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function persistVoiceTranscript(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  sessaoId: string,
  lines: string[],
): Promise<void> {
  // Get current max ordem to avoid conflicts with any existing messages
  const { data: existing } = await supabase
    .from('mensagens')
    .select('ordem')
    .eq('sessao_supervisor_id', sessaoId)
    .order('ordem', { ascending: false })
    .limit(1)

  let ordem = (existing?.[0]?.ordem ?? 0) + 1

  const rows = lines.map(line => {
    const isUser = line.startsWith('[Terapeuta]:')
    const conteudo = line.replace(/^\[(Terapeuta|Supervisor)\]:\s*/, '')
    return {
      sessao_supervisor_id: sessaoId,
      papel: isUser ? 'user' : 'assistant',
      conteudo,
      metadata: { source: 'voice' },
      ordem: ordem++,
    }
  })

  if (rows.length > 0) {
    const { error } = await supabase.from('mensagens').insert(rows)
    if (error) throw error
  }
}

async function debitVoiceCredits(email: string, minutes: number, sessaoId: string): Promise<void> {
  if (!email) return
  try {
    const lmsUser = await lookupUser(email)
    if (!lmsUser || lmsUser.isAdmin) return
    await debit(
      lmsUser.userId,
      'gemini_live',
      minutes,
      `Supervisor voz sessão ${sessaoId.slice(0, 8)} (${minutes} min)`
    )
  } catch (err: unknown) {
    console.error('[supervisor/sessoes] debitVoiceCredits error:', (err as Error).message)
  }
}
