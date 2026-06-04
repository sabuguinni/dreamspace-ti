import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { lookupUser, debit } from '@/lib/aiCreditsClient'
import { extractFlagMarkers } from '@/lib/supervisor/flags'
import { z } from 'zod'

// ─── Validation ───────────────────────────────────────────────────────────────

const BodySchema = z.object({
  text: z.string().min(1).max(8000),
  sessionId: z.string().uuid(),
  history: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })
  ).max(40).optional(),
})

// ─── Constants ────────────────────────────────────────────────────────────────

const ELEVENLABS_VOICE_ID = 's2b9rbop9AvXmC75lfYk'

/**
 * Voice-optimised supervisor system prompt.
 * No markdown, no lists — output must be natural spoken Portuguese.
 */
function buildSystemPrompt(sonho: string, metodo: string): string {
  return `És o Supervisor de IA do DreamSpace TI, plataforma de formação de terapeutas transpessoais.

O teu papel é supervisionar terapeutas de bem-estar em formação que trabalham com sonhos. Usas o método socrático.

CONTEXTO DA SESSÃO:
Sonho em análise: ${sonho || '(não especificado)'}
Método escolhido pelo terapeuta: ${metodo || '(não especificado)'}

REGRAS ABSOLUTAS:
1. NUNCA interpretas o sonho directamente — apenas fazes perguntas que guiam a descoberta do terapeuta
2. NUNCA usas linguagem clínica: usa "acompanhado" (não "paciente"), "avaliação" (não "diagnóstico"), "dificuldade" (não "sintoma"), "processo" (não "tratamento")
3. Respondes sempre em português de Portugal, sem gerúndios, sem brasileirismos
4. Tom: calmo, acolhedor mas firme, curioso, sem julgamento
5. Cada resposta: máximo 2 a 3 frases curtas mais uma pergunta clara e aberta
6. MODO VOZ OBRIGATÓRIO: fala de forma natural e fluida, sem markdown, sem asteriscos, sem listas, sem pontos, sem numeração — só frases naturais que soam bem em voz alta

Quando o terapeuta partilha uma análise de sonho:
Acolhe brevemente o que foi dito. Pergunta sobre elementos do sonho não explorados. Questiona o método terapêutico escolhido e porque esse em vez de outro. Pede a ligação entre o sonho e a vida concreta do acompanhado. Nunca resolves nem interpretas — apenas abres novas perspectivas através de perguntas.

Se o terapeuta pedir directamente uma interpretação do sonho: recusas com gentileza e devolves a pergunta a ele.

DETECÇÃO DE ERROS (OCULTA — nunca falada):
Se identificares um destes erros do terapeuta, acrescenta no FIM da tua resposta um marcador oculto por cada erro, exactamente nesta forma: [[FLAG:código]]. Estes marcadores são removidos automaticamente antes de seres ouvido — NUNCA os leias em voz alta nem os menciones. Códigos válidos:
[[FLAG:interpretacao_prematura]] — saltou para o significado do sonho cedo demais
[[FLAG:heroismo_terapeutico]] — tenta resolver o sonho em vez de ficar com ele
[[FLAG:projeccao_terapeuta]] — a leitura diz mais sobre o terapeuta do que sobre o acompanhado
[[FLAG:ausencia_aterragem]] — termina em insight sem ponte para a vida concreta
[[FLAG:lente_unica]] — aplica sempre o mesmo método ou lente
Se não houver erro, não acrescentes marcador nenhum.`
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { text, sessionId, history } = parsed.data

  // Load session for context + verify ownership
  const { data: sessao } = await supabase
    .from('sessoes_supervisor')
    .select('sonho_texto, metodo_escolhido, flags_detectados')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!sessao) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })

  // Check LMS credits
  let lmsUserId: number | null = null
  let isAdminUser = false
  try {
    const lmsUser = await lookupUser(user.email ?? '')
    if (lmsUser) {
      lmsUserId = lmsUser.userId
      isAdminUser = lmsUser.isAdmin ?? false
      if (!isAdminUser && !lmsUser.hasBalance) {
        return NextResponse.json({ error: 'Saldo de créditos insuficiente.' }, { status: 402 })
      }
    }
  } catch (err) {
    console.error('[voice-turn] Credits check failed:', err)
    // Non-blocking — proceed if LMS unavailable
  }

  const systemPrompt = buildSystemPrompt(sessao.sonho_texto ?? '', sessao.metodo_escolhido ?? '')

  // Build Claude message history
  const messages: Anthropic.MessageParam[] = [
    ...(history ?? []).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: text },
  ]

  // ── Claude (non-streaming) ─────────────────────────────────────────────────
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  let claudeText: string
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,      // short — voice responses must be concise
      system: systemPrompt,
      messages,
    })
    claudeText = response.content.find(b => b.type === 'text')?.text ?? ''
    if (!claudeText) throw new Error('Resposta vazia do modelo')
  } catch (err) {
    console.error('[voice-turn] Claude error:', err)
    return NextResponse.json({ error: 'Erro ao gerar resposta. Tenta daqui a pouco.' }, { status: 503 })
  }

  // Extrai marcadores [[FLAG:código]] ocultos — o texto limpo é o que se fala/mostra/persiste.
  const { flags, clean: cleanText } = extractFlagMarkers(claudeText)

  // ── ElevenLabs TTS ─────────────────────────────────────────────────────────
  const elevenKey = process.env.ELEVENLABS_API_KEY ?? ''
  let audioBase64: string
  try {
    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': elevenKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    )
    if (!ttsRes.ok) {
      const errText = await ttsRes.text().catch(() => '')
      throw new Error(`ElevenLabs ${ttsRes.status}: ${errText.slice(0, 200)}`)
    }
    const buf = await ttsRes.arrayBuffer()
    audioBase64 = Buffer.from(buf).toString('base64')
  } catch (err) {
    console.error('[voice-turn] ElevenLabs error:', err)
    return NextResponse.json({ error: 'Erro ao sintetizar voz. Tenta daqui a pouco.' }, { status: 503 })
  }

  // ── Persistir o turno (terapeuta + supervisor) em mensagens, com flags ─────────
  // Espelha o caminho de texto: cada turno fica em `mensagens` ao vivo, com
  // metadata.flags_detectados no turno do supervisor (ocorrência-a-ocorrência → CAP=2).
  // Best-effort: o áudio já foi gerado; se a persistência falhar, devolvemos na mesma.
  try {
    const { data: maxRow } = await supabase
      .from('mensagens')
      .select('ordem')
      .eq('sessao_supervisor_id', sessionId)
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle()
    const baseOrdem = maxRow?.ordem ?? 0

    await supabase.from('mensagens').insert([
      { sessao_supervisor_id: sessionId, papel: 'user', conteudo: text, metadata: { source: 'voice' }, ordem: baseOrdem + 1 },
      { sessao_supervisor_id: sessionId, papel: 'assistant', conteudo: cleanText, metadata: { source: 'voice', flags_detectados: flags }, ordem: baseOrdem + 2 },
    ])

    if (flags.length > 0) {
      const existingFlags: string[] = sessao.flags_detectados ?? []
      await supabase
        .from('sessoes_supervisor')
        .update({ flags_detectados: [...new Set([...existingFlags, ...flags])] })
        .eq('id', sessionId)
    }
  } catch (persistErr) {
    console.error('[voice-turn] Falha ao persistir turno de voz:', persistErr)
  }

  // ── Debit credits (non-blocking) ───────────────────────────────────────────
  if (lmsUserId && !isAdminUser) {
    debit(lmsUserId, 'claude_supervisor', 1, `Supervisor voz turno sessão ${sessionId.slice(0, 8)}`).catch(err => {
      console.error('[voice-turn] Credit debit failed:', err)
    })
  }

  return NextResponse.json({ text: cleanText, audio: audioBase64 })
}
