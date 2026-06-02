/**
 * Síntese TTS via modelo Gemini (verbatim, voz prebuilt por personagem).
 * Server-only — usa GEMINI_API_KEY. Devolve um WAV (PCM L16 embrulhado).
 */

const GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts'

function pcmToWav(pcm: Buffer, sampleRate: number, channels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8
  const blockAlign = (channels * bitsPerSample) / 8
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

interface GeminiPart {
  inlineData?: { data?: string; mimeType?: string }
}

/** Sintetiza `text` para WAV com a voz Gemini `voice`. Devolve null em falha. */
export async function synthesizeGeminiWav(text: string, voice: string): Promise<Buffer | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || !text.trim()) return null
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
      console.error('[geminiTts]', res.status, (await res.text().catch(() => '')).slice(0, 200))
      return null
    }
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: GeminiPart[] } }> }
    const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data)
    const b64 = part?.inlineData?.data
    if (!b64) return null
    const rateMatch = (part?.inlineData?.mimeType ?? '').match(/rate=(\d+)/)
    const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000
    return pcmToWav(Buffer.from(b64, 'base64'), sampleRate)
  } catch (err) {
    console.error('[geminiTts] error:', (err as Error)?.message)
    return null
  }
}
