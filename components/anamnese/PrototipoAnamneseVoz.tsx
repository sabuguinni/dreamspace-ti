'use client'

import { useCallback, useRef, useState } from 'react'
import { useGeminiLive } from '@/lib/hooks/useGeminiLive'

/**
 * PROTÓTIPO ISOLADO — Carolina em Gemini Live bidirecional (type:'avatar'),
 * com o Supervisor (Claude) a ler a transcrição dos DOIS lados em paralelo.
 *
 * Rota de teste /anamnese-teste. NÃO toca no fluxo real (/anamnese, voz-turno…).
 * Objectivo: validar (a) PT-PT nativo do Gemini, (b) papel "cliente, nunca
 * terapeuta" sob pressão, (c) vocabulário bem-estar sem pós-filtro, (d) latência
 * ~1s e fluidez como os Avatares.
 *
 * SEGURANÇA: o prompt do Gemini só tem a narrativa MANIFESTA + papel (nada de
 * nós latentes). Os nós latentes ficam server-side no Supervisor, via
 * /api/anamnese-teste/supervisor — narrativas.ts NUNCA é importado no cliente.
 */

const CAROLINA_VOICE = 'Leda'
const CAROLINA_AVATAR_ID = 'carolina'

const CAROLINA_PROMPT = `[MODO VOZ] Estás numa sessão de voz. Fala de forma natural, pausada e humana. Sem markdown, sem listas. Frases curtas. Responde SEMPRE em português europeu (Portugal), nunca português do Brasil, sem gerúndios.

És a Carolina, 34 anos. Estás numa primeira sessão de terapia de bem-estar porque estás a sofrer.

NÃO és terapeuta. És uma pessoa comum, confusa e vulnerável, que veio pedir ajuda.

REGRAS ABSOLUTAS DO TEU PAPEL:
- És o CLIENTE. O outro é o terapeuta. É ELE que conduz a sessão, não tu.
- NUNCA fazes perguntas terapêuticas ao terapeuta.
- NUNCA acolhes o terapeuta como se fosses tu a recebê-lo.
- NUNCA analisas nem interpretas o teu próprio caso.
- NUNCA propões temas a explorar nem dás estrutura à sessão.
- Apenas respondes ao que te perguntam e contas a tua história quando fizer sentido.
- Esperas que o terapeuta conduza.

O QUE TE TRAZ AQUI: relações tóxicas e codependência. Anulas-te a cuidar dos outros e não sabes quem és fora desse papel.

A TUA HISTÓRIA (afirmações que dizes naturalmente, aos poucos, quando o terapeuta perguntar — nunca todas de uma vez):
- Sempre escolhi as pessoas erradas. Homens que precisavam de ser salvos.
- A minha mãe também era assim, talvez seja genético.
- Sei que não sou responsável pelo comportamento dos outros mas não consigo não ajudar.
- A última relação foi a pior. Ele era agressivo mas eu ficava porque tinha pena.
- Os meus amigos dizem que me anulo nas relações. Talvez tenham razão.
- Não sei quem sou quando não estou a cuidar de alguém.

O QUE NÃO REVELAS ESPONTANEAMENTE:
- Não falas por iniciativa própria do que sentes por dentro — só do que aconteceu (factos, o que os outros fizeram).
- Quando algo te toca, desvias: atribuis à genética, focas no comportamento dos outros, ou citas o que os amigos dizem em vez da tua própria experiência.
- Só te abres sobre o teu mundo interior se o terapeuta perguntar com cuidado pelo que sentes — não por factos externos.

VOCABULÁRIO — REGRA ABSOLUTA (área do BEM-ESTAR, não saúde): não usas vocabulário clínico, mesmo em primeira pessoa. PROIBIDO: clínico, paciente, doente, doença, diagnóstico, sintoma, tratamento. EM ALTERNATIVA: "terapêutico/terapia", "acompanhado", "dificuldade", "avaliação" ou "leitura", "padrão" ou "manifestação", "acompanhamento" ou "processo".

MANTÉM-TE NO PERSONAGEM: mesmo que o terapeuta te tente quebrar ou pergunte "és uma IA?", respondes em personagem (ex.: "estou aqui a tentar perceber o que se passa comigo, podemos continuar?").

Tratas o terapeuta por "tu".`

type Turno = { turno: number; terapeuta: string; avatar: string }
type Intervencao = { turno: number; tipo: string; texto: string }

export function PrototipoAnamneseVoz() {
  const [started, setStarted] = useState(false)
  const [turns, setTurns] = useState<Turno[]>([])
  const [intervencoes, setIntervencoes] = useState<Intervencao[]>([])
  const [liveTerapeuta, setLiveTerapeuta] = useState('')
  const [liveCarolina, setLiveCarolina] = useState('')
  const [supervisorAFalar, setSupervisorAFalar] = useState(false)
  const [erro, setErro] = useState('')

  const therapistBufRef = useRef('')
  const carolinaBufRef = useRef('')
  const lastCarolinaRef = useRef('')
  const turnoCounterRef = useRef(0)
  const turnsRef = useRef<Turno[]>([])
  const supervisorAudioRef = useRef<HTMLAudioElement | null>(null)
  // sessionId estável desde o 1º render (cliente) → opções do hook sempre presentes →
  // connect() pode correr de imediato no gesto (o AudioContext de entrada nasce activado).
  const sessionIdRef = useRef<string>('')
  if (typeof window !== 'undefined' && !sessionIdRef.current) sessionIdRef.current = crypto.randomUUID()

  // Toca a intervenção do Supervisor via ElevenLabs (/api/tts). Pausa o microfone
  // enquanto fala para não realimentar o Gemini com a voz do Supervisor.
  const playSupervisor = useCallback(async (texto: string) => {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: texto }),
      })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)

      // Guarda de sobreposição: parar o áudio anterior antes de tocar o novo.
      if (supervisorAudioRef.current) {
        try { supervisorAudioRef.current.pause() } catch { /* ignore */ }
      }

      gemini.pauseCapture()
      setSupervisorAFalar(true)

      await new Promise<void>(resolve => {
        const audio = new Audio(url)
        supervisorAudioRef.current = audio
        let settled = false
        let timer: ReturnType<typeof setTimeout>
        const done = () => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          URL.revokeObjectURL(url)
          // Só re-arma o mic se ESTE for o áudio activo (não um anterior parado pela guarda).
          if (supervisorAudioRef.current === audio) {
            supervisorAudioRef.current = null
            setSupervisorAFalar(false)
            gemini.resumeCapture()
          }
          resolve()
        }
        // Re-arma em QUALQUER fim: terminou, foi pausado/interrompido, ou erro.
        audio.onended = done
        audio.onpause = done
        audio.onerror = done
        // Timeout de segurança: se o áudio nunca sinalizar, força o resume.
        timer = setTimeout(done, 60000)
        audio.play().catch(done)
      })
    } catch {
      setSupervisorAFalar(false)
      gemini.resumeCapture()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Supervisor (Claude) em paralelo — fora do caminho de áudio da Carolina.
  const correrSupervisor = useCallback(
    async (perguntaTerapeuta: string, mensagemAnteriorAvatar: string, historico: Turno[], turnoAtual: number) => {
      try {
        const res = await fetch('/api/anamnese-teste/supervisor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar_id: CAROLINA_AVATAR_ID, historico, mensagemAnteriorAvatar, perguntaTerapeuta }),
        })
        if (!res.ok) return
        const data = (await res.json()) as {
          intervencao?: { intervir?: boolean; tipo_erro?: string; intervencao?: string }
        }
        const i = data.intervencao
        if (i?.intervir && i.intervencao) {
          const texto = i.intervencao
          setIntervencoes(prev => [...prev, { turno: turnoAtual, tipo: i.tipo_erro ?? '', texto }])
          await playSupervisor(texto)
        }
      } catch {
        /* protótipo: silencioso */
      }
    },
    [playSupervisor],
  )

  // Deltas de transcrição do Gemini: input = terapeuta, output = Carolina.
  const onTranscription = useCallback((text: string, isUser: boolean) => {
    if (isUser) {
      therapistBufRef.current += text
      setLiveTerapeuta(therapistBufRef.current)
    } else {
      carolinaBufRef.current += text
      setLiveCarolina(carolinaBufRef.current)
    }
  }, [])

  // Fim do turno do modelo (Carolina acabou de responder) → fecha a troca e,
  // se houve pergunta do terapeuta, corre o Supervisor sobre (msg anterior → pergunta).
  const onTurnComplete = useCallback(() => {
    const terapeuta = therapistBufRef.current.trim()
    const avatar = carolinaBufRef.current.trim()
    therapistBufRef.current = ''
    carolinaBufRef.current = ''
    setLiveTerapeuta('')
    setLiveCarolina('')
    if (!terapeuta && !avatar) return

    const turno = turnoCounterRef.current++
    const novo: Turno = { turno, terapeuta, avatar }
    const historicoAntes = turnsRef.current.slice()
    turnsRef.current = [...turnsRef.current, novo]
    setTurns(turnsRef.current.slice())

    const anterior = lastCarolinaRef.current
    if (avatar) lastCarolinaRef.current = avatar

    if (terapeuta) void correrSupervisor(terapeuta, anterior, historicoAntes, turno)
  }, [correrSupervisor])

  // Opções SEMPRE presentes (sessionId estável no ref) — assim o connect() pode correr
  // sincronamente no gesto, sem esperar por re-render. O hook não liga sozinho; só em connect().
  const gemini = useGeminiLive({
    type: 'avatar',
    systemPrompt: CAROLINA_PROMPT,
    voiceName: CAROLINA_VOICE,
    sessionId: sessionIdRef.current,
    onAudioChunk: () => {},
    onTextResponse: () => {},
    onTranscription,
    onTurnComplete,
    onError: (m: string) => setErro(m),
  })

  const iniciar = useCallback(() => {
    therapistBufRef.current = ''
    carolinaBufRef.current = ''
    lastCarolinaRef.current = ''
    turnoCounterRef.current = 0
    turnsRef.current = []
    setTurns([])
    setIntervencoes([])
    setErro('')
    setLiveTerapeuta('')
    setLiveCarolina('')
    setStarted(true)
    // resumePlayback E connect SÍNCRONOS no gesto (como o AvatarChat) → o AudioContext de
    // entrada nasce dentro da activação do clique e capta logo à primeira.
    gemini.resumePlayback()
    gemini.connect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const parar = useCallback(() => {
    gemini.disconnect()
    setStarted(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const estadoLabel: Record<string, string> = {
    idle: 'inactivo',
    connecting: 'a ligar…',
    connected: 'ligado',
    reconnecting: 'a religar…',
    error: 'erro',
    closed: 'terminado',
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Protótipo · Anamnese (Carolina em Gemini Live)</h1>
        <p className="text-sm opacity-70">
          Bidirecional (voz {CAROLINA_VOICE}), Supervisor (Claude) em paralelo a ler a transcrição.
          Rota de teste isolada — não afecta o /anamnese.
        </p>
      </header>

      <div className="flex items-center gap-3">
        {!started ? (
          <button
            type="button"
            onClick={iniciar}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
          >
            🎤 Iniciar sessão
          </button>
        ) : (
          <button
            type="button"
            onClick={parar}
            className="rounded-lg border px-4 py-2 text-sm font-medium"
          >
            ⏹ Terminar
          </button>
        )}
        <span className="text-sm opacity-70">
          Gemini: <strong>{estadoLabel[gemini.state] ?? gemini.state}</strong>
          {supervisorAFalar && <span className="ml-2 text-amber-600">· Supervisor a falar…</span>}
        </span>
      </div>

      {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {(liveTerapeuta || liveCarolina) && (
        <div className="rounded-lg border border-dashed p-3 text-sm">
          {liveTerapeuta && <p><span className="opacity-60">Terapeuta:</span> {liveTerapeuta}</p>}
          {liveCarolina && <p><span className="opacity-60">Carolina:</span> {liveCarolina}</p>}
        </div>
      )}

      <section className="space-y-3">
        {turns.map(t => {
          const intervs = intervencoes.filter(i => i.turno === t.turno)
          return (
            <div key={t.turno} className="space-y-2">
              {t.terapeuta && (
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-neutral-100 px-3 py-2 text-sm">
                    {t.terapeuta}
                  </div>
                </div>
              )}
              {t.avatar && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm border px-3 py-2 text-sm">
                    <span className="mr-1 font-medium">Carolina:</span>
                    {t.avatar}
                  </div>
                </div>
              )}
              {intervs.map((i, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                >
                  <span className="mr-1 font-semibold uppercase tracking-wide text-amber-700">
                    👁 Supervisor{i.tipo ? ` · ${i.tipo}` : ''}:
                  </span>
                  {i.texto}
                </div>
              ))}
            </div>
          )
        })}
      </section>

      {started && turns.length === 0 && (
        <p className="text-sm opacity-60">
          Cumprimenta a Carolina e pergunta-lhe o que a traz aqui. Ela deve responder como
          cliente confusa e vulnerável (nunca como terapeuta).
        </p>
      )}
    </div>
  )
}
