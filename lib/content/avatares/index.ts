import { mariana } from './mariana'
import { carlos } from './carlos'
import { miguel } from './miguel'
import { beatriz } from './beatriz'
import type { Avatar } from '@/lib/types'

export const AVATARES_MAP: Record<string, Avatar> = { mariana, carlos, miguel, beatriz }

export const AVATARES_LISTA: Avatar[] = [mariana, carlos, miguel, beatriz]

export function getAvatar(slug: string): Avatar | null {
  return AVATARES_MAP[slug] ?? null
}
