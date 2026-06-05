/**
 * Cálculo de score e montagem do relatório de anamnese.
 *
 * Score em 2 dimensões + tectos de suficiência:
 * - Rigor    = 100 − penalizações (ausência de erros)
 * - Execução = 0.5 turnos + 0.5 cobertura da metodologia (símbolo→episódio→corpo→latente)
 * - scoreFinal = 0.5 rigor + 0.5 execução, com tectos por nº de turnos (e cobertura, se avaliada).
 *
 * Best-effort: se a IA não avaliar a cobertura, a Execução usa só os turnos e os tectos
 * de turnos (determinísticos) mantêm-se.
 */

import {
  type Classificacao,
  type CoberturaMetodologia,
  type RelatorioAnamnese,
  type TurnoConversa,
  type TipoErro,
  type MomentoCritico,
  labelErro,
  penalizacaoErro,
} from './types'

// ── Limiares de suficiência (tunáveis) ───────────────────────────────────────
export const TURNOS_MIN_VALIDO = 4       // abaixo → classificação máx. "A Desenvolver"
export const TURNOS_MIN_EXCELENTE = 8    // abaixo → classificação máx. "Bom"
export const TURNOS_IDEAL = 10           // turnos para execução plena (componente turnos)
export const COBERTURA_MIN_EXCELENTE = 3 // passos (de 4) para permitir "Excelente"

/** Rigor: 100 menos as penalizações por cada intervenção do Supervisor. */
export function calcularRigor(historico: TurnoConversa[]): number {
  const total = historico
    .filter(t => t.supervisor_interveio && t.tipo_erro)
    .reduce((acc, t) => acc + penalizacaoErro(t.tipo_erro as string), 0)
  return Math.max(0, Math.min(100, 100 - total))
}

function contarCobertura(c?: CoberturaMetodologia | null): number {
  if (!c) return 0
  return [c.simbolo, c.episodio, c.corpo, c.latente].filter(Boolean).length
}

function turnosReaisDe(historico: TurnoConversa[]): number {
  return historico.filter(t => t.turno > 0).length
}

/** Execução: quanto se fez (turnos) + que passos se cobriram (0-4).
 *  Sem cobertura avaliada (IA falhou) → usa só os turnos. */
export function calcularExecucao(turnosReais: number, cobertura?: CoberturaMetodologia | null): number {
  const pontosTurnos = Math.min(100, (turnosReais / TURNOS_IDEAL) * 100)
  if (!cobertura) return Math.round(pontosTurnos)
  const pontosCobertura = (contarCobertura(cobertura) / 4) * 100
  return Math.round(0.5 * pontosTurnos + 0.5 * pontosCobertura)
}

/** Score final: 0.5 rigor + 0.5 execução. */
export function calcularScoreFinal(historico: TurnoConversa[], cobertura?: CoberturaMetodologia | null): number {
  const rigor = calcularRigor(historico)
  const execucao = calcularExecucao(turnosReaisDe(historico), cobertura)
  return Math.round(0.5 * rigor + 0.5 * execucao)
}

/** Classificação por score, com tectos de suficiência.
 *  Turnos: sempre. Cobertura: só limita se foi avaliada (IA não falhou). */
export function classificarComSuficiencia(
  score: number,
  turnosReais: number,
  cobertura?: CoberturaMetodologia | null,
): Classificacao {
  let cls: Classificacao =
    score >= 85 ? 'Excelente' : score >= 65 ? 'Bom' : score >= 40 ? 'A Desenvolver' : 'Crítico'

  if (turnosReais < TURNOS_MIN_VALIDO) {
    if (cls === 'Excelente' || cls === 'Bom') cls = 'A Desenvolver'
  } else if (turnosReais < TURNOS_MIN_EXCELENTE) {
    if (cls === 'Excelente') cls = 'Bom'
  } else if (cobertura && contarCobertura(cobertura) < COBERTURA_MIN_EXCELENTE) {
    if (cls === 'Excelente') cls = 'Bom'
  }
  return cls
}

/** Classificação simples por score (sem tectos) — mantida para retrocompatibilidade. */
export function classificar(score: number): Classificacao {
  return score >= 85 ? 'Excelente' : score >= 65 ? 'Bom' : score >= 40 ? 'A Desenvolver' : 'Crítico'
}

/** Nota textual de suficiência — explica ao formando por que o score foi limitado. */
function notaSuficiencia(turnosReais: number, cobertura?: CoberturaMetodologia | null): string {
  if (turnosReais < TURNOS_MIN_VALIDO) {
    return `Sessão demasiado curta (${turnosReais} ${turnosReais === 1 ? 'turno' : 'turnos'}): não houve anamnese suficiente para uma avaliação completa. Conduz mais turnos e aprofunda.`
  }
  if (turnosReais < TURNOS_MIN_EXCELENTE) {
    return `Sessão limitada (${turnosReais} turnos): para chegar a "Excelente", explora mais a fundo ao longo de mais turnos.`
  }
  if (cobertura && contarCobertura(cobertura) < COBERTURA_MIN_EXCELENTE) {
    return `Faltou cobrir passos da metodologia (${contarCobertura(cobertura)}/4): para "Excelente", explora símbolo, episódio, corpo e o conteúdo latente.`
  }
  return ''
}

/** Agrupa as intervenções por tipo de erro. */
export function resumoPorTipo(
  historico: TurnoConversa[],
): { tipo: TipoErro; contagem: number; descricao: string }[] {
  const contagem = new Map<string, number>()
  for (const t of historico) {
    if (t.supervisor_interveio && t.tipo_erro) {
      contagem.set(t.tipo_erro, (contagem.get(t.tipo_erro) ?? 0) + 1)
    }
  }
  return [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tipo, count]) => ({
      tipo: tipo as TipoErro,
      contagem: count,
      descricao: labelErro(tipo),
    }))
}

export function totalIntervencoes(historico: TurnoConversa[]): number {
  return historico.filter(t => t.supervisor_interveio).length
}

/** Fallback de momentos críticos a partir do histórico (caso a IA falhe). */
export function momentosCriticosFallback(historico: TurnoConversa[]): MomentoCritico[] {
  return historico
    .filter(t => t.supervisor_interveio && t.intervencao_supervisor)
    .slice(0, 3)
    .map(t => ({
      turno: t.turno,
      pergunta_terapeuta: t.terapeuta,
      o_que_aconteceu: labelErro(t.tipo_erro ?? ''),
      o_que_deveria_ter_acontecido: t.intervencao_supervisor ?? '',
    }))
}

interface NotaPedagogica {
  pontos_positivos: string[]
  momentos_criticos: MomentoCritico[]
  proxima_sessao_sugerida: string
  nota_pedagogica: string
  cobertura_metodologia?: CoberturaMetodologia
}

/** Monta o relatório final combinando o cálculo determinístico + a nota da IA. */
export function construirRelatorio(params: {
  avatarNome: string
  historico: TurnoConversa[]
  duracaoMinutos: number
  data: string
  nota: NotaPedagogica | null
}): RelatorioAnamnese {
  const { avatarNome, historico, duracaoMinutos, data, nota } = params
  const cobertura = nota?.cobertura_metodologia ?? null
  const turnosReais = turnosReaisDe(historico)
  const score = calcularScoreFinal(historico, cobertura)
  const classificacao = classificarComSuficiencia(score, turnosReais, cobertura)

  return {
    avatar: avatarNome,
    data,
    duracao_minutos: duracaoMinutos,
    score,
    classificacao,
    resumo_intervencoes: {
      total: totalIntervencoes(historico),
      por_tipo: resumoPorTipo(historico),
    },
    momentos_criticos:
      nota?.momentos_criticos && nota.momentos_criticos.length > 0
        ? nota.momentos_criticos.slice(0, 3)
        : momentosCriticosFallback(historico),
    pontos_positivos: nota?.pontos_positivos ?? [],
    proxima_sessao_sugerida: nota?.proxima_sessao_sugerida ?? '',
    nota_pedagogica: nota?.nota_pedagogica ?? '',
    cobertura_metodologia: cobertura,
    nota_suficiencia: notaSuficiencia(turnosReais, cobertura),
  }
}
