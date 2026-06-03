import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { lookupUser, debit } from '@/lib/aiCreditsClient'
import type { SessaoAnamnese, TurnoConversa } from '@/lib/anamnese/types'
import { z } from 'zod'

const Schema = z.object({
  sessao_id: z.string().uuid(),
  terapeuta: z.string().min(1).max(8000),
  avatar: z.string().min(1).max(8000),
  // Duração de voz deste turno (relógio: início da fala do terapeuta → fim da resposta).
  // Soma ao longo da sessão ≈ minutos de conversa; débito gemini_live proporcional.
  duracao_segundos: z.number().min(0).max(3600).optional(),
})

/**
 * POST /api/anamnese/voz-registo — grava UM turno do modo Voz (Gemini Live).
 *
 * Persist-only: no modo Voz a Carolina é o GEMINI (não há Claude aqui — o texto vem
 * da transcrição do Gemini, enviada pelo cliente). Faz append de um TurnoConversa a
 * historico_conversa na MESMA forma do modo texto (/api/anamnese/turno), para que o
 * relatório e o score (que lêem historico_conversa) funcionem exactamente igual.
 *
 * Débito: gemini_live pelos minutos de voz deste turno (admin isento). A análise do
 * Supervisor corre depois, em /api/anamnese/supervisor (Claude + voz ElevenLabs) —
 * é lá que entram os débitos claude_message + voice_tts.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const parsed = Schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { sessao_id, terapeuta, avatar, duracao_segundos } = parsed.data

  const { data: sessaoRaw, error } = await supabase
    .from('sessoes_anamnese')
    .select('*')
    .eq('id', sessao_id)
    .eq('user_id', user.id)
    .single()
  if (error || !sessaoRaw) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })

  const sessao = sessaoRaw as SessaoAnamnese
  if (sessao.estado === 'concluida') return NextResponse.json({ error: 'Sessão já concluída' }, { status: 400 })

  const historico: TurnoConversa[] = Array.isArray(sessao.historico_conversa) ? sessao.historico_conversa : []
  const proximoTurno = historico.reduce((max, t) => Math.max(max, t.turno), 0) + 1
  const novoTurno: TurnoConversa = {
    turno: proximoTurno,
    timestamp: new Date().toISOString(),
    terapeuta,
    avatar,
    supervisor_interveio: false, // preenchido por /api/anamnese/supervisor se intervier
  }

  const { error: updErr } = await supabase
    .from('sessoes_anamnese')
    .update({ historico_conversa: [...historico, novoTurno] })
    .eq('id', sessao_id)
    .eq('user_id', user.id)
  if (updErr) {
    console.error('[anamnese/voz-registo] update error:', updErr)
    return NextResponse.json({ error: 'Erro ao guardar o turno.' }, { status: 500 })
  }

  // Débito gemini_live — minutos de voz deste turno (não-bloqueante, admin isento).
  const minutos = (duracao_segundos ?? 0) / 60
  if (minutos > 0) {
    lookupUser(user.email ?? '')
      .then(lmsUser => {
        if (lmsUser && !lmsUser.isAdmin) {
          return debit(lmsUser.userId, 'gemini_live', minutos, `Anamnese voz (turno ${proximoTurno})`)
        }
      })
      .catch(err => console.warn('[anamnese/voz-registo] debit failed:', err?.message))
  }

  return NextResponse.json({ turno: proximoTurno })
}
