'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import type { SessaoAvatar, AvatarReport } from '@/lib/types'
import type { FicheiroSecreto } from '@/lib/types'
import { FicheiroModal } from './FicheiroModal'
import { Button } from '@/components/ui/button'
import { getAvatar } from '@/lib/content/avatares'
import { useGeminiLive } from '@/lib/hooks/useGeminiLive'
import type { Mensagem } from '@/lib/types'

// ─── Voices per avatar ────────────────────────────────────────────────────────
const AVATAR_VOICES: Record<string, string> = {
  mariana: 'Kore',
  beatriz: 'Aoede',
  carlos: 'Charon',
  miguel: 'Puck',
}

const AVATAR_COLORS: Record<string, { bg: string; fg: string }> = {
  mariana: { bg: 'oklch(0.26 0.15 252)', fg: 'white' },
  carlos:  { bg: 'oklch(0.38 0.05 245)', fg: 'white' },
  miguel:  { bg: 'oklch(0.38 0.18 288)', fg: 'white' },
  beatriz: { bg: 'oklch(0.48 0.08 148)', fg: 'white' },
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TranscriptLine = { role: 'user' | 'avatar'; text: string }

interface Props {
  sessaoId: string
  sessaoInicial: SessaoAvatar
  mensagensIniciais: Mensagem[]
  avatarNome: string
  avatarSlug: string
  avatarIdade: number
  avatarProfissao: string
  ficheiro: FicheiroSecreto
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AvatarChat({
  sessaoId,
  sessaoInicial,
  avatarNome,
  avatarSlug,
  avatarIdade,
  avatarProfissao,
  ficheiro,
}: Props) {
  const [sessao, setSessao] = useState<SessaoAvatar>(sessaoInicial)
  const [isConcluindo, setIsConcluindo] = useState(false)
  const [mostrarConfirmConcluir, setMostrarConfirmConcluir] = useState(false)
  const [mostrarFicheiro, setMostrarFicheiro] = useState(false)
  const [report, setReport] = useState<AvatarReport | null>(null)
  const [isGerandoRelatorio, setIsGerandoRelatorio] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')

  // Transcript lines (completed turns)
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([])
  // Partial buffers accumulating current turn chunks before commit
  const pendingOutputRef = useRef<string>('')
  const pendingInputRef = useRef<string>('')

  // Voice session start time for duration calculation
  const voiceStartRef = useRef<number | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const concluida = sessao.estado === 'concluida'

  const color = AVATAR_COLORS[avatarSlug] ?? { bg: 'oklch(0.42 0.08 252)', fg: 'white' }
  const dicebearSrc = `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(avatarNome)}`

  // Voice-mode system prompt prefix (Gemini Live needs natural speech instructions)
  const avatar = getAvatar(avatarSlug)
  const voiceSystemPrompt = avatar
    ? `[MODO VOZ] Estás numa sessão de voz. Fala de forma natural, pausada e empática. Não uses markdown, bullet points ou listas. Usa frases curtas e parágrafos directos. Responde sempre em português europeu.\n\n${avatar.systemPrompt}`
    : ''

  // ─── Gemini Live ─────────────────────────────────────────────────────────────

  const handleTranscription = useCallback((text: string, isUser: boolean) => {
    if (isUser) {
      pendingInputRef.current += text + ' '
    } else {
      pendingOutputRef.current += text + ' '
    }
  }, [])

  const handleTurnComplete = useCallback(() => {
    const avatarTurn = pendingOutputRef.current.trim()
    const userTurn = pendingInputRef.current.trim()

    setTranscriptLines(prev => {
      const next = [...prev]
      if (userTurn) next.push({ role: 'user', text: userTurn })
      if (avatarTurn) next.push({ role: 'avatar', text: avatarTurn })
      return next
    })
    pendingOutputRef.current = ''
    pendingInputRef.current = ''
  }, [])

  const handleError = useCallback((msg: string) => {
    setErrorMessage(msg)
    toast.error(msg)
  }, [])

  const gemini = useGeminiLive(
    concluida
      ? null
      : {
          model: 'gemini-2.5-flash-native-audio-latest',
          systemPrompt: voiceSystemPrompt,
          voiceName: AVATAR_VOICES[avatarSlug] ?? 'Kore',
          sessionId: sessaoId,
          onAudioChunk: () => {},
          onTextResponse: () => {},
          onTranscription: handleTranscription,
          onTurnComplete: handleTurnComplete,
          onError: handleError,
        }
  )

  // Track voice session start time
  useEffect(() => {
    if (gemini.state === 'connected' && voiceStartRef.current === null) {
      voiceStartRef.current = Date.now()
    }
  }, [gemini.state])

  // Load admin status + cached report
  useEffect(() => {
    fetch('/api/credits')
      .then(r => r.json())
      .then(d => { setIsAdmin(d.isAdmin ?? false) })
      .catch(() => {})

    if (concluida) {
      const notas = (sessaoInicial.notas_evolucao ?? {}) as Record<string, unknown>
      if (notas.avatar_report) setReport(notas.avatar_report as AvatarReport)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcriptLines])

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  function handleStartVoice() {
    setErrorMessage('')
    // resumePlayback MUST run synchronously in the onClick to satisfy browser autoplay policy
    gemini.resumePlayback()
    gemini.connect()
  }

  async function handleConcluir() {
    setIsConcluindo(true)
    try {
      // Flush any remaining partial transcript
      const finalAvatarTurn = pendingOutputRef.current.trim()
      const finalUserTurn = pendingInputRef.current.trim()
      const allLines = [...transcriptLines]
      if (finalUserTurn) allLines.push({ role: 'user', text: finalUserTurn })
      if (finalAvatarTurn) allLines.push({ role: 'avatar', text: finalAvatarTurn })

      const voiceTranscript = allLines.map(l =>
        l.role === 'user' ? `[Terapeuta]: ${l.text}` : `[Avatar]: ${l.text}`
      )

      const durationMs = voiceStartRef.current ? Date.now() - voiceStartRef.current : 0
      const voiceDurationMinutes = Math.max(1, Math.ceil(durationMs / 60000))

      // Disconnect voice before concluding
      gemini.disconnect()

      const res = await fetch(`/api/avatar/sessoes/${sessaoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: 'concluida',
          voice_transcript: voiceTranscript,
          voice_duration_minutes: voiceDurationMinutes,
        }),
      })

      if (res.ok) {
        setSessao(prev => ({ ...prev, estado: 'concluida', ficheiro_revelado: true }))
        setMostrarConfirmConcluir(false)
        toast.success('Sessão concluída.')
        setMostrarFicheiro(true)

        // Generate AI report in background (non-blocking)
        setIsGerandoRelatorio(true)
        fetch(`/api/avatar/sessoes/${sessaoId}/report`, { method: 'POST' })
          .then(async r => {
            if (r.status === 402) {
              toast.error('Créditos insuficientes para gerar relatório de desempenho.')
              return
            }
            if (!r.ok) return
            const data = await r.json() as { report: AvatarReport; score: number }
            setReport(data.report)
          })
          .catch(err => console.error('[report] fetch failed:', err))
          .finally(() => setIsGerandoRelatorio(false))
      }
    } catch {
      toast.error('Não foi possível concluir a sessão. Tenta daqui a pouco.')
    } finally {
      setIsConcluindo(false)
    }
  }

  // ─── Derived state ─────────────────────────────────────────────────────────────

  const isAvatarSpeaking =
    gemini.state === 'connected' && pendingOutputRef.current.length > 0

  // ─── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      {mostrarFicheiro && (
        <FicheiroModal
          nome={avatarNome}
          ficheiro={ficheiro}
          report={report}
          isLoadingReport={isGerandoRelatorio}
          onClose={() => setMostrarFicheiro(false)}
        />
      )}

      <div className="flex flex-col flex-1 min-h-0">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-4 md:px-5 py-3 border-b shrink-0"
          style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
        >
          <div className="flex items-center gap-3">
            {/* Avatar image with pulse ring when speaking */}
            <div className="relative w-9 h-9 shrink-0">
              <Image
                src={dicebearSrc}
                alt={avatarNome}
                width={36}
                height={36}
                className="rounded-full"
                unoptimized
              />
              <div
                className="absolute inset-0 rounded-full flex items-center justify-center text-sm font-semibold -z-10"
                style={{ background: color.bg, color: color.fg }}
              >
                {avatarNome[0]}
              </div>
              {isAvatarSpeaking && (
                <span
                  className="absolute inset-0 rounded-full animate-ping"
                  style={{ background: `${color.bg.replace(')', ' / 0.4)')}` }}
                />
              )}
            </div>
            <div>
              <p className="text-sm font-medium leading-tight" style={{ color: 'var(--foreground)' }}>
                {avatarNome}, {avatarIdade} anos
              </p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {avatarProfissao}
              </p>
            </div>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-2">
            {concluida ? (
              <>
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Sessão concluída</span>
                <Button size="sm" variant="outline" onClick={() => setMostrarFicheiro(true)}>
                  Ver ficheiro
                </Button>
              </>
            ) : !mostrarConfirmConcluir ? (
              <button
                type="button"
                onClick={() => setMostrarConfirmConcluir(true)}
                className="text-xs underline"
                style={{ color: 'var(--muted-foreground)' }}
              >
                Concluir sessão
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs hidden sm:inline" style={{ color: 'var(--foreground)' }}>
                  Confirmar?
                </span>
                <Button size="sm" onClick={handleConcluir} disabled={isConcluindo}>
                  {isConcluindo ? 'A concluir…' : 'Confirmar'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setMostrarConfirmConcluir(false)}>
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">

          {/* Transcript lines */}
          {transcriptLines.map((line, i) => (
            <div
              key={i}
              className={`flex ${line.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {line.role === 'user' ? (
                <div
                  className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed"
                  style={{
                    background: 'oklch(0.965 0.008 85)',
                    color: 'var(--foreground)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {line.text}
                </div>
              ) : (
                <div className="flex items-start gap-2.5 max-w-[85%]">
                  <div className="relative w-7 h-7 shrink-0 mt-1">
                    <Image
                      src={dicebearSrc}
                      alt={avatarNome}
                      width={28}
                      height={28}
                      className="rounded-full"
                      unoptimized
                    />
                    <div
                      className="absolute inset-0 rounded-full flex items-center justify-center text-xs font-semibold -z-10"
                      style={{ background: color.bg, color: color.fg }}
                    >
                      {avatarNome[0]}
                    </div>
                  </div>
                  <div
                    className="rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                  >
                    {line.text}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Empty state / voice idle prompt */}
          {transcriptLines.length === 0 && gemini.state === 'idle' && !concluida && (
            <div className="h-full flex items-center justify-center min-h-48">
              <div className="text-center space-y-1">
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Inicia a sessão de voz para começar.
                </p>
              </div>
            </div>
          )}

          {/* Error message */}
          {errorMessage && gemini.state === 'error' && (
            <div className="flex justify-center">
              <div
                className="rounded-lg border px-4 py-3 text-sm max-w-sm text-center space-y-2"
                style={{ background: 'var(--card)', borderColor: 'oklch(0.52 0.22 25 / 0.4)', color: 'oklch(0.52 0.22 25)' }}
              >
                <p>{errorMessage}</p>
                <button
                  type="button"
                  className="text-xs underline"
                  style={{ color: 'var(--primary)' }}
                  onClick={() => { setErrorMessage(''); gemini.resumePlayback(); gemini.connect() }}
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Footer — voice controls ────────────────────────────────────────── */}
        {concluida ? (
          <div
            className="px-4 py-3 text-sm text-center border-t"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'var(--card)' }}
          >
            Sessão concluída.{' '}
            <button
              type="button"
              className="underline"
              onClick={() => setMostrarFicheiro(true)}
              style={{ color: 'var(--primary)' }}
            >
              Ver ficheiro psicológico
            </button>
          </div>
        ) : (
          <div
            className="p-4 border-t flex items-center justify-center gap-4"
            style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
          >
            {gemini.state === 'idle' && (
              <button
                type="button"
                onClick={handleStartVoice}
                className="inline-flex items-center gap-2 rounded-full px-6 h-11 text-sm font-medium transition-colors"
                style={{ background: color.bg, color: color.fg }}
              >
                <span className="text-base">🎤</span>
                Iniciar sessão de voz
              </button>
            )}

            {gemini.state === 'connecting' && (
              <div className="flex items-center gap-3">
                <span className="inline-flex gap-1">
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: color.bg, animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: color.bg, animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: color.bg, animationDelay: '300ms' }} />
                </span>
                <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>A conectar ao {avatarNome}…</span>
              </div>
            )}

            {(gemini.state === 'connected' || gemini.state === 'reconnecting') && (
              <div className="flex items-center gap-3">
                {/* Pulsing mic indicator */}
                <div className="relative flex items-center justify-center w-10 h-10">
                  <span
                    className="absolute inset-0 rounded-full animate-ping opacity-40"
                    style={{ background: color.bg }}
                  />
                  <span
                    className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full text-base"
                    style={{ background: color.bg, color: color.fg }}
                  >
                    🎤
                  </span>
                </div>
                <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  {gemini.state === 'reconnecting'
                    ? 'A reconectar…'
                    : isAvatarSpeaking
                    ? `${avatarNome} está a falar…`
                    : 'Sessão de voz activa · a escutar'}
                </div>
              </div>
            )}

            {gemini.state === 'closed' && (
              <div className="flex items-center gap-3">
                <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Sessão de voz encerrada.</span>
                <button
                  type="button"
                  className="text-xs underline"
                  style={{ color: 'var(--primary)' }}
                  onClick={handleStartVoice}
                >
                  Reiniciar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
