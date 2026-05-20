import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { lookupUser, debit } from '@/lib/aiCreditsClient'
import { estimateMinutes } from '@/lib/ttsService'

const HUGO_SYSTEM_PROMPT = `És o Hugo, assistente virtual da plataforma Dreamspace TI.
O teu único papel é ajudar os utilizadores a navegar e usar a plataforma.

Conheces em detalhe:
- Dashboard: saudação diária, citação, próximo passo sugerido
- Manual: 9 módulos com casos práticos sobre interpretação de sonhos
- Supervisor: chat IA socrático para trabalhar casos de sonhos em profundidade
- Avatares: 4 personagens de treino com ficheiro psicológico revelado no fim
- Diário: registo pessoal de sonhos, ligado directamente ao Supervisor

Regras absolutas:
1. NUNCA respondes sobre o conteúdo dos cursos, teorias de sonhos, ou matérias académicas
2. NUNCA respondes sobre temas fora da plataforma (notícias, outros assuntos, etc.)
3. Se te perguntarem algo fora do teu âmbito, dizes: "Para isso, usa o Supervisor ou o Manual — eu só te ajudo a navegar a plataforma."
4. Respondes sempre em português de Portugal
5. Tom: amigável, directo, encorajador — como um guia de boas-vindas
6. Respostas curtas e directas — máximo 3 frases

Quando não souberes algo específico sobre a plataforma, diz que não sabes e sugere contactar suporte.`

const Schema = z.object({
  message: z.string().min(1).max(5000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).max(20).optional(),
  voice: z.boolean().optional(),
})

const ELEVENLABS_VOICE_ID = 's2b9rbop9AvXmC75lfYk'
const CENTS_PER_MINUTE = 6

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { message, history = [], voice } = parsed.data

  const lmsUser = await lookupUser(user.email!).catch(() => null)

  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: 'user', content: message },
  ]

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // ── Voice mode: Claude streaming → first sentence → ElevenLabs pipeline ──
  if (voice) {
    // Guard: check TTS balance before synthesis
    if (lmsUser && !lmsUser.isAdmin) {
      const estimatedMinutes = estimateMinutes(message)
      const costCents = Math.max(1, Math.ceil(estimatedMinutes * CENTS_PER_MINUTE))
      if (lmsUser.balanceCents < costCents) {
        return NextResponse.json(
          { error: 'Saldo insuficiente para usar voz', code: 'INSUFFICIENT_BALANCE' },
          { status: 402 }
        )
      }
    }

    const elevenKey = process.env.ELEVENLABS_API_KEY ?? ''
    if (!elevenKey) {
      return NextResponse.json(
        { error: 'Serviço de voz não configurado', code: 'TTS_NOT_CONFIGURED' },
        { status: 503 }
      )
    }

    // Stream Claude — detect first complete sentence for early ElevenLabs start
    let fullText = ''
    let firstSentence = ''
    let firstSentenceResolveFunc!: (s: string) => void
    const firstSentenceReady = new Promise<string>(resolve => { firstSentenceResolveFunc = resolve })

    const claudeStream = anthropic.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: HUGO_SYSTEM_PROMPT,
      messages,
    })

    // Background: collect Claude tokens, resolve promise on first sentence
    const claudeTask = (async () => {
      try {
        for await (const event of claudeStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            fullText += event.delta.text
            // After 15 chars, check for sentence boundary (.!? followed by space)
            if (!firstSentence && fullText.length > 15) {
              const m = fullText.match(/^(.+?[.!?])\s/)
              if (m) { firstSentence = m[1]; firstSentenceResolveFunc(firstSentence) }
            }
          }
        }
      } catch (err) {
        // Resolve with whatever we have so the caller can unblock
        firstSentenceResolveFunc(fullText || '')
        throw err
      }
      // No sentence break found — resolve with full text
      if (!firstSentence) { firstSentence = fullText; firstSentenceResolveFunc(fullText) }
    })()

    // Wait for first sentence (~200-400ms, vs ~800-1500ms for full Claude response)
    const ttsText = await firstSentenceReady

    if (!ttsText) {
      await claudeTask.catch(() => {})
      return NextResponse.json({ error: 'Erro ao gerar resposta. Tenta daqui a pouco.' }, { status: 503 })
    }

    // Fire ElevenLabs fetch with first sentence — concurrent with remaining Claude tokens
    const elevenVoiceSettings = { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true }
    const elevenResFetch = fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`,
      {
        method: 'POST',
        headers: { 'xi-api-key': elevenKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ttsText, model_id: 'eleven_multilingual_v2', voice_settings: elevenVoiceSettings }),
      }
    )

    // Wait for Claude to finish (concurrent with ElevenLabs generating audio)
    await claudeTask.catch(err => console.error('[Hugo voice] Claude stream error:', err))

    if (!fullText) {
      return NextResponse.json({ error: 'Erro ao gerar resposta. Tenta daqui a pouco.' }, { status: 503 })
    }

    // Await ElevenLabs response (likely ready — was fetched in parallel with Claude tail)
    let elevenRes: Response
    try {
      elevenRes = await elevenResFetch
      if (!elevenRes.ok) {
        const errText = await elevenRes.text().catch(() => '')
        throw new Error(`ElevenLabs ${elevenRes.status}: ${errText.slice(0, 200)}`)
      }
    } catch (err) {
      console.error('[Hugo voice] ElevenLabs error:', err)
      return NextResponse.json({ error: 'Erro ao sintetizar voz. Tenta daqui a pouco.' }, { status: 503 })
    }

    // Debit: claude_message + voice_tts for full text (non-blocking)
    if (lmsUser) {
      debit(lmsUser.userId, 'claude_message', 1, 'Hugo guia voz').catch(err =>
        console.warn('[Hugo voice] debit claude_message failed:', err.message)
      )
      const minutes = estimateMinutes(fullText)
      debit(lmsUser.userId, 'voice_tts', minutes, 'TTS Hugo voz').catch(err =>
        console.warn('[Hugo voice] debit voice_tts failed:', err.message)
      )
    }

    // Build audio stream: Phase 1 (first sentence, pre-fetched) + Phase 2 (remaining sentences)
    const remaining = fullText.slice(ttsText.length).trim()
    const capturedElevenRes = elevenRes

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Phase 1: stream first sentence audio (ElevenLabs has been generating since ~ttsText detection)
          const reader1 = capturedElevenRes.body!.getReader()
          for (;;) {
            const { done, value } = await reader1.read()
            if (done) break
            controller.enqueue(value)
          }

          // Phase 2: remaining sentences (if any) — Claude is already done at this point
          if (remaining) {
            const elevenRes2 = await fetch(
              `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`,
              {
                method: 'POST',
                headers: { 'xi-api-key': elevenKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: remaining, model_id: 'eleven_multilingual_v2', voice_settings: elevenVoiceSettings }),
              }
            )
            if (elevenRes2.ok) {
              const reader2 = elevenRes2.body!.getReader()
              for (;;) {
                const { done, value } = await reader2.read()
                if (done) break
                controller.enqueue(value)
              }
            }
          }
        } catch (err) {
          console.error('[Hugo voice] audio stream error:', err)
        } finally {
          controller.close()
        }
      },
    })

    // X-Hugo-Text is now complete (claudeTask finished before we built the Response)
    return new Response(readable, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'X-Hugo-Text': encodeURIComponent(fullText),
        'Access-Control-Expose-Headers': 'X-Hugo-Text',
      },
    })
  }

  // ── Text mode: SSE stream ─────────────────────────────────────────────────
  const stream = anthropic.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: HUGO_SYSTEM_PROMPT,
    messages,
  })

  let fullText = ''

  const responseStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            fullText += event.delta.text
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`))
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()

        if (lmsUser) {
          debit(lmsUser.userId, 'claude_message', 1, 'Hugo guia').catch(err =>
            console.warn('[Hugo] debit failed:', err.message)
          )
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
        controller.close()
      }
    },
  })

  return new Response(responseStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
