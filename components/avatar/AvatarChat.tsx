'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
type AvatarMode = 'text' | 'voice'
type TextMsg = { id: string; role: 'user' | 'assistant'; content: string; streaming?: boolean }

const MODE_KEY = 'avatar_mode'

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
  mensagensIniciais,
  avatarNome,
  avatarSlug,
  avatarIdade,
  avatarProfissao,
  ficheiro,
}: Props) {
  const [sessao, setSessao] = useState<SessaoAvatar>(sessaoInicial)
  const router = useRouter()
  const [isConcluindo, setIsConcluindo] = useState(false)
  const [mostrarConfirmConcluir, setMostrarConfirmConcluir] = useState(false)
  const [mostrarConfirmApagar, setMostrarConfirmApagar] = useState(false)
  const [isApagando, setIsApagando] = useState(false)
  const [mostrarFicheiro, setMostrarFicheiro] = useState(false)
  const [report, setReport] = useState<AvatarReport | null>(null)
  const [isGerandoRelatorio, setIsGerandoRelatorio] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')

  // ── Mode state ────────────────────────────────────────────────────────────────
  const [avatarMode, setAvatarMode] = useState<AvatarMode>('text')

  // ── Text-mode state ───────────────────────────────────────────────────────────
  const [textMsgs, setTextMsgs] = useState<TextMsg[]>([])
  const [textInput, setTextInput] = useState('')
  const [isTextLoading, setIsTextLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Voice-mode state ──────────────────────────────────────────────────────────
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

  // Load mode preference + mensagens iniciais + admin status + cached report
  useEffect(() => {
    // Restore mode preference
    const storedMode = localStorage.getItem(MODE_KEY) as AvatarMode | null
    setAvatarMode(storedMode ?? 'text')

    // Pre-populate text messages from initial load
    if (mensagensIniciais.length > 0) {
      setTextMsgs(mensagensIniciais
        .filter(m => m.papel === 'user' || m.papel === 'assistant')
        .map((m, i) => ({
          id: `init-${i}`,
          role: m.papel as 'user' | 'assistant',
          content: m.conteudo,
        }))
      )
    }

    fetch('/api/credits')
      .then(r => r.json())
      .then(d => { setIsAdmin(d.isAdmin ?? false) })
      .catch(() => {})

    if (concluida) {
      const notas = (sessaoInicial.notas_evolucao ?? {}) as Record<string, unknown>
      if (notas.avatar_report) setReport(notas.avatar_report as AvatarReport)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll (text and voice modes)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcriptLines, textMsgs])

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  function switchMode(mode: AvatarMode) {
    if (mode === avatarMode) return
    // Disconnect Gemini when switching away from voice
    if (mode === 'text' && (gemini.state === 'connected' || gemini.state === 'connecting')) {
      gemini.disconnect()
    }
    setAvatarMode(mode)
    localStorage.setItem(MODE_KEY, mode)
  }

  function handleStartVoice() {
    setErrorMessage('')
    // resumePlayback MUST run synchronously in the onClick to satisfy browser autoplay policy
    gemini.resumePlayback()
    gemini.connect()
  }

  // ── Text-mode send (SSE streaming) ────────────────────────────────────────────
  const handleTextSend = useCallback(async () => {
    const text = textInput.trim()
    if (!text || isTextLoading) return

    setTextInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const uid = `u-${Date.now()}`
    const aid = `a-${Date.now()}`

    setTextMsgs(prev => [
      ...prev,
      { id: uid, role: 'user', content: text },
      { id: aid, role: 'assistant', content: '', streaming: true },
    ])
    setIsTextLoading(true)

    try {
      const res = await fetch('/api/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessao_id: sessaoId, mensagem: text }),
      })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          if (payload === '[DONE]') break
          try {
            const parsed = JSON.parse(payload) as { text?: string; error?: string }
            if (parsed.error) throw new Error(parsed.error)
            if (parsed.text) {
              setTextMsgs(prev => prev.map(m =>
                m.id === aid ? { ...m, content: m.content + parsed.text } : m
              ))
            }
          } catch { /* ignore malformed SSE lines */ }
        }
      }

      setTextMsgs(prev => prev.map(m => m.id === aid ? { ...m, streaming: false } : m))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setTextMsgs(prev => prev.map(m =>
        m.id === aid ? { ...m, content: `Não consegui responder. ${msg}`, streaming: false } : m
      ))
    } finally {
      setIsTextLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textInput, isTextLoading, sessaoId])

  async function handleConcluir() {
    setIsConcluindo(true)
    try {
      let patchBody: Record<string, unknown> = { estado: 'concluida' }

      if (avatarMode === 'voice') {
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

        gemini.disconnect()
        patchBody = { ...patchBody, voice_transcript: voiceTranscript, voice_duration_minutes: voiceDurationMinutes }
      }

      const res = await fetch(`/api/avatar/sessoes/${sessaoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
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

  async function handleApagar() {
    setIsApagando(true)
    try {
      if (gemini.state === 'connected' || gemini.state === 'connecting') gemini.disconnect()
      const res = await fetch(`/api/avatar/sessoes/${sessaoId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Sessão apagada.')
        router.push('/avatares')
      } else {
        toast.error('Não foi possível apagar a sessão.')
        setMostrarConfirmApagar(false)
      }
    } catch {
      toast.error('Erro ao apagar sessão.')
      setMostrarConfirmApagar(false)
    } finally {
      setIsApagando(false)
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

      {mostrarConfirmApagar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="rounded-xl border p-6 space-y-4 max-w-sm w-full mx-4 shadow-xl"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="space-y-1.5">
              <p className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>
                Apagar sessão?
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                Esta acção é irreversível. Todas as mensagens serão apagadas e serás redireccionado para os Avatares.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMostrarConfirmApagar(false)}
                disabled={isApagando}
                className="px-3 h-8 rounded-md text-xs border transition-colors disabled:opacity-50"
                style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApagar}
                disabled={isApagando}
                className="px-3 h-8 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
                style={{ background: 'oklch(0.52 0.22 25)', color: 'white' }}
              >
                {isApagando ? 'A apagar…' : 'Apagar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 min-h-0">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-4 md:px-5 py-3 border-b shrink-0"
          style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
        >
          {/* Avatar info */}
          <div className="flex items-center gap-3">
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

          {/* Mode toggle + session actions */}
          <div className="flex items-center gap-3">
            {/* 💬 Texto / 🎤 Voz toggle */}
            {!concluida && (
              <div className="flex items-center gap-1 rounded-md border p-0.5" style={{ borderColor: 'var(--border)' }}>
                <button
                  type="button"
                  onClick={() => switchMode('text')}
                  className="text-xs px-2.5 h-6 rounded transition-colors"
                  style={{
                    background: avatarMode === 'text' ? color.bg : 'transparent',
                    color: avatarMode === 'text' ? color.fg : 'var(--muted-foreground)',
                  }}
                >
                  💬 Texto
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('voice')}
                  className="text-xs px-2.5 h-6 rounded transition-colors"
                  style={{
                    background: avatarMode === 'voice' ? color.bg : 'transparent',
                    color: avatarMode === 'voice' ? color.fg : 'var(--muted-foreground)',
                  }}
                >
                  🎤 Voz
                </button>
              </div>
            )}

            {/* Session actions */}
            {concluida ? (
              <>
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Sessão concluída</span>
                <Button size="sm" variant="outline" onClick={() => setMostrarFicheiro(true)}>
                  Ver ficheiro
                </Button>
              </>
            ) : !mostrarConfirmConcluir ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMostrarConfirmApagar(true)}
                  className="p-1.5 rounded transition-colors"
                  style={{ color: 'var(--muted-foreground)' }}
                  title="Apagar sessão"
                >
                  🗑️
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarConfirmConcluir(true)}
                  className="text-xs underline"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  Concluir sessão
                </button>
              </div>
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

        {/* Cost indicator */}
        {!concluida && (
          <div
            className="px-4 py-1.5 border-b shrink-0 flex items-center gap-2 text-xs"
            style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--muted-foreground)' }}
          >
            <span>💬 Texto: gratuito</span>
            <span>·</span>
            <span>🎤 Voz: 0.02€/min</span>
          </div>
        )}

        {/* ── Body ─────────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">

          {/* ── Text mode: text messages ─────────────────────────────────────── */}
          {avatarMode === 'text' && (
            <>
              {textMsgs.map(m => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'user' ? (
                    <div
                      className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed"
                      style={{
                        background: 'oklch(0.965 0.008 85)',
                        color: 'var(--foreground)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {m.content}
                    </div>
                  ) : (
                    <div className="flex items-start gap-2.5 max-w-[85%]">
                      <div className="relative w-7 h-7 shrink-0 mt-1">
                        <Image src={dicebearSrc} alt={avatarNome} width={28} height={28} className="rounded-full" unoptimized />
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
                        {m.content || (
                          <span className="inline-flex gap-1">
                            {[0, 150, 300].map(d => (
                              <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--muted-foreground)', animationDelay: `${d}ms` }} />
                            ))}
                          </span>
                        )}
                        {m.streaming && m.content && (
                          <span className="inline-block w-0.5 h-4 ml-0.5 animate-pulse align-middle" style={{ background: color.bg }} />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {textMsgs.length === 0 && !concluida && (
                <div className="h-full flex items-center justify-center min-h-48">
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Apresenta-te e começa a sessão em modo texto.
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── Voice mode: transcript lines ─────────────────────────────────── */}
          {avatarMode === 'voice' && (
            <>
              {transcriptLines.map((line, i) => (
                <div key={i} className={`flex ${line.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {line.role === 'user' ? (
                    <div
                      className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed"
                      style={{ background: 'oklch(0.965 0.008 85)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                    >
                      {line.text}
                    </div>
                  ) : (
                    <div className="flex items-start gap-2.5 max-w-[85%]">
                      <div className="relative w-7 h-7 shrink-0 mt-1">
                        <Image src={dicebearSrc} alt={avatarNome} width={28} height={28} className="rounded-full" unoptimized />
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

              {transcriptLines.length === 0 && gemini.state === 'idle' && !concluida && (
                <div className="h-full flex items-center justify-center min-h-48">
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Inicia a sessão de voz para começar.
                  </p>
                </div>
              )}

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
            </>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────────── */}
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
        ) : avatarMode === 'text' ? (

          /* ── Text-mode footer: textarea input ────────────────────────────── */
          <div className="p-3 border-t shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
            <div className="flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                value={textInput}
                onChange={e => {
                  setTextInput(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTextSend() }
                }}
                disabled={isTextLoading}
                placeholder={`Fala com ${avatarNome}…`}
                rows={1}
                className="flex-1 rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1"
                style={{
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                  overflow: 'hidden',
                  minHeight: '2.5rem',
                  maxHeight: '7.5rem',
                }}
              />
              <button
                type="button"
                onClick={handleTextSend}
                disabled={isTextLoading || !textInput.trim()}
                className="shrink-0 h-10 px-3 rounded-lg text-sm font-medium disabled:opacity-50"
                style={{ background: color.bg, color: color.fg }}
              >
                {isTextLoading ? '…' : '→'}
              </button>
            </div>
          </div>

        ) : (

          /* ── Voice-mode footer: Gemini Live controls ─────────────────────── */
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
                <div className="relative flex items-center justify-center w-10 h-10">
                  <span className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ background: color.bg }} />
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
