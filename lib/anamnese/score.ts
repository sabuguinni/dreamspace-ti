/**
 * Cálculo de score e montagem do relatório de anamnese.
 */

import {
  type Classificacao,
  type RelatorioAnamnese,
  type TurnoConversa,
  type TipoErro,
  type MomentoCritico,
  labelErro,
  penalizacaoErro,
} from './types'

/** Score base 100, menos as penalizações por cada intervenção do Supervisor. */
export function calcularScore(historico: TurnoConversa[]): number {
  const total = historico
    .filter(t => t.supervisor_interveio && t.tipo_erro)
    .reduce((acc, t) => acc + penalizacaoErro(t.tipo_erro as string), 0)
  return Math.max(0, Math.min(100, 100 - total))
}

export function classificar(score: number): Classificacao {
  if (score >= 85) return 'Excelente'
  if (score >= 65) return 'Bom'
  if (score >= 40) return 'A Desenvolver'
  return 'Crítico'
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
  const score = calcularScore(historico)

  return {
    avatar: avatarNome,
    data,
    duracao_minutos: duracaoMinutos,
    score,
    classificacao: classificar(score),
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
  }
}
