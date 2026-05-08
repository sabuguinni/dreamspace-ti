export interface VocabSubstitution {
  term: string
  replacement: string
  count: number
}

export interface VocabResult {
  texto: string
  log: VocabSubstitution[]
}

// Plurals must come before singulars so longer patterns match first
const REPLACEMENTS: Array<[RegExp, string, string]> = [
  [/\bdados clínicos\b/gi, 'dados terapêuticos', 'dados clínicos'],
  [/\bdado clínico\b/gi, 'dado terapêutico', 'dado clínico'],
  [/\binformação clínica\b/gi, 'informação terapêutica', 'informação clínica'],
  [/\bpacientes\b/gi, 'acompanhados', 'pacientes'],
  [/\bpaciente\b/gi, 'acompanhado', 'paciente'],
  [/\bdiagnósticos\b/gi, 'avaliações', 'diagnósticos'],
  [/\bdiagnóstico\b/gi, 'avaliação', 'diagnóstico'],
  [/\bsintomas\b/gi, 'dificuldades', 'sintomas'],
  [/\bsintoma\b/gi, 'dificuldade', 'sintoma'],
  [/\btratamentos\b/gi, 'processos', 'tratamentos'],
  [/\btratamento\b/gi, 'processo', 'tratamento'],
  [/\bdoentes\b/gi, 'acompanhados', 'doentes'],
  [/\bdoente\b/gi, 'acompanhado', 'doente'],
]

export function enforceVocabulary(text: string): VocabResult {
  const log: VocabSubstitution[] = []
  let resultado = text

  for (const [pattern, replacement, term] of REPLACEMENTS) {
    const matches = resultado.match(pattern)
    if (matches && matches.length > 0) {
      log.push({ term, replacement, count: matches.length })
      resultado = resultado.replace(pattern, replacement)
    }
  }

  return { texto: resultado, log }
}
