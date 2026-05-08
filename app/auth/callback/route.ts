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
  const errorParam = searchParams.get('error')
  const errorCode = searchParams.get('error_code')
  const errorDescription = searchParams.get('error_description')

  console.log('[auth/callback] received', {
    hasCode: !!code,
    next,
    errorParam,
    errorCode,
    errorDescription,
    origin,
    requestUrl: request.url,
  })

  // Caso o Supabase devolva erro directamente (ex: otp_expired)
  if (errorParam) {
    console.error('[auth/callback] Supabase returned error in URL', {
      errorParam,
      errorCode,
      errorDescription,
    })
    return NextResponse.redirect(
      `${origin}/login?erro=${errorCode || 'link-invalido'}`
    )
  }

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('[auth/callback] exchangeCodeForSession failed', {
        message: error.message,
        status: error.status,
        name: error.name,
      })
    } else {
      console.log('[auth/callback] exchangeCodeForSession success', {
        userId: data?.user?.id,
        email: data?.user?.email,
        hasSession: !!data?.session,
      })
      return NextResponse.redirect(`${origin}${next}`)
    }
  } else {
    console.error('[auth/callback] no code in URL')
  }

  return NextResponse.redirect(`${origin}/login?erro=link-invalido`)
}
