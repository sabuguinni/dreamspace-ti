'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import type { SessaoSupervisor, Mensagem } from '@/lib/types'
import { MarkdownContent } from './MarkdownContent'
import { MetodoBadge } from './MetodoBadge'
import { FlagBadge } from './FlagBadge'
import { Button } from '@/components/ui/button'

interface ChatMsg {
  id: string
  papel: 'user' | 'assistant'
  conteudo: string
  streaming?: boolean
}

interface Props {
  sessaoId: string
  sessaoInicial: SessaoSupervisor
  mensagensIniciais: Mensagem[]
  initialInput?: string
}

const VOICE_KEY = 'supervisor_voice_enabled'

export function SessaoChat({ sessaoId, sessaoInicial, mensagensIniciais, initialInput }: Props) {
  const [sessao, setSessao] = useState<SessaoSupervisor>(sessaoInicial)
  const [msgs, setMsgs] = useState<ChatMsg[]>(
    mensagensIniciais
      .filter(m => m.papel !== 'system')
      .map(m => ({ id: m.id, papel: m.papel as 'user' | 'assistant', conteudo: m.conteudo }))
  )
  const [input, setInput] = useState(initialInput ?? '')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isConcluindo, setIsConcluindo] = useState(false)
  const [mostrarConcluir, setMostrarConcluir] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [balanceCents, setBalanceCents] = useState<number | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const concluida = sessao.estado === 'concluida'

  useEffect(() => {
    setVoiceEnabled(localStorage.getItem(VOICE_KEY) === 'true')
    fetch('/api/credits').then(r => r.json()).then(d => setBalanceCents(d.balanceCents ?? 0)).catch(() => {})
  }, [])

  // Auto-scroll sempre que as msgs mudam
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  function toggleVoice() {
    const next = !voiceEnabled
    setVoiceEnabled(next)
    localStorage.setItem(VOICE_KEY, String(next))
  }

  async function playTts(text: string) {
    if (!voiceEnabled || isPlaying || !text) return
    setIsPlaying(true)
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (res.status === 402) {
        setVoiceEnabled(false)
        localStorage.setItem(VOICE_KEY, 'false')
        toast.warning('Saldo insuficiente para voz. Recarrega créditos na página Créditos.')
        return
      }
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      if (audioRef.current) { audioRef.current.pause(); URL.revokeObjectURL(audioRef.current.src) }
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        setIsPlaying(false)
        URL.revokeObjectURL(url)
        fetch('/api/credits').then(r => r.json()).then(d => setBalanceCents(d.balanceCents ?? 0)).catch(() => {})
      }
      audio.onerror = () => setIsPlaying(false)
      await audio.play()
    } catch {
      setIsPlaying(false)
    }
  }

  function resetTextarea() {
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
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
      const res = await fetch('/api/supervisor', {
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
              setMsgs(prev => prev.map(m =>
                m.id === aid ? { ...m, conteudo: full } : m
              ))
            }
          } catch { /* ignorar linhas malformadas */ }
        }
      }

      // Finalizar mensagem
      setMsgs(prev => prev.map(m =>
        m.id === aid ? { ...m, streaming: false } : m
      ))

      // Voz opcional após resposta completa
      if (full) await playTts(full)

      // Actualizar sessão (flags)
      fetch(`/api/supervisor/sessoes/${sessaoId}`)
        .then(r => r.json())
        .then(({ sessao: s }: { sessao: SessaoSupervisor }) => { if (s) setSessao(s) })
        .catch(() => {})

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setMsgs(prev => prev.map(m =>
        m.id === aid
          ? { ...m, conteudo: `Não foi possível comunicar com o Supervisor. ${msg}`, streaming: false }
          : m
      ))
    } finally {
      setIsStreaming(false)
    }
  }, [input, isStreaming, concluida, sessaoId])

  async function handleConcluir() {
    setIsConcluindo(true)
    try {
      const res = await fetch(`/api/supervisor/sessoes/${sessaoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'concluida' }),
      })
      if (res.ok) {
        setSessao(prev => ({ ...prev, estado: 'concluida' }))
        setMostrarConcluir(false)
        toast.success('Sessão concluída. Bom trabalho.')
      }
    } catch {
      toast.error('Não foi possível guardar a sessão. Tenta daqui a pouco.')
    } finally {
      setIsConcluindo(false)
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-0 overflow-hidden" style={{ minHeight: 0, flex: 1 }}>

      {/* ── Painel esquerdo: contexto ───────────────────────── */}
      <aside
        className="lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r overflow-y-auto max-h-44 lg:max-h-none"
        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
      >
        <div className="p-5 space-y-5">

          {/* Sonho */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
              Sonho
            </p>
            <p
              className="text-xs leading-relaxed line-clamp-6 rounded-md p-3"
              style={{
                color: 'var(--foreground)',
                background: 'oklch(0.965 0.008 85)',
                fontFamily: 'var(--font-jetbrains)',
                borderLeft: '3px solid oklch(0.375 0.132 288 / 0.4)',
              }}
            >
              {sessao.sonho_texto}
            </p>
          </div>

          {/* Método */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
              Método
            </p>
            <MetodoBadge metodo={sessao.metodo_escolhido} />
          </div>

          {/* Flags */}
          {sessao.flags_detectados.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
                Padrões identificados
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sessao.flags_detectados.map(f => <FlagBadge key={f} flag={f} />)}
              </div>
            </div>
          )}

          {/* Estado + botão concluir */}
          <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            {concluida ? (
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Sessão concluída.
              </p>
            ) : !mostrarConcluir ? (
              <button
                type="button"
                onClick={() => setMostrarConcluir(true)}
                className="text-xs underline"
                style={{ color: 'var(--muted-foreground)' }}
              >
                Concluir sessão
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs" style={{ color: 'var(--foreground)' }}>
                  Confirmar conclusão?
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleConcluir} disabled={isConcluindo}>
                    {isConcluindo ? 'A concluir…' : 'Confirmar'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setMostrarConcluir(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Área de chat ─────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-h-0">

        {/* Barra voz + saldo */}
        <div
          className="flex items-center justify-end gap-3 px-4 py-2 border-b shrink-0"
          style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
        >
          {balanceCents !== null && (
            <a
              href="/creditos"
              className="text-xs"
              style={{ color: 'var(--muted-foreground)' }}
              title="Ver créditos"
            >
              {(balanceCents / 100).toFixed(2)}€
            </a>
          )}
          <button
            type="button"
            onClick={toggleVoice}
            className="text-base leading-none"
            style={{ color: voiceEnabled ? 'oklch(0.42 0.12 288)' : 'var(--muted-foreground)' }}
            title={voiceEnabled ? 'Desactivar voz do Supervisor' : 'Activar voz do Supervisor'}
          >
            {isPlaying ? '🔊' : voiceEnabled ? '🔊' : '🔇'}
          </button>
        </div>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {msgs.length === 0 && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-2 max-w-sm px-4">
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  Sessão iniciada
                </p>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Apresenta a tua análise inicial deste sonho. O Supervisor vai acompanhar-te pelos 4 níveis de reflexão socrática.
                </p>
              </div>
            </div>
          )}

          {msgs.map(m => (
            <div key={m.id} className={`flex ${m.papel === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.papel === 'user' ? (
                <div
                  className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed"
                  style={{ background: 'oklch(0.965 0.008 85)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                >
                  {m.conteudo}
                </div>
              ) : (
                <div
                  className="max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3"
                  style={{
                    background: 'var(--card)',
                    borderLeft: '3px solid oklch(0.631 0.118 65)',
                    border: '1px solid var(--border)',
                    borderLeftWidth: '3px',
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
                      style={{ background: 'oklch(0.631 0.118 65)' }}
                    />
                  )}
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
            Esta sessão foi concluída. Inicia uma nova para continuar a praticar.
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
                placeholder="A tua análise, reflexão ou pergunta… (Enter para enviar, Shift+Enter nova linha)"
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
    </div>
  )
}
