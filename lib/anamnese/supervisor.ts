/**
 * Lógica server-side do Supervisor de Anamnese (chamadas Claude + parsing JSON).
 * Importado apenas por API routes — nunca pelo cliente.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { AnamneseAvatar, IntervencaoResult, TurnoConversa, MomentoCritico } from './types'
import { isTipoErro } from './types'
import {
  buildSupervisorSystemPrompt,
  buildSupervisorTurnMessage,
  buildNotaPedagogicaSystem,
  buildNotaPedagogicaUser,
} from './prompts'

const MODEL = 'claude-sonnet-4-6'

function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
}

/** Faz parse tolerante de JSON vindo do modelo (remove fences markdown). */
function parseJson<T>(raw: string): T | null {
  try {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim()
    // Apanha o primeiro objecto { ... } caso venha texto à volta
    const match = cleaned.match(/\{[\s\S]*\}/)
    return JSON.parse(match ? match[0] : cleaned) as T
  } catch {
    return null
  }
}

// ─── Análise de turno ───────────────────────────────────────────────────────────

export async function analisarTurno(params: {
  avatar: AnamneseAvatar
  historico: TurnoConversa[]
  mensagemAnteriorAvatar: string
  perguntaTerapeuta: string
}): Promise<IntervencaoResult> {
  const { avatar, historico, mensagemAnteriorAvatar, perguntaTerapeuta } = params

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let raw = ''
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: buildSupervisorSystemPrompt(avatar),
      messages: [
        {
          role: 'user',
          content: buildSupervisorTurnMessage(historico, mensagemAnteriorAvatar, perguntaTerapeuta),
        },
      ],
    })
    raw = extractText(response)
  } catch (err) {
    console.error('[anamnese/supervisor] Claude error:', err)
    return { intervir: false }
  }

  const parsed = parseJson<{ intervir?: boolean; tipo_erro?: string; intervencao?: string }>(raw)
  if (!parsed || parsed.intervir !== true) return { intervir: false }

  const tipo = typeof parsed.tipo_erro === 'string' ? parsed.tipo_erro.toLowerCase().trim() : ''
  const intervencao = typeof parsed.intervencao === 'string' ? parsed.intervencao.trim() : ''

  // Só intervimos se há um tipo de erro reconhecido e texto de intervenção
  if (!intervencao || !isTipoErro(tipo)) return { intervir: false }

  return { intervir: true, tipo_erro: tipo, intervencao }
}

// ─── Nota pedagógica final ──────────────────────────────────────────────────────

export interface NotaPedagogicaResult {
  pontos_positivos: string[]
  momentos_criticos: MomentoCritico[]
  proxima_sessao_sugerida: string
  nota_pedagogica: string
}

export async function gerarNotaPedagogica(params: {
  avatar: AnamneseAvatar
  historico: TurnoConversa[]
  score: number
}): Promise<NotaPedagogicaResult | null> {
  const { avatar, historico, score } = params
  if (historico.length === 0) return null

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let raw = ''
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: buildNotaPedagogicaSystem(avatar),
      messages: [{ role: 'user', content: buildNotaPedagogicaUser(avatar, historico, score) }],
    })
    raw = extractText(response)
  } catch (err) {
    console.error('[anamnese/nota] Claude error:', err)
    return null
  }

  const parsed = parseJson<NotaPedagogicaResult>(raw)
  if (!parsed) return null

  return {
    pontos_positivos: Array.isArray(parsed.pontos_positivos) ? parsed.pontos_positivos.slice(0, 4) : [],
    momentos_criticos: Array.isArray(parsed.momentos_criticos) ? parsed.momentos_criticos.slice(0, 3) : [],
    proxima_sessao_sugerida: typeof parsed.proxima_sessao_sugerida === 'string' ? parsed.proxima_sessao_sugerida : '',
    nota_pedagogica: typeof parsed.nota_pedagogica === 'string' ? parsed.nota_pedagogica : '',
  }
}
