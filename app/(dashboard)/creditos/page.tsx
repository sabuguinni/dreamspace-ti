import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { lookupUser, getPricing } from '@/lib/aiCreditsClient'
import type { Pricing } from '@/lib/aiCreditsClient'

const LMS_URL = 'https://app.transpersonalinternational.com'

export const metadata = { title: 'Créditos IA — DreamSpace TI' }

export default async function CreditosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [lmsUser, pricing] = await Promise.all([
    lookupUser(user.email!).catch(() => null),
    getPricing().catch(() => [] as Pricing[]),
  ])

  const balanceCents = lmsUser?.balanceCents ?? 0
  const balanceEuros = (balanceCents / 100).toFixed(2)

  const balanceColor =
    balanceCents <= 0
      ? 'var(--destructive)'
      : balanceCents < 50
      ? 'oklch(0.72 0.18 65)'
      : 'oklch(0.55 0.15 148)'

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-lora)', color: 'var(--primary)' }}>
          Créditos IA
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Saldo partilhado entre todas as plataformas Transpersonal International.
        </p>
      </div>

      {/* Balance card */}
      <div
        className="rounded-xl p-6 border flex items-center justify-between"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--muted-foreground)' }}>
            Saldo actual
          </p>
          <p className="text-4xl font-semibold" style={{ color: balanceColor, fontFamily: 'var(--font-lora)' }}>
            {balanceEuros}€
          </p>
        </div>
        <a
          href={`${LMS_URL}/my-credits`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: 'oklch(0.42 0.12 288)' }}
        >
          Carregar créditos
        </a>
      </div>

      {/* Pricing table */}
      {pricing.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
            Preços
          </h2>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            {pricing.map((p, i) => (
              <div
                key={p.resource}
                className="flex items-center justify-between px-4 py-3"
                style={{
                  borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                  background: 'var(--card)',
                }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{p.displayName}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>por {p.unit}</p>
                </div>
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {(p.costPerUnitCents / 100).toFixed(2)}€
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
        Para gerir o teu saldo e ver o histórico completo, acede à{' '}
        <a
          href={`${LMS_URL}/my-credits`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          página de créditos na plataforma LMS
        </a>
        .
      </p>
    </div>
  )
}
