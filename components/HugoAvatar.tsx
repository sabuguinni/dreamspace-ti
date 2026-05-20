'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

const HISTORY_KEY = 'hugo_chat_history'
const MAX_HISTORY = 20

/** Inline markdown: **bold** and *italic* → HTML. Content comes from our own API so XSS risk is minimal. */
function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br />')
}

interface Props {
  initialMessage?: string
  onClose?: () => void
}

export function HugoAvatar({ initialMessage, onClose }: Props) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [balanceCents, setBalanceCents] = useState<number | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [insufficientVoice, setInsufficientVoice] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load voice preference, balance, and persisted chat history
  useEffect(() => {
    const saved = localStorage.getItem('hugo_voice_enabled')
    if (saved === 'true') setVoiceEnabled(true)

    fetch('/api/credits')
      .then(r => r.json())
      .then(d => {
        setBalanceCents(d.balanceCents ?? 0)
        setIsAdmin(d.isAdmin ?? false)
      })
      .catch(() => {})

    // Restore persisted history; fall back to initialMessage if none
    const storedRaw = localStorage.getItem(HISTORY_KEY)
    if (storedRaw) {
      try {
        const parsed = JSON.parse(storedRaw) as ChatMsg[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMsgs(parsed)
          return
        }
      } catch { /* corrupt data — ignore */ }
    }
    if (initialMessage) {
      setMsgs([{ id: 'init', role: 'assistant', content: initialMessage }])
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist history whenever messages change (skip empty + streaming states)
  useEffect(() => {
    if (msgs.length === 0) return
    const stable = msgs.filter(m => !m.streaming).slice(-MAX_HISTORY)
    if (stable.length === 0) return
    localStorage.setItem(HISTORY_KEY, JSON.stringify(stable))
  }, [msgs])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  // Cleanup audio on unmount — prevent playback leak and state updates on unmounted component
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current = null
      }
    }
  }, [])

  function handleCloseClick() {
    onClose?.()
  }

  function handleNewConversation() {
    localStorage.removeItem(HISTORY_KEY)
    setMsgs(initialMessage ? [{ id: 'init', role: 'assistant', content: initialMessage }] : [])
  }

  function toggleVoice() {
    const next = !voiceEnabled
    setVoiceEnabled(next)
    localStorage.setItem('hugo_voice_enabled', String(next))
    setInsufficientVoice(false)
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
          setInsufficientVoice(true)
          setVoiceEnabled(false)
          localStorage.setItem('hugo_voice_enabled', 'false')
        }
        return
      }
      if (!res.ok) return
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
        fetch('/api/credits').then(r => r.json()).then(d => {
          setBalanceCents(d.balanceCents ?? 0)
          setIsAdmin(d.isAdmin ?? false)
        }).catch(() => {})
      }
      audio.onerror = () => setIsPlaying(false)
      await audio.play()
    } catch {
      setIsPlaying(false)
    }
  }

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading) return

    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const uid = `u-${Date.now()}`
    const aid = `a-${Date.now()}`

    const history = msgs.filter(m => !m.streaming).map(m => ({ role: m.role, content: m.content }))

    setMsgs(prev => [
      ...prev,
      { id: uid, role: 'user', content: text },
      { id: aid, role: 'assistant', content: '', streaming: true },
    ])
    setIsLoading(true)

    // ── Voice mode: streaming audio via MediaSource API ─────────────────────
    if (voiceEnabled) {
      try {
        const res = await fetch('/api/hugo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, history, voice: true }),
        })
        if (res.status === 402) {
          if (!isAdmin) {
            setInsufficientVoice(true)
            setVoiceEnabled(false)
            localStorage.setItem('hugo_voice_enabled', 'false')
          }
          setMsgs(prev => prev.map(m =>
            m.id === aid ? { ...m, content: 'Saldo insuficiente para usar voz.', streaming: false } : m
          ))
          return
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        // Show text immediately from header — no waiting for audio to finish
        const rawHeader = res.headers.get('X-Hugo-Text') ?? ''
        const replyText = rawHeader ? decodeURIComponent(rawHeader) : '…'
        setMsgs(prev => prev.map(m => m.id === aid ? { ...m, content: replyText, streaming: false } : m))

        // Stream audio — MediaSource for Chrome/Firefox, blob fallback for Safari
        setIsPlaying(true)
        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current = null
        }

        const MIME = 'audio/mpeg'
        const supportsMediaSource = typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(MIME)

        if (supportsMediaSource) {
          const mediaSource = new MediaSource()
          const audioUrl = URL.createObjectURL(mediaSource)
          const audioEl = new Audio(audioUrl)
          audioRef.current = audioEl

          const refreshCredits = () => {
            fetch('/api/credits').then(r => r.json()).then(d => {
              setBalanceCents(d.balanceCents ?? 0)
              setIsAdmin(d.isAdmin ?? false)
            }).catch(() => {})
          }

          audioEl.onended = () => { setIsPlaying(false); URL.revokeObjectURL(audioUrl); refreshCredits() }
          audioEl.onerror = () => { setIsPlaying(false); URL.revokeObjectURL(audioUrl) }

          mediaSource.addEventListener('sourceopen', async () => {
            try {
              const sb = mediaSource.addSourceBuffer(MIME)
              const reader = res.body!.getReader()

              const pump = async (): Promise<void> => {
                const { done, value } = await reader.read()
                if (done) {
                  const end = () => { if (mediaSource.readyState === 'open') mediaSource.endOfStream() }
                  if (!sb.updating) end()
                  else sb.addEventListener('updateend', end, { once: true })
                  return
                }
                const append = () => {
                  sb.appendBuffer(value)
                  sb.addEventListener('updateend', pump, { once: true })
                }
                if (!sb.updating) append()
                else sb.addEventListener('updateend', append, { once: true })
              }

              pump().catch(err => { console.error('[Hugo stream]', err); setIsPlaying(false) })
              await audioEl.play().catch(() => setIsPlaying(false))
            } catch (err) {
              console.error('[Hugo MediaSource]', err)
              setIsPlaying(false)
            }
          }, { once: true })
        } else {
          // Safari fallback: collect full blob then play
          const blob = await res.blob()
          const blobUrl = URL.createObjectURL(blob)
          const audioEl = new Audio(blobUrl)
          audioRef.current = audioEl
          audioEl.onended = () => {
            setIsPlaying(false)
            URL.revokeObjectURL(blobUrl)
            fetch('/api/credits').then(r => r.json()).then(d => {
              setBalanceCents(d.balanceCents ?? 0)
              setIsAdmin(d.isAdmin ?? false)
            }).catch(() => {})
          }
          audioEl.onerror = () => { setIsPlaying(false); URL.revokeObjectURL(blobUrl) }
          await audioEl.play().catch(() => setIsPlaying(false))
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido'
        setMsgs(prev => prev.map(m =>
          m.id === aid ? { ...m, content: `Não consegui responder. ${msg}`, streaming: false } : m
        ))
      } finally {
        setIsLoading(false)
      }
      return
    }

    // ── Text mode: SSE stream ─────────────────────────────────────────────────
    try {
      const res = await fetch('/api/hugo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
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
              setMsgs(prev => prev.map(m => m.id === aid ? { ...m, content: full } : m))
            }
          } catch { /* ignore malformed lines */ }
        }
      }

      setMsgs(prev => prev.map(m => m.id === aid ? { ...m, streaming: false } : m))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setMsgs(prev => prev.map(m =>
        m.id === aid ? { ...m, content: `Não consegui responder. ${msg}`, streaming: false } : m
      ))
    } finally {
      setIsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, isAdmin, isLoading, msgs, voiceEnabled])

  const lmsUrl = 'https://app.transpersonalinternational.com/my-credits'
  const balanceLabel = isAdmin ? '∞' : (balanceCents !== null ? `${(balanceCents / 100).toFixed(2)}€` : '…')

  return (
    <div className="flex flex-col" style={{ width: '100%', height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative">
            <div
              className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-sm font-semibold"
              style={{ background: 'oklch(0.42 0.12 288)', color: 'white' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hugo-avatar.png"
                alt="Hugo"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  const span = e.currentTarget.nextElementSibling as HTMLElement | null
                  if (span) span.style.display = 'flex'
                }}
              />
              <span style={{ display: 'none' }} className="w-full h-full items-center justify-center">H</span>
            </div>
            {isPlaying && (
              <span
                className="absolute inset-0 rounded-full animate-ping"
                style={{ background: 'oklch(0.42 0.12 288 / 0.35)' }}
              />
            )}
          </div>
          <div>
            <p className="text-sm font-medium leading-tight" style={{ color: 'var(--foreground)' }}>Hugo</p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Guia da plataforma</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Balance */}
          <a
            href={lmsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2 py-0.5 rounded-full border"
            style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}
            title="Ver créditos"
          >
            {balanceLabel}
          </a>
          {/* Nova conversa */}
          <button
            type="button"
            onClick={handleNewConversation}
            className="text-sm leading-none p-1 rounded"
            style={{ color: 'var(--muted-foreground)' }}
            title="Nova conversa"
          >
            🗑️
          </button>
          {/* Voice toggle */}
          <button
            type="button"
            onClick={toggleVoice}
            className="text-base leading-none p-1 rounded"
            style={{ color: voiceEnabled ? 'oklch(0.42 0.12 288)' : 'var(--muted-foreground)' }}
            title={voiceEnabled ? 'Desactivar voz' : 'Activar voz'}
          >
            {voiceEnabled ? '🔊' : '🔇'}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={handleCloseClick}
              className="text-lg leading-none p-1 rounded"
              style={{ color: 'var(--muted-foreground)' }}
              title="Fechar"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Insufficient voice warning */}
      {insufficientVoice && !isAdmin && (
        <div
          className="px-4 py-2 text-xs text-center border-b"
          style={{ background: 'oklch(0.98 0.02 85)', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
        >
          Saldo insuficiente para voz.{' '}
          <a href={lmsUrl} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'oklch(0.42 0.12 288)' }}>
            Recarrega créditos
          </a>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 0 }}>
        {msgs.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
              Olá! Como posso ajudar?
            </p>
          </div>
        )}
        {msgs.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'user' ? (
              <div
                className="max-w-[80%] rounded-2xl rounded-tr-sm px-3 py-2 text-sm leading-relaxed"
                style={{ background: 'oklch(0.965 0.008 85)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
              >
                {m.content}
              </div>
            ) : (
              <div
                className="max-w-[85%] rounded-2xl rounded-tl-sm px-3 py-2 text-sm leading-relaxed"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', borderLeft: '3px solid oklch(0.42 0.12 288)' }}
              >
                {m.content ? (
                  <>
                    <span dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                    {m.streaming && (
                      <span className="inline-block w-0.5 h-4 ml-0.5 animate-pulse align-middle" style={{ background: 'oklch(0.42 0.12 288)' }} />
                    )}
                  </>
                ) : (
                  <span className="inline-flex gap-1">
                    {[0, 150, 300].map(d => (
                      <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--muted-foreground)', animationDelay: `${d}ms` }} />
                    ))}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
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
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
            }}
            disabled={isLoading}
            placeholder="Pergunta sobre a plataforma…"
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
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="shrink-0 h-10 px-3 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: 'oklch(0.42 0.12 288)', color: 'white' }}
          >
            {isLoading ? '…' : '→'}
          </button>
        </div>
      </div>
    </div>
  )
}
