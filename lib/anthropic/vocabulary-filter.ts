// Plurals must come before singulars so longer patterns match first
const REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bdados clínicos\b/gi, 'dados terapêuticos'],
  [/\bdado clínico\b/gi, 'dado terapêutico'],
  [/\binformação clínica\b/gi, 'informação terapêutica'],
  [/\bpacientes\b/gi, 'acompanhados'],
  [/\bpaciente\b/gi, 'acompanhado'],
  [/\bdiagnósticos\b/gi, 'avaliações'],
  [/\bdiagnóstico\b/gi, 'avaliação'],
  [/\bsintomas\b/gi, 'dificuldades'],
  [/\bsintoma\b/gi, 'dificuldade'],
  [/\btratamentos\b/gi, 'processos'],
  [/\btratamento\b/gi, 'processo'],
  [/\bdoentes\b/gi, 'acompanhados'],
  [/\bdoente\b/gi, 'acompanhado'],
]

export function enforceVocabulary(text: string): string {
  return REPLACEMENTS.reduce((t, [pattern, replacement]) => t.replace(pattern, replacement), text)
}
