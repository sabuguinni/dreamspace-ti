import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enforceVocabulary } from '@/lib/anthropic/vocabulary-filter'
import { lookupUser, debit } from '@/lib/aiCreditsClient'
import { estimateMinutes } from '@/lib/ttsService'
import { getAnamneseAvatar } from '@/lib/anamnese/narrativas'
import { getAnamneseAvatarPublico } from '@/lib/anamnese/avataresPublicos'
import { buildAvatarSystemPrompt, AVATAR_ABERTURA_TRIGGER } from '@/lib/anamnese/prompts'
import { synthesizeGeminiWav } from '@/lib/anamnese/geminiTts'
import type { SessaoAnamnese, TurnoConversa } from '@/lib/anamnese/types'
import { z } from 'zod'

/**
 * Pipeline de voz em streaming para a Anamnese (modo voz).
 *
 * Claude STREAM (cérebro do avatar) → deteção de frase completa → TTS Gemini por
 * frase (verbatim, voz por personagem) → chunks de áudio (SSE) para o cliente,
 * que toca à medida que chegam. Primeira-frase = primeiro áudio o mais cedo possível.
 *
 * NÃO mexe em /api/anamnese/turno (texto), narrativas, nós latentes nem analisarTurno.
 * A análise do Supervisor corre em paralelo via /api/anamnese/supervisor (chamada pelo cliente).
 */

const Schema = z.object({
  sessao_id: z.string().uuid(),
  mensagem: z.string().min(1).max(8000),
})

function buildAvatarMessages(historico: TurnoConversa[], novaMensagem: string): Anthropic.MessageParam[] {
  const msgs: Anthropic.MessageParam[] = []
  msgs.push({ role: 'user', content: AVATAR_ABERTURA_TRIGGER })
  const ordenado = [...historico].sort((a, b) => a.turno - b.turno)
  for (const t of ordenado) {
    if (t.turno === 0) {
      if (t.avatar) msgs.push({ role: 'assistant', content: t.avatar })
      continue
    }
    if (t.terapeuta) msgs.push({ role: 'user', content: t.terapeuta })
    if (t.avatar) msgs.push({ role: 'assistant', content: t.avatar })
  }
  msgs.push({ role: 'user', content: novaMensagem })
  return msgs
}

/** Extrai frases completas (terminadas em . ! ? …) do buffer; devolve o resto incompleto. */
function extractSentences(buffer: string): { sentences: string[]; rest: string } {
  const sentences: string[] = []
  let rest = buffer
  const re = /^([\s\S]*?[.!?…]+)(\s+)([\s\S]*)$/
  let m: RegExpMatchArray | null
  while ((m = rest.match(re)) !== null) {
    const s = m[1].trim()
    rest = m[3]
    if (s) sentences.push(s)
  }
  return { sentences, rest }
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { sessao_id, mensagem } = parsed.data

  const { data: sessaoRaw, error: sessaoErr } = await supabase
    .from('sessoes_anamnese')
    .select('*')
    .eq('id', sessao_id)
    .eq('user_id', user.id)
    .single()

  if (sessaoErr || !sessaoRaw) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })

  const sessao = sessaoRaw as SessaoAnamnese
  if (sessao.estado === 'concluida') return NextResponse.json({ error: 'Sessão já concluída' }, { status: 400 })

  const avatar = getAnamneseAvatar(sessao.avatar_id)
  if (!avatar) return NextResponse.json({ error: 'Avatar não encontrado' }, { status: 404 })

  const voice = getAnamneseAvatarPublico(avatar.id)?.voz ?? 'Kore'
  const historico: TurnoConversa[] = Array.isArray(sessao.historico_conversa) ? sessao.historico_conversa : []

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

      let fullText = ''
      let buffer = ''
      try {
        const claudeStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 600,
          // Prompt caching do system prompt do avatar (estático por sessão) → TTFT mais baixo nos turnos seguintes
          system: [{ type: 'text', text: buildAvatarSystemPrompt(avatar), cache_control: { type: 'ephemeral' } }],
          messages: buildAvatarMessages(historico, mensagem),
        })

        for await (const event of claudeStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const delta = event.delta.text
            fullText += delta
            buffer += delta
            send({ type: 'text', delta })
            const { sentences, rest } = extractSentences(buffer)
            buffer = rest
            for (const s of sentences) {
              const wav = await synthesizeGeminiWav(s, voice)
              if (wav) send({ type: 'audio', audio: wav.toString('base64') })
            }
          }
        }

        // Sintetiza a última frase parcial (se houver)
        const tail = buffer.trim()
        if (tail) {
          const wav = await synthesizeGeminiWav(tail, voice)
          if (wav) send({ type: 'audio', audio: wav.toString('base64') })
        }

        const cleanText = enforceVocabulary(fullText).texto

        // Persiste o turno do avatar (supervisor corre depois, em /api/anamnese/supervisor)
        const proximoTurno = historico.reduce((max, t) => Math.max(max, t.turno), 0) + 1
        const novoTurno: TurnoConversa = {
          turno: proximoTurno,
          timestamp: new Date().toISOString(),
          terapeuta: mensagem,
          avatar: cleanText,
          supervisor_interveio: false,
        }
        const { error: updErr } = await supabase
          .from('sessoes_anamnese')
          .update({ historico_conversa: [...historico, novoTurno] })
          .eq('id', sessao_id)
          .eq('user_id', user.id)
        if (updErr) console.error('[anamnese/voz-turno] update error:', updErr)

        send({ type: 'turno', turno: proximoTurno, avatar: cleanText })
        send({ type: 'done' })
        controller.close()

        // Débito (não-bloqueante, admin isento): mesmo modelo que antes —
        // claude_message 1 (turno) + voice_tts × estimateMinutes (fala do cliente)
        lookupUser(user.email ?? '')
          .then(lmsUser => {
            if (lmsUser && !lmsUser.isAdmin) {
              debit(lmsUser.userId, 'claude_message', 1, `Anamnese voz ${avatar.nome} (turno ${proximoTurno})`).catch(() => {})
              debit(lmsUser.userId, 'voice_tts', estimateMinutes(cleanText), `Anamnese voz cliente (${voice})`).catch(() => {})
            }
          })
          .catch(() => {})
      } catch (err) {
        console.error('[anamnese/voz-turno] stream error:', err)
        try { send({ type: 'error', error: 'Não foi possível obter resposta. Tenta daqui a pouco.' }) } catch {}
        try { controller.close() } catch {}
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
