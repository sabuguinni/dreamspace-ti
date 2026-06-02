'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/avatares', label: 'Treino com Avatares' },
  { href: '/anamnese', label: 'Anamnese Supervisionada' },
]

/** Separador entre os dois modos de treino com avatares. */
export function TreinoTabs() {
  const pathname = usePathname()

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <div className="flex items-center gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
      {TABS.map(tab => {
        const active = isActive(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="px-4 py-2.5 text-sm font-medium transition-colors -mb-px border-b-2"
            style={{
              color: active ? 'var(--primary)' : 'var(--muted-foreground)',
              borderColor: active ? 'var(--primary)' : 'transparent',
            }}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
