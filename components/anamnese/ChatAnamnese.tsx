'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getAnamneseAvatarPublico } from '@/lib/anamnese/avataresPublicos'
import { BlocoSupervisorAnamnese } from './BlocoSupervisorAnamnese'
import { RelatorioAnamneseView } from './RelatorioAnamnese'
import { Button } from '@/components/ui/button'
import type { SessaoAnamnese, TurnoConversa, RelatorioAnamnese, IntervencaoResult } from '@/lib/anamnese/types'

interface Props {
  sessao: SessaoAnamnese
}

interface TurnoResponse {
  turno: TurnoConversa
  avatar: string
  intervencao: IntervencaoResult
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
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [speakingRole, setSpeakingRole] = useState<SpeakingRole>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const concluida = sessao.estado === 'concluida' || relatorio !== null

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const startRef = useRef<number>(new Date(sessao.created_at).getTime() || Date.now())

  useEffect(() => {
    // Sessão criada em modo voz liga o 🔊 automaticamente; localStorage é override manual
    setVoiceEnabled(sessao.modo === 'voz' || localStorage.getItem(VOICE_KEY) === 'true')
  }, [sessao.modo])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, pendingTerapeuta, relatorio, isGeneratingReport])

  // Stop audio on unmount
  useEffect(() => {
    return () => { audioRef.current?.pause(); audioRef.current = null }
  }, [])

  // ── Síntese de voz (cliente: Gemini · supervisor: ElevenLabs Hugo) ───────────
  const speak = useCallback(async (endpoint: string, payload: Record<string, unknown>, role: SpeakingRole) => {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.status === 402) {
        toast.warning('Saldo insuficiente para voz. Recarrega créditos na página Créditos.')
        setVoiceEnabled(false)
        localStorage.setItem(VOICE_KEY, 'false')
        return
      }
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      // Interrompe qualquer áudio em curso
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

  const speakCliente = useCallback((texto: string) => {
    if (texto) void speak('/api/anamnese/tts', { text: texto, voice: voz }, 'cliente')
  }, [speak, voz])

  const speakSupervisor = useCallback((texto: string) => {
    if (texto) void speak('/api/tts', { text: texto }, 'supervisor')
  }, [speak])

  const playTurnVoice = useCallback(async (turn: TurnoConversa) => {
    if (turn.avatar) await speak('/api/anamnese/tts', { text: turn.avatar, voice: voz }, 'cliente')
    if (turn.supervisor_interveio && turn.intervencao_supervisor) {
      await speak('/api/tts', { text: turn.intervencao_supervisor }, 'supervisor')
    }
  }, [speak, voz])

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(prev => {
      const next = !prev
      localStorage.setItem(VOICE_KEY, String(next))
      if (!next) { audioRef.current?.pause(); audioRef.current = null; setSpeakingRole(null) }
      return next
    })
  }, [])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading || concluida) return

    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setPendingTerapeuta(text)
    setIsLoading(true)

    try {
      const res = await fetch('/api/anamnese/turno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessao_id: sessao.id, mensagem: text }),
      })
      if (res.status === 402) {
        toast.warning('Saldo insuficiente. Recarrega créditos na página Créditos.')
        setInput(text)
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as TurnoResponse
      setTurns(prev => [...prev, data.turno])
      if (voiceEnabled) void playTurnVoice(data.turno)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.error(`Não foi possível enviar. ${msg}`)
      setInput(text)
    } finally {
      setPendingTerapeuta(null)
      setIsLoading(false)
    }
  }, [input, isLoading, concluida, sessao.id, voiceEnabled, playTurnVoice])

  const handleConcluir = useCallback(async () => {
    setIsGeneratingReport(true)
    setMostrarConfirmConcluir(false)
    audioRef.current?.pause()
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
  }, [sessao.id])

  const handleApagar = useCallback(async () => {
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
  }, [sessao.id, router])

  const temTurnosReais = turns.some(t => t.turno > 0)

  return (
    <>
      {/* Modal apagar */}
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

      <div
        className="rounded-lg border overflow-hidden flex flex-col"
        style={{ height: 'calc(100dvh - 9rem)', borderColor: 'var(--border)' }}
      >
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
            {/* Toggle voz */}
            <button
              type="button"
              onClick={toggleVoice}
              className="p-1.5 rounded transition-colors text-base leading-none"
              style={{ color: voiceEnabled ? cor : 'var(--muted-foreground)' }}
              title={voiceEnabled ? 'Desligar voz (cliente fala + Supervisor fala)' : 'Ligar voz'}
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
              {/* Terapeuta */}
              {turn.terapeuta && (
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed" style={{ background: 'oklch(0.965 0.008 85)', color: 'var(--foreground)', border: '1px solid var(--border)' }}>
                    {turn.terapeuta}
                  </div>
                </div>
              )}
              {/* Avatar / cliente */}
              {turn.avatar && (
                <div className="flex items-start gap-2.5 max-w-[85%] group">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0 mt-1" style={{ background: cor }}>
                    {avatar?.nome?.[0] ?? '?'}
                  </div>
                  <div className="rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}>
                    {turn.avatar}
                  </div>
                  <button
                    type="button"
                    onClick={() => speakCliente(turn.avatar)}
                    className="shrink-0 mt-1 p-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: cor }}
                    title={`Ouvir ${avatar?.nome ?? 'o cliente'}`}
                  >
                    🔈
                  </button>
                </div>
              )}
              {/* Supervisor */}
              {turn.supervisor_interveio && turn.intervencao_supervisor && turn.tipo_erro && (
                <BlocoSupervisorAnamnese
                  tipoErro={turn.tipo_erro}
                  intervencao={turn.intervencao_supervisor}
                  onPlay={() => speakSupervisor(turn.intervencao_supervisor!)}
                  isPlaying={speakingRole === 'supervisor'}
                />
              )}
            </div>
          ))}

          {/* Pending (turno em curso) */}
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

          {/* Relatório */}
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
              <button
                type="button"
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="shrink-0 h-10 px-3 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: cor }}
              >
                {isLoading ? '…' : '→'}
              </button>
            </div>
            <p className="text-xs mt-1.5 ml-1" style={{ color: 'var(--muted-foreground)' }}>
              {voiceEnabled ? '🔊 Voz ligada — o cliente e o Supervisor falam. ' : ''}
              O Supervisor intervém quando ficas no manifesto. Enter envia · Shift+Enter nova linha
            </p>
          </div>
        )}
      </div>
    </>
  )
}
