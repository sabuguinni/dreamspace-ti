/**
 * Parte qualitativa do relatório do Supervisor de Sonhos (chamada Claude).
 *
 * Espelha lib/anamnese/supervisor.ts → gerarNotaPedagogica. Produz SÓ qualitativo:
 * nota_pedagogica (summary global), pontos_positivos, areas_melhoria,
 * proxima_sessao_sugerida, cobertura_metodologia (4 níveis do protocolo de sonhos)
 * e momentos_criticos (descritivos).
 *
 * NÃO produz score (calculado em código). NÃO re-julga flags — esses vêm de
 * flags_detectados, já capturados; os momentos críticos aqui são descritivos (flag = null).
 *
 * Server-only: importado apenas por API routes. INERTE no Passo 3 — o report/route.ts
 * só passa a usar isto no Passo 4.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { CoberturaMetodologiaSonho, MomentoCriticoSonho } from '@/lib/types'
import type { NotaPedagogicaSonho } from '@/lib/supervisor/score'

const MODEL = 'claude-sonnet-4-6'

/** Turno normalizado da conversa de supervisão (terapeuta = user, supervisor = assistant). */
export interface TranscriptTurn {
  papel: 'user' | 'assistant'
  conteudo: string
}

function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
}

/** Parse tolerante de JSON do modelo (remove fences markdown, apanha o primeiro objecto). */
function parseJson<T>(raw: string): T | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    return JSON.parse(match ? match[0] : cleaned) as T
  } catch {
    return null
  }
}

/** Coage a cobertura vinda da IA; undefined se ausente (→ best-effort no score). */
function parseCoberturaSonho(c: unknown): CoberturaMetodologiaSonho | undefined {
  if (!c || typeof c !== 'object') return undefined
  const o = c as Record<string, unknown>
  return {
    acolhimento: o.acolhimento === true,
    metodo: o.metodo === true,
    elementos: o.elementos === true,
    integracao: o.integracao === true,
  }
}

/** Coage os momentos críticos. flag = null SEMPRE (descritivo; os flags vêm de flags_detectados). */
function parseMomentos(m: unknown): MomentoCriticoSonho[] {
  if (!Array.isArray(m)) return []
  return m.slice(0, 3).map(raw => {
    const o = (raw ?? {}) as Record<string, unknown>
    return {
      turno: typeof o.turno === 'number' ? o.turno : 0,
      mensagem_terapeuta: typeof o.mensagem_terapeuta === 'string' ? o.mensagem_terapeuta : '',
      flag: null,
      o_que_aconteceu: typeof o.o_que_aconteceu === 'string' ? o.o_que_aconteceu : '',
      o_que_deveria_ter_acontecido: typeof o.o_que_deveria_ter_acontecido === 'string' ? o.o_que_deveria_ter_acontecido : '',
    }
  })
}

function buildNotaSystemPrompt(): string {
  return `És o Supervisor de Sonhos do DreamSpace TI da Transpersonal International. Acabaste de acompanhar uma sessão completa de supervisão entre um terapeuta em formação e o seu acompanhado, a trabalhar um sonho.

Vais gerar APENAS a parte qualitativa do relatório final — o score é calculado à parte, NÃO o produzes. Responde APENAS com JSON válido, sem markdown:
{
  "nota_pedagogica": "<um parágrafo sobre o padrão geral observado no terapeuta>",
  "pontos_positivos": ["<momento concreto em que o terapeuta fez bem>", ...],
  "areas_melhoria": ["<área concreta a melhorar>", ...],
  "momentos_criticos": [
    { "turno": <n>, "mensagem_terapeuta": "<o que o terapeuta disse>", "o_que_aconteceu": "<porque foi um momento crítico>", "o_que_deveria_ter_acontecido": "<a abordagem correcta>" }
  ],
  "proxima_sessao_sugerida": "<foco a trabalhar na próxima sessão>",
  "cobertura_metodologia": { "acolhimento": <true|false>, "metodo": <true|false>, "elementos": <true|false>, "integracao": <true|false> }
}

cobertura_metodologia — os 4 níveis do protocolo de trabalho com sonhos. Marca true APENAS quando o terapeuta REALMENTE cumpriu o nível (não só tentou):
- acolhimento: acolheu o sonho fenomenologicamente (imagens, emoções, cores, tempos) ANTES de qualquer interpretação.
- metodo: escolheu conscientemente o método de trabalho com sonhos e justificou porque esse e não outro.
- elementos: explorou imagens/personagens/cenas do sonho ainda não tocadas, perguntando o que ali aconteceu (não o que significa).
- integracao: ligou o trabalho do sonho a acção concreta na vida do acompanhado.

Regras: máximo 3 momentos_criticos (os mais importantes), máximo 4 pontos_positivos, máximo 3 areas_melhoria. Português de Portugal, sem gerúndios. Nunca uses linguagem clínica (paciente/diagnóstico/sintoma/tratamento/clínico) — usa acompanhado/avaliação/dificuldade/processo/terapêutico. Sê concreto e honesto, sem condescendência.`
}

function buildNotaUserPrompt(sonhoTexto: string, metodo: string, transcript: TranscriptTurn[]): string {
  // Emparelha user→assistant em turnos numerados (terapeuta abre cada turno).
  const linhas: string[] = []
  let turno = 0
  for (const t of transcript) {
    if (t.papel === 'user') {
      turno++
      linhas.push(`Turno ${turno}:\n  Terapeuta: ${t.conteudo}`)
    } else {
      if (linhas.length === 0) { turno++; linhas.push(`Turno ${turno}:`) }
      linhas[linhas.length - 1] += `\n  Supervisor: ${t.conteudo}`
    }
  }
  const transcricao = linhas.join('\n\n') || '(sessão sem turnos)'

  return `Sonho em análise: ${sonhoTexto || '(não especificado)'}
Método escolhido pelo terapeuta: ${metodo || '(não especificado)'}

Transcrição completa da sessão de supervisão (Terapeuta = formando; Supervisor = tu, em tempo real):

${transcricao}`
}

/** Gera a nota pedagógica (qualitativa) da sessão de Supervisor de Sonhos. Best-effort: null em falha. */
export async function gerarNotaPedagogicaSonho(params: {
  sonhoTexto: string
  metodo: string
  transcript: TranscriptTurn[]
}): Promise<NotaPedagogicaSonho | null> {
  const { sonhoTexto, metodo, transcript } = params
  if (transcript.length === 0) return null

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let raw = ''
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: buildNotaSystemPrompt(),
      messages: [{ role: 'user', content: buildNotaUserPrompt(sonhoTexto, metodo, transcript) }],
    })
    raw = extractText(response)
  } catch (err) {
    console.error('[supervisor/nota] Claude error:', err)
    return null
  }

  const parsed = parseJson<{
    nota_pedagogica?: unknown
    pontos_positivos?: unknown
    areas_melhoria?: unknown
    momentos_criticos?: unknown
    proxima_sessao_sugerida?: unknown
    cobertura_metodologia?: unknown
  }>(raw)
  if (!parsed) return null

  return {
    pontos_positivos: Array.isArray(parsed.pontos_positivos)
      ? parsed.pontos_positivos.filter((x): x is string => typeof x === 'string').slice(0, 4)
      : [],
    areas_melhoria: Array.isArray(parsed.areas_melhoria)
      ? parsed.areas_melhoria.filter((x): x is string => typeof x === 'string').slice(0, 3)
      : [],
    momentos_criticos: parseMomentos(parsed.momentos_criticos),
    proxima_sessao_sugerida: typeof parsed.proxima_sessao_sugerida === 'string' ? parsed.proxima_sessao_sugerida : '',
    nota_pedagogica: typeof parsed.nota_pedagogica === 'string' ? parsed.nota_pedagogica : '',
    cobertura_metodologia: parseCoberturaSonho(parsed.cobertura_metodologia),
  }
}
