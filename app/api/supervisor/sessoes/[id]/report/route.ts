import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { construirRelatorioSonho, type TurnoFlaggedSonho } from '@/lib/supervisor/score'
import { gerarNotaPedagogicaSonho, type TranscriptTurn } from '@/lib/supervisor/nota'
import { isFlagSonho, type MetodoTerapeutico, type SupervisorReport, type SupervisorReportV2 } from '@/lib/types'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>
type SessaoCtx = { sonho_texto: string | null; metodo_escolhido: string | null }
type Body = { transcriptLines?: string[] }
type MensagemRow = { papel: string; conteudo: string; metadata: Record<string, unknown> | null; ordem: number }

// ─── v2: score determinístico (Rigor + Execução + tectos) + nota qualitativa ────

/** Lê a conversa da BD e extrai turnos, ocorrências de flags, momentos e transcrição. */
async function loadSessionData(supabase: SupabaseServer, id: string, body: Body) {
  const { data: msgData } = await supabase
    .from('mensagens')
    .select('papel, conteudo, metadata, ordem')
    .eq('sessao_supervisor_id', id)
    .neq('papel', 'system')
    .order('ordem', { ascending: true })
  const mensagens = (msgData ?? []) as MensagemRow[]

  let turnosReais = 0
  let lastUser = ''
  const occurrences: string[] = []
  const momentosBrutos: TurnoFlaggedSonho[] = []
  const transcript: TranscriptTurn[] = []

  for (const m of mensagens) {
    if (m.papel === 'user') {
      turnosReais++
      lastUser = m.conteudo
      transcript.push({ papel: 'user', conteudo: m.conteudo })
    } else if (m.papel === 'assistant') {
      transcript.push({ papel: 'assistant', conteudo: m.conteudo })
      const md = (m.metadata ?? {}) as Record<string, unknown>
      const fl = Array.isArray(md.flags_detectados)
        ? md.flags_detectados.filter((x): x is string => typeof x === 'string')
        : []
      for (const f of fl) {
        occurrences.push(f)
        if (isFlagSonho(f)) {
          momentosBrutos.push({ turno: turnosReais, mensagem_terapeuta: lastUser, flag: f, intervencao_supervisor: m.conteudo })
        }
      }
    }
  }

  // Fallback defensivo: BD sem mensagens (não devia acontecer pós-Passo 2) → usa transcriptLines inline.
  if (transcript.length === 0 && body.transcriptLines && body.transcriptLines.length > 0) {
    for (const line of body.transcriptLines) {
      const isUser = line.startsWith('[Terapeuta]:')
      const conteudo = line.replace(/^\[(Terapeuta|Supervisor)\]:\s*/, '')
      transcript.push({ papel: isUser ? 'user' : 'assistant', conteudo })
      if (isUser) { turnosReais++; lastUser = conteudo }
    }
    console.warn('[supervisor/report] BD sem mensagens; usei transcriptLines inline (sem flags → Rigor=100).')
  }

  return { turnosReais, occurrences, momentosBrutos, transcript }
}

async function generateReportV2(supabase: SupabaseServer, id: string, sessao: SessaoCtx, body: Body) {
  const { turnosReais, occurrences, momentosBrutos, transcript } = await loadSessionData(supabase, id, body)

  if (transcript.length === 0) {
    return NextResponse.json({ error: 'Sessão sem conteúdo suficiente para avaliação.' }, { status: 422 })
  }

  // Nota qualitativa (best-effort): se falhar → null → cobertura null → Execução só turnos.
  const nota = await gerarNotaPedagogicaSonho({
    sonhoTexto: sessao.sonho_texto ?? '',
    metodo: sessao.metodo_escolhido ?? '',
    transcript,
  }).catch(() => null)

  const report: SupervisorReportV2 = construirRelatorioSonho({
    metodo: (sessao.metodo_escolhido ?? 'nao_definido') as MetodoTerapeutico,
    sonhoResumo: (sessao.sonho_texto ?? '').slice(0, 280),
    occurrences,
    turnosReais,
    momentosBrutos,
    data: new Date().toISOString(),
    nota,
  })

  await persistReport(supabase, id, JSON.stringify(report), report.score, 2)
  return NextResponse.json({ report })
}

/** Persiste o relatório como mensagem de sistema + materializa o score na sessão. Não-bloqueante. */
async function persistReport(supabase: SupabaseServer, id: string, conteudo: string, score: number, version: 1 | 2) {
  try {
    const { data: maxRow } = await supabase
      .from('mensagens')
      .select('ordem')
      .eq('sessao_supervisor_id', id)
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle()
    const ordem = ((maxRow?.ordem as number | undefined) ?? 0) + 1

    await supabase.from('mensagens').insert({
      sessao_supervisor_id: id,
      papel: 'system',
      conteudo,
      metadata: { type: 'supervisor_report', score, version },
      ordem,
    })

    // Materializa o score na sessão — usado pelo gate de desbloqueio da Anamnese (score > 70).
    await supabase.from('sessoes_supervisor').update({ score }).eq('id', id)
  } catch (err) {
    console.error('[supervisor/report] Persist failed:', err)
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Load session — verify ownership
  const { data: sessao } = await supabase
    .from('sessoes_supervisor')
    .select('sonho_texto, metodo_escolhido')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!sessao) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })

  // Idempotency: devolve o relatório já gerado (v1 antigo ou v2) tal-e-qual.
  const { data: existingRows } = await supabase
    .from('mensagens')
    .select('conteudo')
    .eq('sessao_supervisor_id', id)
    .eq('papel', 'system')
    .contains('metadata', { type: 'supervisor_report' })
    .limit(1)

  if (existingRows && existingRows.length > 0) {
    try {
      const report = JSON.parse(existingRows[0].conteudo) as SupervisorReport | SupervisorReportV2
      return NextResponse.json({ report, cached: true })
    } catch {
      // Malformed JSON — fall through and regenerate
    }
  }

  let body: Body = {}
  try {
    body = await req.json()
  } catch { /* empty body is fine */ }

  return await generateReportV2(supabase, id, sessao as SessaoCtx, body)
}
