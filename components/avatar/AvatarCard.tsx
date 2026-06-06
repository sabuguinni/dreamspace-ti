'use client'

import Link from 'next/link'
import Image from 'next/image'
import type { Avatar } from '@/lib/types'

const AVATAR_COLORS: Record<string, { bg: string; fg: string }> = {
  mariana: { bg: 'oklch(0.26 0.15 252)', fg: 'white' },
  carlos:  { bg: 'oklch(0.38 0.05 245)', fg: 'white' },
  miguel:  { bg: 'oklch(0.38 0.18 288)', fg: 'white' },
  beatriz: { bg: 'oklch(0.48 0.08 148)', fg: 'white' },
}

export function AvatarCard({ avatar }: { avatar: Avatar }) {
  const color = AVATAR_COLORS[avatar.slug] ?? { bg: 'oklch(0.42 0.08 252)', fg: 'white' }
  const avatarSrc = avatar.imagem || `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(avatar.nome)}`

  return (
    <div
      className="rounded-lg border p-5 flex flex-col space-y-4"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      {/* Avatar identity */}
      <div className="flex items-center gap-3">
        <div className="relative w-16 h-16 shrink-0 rounded-full overflow-hidden">
          <Image
            src={avatarSrc}
            alt={avatar.nome}
            width={64}
            height={64}
            className="w-full h-full object-cover rounded-full"
            unoptimized
          />
          {/* Fallback initial — behind the image */}
          <div
            className="absolute inset-0 rounded-full flex items-center justify-center text-lg font-semibold -z-10"
            style={{ background: color.bg, color: color.fg }}
          >
            {avatar.nome[0]}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            {avatar.nome}, {avatar.idade} anos
          </p>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {avatar.profissao} · {avatar.cidade}
          </p>
        </div>
      </div>

      {/* Public summary */}
      <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
        {avatar.resumoPublico}
      </p>

      {/* What you'll practice */}
      <div className="rounded-md px-3 py-2.5 space-y-0.5"
        style={{ background: 'oklch(0.272 0.082 252 / 0.06)', borderLeft: '3px solid oklch(0.272 0.082 252 / 0.4)' }}>
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--primary)' }}>
          O que vais praticar
        </p>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--foreground)' }}>
          {avatar.competenciaTreinada}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {avatar.duracaoEstimada}
        </span>
        <Link
          href={`/avatares/${avatar.slug}`}
          className="inline-flex items-center justify-center rounded-md px-4 h-8 text-xs font-medium transition-colors"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          Iniciar sessão
        </Link>
      </div>
    </div>
  )
}
