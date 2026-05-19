'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import type { SessaoSupervisor, Mensagem, SupervisorReport } from '@/lib/types'
import { MarkdownContent } from './MarkdownContent'
import { MetodoBadge } from './MetodoBadge'
import { FlagBadge } from './FlagBadge'
import { Button } from '@/components/ui/button'
import { useGeminiLive } from '@/lib/hooks/useGeminiLive'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMsg {
  id: string
  papel: 'user' | 'assistant'
  conteudo: string
  streaming?: boolean
}

type SupervisorMode = 'text' | 'voice'

type VoiceTranscriptLine = { role: 'user' | 'supervisor'; text: string }

interface HybridHistoryItem {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  sessaoId: string
  sessaoInicial: SessaoSupervisor
  mensagensIniciais: Mensagem[]
  initialInput?: string
}

const MODE_KEY = 'supervisor_mode'
const VOICE_KEY = 'supervisor_voice_enabled'

const SUPERVISOR_COLOR = 'oklch(0.631 0.118 65)'  // warm amber — supervisor accent
const HUGO_COLOR = 'oklch(0.5 0.18 290)'           // purple — Hugo avatar

// ─── Report sub-components ────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return 'oklch(0.55 0.18 145)'  // green
  if (score >= 60) return 'oklch(0.65 0.18 65)'   // amber
  return 'oklch(0.52 0.22 25)'                     // red
}

function ScoreCircle({ score }: { score: number }) {
  const color = scoreColor(score)
  return (
    <div
      className="flex items-center justify-center w-16 h-16 rounded-full border-4 text-lg font-bold shrink-0"
      style={{ borderColor: color, color, background: `${color}18` }}
    >
      {score}
    </div>
  )
}

function DimensaoCard({ label, dimensao }: { label: string; dimensao: { score: number; feedback: string } }) {
  const color = scoreColor(dimensao.score)
  return (
    <div className="rounded-lg border p-3 space-y-1.5" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{label}</span>
        <span className="text-xs font-bold shrink-0" style={{ color }}>{dimensao.score}</span>
      </div>
      {/* Score bar */}
      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--muted)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${dimensao.score}%`, background: color }} />
      </div>
      <p className="text-xs leading-snug" style={{ color: 'var(--muted-foreground)' }}>{dimensao.feedback}</p>
    </div>
  )
}

function SupervisorReportPanel({ report, sessaoId }: { report: SupervisorReport; sessaoId: string }) {
  const overallColor = scoreColor(report.overallScore)
  return (
    <div
      className="mt-6 rounded-2xl border p-5 space-y-5"
      style={{ borderColor: `${overallColor}60`, background: 'var(--card)', borderLeft: `4px solid ${overallColor}` }}
    >
      {/* Header */}
      <div className="flex items-start gap-4">
        <ScoreCircle score={report.overallScore} />
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Avaliação da Sessão</p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{report.summary}</p>
        </div>
      </div>

      {/* 6 Dimensions grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <DimensaoCard label="Método aplicado" dimensao={report.metodoAplicado} />
        <DimensaoCard label="Perguntas socráticas" dimensao={report.perguntasSocraticas} />
        <DimensaoCard label="Evitou interpretação directa" dimensao={report.evitouInterpretacaoDirecta} />
        <DimensaoCard label="Exploração do sonho" dimensao={report.exploracaoElementosSonho} />
        <DimensaoCard label="Ligação à vida concreta" dimensao={report.ligacaoVidaConcreta} />
        <DimensaoCard label="Linguagem terapêutica" dimensao={report.linguagemTerapeutica} />
      </div>

      {/* Strengths + Improvements */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'oklch(0.55 0.18 145)' }}>Pontos fortes</p>
          <ul className="space-y-1">
            {report.pontosFortesObservados.map((p, i) => (
              <li key={i} className="text-xs flex gap-1.5 items-start" style={{ color: 'var(--foreground)' }}>
                <span style={{ color: 'oklch(0.55 0.18 145)', marginTop: '0.15em' }}>✓</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'oklch(0.65 0.18 65)' }}>Áreas a desenvolver</p>
          <ul className="space-y-1">
            {report.areasMelhoria.map((a, i) => (
              <li key={i} className="text-xs flex gap-1.5 items-start" style={{ color: 'var(--foreground)' }}>
                <span style={{ color: 'oklch(0.65 0.18 65)', marginTop: '0.15em' }}>→</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Next steps */}
      <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--muted-foreground)' }}>Próximos passos</p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>{report.proximosPassos}</p>
      </div>

      {/* Download buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            fetch('/api/supervisor/sessoes/' + sessaoId + '/pdf?tipo=transcript')
              .then(r => { if (!r.ok) { toast.error('Transcricao nao disponivel'); return null; } return r.blob(); })
              .then(blob => { if (!blob) return; const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'transcricao-sessao-' + sessaoId.slice(0, 8) + '.pdf'; a.click(); URL.revokeObjectURL(url); })
              .catch(() => toast.error('Erro ao descarregar PDF'));
          }}
          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium border transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--background)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Transcrição PDF
        </button>
        <button
          type="button"
          onClick={() => {
            fetch('/api/supervisor/sessoes/' + sessaoId + '/pdf?tipo=relatorio')
              .then(r => { if (!r.ok) { toast.error('Relatorio nao disponivel'); return null; } return r.blob(); })
              .then(blob => { if (!blob) return; const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'relatorio-sessao-' + sessaoId.slice(0, 8) + '.pdf'; a.click(); URL.revokeObjectURL(url); })
              .catch(() => toast.error('Erro ao descarregar PDF'));
          }}
          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium border transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--background)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Relatório PDF
        </button>
      </div>
    </div>
  )
}

function ReportLoadingIndicator() {
  return (
    <div className="mt-6 flex items-center gap-3 justify-center rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
      <span className="inline-flex gap-1">
        {[0, 150, 300].map(d => (
          <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: SUPERVISOR_COLOR, animationDelay: `${d}ms` }} />
        ))}
      </span>
      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>A gerar avaliação da sessão…</p>
    </div>
  )
}

function ReportGenerateButton({ onGenerate }: { onGenerate: () => void }) {
  return (
    <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Avaliação IA disponível para esta sessão.</p>
      <button
        type="button"
        onClick={onGenerate}
        className="text-sm px-4 h-8 rounded-full font-medium transition-colors"
        style={{ background: SUPERVISOR_COLOR, color: 'white' }}
      >
        Gerar avaliação
      </button>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SessaoChat({ sessaoId, sessaoInicial, mensagensIniciais, initialInput }: Props) {
  const [sessao, setSessao] = useState<SessaoSupervisor>(sessaoInicial)
  const concluida = sessao.estado === 'concluida'

  // ── Text-mode state ──────────────────────────────────────────────────────────
  const [msgs, setMsgs] = useState<ChatMsg[]>(
    mensagensIniciais
      .filter(m => m.papel !== 'system')
      .map(m => ({ id: m.id, papel: m.papel as 'user' | 'assistant', conteudo: m.conteudo }))
  )
  const [input, setInput] = useState(initialInput ?? '')
  const [isStreaming, setIsStreaming] = useState(false)
  const [voiceTtsEnabled, setVoiceTtsEnabled] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // ── Voice-mode (hybrid) state ────────────────────────────────────────────────
  const [voiceTranscriptLines, setVoiceTranscriptLines] = useState<VoiceTranscriptLine[]>([])
  const [hybridHistory, setHybridHistory] = useState<HybridHistoryItem[]>([])
  // Keep history accessible in callbacks without stale-closure issues
  const hybridHistoryRef = useRef<HybridHistoryItem[]>([])
  useEffect(() => { hybridHistoryRef.current = hybridHistory }, [hybridHistory])
  const [liveUserSpeech, setLiveUserSpeech] = useState<string>('')
  const [isHugoThinking, setIsHugoThinking] = useState(false)
  const [isHugoSpeaking, setIsHugoSpeaking] = useState(false)
  const hugoAudioRef = useRef<HTMLAudioElement | null>(null)
  const voiceStartRef = useRef<number | null>(null)
  const [voiceErrorMsg, setVoiceErrorMsg] = useState<string>('')

  // Guard: prevent double-send when both VAD and manual button fire close together
  const isSendingRef = useRef(false)

  // ── AI Report ────────────────────────────────────────────────────────────────
  const [supervisorReport, setSupervisorReport] = useState<SupervisorReport | null>(null)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)

  // ── Shared ───────────────────────────────────────────────────────────────────
  const [supervisorMode, setSupervisorMode] = useState<SupervisorMode>('text')
  const [isConcluindo, setIsConcluindo] = useState(false)
  const [mostrarConcluir, setMostrarConcluir] = useState(false)
  const [balanceCents, setBalanceCents] = useState<number | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Init ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const storedMode = localStorage.getItem(MODE_KEY) as SupervisorMode | null
    if (storedMode === 'voice' || storedMode === 'text') setSupervisorMode(storedMode)
    setVoiceTtsEnabled(localStorage.getItem(VOICE_KEY) === 'true')
    fetch('/api/credits')
      .then(r => r.json())
      .then(d => { setBalanceCents(d.balanceCents ?? 0); setIsAdmin(d.isAdmin ?? false) })
      .catch(() => {})

    // Load existing report from mensagens (for concluded sessions)
    if (sessaoInicial.estado === 'concluida') {
      const reportMsg = mensagensIniciais.find(
        m => m.papel === 'system' &&
             (m.metadata as Record<string, unknown>)?.type === 'supervisor_report'
      )
      if (reportMsg) {
        try { setSupervisorReport(JSON.parse(reportMsg.conteudo) as SupervisorReport) } catch {}
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [voiceTranscriptLines])

  // ── Hybrid voice: handle user speech final (from Gemini VAD or manual send) ──
  const handleUserSpeechFinal = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    if (isSendingRef.current) return   // debounce: prevent VAD + button double-fire
    isSendingRef.current = true

    // Snapshot history now (ref always holds latest value without stale closures)
    const historySnapshot = [...hybridHistoryRef.current]

    setLiveUserSpeech('')
    setVoiceTranscriptLines(prev => [...prev, { role: 'user', text: trimmed }])
    setIsHugoThinking(true)

    try {
      const res = await fetch('/api/supervisor/voice-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed, sessionId: sessaoId, history: historySnapshot }),
      })

      if (res.status === 402) {
        toast.warning('Saldo insuficiente. Recarrega créditos na página Créditos.')
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const { text: responseText, audio: audioBase64 } = await res.json() as { text: string; audio: string }

      setVoiceTranscriptLines(prev => [...prev, { role: 'supervisor', text: responseText }])
      setHybridHistory([
        ...historySnapshot,
        { role: 'user', content: trimmed },
        { role: 'assistant', content: responseText },
      ])

      // Play Hugo's voice — pause mic while speaking to suppress echo
      if (audioBase64) {
        gemini.pauseCapture()
        setIsHugoSpeaking(true)
        if (hugoAudioRef.current) hugoAudioRef.current.pause()
        const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`)
        hugoAudioRef.current = audio
        const onDone = () => {
          setIsHugoSpeaking(false)
          gemini.resumeCapture()
          fetch('/api/credits').then(r => r.json()).then(d => setBalanceCents(d.balanceCents ?? 0)).catch(() => {})
        }
        audio.onended = onDone
        audio.onerror = onDone
        await audio.play().catch(onDone)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.error(`Erro ao contactar Supervisor: ${msg}`)
    } finally {
      setIsHugoThinking(false)
      isSendingRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessaoId])

  // ── Gemini Live (supervisor STT-only hybrid mode) ─────────────────────────────
  const handleVoiceError = useCallback((msg: string) => {
    setVoiceErrorMsg(msg)
    toast.error(msg)
  }, [])

  const gemini = useGeminiLive(
    supervisorMode === 'voice' && !concluida
      ? {
          type: 'supervisor_stt',
          systemPrompt: '',           // server handles setup; not used in STT mode
          voiceName: 'Puck',          // not used — TEXT modality only
          sessionId: sessaoId,
          onAudioChunk: () => {},
          onTextResponse: () => {},
          onTranscription: (text, isUser) => {
            // Live partial transcription display
            if (isUser) setLiveUserSpeech(prev => (prev + text + ' ').trimStart())
          },
          onTurnComplete: () => {},   // not called in supervisor_stt mode
          onUserSpeechFinal: handleUserSpeechFinal,
          onError: handleVoiceError,
        }
      : null
  )

  // Track voice start time
  useEffect(() => {
    if (gemini.state === 'connected' && voiceStartRef.current === null) {
      voiceStartRef.current = Date.now()
    }
  }, [gemini.state])

  // ── Manual send (button) ──────────────────────────────────────────────────────
  const handleManualSend = useCallback(() => {
    const text = liveUserSpeech.trim()
    if (!text || isHugoThinking) return
    gemini.clearSttBuffer()      // prevent VAD from double-firing
    setLiveUserSpeech('')
    handleUserSpeechFinal(text)
  }, [liveUserSpeech, isHugoThinking, gemini, handleUserSpeechFinal])

  // ── Mode toggle ───────────────────────────────────────────────────────────────
  function switchMode(mode: SupervisorMode) {
    if (mode === supervisorMode) return
    if (supervisorMode === 'voice' && gemini.state !== 'idle') {
      gemini.disconnect()
    }
    setSupervisorMode(mode)
    localStorage.setItem(MODE_KEY, mode)
  }

  // ── Text-mode TTS ─────────────────────────────────────────────────────────────
  function toggleTts() {
    const next = !voiceTtsEnabled
    setVoiceTtsEnabled(next)
    localStorage.setItem(VOICE_KEY, String(next))
  }

  async function playTts(text: string) {
    if (!voiceTtsEnabled || isPlaying || !text) return
    setIsPlaying(true)
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (res.status === 402) {
        setVoiceTtsEnabled(false)
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
    } catch { setIsPlaying(false) }
  }

  // ── Text-mode send ────────────────────────────────────────────────────────────
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
              setMsgs(prev => prev.map(m => m.id === aid ? { ...m, conteudo: full } : m))
            }
          } catch { /* ignorar linhas malformadas */ }
        }
      }

      setMsgs(prev => prev.map(m => m.id === aid ? { ...m, streaming: false } : m))
      if (full) await playTts(full)

      fetch(`/api/supervisor/sessoes/${sessaoId}`)
        .then(r => r.json())
        .then(({ sessao: s }: { sessao: SessaoSupervisor }) => { if (s) setSessao(s) })
        .catch(() => {})
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setMsgs(prev => prev.map(m =>
        m.id === aid ? { ...m, conteudo: `Não foi possível comunicar com o Supervisor. ${msg}`, streaming: false } : m
      ))
    } finally { setIsStreaming(false) }
  }, [input, isStreaming, concluida, sessaoId, voiceTtsEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Voice-mode start ──────────────────────────────────────────────────────────
  function handleStartVoice() {
    setVoiceErrorMsg('')
    setLiveUserSpeech('')
    isSendingRef.current = false
    gemini.connect()
  }

  // ── AI Report generation ─────────────────────────────────────────────────
  const generateReport = useCallback(async (voiceLines?: VoiceTranscriptLine[]) => {
    if (isGeneratingReport) return
    setIsGeneratingReport(true)
    try {
      const body: Record<string, unknown> = {}
      if (voiceLines && voiceLines.length > 0) {
        body.transcriptLines = voiceLines.map(l =>
          l.role === 'user' ? `[Terapeuta]: ${l.text}` : `[Supervisor]: ${l.text}`
        )
      }
      const res = await fetch(`/api/supervisor/sessoes/${sessaoId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        if (res.status === 422) return   // no content to evaluate — silent
        console.error('[SessaoChat] report generation failed:', res.status)
        return
      }
      const { report } = await res.json() as { report: SupervisorReport }
      if (report) setSupervisorReport(report)
    } catch (err) {
      console.error('[SessaoChat] report error:', err)
    } finally {
      setIsGeneratingReport(false)
    }
  }, [sessaoId, isGeneratingReport])

  // ── Conclude (both modes) ─────────────────────────────────────────────────────
  async function handleConcluir() {
    setIsConcluindo(true)
    try {
      const patchBody: Record<string, unknown> = { estado: 'concluida' }

      if (supervisorMode === 'voice' && voiceTranscriptLines.length > 0) {
        if (hugoAudioRef.current) hugoAudioRef.current.pause()
        gemini.disconnect()

        patchBody.voice_transcript = voiceTranscriptLines.map(l =>
          l.role === 'user' ? `[Terapeuta]: ${l.text}` : `[Supervisor]: ${l.text}`
        )
        const durationMs = voiceStartRef.current ? Date.now() - voiceStartRef.current : 0
        patchBody.voice_duration_minutes = Math.max(1, Math.ceil(durationMs / 60000))
      }

      const res = await fetch(`/api/supervisor/sessoes/${sessaoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      })
      if (res.ok) {
        setSessao(prev => ({ ...prev, estado: 'concluida' }))
        setMostrarConcluir(false)
        toast.success('Sessão concluída. Bom trabalho.')
        // Generate AI evaluation report (non-blocking — uses voice lines to avoid race condition)
        generateReport(
          supervisorMode === 'voice' && voiceTranscriptLines.length > 0
            ? voiceTranscriptLines
            : undefined
        )
      }
    } catch {
      toast.error('Não foi possível guardar a sessão. Tenta daqui a pouco.')
    } finally { setIsConcluindo(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col lg:flex-row gap-0 overflow-hidden" style={{ minHeight: 0, flex: 1 }}>

      {/* ── Left panel: context (unchanged) ────────────────────────────────── */}
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

          {/* Concluir */}
          <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            {concluida ? (
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Sessão concluída.</p>
            ) : !mostrarConcluir ? (
              <button type="button" onClick={() => setMostrarConcluir(true)} className="text-xs underline" style={{ color: 'var(--muted-foreground)' }}>
                Concluir sessão
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs" style={{ color: 'var(--foreground)' }}>Confirmar conclusão?</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleConcluir} disabled={isConcluindo}>
                    {isConcluindo ? 'A concluir…' : 'Confirmar'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setMostrarConcluir(false)}>Cancelar</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Right panel: chat area ──────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-h-0">

        {/* Top bar: mode toggle + balance */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-2 border-b shrink-0"
          style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
        >
          {/* Voz / Texto toggle */}
          {!concluida && (
            <div className="flex items-center gap-1 rounded-md border p-0.5" style={{ borderColor: 'var(--border)' }}>
              <button
                type="button"
                onClick={() => switchMode('text')}
                className="text-xs px-2.5 h-6 rounded transition-colors"
                style={{
                  background: supervisorMode === 'text' ? 'var(--primary)' : 'transparent',
                  color: supervisorMode === 'text' ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                }}
              >
                💬 Texto
              </button>
              <button
                type="button"
                onClick={() => switchMode('voice')}
                className="text-xs px-2.5 h-6 rounded transition-colors"
                style={{
                  background: supervisorMode === 'voice' ? 'var(--primary)' : 'transparent',
                  color: supervisorMode === 'voice' ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                }}
              >
                🎤 Voz
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 ml-auto">
            {/* Balance */}
            {balanceCents !== null && (
              <a href="/creditos" className="text-xs" style={{ color: 'var(--muted-foreground)' }} title="Ver créditos">
                {(balanceCents / 100).toFixed(2)}€
              </a>
            )}
            {/* TTS toggle (text mode only) */}
            {supervisorMode === 'text' && !concluida && (
              <button
                type="button"
                onClick={toggleTts}
                className="text-base leading-none"
                style={{ color: voiceTtsEnabled ? SUPERVISOR_COLOR : 'var(--muted-foreground)' }}
                title={voiceTtsEnabled ? 'Desactivar voz do Supervisor' : 'Activar voz do Supervisor'}
              >
                {isPlaying ? '🔊' : voiceTtsEnabled ? '🔊' : '🔇'}
              </button>
            )}
          </div>
        </div>

        {/* ── TEXT MODE ── */}
        {supervisorMode === 'text' && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              {msgs.length === 0 && (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center space-y-2 max-w-sm px-4">
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Sessão iniciada</p>
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
                      style={{ background: 'var(--card)', border: '1px solid var(--border)', borderLeft: `3px solid ${SUPERVISOR_COLOR}` }}
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
                        <span className="inline-block w-0.5 h-4 ml-0.5 animate-pulse align-middle" style={{ background: SUPERVISOR_COLOR }} />
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* AI Report (text mode) */}
              {concluida && (
                isGeneratingReport
                  ? <ReportLoadingIndicator />
                  : supervisorReport
                    ? <SupervisorReportPanel report={supervisorReport} sessaoId={sessaoId} />
                    : <ReportGenerateButton onGenerate={() => generateReport()} />
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            {concluida ? (
              <div className="px-4 py-3 text-sm text-center border-t" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'var(--card)' }}>
                Esta sessão foi concluída. Inicia uma nova para continuar a praticar.
              </div>
            ) : (
              <div className="p-3 md:p-4 border-t" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                    disabled={isStreaming}
                    placeholder="A tua análise, reflexão ou pergunta… (Enter para enviar, Shift+Enter nova linha)"
                    rows={1}
                    className="flex-1 rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)', overflow: 'hidden', minHeight: '2.5rem', maxHeight: '11.25rem', lineHeight: '1.5' }}
                  />
                  <Button onClick={handleSend} disabled={isStreaming || !input.trim()} size="sm" className="shrink-0 h-10">
                    {isStreaming ? '…' : 'Enviar'}
                  </Button>
                </div>
                <p className="text-xs mt-1.5 ml-1" style={{ color: 'var(--muted-foreground)' }}>
                  Enter envia · Shift+Enter nova linha
                </p>
              </div>
            )}
          </>
        )}

        {/* ── VOICE MODE (hybrid: Gemini STT → Claude → ElevenLabs) ── */}
        {supervisorMode === 'voice' && (
          <>
            {/* Conversation transcript */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">

              {/* Empty state */}
              {voiceTranscriptLines.length === 0 && gemini.state === 'idle' && !concluida && (
                <div className="h-full flex items-center justify-center min-h-48">
                  <div className="text-center space-y-3 max-w-xs px-4">
                    {/* Hugo avatar */}
                    <div className="flex justify-center">
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white"
                        style={{ background: HUGO_COLOR }}
                      >
                        H
                      </div>
                    </div>
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Supervisor — Modo Voz</p>
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      Fala com o Supervisor diretamente. Ele irá guiar-te com perguntas socráticas através da voz de Hugo Martins.
                    </p>
                  </div>
                </div>
              )}

              {/* Transcript lines */}
              {voiceTranscriptLines.map((line, i) => (
                <div key={i} className={`flex items-start gap-2.5 ${line.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {line.role === 'supervisor' && (
                    <div
                      className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: HUGO_COLOR }}
                    >
                      H
                    </div>
                  )}
                  {line.role === 'user' ? (
                    <div
                      className="max-w-[78%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed"
                      style={{ background: 'oklch(0.965 0.008 85)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                    >
                      {line.text}
                    </div>
                  ) : (
                    <div
                      className="max-w-[78%] rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed"
                      style={{ background: 'var(--card)', border: '1px solid var(--border)', borderLeft: `3px solid ${HUGO_COLOR}`, color: 'var(--foreground)' }}
                    >
                      {line.text}
                    </div>
                  )}
                </div>
              ))}

              {/* Hugo thinking indicator */}
              {isHugoThinking && (
                <div className="flex items-start gap-2.5 justify-start">
                  <div
                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: HUGO_COLOR }}
                  >
                    H
                  </div>
                  <div
                    className="rounded-2xl rounded-tl-sm px-4 py-2.5"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)', borderLeft: `3px solid ${HUGO_COLOR}` }}
                  >
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: HUGO_COLOR, animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: HUGO_COLOR, animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: HUGO_COLOR, animationDelay: '300ms' }} />
                    </span>
                  </div>
                </div>
              )}

              {/* Voice error */}
              {voiceErrorMsg && gemini.state === 'error' && (
                <div className="flex justify-center">
                  <div className="rounded-lg border px-4 py-3 text-sm text-center space-y-2 max-w-sm"
                    style={{ background: 'var(--card)', borderColor: 'oklch(0.52 0.22 25 / 0.4)', color: 'oklch(0.52 0.22 25)' }}>
                    <p>{voiceErrorMsg}</p>
                    <button type="button" className="text-xs underline" style={{ color: 'var(--primary)' }}
                      onClick={() => { setVoiceErrorMsg(''); handleStartVoice() }}>
                      Tentar novamente
                    </button>
                  </div>
                </div>
              )}

              {/* AI Report (voice mode) */}
              {concluida && (
                isGeneratingReport
                  ? <ReportLoadingIndicator />
                  : supervisorReport
                    ? <SupervisorReportPanel report={supervisorReport} sessaoId={sessaoId} />
                    : <ReportGenerateButton onGenerate={() => generateReport()} />
              )}

              <div ref={bottomRef} />
            </div>

            {/* Live transcription bar + controls footer */}
            {concluida ? (
              <div className="px-4 py-3 text-sm text-center border-t" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'var(--card)' }}>
                Esta sessão foi concluída. Inicia uma nova para continuar a praticar.
              </div>
            ) : (
              <div className="border-t shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>

                {/* Live transcription preview */}
                {liveUserSpeech && (gemini.state === 'connected' || gemini.state === 'reconnecting') && (
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-xs italic leading-snug" style={{ color: 'var(--muted-foreground)' }}>
                      &ldquo;{liveUserSpeech.trim()}&rdquo;
                    </p>
                  </div>
                )}

                {/* Controls */}
                <div className="p-4 flex items-center justify-center gap-4">

                  {/* Idle: start button */}
                  {gemini.state === 'idle' && (
                    <button
                      type="button"
                      onClick={handleStartVoice}
                      className="inline-flex items-center gap-2 rounded-full px-6 h-11 text-sm font-medium transition-colors"
                      style={{ background: HUGO_COLOR, color: 'white' }}
                    >
                      <span className="text-base">🎤</span>
                      Iniciar sessão de voz
                    </button>
                  )}

                  {/* Connecting */}
                  {gemini.state === 'connecting' && (
                    <div className="flex items-center gap-3">
                      <span className="inline-flex gap-1">
                        {[0, 150, 300].map(d => (
                          <span key={d} className="w-2 h-2 rounded-full animate-bounce" style={{ background: HUGO_COLOR, animationDelay: `${d}ms` }} />
                        ))}
                      </span>
                      <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>A ligar ao Supervisor…</span>
                    </div>
                  )}

                  {/* Connected: mic active */}
                  {(gemini.state === 'connected' || gemini.state === 'reconnecting') && (
                    <div className="flex items-center gap-4">
                      {/* Mic pulse */}
                      <div className="relative flex items-center justify-center w-10 h-10">
                        {!isHugoSpeaking && !isHugoThinking && (
                          <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ background: SUPERVISOR_COLOR }} />
                        )}
                        <span
                          className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full text-base"
                          style={{
                            background: isHugoSpeaking ? HUGO_COLOR : isHugoThinking ? 'var(--muted)' : SUPERVISOR_COLOR,
                            color: 'white',
                            transition: 'background 0.3s',
                          }}
                        >
                          {isHugoSpeaking ? '🔊' : isHugoThinking ? '⏳' : '🎤'}
                        </span>
                      </div>

                      <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        {gemini.state === 'reconnecting'
                          ? 'A reconectar…'
                          : isHugoSpeaking
                          ? 'Supervisor a falar…'
                          : isHugoThinking
                          ? 'Supervisor a pensar…'
                          : 'A escutar — fala agora'}
                      </span>

                      {/* Manual send button — fires when user wants to end their turn early */}
                      {liveUserSpeech.trim() && !isHugoThinking && !isHugoSpeaking && (
                        <button
                          type="button"
                          onClick={handleManualSend}
                          className="text-xs px-3 h-7 rounded-full font-medium transition-colors"
                          style={{ background: SUPERVISOR_COLOR, color: 'white' }}
                        >
                          Enviar
                        </button>
                      )}
                    </div>
                  )}

                  {/* Closed */}
                  {gemini.state === 'closed' && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Sessão de voz encerrada.</span>
                      <button type="button" className="text-xs underline" style={{ color: 'var(--primary)' }} onClick={handleStartVoice}>
                        Reiniciar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
