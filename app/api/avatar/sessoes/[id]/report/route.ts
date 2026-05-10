import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getAvatar } from '@/lib/content/avatares'
import { lookupUser, debit } from '@/lib/aiCreditsClient'
import type { AvatarReport } from '@/lib/types'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Verify session ownership and state
  const { data: sessao, error: sessaoError } = await supabase
    .from('sessoes_avatar')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (sessaoError || !sessao) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
  if (sessao.estado !== 'concluida') {
    return NextResponse.json({ error: 'A sessão ainda não foi concluída.' }, { status: 400 })
  }

  // Idempotency: return cached report if already generated
  const notas = (sessao.notas_evolucao ?? {}) as Record<string, unknown>
  if (notas.report_generated && notas.avatar_report) {
    return NextResponse.json({ report: notas.avatar_report, score: notas.avatar_report_score ?? 0 })
  }

  // Fetch text messages (may be empty in voice-mode sessions)
  const { data: mensagens } = await supabase
    .from('mensagens')
    .select('papel, conteudo, ordem')
    .eq('sessao_avatar_id', id)
    .order('ordem', { ascending: true })

  const msgs = (mensagens ?? []).filter(m => m.papel !== 'system')

  // Voice-mode sessions store transcript in notas_evolucao.voice_transcript
  const voiceTranscript = Array.isArray(notas.voice_transcript)
    ? (notas.voice_transcript as string[])
    : null

  const hasTextTranscript = msgs.length >= 2
  const hasVoiceTranscript = voiceTranscript && voiceTranscript.length >= 2

  if (!hasTextTranscript && !hasVoiceTranscript) {
    return NextResponse.json({ error: 'Sessão demasiado curta para gerar relatório.' }, { status: 400 })
  }

  // Get avatar
  const avatar = getAvatar(sessao.avatar_slug)
  if (!avatar) return NextResponse.json({ error: 'Avatar não encontrado' }, { status: 404 })

  // Check LMS credits
  let lmsUserId: number | null = null
  let isAdmin = false
  try {
    const lmsUser = await lookupUser(user.email ?? '')
    if (lmsUser) {
      lmsUserId = lmsUser.userId
      isAdmin = lmsUser.isAdmin ?? false
      if (!isAdmin && !lmsUser.hasBalance) {
        return NextResponse.json({ error: 'Saldo de créditos insuficiente para gerar relatório.' }, { status: 402 })
      }
    }
  } catch (err) {
    console.error('[report] Credits check failed:', err)
    // Non-blocking: proceed if LMS API unavailable
  }

  // Build transcript for evaluation — prefer voice transcript if available
  const transcript = hasVoiceTranscript
    ? voiceTranscript!.join('\n\n')
    : msgs
        .map(m => `[${m.papel === 'user' ? 'Terapeuta' : avatar.nome}]: ${m.conteudo}`)
        .join('\n\n')

  const systemEval = `És um supervisor de formação especializado em interpretação de sonhos e terapia transpessoal. Avalias sessões de treino de forma construtiva, detalhada e honesta. Respondes sempre em JSON válido, sem blocos de código markdown.`

  const userEval = `Avalia a seguinte sessão de treino de interpretação de sonhos.

## Contexto do Avatar
- Nome: ${avatar.nome}, ${avatar.idade} anos — ${avatar.profissao}
- Competência treinada: ${avatar.competenciaTreinada}
- Ferida central (oculta): ${avatar.ficheiroSecreto.feridaCentral}
- Sonho base: ${avatar.sonhoBase}

## Transcrição da sessão
${transcript}

## Instrução
Gera um relatório detalhado em JSON com exactamente esta estrutura:
{
  "overallScore": <0-100>,
  "summary": "<2-4 frases resumindo o desempenho geral>",
  "abordagemSocratica": { "score": <0-100>, "feedback": "<observação específica>" },
  "escutaAtiva": { "score": <0-100>, "feedback": "<observação específica>" },
  "respeitoSimbologiaPessoal": { "score": <0-100>, "feedback": "<observação específica>" },
  "evitouInterpretacaoDirecta": { "score": <0-100>, "feedback": "<observação específica>" },
  "criouEspacoSeguro": { "score": <0-100>, "feedback": "<observação específica>" },
  "progressoComAvatar": { "score": <0-100>, "feedback": "<observação específica>" },
  "techniquesDetected": ["<técnica observada>"],
  "strengths": ["<ponto forte>"],
  "improvements": ["<área de melhoria>"],
  "criticalErrors": ["<erro crítico, se existir — lista vazia se não houver>"],
  "nextSteps": "<recomendação concreta para a próxima sessão>"
}

Critérios de avaliação:
- abordagemSocratica: Usou perguntas abertas, devolveu perguntas ao acompanhado, evitou directividade?
- escutaAtiva: Espelhou, parafraseou, acolheu o que foi dito antes de avançar?
- respeitoSimbologiaPessoal: Preservou a simbologia do sonho tal como o acompanhado a vive, sem impor leituras externas?
- evitouInterpretacaoDirecta: Resistiu ao impulso de explicar o sonho, deixou o acompanhado construir o sentido?
- criouEspacoSeguro: O acompanhado sentiu-se seguro para aprofundar? Houve contenção emocional?
- progressoComAvatar: Conseguiu aceder à experiência emocional do avatar, para além da narrativa superficial?

Responde APENAS com o JSON, sem texto adicional.`

  // Call Claude
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  let reportRaw: string
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemEval,
      messages: [{ role: 'user', content: userEval }],
    })
    reportRaw = response.content.find(b => b.type === 'text')?.text ?? ''
  } catch (err) {
    console.error('[report] Claude API error:', err)
    return NextResponse.json({ error: 'Erro ao gerar relatório. Tenta daqui a pouco.' }, { status: 503 })
  }

  // Parse JSON (strip markdown code blocks if present)
  let report: AvatarReport
  try {
    const cleaned = reportRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    report = JSON.parse(cleaned) as AvatarReport
  } catch (err) {
    console.error('[report] JSON parse error:', err, 'Raw:', reportRaw.slice(0, 500))
    return NextResponse.json({ error: 'Erro ao processar relatório. Tenta daqui a pouco.' }, { status: 500 })
  }

  // Persist to notas_evolucao
  const notasUpdate = {
    ...notas,
    report_generated: true,
    report_generated_at: new Date().toISOString(),
    avatar_report: report,
    avatar_report_score: report.overallScore,
  }

  const { error: updateError } = await supabase
    .from('sessoes_avatar')
    .update({ notas_evolucao: notasUpdate })
    .eq('id', id)
    .eq('user_id', user.id)

  if (updateError) {
    console.error('[report] Failed to persist report:', updateError)
    // Return the report anyway even if persistence failed
  }

  // Debit credits (non-blocking, skip for admin)
  // Report generation always uses claude_message (1 unit per 10 msg turns, min 1)
  if (lmsUserId && !isAdmin) {
    const units = Math.max(1, Math.ceil(msgs.length / 10))
    debit(lmsUserId, 'claude_message', units, `Relatório sessão avatar ${avatar.nome} (${id.slice(0, 8)})`).catch(err => {
      console.error('[report] Credit debit failed:', err)
    })
  }

  return NextResponse.json({ report, score: report.overallScore })
}
