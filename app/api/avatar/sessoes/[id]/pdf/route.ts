import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAvatarReportPdf } from '@/lib/dreamsPdfService'
import { getAvatar } from '@/lib/content/avatares'
import type { AvatarReport } from '@/lib/types'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get('tipo') ?? 'relatorio'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const { data: sessao } = await supabase
    .from('sessoes_avatar')
    .select('id, avatar_slug, notas_evolucao, estado, created_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!sessao) return NextResponse.json({ error: 'Sessao nao encontrada' }, { status: 404 })

  const notas = (sessao.notas_evolucao ?? {}) as Record<string, unknown>
  const avatarReport = notas.avatar_report as AvatarReport | undefined
  const voiceTranscript = Array.isArray(notas.voice_transcript)
    ? (notas.voice_transcript as string[])
    : null

  const avatar = getAvatar(sessao.avatar_slug)
  const avatarName = avatar?.nome ?? sessao.avatar_slug
  const sessionDate = new Date(sessao.created_at)
  const userName = user.email?.split('@')[0] ?? 'Utilizador'

  if (tipo === 'relatorio') {
    if (!avatarReport) {
      return NextResponse.json({ error: 'Relatorio ainda nao disponivel para esta sessao' }, { status: 404 })
    }

    const buffer = await generateAvatarReportPdf({
      userName,
      avatarName,
      sessionDate,
      report: avatarReport,
      transcript: voiceTranscript ?? undefined,
    })
    const filename = 'relatorio-avatar-' + avatarName + '-' + id.slice(0, 8) + '.pdf'
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="' + filename + '"',
        'Content-Length': String(buffer.length),
      },
    })
  }

  // tipo === 'transcript'
  const { data: mensagens } = await supabase
    .from('mensagens')
    .select('papel, conteudo, ordem')
    .eq('sessao_avatar_id', id)
    .neq('papel', 'system')
    .order('ordem', { ascending: true })

  const hasTextMsgs = (mensagens ?? []).length > 0
  const hasVoice = voiceTranscript && voiceTranscript.length > 0

  if (!hasTextMsgs && !hasVoice) {
    return NextResponse.json({ error: 'Sessao sem transcricao para exportar' }, { status: 404 })
  }

  const transcript = hasVoice
    ? voiceTranscript!
    : (mensagens ?? []).map(m =>
        '[' + (m.papel === 'user' ? 'Terapeuta' : avatarName) + ']: ' + m.conteudo
      )

  const buffer = await generateAvatarReportPdf({
    userName,
    avatarName,
    sessionDate,
    report: avatarReport ?? {},
    transcript,
  })
  const filename = 'transcricao-avatar-' + avatarName + '-' + id.slice(0, 8) + '.pdf'
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="' + filename + '"',
      'Content-Length': String(buffer.length),
    },
  })
}
