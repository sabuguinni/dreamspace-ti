'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { ConfigModulo } from '@/lib/content/manual/config'

interface Props {
  config: ConfigModulo
  modulo: string
  children: React.ReactNode
}

export function ManualPageClient({ config, modulo, children }: Props) {
  const [progress, setProgress] = useState(0)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Reading progress bar
  useEffect(() => {
    function onScroll() {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      setProgress(docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Sidebar active section via IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
            break
          }
        }
      },
      { rootMargin: '-15% 0px -70% 0px' }
    )
    const headings = document.querySelectorAll('h2[id]')
    headings.forEach(h => observer.observe(h))
    return () => observer.disconnect()
  }, [])

  const moduloNumero = modulo === 'modulo-1' ? 'I' : modulo === 'modulo-2' ? 'II' : modulo === 'modulo-3' ? 'III' : modulo.replace('modulo-', '')

  return (
    <div className="relative">
      {/* Reading progress bar */}
      <div
        className="fixed top-0 left-0 right-0 z-50 h-0.5 origin-left transition-all duration-100"
        style={{ background: 'oklch(0.72 0.17 65)', transform: `scaleX(${progress / 100})` }}
      />

      {/* Breadcrumb */}
      <nav className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
        <Link href="/manual" className="hover:underline">Manual</Link>
        <span className="mx-1.5">›</span>
        <span>Módulo {moduloNumero}</span>
      </nav>

      <div className="flex gap-8">
        {/* Sidebar — hidden on mobile, sticky on desktop */}
        <aside className="hidden lg:block shrink-0 w-48 sticky top-6 self-start">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted-foreground)' }}>
            Neste módulo
          </p>
          <nav className="space-y-0.5">
            {config.secoes.map(secao => (
              <a
                key={secao.id}
                href={`#${secao.id}`}
                className="block text-xs py-1 px-2 rounded transition-colors"
                style={{
                  color: activeSection === secao.id ? 'var(--primary)' : 'var(--muted-foreground)',
                  background: activeSection === secao.id ? 'oklch(0.26 0.15 252 / 0.08)' : 'transparent',
                  fontWeight: activeSection === secao.id ? '500' : '400',
                }}
                onClick={e => {
                  e.preventDefault()
                  document.getElementById(secao.id)?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                {secao.titulo}
              </a>
            ))}
          </nav>

          <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>Progresso de leitura</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full" style={{ background: 'var(--border)' }}>
                <div
                  className="h-full rounded-full transition-all duration-100"
                  style={{ width: `${progress}%`, background: 'oklch(0.72 0.17 65)' }}
                />
              </div>
              <span className="text-xs tabular-nums" style={{ color: 'var(--muted-foreground)' }}>{progress}%</span>
            </div>
          </div>
        </aside>

        {/* MDX content */}
        <div
          ref={contentRef}
          className="flex-1 min-w-0 prose-manual"
          style={{ maxWidth: '65ch' }}
        >
          {children}

          {/* Module navigation */}
          <div
            className="flex items-center justify-between mt-12 pt-6"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            {config.anterior ? (
              <Link
                href={`/manual/${config.anterior}`}
                className="flex items-center gap-1.5 text-sm"
                style={{ color: 'var(--muted-foreground)' }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 2L4 7l5 5" />
                </svg>
                Módulo anterior
              </Link>
            ) : <div />}

            <Link href="/manual" className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Índice
            </Link>

            {config.seguinte ? (
              <Link
                href={`/manual/${config.seguinte}`}
                className="flex items-center gap-1.5 text-sm"
                style={{ color: 'var(--primary)' }}
              >
                Módulo seguinte
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 2l5 5-5 5" />
                </svg>
              </Link>
            ) : <div />}
          </div>
        </div>
      </div>
    </div>
  )
}
