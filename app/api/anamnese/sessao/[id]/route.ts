import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingAnamneseTable } from '@/lib/anamnese/serverUtils'
import { z } from 'zod'

const PatchSchema = z.object({
  estado: z.enum(['em_curso', 'concluida']).optional(),
  duracao_minutos: z.number().int().min(1).max(240).optional(),
  modo: z.enum(['escrito', 'voz']).optional(),
})

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: sessao, error } = await supabase
    .from('sessoes_anamnese')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !sessao) {
    if (isMissingAnamneseTable(error)) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
    return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
  }
  return NextResponse.json({ sessao })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (parsed.data.estado) update.estado = parsed.data.estado
  if (parsed.data.duracao_minutos) update.duracao_minutos = parsed.data.duracao_minutos
  if (parsed.data.modo) update.modo = parsed.data.modo

  const { data, error } = await supabase
    .from('sessoes_anamnese')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error || !data) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
  return NextResponse.json({ sessao: data })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { error } = await supabase
    .from('sessoes_anamnese')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'Erro ao apagar sessão' }, { status: 500 })
  return NextResponse.json({ success: true })
}
