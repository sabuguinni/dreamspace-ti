import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { lookupUser, debit } from '@/lib/aiCreditsClient'
import { getAnamneseAvatar } from '@/lib/anamnese/narrativas'
import { gerarNotaPedagogica } from '@/lib/anamnese/supervisor'
import { calcularScore, construirRelatorio } from '@/lib/anamnese/score'
import type { SessaoAnamnese, TurnoConversa } from '@/lib/anamnese/types'
import { z } from 'zod'

const RelatorioSchema = z.object({
  sessao_id: z.string().uuid(),
  duracao_minutos: z.number().int().min(1).max(240).optional(),
})

// POST /api/anamnese/relatorio — conclui a sessão e gera o relatório final (idempotente)
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const parsed = RelatorioSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { sessao_id, duracao_minutos } = parsed.data

  const { data: sessaoRaw, error } = await supabase
    .from('sessoes_anamnese')
    .select('*')
    .eq('id', sessao_id)
    .eq('user_id', user.id)
    .single()

  if (error || !sessaoRaw) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })

  const sessao = sessaoRaw as SessaoAnamnese

  // Idempotência: se já tem relatório, devolve-o
  if (sessao.relatorio) {
    return NextResponse.json({ relatorio: sessao.relatorio, score: sessao.score_final ?? sessao.relatorio.score })
  }

  const avatar = getAnamneseAvatar(sessao.avatar_id)
  if (!avatar) return NextResponse.json({ error: 'Avatar não encontrado' }, { status: 404 })

  const historico: TurnoConversa[] = Array.isArray(sessao.historico_conversa) ? sessao.historico_conversa : []
  const historicoReal = historico.filter(t => t.turno > 0)

  if (historicoReal.length === 0) {
    return NextResponse.json({ error: 'Sessão demasiado curta para gerar relatório.' }, { status: 400 })
  }

  const score = calcularScore(historicoReal)

  // Nota pedagógica via IA (best-effort — o relatório funciona sem ela)
  const nota = await gerarNotaPedagogica({ avatar, historico: historicoReal, score }).catch(() => null)

  const relatorio = construirRelatorio({
    avatarNome: `${avatar.nome} · ${avatar.idade} anos`,
    historico: historicoReal,
    duracaoMinutos: duracao_minutos ?? sessao.duracao_minutos ?? 30,
    data: new Date().toISOString(),
    nota,
  })

  const { error: updateErr } = await supabase
    .from('sessoes_anamnese')
    .update({
      estado: 'concluida',
      score_final: score,
      relatorio,
      duracao_minutos: duracao_minutos ?? sessao.duracao_minutos ?? 30,
    })
    .eq('id', sessao_id)
    .eq('user_id', user.id)

  if (updateErr) console.error('[anamnese/relatorio] persist error:', updateErr)

  // Débito (não-bloqueante, admin isento)
  lookupUser(user.email ?? '')
    .then(lmsUser => {
      if (lmsUser && !lmsUser.isAdmin) {
        return debit(lmsUser.userId, 'claude_message', 1, `Relatório anamnese ${avatar.nome} (${sessao_id.slice(0, 8)})`)
      }
    })
    .catch(err => console.warn('[anamnese/relatorio] debit failed:', err?.message))

  return NextResponse.json({ relatorio, score })
}
