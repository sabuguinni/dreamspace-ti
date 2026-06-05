import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { construirRelatorioSonho, type TurnoFlaggedSonho } from '@/lib/supervisor/score'
import { gerarNotaPedagogicaSonho, type TranscriptTurn } from '@/lib/supervisor/nota'
import { isFlagSonho, type MetodoTerapeutico, type SupervisorReport, type SupervisorReportV2 } from '@/lib/types'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>
type SessaoCtx = { sonho_texto: string | null; metodo_escolhido: string | null }
type Body = { transcriptLines?: string[] }
type MensagemRow = { papel: string; conteudo: string; metadata: Record<string, unknown> | null; ordem: number }

// ─── v1 evaluator (6 dimensões) ────────────────────────────────────────────────
// MORTO: mantido como fallback até o Passo 5 (frontend) validar o modelo v2.
// O caminho primário é o v2 (determinístico). Remover na limpeza do Passo 5.

const EVALUATOR_SYSTEM_PROMPT = `És um avaliador especialista em supervisão de terapeutas transpessoais que trabalham com sonhos.
Vais analisar uma transcrição de sessão de supervisão e avaliar o desempenho do terapeuta em 6 dimensões.

RESPONDE EXCLUSIVAMENTE COM JSON VÁLIDO. Sem markdown, sem texto antes ou depois, sem comentários.

Formato exacto obrigatório:
{
  "overallScore": 75,
  "summary": "Frase 1. Frase 2. Frase 3.",
  "metodoAplicado": { "score": 80, "feedback": "Frase concisa sobre aplicação do método." },
  "perguntasSocraticas": { "score": 70, "feedback": "Frase concisa sobre qualidade das perguntas." },
  "evitouInterpretacaoDirecta": { "score": 90, "feedback": "Frase concisa sobre evitar interpretações directas." },
  "exploracaoElementosSonho": { "score": 65, "feedback": "Frase concisa sobre exploração dos elementos do sonho." },
  "ligacaoVidaConcreta": { "score": 60, "feedback": "Frase concisa sobre ligação ao contexto de vida." },
  "linguagemTerapeutica": { "score": 85, "feedback": "Frase concisa sobre uso adequado da linguagem." },
  "pontosFortesObservados": ["Ponto forte 1", "Ponto forte 2", "Ponto forte 3"],
  "areasMelhoria": ["Área de melhoria 1", "Área de melhoria 2"],
  "proximosPassos": "Sugestão concreta para a próxima sessão."
}

REGRAS:
- Scores: inteiros de 0 a 100
- overallScore: média ponderada das 6 dimensões
- summary: 2-3 frases em português de Portugal, avaliação global equilibrada
- Cada feedback: 1-2 frases em português de Portugal
- pontosFortesObservados: 2-4 itens
- areasMelhoria: 2-3 itens
- proximosPassos: 1-2 frases com sugestão concreta e accionável
- NUNCA uses gerúndios (ex: "fazendo", "usando") — usa infinitivo ou pretérito
- NUNCA uses brasileirismos`

async function buildConversationText(supabase: SupabaseServer, id: string, body: Body): Promise<string> {
  if (body.transcriptLines && body.transcriptLines.length > 0) {
    return body.transcriptLines.join('\n')
  }
  const { data: mensagens } = await supabase
    .from('mensagens')
    .select('papel, conteudo')
    .eq('sessao_supervisor_id', id)
    .neq('papel', 'system')
    .order('ordem', { ascending: true })
  return (mensagens ?? [])
    .map((m: { papel: string; conteudo: string }) => `[${m.papel === 'user' ? 'Terapeuta' : 'Supervisor'}]: ${m.conteudo}`)
    .join('\n')
}

/** v1 (6 dimensões, LLM). Fallback — só corre se o caminho v2 falhar inesperadamente. */
async function generateReportV1(supabase: SupabaseServer, id: string, sessao: SessaoCtx, body: Body) {
  const conversationText = await buildConversationText(supabase, id, body)
  if (!conversationText.trim()) {
    return NextResponse.json({ error: 'Sessão sem conteúdo suficiente para avaliação.' }, { status: 422 })
  }

  const userPrompt = `SESSÃO DE SUPERVISÃO PARA AVALIAÇÃO:

Sonho em análise: ${sessao.sonho_texto ?? '(não especificado)'}
Método escolhido pelo terapeuta: ${sessao.metodo_escolhido ?? '(não especificado)'}

TRANSCRIÇÃO DA SESSÃO:
${conversationText}

Avalia o desempenho do terapeuta nesta sessão.`

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  let report: SupervisorReport
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      system: EVALUATOR_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })
    const text = response.content.find(b => b.type === 'text')?.text ?? ''
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    report = JSON.parse(cleaned) as SupervisorReport
  } catch (err) {
    console.error('[supervisor/report] v1 Claude/parse error:', err)
    return NextResponse.json({ error: 'Erro ao gerar relatório. Tenta daqui a pouco.' }, { status: 503 })
  }

  await persistReport(supabase, id, JSON.stringify(report), report.overallScore, 1)
  return NextResponse.json({ report })
}

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

  // Idempotency: devolve o relatório já gerado (v1 ou v2) tal-e-qual.
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

  // Caminho primário: v2 (determinístico). v1 fica como fallback se o v2 falhar inesperadamente.
  try {
    return await generateReportV2(supabase, id, sessao as SessaoCtx, body)
  } catch (err) {
    console.error('[supervisor/report] v2 falhou, fallback para v1:', err)
    return await generateReportV1(supabase, id, sessao as SessaoCtx, body)
  }
}
