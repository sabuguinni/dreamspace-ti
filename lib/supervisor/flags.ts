/**
 * Detecção de flags do Supervisor de Sonhos.
 *
 * Dois mecanismos (cada um adequado ao seu caminho):
 * - detectFlags(text): keyword matching — caminho de TEXTO (o prompt nomeia os erros).
 * - extractFlagMarkers(text): marcadores estruturados [[FLAG:código]] — caminho de VOZ
 *   (o prompt de voz emite o marcador; é removido antes de falar/mostrar/persistir).
 *
 * Os códigos válidos são os 5 flags do Supervisor de Sonhos (FlagSonho em lib/types).
 * Follow-up: migrar o caminho de texto para o marcador estruturado (precisa de buffering
 * do stream SSE para esconder o marcador ao vivo).
 */

import { type FlagSonho, isFlagSonho } from '@/lib/types'

interface FlagRule {
  flag: FlagSonho
  keywords: string[]
}

/**
 * Keywords por flag (caminho de texto). Melhoradas para reduzir falsos negativos
 * (mais variantes) e o falso positivo de `aterragem` (agora exige contexto negativo —
 * antes, `aterragem` sozinho disparava também em elogios/instruções).
 */
export const FLAG_MAP: FlagRule[] = [
  {
    flag: 'interpretacao_prematura',
    keywords: [
      'interpretação prematura', 'interpretacao prematura',
      'interpretação precoce', 'interpretacao precoce',
      'interpretaste cedo', 'saltaste para o significado', 'saltou para o significado',
      'cedo demais', 'depressa a interpretar',
    ],
  },
  {
    flag: 'heroismo_terapeutico',
    keywords: [
      'heroísmo terapêutico', 'heroismo terapeutico', 'heroísmo', 'heroismo',
      'tentar resolver o sonho', 'resolver em vez de ficar', 'queres resolver',
    ],
  },
  {
    flag: 'projeccao_terapeuta',
    keywords: [
      'projecção', 'projeccao', 'projeção', 'projetas', 'projectas',
      'diz mais sobre ti', 'sobre o terapeuta do que sobre',
    ],
  },
  {
    flag: 'ausencia_aterragem',
    // Exige contexto negativo — nunca o bare 'aterragem' (que aparece em elogios/instruções).
    keywords: [
      'sem aterragem', 'falta aterragem', 'falta de aterragem',
      'ausência de aterragem', 'ausencia de aterragem',
      'sem ponte para a vida', 'fica em insight', 'não aterra', 'nao aterra',
      'não há aterragem', 'nao ha aterragem',
    ],
  },
  {
    flag: 'lente_unica',
    keywords: [
      'única lente', 'unica lente', 'uma só lente', 'uma so lente', 'mesma lente',
      'um só método', 'um so metodo', 'sempre o mesmo método', 'sempre o mesmo metodo',
      'única abordagem', 'unica abordagem',
    ],
  },
]

/** Detecção por keyword (caminho de texto). Devolve flags únicos detectados. */
export function detectFlags(text: string): string[] {
  const lower = text.toLowerCase()
  const found: string[] = []
  for (const { keywords, flag } of FLAG_MAP) {
    if (keywords.some(k => lower.includes(k))) found.push(flag)
  }
  return found
}

const FLAG_MARKER_RE = /\[\[FLAG:\s*([a-z_]+)\s*\]\]/gi

/**
 * Extrai marcadores estruturados [[FLAG:código]] (caminho de voz) e devolve o texto
 * limpo (sem marcadores) + a lista de flags válidos e únicos detectados.
 * Tolerante: ignora códigos desconhecidos mas remove o marcador na mesma.
 */
export function extractFlagMarkers(text: string): { flags: string[]; clean: string } {
  const found = new Set<string>()
  for (const m of text.matchAll(FLAG_MARKER_RE)) {
    const code = m[1].toLowerCase()
    if (isFlagSonho(code)) found.add(code)
  }
  const clean = text
    .replace(FLAG_MARKER_RE, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { flags: [...found], clean }
}
