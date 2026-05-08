import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const searchParams = url.searchParams
  // Usa NEXT_PUBLIC_APP_URL quando definida (produção atrás de proxy nginx)
  // Fallback para url.origin (desenvolvimento local sem proxy)
  const origin = process.env.NEXT_PUBLIC_APP_URL || url.origin
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?erro=link-invalido`)
}
