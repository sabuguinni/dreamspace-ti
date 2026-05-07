import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getAvatar } from '@/lib/content/avatares'
import { z } from 'zod'

const SLUGS = ['mariana', 'carlos', 'miguel', 'beatriz'] as const

const CreateSchema = z.object({
  avatar_slug: z.enum(SLUGS),
})

const ABERTURA_TRIGGER =
  'Inicia a sessão. Apresenta-te brevemente e descreve o sonho que tiveste de forma natural, como se estivesses a contar a alguém pela primeira vez.'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')
  if (!slug) return NextResponse.json({ sessao: null, mensagens: [] })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: sessao } = await supabase
    .from('sessoes_avatar')
    .select('*')
    .eq('user_id', user.id)
    .eq('avatar_slug', slug)
    .eq('estado', 'em_curso')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!sessao) return NextResponse.json({ sessao: null, mensagens: [] })

  const { data: mensagens } = await supabase
    .from('mensagens')
    .select('*')
    .eq('sessao_avatar_id', sessao.id)
    .order('ordem', { ascending: true })

  return NextResponse.json({ sessao, mensagens: mensagens ?? [] })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { avatar_slug } = parsed.data
  const avatar = getAvatar(avatar_slug)
  if (!avatar) return NextResponse.json({ error: 'Avatar não encontrado' }, { status: 404 })

  // Create session
  const { data: sessao, error: sessaoErr } = await supabase
    .from('sessoes_avatar')
    .insert({
      user_id: user.id,
      avatar_slug,
      nivel: 1,
      estado: 'em_curso',
      ficheiro_revelado: false,
      notas_evolucao: {},
    })
    .select()
    .single()

  if (sessaoErr || !sessao) {
    return NextResponse.json({ error: sessaoErr?.message ?? 'Erro ao criar sessão' }, { status: 500 })
  }

  // Generate opening message via Claude (non-streaming)
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  let openingText = ''

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: avatar.systemPrompt,
      messages: [{ role: 'user', content: ABERTURA_TRIGGER }],
    })
    openingText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
  } catch (err) {
    console.error('[Avatar opening error]', err)
    openingText = `Olá. ${avatar.nome}, ${avatar.idade} anos. Posso partilhar o sonho que tenho tido?`
  }

  // Save opening message
  const { data: mensagemAbertura } = await supabase
    .from('mensagens')
    .insert({
      sessao_avatar_id: sessao.id,
      papel: 'assistant',
      conteudo: openingText,
      metadata: { abertura: true },
      ordem: 1,
    })
    .select()
    .single()

  return NextResponse.json(
    { sessao, mensagens: mensagemAbertura ? [mensagemAbertura] : [] },
    { status: 201 }
  )
}
