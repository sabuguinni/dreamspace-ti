import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { synthesize, estimateMinutes } from '@/lib/ttsService'
import { lookupUser, debit } from '@/lib/aiCreditsClient'

const Schema = z.object({
  text: z.string().min(1).max(4096),
})

const CENTS_PER_MINUTE = 6

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Texto inválido' }, { status: 400 })

  const { text } = parsed.data

  const lmsUser = await lookupUser(user.email!).catch(() => null)
  if (!lmsUser) {
    return NextResponse.json({ error: 'Conta LMS não encontrada', code: 'NO_LMS_ACCOUNT' }, { status: 404 })
  }

  const minutes = estimateMinutes(text)
  const costCents = Math.max(1, Math.ceil(minutes * CENTS_PER_MINUTE))

  // Admins têm bypass — o LMS trata internamente, não bloquear aqui
  if (!lmsUser.isAdmin && lmsUser.balanceCents < costCents) {
    return NextResponse.json(
      { error: 'Saldo insuficiente para usar voz', code: 'INSUFFICIENT_BALANCE', costCents, balanceCents: lmsUser.balanceCents },
      { status: 402 },
    )
  }

  try {
    const audioBuffer = await synthesize(text)
    // Debitar após síntese (LMS faz bypass automático para admins)
    await debit(lmsUser.userId, 'voice_tts', minutes, 'TTS Hugo').catch(err => {
      console.error('[TTS] debit failed after synthesis:', err.message)
    })
    return new Response(new Uint8Array(audioBuffer), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.length),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    if (err.message?.includes('TTS_NOT_CONFIGURED') || err.message?.includes('OPENAI_API_KEY') || err.message?.includes('ELEVENLABS_API_KEY')) {
      return NextResponse.json({ error: 'Serviço de voz não configurado', code: 'TTS_NOT_CONFIGURED' }, { status: 503 })
    }
    console.error('[TTS] synthesis error:', err.message)
    return NextResponse.json({ error: 'Erro ao sintetizar voz' }, { status: 500 })
  }
}
