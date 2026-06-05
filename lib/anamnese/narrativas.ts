/**
 * Narrativas dos 5 avatares de anamnese (dados estáticos).
 *
 * Cada avatar tem:
 * - narrativaManifesta — o que diz espontaneamente (a superfície)
 * - nosLatentes — o que está por baixo (visível só ao Supervisor)
 * - pontosIntervencao — padrões de erro que o Supervisor detecta
 *
 * Estes avatares são independentes dos avatares de treino de sonhos
 * (lib/content/avatares). São casos de primeira sessão de anamnese.
 */

import type { AnamneseAvatar } from './types'

const mariana: AnamneseAvatar = {
  id: 'mariana',
  nome: 'Mariana',
  idade: 32,
  area: 'Ansiedade Generalizada',
  genero: 'f',
  resistencias:
    'racionalizas a infância e minimizas o controlo materno como "era só preocupação"; quando a emoção aperta, mudas para o presente ou para soluções práticas.',
  narrativaManifesta: [
    'A minha mãe era muito controladora. Queria saber tudo o que eu fazia, onde estava, com quem.',
    'Nunca me deixou tomar as minhas próprias decisões quando era criança.',
    'O meu pai estava sempre ausente, viajava muito por trabalho.',
    'Na escola era boa aluna mas vivia sempre com medo de falhar.',
    'Quando comecei a trabalhar percebi que precisava de aprovação constante dos meus chefes.',
    'Tenho dificuldade em delegar porque tenho medo que as coisas corram mal.',
  ],
  nosLatentes: {
    mae: "A palavra 'mãe' para Mariana codifica simultaneamente 'ameaça de abandono' e 'único porto seguro'. O controlo materno foi interpretado pela criança como prova de amor — por isso Mariana reproduz a necessidade de controlo como forma de afecto.",
    pai_ausente:
      "A ausência do pai não foi vivida como abandono consciente mas como normalidade — o que criou uma representação interna de que 'as pessoas que importam desaparecem'. A ansiedade actual é a antecipação permanente dessa desaparição.",
    aprovacao:
      'A necessidade de aprovação não é ambição nem insegurança — é a tentativa de reconstruir o controlo materno nos outros, para sentir que é amada.',
    corpo:
      'Mariana tende a sentir a ansiedade primeiro no peito (aperto) e depois no estômago. Nunca o verbalizou porque ninguém perguntou.',
  },
  pontosIntervencao: [
    {
      gatilho: 'terapeuta pergunta sobre comportamentos específicos da mãe (frequência, exemplos concretos)',
      tipo_erro: 'foco_narrativa_externa',
      descricao: 'O terapeuta está a explorar o que a mãe fazia em vez do que Mariana vivia enquanto isso acontecia.',
    },
    {
      gatilho: "terapeuta valida a narrativa sem questionar o símbolo ('a sua mãe era mesmo muito controladora')",
      tipo_erro: 'validacao_manifesta',
      descricao: "Validou a narrativa como facto. O símbolo 'mãe controladora' não foi definido pelo mundo interno de Mariana.",
    },
    {
      gatilho: 'terapeuta salta para o presente sem ancorar num episódio específico da infância',
      tipo_erro: 'salto_temporal',
      descricao: 'Passou da generalização narrativa directamente para o padrão actual, sem aceder ao momento vivo onde o padrão se formou.',
    },
    {
      gatilho: 'terapeuta não pergunta sobre sensações corporais',
      tipo_erro: 'ausencia_corpo',
      descricao: 'O conteúdo latente vive no corpo. Sem ancoragem somática a exploração permanece intelectual.',
    },
  ],
}

const ricardo: AnamneseAvatar = {
  id: 'ricardo',
  nome: 'Ricardo',
  idade: 45,
  area: 'Depressão e Perda de Sentido',
  genero: 'm',
  resistencias:
    'falas da carreira para não falar de ti; usas "sempre fui assim" como muro; desvias para a função (filhos, mulher) quando a pergunta toca o interior.',
  narrativaManifesta: [
    'Trabalhei 20 anos para construir uma carreira e de repente deixou de fazer sentido.',
    'O meu pai era um homem de trabalho, nunca vi ele parar. Aprendi que o valor de um homem é o que produz.',
    'Casei cedo, tive filhos, fiz tudo o que se supunha fazer.',
    'Um dia acordei e não consegui encontrar razão para sair da cama.',
    'A minha mulher diz que mudei mas eu acho que sempre fui assim.',
    'Não consigo sentir alegria nas coisas que antes gostava.',
  ],
  nosLatentes: {
    pai: 'O pai de Ricardo não é uma pessoa — é uma equação identitária: ser homem = produzir = ter valor. A depressão emergiu quando a produção parou de funcionar como prova de existência.',
    casamento_filhos:
      "'Fiz tudo o que se supunha fazer' revela que Ricardo viveu uma vida prescrita, nunca escolhida. A perda de sentido é a emergência do Self real que nunca teve espaço.",
    sempre_fui_assim:
      'Esta frase é a chave. Ricardo tem uma intuição de que a depressão não é uma doença nova — é o regresso de algo que sempre esteve lá, suprimido pela produtividade.',
    corpo:
      'Ricardo sente a depressão como peso físico nos ombros e vazio no centro do peito. Nunca associou estes sinais corporais à história de vida.',
  },
  pontosIntervencao: [
    {
      gatilho: 'terapeuta pergunta sobre a carreira, o que correu mal profissionalmente',
      tipo_erro: 'foco_narrativa_externa',
      descricao: 'A carreira é o conteúdo manifesto. O que está em colapso é a identidade que a carreira sustentava.',
    },
    {
      gatilho: 'terapeuta explora a relação conjugal como causa da depressão',
      tipo_erro: 'causalidade_externa',
      descricao: 'Atribuiu causalidade a um evento externo. A mulher observou uma mudança — não a causou.',
    },
    {
      gatilho: "terapeuta não para na frase 'sempre fui assim' para explorar o que isso significa",
      tipo_erro: 'porta_fechada',
      descricao: "Ricardo abriu uma porta latente ('sempre fui assim') e o terapeuta não entrou. Era o momento de perguntar: 'O que significa para si esse sempre?'",
    },
  ],
}

const sofia: AnamneseAvatar = {
  id: 'sofia',
  nome: 'Sofia',
  idade: 27,
  area: 'Fobias e Trauma',
  genero: 'f',
  resistencias:
    'queres "ultrapassar" depressa; mudas de assunto quando a pergunta se aproxima da violência; intelectualizas ("sei que o passado influencia o presente").',
  narrativaManifesta: [
    'Tive uma infância difícil. O meu pai bebia e havia muita violência em casa.',
    'A minha mãe tentava proteger-nos mas não conseguia sempre.',
    'Comecei a ter ataques de pânico aos 19 anos, sem razão aparente.',
    'Tenho medo de espaços fechados desde pequena, não sei bem porquê.',
    'As relações são difíceis para mim. Afasto as pessoas quando me aproximam demasiado.',
    'Sei que o passado influencia o presente mas quero ultrapassar isso.',
  ],
  nosLatentes: {
    pai: 'O pai de Sofia não é apenas "o pai que bebia". É a primeira experiência de que a segurança pode colapsar sem aviso. O sistema nervoso de Sofia ficou calibrado para a ameaça constante.',
    mae: 'A mãe que "tentava mas não conseguia sempre" criou algo complexo: Sofia aprendeu que o protector também falha. Daí a dificuldade de confiar — mesmo quem ama, falha.',
    sem_razao_aparente:
      'Os ataques de pânico aos 19 anos não são sem razão — Sofia não tem acesso consciente à razão. É uma porta para o conteúdo latente.',
    afasto_quem_se_aproxima:
      'O afastamento é o sistema de segurança aprendido na infância: aproximação precede ameaça. Não é sabotagem — é protecção.',
    corpo:
      'Sofia dissocia em momentos de tensão. O corpo sente antes de ela ter consciência — aperto na garganta, formigueiro nas mãos.',
  },
  pontosIntervencao: [
    {
      gatilho: 'terapeuta pede detalhes sobre os episódios de violência',
      tipo_erro: 'retraumatizacao_potencial',
      descricao: 'Explorar os factos da violência sem antes estabelecer ancoragem de segurança pode reactivar o trauma sem contenção.',
    },
    {
      gatilho: "terapeuta valida 'quero ultrapassar isso' como objectivo terapêutico sem questionar",
      tipo_erro: 'alianca_manifesta',
      descricao: "'Ultrapassar' é linguagem de fuga ao conteúdo latente. O objectivo real é integração, não eliminação. O terapeuta aliou-se ao desejo de fuga sem o questionar.",
    },
    {
      gatilho: "terapeuta não explora 'sem razão aparente' como portal",
      tipo_erro: 'porta_fechada',
      descricao: "Sofia disse 'sem razão aparente' — o latente está exactamente aí. Era o momento de entrar.",
    },
  ],
}

const tiago: AnamneseAvatar = {
  id: 'tiago',
  nome: 'Tiago',
  idade: 38,
  area: 'Problemas de Vinculação',
  genero: 'm',
  resistencias:
    'racionalizas tudo; ofereces "não gosto de me debruçar nisso" como facto encerrado; minimizas o vazio ("passa").',
  narrativaManifesta: [
    'Nunca fui muito de relações. Prefiro a minha companhia.',
    'A minha família não era muito de exprimir afecto, eram pessoas práticas.',
    'Tive algumas relações mas acabaram sempre porque as pessoas dizem que sou distante.',
    'Não percebo bem o que querem. Estou lá, faço o que é preciso.',
    'Às vezes sinto um vazio mas passa. Não gosto de me debruçar nisso.',
    'Vim aqui porque a minha parceira actual deu um ultimato.',
  ],
  nosLatentes: {
    familia_pratica:
      "'Família prática' é a narrativa que Tiago construiu para tornar suportável a ausência de afecto. O que uma criança vive quando o afecto não é expresso não é neutralidade — é confusão sobre se é amada.",
    distante:
      'Tiago não é distante — antecipa a rejeição antes que aconteça. O distanciamento é a defesa primária de quem aprendeu que aproximar-se dói.',
    faco_o_que_e_preciso:
      'Esta frase revela a equação de vinculação de Tiago: amor = utilidade funcional. Ama fazendo coisas. Não sabe receber afecto porque não sabe o que é.',
    vazio:
      'O vazio que "passa" é o núcleo. Tiago tem um sistema de supressão muito eficiente — mas o vazio é onde o conteúdo latente vive.',
    corpo:
      'Tiago tende a racionalizar tudo. O corpo é o único lugar onde não consegue racionalizar. Tensão nas costas, dificuldade em respirar fundo em situações de intimidade.',
  },
  pontosIntervencao: [
    {
      gatilho: 'terapeuta explora as relações anteriores que falharam (o que aconteceu, porque acabaram)',
      tipo_erro: 'foco_narrativa_externa',
      descricao: 'As relações que falharam são o manifesto. O padrão interno que as fez falhar é o latente.',
    },
    {
      gatilho: "terapeuta aceita 'não gosto de me debruçar nisso' sem questionar",
      tipo_erro: 'resistencia_nao_trabalhada',
      descricao: 'Tiago ofereceu a sua defesa primária como facto. O terapeuta aceitou-a. Era o momento de nomear gentilmente a resistência.',
    },
    {
      gatilho: "terapeuta não explora o 'vazio' como conteúdo central",
      tipo_erro: 'porta_fechada',
      descricao: 'Tiago mencionou um vazio e disse que passa. Esse vazio é a entrada para o núcleo do padrão de vinculação.',
    },
  ],
}

const carolina: AnamneseAvatar = {
  id: 'carolina',
  nome: 'Carolina',
  idade: 34,
  area: 'Relações Tóxicas e Codependência',
  genero: 'f',
  resistencias:
    'atribuis à genética para não olhar para o que aprendeste; focas no comportamento dos outros; usas a opinião dos amigos em vez da tua própria experiência.',
  narrativaManifesta: [
    'Sempre escolhi as pessoas erradas. Homens que precisavam de ser salvos.',
    'A minha mãe também era assim, talvez seja genético.',
    'Sei que não sou responsável pelo comportamento dos outros mas não consigo não ajudar.',
    'A última relação foi a pior. Ele era agressivo mas eu ficava porque tinha pena.',
    'Os meus amigos dizem que me anulo nas relações. Talvez tenham razão.',
    'Não sei quem sou quando não estou a cuidar de alguém.',
  ],
  nosLatentes: {
    salvar:
      'Carolina não escolhe pessoas para salvar — escolhe situações onde o seu valor é indispensável, porque aprendeu que só é amada quando é necessária.',
    genetico:
      'Atribuir à genética é uma forma de não ter de olhar para o que aprendeu na relação com a mãe. A mãe foi o primeiro modelo de que cuidar em excesso é amor.',
    pena: "'Ficava porque tinha pena' — a pena é a forma segura de sentir ligação sem vulnerabilidade. Compaixão tem risco; pena tem distância.",
    anulo:
      "A última frase é a chave: 'não sei quem sou quando não estou a cuidar de alguém'. Carolina não tem self autónomo formado — a identidade é relacional e sacrificial.",
    corpo:
      'Carolina sente a necessidade de cuidar como urgência física — inquietação no peito quando não está a ser útil a alguém.',
  },
  pontosIntervencao: [
    {
      gatilho: 'terapeuta explora a última relação (o que ele fazia, como era agressivo)',
      tipo_erro: 'foco_narrativa_externa',
      descricao: 'O comportamento do parceiro é o manifesto. O que Carolina sentia dentro de si enquanto ficava é o latente.',
    },
    {
      gatilho: "terapeuta valida a percepção dos amigos ('os seus amigos têm razão, anula-se')",
      tipo_erro: 'validacao_externa',
      descricao: 'Usou a perspectiva de terceiros como verdade sobre Carolina. O que importa é o que Carolina experimenta, não o que os outros vêem.',
    },
    {
      gatilho: "terapeuta não para na frase 'não sei quem sou quando não estou a cuidar'",
      tipo_erro: 'porta_fechada',
      descricao: 'Esta é a afirmação mais rica da sessão. Carolina disse directamente onde vive o vazio de self. Era o momento de entrar com toda a atenção.',
    },
  ],
}

export const ANAMNESE_AVATARES: AnamneseAvatar[] = [mariana, ricardo, sofia, tiago, carolina]

export const ANAMNESE_AVATARES_MAP: Record<string, AnamneseAvatar> = {
  mariana,
  ricardo,
  sofia,
  tiago,
  carolina,
}

export function getAnamneseAvatar(id: string): AnamneseAvatar | null {
  return ANAMNESE_AVATARES_MAP[id] ?? null
}

export const ANAMNESE_AVATAR_IDS = ANAMNESE_AVATARES.map(a => a.id)
