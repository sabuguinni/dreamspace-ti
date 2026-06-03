import { createClient } from '@/lib/supabase/server'
import { PrototipoAnamneseVoz } from '@/components/anamnese/PrototipoAnamneseVoz'

export const metadata = { title: 'Protótipo Anamnese (teste)' }

/**
 * Rota de teste ISOLADA para validar a Carolina em Gemini Live bidirecional.
 * Não está ligada à navegação nem ao /anamnese real.
 */
export default async function AnamneseTestePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-sm opacity-70">Precisas de iniciar sessão para usar o protótipo.</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen">
      <PrototipoAnamneseVoz />
    </main>
  )
}
