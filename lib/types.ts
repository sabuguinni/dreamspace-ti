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

// ─── Supervisor de Sonhos — modelo de score v2 (alinhado com a Anamnese) ───────
// Determinístico em código (Rigor + Execução + tectos + classificação); o LLM só
// produz o qualitativo + a avaliação de cobertura. Coexiste com SupervisorReport
// (v1, acima) até a migração da route/view nos passos seguintes — relatórios v1 já
// gerados continuam válidos.

/** Flags de erro detectados pelo Supervisor de Sonhos (já guardados em flags_detectados). */
export type FlagSonho =
  | 'interpretacao_prematura'
  | 'heroismo_terapeutico'
  | 'projeccao_terapeuta'
  | 'ausencia_aterragem'
  | 'lente_unica'

export const FLAG_SONHO_LABELS: Record<FlagSonho, string> = {
  interpretacao_prematura: 'Interpretação prematura',
  heroismo_terapeutico: 'Heroísmo terapêutico',
  projeccao_terapeuta: 'Projecção do terapeuta',
  ausencia_aterragem: 'Ausência de aterragem',
  lente_unica: 'Uso de uma única lente',
}

/** Penalização no Rigor por ocorrência de cada flag (base 100). Banda 7–12, como a anamnese. */
export const FLAG_SONHO_PENALIZACOES: Record<FlagSonho, number> = {
  interpretacao_prematura: 12, // viola a regra fundamental: nunca interpretar
  projeccao_terapeuta: 10,
  heroismo_terapeutico: 9,
  ausencia_aterragem: 8,
  lente_unica: 7,
}

export const FLAGS_SONHO_VALIDOS = Object.keys(FLAG_SONHO_PENALIZACOES) as FlagSonho[]

export function isFlagSonho(v: unknown): v is FlagSonho {
  return typeof v === 'string' && (FLAGS_SONHO_VALIDOS as string[]).includes(v)
}

export function labelFlagSonho(flag: string): string {
  return isFlagSonho(flag) ? FLAG_SONHO_LABELS[flag] : flag.replace(/_/g, ' ')
}

export function penalizacaoFlagSonho(flag: string): number {
  return isFlagSonho(flag) ? FLAG_SONHO_PENALIZACOES[flag] : 8
}

/** Classificação em 4 tiers (mesmos cortes da Anamnese). */
export type ClassificacaoSonho = 'Excelente' | 'Bom' | 'A Desenvolver' | 'Crítico'

/** Cobertura do protocolo de 4 níveis do Supervisor de Sonhos (avaliada pelo LLM, best-effort). */
export interface CoberturaMetodologiaSonho {
  acolhimento: boolean // 1. Antes de avançar — acolhimento fenomenológico
  metodo: boolean      // 2. Método — escolha consciente e justificada
  elementos: boolean   // 3. Elementos não explorados do sonho
  integracao: boolean  // 4. Integração na vida concreta
}

export interface ResumoFlagSonho {
  flag: FlagSonho
  contagem: number
  descricao: string
}

export interface MomentoCriticoSonho {
  turno: number
  mensagem_terapeuta: string
  flag: FlagSonho | null
  o_que_aconteceu: string
  o_que_deveria_ter_acontecido: string
}

/**
 * Relatório do Supervisor de Sonhos — modelo v2 (determinístico + qualitativo do LLM),
 * alinhado com RelatorioAnamnese. NÃO substitui SupervisorReport (v1) — coexistem.
 */
export interface SupervisorReportV2 {
  version: 2
  metodo: MetodoTerapeutico
  sonho_resumo: string
  data: string
  duracao_minutos?: number
  /** Score determinístico (código): 0.5·Rigor + 0.5·Execução. */
  score: number
  classificacao: ClassificacaoSonho
  /** Resumo dos flags por tipo (determinístico, a partir de flags_detectados). */
  resumo_flags: {
    total: number
    por_tipo: ResumoFlagSonho[]
  }
  momentos_criticos: MomentoCriticoSonho[]
  pontos_positivos: string[]
  areas_melhoria: string[]
  proxima_sessao_sugerida: string
  nota_pedagogica: string
  /** Níveis do protocolo cobertos (null/ausente se o LLM não avaliou). */
  cobertura_metodologia?: CoberturaMetodologiaSonho | null
  /** Explicação de por que o score foi limitado por suficiência (vazio se não limitado). */
  nota_suficiencia?: string
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
