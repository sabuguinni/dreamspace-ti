export interface SecaoModulo {
  id: string
  titulo: string
}

export interface ConfigModulo {
  titulo: string
  subtitulo: string
  duracao: string
  numCasos: number
  disponivel: boolean
  secoes: SecaoModulo[]
  anterior?: string
  seguinte?: string
}

export const MODULOS_CONFIG: Record<string, ConfigModulo> = {
  'modulo-1': {
    titulo: 'Neurociência do Sonho',
    subtitulo: 'Como o cérebro produz e usa os sonhos',
    duracao: '3–4 horas',
    numCasos: 3,
    disponivel: true,
    seguinte: 'modulo-3',
    secoes: [
      { id: 'introdução', titulo: 'Introdução' },
      { id: 'arquitectura-do-sono', titulo: 'Arquitectura do Sono' },
      { id: 'substrato-neurológico', titulo: 'Substrato Neurológico' },
      { id: 'teorias-funcionais', titulo: 'Teorias Funcionais' },
      { id: 'fronteiras-psicológicas', titulo: 'Fronteiras Psicológicas' },
      { id: 'diário-de-sonhos', titulo: 'Diário de Sonhos' },
      { id: 'exercícios', titulo: 'Exercícios' },
      { id: 'questionário', titulo: 'Questionário' },
      { id: 'síntese', titulo: 'Síntese' },
    ],
  },
  'modulo-3': {
    titulo: 'A Abordagem Junguiana',
    subtitulo: 'Arquétipos, Sombra e individuação',
    duracao: '4–5 horas',
    numCasos: 6,
    disponivel: true,
    anterior: 'modulo-1',
    secoes: [
      { id: 'introdução', titulo: 'Introdução' },
      { id: 'inconsciente-colectivo', titulo: 'Inconsciente Colectivo' },
      { id: 'arquétipos-principais', titulo: 'Arquétipos Principais' },
      { id: 'função-compensatória', titulo: 'Função Compensatória' },
      { id: 'amplificação', titulo: 'Amplificação' },
      { id: 'séries-de-sonhos', titulo: 'Séries de Sonhos' },
      { id: 'imaginação-activa', titulo: 'Imaginação Activa' },
      { id: 'exercícios', titulo: 'Exercícios' },
      { id: 'questionário', titulo: 'Questionário' },
      { id: 'síntese', titulo: 'Síntese' },
    ],
  },
}

export const TODOS_MODULOS = [
  { slug: 'modulo-1', numero: 'I',    titulo: 'Neurociência do Sonho',         subtitulo: 'Como o cérebro produz e usa os sonhos',         duracao: '3–4 h', casos: 3, disponivel: true  },
  { slug: 'modulo-2', numero: 'II',   titulo: 'Freud e a Associação Livre',     subtitulo: 'O sonho como via régia ao inconsciente',         duracao: '3 h',   casos: 2, disponivel: false },
  { slug: 'modulo-3', numero: 'III',  titulo: 'A Abordagem Junguiana',          subtitulo: 'Arquétipos, Sombra e individuação',              duracao: '4–5 h', casos: 6, disponivel: true  },
  { slug: 'modulo-4', numero: 'IV',   titulo: 'Adler e o Sonho Social',         subtitulo: 'O sonho como ensaio do futuro',                  duracao: '2 h',   casos: 0, disponivel: false },
  { slug: 'modulo-5', numero: 'V',    titulo: 'Gestalt e o Sonho',              subtitulo: 'O sonho como teatro do self',                    duracao: '3 h',   casos: 0, disponivel: false },
  { slug: 'modulo-6', numero: 'VI',   titulo: 'Focusing e Gendlin',             subtitulo: 'O corpo que sonha',                              duracao: '2–3 h', casos: 0, disponivel: false },
  { slug: 'modulo-7', numero: 'VII',  titulo: 'Hillman — Psicologia Arquetípica', subtitulo: 'O sonho como imagem viva',                   duracao: '3 h',   casos: 0, disponivel: false },
  { slug: 'modulo-8', numero: 'VIII', titulo: 'Abordagens de Grupo',            subtitulo: 'Ullman, Taylor e o sonho partilhado',            duracao: '2 h',   casos: 0, disponivel: false },
  { slug: 'modulo-9', numero: 'IX',   titulo: 'Integração Prática',             subtitulo: 'Construir a tua abordagem própria',              duracao: '4 h',   casos: 4, disponivel: false },
]
