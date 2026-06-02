/**
 * Pós-processador PT-PT — substitui brasileirismos no texto do avatar.
 * Server-only, puro. Aplicado ANTES do TTS e ao texto do bloco escrito.
 *
 * Limites de palavra Unicode-aware (lookarounds + \p{L}) para apanhar acentos
 * (você, ônibus…) — o \b do JS não funciona bem com letras acentuadas.
 */

const PAIRS: Array<[string, string]> = [
  ['você', 'tu'],
  ['ônibus', 'autocarro'],
  ['celular', 'telemóvel'],
  ['banheiro', 'casa de banho'],
  ['né', 'não é'],
  ['tá', 'está'],
  ['pra', 'para'],
  ['pro', 'para o'],
  ['tô', 'estou'],
  ['tava', 'estava'],
  // gerúndios → infinitivo gerundivo PT-PT
  ['fazendo', 'a fazer'],
  ['sendo', 'a ser'],
  ['estando', 'a estar'],
  ['tendo', 'a ter'],
  ['indo', 'a ir'],
  ['vindo', 'a vir'],
  ['falando', 'a falar'],
  ['pensando', 'a pensar'],
  // vocabulário PT-BR → PT-PT (apenas termos inequívocos — sem sentido literal ambíguo em PT-PT)
  ['a gente', 'nós'],
  ['cadê', 'onde está'],
  ['bacana', 'fixe'],
  ['tem que', 'tem de'],
]

function buildRe(word: string): RegExp {
  // Espaços no termo → \s+ (apanha "a  gente", "tem\nque"); inócuo p/ termos de 1 palavra.
  const body = word.replace(/ /g, '\\s+')
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'giu')
}

const COMPILED: Array<[RegExp, string]> = PAIRS.map(([w, r]) => [buildRe(w), r])
const OBRIGADO_RE = buildRe('obrigado')

function applyRe(text: string, re: RegExp, replacement: string): string {
  return text.replace(re, (match: string) => {
    const c = match.charAt(0)
    const isUpper = c !== c.toLowerCase() && c === c.toUpperCase()
    return isUpper ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement
  })
}

/**
 * Substitui brasileirismos por PT-PT, preservando a capitalização da 1ª letra.
 * @param feminino quando true, "obrigado" → "obrigada" (avatar feminino).
 */
export function enforcePtPt(text: string, opts?: { feminino?: boolean }): string {
  let out = text
  for (const [re, rep] of COMPILED) out = applyRe(out, re, rep)
  if (opts?.feminino) out = applyRe(out, OBRIGADO_RE, 'obrigada')
  return out
}
