'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import type { SessaoAvatar, Mensagem, AvatarReport } from '@/lib/types'
import type { FicheiroSecreto } from '@/lib/types'
import { MarkdownContent } from '@/components/supervisor/MarkdownContent'
import { FicheiroModal } from './FicheiroModal'
import { Button } from '@/components/ui/button'

interface ChatMsg {
  id: string
  papel: 'user' | 'assistant'
  conteudo: string
  streaming?: boolean
}

const AVATAR_COLORS: Record<string, { bg: string; fg: string }> = {
  mariana: { bg: 'oklch(0.26 0.15 252)', fg: 'white' },
  carlos:  { bg: 'oklch(0.38 0.05 245)', fg: 'white' },
  miguel:  { bg: 'oklch(0.38 0.18 288)', fg: 'white' },
  beatriz: { bg: 'oklch(0.48 0.08 148)', fg: 'white' },
}

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
  const [msgs, setMsgs] = useState<ChatMsg[]>(
    mensagensIniciais
      .filter(m => m.papel !== 'system')
      .map(m => ({ id: m.id, papel: m.papel as 'user' | 'assistant', conteudo: m.conteudo }))
  )
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isConcluindo, setIsConcluindo] = useState(false)
  const [mostrarConfirmConcluir, setMostrarConfirmConcluir] = useState(false)
  const [mostrarFicheiro, setMostrarFicheiro] = useState(false)
  const [report, setReport] = useState<AvatarReport | null>(null)
  const [isGerandoRelatorio, setIsGerandoRelatorio] = useState(false)

  // TTS
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const concluida = sessao.estado === 'concluida'

  const color = AVATAR_COLORS[avatarSlug] ?? { bg: 'oklch(0.42 0.08 252)', fg: 'white' }
  const dicebearSrc = `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(avatarNome)}`

  // Load voice preference + admin status
  useEffect(() => {
    const saved = localStorage.getItem('avatar_voice_enabled')
    if (saved === 'true') setVoiceEnabled(true)

    fetch('/api/credits')
      .then(r => r.json())
      .then(d => { setIsAdmin(d.isAdmin ?? false) })
      .catch(() => {})
  }, [])

  // Load cached report for already-concluded sessions
  useEffect(() => {
    if (!concluida || report) return
    const notas = (sessaoInicial.notas_evolucao ?? {}) as Record<string, unknown>
    if (notas.avatar_report) {
      setReport(notas.avatar_report as AvatarReport)
    }
  }, [concluida]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  function toggleVoice() {
    const next = !voiceEnabled
    setVoiceEnabled(next)
    localStorage.setItem('avatar_voice_enabled', String(next))
  }

  async function playTts(text: string) {
    if (!voiceEnabled || isPlaying) return
    setIsPlaying(true)
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (res.status === 402) {
        if (!isAdmin) {
          setVoiceEnabled(false)
          localStorage.setItem('avatar_voice_enabled', 'false')
          toast.error('Saldo insuficiente para voz — recarrega créditos')
        }
        setIsPlaying(false)
        return
      }
      if (!res.ok) { setIsPlaying(false); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      if (audioRef.current) {
        audioRef.current.pause()
        URL.revokeObjectURL(audioRef.current.src)
      }
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        setIsPlaying(false)
        URL.revokeObjectURL(url)
      }
      audio.onerror = () => setIsPlaying(false)
      await audio.play()
    } catch {
      setIsPlaying(false)
    }
  }

  function resetTextarea() {
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`
  }

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming || concluida) return
    resetTextarea()

    const uid = `u-${Date.now()}`
    const aid = `a-${Date.now()}`

    setMsgs(prev => [
      ...prev,
      { id: uid, papel: 'user', conteudo: text },
      { id: aid, papel: 'assistant', conteudo: '', streaming: true },
    ])
    setIsStreaming(true)

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
      let full = ''

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
              full += parsed.text
              setMsgs(prev => prev.map(m => m.id === aid ? { ...m, conteudo: full } : m))
            }
          } catch { /* ignore malformed lines */ }
        }
      }

      setMsgs(prev => prev.map(m => m.id === aid ? { ...m, streaming: false } : m))

      // Play TTS after streaming completes
      if (full && voiceEnabled) await playTts(full)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setMsgs(prev => prev.map(m =>
        m.id === aid
          ? { ...m, conteudo: `Não foi possível continuar a sessão. ${msg}`, streaming: false }
          : m
      ))
    } finally {
      setIsStreaming(false)
    }
  }, [input, isStreaming, concluida, sessaoId, voiceEnabled, isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConcluir() {
    setIsConcluindo(true)
    try {
      const res = await fetch(`/api/avatar/sessoes/${sessaoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'concluida' }),
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
          .catch(err => {
            console.error('[report] fetch failed:', err)
          })
          .finally(() => setIsGerandoRelatorio(false))
      }
    } catch {
      toast.error('Não foi possível continuar a sessão. Tenta daqui a pouco.')
    } finally {
      setIsConcluindo(false)
    }
  }

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

        {/* Avatar header */}
        <div
          className="flex items-center justify-between px-4 md:px-5 py-3 border-b shrink-0"
          style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
        >
          <div className="flex items-center gap-3">
            {/* Avatar image with ping ring when speaking */}
            <div className="relative w-9 h-9 shrink-0">
              <Image
                src={dicebearSrc}
                alt={avatarNome}
                width={36}
                height={36}
                className="rounded-full"
                unoptimized
              />
              {/* Fallback initial */}
              <div
                className="absolute inset-0 rounded-full flex items-center justify-center text-sm font-semibold -z-10"
                style={{ background: color.bg, color: color.fg }}
              >
                {avatarNome[0]}
              </div>
              {/* Speaking indicator */}
              {isPlaying && (
                <span
                  className="absolute inset-0 rounded-full animate-ping"
                  style={{ background: `${color.bg.replace(')', ' / 0.35)')}` }}
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

          <div className="flex items-center gap-2">
            {/* Voice toggle */}
            {!concluida && (
              <button
                type="button"
                onClick={toggleVoice}
                className="text-base leading-none p-1 rounded transition-colors"
                style={{ color: voiceEnabled ? color.bg : 'var(--muted-foreground)' }}
                title={voiceEnabled ? 'Desactivar voz' : 'Activar voz'}
              >
                {voiceEnabled ? '🔊' : '🔇'}
              </button>
            )}

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
                <span className="text-xs hidden sm:inline" style={{ color: 'var(--foreground)' }}>Confirmar?</span>
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

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {msgs.length === 0 && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-1 max-w-xs">
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  A aguardar resposta de {avatarNome}…
                </p>
              </div>
            </div>
          )}

          {msgs.map(m => (
            <div key={m.id} className={`flex ${m.papel === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.papel === 'user' ? (
                <div
                  className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed"
                  style={{
                    background: 'oklch(0.965 0.008 85)',
                    color: 'var(--foreground)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {m.conteudo}
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
                    className="rounded-2xl rounded-tl-sm px-4 py-3"
                    style={{
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {m.conteudo ? (
                      <MarkdownContent text={m.conteudo} />
                    ) : (
                      <span className="inline-flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--muted-foreground)', animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--muted-foreground)', animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--muted-foreground)', animationDelay: '300ms' }} />
                      </span>
                    )}
                    {m.streaming && m.conteudo && (
                      <span
                        className="inline-block w-0.5 h-4 ml-0.5 animate-pulse align-middle"
                        style={{ background: color.bg }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
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
            className="p-3 md:p-4 border-t"
            style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
          >
            <div className="flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                disabled={isStreaming}
                placeholder="A tua intervenção terapêutica… (Enter para enviar)"
                rows={1}
                className="flex-1 rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1"
                style={{
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                  overflow: 'hidden',
                  minHeight: '2.5rem',
                  maxHeight: '11.25rem',
                  lineHeight: '1.5',
                }}
              />
              <Button
                onClick={handleSend}
                disabled={isStreaming || !input.trim()}
                size="sm"
                className="shrink-0 h-10"
              >
                {isStreaming ? '…' : 'Enviar'}
              </Button>
            </div>
            <p className="text-xs mt-1.5 ml-1" style={{ color: 'var(--muted-foreground)' }}>
              Enter envia · Shift+Enter nova linha
            </p>
          </div>
        )}
      </div>
    </>
  )
}
