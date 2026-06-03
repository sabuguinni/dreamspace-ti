'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getAnamneseAvatarPublico } from '@/lib/anamnese/avataresPublicos'
import { useGeminiLive } from '@/lib/hooks/useGeminiLive'
import { BlocoSupervisorAnamnese } from './BlocoSupervisorAnamnese'
import { RelatorioAnamneseView } from './RelatorioAnamnese'
import { Button } from '@/components/ui/button'
import type { SessaoAnamnese, TurnoConversa, RelatorioAnamnese, IntervencaoResult } from '@/lib/anamnese/types'

interface Props {
  sessao: SessaoAnamnese
}

type SpeakingRole = 'cliente' | 'supervisor' | null
type VoiceCfg = { systemPrompt: string; voiceName: string; aberturaTrigger: string }

const VOICE_KEY = 'anamnese_voice_enabled'

export function ChatAnamnese({ sessao }: Props) {
  const router = useRouter()
  const avatar = getAnamneseAvatarPublico(sessao.avatar_id)
  const cor = avatar?.cor ?? 'oklch(0.45 0.1 250)'
  const voz = avatar?.voz ?? 'Kore'

  const [turns, setTurns] = useState<TurnoConversa[]>(
    [...(sessao.historico_conversa ?? [])].sort((a, b) => a.turno - b.turno),
  )
  const [input, setInput] = useState('')
  const [pendingTerapeuta, setPendingTerapeuta] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [relatorio, setRelatorio] = useState<RelatorioAnamnese | null>(sessao.relatorio ?? null)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [mostrarConfirmConcluir, setMostrarConfirmConcluir] = useState(false)
  const [mostrarConfirmApagar, setMostrarConfirmApagar] = useState(false)

  // ── Voz (Gemini Live bidirecional — a Carolina é o Gemini) ───────────────────
  const [voiceEnabled, setVoiceEnabled] = useState(
    () => sessao.modo === 'voz' || (typeof window !== 'undefined' && localStorage.getItem(VOICE_KEY) === 'true'),
  )
  const [voiceCfg, setVoiceCfg] = useState<VoiceCfg | null>(null) // persona+voz, server-side (sem nós latentes)
  const [speakingRole, setSpeakingRole] = useState<SpeakingRole>(null)
  const [liveUserSpeech, setLiveUserSpeech] = useState('')
  const [voiceErro, setVoiceErro] = useState('')
  const [supervisorPensandoTurno, setSupervisorPensandoTurno] = useState<number | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null) // áudio pontual (Supervisor / replays)
  // Segmentação de turnos a partir da transcrição do Gemini (input=terapeuta, output=Carolina)
  const therapistBufRef = useRef('')
  const carolinaBufRef = useRef('')
  const turnStartRef = useRef(0) // relógio do turno (→ duracao_segundos p/ débito gemini_live)
  const aberturaEnviadaRef = useRef(false) // envia o trigger de abertura uma só vez
  const turnsRef = useRef<TurnoConversa[]>(turns)

  const concluida = sessao.estado === 'concluida' || relatorio !== null

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const startRef = useRef<number>(new Date(sessao.created_at).getTime() || Date.now())

  useEffect(() => { turnsRef.current = turns }, [turns])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, pendingTerapeuta, relatorio, isGeneratingReport, liveUserSpeech])

  useEffect(() => {
    return () => { audioRef.current?.pause(); audioRef.current = null }
  }, [])

  // ── TTS pontual (voz do Supervisor + replays) ────────────────────────────────
  const speak = useCallback(async (endpoint: string, payload: Record<string, unknown>, role: SpeakingRole, onStart?: () => void) => {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.status === 402) {
        toast.warning('Saldo insuficiente para voz. Recarrega créditos na página Créditos.')
        return
      }
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      if (audioRef.current) audioRef.current.pause() // guarda de sobreposição
      await new Promise<void>(resolve => {
        const audio = new Audio(url)
        audioRef.current = audio
        setSpeakingRole(role)
        let settled = false
        let started = false
        let timer: ReturnType<typeof setTimeout>
        const finish = () => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          URL.revokeObjectURL(url)
          if (audioRef.current === audio) { audioRef.current = null; setSpeakingRole(null) }
          resolve()
        }
        audio.onplaying = () => { if (!started) { started = true; onStart?.() } } // texto sincronizado com o início real da fala
        audio.onended = finish
        audio.onpause = finish
        audio.onerror = finish
        timer = setTimeout(finish, 60000) // segurança: resolve sempre, mesmo se o áudio nunca sinalizar
        audio.play().catch(finish)
      })
    } catch {
      setSpeakingRole(null)
    }
  }, [])

  // ── Modo TEXTO: turno + Supervisor (sem áudio) — INTOCADO ────────────────────
  const submitTurn = useCallback(async (text: string) => {
    const msg = text.trim()
    if (!msg || isLoading || concluida) return
    setPendingTerapeuta(msg)
    setIsLoading(true)
    let turno: TurnoConversa | null = null
    try {
      const res = await fetch('/api/anamnese/turno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessao_id: sessao.id, mensagem: msg }),
      })
      if (res.status === 402) { toast.warning('Saldo insuficiente. Recarrega créditos na página Créditos.'); return }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { turno: TurnoConversa; avatar: string }
      turno = data.turno
      setTurns(prev => [...prev, data.turno])
    } catch (err) {
      toast.error(`Não foi possível enviar. ${err instanceof Error ? err.message : ''}`)
    } finally {
      setPendingTerapeuta(null)
      setIsLoading(false)
    }
    if (!turno) return
    const turnoNum = turno.turno
    setSupervisorPensandoTurno(turnoNum)
    const sup = await fetch('/api/anamnese/supervisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessao_id: sessao.id, turno: turnoNum }),
    }).then(r => (r.ok ? (r.json() as Promise<{ intervencao?: IntervencaoResult }>) : null)).catch(() => null)
    setSupervisorPensandoTurno(null)
    const intervencao = sup?.intervencao
    if (intervencao?.intervir && intervencao.intervencao && intervencao.tipo_erro) {
      const tipoErro = intervencao.tipo_erro
      const texto = intervencao.intervencao
      setTurns(prev => prev.map(t => t.turno === turnoNum
        ? { ...t, supervisor_interveio: true, tipo_erro: tipoErro, intervencao_supervisor: texto } : t))
    }
  }, [isLoading, concluida, sessao.id])

  // ── Modo VOZ: grava o turno (voz-registo) + corre o Supervisor em paralelo ────
  const registarTurnoVoz = useCallback(async (terapeuta: string, avatarTxt: string, durSegundos: number) => {
    const isAbertura = terapeuta.trim() === ''

    // Display imediato
    let tempTurno = 0
    if (isAbertura) {
      setTurns(prev => prev.map(t => (t.turno === 0 ? { ...t, avatar: avatarTxt } : t)))
    } else {
      tempTurno = turnsRef.current.reduce((m, t) => Math.max(m, t.turno), 0) + 1
      setTurns(prev => [...prev, { turno: tempTurno, timestamp: '', terapeuta, avatar: avatarTxt, supervisor_interveio: false }])
    }

    let turnoFinal = tempTurno
    try {
      const res = await fetch('/api/anamnese/voz-registo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessao_id: sessao.id, terapeuta, avatar: avatarTxt, duracao_segundos: durSegundos }),
      })
      if (res.status === 402) { toast.warning('Saldo insuficiente. Recarrega créditos na página Créditos.'); return }
      if (!res.ok) return
      const data = (await res.json()) as { turno: number }
      turnoFinal = data.turno
      if (!isAbertura && turnoFinal !== tempTurno) {
        setTurns(prev => prev.map(t => (t.turno === tempTurno ? { ...t, turno: turnoFinal } : t)))
      }
    } catch {
      return
    }

    if (isAbertura) return // abertura não tem Supervisor (não houve pergunta do terapeuta)

    // Supervisor (Claude) em paralelo — fora do caminho de áudio da Carolina
    setSupervisorPensandoTurno(turnoFinal)
    const sup = await fetch('/api/anamnese/supervisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessao_id: sessao.id, turno: turnoFinal }),
    }).then(r => (r.ok ? (r.json() as Promise<{ intervencao?: IntervencaoResult }>) : null)).catch(() => null)
    setSupervisorPensandoTurno(null)

    const intervencao = sup?.intervencao
    if (intervencao?.intervir && intervencao.intervencao && intervencao.tipo_erro) {
      const tipoErro = intervencao.tipo_erro
      const texto = intervencao.intervencao
      let mostrado = false
      const mostrarTexto = () => {
        if (mostrado) return
        mostrado = true
        setTurns(prev => prev.map(t => (t.turno === turnoFinal
          ? { ...t, supervisor_interveio: true, tipo_erro: tipoErro, intervencao_supervisor: texto } : t)))
      }
      gemini.pauseCapture() // corta o mic enquanto o Supervisor fala (anti-eco)
      try {
        await speak('/api/tts', { text: texto }, 'supervisor', mostrarTexto) // texto sincronizado com onplaying
      } finally {
        mostrarTexto()         // fallback se o áudio falhar
        gemini.resumeCapture() // re-arma sempre
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao.id, speak])

  // Deltas de transcrição do Gemini: input = terapeuta, output = Carolina.
  const handleTranscription = useCallback((text: string, isUser: boolean) => {
    if (isUser) {
      if (!therapistBufRef.current) turnStartRef.current = Date.now() // começa a cronometrar no 1º delta
      therapistBufRef.current += text
      setLiveUserSpeech(therapistBufRef.current)
      setSpeakingRole(null) // terapeuta a falar = estamos a escutar
    } else {
      carolinaBufRef.current += text
      setSpeakingRole('cliente') // a Carolina (Gemini) está a falar
    }
  }, [])

  // Fim do turno do modelo (Gemini) → fecha a troca e grava/avalia.
  const handleTurnComplete = useCallback(() => {
    const terapeuta = therapistBufRef.current.trim()
    const avatarTxt = carolinaBufRef.current.trim()
    const dur = turnStartRef.current ? (Date.now() - turnStartRef.current) / 1000 : 0
    therapistBufRef.current = ''
    carolinaBufRef.current = ''
    turnStartRef.current = 0
    setLiveUserSpeech('')
    setSpeakingRole(null)
    if (!terapeuta && !avatarTxt) return
    void registarTurnoVoz(terapeuta, avatarTxt, dur)
  }, [registarTurnoVoz])

  const handleVoiceError = useCallback((m: string) => {
    setVoiceErro(m)
    toast.error(m)
  }, [])

  const gemini = useGeminiLive(
    voiceEnabled && !concluida && voiceCfg
      ? {
          type: 'avatar',
          systemPrompt: voiceCfg.systemPrompt,
          voiceName: voiceCfg.voiceName,
          sessionId: sessao.id,
          onAudioChunk: () => {},
          onTextResponse: () => {},
          onTranscription: handleTranscription,
          onTurnComplete: handleTurnComplete,
          onError: handleVoiceError,
        }
      : null,
  )

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    void submitTurn(text)
  }, [input, submitTurn])

  // Mic + voz no GESTO do clique (autoplay policy): resumePlayback + connect síncronos.
  const handleStartVoice = useCallback(() => {
    if (!voiceCfg) return // ainda a preparar a persona — botão fica desactivado
    setVoiceErro('')
    setLiveUserSpeech('')
    gemini.resumePlayback() // contexto de playback no gesto → a Carolina fala à primeira
    gemini.connect()
  }, [gemini, voiceCfg])

  // Busca a config de voz (persona server-side, sem nós latentes) ao entrar em modo voz.
  useEffect(() => {
    if (!voiceEnabled || concluida || voiceCfg) return
    let cancelled = false
    fetch(`/api/anamnese/voz-prompt?avatar_id=${encodeURIComponent(sessao.avatar_id)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d?.systemPrompt) setVoiceCfg(d as VoiceCfg) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [voiceEnabled, concluida, voiceCfg, sessao.avatar_id])

  // Abertura por trigger: quando o Gemini liga numa sessão fresca, a Carolina apresenta-se em voz.
  useEffect(() => {
    if (aberturaEnviadaRef.current || gemini.state !== 'connected' || !voiceCfg) return
    const t0 = turns.find(t => t.turno === 0)
    const sessaoFresca = !turns.some(t => t.turno > 0) && (!t0 || !t0.avatar) // turno 0 ainda sem abertura
    if (sessaoFresca && voiceEnabled && !concluida) {
      aberturaEnviadaRef.current = true
      gemini.sendText(voiceCfg.aberturaTrigger)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gemini.state, voiceCfg, turns, voiceEnabled, concluida])

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(prev => {
      const next = !prev
      localStorage.setItem(VOICE_KEY, String(next))
      if (!next) {
        audioRef.current?.pause(); audioRef.current = null; setSpeakingRole(null)
        gemini.disconnect(); setLiveUserSpeech('')
      }
      return next
    })
  }, [gemini])

  const replayCliente = useCallback((texto: string) => {
    if (!texto) return
    gemini.pauseCapture()
    void speak('/api/anamnese/tts', { text: texto, voice: voz }, 'cliente').finally(() => gemini.resumeCapture())
  }, [speak, voz, gemini])

  const replaySupervisor = useCallback((texto: string) => {
    if (!texto) return
    gemini.pauseCapture()
    void speak('/api/tts', { text: texto }, 'supervisor').finally(() => gemini.resumeCapture())
  }, [speak, gemini])

  const handleConcluir = useCallback(async () => {
    setIsGeneratingReport(true)
    setMostrarConfirmConcluir(false)
    audioRef.current?.pause()
    gemini.disconnect()
    try {
      const durationMs = Date.now() - startRef.current
      const duracao_minutos = Math.max(1, Math.ceil(durationMs / 60000))
      const res = await fetch('/api/anamnese/relatorio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessao_id: sessao.id, duracao_minutos }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? 'Não foi possível gerar o relatório.')
        return
      }
      const data = (await res.json()) as { relatorio: RelatorioAnamnese }
      setRelatorio(data.relatorio)
      toast.success('Sessão concluída.')
    } catch {
      toast.error('Erro ao concluir a sessão.')
    } finally {
      setIsGeneratingReport(false)
    }
  }, [sessao.id, gemini])

  const handleApagar = useCallback(async () => {
    gemini.disconnect()
    try {
      const res = await fetch(`/api/anamnese/sessao/${sessao.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Sessão apagada.')
        router.push('/anamnese')
      } else {
        toast.error('Não foi possível apagar.')
        setMostrarConfirmApagar(false)
      }
    } catch {
      toast.error('Erro ao apagar.')
      setMostrarConfirmApagar(false)
    }
  }, [sessao.id, router, gemini])

  const temTurnosReais = turns.some(t => t.turno > 0)
  const statusVoz =
    speakingRole === 'cliente' ? `${avatar?.nome ?? 'O cliente'} está a falar…`
      : speakingRole === 'supervisor' ? 'Supervisor a falar…'
      : gemini.state === 'reconnecting' ? 'A reconectar…'
      : 'A escutar — fala agora'

  return (
    <>
      {mostrarConfirmApagar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-xl border p-6 space-y-4 max-w-sm w-full mx-4 shadow-xl" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="space-y-1.5">
              <p className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>Apagar sessão?</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                Esta acção é irreversível. Toda a conversa será apagada.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setMostrarConfirmApagar(false)} className="px-3 h-8 rounded-md text-xs border transition-colors" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>Cancelar</button>
              <button type="button" onClick={handleApagar} className="px-3 h-8 rounded-md text-xs font-medium transition-colors" style={{ background: 'oklch(0.52 0.22 25)', color: 'white' }}>Apagar</button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border overflow-hidden flex flex-col" style={{ height: 'calc(100dvh - 9rem)', borderColor: 'var(--border)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 shrink-0">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white" style={{ background: cor }}>
                {avatar?.nome?.[0] ?? '?'}
              </div>
              {speakingRole === 'cliente' && (
                <span className="absolute inset-0 rounded-full animate-ping" style={{ background: cor, opacity: 0.4 }} />
              )}
            </div>
            <div>
              <p className="text-sm font-medium leading-tight" style={{ color: 'var(--foreground)' }}>
                {avatar?.nome ?? sessao.avatar_id}, {avatar?.idade} anos
              </p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {speakingRole === 'cliente' ? `${avatar?.nome} está a falar…`
                  : speakingRole === 'supervisor' ? 'Supervisor a falar…'
                  : `${avatar?.area} · Anamnese supervisionada`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleVoice}
              className="p-1.5 rounded transition-colors text-base leading-none"
              style={{ color: voiceEnabled ? cor : 'var(--muted-foreground)' }}
              title={voiceEnabled ? 'Modo voz ligado (microfone + voz)' : 'Ligar modo voz'}
            >
              {voiceEnabled ? '🔊' : '🔇'}
            </button>

            {!concluida && (
              <>
                <button type="button" onClick={() => setMostrarConfirmApagar(true)} className="p-1.5 rounded transition-colors" style={{ color: 'var(--muted-foreground)' }} title="Apagar sessão">🗑️</button>
                {!mostrarConfirmConcluir ? (
                  <button type="button" onClick={() => setMostrarConfirmConcluir(true)} disabled={!temTurnosReais || isLoading} className="text-xs underline disabled:opacity-40" style={{ color: 'var(--muted-foreground)' }}>
                    Terminar sessão
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs hidden sm:inline" style={{ color: 'var(--foreground)' }}>Terminar e avaliar?</span>
                    <Button size="sm" onClick={handleConcluir} disabled={isGeneratingReport}>{isGeneratingReport ? 'A avaliar…' : 'Confirmar'}</Button>
                    <Button size="sm" variant="outline" onClick={() => setMostrarConfirmConcluir(false)}>Cancelar</Button>
                  </div>
                )}
              </>
            )}
            {concluida && <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Sessão concluída</span>}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
          {turns.map(turn => (
            <div key={turn.turno} className="space-y-3">
              {turn.terapeuta && (
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed" style={{ background: 'oklch(0.965 0.008 85)', color: 'var(--foreground)', border: '1px solid var(--border)' }}>
                    {turn.terapeuta}
                  </div>
                </div>
              )}
              {turn.avatar && (
                <div className="flex items-start gap-2.5 max-w-[85%] group">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0 mt-1" style={{ background: cor }}>
                    {avatar?.nome?.[0] ?? '?'}
                  </div>
                  <div className="rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}>
                    {turn.avatar}
                  </div>
                  <button type="button" onClick={() => replayCliente(turn.avatar)} className="shrink-0 mt-1 p-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: cor }} title={`Ouvir ${avatar?.nome ?? 'o cliente'}`}>🔈</button>
                </div>
              )}
              {turn.supervisor_interveio && turn.intervencao_supervisor && turn.tipo_erro && (
                <BlocoSupervisorAnamnese
                  tipoErro={turn.tipo_erro}
                  intervencao={turn.intervencao_supervisor}
                  onPlay={() => replaySupervisor(turn.intervencao_supervisor!)}
                  isPlaying={speakingRole === 'supervisor'}
                />
              )}
              {!turn.supervisor_interveio && turn.turno === supervisorPensandoTurno && (
                <div className="rounded-xl p-4 flex items-center gap-2" style={{ background: '#3D2B00', border: '1px solid #C9A961', color: '#F0E6D2' }}>
                  <span className="text-base leading-none">👁</span>
                  <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#C9A961' }}>Supervisor · Anamnese</span>
                  <span className="text-sm" style={{ color: '#E8DCC4' }}>a pensar</span>
                  <span className="inline-flex gap-1">
                    {[0, 150, 300].map(d => (
                      <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#C9A961', animationDelay: `${d}ms` }} />
                    ))}
                  </span>
                </div>
              )}
            </div>
          ))}

          {pendingTerapeuta && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed" style={{ background: 'oklch(0.965 0.008 85)', color: 'var(--foreground)', border: '1px solid var(--border)' }}>
                  {pendingTerapeuta}
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0 mt-1" style={{ background: cor }}>
                  {avatar?.nome?.[0] ?? '?'}
                </div>
                <div className="rounded-2xl rounded-tl-sm px-4 py-2.5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <span className="inline-flex gap-1">
                    {[0, 150, 300].map(d => (
                      <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--muted-foreground)', animationDelay: `${d}ms` }} />
                    ))}
                  </span>
                </div>
              </div>
            </div>
          )}

          {isGeneratingReport && !relatorio && (
            <div className="flex items-center gap-3 justify-center rounded-xl border p-5 mt-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
              <span className="inline-flex gap-1">
                {[0, 150, 300].map(d => (
                  <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#C9A961', animationDelay: `${d}ms` }} />
                ))}
              </span>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>A gerar avaliação da sessão…</p>
            </div>
          )}

          {relatorio && (
            <div className="mt-6 rounded-2xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
              <RelatorioAnamneseView relatorio={relatorio} />
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Footer */}
        {concluida ? (
          <div className="px-4 py-3 text-sm text-center border-t" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'var(--card)' }}>
            Sessão concluída. Inicia uma nova anamnese para continuar a praticar.
          </div>
        ) : voiceEnabled ? (
          <div className="border-t shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
            {liveUserSpeech && (gemini.state === 'connected' || gemini.state === 'reconnecting') && (
              <div className="px-4 pt-3 pb-1">
                <p className="text-xs italic leading-snug" style={{ color: 'var(--muted-foreground)' }}>
                  &ldquo;{liveUserSpeech.trim()}&rdquo;
                </p>
              </div>
            )}
            <div className="p-4 flex items-center justify-center gap-4">
              {gemini.state === 'idle' && (
                <button type="button" onClick={handleStartVoice} disabled={!voiceCfg} className="inline-flex items-center gap-2 rounded-full px-6 h-11 text-sm font-medium text-white transition-colors disabled:opacity-50" style={{ background: cor }}>
                  <span className="text-base">🎤</span>
                  {voiceCfg ? 'Iniciar sessão de voz' : 'A preparar…'}
                </button>
              )}
              {gemini.state === 'connecting' && (
                <div className="flex items-center gap-3">
                  <span className="inline-flex gap-1">
                    {[0, 150, 300].map(d => (<span key={d} className="w-2 h-2 rounded-full animate-bounce" style={{ background: cor, animationDelay: `${d}ms` }} />))}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>A ligar ao microfone…</span>
                </div>
              )}
              {(gemini.state === 'connected' || gemini.state === 'reconnecting') && (
                <div className="flex items-center gap-4">
                  <div className="relative flex items-center justify-center w-10 h-10">
                    {!speakingRole && (
                      <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ background: cor }} />
                    )}
                    <span className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full text-base text-white" style={{ background: cor, transition: 'background 0.3s' }}>
                      {speakingRole ? '🔊' : '🎤'}
                    </span>
                  </div>
                  <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{statusVoz}</span>
                </div>
              )}
              {gemini.state === 'closed' && (
                <div className="flex items-center gap-3">
                  <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Sessão de voz encerrada.</span>
                  <button type="button" className="text-xs underline" style={{ color: 'var(--primary)' }} onClick={handleStartVoice}>Reiniciar</button>
                </div>
              )}
              {gemini.state === 'error' && (
                <div className="flex flex-col items-center gap-1 text-center">
                  <span className="text-xs" style={{ color: 'oklch(0.55 0.18 25)' }}>{voiceErro || 'Erro na ligação ao serviço de voz.'}</span>
                  <button type="button" className="text-xs underline" style={{ color: 'var(--primary)' }} onClick={handleStartVoice}>Tentar novamente</button>
                </div>
              )}
            </div>
            <p className="text-xs pb-3 px-4 text-center" style={{ color: 'var(--muted-foreground)' }}>
              🎤 Modo voz — fala com {avatar?.nome ?? 'o cliente'}. O Supervisor intervém em voz quando ficas no manifesto.
            </p>
          </div>
        ) : (
          <div className="p-3 border-t shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
            <div className="flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
                }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                disabled={isLoading}
                placeholder={`Conduz a anamnese com ${avatar?.nome ?? 'o cliente'}…`}
                rows={1}
                className="flex-1 rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1"
                style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)', overflow: 'hidden', minHeight: '2.5rem', maxHeight: '7.5rem' }}
              />
              <button type="button" onClick={handleSend} disabled={isLoading || !input.trim()} className="shrink-0 h-10 px-3 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: cor }}>
                {isLoading ? '…' : '→'}
              </button>
            </div>
            <p className="text-xs mt-1.5 ml-1" style={{ color: 'var(--muted-foreground)' }}>
              O Supervisor intervém quando ficas no manifesto. Enter envia · Shift+Enter nova linha
            </p>
          </div>
        )}
      </div>
    </>
  )
}
