import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { SUPERVISOR_SYSTEM_PROMPT } from '@/lib/anthropic/supervisor-prompt'
import { z } from 'zod'

const StreamSchema = z.object({
  sessao_id: z.string().uuid(),
  mensagem: z.string().min(1).max(20000),
})

const FLAG_MAP: Array<{ keywords: string[]; flag: string }> = [
  { keywords: ['interpretação prematura', 'interpretacao prematura'], flag: 'interpretacao_prematura' },
  { keywords: ['heroísmo terapêutico', 'heroismo terapeutico'], flag: 'heroismo_terapeutico' },
  { keywords: ['projecção', 'projeccao', 'projeção'], flag: 'projeccao_terapeuta' },
  { keywords: ['aterragem'], flag: 'ausencia_aterragem' },
  { keywords: ['única lente', 'unica lente'], flag: 'lente_unica' },
]

function detectFlags(text: string): string[] {
  const lower = text.toLowerCase()
  const found: string[] = []
  for (const { keywords, flag } of FLAG_MAP) {
    if (keywords.some(k => lower.includes(k))) found.push(flag)
  }
  return found
}

function buildAnthropicMessages(
  sessao: { sonho_texto: string; caso_descricao: string | null },
  historico: Array<{ papel: string; conteudo: string }>,
  novaMensagem: string,
): Anthropic.MessageParam[] {
  const msgs: Anthropic.MessageParam[] = []

  // Synthetic context pair — not saved to DB, always injected as anchor
  const contexto = `**Sonho do acompanhado:**\n${sessao.sonho_texto}${sessao.caso_descricao ? `\n\n**Notas de caso:**\n${sessao.caso_descricao}` : ''}`
  msgs.push({ role: 'user', content: contexto })
  msgs.push({
    role: 'assistant',
    content: 'Recebi o caso. Partilha a tua análise inicial e de que forma pensas trabalhar este sonho com o teu acompanhado.',
  })

  for (const m of historico) {
    if (m.papel === 'user' || m.papel === 'assistant') {
      msgs.push({ role: m.papel as 'user' | 'assistant', content: m.conteudo })
    }
  }

  msgs.push({ role: 'user', content: novaMensagem })
  return msgs
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const parsed = StreamSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { sessao_id, mensagem } = parsed.data

  // Verify session ownership
  const { data: sessao } = await supabase
    .from('sessoes_supervisor')
    .select('id, sonho_texto, caso_descricao, flags_detectados')
    .eq('id', sessao_id)
    .eq('user_id', user.id)
    .single()

  if (!sessao) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })

  // Load history before saving new message
  const { data: historicoRaw } = await supabase
    .from('mensagens')
    .select('papel, conteudo, ordem')
    .eq('sessao_supervisor_id', sessao_id)
    .order('ordem', { ascending: true })

  const historico = historicoRaw ?? []
  const ordemUser = historico.length + 1
  const ordemAssistente = historico.length + 2

  // Save user message before streaming
  await supabase.from('mensagens').insert({
    sessao_supervisor_id: sessao_id,
    papel: 'user',
    conteudo: mensagem,
    metadata: {},
    ordem: ordemUser,
  })

  const anthropicMessages = buildAnthropicMessages(sessao, historico, mensagem)

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const anthropicStream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SUPERVISOR_SYSTEM_PROMPT,
    messages: anthropicMessages,
  })

  let fullText = ''

  const responseStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        for await (const event of anthropicStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            fullText += event.delta.text
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`))
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()

        // Persist assistant message
        const flags = detectFlags(fullText)
        await supabase.from('mensagens').insert({
          sessao_supervisor_id: sessao_id,
          papel: 'assistant',
          conteudo: fullText,
          metadata: { flags_detectados: flags },
          ordem: ordemAssistente,
        })

        if (flags.length > 0) {
          const existingFlags: string[] = sessao.flags_detectados ?? []
          await supabase
            .from('sessoes_supervisor')
            .update({ flags_detectados: [...new Set([...existingFlags, ...flags])] })
            .eq('id', sessao_id)
        }
      } catch (err) {
        console.error('[Supervisor stream error]', err)
        const msg = err instanceof Error ? err.message : 'Erro desconhecido'
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: `Não foi possível comunicar com o Supervisor. ${msg}` })}\n\n`)
        )
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
