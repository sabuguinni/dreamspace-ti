import OpenAI from 'openai'

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY não configurada — voz indisponível')
  return new OpenAI({ apiKey: key })
}

/** Estima duração em minutos com base no nº de palavras (150 palavras/min). */
export function estimateMinutes(text: string): number {
  const words = text.trim().split(/\s+/).length
  return Math.max(0.05, words / 150)
}

/** Sintetiza texto para áudio MP3 via OpenAI TTS. Máx 4096 chars. */
export async function synthesize(text: string): Promise<Buffer> {
  const client = getClient()
  const input = text.slice(0, 4096)
  const response = await client.audio.speech.create({
    model: 'tts-1',
    voice: 'nova',
    input,
    response_format: 'mp3',
  })
  return Buffer.from(await response.arrayBuffer())
}
