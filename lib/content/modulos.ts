export interface ModuloInfo {
  numero: number
  titulo: string
  subtitulo: string
  publicado: boolean
}

export const MODULOS: ModuloInfo[] = [
  {
    numero: 1,
    titulo: 'Neurociência do Sonho',
    subtitulo: 'O que acontece no cérebro enquanto sonhamos',
    publicado: true,
  },
  {
    numero: 2,
    titulo: 'A Linguagem dos Símbolos',
    subtitulo: 'Arquétipos, imagens e o vocabulário onírico',
    publicado: false,
  },
  {
    numero: 3,
    titulo: 'Jung e o Inconsciente',
    subtitulo: 'Amplificação, sombra e processo de individuação',
    publicado: true,
  },
  {
    numero: 4,
    titulo: 'Freud e a Associação Livre',
    subtitulo: 'O método da associação livre aplicado ao sonho',
    publicado: false,
  },
  {
    numero: 5,
    titulo: 'Hillman e o Imaginal',
    subtitulo: 'Habitar a imagem sem a traduzir',
    publicado: false,
  },
  {
    numero: 6,
    titulo: 'Sonhos de Visita e Luto',
    subtitulo: 'Quando o sonho faz o trabalho que a vigília não consegue',
    publicado: false,
  },
  {
    numero: 7,
    titulo: 'Trabalho com Pesadelos',
    subtitulo: 'Transformar o terror nocturno em recurso terapêutico',
    publicado: false,
  },
  {
    numero: 8,
    titulo: 'Sonhos Recorrentes',
    subtitulo: 'Mensagens persistentes do inconsciente',
    publicado: false,
  },
  {
    numero: 9,
    titulo: 'Sonhos Lúcidos',
    subtitulo: 'Consciência dentro do sonho como prática terapêutica',
    publicado: false,
  },
]
