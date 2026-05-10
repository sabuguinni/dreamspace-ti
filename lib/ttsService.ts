/**
 * TTS Service — DreamSpace TI
 *
 * Primary:  ElevenLabs cloned Hugo voice (s2b9rbop9AvXmC75lfYk)
 * Fallback: OpenAI TTS "nova" (used if ELEVENLABS_API_KEY absent)
 *
 * Both return audio/mpeg as a Buffer.
 */

import OpenAI from 'openai'

const ELEVENLABS_VOICE_ID = 's2b9rbop9AvXmC75lfYk'

/** Estima duração em minutos com base no nº de palavras (150 palavras/min). */
export function estimateMinutes(text: string): number {
  const words = text.trim().split(/\s+/).length
  return Math.max(0.05, words / 150)
}

/** Sintetiza texto para MP3 usando ElevenLabs (Hugo clone). */
async function synthesizeElevenLabs(text: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY não configurada')

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: text.slice(0, 4096),
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
    }
  )

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`ElevenLabs TTS ${res.status}: ${errText.slice(0, 200)}`)
  }

  return Buffer.from(await res.arrayBuffer())
}

/** Sintetiza texto para MP3 usando OpenAI TTS (fallback). */
async function synthesizeOpenAI(text: string): Promise<Buffer> {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('TTS_NOT_CONFIGURED: nem ELEVENLABS_API_KEY nem OPENAI_API_KEY disponível')

  const client = new OpenAI({ apiKey: key })
  const response = await client.audio.speech.create({
    model: 'tts-1',
    voice: 'nova',
    input: text.slice(0, 4096),
    response_format: 'mp3',
  })
  return Buffer.from(await response.arrayBuffer())
}

/**
 * Sintetiza texto para áudio MP3.
 * Tenta ElevenLabs (voz Hugo); cai para OpenAI se ELEVENLABS_API_KEY ausente.
 */
export async function synthesize(text: string): Promise<Buffer> {
  if (process.env.ELEVENLABS_API_KEY) {
    return synthesizeElevenLabs(text)
  }

  // Fallback — OpenAI TTS
  console.warn('[TTS] ELEVENLABS_API_KEY ausente — a usar OpenAI TTS como fallback')
  return synthesizeOpenAI(text)
}
