import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const SonhoSchema = z.object({
  data_sonho: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  titulo: z.string().max(200).optional().nullable(),
  texto: z.string().min(1).max(20000),
  emocao_score: z.number().int().min(1).max(10).optional().nullable(),
  notas: z.string().max(5000).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).default([]),
})

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')

  let query = supabase
    .from('sonhos_diario')
    .select('*')
    .eq('user_id', user.id)
    .order('data_sonho', { ascending: false })
    .order('created_at', { ascending: false })

  if (q) {
    query = query.or(`titulo.ilike.%${q}%,texto.ilike.%${q}%,notas.ilike.%${q}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const parsed = SonhoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sonhos_diario')
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
