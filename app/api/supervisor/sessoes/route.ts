import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const METODOS = [
  'freud_associacao_livre', 'jung_amplificacao', 'hillman_imagem',
  'delaney_dream_interview', 'gendlin_focusing', 'bosnak_embodied',
  'perls_gestalt', 'hill_cognitivo_experiencial', 'ullman_grupo',
  'taylor_grupo', 'lucido', 'integrado', 'nao_definido',
] as const

const CreateSchema = z.object({
  sonho_texto: z.string().min(1).max(20000),
  caso_descricao: z.string().max(5000).optional().nullable(),
  metodo_escolhido: z.enum(METODOS).optional(),
  sonho_id: z.string().uuid().optional().nullable(),
})

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data, error } = await supabase
    .from('sessoes_supervisor')
    .insert({
      user_id: user.id,
      sonho_texto: parsed.data.sonho_texto,
      caso_descricao: parsed.data.caso_descricao ?? null,
      metodo_escolhido: parsed.data.metodo_escolhido ?? 'nao_definido',
      sonho_id: parsed.data.sonho_id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
