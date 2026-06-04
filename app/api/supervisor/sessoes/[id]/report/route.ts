import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import type { SupervisorReport } from '@/lib/types'

// ─── Evaluator prompt ─────────────────────────────────────────────────────────

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

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Load session — verify ownership
  const { data: sessao } = await supabase
    .from('sessoes_supervisor')
    .select('sonho_texto, metodo_escolhido, estado')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!sessao) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })

  // Idempotency: check if a report already exists for this session
  const { data: existingRows } = await supabase
    .from('mensagens')
    .select('conteudo')
    .eq('sessao_supervisor_id', id)
    .eq('papel', 'system')
    .contains('metadata', { type: 'supervisor_report' })
    .limit(1)

  if (existingRows && existingRows.length > 0) {
    try {
      const report = JSON.parse(existingRows[0].conteudo) as SupervisorReport
      return NextResponse.json({ report, cached: true })
    } catch {
      // Malformed JSON — fall through and regenerate
    }
  }

  // Optional: client can pass voice transcript lines directly (avoids race condition
  // where persistVoiceTranscript hasn't finished writing to DB yet).
  let conversationText: string

  let body: { transcriptLines?: string[] } = {}
  try {
    body = await req.json()
  } catch { /* empty body is fine */ }

  if (body.transcriptLines && body.transcriptLines.length > 0) {
    conversationText = body.transcriptLines.join('\n')
  } else {
    // Load from DB
    const { data: mensagens } = await supabase
      .from('mensagens')
      .select('papel, conteudo')
      .eq('sessao_supervisor_id', id)
      .neq('papel', 'system')
      .order('ordem', { ascending: true })

    conversationText = (mensagens ?? [])
      .map(m => `[${m.papel === 'user' ? 'Terapeuta' : 'Supervisor'}]: ${m.conteudo}`)
      .join('\n')
  }

  if (!conversationText.trim()) {
    return NextResponse.json({ error: 'Sessão sem conteúdo suficiente para avaliação.' }, { status: 422 })
  }

  // Build evaluation prompt
  const userPrompt = `SESSÃO DE SUPERVISÃO PARA AVALIAÇÃO:

Sonho em análise: ${sessao.sonho_texto ?? '(não especificado)'}
Método escolhido pelo terapeuta: ${sessao.metodo_escolhido ?? '(não especificado)'}

TRANSCRIÇÃO DA SESSÃO:
${conversationText}

Avalia o desempenho do terapeuta nesta sessão.`

  // ── Claude evaluation ──────────────────────────────────────────────────────
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
    // Strip any accidental markdown code fences
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    report = JSON.parse(cleaned) as SupervisorReport
  } catch (err) {
    console.error('[supervisor/report] Claude/parse error:', err)
    return NextResponse.json({ error: 'Erro ao gerar relatório. Tenta daqui a pouco.' }, { status: 503 })
  }

  // ── Persist report as system message in mensagens ─────────────────────────
  try {
    // Get max ordem to append after conversation
    const { data: maxRow } = await supabase
      .from('mensagens')
      .select('ordem')
      .eq('sessao_supervisor_id', id)
      .order('ordem', { ascending: false })
      .limit(1)
      .single()

    const ordem = (maxRow?.ordem ?? 0) + 1

    await supabase.from('mensagens').insert({
      sessao_supervisor_id: id,
      papel: 'system',
      conteudo: JSON.stringify(report),
      metadata: {
        type: 'supervisor_report',
        score: report.overallScore,
      },
      ordem,
    })

    // Materializa o score na sessão — usado pelo gate de desbloqueio da Anamnese (score > 70).
    await supabase
      .from('sessoes_supervisor')
      .update({ score: report.overallScore })
      .eq('id', id)
  } catch (err) {
    // Non-blocking — return report even if persist fails
    console.error('[supervisor/report] Persist failed:', err)
  }

  return NextResponse.json({ report })
}
