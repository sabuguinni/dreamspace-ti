/**
 * Supervisor de Anamnese — tipos partilhados.
 *
 * Princípio pedagógico: a narrativa de anamnese é conteúdo manifesto.
 * O conteúdo latente é o que se passou DENTRO do cliente enquanto os eventos
 * ocorreram. O Supervisor garante que o terapeuta usa a narrativa como PORTAL
 * para o interior, em vez de trabalhar com a superfície.
 */

// ─── Erros detectados pelo Supervisor ───────────────────────────────────────────

export type TipoErro =
  | 'foco_narrativa_externa'
  | 'validacao_manifesta'
  | 'salto_temporal'
  | 'porta_fechada'
  | 'ausencia_corpo'
  | 'resistencia_nao_trabalhada'
  | 'causalidade_externa'
  // específicos de alguns avatares
  | 'retraumatizacao_potencial'
  | 'alianca_manifesta'
  | 'validacao_externa'

export const TIPO_ERRO_LABELS: Record<TipoErro, string> = {
  foco_narrativa_externa: 'Foco na narrativa externa',
  validacao_manifesta: 'Validação do manifesto',
  salto_temporal: 'Salto temporal',
  porta_fechada: 'Porta latente fechada',
  ausencia_corpo: 'Ausência do corpo',
  resistencia_nao_trabalhada: 'Resistência não trabalhada',
  causalidade_externa: 'Causalidade externa',
  retraumatizacao_potencial: 'Retraumatização potencial',
  alianca_manifesta: 'Aliança com o manifesto',
  validacao_externa: 'Validação externa',
}

/** Penalização no score por cada tipo de erro (base 100). */
export const PENALIZACOES: Record<TipoErro, number> = {
  foco_narrativa_externa: 8,
  validacao_manifesta: 10,
  salto_temporal: 7,
  porta_fechada: 12, // oportunidade perdida — penalização mais alta
  ausencia_corpo: 9,
  resistencia_nao_trabalhada: 8,
  causalidade_externa: 8,
  retraumatizacao_potencial: 10,
  alianca_manifesta: 9,
  validacao_externa: 8,
}

export const TIPOS_ERRO_VALIDOS = Object.keys(PENALIZACOES) as TipoErro[]

export function isTipoErro(v: unknown): v is TipoErro {
  return typeof v === 'string' && (TIPOS_ERRO_VALIDOS as string[]).includes(v)
}

export function labelErro(tipo: string): string {
  return isTipoErro(tipo) ? TIPO_ERRO_LABELS[tipo] : tipo.replace(/_/g, ' ')
}

export function penalizacaoErro(tipo: string): number {
  return isTipoErro(tipo) ? PENALIZACOES[tipo] : 8
}

// ─── Avatar de anamnese (dados estáticos) ───────────────────────────────────────

export interface PontoIntervencao {
  gatilho: string
  tipo_erro: TipoErro
  descricao: string
}

export interface AnamneseAvatar {
  id: string
  nome: string
  idade: number
  area: string
  /** Resistências naturais do perfil — injectadas no system prompt do avatar. */
  resistencias: string
  /** Afirmações que o avatar pode usar naturalmente (conteúdo manifesto). */
  narrativaManifesta: string[]
  /** O que está por baixo — visível ao Supervisor, NUNCA ao avatar. */
  nosLatentes: Record<string, string>
  /** Padrões de erro que disparam intervenção do Supervisor. */
  pontosIntervencao: PontoIntervencao[]
}

// ─── Conversa e sessão ──────────────────────────────────────────────────────────

export interface TurnoConversa {
  turno: number
  timestamp: string
  terapeuta: string
  avatar: string
  supervisor_interveio: boolean
  tipo_erro?: TipoErro
  intervencao_supervisor?: string
}

/** Resposta do Supervisor à análise de um turno. */
export interface IntervencaoResult {
  intervir: boolean
  tipo_erro?: TipoErro
  intervencao?: string
}

// ─── Relatório final ────────────────────────────────────────────────────────────

export type Classificacao = 'Excelente' | 'Bom' | 'A Desenvolver' | 'Crítico'

export interface MomentoCritico {
  turno: number
  pergunta_terapeuta: string
  o_que_aconteceu: string
  o_que_deveria_ter_acontecido: string
}

export interface RelatorioAnamnese {
  avatar: string
  data: string
  duracao_minutos: number
  score: number
  classificacao: Classificacao
  resumo_intervencoes: {
    total: number
    por_tipo: { tipo: TipoErro; contagem: number; descricao: string }[]
  }
  momentos_criticos: MomentoCritico[]
  pontos_positivos: string[]
  proxima_sessao_sugerida: string
  nota_pedagogica: string
}

// ─── Linha da BD (tabela sessoes_anamnese) ──────────────────────────────────────

export interface SessaoAnamnese {
  id: string
  user_id: string
  avatar_id: string
  historico_conversa: TurnoConversa[]
  intervencoes_supervisor: unknown[]
  score_final: number | null
  relatorio: RelatorioAnamnese | null
  estado: 'em_curso' | 'concluida'
  modo: 'escrito' | 'voz'
  duracao_minutos: number
  created_at: string
  updated_at: string
}

/** Pré-requisito de desbloqueio: nº de sessões de Supervisor de Sonhos concluídas. */
export const ANAMNESE_DESBLOQUEIO_MINIMO = 10
