import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enforceVocabulary } from '@/lib/anthropic/vocabulary-filter'
import { getAnamneseAvatar } from '@/lib/anamnese/narrativas'
import { analisarTurno } from '@/lib/anamnese/supervisor'
import type { SessaoAnamnese, TurnoConversa, IntervencaoResult } from '@/lib/anamnese/types'
import { z } from 'zod'

const Schema = z.object({
  sessao_id: z.string().uuid(),
  turno: z.number().int().min(1),
})

/**
 * POST /api/anamnese/supervisor — análise do Supervisor para um turno já criado.
 *
 * Corre em PARALELO com a fala do cliente (não bloqueia a resposta do avatar).
 * Usa exactamente a mesma deteção (analisarTurno, mesmos inputs) que antes —
 * apenas muda QUANDO corre. Persiste a intervenção no turno para o relatório/score.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { sessao_id, turno } = parsed.data

  const { data: sessaoRaw, error } = await supabase
    .from('sessoes_anamnese')
    .select('*')
    .eq('id', sessao_id)
    .eq('user_id', user.id)
    .single()

  if (error || !sessaoRaw) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })

  const sessao = sessaoRaw as SessaoAnamnese
  const avatar = getAnamneseAvatar(sessao.avatar_id)
  if (!avatar) return NextResponse.json({ error: 'Avatar não encontrado' }, { status: 404 })

  const historico: TurnoConversa[] = Array.isArray(sessao.historico_conversa) ? sessao.historico_conversa : []
  const alvo = historico.find(t => t.turno === turno)
  if (!alvo || !alvo.terapeuta) {
    return NextResponse.json({ intervencao: { intervir: false } })
  }

  // Avaliamos a PERGUNTA do terapeuta como resposta à mensagem ANTERIOR do avatar
  // (a abertura/turno 0, ou o turno-1) — NUNCA a resposta posterior (alvo.avatar).
  // Contexto = todos os turnos ATÉ ao anterior, incluindo a abertura (turno 0).
  const contexto = historico.filter(t => t.turno < turno).sort((a, b) => a.turno - b.turno)
  const mensagemAnteriorAvatar = historico.find(t => t.turno === turno - 1)?.avatar ?? ''
  let intervencao: IntervencaoResult = { intervir: false }
  try {
    intervencao = await analisarTurno({
      avatar,
      historico: contexto,
      mensagemAnteriorAvatar,
      perguntaTerapeuta: alvo.terapeuta,
    })
  } catch (err) {
    console.error('[anamnese/supervisor] error:', err)
    return NextResponse.json({ intervencao: { intervir: false } })
  }

  const intervencaoTexto = intervencao.intervir && intervencao.intervencao
    ? enforceVocabulary(intervencao.intervencao).texto
    : undefined

  // Persistir a intervenção no turno (para relatório/score e reloads)
  if (intervencao.intervir) {
    const novoHistorico = historico.map(t =>
      t.turno === turno
        ? { ...t, supervisor_interveio: true, tipo_erro: intervencao.tipo_erro, intervencao_supervisor: intervencaoTexto }
        : t,
    )
    const { error: updErr } = await supabase
      .from('sessoes_anamnese')
      .update({ historico_conversa: novoHistorico })
      .eq('id', sessao_id)
      .eq('user_id', user.id)
    if (updErr) console.error('[anamnese/supervisor] persist error:', updErr)
  }

  return NextResponse.json({
    intervencao: {
      intervir: intervencao.intervir,
      tipo_erro: intervencao.intervir ? intervencao.tipo_erro : undefined,
      intervencao: intervencaoTexto,
    },
  })
}
