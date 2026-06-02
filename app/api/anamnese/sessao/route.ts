import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { enforceVocabulary } from '@/lib/anthropic/vocabulary-filter'
import { lookupUser } from '@/lib/aiCreditsClient'
import { getAnamneseAvatar } from '@/lib/anamnese/narrativas'
import { getAnamneseAvatarPublico } from '@/lib/anamnese/avataresPublicos'
import { enforcePtPt } from '@/lib/anamnese/ptpt'
import { buildAvatarSystemPrompt, AVATAR_ABERTURA_TRIGGER } from '@/lib/anamnese/prompts'
import { ANAMNESE_DESBLOQUEIO_MINIMO, type TurnoConversa } from '@/lib/anamnese/types'
import { isMissingAnamneseTable } from '@/lib/anamnese/serverUtils'
import { z } from 'zod'

const CreateSchema = z.object({
  avatar_id: z.string().min(1).max(40),
  modo: z.enum(['escrito', 'voz']).default('escrito'),
})

// GET /api/anamnese/sessao — lista as sessões de anamnese do utilizador
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('sessoes_anamnese')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    if (isMissingAnamneseTable(error)) return NextResponse.json({ sessoes: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ sessoes: data ?? [] })
}

// POST /api/anamnese/sessao — cria sessão (verifica desbloqueio) + mensagem de abertura
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const avatar = getAnamneseAvatar(parsed.data.avatar_id)
  if (!avatar) return NextResponse.json({ error: 'Avatar não encontrado' }, { status: 404 })

  // ── Pré-requisito de desbloqueio: 10 sessões de Supervisor de Sonhos concluídas ──
  const isAdmin = (await lookupUser(user.email ?? '').catch(() => null))?.isAdmin ?? false

  const { count: concluidas } = await supabase
    .from('sessoes_supervisor')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('estado', 'concluida')

  if (!isAdmin && (concluidas ?? 0) < ANAMNESE_DESBLOQUEIO_MINIMO) {
    return NextResponse.json(
      {
        error: 'Funcionalidade bloqueada.',
        sessoesConcluidas: concluidas ?? 0,
        necessarias: ANAMNESE_DESBLOQUEIO_MINIMO,
      },
      { status: 403 },
    )
  }

  // ── Gera a abertura do avatar (turno 0) ──────────────────────────────────────
  const feminino = getAnamneseAvatarPublico(avatar.id)?.genero === 'f'
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  let openingText = ''
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: buildAvatarSystemPrompt(avatar),
      messages: [{ role: 'user', content: AVATAR_ABERTURA_TRIGGER }],
    })
    openingText = enforcePtPt(enforceVocabulary(
      response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join(''),
    ).texto, { feminino })
  } catch (err) {
    console.error('[anamnese/sessao] opening error:', err)
    openingText = `Olá. Sou a ${avatar.nome}. Não sei bem por onde começar, mas vim cá para tentar perceber algumas coisas.`
  }

  const aberturaTurno: TurnoConversa = {
    turno: 0,
    timestamp: new Date().toISOString(),
    terapeuta: '',
    avatar: openingText,
    supervisor_interveio: false,
  }

  const { data: sessao, error } = await supabase
    .from('sessoes_anamnese')
    .insert({
      user_id: user.id,
      avatar_id: avatar.id,
      historico_conversa: [aberturaTurno],
      intervencoes_supervisor: [],
      estado: 'em_curso',
      modo: parsed.data.modo,
    })
    .select()
    .single()

  if (error || !sessao) {
    if (isMissingAnamneseTable(error)) {
      return NextResponse.json(
        { error: 'A funcionalidade de Anamnese ainda está a ser activada. Tenta novamente em breve.' },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: error?.message ?? 'Erro ao criar sessão' }, { status: 500 })
  }

  return NextResponse.json({ sessao }, { status: 201 })
}
