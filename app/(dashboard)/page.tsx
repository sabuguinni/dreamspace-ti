import { createClient } from '@/lib/supabase/server'
import { getCitacaoDoDia } from '@/lib/content/citacoes'
import type { Profile } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  const citacao = getCitacaoDoDia()
  const primeiroNome = (profile as Profile).nome_completo.split(' ')[0]

  return (
    <div className="max-w-3xl space-y-8 animate-fade-in">
      {/* Saudação + citação */}
      <div className="space-y-4">
        <h1 className="text-3xl font-medium"
          style={{ fontFamily: 'var(--font-lora)', color: 'var(--primary)' }}>
          Bom dia, {primeiroNome}.
        </h1>
        <blockquote className="citacao-bloco">
          <p className="text-base italic" style={{ color: 'var(--foreground)' }}>
            "{citacao.texto}"
          </p>
          <footer className="mt-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {citacao.autor}{citacao.obra ? `, ${citacao.obra}` : ''}
          </footer>
        </blockquote>
      </div>

      {/* Placeholder — será preenchido no Passo 4 */}
      <div className="rounded-lg border p-6 space-y-2"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <p className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
          Dashboard em construção — próximo passo: Diário de Sonhos
        </p>
      </div>
    </div>
  )
}
