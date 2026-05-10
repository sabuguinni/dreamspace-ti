/**
 * Cliente para a API de créditos IA do LMS.
 * Uso exclusivo em server-side (API routes, Server Components).
 */

const BASE = process.env.LMS_AI_CREDITS_API_URL ?? 'https://app.transpersonalinternational.com/api/external/ai-credits'
const KEY = process.env.LMS_AI_CREDITS_API_KEY ?? ''

function apiHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json', 'x-api-key': KEY }
}

export interface LmsUser {
  userId: number
  balanceCents: number
  hasBalance: boolean
}

export interface Pricing {
  resource: string
  displayName: string
  unit: string
  costPerUnitCents: number
}

/** Retorna userId + saldo pelo email Supabase. Retorna null se não encontrado. */
export async function lookupUser(email: string): Promise<LmsUser | null> {
  const res = await fetch(`${BASE}/user?email=${encodeURIComponent(email)}`, {
    headers: apiHeaders(),
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`LMS API erro ${res.status}`)
  return res.json()
}

/** Saldo actual por userId. */
export async function getBalance(userId: number): Promise<{ balanceCents: number; balanceEuros: number; hasBalance: boolean }> {
  const res = await fetch(`${BASE}/balance?userId=${userId}`, {
    headers: apiHeaders(),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`LMS API erro ${res.status}`)
  return res.json()
}

/** Debita créditos. Lança erro com mensagem clara se 402 (saldo insuficiente). */
export async function debit(
  userId: number,
  resource: string,
  units: number,
  description: string,
): Promise<{ success: boolean; transactionId: number; newBalanceCents: number }> {
  const res = await fetch(`${BASE}/debit`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ userId, resource, units, description }),
  })
  if (res.status === 402) {
    const body = await res.json()
    throw new Error(body.error ?? 'Saldo insuficiente')
  }
  if (!res.ok) throw new Error(`LMS API erro ${res.status}`)
  return res.json()
}

/** Lista de preços por recurso. */
export async function getPricing(): Promise<Pricing[]> {
  const res = await fetch(`${BASE}/pricing`, {
    headers: apiHeaders(),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`LMS API erro ${res.status}`)
  return res.json()
}
