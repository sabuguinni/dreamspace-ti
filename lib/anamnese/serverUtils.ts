/**
 * Utilitários server-side partilhados pelas rotas de anamnese.
 */

/**
 * Detecta o erro de "tabela inexistente" enquanto a migration
 * (supabase/migrations/0001_sessoes_anamnese.sql) ainda não foi aplicada.
 * Permite que a app degrade graciosamente em vez de rebentar.
 */
export function isMissingAnamneseTable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string; message?: string }
  if (e.code === '42P01' || e.code === 'PGRST205') return true
  const msg = (e.message ?? '').toLowerCase()
  return msg.includes('sessoes_anamnese') && (msg.includes('does not exist') || msg.includes('could not find'))
}
