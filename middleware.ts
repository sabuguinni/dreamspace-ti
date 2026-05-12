import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // API routes handle their own auth — middleware never intercepts them
  if (pathname.startsWith('/api/')) return NextResponse.next()

  // Páginas públicas — sem verificação de sessão
  const publicPaths = ['/login', '/auth', '/no-direct-access']
  const isPublic = publicPaths.some(p => pathname.startsWith(p))

  // Sem env vars configuradas, deixa passar (o layout faz a verificação)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !isPublic) {
    // Acesso não autorizado: redirecionar para página de bloqueio
    // (não mostrar o login — esta plataforma é acedida exclusivamente via LMS)
    return NextResponse.redirect(new URL('/no-direct-access', request.url))
  }
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
