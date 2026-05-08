import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getAvatar } from '@/lib/content/avatares'
import { enforceVocabulary } from '@/lib/anthropic/vocabulary-filter'
import { z } from 'zod'

const StreamSchema = z.object({
  sessao_id: z.string().uuid(),
  mensagem: z.string().min(1).max(20000),
})

const ABERTURA_TRIGGER =
  'Inicia a sessão. Apresenta-te brevemente e descreve o sonho que tiveste de forma natural, como se estivesses a contar a alguém pela primeira vez.'

function buildAvatarMessages(
  historico: Array<{ papel: string; conteudo: string }>,
  novaMensagem: string,
): Anthropic.MessageParam[] {
  const msgs: Anthropic.MessageParam[] = []

  // Prepend the synthetic opening trigger so the conversation starts with 'user'
  msgs.push({ role: 'user', content: ABERTURA_TRIGGER })

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

  const { data: sessao } = await supabase
    .from('sessoes_avatar')
    .select('id, avatar_slug, estado')
    .eq('id', sessao_id)
    .eq('user_id', user.id)
    .single()

  if (!sessao) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
  if (sessao.estado === 'concluida') {
    return NextResponse.json({ error: 'Sessão já concluída' }, { status: 400 })
  }

  const avatar = getAvatar(sessao.avatar_slug)
  if (!avatar) return NextResponse.json({ error: 'Avatar não encontrado' }, { status: 404 })

  const { data: historicoRaw } = await supabase
    .from('mensagens')
    .select('papel, conteudo, ordem')
    .eq('sessao_avatar_id', sessao_id)
    .order('ordem', { ascending: true })

  const historico = historicoRaw ?? []
  const ordemUser = historico.length + 1
  const ordemAssistente = historico.length + 2

  await supabase.from('mensagens').insert({
    sessao_avatar_id: sessao_id,
    papel: 'user',
    conteudo: mensagem,
    metadata: {},
    ordem: ordemUser,
  })

  const anthropicMessages = buildAvatarMessages(historico, mensagem)
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const anthropicStream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: avatar.systemPrompt,
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

        // Persist with vocabulary enforcement before saving to DB
        const { texto: cleanText, log: vocabLog } = enforceVocabulary(fullText)

        if (vocabLog.length > 0) {
          console.warn('[avatar/vocab] substituições aplicadas', {
            sessao_id,
            avatar_slug: sessao.avatar_slug,
            substituicoes: vocabLog,
            total: vocabLog.reduce((a, s) => a + s.count, 0),
          })
        }

        await supabase.from('mensagens').insert({
          sessao_avatar_id: sessao_id,
          papel: 'assistant',
          conteudo: cleanText,
          metadata: { vocab_substituicoes: vocabLog.length > 0 ? vocabLog : undefined },
          ordem: ordemAssistente,
        })
      } catch (err) {
        console.error('[Avatar stream error]', err)
        const msg = err instanceof Error ? err.message : 'Erro desconhecido'
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
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
