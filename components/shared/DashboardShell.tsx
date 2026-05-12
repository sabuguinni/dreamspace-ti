'use client'

/**
 * DashboardShell — wrapper client-side do layout principal
 *
 * Detecta se a app está embebida num iframe (modo LMS) e adapta o layout:
 * - Em iframe: sem sidebar, sem header, sem botão Hugo — conteúdo 100% largura
 * - Normal: layout completo com sidebar, header e botão Hugo
 */

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/shared/Sidebar'
import { Header } from '@/components/shared/Header'
import { HugoFloatingButton } from '@/components/HugoFloatingButton'
import type { Profile } from '@/lib/types'

interface DashboardShellProps {
  profile: Profile
  children: React.ReactNode
}

export function DashboardShell({ profile, children }: DashboardShellProps) {
  const [inIframe, setInIframe] = useState(false)

  useEffect(() => {
    try {
      setInIframe(window.self !== window.top)
    } catch {
      // SecurityError em cross-origin: se lançar excepção, estamos em iframe
      setInIframe(true)
    }
  }, [])

  // ── Modo iframe (embebido no LMS) ─────────────────────────────────
  if (inIframe) {
    return (
      <div
        className="w-full min-h-screen overflow-x-hidden"
        style={{ background: 'var(--background)' }}
      >
        <main
          className="w-full min-h-screen overflow-y-auto p-4"
          style={{ maxWidth: 'none', margin: 0 }}
        >
          {children}
        </main>
      </div>
    )
  }

  // ── Layout normal (acesso directo) ────────────────────────────────
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Sidebar desktop */}
      <Sidebar />

      {/* Área principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header profile={profile} />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>

      {/* Hugo — guia flutuante */}
      <HugoFloatingButton />
    </div>
  )
}
