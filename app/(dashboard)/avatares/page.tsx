'use client'

import Link from 'next/link'
import { AVATARES_LISTA } from '@/lib/content/avatares'
import { AvatarCard } from '@/components/avatar/AvatarCard'
import { TreinoTabs } from '@/components/anamnese/TreinoTabs'

export default function AvataresPage() {
  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-medium"
            style={{ fontFamily: 'var(--font-lora)', color: 'var(--primary)' }}
          >
            Avatares de Prática
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Cada avatar é um caso prático simulado. Conduz a sessão, descobre o que não sabias no final.
          </p>
        </div>
        <Link
          href="/avatares/historico"
          className="text-xs shrink-0 px-3 h-8 inline-flex items-center rounded-md border transition-colors"
          style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}
        >
          Histórico de sessões
        </Link>
      </div>

      <TreinoTabs />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {AVATARES_LISTA.map(avatar => (
          <AvatarCard key={avatar.slug} avatar={avatar} />
        ))}
      </div>
    </div>
  )
}
