import { mariana } from '@/lib/content/avatares/mariana'
import { carlos } from '@/lib/content/avatares/carlos'
import { miguel } from '@/lib/content/avatares/miguel'
import { beatriz } from '@/lib/content/avatares/beatriz'
import type { Avatar } from '@/lib/types'

const AVATARES: Record<string, Avatar> = {
  mariana,
  carlos,
  miguel,
  beatriz,
}

export function getAvatar(slug: string): Avatar | null {
  return AVATARES[slug] ?? null
}

export function getAvatarPrompt(slug: string): string | null {
  return AVATARES[slug]?.systemPrompt ?? null
}

export { AVATARES }
