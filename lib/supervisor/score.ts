/**
 * Cálculo de score e montagem do relatório do Supervisor de Sonhos.
 *
 * Espelha lib/anamnese/score.ts — modelo de 2 dimensões + tectos de suficiência:
 * - Rigor    = 100 − penalizações (flags detectados; peso por ocorrência, CAP=2)
 * - Execução = 0.5 turnos + 0.5 cobertura do protocolo de 4 níveis
 *              (acolhimento → método → elementos → integração)
 * - scoreFinal = 0.5 rigor + 0.5 execução, com tectos por nº de turnos (e cobertura).
 *
 * Best-effort: se o LLM não avaliar a cobertura, a Execução usa só os turnos e os
 * tectos de turnos (determinísticos) mantêm-se.
 *
 * IMPORTANTE: os flags NÃO são re-julgados aqui — vêm de flags_detectados
 * (mensagens.metadata.flags_detectados), passados como lista de ocorrências.
 *
 * Ficheiro de funções puras: sem I/O, sem dependências de rede. Ainda não é
 * importado por nenhuma route/componente (Passo 1 do plano de unificação).
 */

import {
  type ClassificacaoSonho,
  type CoberturaMetodologiaSonho,
  type FlagSonho,
  type MetodoTerapeutico,
  type MomentoCriticoSonho,
  type ResumoFlagSonho,
  type SupervisorReportV2,
  isFlagSonho,
  labelFlagSonho,
  penalizacaoFlagSonho,
} from '@/lib/types'

// ── Limiares de suficiência (tunáveis) — adaptados ao ritmo do trabalho com sonho ──
export const TURNOS_MIN_VALIDO_SONHO = 2      // abaixo → classificação máx. "A Desenvolver"
export const TURNOS_MIN_EXCELENTE_SONHO = 4   // abaixo → classificação máx. "Bom"
export const TURNOS_IDEAL_SONHO = 5           // turnos para execução plena (componente turnos)
export const COBERTURA_MIN_EXCELENTE_SONHO = 3 // níveis (de 4) para permitir "Excelente"
export const FLAG_PENALIZACAO_CAP = 2         // ocorrências máx. penalizadas por tipo de flag

/** Conta ocorrências de cada flag válido (preserva repetições entre turnos). */
export function contarFlags(occurrences: string[]): Map<FlagSonho, number> {
  const counts = new Map<FlagSonho, number>()
  for (const f of occurrences) {
    if (isFlagSonho(f)) counts.set(f, (counts.get(f) ?? 0) + 1)
  }
  return counts
}

/** Rigor: 100 menos penalizações — peso × min(ocorrências, CAP) por cada tipo de flag. */
export function calcularRigorSonho(occurrences: string[]): number {
  let penal = 0
  for (const [flag, n] of contarFlags(occurrences)) {
    penal += penalizacaoFlagSonho(flag) * Math.min(n, FLAG_PENALIZACAO_CAP)
  }
  return Math.max(0, Math.min(100, 100 - penal))
}

export function contarCoberturaSonho(c?: CoberturaMetodologiaSonho | null): number {
  if (!c) return 0
  return [c.acolhimento, c.metodo, c.elementos, c.integracao].filter(Boolean).length
}

/** Execução: quanto se fez (turnos) + que níveis se cobriram (0-4).
 *  Sem cobertura avaliada (LLM falhou) → usa só os turnos. */
export function calcularExecucaoSonho(
  turnosReais: number,
  cobertura?: CoberturaMetodologiaSonho | null,
): number {
  const pontosTurnos = Math.min(100, (turnosReais / TURNOS_IDEAL_SONHO) * 100)
  if (!cobertura) return Math.round(pontosTurnos)
  const pontosCobertura = (contarCoberturaSonho(cobertura) / 4) * 100
  return Math.round(0.5 * pontosTurnos + 0.5 * pontosCobertura)
}

/** Score final: 0.5 rigor + 0.5 execução. */
export function calcularScoreFinalSonho(
  occurrences: string[],
  turnosReais: number,
  cobertura?: CoberturaMetodologiaSonho | null,
): number {
  const rigor = calcularRigorSonho(occurrences)
  const execucao = calcularExecucaoSonho(turnosReais, cobertura)
  return Math.round(0.5 * rigor + 0.5 * execucao)
}

/** Classificação simples por score (sem tectos) — para retrocompatibilidade/uso interno. */
export function classificarSonho(score: number): ClassificacaoSonho {
  return score >= 85 ? 'Excelente' : score >= 65 ? 'Bom' : score >= 40 ? 'A Desenvolver' : 'Crítico'
}

/** Classificação por score, com tectos de suficiência.
 *  Turnos: sempre. Cobertura: só limita se foi avaliada (LLM não falhou). */
export function classificarComSuficienciaSonho(
  score: number,
  turnosReais: number,
  cobertura?: CoberturaMetodologiaSonho | null,
): ClassificacaoSonho {
  let cls = classificarSonho(score)

  if (turnosReais < TURNOS_MIN_VALIDO_SONHO) {
    if (cls === 'Excelente' || cls === 'Bom') cls = 'A Desenvolver'
  } else if (turnosReais < TURNOS_MIN_EXCELENTE_SONHO) {
    if (cls === 'Excelente') cls = 'Bom'
  } else if (cobertura && contarCoberturaSonho(cobertura) < COBERTURA_MIN_EXCELENTE_SONHO) {
    if (cls === 'Excelente') cls = 'Bom'
  }
  return cls
}

/** Nota textual de suficiência — explica ao formando por que o score foi limitado. */
function notaSuficienciaSonho(turnosReais: number, cobertura?: CoberturaMetodologiaSonho | null): string {
  if (turnosReais < TURNOS_MIN_VALIDO_SONHO) {
    return `Sessão demasiado curta (${turnosReais} ${turnosReais === 1 ? 'turno' : 'turnos'}): não houve supervisão suficiente para uma avaliação completa. Aprofunda o trabalho com o sonho ao longo de mais turnos.`
  }
  if (turnosReais < TURNOS_MIN_EXCELENTE_SONHO) {
    return `Sessão limitada (${turnosReais} turnos): para chegar a "Excelente", aprofunda a supervisão ao longo de mais turnos.`
  }
  if (cobertura && contarCoberturaSonho(cobertura) < COBERTURA_MIN_EXCELENTE_SONHO) {
    return `Faltou cobrir níveis do protocolo (${contarCoberturaSonho(cobertura)}/4): para "Excelente", trabalha o acolhimento, o método, os elementos não explorados e a integração na vida.`
  }
  return ''
}

/** Agrupa os flags por tipo, ordenado por contagem (determinístico). */
export function resumoFlagsPorTipo(occurrences: string[]): ResumoFlagSonho[] {
  return [...contarFlags(occurrences).entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([flag, contagem]) => ({ flag, contagem, descricao: labelFlagSonho(flag) }))
}

export function totalFlags(occurrences: string[]): number {
  return occurrences.filter(isFlagSonho).length
}

// ── Montagem do relatório ────────────────────────────────────────────────────

/** Turno com flag, para o fallback de momentos críticos (caso o LLM falhe). */
export interface TurnoFlaggedSonho {
  turno: number
  mensagem_terapeuta: string
  flag: FlagSonho
  intervencao_supervisor?: string
}

/** Fallback de momentos críticos a partir dos turnos com flag. */
export function momentosCriticosFallbackSonho(turnos: TurnoFlaggedSonho[]): MomentoCriticoSonho[] {
  return turnos.slice(0, 3).map(t => ({
    turno: t.turno,
    mensagem_terapeuta: t.mensagem_terapeuta,
    flag: t.flag,
    o_que_aconteceu: labelFlagSonho(t.flag),
    o_que_deveria_ter_acontecido: t.intervencao_supervisor ?? '',
  }))
}

/** Parte qualitativa do relatório vinda do LLM (best-effort). */
export interface NotaPedagogicaSonho {
  pontos_positivos: string[]
  areas_melhoria: string[]
  momentos_criticos: MomentoCriticoSonho[]
  proxima_sessao_sugerida: string
  nota_pedagogica: string
  cobertura_metodologia?: CoberturaMetodologiaSonho
}

/** Monta o relatório v2 combinando o cálculo determinístico + a nota qualitativa do LLM. */
export function construirRelatorioSonho(params: {
  metodo: MetodoTerapeutico
  sonhoResumo: string
  occurrences: string[]
  turnosReais: number
  momentosBrutos?: TurnoFlaggedSonho[]
  duracaoMinutos?: number
  data: string
  nota: NotaPedagogicaSonho | null
}): SupervisorReportV2 {
  const { metodo, sonhoResumo, occurrences, turnosReais, momentosBrutos, duracaoMinutos, data, nota } = params
  const cobertura = nota?.cobertura_metodologia ?? null
  const score = calcularScoreFinalSonho(occurrences, turnosReais, cobertura)
  const classificacao = classificarComSuficienciaSonho(score, turnosReais, cobertura)

  return {
    version: 2,
    metodo,
    sonho_resumo: sonhoResumo,
    data,
    duracao_minutos: duracaoMinutos,
    score,
    classificacao,
    resumo_flags: {
      total: totalFlags(occurrences),
      por_tipo: resumoFlagsPorTipo(occurrences),
    },
    momentos_criticos:
      nota?.momentos_criticos && nota.momentos_criticos.length > 0
        ? nota.momentos_criticos.slice(0, 3)
        : momentosCriticosFallbackSonho(momentosBrutos ?? []),
    pontos_positivos: nota?.pontos_positivos ?? [],
    areas_melhoria: nota?.areas_melhoria ?? [],
    proxima_sessao_sugerida: nota?.proxima_sessao_sugerida ?? '',
    nota_pedagogica: nota?.nota_pedagogica ?? '',
    cobertura_metodologia: cobertura,
    nota_suficiencia: notaSuficienciaSonho(turnosReais, cobertura),
  }
}
