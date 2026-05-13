'use client'

/**
 * DashboardShell — wrapper client-side do layout principal
 *
 * Layout idêntico em ambos os modos (normal e iframe).
 * Única diferença em iframe: Header omitido para não duplicar com a barra
 * navy "DreamSpace TI + Fechar" que o LMS já injeta por cima do iframe.
 * Sidebar e HugoFloatingButton mantêm-se visíveis em qualquer modo.
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

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Sidebar desktop — visível em ambos os modos */}
      <Sidebar />

      {/* Área principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header omitido em iframe: a barra navy do LMS já mostra "DreamSpace TI + Fechar" */}
        {!inIframe && <Header profile={profile} />}
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>

      {/* Hugo — guia flutuante, visível em ambos os modos */}
      <HugoFloatingButton />
    </div>
  )
}
