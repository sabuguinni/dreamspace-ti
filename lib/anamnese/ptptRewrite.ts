/**
 * 2º passe PT-PT: reescreve o texto do avatar em português europeu via LLM rápido (Haiku).
 * Apanha o que a lista de substituição (enforcePtPt) não apanha — conjugações, vocabulário
 * e sintaxe brasileira. Server-only. Em caso de falha devolve o texto recebido (fallback),
 * que já passou por enforceVocabulary + enforcePtPt.
 */

import Anthropic from '@anthropic-ai/sdk'

const REWRITE_MODEL = 'claude-haiku-4-5-20251001'

const SYSTEM_PROMPT =
  'Reescreve este texto em português europeu de Portugal. Corrige qualquer brasileirismo ' +
  '(conjugações, vocabulário, sintaxe). Mantém o sentido e o tom exactos. Devolve APENAS o ' +
  'texto corrigido, sem comentários.'

/** Reescreve `text` em PT-PT. Devolve o original se vazio ou em caso de erro. */
export async function rewritePtPt(text: string): Promise<string> {
  const t = text.trim()
  if (!t) return text
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const resp = await anthropic.messages.create({
      model: REWRITE_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: t }],
    })
    const out = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim()
    return out || text
  } catch (err) {
    console.error('[ptptRewrite] error:', (err as Error)?.message)
    return text
  }
}
