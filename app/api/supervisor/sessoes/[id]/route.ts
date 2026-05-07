import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const PatchSchema = z.object({
  estado: z.enum(['em_curso', 'concluida', 'arquivada']).optional(),
  flags_detectados: z.array(z.string()).optional(),
})

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: sessao, error: sessaoErr } = await supabase
    .from('sessoes_supervisor')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (sessaoErr || !sessao) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })

  const { data: mensagens } = await supabase
    .from('mensagens')
    .select('*')
    .eq('sessao_supervisor_id', id)
    .order('ordem', { ascending: true })

  return NextResponse.json({ sessao, mensagens: mensagens ?? [] })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data, error } = await supabase
    .from('sessoes_supervisor')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error || !data) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
  return NextResponse.json(data)
}
