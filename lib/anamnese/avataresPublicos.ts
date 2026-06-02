/**
 * Metadados PÚBLICOS dos avatares de anamnese (client-safe).
 *
 * SEGURANÇA: os nós latentes e os pontos de intervenção vivem em
 * lib/anamnese/narrativas.ts (server-only). Este ficheiro só expõe o que pode
 * chegar ao browser — nome, idade, área e uma descrição pública.
 */

export interface AnamneseAvatarPublico {
  id: string
  nome: string
  idade: number
  area: string
  descricao: string
  cor: string
}

export const ANAMNESE_AVATARES_PUBLICOS: AnamneseAvatarPublico[] = [
  {
    id: 'mariana',
    nome: 'Mariana',
    idade: 32,
    area: 'Ansiedade Generalizada',
    descricao: 'Fala da mãe controladora, do pai ausente e do medo constante de falhar.',
    cor: 'oklch(0.55 0.15 25)',
  },
  {
    id: 'ricardo',
    nome: 'Ricardo',
    idade: 45,
    area: 'Depressão e Perda de Sentido',
    descricao: 'Vinte anos de carreira que de repente deixaram de fazer sentido.',
    cor: 'oklch(0.45 0.08 250)',
  },
  {
    id: 'sofia',
    nome: 'Sofia',
    idade: 27,
    area: 'Fobias e Trauma',
    descricao: 'Infância difícil, ataques de pânico e dificuldade em deixar aproximar.',
    cor: 'oklch(0.50 0.13 300)',
  },
  {
    id: 'tiago',
    nome: 'Tiago',
    idade: 38,
    area: 'Problemas de Vinculação',
    descricao: 'Evita relações. Veio porque a parceira deu um ultimato.',
    cor: 'oklch(0.46 0.06 200)',
  },
  {
    id: 'carolina',
    nome: 'Carolina',
    idade: 34,
    area: 'Relações Tóxicas e Codependência',
    descricao: 'Anula-se a cuidar dos outros. Não sabe quem é fora desse papel.',
    cor: 'oklch(0.52 0.13 350)',
  },
]

export function getAnamneseAvatarPublico(id: string): AnamneseAvatarPublico | undefined {
  return ANAMNESE_AVATARES_PUBLICOS.find(a => a.id === id)
}
