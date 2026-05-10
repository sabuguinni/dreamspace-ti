/**
 * Dreams custom Next.js server
 *
 * Bootstraps Next.js + Socket.IO + Gemini Live WebSocket proxy.
 * Replaces `next start` so that bidirectional voice sessions work
 * without exposing the Gemini API key to the browser.
 *
 * Usage: node server.js
 * PM2:   { script: 'node', args: 'server.js' }
 */

'use strict'

const http = require('http')
const { parse } = require('url')
const next = require('next')
const { Server: SocketServer } = require('socket.io')
const WebSocket = require('ws')

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

// ─────────────────────────────────────────────────────────────────────────────
// Supervisor system prompt — server-side only, never sent to browser
// ─────────────────────────────────────────────────────────────────────────────

const SUPERVISOR_VOICE_PROMPT = `És o Supervisor de IA do DreamSpace TI, plataforma de formação de terapeutas transpessoais.

O teu papel é supervisionar terapeutas de bem-estar em formação que trabalham com sonhos. Usas o método socrático.

REGRAS ABSOLUTAS:
1. NUNCA interpretas o sonho directamente — apenas fazes perguntas que guiam a descoberta do terapeuta
2. NUNCA usas linguagem clínica: usa acompanhado (não paciente), avaliação (não diagnóstico), dificuldade (não sintoma), processo (não tratamento)
3. Respondes sempre em português de Portugal, sem gerúndios, sem brasileirismos
4. Tom: calmo, acolhedor mas firme, curioso, sem julgamento
5. Cada resposta: máximo 2 a 3 frases curtas mais uma pergunta clara e aberta
6. MODO VOZ: fala de forma natural e fluida, sem markdown, sem asteriscos, sem listas nem pontos

Quando o terapeuta partilha uma análise de sonho:
- Primeiro acolhe brevemente o que foi dito
- Pergunta sobre elementos do sonho não explorados
- Questiona o método terapêutico escolhido e porque esse em vez de outro
- Pede a ligação entre o sonho e a vida concreta do acompanhado
- Nunca resolves nem interpretas — apenas abres novas perspectivas através de perguntas

Se o terapeuta pedir directamente uma interpretação do sonho: recusas com gentileza e devolves a pergunta a ele.`

// ─────────────────────────────────────────────────────────────────────────────
// Gemini Live Proxy — identical logic to LMS geminiProxy.ts, adapted to CJS
// ─────────────────────────────────────────────────────────────────────────────

const GEMINI_WS_BASE =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'

const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY_MS = 1500

/** @type {Map<string, object>} socket.id → SessionState */
const activeSessions = new Map()

function buildSetupMessage(modelName, systemPrompt, voiceName, resumptionHandle) {
  const setup = {
    model: modelName,
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    contextWindowCompression: { slidingWindow: {} },
    sessionResumption: resumptionHandle ? { handle: resumptionHandle } : {},
  }
  return { setup }
}

/**
 * STT-only setup for supervisor hybrid mode.
 *
 * IMPORTANT: gemini-2.5-flash-native-audio-* models require responseModalities:['AUDIO']
 * and cannot be used for text-only output. We MUST use gemini-2.0-flash-live-001 here —
 * it is the only Gemini Live model that accepts audio input and returns TEXT modality.
 * Using the native-audio model with TEXT modality causes code=1007 ("Cannot extract voices
 * from a non-audio request") and a reconnect loop.
 *
 * inputAudioTranscription captures what the user says; model text output is ignored
 * (Claude handles the actual response via /api/supervisor/voice-turn).
 */
function buildSetupMessageStt(resumptionHandle) {
  const setup = {
    model: 'models/gemini-2.0-flash-live-001',   // MUST NOT use native-audio model
    generationConfig: {
      responseModalities: ['TEXT'],
    },
    systemInstruction: {
      parts: [{ text: 'Transcreve o áudio recebido em texto. Não interpretes nem respondas ao conteúdo.' }],
    },
    inputAudioTranscription: {},
    contextWindowCompression: { slidingWindow: {} },
    sessionResumption: resumptionHandle ? { handle: resumptionHandle } : {},
  }
  return { setup }
}

function connectToGemini(socket, session) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || ''
  if (!apiKey) {
    console.error('[GeminiProxy] No GEMINI_API_KEY configured!')
    socket.emit('gemini:error', { message: 'O serviço de voz não está configurado.' })
    return
  }

  const wsUrl = `${GEMINI_WS_BASE}?key=${apiKey}`
  const isReconnect = session.resumptionHandle !== null

  if (isReconnect) {
    console.log(
      `[GeminiProxy] Reconnecting socket ${socket.id} (attempt ${session.reconnectAttempts})`
    )
    session.isResuming = true
    socket.emit('gemini:reconnecting', { attempt: session.reconnectAttempts })
  } else {
    console.log(
      `[GeminiProxy] New connection for socket ${socket.id}, session ${session.sessionId}`
    )
  }

  let ws
  try {
    ws = new WebSocket(wsUrl)
  } catch (err) {
    console.error('[GeminiProxy] Failed to create WebSocket:', err.message)
    if (isReconnect && session.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      session.reconnectAttempts++
      setTimeout(() => connectToGemini(socket, session), RECONNECT_DELAY_MS)
      return
    }
    socket.emit('gemini:error', { message: 'Erro ao criar conexão com o Gemini.' })
    return
  }

  session.ws = ws

  ws.on('open', () => {
    console.log(`[GeminiProxy] WS OPEN for socket ${socket.id}`)
    const setupMsg = session.type === 'supervisor_stt'
      ? buildSetupMessageStt(session.resumptionHandle)
      : buildSetupMessage(session.modelName, session.systemPrompt, session.voiceName, session.resumptionHandle)
    ws.send(JSON.stringify(setupMsg))
  })

  ws.on('message', (rawData) => {
    try {
      const msg = JSON.parse(rawData.toString())

      if (msg.setupComplete) {
        console.log(`[GeminiProxy] setupComplete for socket ${socket.id}`)
        session.setupCompleted = true
        session.isResuming = false
        session.reconnectAttempts = 0
        socket.emit(isReconnect ? 'gemini:resumed' : 'gemini:setupComplete')
        return
      }

      if (msg.sessionResumptionUpdate) {
        const u = msg.sessionResumptionUpdate
        if (u.resumable && u.newHandle) {
          session.resumptionHandle = u.newHandle
        }
        return
      }

      if (msg.goAway) {
        socket.emit('gemini:goAway', { timeLeft: msg.goAway.timeLeft })
        return
      }

      if (msg.serverContent) {
        socket.emit('gemini:serverContent', msg.serverContent)
        return
      }

      socket.emit('gemini:message', msg)
    } catch (e) {
      console.error('[GeminiProxy] Error parsing Gemini message:', e)
    }
  })

  ws.on('error', (err) => {
    console.error(`[GeminiProxy] WS error for socket ${socket.id}:`, err.message)
    if (session.clientDisconnected || session.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      socket.emit('gemini:error', { message: 'Erro na conexão com o Gemini.' })
    }
  })

  ws.on('close', (code, reason) => {
    const reasonStr = reason?.toString() || ''
    console.log(`[GeminiProxy] WS closed for socket ${socket.id}: code=${code}, reason=${reasonStr}`)

    if (
      session.clientDisconnected ||
      !socket.connected ||
      session.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS
    ) {
      activeSessions.delete(socket.id)
      socket.emit('gemini:closed', { code, reason: reasonStr })
      return
    }

    // code=1007 = Gemini configuration/policy error (e.g. wrong modality for model).
    // Retrying the same broken setup would just loop forever — fail fast instead.
    if (code === 1007) {
      console.error(`[GeminiProxy] Fatal config error for socket ${socket.id} (1007): ${reasonStr}`)
      activeSessions.delete(socket.id)
      socket.emit('gemini:error', { message: `Erro de configuração Gemini: ${reasonStr}` })
      return
    }

    if (code === 1000 && !session.resumptionHandle) {
      activeSessions.delete(socket.id)
      socket.emit('gemini:closed', { code, reason: reasonStr })
      return
    }

    if (session.resumptionHandle && session.setupCompleted) {
      console.log(`[GeminiProxy] Auto-reconnecting socket ${socket.id} (code=${code})…`)
      session.reconnectAttempts++
      setTimeout(() => {
        if (!session.clientDisconnected && socket.connected) {
          connectToGemini(socket, session)
        }
      }, RECONNECT_DELAY_MS)
      return
    }

    activeSessions.delete(socket.id)
    socket.emit('gemini:closed', { code, reason: reasonStr })
  })
}

function registerGeminiProxy(io) {
  io.on('connection', (socket) => {
    socket.on('gemini:connect', (data) => {
      const { sessionId, model, voiceName, type } = data

      // Security: supervisor system prompt is ALWAYS server-side.
      // When type === 'supervisor', ignore any client-provided systemPrompt.
      // When type === 'supervisor_stt', no system prompt needed (buildSetupMessageStt handles it).
      const systemPrompt = type === 'supervisor'
        ? SUPERVISOR_VOICE_PROMPT
        : (data.systemPrompt || '')

      const existing = activeSessions.get(socket.id)
      if (existing) {
        existing.clientDisconnected = true
        if (existing.ws && existing.ws.readyState === WebSocket.OPEN) {
          existing.ws.close()
        }
      }

      const modelName = model.startsWith('models/') ? model : `models/${model}`

      const session = {
        ws: null,
        sessionId,
        type,             // 'avatar' | 'supervisor' | 'supervisor_stt'
        modelName,
        systemPrompt,
        voiceName,
        resumptionHandle: null,
        isResuming: false,
        reconnectAttempts: 0,
        setupCompleted: false,
        clientDisconnected: false,
      }

      activeSessions.set(socket.id, session)
      connectToGemini(socket, session)
    })

    socket.on('gemini:audio', (data) => {
      const session = activeSessions.get(socket.id)
      if (!session || !session.ws || session.ws.readyState !== WebSocket.OPEN || session.isResuming) return
      session.ws.send(JSON.stringify({
        realtimeInput: {
          audio: { data: data.audio, mimeType: data.mimeType || 'audio/pcm;rate=16000' },
        },
      }))
    })

    socket.on('gemini:text', (data) => {
      const session = activeSessions.get(socket.id)
      if (!session || !session.ws || session.ws.readyState !== WebSocket.OPEN || session.isResuming) return
      session.ws.send(JSON.stringify({
        clientContent: {
          turns: [{ role: 'user', parts: [{ text: data.text }] }],
          turnComplete: true,
        },
      }))
    })

    socket.on('gemini:disconnect', () => {
      const session = activeSessions.get(socket.id)
      if (session) {
        session.clientDisconnected = true
        if (session.ws) session.ws.close()
        activeSessions.delete(socket.id)
      }
    })

    socket.on('disconnect', () => {
      const session = activeSessions.get(socket.id)
      if (session) {
        session.clientDisconnected = true
        if (session.ws) session.ws.close()
        activeSessions.delete(socket.id)
      }
    })
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Next.js bootstrap
// ─────────────────────────────────────────────────────────────────────────────

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = http.createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  const io = new SocketServer(httpServer, {
    path: '/api/socket.io',
    cors: { origin: '*', methods: ['GET', 'POST'] },
  })

  registerGeminiProxy(io)

  httpServer.listen(port, hostname, () => {
    console.log(`> Dreams ready on http://${hostname}:${port} (${dev ? 'dev' : 'prod'})`)
  })
})
