'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { HugoAvatar } from './HugoAvatar'

const ONBOARDING_KEY = 'hugo_onboarding_done'
const OPEN_KEY = 'hugo_panel_open'

const INITIAL_MSG = 'Olá! Sou o Hugo, o teu guia na Dreamspace. Queres que te mostre como funciona tudo?'

export function HugoFloatingButton() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [onboardingDone, setOnboardingDone] = useState(true)

  // Hide on supervisor pages
  const isHidden = pathname?.startsWith('/supervisor')
  if (isHidden) return null

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY) === 'true'
    setOnboardingDone(done)
    const wasOpen = localStorage.getItem(OPEN_KEY) === 'true'
    if (wasOpen) setOpen(true)

    if (!done) {
      const t = setTimeout(() => setOpen(true), 2000)
      return () => clearTimeout(t)
    }
  }, [])

  function handleOpen() {
    setOpen(true)
    localStorage.setItem(OPEN_KEY, 'true')
  }

  function handleClose() {
    setOpen(false)
    localStorage.setItem(OPEN_KEY, 'false')
    if (!onboardingDone) {
      setOnboardingDone(true)
      localStorage.setItem(ONBOARDING_KEY, 'true')
    }
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          type="button"
          onClick={handleOpen}
          title="Fala com o Hugo"
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white text-lg transition-transform hover:scale-105 active:scale-95"
          style={{ background: 'oklch(0.42 0.12 288)' }}
        >
          H
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{
            width: '360px',
            height: '520px',
            background: 'var(--background)',
            border: '1px solid var(--border)',
          }}
        >
          <HugoAvatar
            initialMessage={!onboardingDone ? INITIAL_MSG : undefined}
            onClose={handleClose}
          />
        </div>
      )}
    </>
  )
}
