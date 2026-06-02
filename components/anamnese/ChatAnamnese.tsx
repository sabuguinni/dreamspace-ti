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

  // ── Voz ────────────────────────────────────────────────────────────────────
  const [voiceEnabled, setVoiceEnabled] = useState(
    () => sessao.modo === 'voz' || (typeof window !== 'undefined' && localStorage.getItem(VOICE_KEY) === 'true'),
  )
  const [speakingRole, setSpeakingRole] = useState<SpeakingRole>(null)
  const [liveUserSpeech, setLiveUserSpeech] = useState('')
  const [voiceErro, setVoiceErro] = useState('')
  const [streamingTurno, setStreamingTurno] = useState<number | null>(null)
  const [pensandoTurno, setPensandoTurno] = useState<number | null>(null)            // avatar a pensar (antes do áudio)
  const [supervisorPensandoTurno, setSupervisorPensandoTurno] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isSendingRef = useRef(false)

  // Áudio do cliente em streaming — Web Audio API (playback gapless, sem new Audio() por chunk)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const nextStartRef = useRef(0)
  const scheduledRef = useRef(0)
  const endedRef = useRef(0)
  const streamDoneRef = useRef(false)
  const drainResolveRef = useRef<(() => void) | null>(null)

  const concluida = sessao.estado === 'concluida' || relatorio !== null

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const startRef = useRef<number>(new Date(sessao.created_at).getTime() || Date.now())

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, pendingTerapeuta, relatorio, isGeneratingReport, liveUserSpeech])

  useEffect(() => {
    return () => {
      audioRef.current?.pause(); audioRef.current = null
      audioCtxRef.current?.close().catch(() => {}); audioCtxRef.current = null
    }
  }, [])

  // ── Áudio do cliente (Web Audio API, gapless) ────────────────────────────────
  const ensureAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioCtxRef.current = new Ctx()
    }
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume().catch(() => {})
    return audioCtxRef.current
  }, [])

  const closeAudioCtx = useCallback(() => {
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    nextStartRef.current = 0
  }, [])

  const resolveDrainIfDone = useCallback(() => {
    if (streamDoneRef.current && scheduledRef.current === endedRef.current) {
      setSpeakingRole(prev => (prev === 'cliente' ? null : prev))
      drainResolveRef.current?.()
      drainResolveRef.current = null
    }
  }, [])

  // Descodifica o WAV e AGENDA-o (gapless) na timeline do AudioContext
  const enqueueChunk = useCallback(async (wavB64: string) => {
    try {
      const ctx = ensureAudioCtx()
      const bin = atob(wavB64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const audioBuf = await ctx.decodeAudioData(bytes.buffer)
      const src = ctx.createBufferSource()
      src.buffer = audioBuf
      src.connect(ctx.destination)
      const startAt = Math.max(ctx.currentTime + 0.03, nextStartRef.current)
      src.start(startAt)
      nextStartRef.current = startAt + audioBuf.duration
      scheduledRef.current += 1
      setSpeakingRole('cliente')
      src.onended = () => { endedRef.current += 1; resolveDrainIfDone() }
    } catch {
      resolveDrainIfDone()
    }
  }, [ensureAudioCtx, resolveDrainIfDone])

  const waitForClienteDrain = useCallback(() => new Promise<void>(resolve => {
    if (streamDoneRef.current && scheduledRef.current === endedRef.current) {
      resolve()
      return
    }
    drainResolveRef.current = resolve
  }), [])

  // ── TTS pontual (replays + voz do Supervisor) ────────────────────────────────
  const speak = useCallback(async (endpoint: string, payload: Record<string, unknown>, role: SpeakingRole) => {
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
      if (audioRef.current) audioRef.current.pause()
      await new Promise<void>(resolve => {
        const audio = new Audio(url)
        audioRef.current = audio
        setSpeakingRole(role)
        const finish = () => {
          URL.revokeObjectURL(url)
          if (audioRef.current === audio) { audioRef.current = null; setSpeakingRole(null) }
          resolve()
        }
        audio.onended = finish
        audio.onpause = finish
        audio.onerror = finish
        audio.play().catch(finish)
      })
    } catch {
      setSpeakingRole(null)
    }
  }, [])

  // ── Modo TEXTO: turno + Supervisor (sem áudio) ───────────────────────────────
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

  // ── Modo VOZ: pipeline em streaming (Claude stream → TTS por frase → áudio) ───
  const submitVoiceTurn = useCallback(async (text: string) => {
    const msg = text.trim()
    if (!msg || isLoading || concluida) return
    setIsLoading(true)

    // Reset do estado de áudio (Web Audio)
    nextStartRef.current = 0
    scheduledRef.current = 0
    endedRef.current = 0
    streamDoneRef.current = false
    drainResolveRef.current = null

    const tempTurno = turns.reduce((m, t) => Math.max(m, t.turno), 0) + 1
    let turnoFinal = tempTurno
    let firstAudio = true
    setStreamingTurno(tempTurno)
    setPensandoTurno(tempTurno) // "[Nome] a pensar…" até o áudio começar
    setTurns(prev => [...prev, { turno: tempTurno, timestamp: '', terapeuta: msg, avatar: '', supervisor_interveio: false }])

    let supervisorPromise: Promise<{ intervencao?: IntervencaoResult } | null> = Promise.resolve(null)

    try {
      const res = await fetch('/api/anamnese/voz-turno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessao_id: sessao.id, mensagem: msg }),
      })
      if (res.status === 402) {
        toast.warning('Saldo insuficiente. Recarrega créditos na página Créditos.')
        setTurns(prev => prev.filter(t => t.turno !== tempTurno))
        return
      }
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let evt: { type: string; delta?: string; audio?: string; turno?: number; avatar?: string; error?: string }
          try { evt = JSON.parse(line.slice(6)) } catch { continue }
          if (evt.type === 'text' && evt.delta) {
            const d = evt.delta
            setTurns(prev => prev.map(t => t.turno === turnoFinal ? { ...t, avatar: (t.avatar || '') + d } : t))
          } else if (evt.type === 'audio' && evt.audio) {
            if (firstAudio) { setPensandoTurno(null); firstAudio = false } // áudio começou → mostra o texto real
            await enqueueChunk(evt.audio)
          } else if (evt.type === 'turno' && typeof evt.turno === 'number') {
            const novo = evt.turno
            const txt = evt.avatar ?? ''
            setTurns(prev => prev.map(t => t.turno === turnoFinal ? { ...t, turno: novo, avatar: txt } : t))
            turnoFinal = novo
            setSupervisorPensandoTurno(novo) // "Supervisor a pensar…" no bloco âmbar
            supervisorPromise = fetch('/api/anamnese/supervisor', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessao_id: sessao.id, turno: novo }),
            }).then(r => (r.ok ? (r.json() as Promise<{ intervencao?: IntervencaoResult }>) : null)).catch(() => null)
          } else if (evt.type === 'error') {
            toast.error(evt.error || 'Erro ao gerar resposta.')
          }
        }
      }
    } catch (err) {
      toast.error(`Não foi possível enviar. ${err instanceof Error ? err.message : ''}`)
    } finally {
      setIsLoading(false)
      setStreamingTurno(null)
      setPensandoTurno(null)
      streamDoneRef.current = true
      resolveDrainIfDone()
    }

    // Espera a fala do cliente terminar
    await waitForClienteDrain()

    // Supervisor (correu em paralelo) — bolha + voz Hugo a seguir
    const sup = await supervisorPromise
    setSupervisorPensandoTurno(null)
    const intervencao = sup?.intervencao
    if (intervencao?.intervir && intervencao.intervencao && intervencao.tipo_erro) {
      const tipoErro = intervencao.tipo_erro
      const texto = intervencao.intervencao
      setTurns(prev => prev.map(t => t.turno === turnoFinal
        ? { ...t, supervisor_interveio: true, tipo_erro: tipoErro, intervencao_supervisor: texto } : t))
      await speak('/api/tts', { text: texto }, 'supervisor')
    }
  }, [isLoading, concluida, sessao.id, turns, enqueueChunk, resolveDrainIfDone, waitForClienteDrain, speak])

  // ── Fim de fala do terapeuta (VAD do Gemini) → pipeline de voz ───────────────
  const handleVoiceTurn = useCallback(async (transcript: string) => {
    const text = transcript.trim()
    if (!text || isSendingRef.current) return
    isSendingRef.current = true
    setLiveUserSpeech('')
    gemini.clearSttBuffer()
    gemini.pauseCapture()
    try {
      await submitVoiceTurn(text)
    } finally {
      gemini.resumeCapture()
      isSendingRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitVoiceTurn])

  const handleVoiceError = useCallback((m: string) => {
    setVoiceErro(m)
    toast.error(m)
  }, [])

  const gemini = useGeminiLive(
    voiceEnabled && !concluida
      ? {
          type: 'supervisor_stt',
          systemPrompt: '',
          voiceName: 'Puck',
          sessionId: sessao.id,
          onAudioChunk: () => {},
          onTextResponse: () => {},
          onTranscription: (t, isUser) => { if (isUser) setLiveUserSpeech(prev => (prev + t + ' ').trimStart()) },
          onTurnComplete: () => {},
          onUserSpeechFinal: handleVoiceTurn,
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

  const handleStartVoice = useCallback(() => {
    setVoiceErro('')
    setLiveUserSpeech('')
    isSendingRef.current = false
    ensureAudioCtx() // cria/retoma o AudioContext dentro do gesto (autoplay policy)
    gemini.connect()
  }, [gemini, ensureAudioCtx])

  const handleManualVoiceSend = useCallback(() => {
    const text = liveUserSpeech.trim()
    if (!text || isLoading || speakingRole) return
    void handleVoiceTurn(text)
  }, [liveUserSpeech, isLoading, speakingRole, handleVoiceTurn])

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(prev => {
      const next = !prev
      localStorage.setItem(VOICE_KEY, String(next))
      if (!next) {
        audioRef.current?.pause(); audioRef.current = null; setSpeakingRole(null)
        closeAudioCtx()
        gemini.disconnect(); setLiveUserSpeech('')
      }
      return next
    })
  }, [gemini, closeAudioCtx])

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
    closeAudioCtx()
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
  }, [sessao.id, gemini, closeAudioCtx])

  const handleApagar = useCallback(async () => {
    closeAudioCtx()
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
  }, [sessao.id, router, gemini, closeAudioCtx])

  const temTurnosReais = turns.some(t => t.turno > 0)
  const statusVoz =
    speakingRole === 'cliente' ? `${avatar?.nome ?? 'O cliente'} está a falar…`
      : speakingRole === 'supervisor' ? 'Supervisor a falar…'
      : isLoading ? 'A processar…'
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
              {(turn.avatar || turn.turno === streamingTurno) && (
                <div className="flex items-start gap-2.5 max-w-[85%] group">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0 mt-1" style={{ background: cor }}>
                    {avatar?.nome?.[0] ?? '?'}
                  </div>
                  <div className="rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}>
                    {turn.turno === pensandoTurno ? (
                      <span className="inline-flex items-center gap-2" style={{ color: 'var(--muted-foreground)' }}>
                        <span className="italic">{avatar?.nome ?? 'O cliente'} a pensar</span>
                        <span className="inline-flex gap-1">
                          {[0, 150, 300].map(d => (
                            <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--muted-foreground)', animationDelay: `${d}ms` }} />
                          ))}
                        </span>
                      </span>
                    ) : turn.avatar ? turn.avatar : (
                      <span className="inline-flex gap-1">
                        {[0, 150, 300].map(d => (
                          <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--muted-foreground)', animationDelay: `${d}ms` }} />
                        ))}
                      </span>
                    )}
                  </div>
                  {turn.avatar && turn.turno !== pensandoTurno && (
                    <button type="button" onClick={() => replayCliente(turn.avatar)} className="shrink-0 mt-1 p-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: cor }} title={`Ouvir ${avatar?.nome ?? 'o cliente'}`}>🔈</button>
                  )}
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
                <button type="button" onClick={handleStartVoice} className="inline-flex items-center gap-2 rounded-full px-6 h-11 text-sm font-medium text-white transition-colors" style={{ background: cor }}>
                  <span className="text-base">🎤</span>
                  Iniciar sessão de voz
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
                    {!speakingRole && !isLoading && (
                      <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ background: cor }} />
                    )}
                    <span className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full text-base text-white" style={{ background: cor, transition: 'background 0.3s' }}>
                      {speakingRole ? '🔊' : isLoading ? '⏳' : '🎤'}
                    </span>
                  </div>
                  <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{statusVoz}</span>
                  {liveUserSpeech.trim() && !isLoading && !speakingRole && (
                    <button type="button" onClick={handleManualVoiceSend} className="text-xs px-3 h-7 rounded-full font-medium text-white transition-colors" style={{ background: cor }}>Enviar</button>
                  )}
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
