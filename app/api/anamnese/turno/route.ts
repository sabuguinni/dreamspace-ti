import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { enforceVocabulary } from '@/lib/anthropic/vocabulary-filter'
import { lookupUser, debit } from '@/lib/aiCreditsClient'
import { getAnamneseAvatar } from '@/lib/anamnese/narrativas'
import { buildAvatarSystemPrompt, AVATAR_ABERTURA_TRIGGER } from '@/lib/anamnese/prompts'
import { analisarTurno } from '@/lib/anamnese/supervisor'
import type { SessaoAnamnese, TurnoConversa, IntervencaoResult } from '@/lib/anamnese/types'
import { z } from 'zod'

const TurnoSchema = z.object({
  sessao_id: z.string().uuid(),
  mensagem: z.string().min(1).max(8000),
})

/** Reconstrói as mensagens Anthropic a partir do histórico (alternância user/assistant). */
function buildAvatarMessages(historico: TurnoConversa[], novaMensagem: string): Anthropic.MessageParam[] {
  const msgs: Anthropic.MessageParam[] = []
  // O gatilho de abertura inicia sempre com 'user' para emparelhar com a abertura (assistant)
  msgs.push({ role: 'user', content: AVATAR_ABERTURA_TRIGGER })

  const ordenado = [...historico].sort((a, b) => a.turno - b.turno)
  for (const t of ordenado) {
    if (t.turno === 0) {
      // Abertura: só a resposta do avatar
      if (t.avatar) msgs.push({ role: 'assistant', content: t.avatar })
      continue
    }
    if (t.terapeuta) msgs.push({ role: 'user', content: t.terapeuta })
    if (t.avatar) msgs.push({ role: 'assistant', content: t.avatar })
  }

  msgs.push({ role: 'user', content: novaMensagem })
  return msgs
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const parsed = TurnoSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { sessao_id, mensagem } = parsed.data

  const { data: sessaoRaw, error: sessaoErr } = await supabase
    .from('sessoes_anamnese')
    .select('*')
    .eq('id', sessao_id)
    .eq('user_id', user.id)
    .single()

  if (sessaoErr || !sessaoRaw) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })

  const sessao = sessaoRaw as SessaoAnamnese
  if (sessao.estado === 'concluida') return NextResponse.json({ error: 'Sessão já concluída' }, { status: 400 })

  const avatar = getAnamneseAvatar(sessao.avatar_id)
  if (!avatar) return NextResponse.json({ error: 'Avatar não encontrado' }, { status: 404 })

  const historico: TurnoConversa[] = Array.isArray(sessao.historico_conversa) ? sessao.historico_conversa : []

  // ── 1. Resposta do avatar ────────────────────────────────────────────────────
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  let respostaAvatar = ''
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: buildAvatarSystemPrompt(avatar),
      messages: buildAvatarMessages(historico, mensagem),
    })
    respostaAvatar = enforceVocabulary(
      response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join(''),
    ).texto
  } catch (err) {
    console.error('[anamnese/turno] avatar error:', err)
    return NextResponse.json({ error: 'Não foi possível obter resposta do avatar. Tenta daqui a pouco.' }, { status: 503 })
  }

  // ── 2. Análise do Supervisor (turnos reais, sem a abertura) ───────────────────
  const historicoReal = historico.filter(t => t.turno > 0)
  let intervencao: IntervencaoResult = { intervir: false }
  try {
    intervencao = await analisarTurno({
      avatar,
      historico: historicoReal,
      ultimaMensagemTerapeuta: mensagem,
      respostaAvatar,
    })
  } catch (err) {
    console.error('[anamnese/turno] supervisor error:', err)
    // Falha do supervisor não bloqueia o turno — segue sem intervenção
  }

  const intervencaoTexto = intervencao.intervir && intervencao.intervencao
    ? enforceVocabulary(intervencao.intervencao).texto
    : undefined

  // ── 3. Persistir o novo turno ─────────────────────────────────────────────────
  const proximoTurno = historico.reduce((max, t) => Math.max(max, t.turno), 0) + 1
  const novoTurno: TurnoConversa = {
    turno: proximoTurno,
    timestamp: new Date().toISOString(),
    terapeuta: mensagem,
    avatar: respostaAvatar,
    supervisor_interveio: intervencao.intervir,
    tipo_erro: intervencao.intervir ? intervencao.tipo_erro : undefined,
    intervencao_supervisor: intervencaoTexto,
  }

  const novoHistorico = [...historico, novoTurno]

  const { error: updateErr } = await supabase
    .from('sessoes_anamnese')
    .update({ historico_conversa: novoHistorico })
    .eq('id', sessao_id)
    .eq('user_id', user.id)

  if (updateErr) {
    console.error('[anamnese/turno] update error:', updateErr)
    return NextResponse.json({ error: 'Erro ao guardar o turno.' }, { status: 500 })
  }

  // ── 4. Débito de créditos (não-bloqueante, admin isento) ──────────────────────
  lookupUser(user.email ?? '')
    .then(lmsUser => {
      if (lmsUser && !lmsUser.isAdmin) {
        return debit(lmsUser.userId, 'claude_message', 1, `Anamnese ${avatar.nome} (turno ${proximoTurno})`)
      }
    })
    .catch(err => console.warn('[anamnese/turno] debit failed:', err?.message))

  return NextResponse.json({
    turno: novoTurno,
    avatar: respostaAvatar,
    intervencao: {
      intervir: intervencao.intervir,
      tipo_erro: intervencao.intervir ? intervencao.tipo_erro : undefined,
      intervencao: intervencaoTexto,
    },
  })
}
