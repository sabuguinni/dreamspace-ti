import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  generateSupervisorTranscriptPdf,
  generateSupervisorReportPdf,
} from '@/lib/dreamsPdfService'
import type { SupervisorReport } from '@/lib/types'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get('tipo') ?? 'transcript'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const { data: sessao } = await supabase
    .from('sessoes_supervisor')
    .select('id, sonho_texto, metodo_escolhido, estado, created_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!sessao) return NextResponse.json({ error: 'Sessao nao encontrada' }, { status: 404 })

  const { data: mensagens } = await supabase
    .from('mensagens')
    .select('papel, conteudo, metadata, ordem, created_at')
    .eq('sessao_supervisor_id', id)
    .order('ordem', { ascending: true })

  const sessionDate = new Date(sessao.created_at)
  const userName = user.email?.split('@')[0] ?? 'Utilizador'

  if (tipo === 'relatorio') {
    const reportMsg = (mensagens ?? []).find(
      m => m.papel === 'system' && (m.metadata as any)?.type === 'supervisor_report'
    )
    if (!reportMsg) {
      return NextResponse.json({ error: 'Relatorio ainda nao disponivel para esta sessao' }, { status: 404 })
    }

    let report: SupervisorReport
    try {
      report = JSON.parse(reportMsg.conteudo) as SupervisorReport
    } catch {
      return NextResponse.json({ error: 'Erro ao ler relatorio' }, { status: 500 })
    }

    const buffer = await generateSupervisorReportPdf({ userName, sessionDate, report })
    const filename = 'relatorio-supervisao-' + id.slice(0, 8) + '.pdf'
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="' + filename + '"',
        'Content-Length': String(buffer.length),
      },
    })
  }

  // tipo === 'transcript'
  const textMsgs = (mensagens ?? []).filter(m => m.papel !== 'system')
  if (textMsgs.length === 0) {
    return NextResponse.json({ error: 'Sessao sem mensagens para exportar' }, { status: 404 })
  }

  const messages = textMsgs.map(m => ({
    role: (m.papel === 'user' ? 'terapeuta' : 'supervisor') as 'terapeuta' | 'supervisor',
    content: m.conteudo,
    createdAt: m.created_at,
  }))

  const buffer = await generateSupervisorTranscriptPdf({ userName, sessionDate, messages })
  const filename = 'transcricao-supervisao-' + id.slice(0, 8) + '.pdf'
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="' + filename + '"',
      'Content-Length': String(buffer.length),
    },
  })
}
