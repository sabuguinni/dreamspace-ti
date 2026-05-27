'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/manual', label: 'Manual' },
  { href: '/supervisor', label: 'Supervisor' },
  { href: '/avatares', label: 'Avatares' },
  { href: '/retiro', label: 'Retiro' },
  { href: '/diario', label: 'Diário' },
]

interface HeaderProps {
  profile: Profile
}

export function Header({ profile }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuAberto, setMenuAberto] = useState(false)

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  async function handleSair() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const primeiroNome = profile.nome_completo.split(' ')[0]

  return (
    <header className="border-b sticky top-0 z-40"
      style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
      <div className="flex items-center justify-between h-14 px-4 md:px-6">

        {/* Logo mobile */}
        <div className="md:hidden">
          <span className="text-lg font-medium"
            style={{ fontFamily: 'var(--font-lora)', color: 'var(--primary)' }}>
            DreamSpace TI
          </span>
        </div>

        {/* Nav desktop (dentro do header, só visível em md+ quando não há sidebar) */}
        <nav className="hidden md:flex items-center gap-1 md:hidden">
          {NAV.map(item => (
            <Link key={item.href} href={item.href}
              className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              style={{
                color: isActive(item.href) ? 'var(--primary)' : 'var(--muted-foreground)',
              }}>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Área direita — utilizador */}
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-sm hidden sm:block" style={{ color: 'var(--muted-foreground)' }}>
            Olá, <span className="font-medium" style={{ color: 'var(--foreground)' }}>{primeiroNome}</span>
          </span>

          {/* Avatar / menu */}
          <div className="relative">
            <button
              onClick={() => setMenuAberto(v => !v)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
              style={{
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
              }}>
              {primeiroNome[0]?.toUpperCase()}
            </button>

            {menuAberto && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuAberto(false)} />
                <div className="absolute right-0 top-10 z-20 rounded-md border shadow-md min-w-40 py-1"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                  <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {profile.nome_completo}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      {profile.email}
                    </p>
                  </div>
                  <Link href="/configuracoes"
                    onClick={() => setMenuAberto(false)}
                    className="flex items-center px-3 py-2 text-sm transition-colors hover:bg-muted"
                    style={{ color: 'var(--foreground)' }}>
                    Configurações
                  </Link>
                  <button
                    onClick={handleSair}
                    className="flex w-full items-center px-3 py-2 text-sm transition-colors hover:bg-muted"
                    style={{ color: 'var(--warn)' }}>
                    Sair
                  </button>
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      {/* Nav mobile */}
      <nav className="md:hidden flex overflow-x-auto px-4 pb-2 gap-1 border-t"
        style={{ borderColor: 'var(--border)' }}>
        {NAV.map(item => (
          <Link key={item.href} href={item.href}
            className="shrink-0 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            style={{
              color: isActive(item.href) ? 'var(--primary)' : 'var(--muted-foreground)',
              background: isActive(item.href) ? 'oklch(0.272 0.082 252 / 0.08)' : 'transparent',
            }}>
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
