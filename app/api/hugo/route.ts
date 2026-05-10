import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { lookupUser, debit } from '@/lib/aiCreditsClient'

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
})

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { message, history = [] } = parsed.data

  const lmsUser = await lookupUser(user.email!).catch(() => null)

  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: 'user', content: message },
  ]

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
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
