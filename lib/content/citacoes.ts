export interface Citacao {
  texto: string
  autor: string
  obra: string
}

export const CITACOES: Citacao[] = [
  {
    texto: 'A interpretação dos sonhos é a via régia para o conhecimento do inconsciente.',
    autor: 'Freud',
    obra: 'A Interpretação dos Sonhos',
  },
  {
    texto: 'O sonho é a pequena porta escondida no recanto mais profundo da alma.',
    autor: 'Jung',
    obra: 'A Realidade da Alma',
  },
  {
    texto: 'Stick with the image. Stay with the dream.',
    autor: 'Hillman',
    obra: 'The Dream and the Underworld',
  },
  {
    texto: 'O sonho não é um código a decifrar, é uma imagem a habitar.',
    autor: 'Hillman',
    obra: 'Re-Visioning Psychology',
  },
  {
    texto: 'Não interpretes o sonho. Deixa o sonho interpretar-te.',
    autor: 'Bosnak',
    obra: 'Embodiment',
  },
  {
    texto: 'O corpo sabe o que a cabeça ainda não consegue dizer.',
    autor: 'Gendlin',
    obra: 'Focusing',
  },
  {
    texto: 'Todo o sonho não interpretado é como uma carta não lida.',
    autor: 'Talmude',
    obra: 'Berakhot 55a',
  },
  {
    texto: 'A imagem onírica não é um significado, é uma presença.',
    autor: 'Corbin',
    obra: 'Mundus Imaginalis',
  },
  {
    texto: 'O sonho é o teatro onde o sonhador é simultaneamente palco, actor, autor e plateia.',
    autor: 'Jung',
    obra: 'Carta a Pierre Janet',
  },
  {
    texto: 'A noite tem mil olhos.',
    autor: 'Bourdillon',
    obra: '',
  },
]

export function getCitacaoDoDia(): Citacao {
  const hoje = new Date()
  const diaDoAno = Math.floor(
    (hoje.getTime() - new Date(hoje.getFullYear(), 0, 0).getTime()) / 86400000
  )
  return CITACOES[diaDoAno % CITACOES.length]
}
