import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { lookupUser, debit } from '@/lib/aiCreditsClient'
import { estimateMinutes } from '@/lib/ttsService'
import { z } from 'zod'

/**
 * TTS do CLIENTE de anamnese — voz Gemini por personagem (verbatim).
 *
 * Lê à letra o texto gerado pelo Claude (NÃO gera resposta própria, ao contrário
 * do gemini:speak do Retiro). Usa o modelo de TTS dedicado do Gemini via REST.
 * A GEMINI_API_KEY fica server-side. Débito: voice_tts × estimateMinutes —
 * exatamente como /api/tts (voz do Supervisor/Hugo).
 */

const VOICES = ['Kore', 'Aoede', 'Charon', 'Puck', 'Fenrir', 'Leda'] as const

const Schema = z.object({
  text: z.string().min(1).max(4096),
  voice: z.enum(VOICES).default('Kore'),
})

const CENTS_PER_MINUTE = 6 // alinhado com /api/tts
const GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts'

interface GeminiPart {
  inlineData?: { data?: string; mimeType?: string }
  text?: string
}
interface GeminiResp {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>
}

/** Embrulha PCM (L16, mono) num contentor WAV reproduzível por <audio>. */
function pcmToWav(pcm: Buffer, sampleRate: number, channels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8
  const blockAlign = (channels * bitsPerSample) / 8
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
  const { text, voice } = parsed.data

  const lmsUser = await lookupUser(user.email!).catch(() => null)
  if (!lmsUser) return NextResponse.json({ error: 'Conta LMS não encontrada', code: 'NO_LMS_ACCOUNT' }, { status: 404 })

  const minutes = estimateMinutes(text)
  const costCents = Math.max(1, Math.ceil(minutes * CENTS_PER_MINUTE))

  // Admin tem bypass (o LMS trata internamente)
  if (!lmsUser.isAdmin && lmsUser.balanceCents < costCents) {
    return NextResponse.json(
      { error: 'Saldo insuficiente para usar voz', code: 'INSUFFICIENT_BALANCE', costCents, balanceCents: lmsUser.balanceCents },
      { status: 402 },
    )
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Serviço de voz não configurado', code: 'TTS_NOT_CONFIGURED' }, { status: 503 })

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        }),
      },
    )

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[anamnese/tts] Gemini TTS', res.status, errText.slice(0, 300))
      return NextResponse.json({ error: 'Erro ao sintetizar voz', code: 'TTS_UPSTREAM' }, { status: 503 })
    }

    const data = (await res.json()) as GeminiResp
    const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data)
    const b64 = part?.inlineData?.data
    if (!b64) {
      console.error('[anamnese/tts] resposta sem áudio:', JSON.stringify(data).slice(0, 300))
      return NextResponse.json({ error: 'Sem áudio gerado', code: 'TTS_NO_AUDIO' }, { status: 503 })
    }

    const rateMatch = (part?.inlineData?.mimeType ?? '').match(/rate=(\d+)/)
    const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000
    const wav = pcmToWav(Buffer.from(b64, 'base64'), sampleRate)

    // Débito voice_tts × minutos (não-bloqueante, admin isento no LMS) — igual a /api/tts
    debit(lmsUser.userId, 'voice_tts', minutes, `Anamnese voz cliente (${voice})`).catch(err =>
      console.error('[anamnese/tts] debit failed:', err.message),
    )

    return new Response(new Uint8Array(wav), {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(wav.length),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    console.error('[anamnese/tts] error:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro ao sintetizar voz' }, { status: 500 })
  }
}
