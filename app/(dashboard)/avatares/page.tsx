'use client'

import { AVATARES_LISTA } from '@/lib/content/avatares'
import { AvatarCard } from '@/components/avatar/AvatarCard'

export default function AvataresPage() {
  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {AVATARES_LISTA.map(avatar => (
          <AvatarCard key={avatar.slug} avatar={avatar} />
        ))}
      </div>
    </div>
  )
}
