export type NivelPlataforma = 'base' | 'avancado' | 'profissional'
export type SessaoEstado = 'em_curso' | 'concluida' | 'arquivada'
export type MetodoTerapeutico =
  | 'freud_associacao_livre'
  | 'jung_amplificacao'
  | 'hillman_imagem'
  | 'delaney_dream_interview'
  | 'gendlin_focusing'
  | 'bosnak_embodied'
  | 'perls_gestalt'
  | 'hill_cognitivo_experiencial'
  | 'ullman_grupo'
  | 'taylor_grupo'
  | 'lucido'
  | 'integrado'
  | 'nao_definido'

export const METODO_LABELS: Record<MetodoTerapeutico, string> = {
  freud_associacao_livre: 'Freud — Associação Livre',
  jung_amplificacao: 'Jung — Amplificação',
  hillman_imagem: 'Hillman — Imagem',
  delaney_dream_interview: 'Delaney — Dream Interview',
  gendlin_focusing: 'Gendlin — Focusing',
  bosnak_embodied: 'Bosnak — Embodied Dreamwork',
  perls_gestalt: 'Perls — Gestalt',
  hill_cognitivo_experiencial: 'Hill — Cognitivo-Experiencial',
  ullman_grupo: 'Ullman — Grupo',
  taylor_grupo: 'Taylor — Grupo',
  lucido: 'Sonho Lúcido',
  integrado: 'Abordagem Integrada',
  nao_definido: 'Ainda não definido',
}

export interface Profile {
  id: string
  email: string
  nome_completo: string
  modulos_acesso: number[]
  nivel: NivelPlataforma
  data_inscricao: string
  ultima_actividade: string | null
  configuracoes: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface SonhoDiario {
  id: string
  user_id: string
  data_sonho: string
  titulo: string | null
  texto: string
  emocao_score: number | null
  notas: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export interface SessaoSupervisor {
  id: string
  user_id: string
  sonho_id: string | null
  sonho_texto: string
  caso_descricao: string | null
  metodo_escolhido: MetodoTerapeutico
  estado: SessaoEstado
  flags_detectados: string[]
  created_at: string
  updated_at: string
}

export interface SessaoAvatar {
  id: string
  user_id: string
  avatar_slug: string
  nivel: number
  estado: SessaoEstado
  ficheiro_revelado: boolean
  notas_evolucao: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Mensagem {
  id: string
  sessao_supervisor_id: string | null
  sessao_avatar_id: string | null
  papel: 'user' | 'assistant' | 'system'
  conteudo: string
  metadata: Record<string, unknown>
  ordem: number
  created_at: string
}

export interface FicheiroSecreto {
  historiaReal: string
  feridaCentral: string
  motivoVerdadeiroDaTerapia: string
  chaveTerapeutica: string
  indicadoresProgresso: string[]
}

export interface AvatarDimensaoReport {
  score: number
  feedback: string
}

// ─── Supervisor Report ────────────────────────────────────────────────────────

export interface SupervisorDimensaoReport {
  score: number    // 0–100
  feedback: string
}

export interface SupervisorReport {
  overallScore: number
  summary: string
  metodoAplicado: SupervisorDimensaoReport
  perguntasSocraticas: SupervisorDimensaoReport
  evitouInterpretacaoDirecta: SupervisorDimensaoReport
  exploracaoElementosSonho: SupervisorDimensaoReport
  ligacaoVidaConcreta: SupervisorDimensaoReport
  linguagemTerapeutica: SupervisorDimensaoReport
  pontosFortesObservados: string[]
  areasMelhoria: string[]
  proximosPassos: string
}

export interface AvatarReport {
  overallScore: number
  summary: string
  abordagemSocratica: AvatarDimensaoReport
  escutaAtiva: AvatarDimensaoReport
  respeitoSimbologiaPessoal: AvatarDimensaoReport
  evitouInterpretacaoDirecta: AvatarDimensaoReport
  criouEspacoSeguro: AvatarDimensaoReport
  progressoComAvatar: AvatarDimensaoReport
  techniquesDetected: string[]
  strengths: string[]
  improvements: string[]
  criticalErrors: string[]
  nextSteps: string
}

export interface Avatar {
  slug: string
  nome: string
  idade: number
  profissao: string
  cidade: string
  imagem: string
  resumoPublico: string
  competenciaTreinada: string
  duracaoEstimada: string
  sonhoBase: string
  ficheiroSecreto: FicheiroSecreto
  systemPrompt: string
}
