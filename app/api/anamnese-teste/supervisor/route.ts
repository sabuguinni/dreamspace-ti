import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enforceVocabulary } from '@/lib/anthropic/vocabulary-filter'
import { getAnamneseAvatar } from '@/lib/anamnese/narrativas'
import { analisarTurno } from '@/lib/anamnese/supervisor'
import type { TurnoConversa, IntervencaoResult } from '@/lib/anamnese/types'
import { z } from 'zod'

/**
 * PROTÓTIPO (rota de teste) — Supervisor da Anamnese alimentado pela transcrição
 * do Gemini Live (modo avatar bidirecional), SEM sessão de BD.
 *
 * Reutiliza EXACTAMENTE a detecção corrigida (analisarTurno + prompts): avalia a
 * PERGUNTA do terapeuta contra a mensagem ANTERIOR do avatar. NÃO persiste nada.
 * NÃO toca em /api/anamnese/supervisor (esse continua a servir o fluxo real).
 *
 * Os nós latentes vivem aqui (server-side, via getAnamneseAvatar → analisarTurno),
 * NUNCA no cliente nem no prompt do Gemini.
 */

const TurnoSchema = z.object({
  turno: z.number().int(),
  terapeuta: z.string(),
  avatar: z.string(),
})

const Schema = z.object({
  avatar_id: z.string().min(1).max(40),
  historico: z.array(TurnoSchema).max(200),
  mensagemAnteriorAvatar: z.string(),
  perguntaTerapeuta: z.string().min(1).max(4000),
})

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const parsed = Schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { avatar_id, historico, mensagemAnteriorAvatar, perguntaTerapeuta } = parsed.data
  const avatar = getAnamneseAvatar(avatar_id)
  if (!avatar) return NextResponse.json({ error: 'Avatar não encontrado' }, { status: 404 })

  console.log('[supervisor-teste] pergunta:', perguntaTerapeuta)
  console.log('[supervisor-teste] msg anterior avatar:', mensagemAnteriorAvatar)

  const contexto: TurnoConversa[] = historico.map(t => ({
    turno: t.turno,
    timestamp: '',
    terapeuta: t.terapeuta,
    avatar: t.avatar,
    supervisor_interveio: false,
  }))

  let intervencao: IntervencaoResult = { intervir: false }
  try {
    intervencao = await analisarTurno({ avatar, historico: contexto, mensagemAnteriorAvatar, perguntaTerapeuta })
  } catch (err) {
    console.error('[anamnese-teste/supervisor] error:', err)
    return NextResponse.json({ intervencao: { intervir: false } })
  }

  console.log('[supervisor-teste] veredicto:', JSON.stringify(intervencao))

  const intervencaoTexto = intervencao.intervir && intervencao.intervencao
    ? enforceVocabulary(intervencao.intervencao).texto
    : undefined

  return NextResponse.json({
    intervencao: {
      intervir: intervencao.intervir,
      tipo_erro: intervencao.intervir ? intervencao.tipo_erro : undefined,
      intervencao: intervencaoTexto,
    },
  })
}
