import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCitacaoDoDia } from '@/lib/content/citacoes'
import { MODULOS } from '@/lib/content/modulos'
import type { Profile, SessaoSupervisor, SessaoAvatar } from '@/lib/types'

function saudacao(nome: string): string {
  const hora = new Date().getUTCHours() + 1 // UTC+1 Portugal
  if (hora >= 5 && hora < 13) return `Bom dia, ${nome}.`
  if (hora >= 13 && hora < 20) return `Boa tarde, ${nome}.`
  return `Boa noite, ${nome}.`
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Dados em paralelo — RSC, não client fetch
  const [
    { data: profile },
    { data: ultimaSessaoSup },
    { data: ultimaSessaoAvt },
    { count: totalSonhos },
    { count: totalSessoesSup },
    { count: totalSessoesAvt },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user!.id).single(),
    supabase
      .from('sessoes_supervisor')
      .select('id, created_at, estado, sonho_texto')
      .eq('user_id', user!.id)
      .eq('estado', 'em_curso')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('sessoes_avatar')
      .select('id, created_at, estado, avatar_slug')
      .eq('user_id', user!.id)
      .eq('estado', 'em_curso')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('sonhos_diario')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user!.id),
    supabase
      .from('sessoes_supervisor')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user!.id),
    supabase
      .from('sessoes_avatar')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user!.id),
  ])

  const p = profile as Profile
  const citacao = getCitacaoDoDia()
  const primeiroNome = p.nome_completo.includes('@')
    ? p.nome_completo.split('@')[0]
    : p.nome_completo.split(' ')[0]

  // Lógica do próximo passo
  function proximoPasso(): { titulo: string; descricao: string; href: string; cta: string } {
    const sonhos = totalSonhos ?? 0
    const sessoesSup = totalSessoesSup ?? 0
    const sessoesAvt = totalSessoesAvt ?? 0

    if (sonhos === 0) {
      return {
        titulo: 'Regista o teu primeiro sonho',
        descricao: 'O diário pessoal é o ponto de partida. Escreve o sonho enquanto ainda está fresco.',
        href: '/diario/novo',
        cta: 'Ir ao Diário',
      }
    }
    if (sonhos >= 3 && sessoesSup === 0) {
      return {
        titulo: 'Leva um sonho ao Supervisor',
        descricao: 'Tens sonhos registados. É hora de praticar a supervisão socrática.',
        href: '/supervisor/nova',
        cta: 'Nova sessão',
      }
    }
    if (sessoesSup >= 3 && sessoesAvt === 0) {
      return {
        titulo: 'Experimenta uma sessão com a Mariana',
        descricao: 'Já praticaste com sonhos reais. A Mariana vai treinar a tua capacidade de contornar a intelectualização defensiva.',
        href: '/avatares/mariana',
        cta: 'Começar com a Mariana',
      }
    }
    return {
      titulo: 'Continua a praticar',
      descricao: 'Cada sessão afina a tua capacidade socrática. Escolhe um avatar ou abre uma nova sessão de supervisão.',
      href: '/supervisor/nova',
      cta: 'Nova sessão',
    }
  }

  const passo = proximoPasso()

  // Sessão activa mais recente (supervisor ganha se ambas existirem)
  const temSessaoActiva = ultimaSessaoSup || ultimaSessaoAvt
  const sessaoActiva = ultimaSessaoSup ?? ultimaSessaoAvt
  const tipoSessaoActiva = ultimaSessaoSup ? 'supervisor' : 'avatar'
  const linkSessaoActiva = ultimaSessaoSup
    ? `/supervisor/${(ultimaSessaoSup as SessaoSupervisor).id}`
    : `/avatares/${(ultimaSessaoAvt as SessaoAvatar)?.avatar_slug}`

  const AVATAR_NOMES: Record<string, string> = {
    mariana: 'Mariana',
    carlos: 'Carlos',
    miguel: 'Miguel',
    beatriz: 'Beatriz',
  }

  const modulosDesbloqueados = p.modulos_acesso ?? [1]

  return (
    <div className="max-w-3xl space-y-8 animate-fade-in">

      {/* Saudação + citação */}
      <div className="space-y-4">
        <h1 className="text-3xl font-medium"
          style={{ fontFamily: 'var(--font-lora)', color: 'var(--primary)' }}>
          {saudacao(primeiroNome)}
        </h1>
        <blockquote className="citacao-bloco">
          <p className="text-base italic leading-relaxed" style={{ color: 'var(--foreground)' }}>
            "{citacao.texto}"
          </p>
          <footer className="mt-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            — {citacao.autor}{citacao.obra ? `, ${citacao.obra}` : ''}
          </footer>
        </blockquote>
      </div>

      {/* Dois cartões lado a lado */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Cartão Continuar */}
        <div className="rounded-lg border p-5 space-y-3 flex flex-col"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-medium tracking-widest uppercase"
            style={{ color: 'var(--muted-foreground)' }}>
            Continuar
          </p>

          {temSessaoActiva && sessaoActiva ? (
            <>
              <div className="flex-1 space-y-1.5">
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {tipoSessaoActiva === 'supervisor'
                    ? 'Sessão de Supervisão'
                    : `Sessão com ${AVATAR_NOMES[(ultimaSessaoAvt as SessaoAvatar)?.avatar_slug] ?? 'Avatar'}`}
                </p>
                <p className="text-sm line-clamp-2" style={{ color: 'var(--muted-foreground)' }}>
                  {tipoSessaoActiva === 'supervisor'
                    ? (ultimaSessaoSup as SessaoSupervisor).sonho_texto.slice(0, 100) + '…'
                    : 'Sessão em curso'}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {new Date(sessaoActiva.created_at).toLocaleDateString('pt-PT', {
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
              </div>
              <Link href={linkSessaoActiva}
                className="inline-flex items-center justify-center rounded-md px-4 h-9 text-sm font-medium transition-colors w-fit"
                style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                Retomar sessão
              </Link>
            </>
          ) : (
            <>
              <div className="flex-1 space-y-1.5">
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  Sem sessões em curso
                </p>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Inicia uma sessão de Supervisão ou escolhe um Avatar para começar a praticar.
                </p>
              </div>
              <Link href="/supervisor/nova"
                className="inline-flex items-center justify-center rounded-md border px-4 h-9 text-sm font-medium transition-colors w-fit"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
                Nova sessão
              </Link>
            </>
          )}
        </div>

        {/* Cartão Próximo passo */}
        <div className="rounded-lg border p-5 space-y-3 flex flex-col"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-medium tracking-widest uppercase"
            style={{ color: 'var(--muted-foreground)' }}>
            Próximo passo
          </p>
          <div className="flex-1 space-y-1.5">
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              {passo.titulo}
            </p>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {passo.descricao}
            </p>
          </div>
          <Link href={passo.href}
            className="inline-flex items-center justify-center rounded-md px-4 h-9 text-sm font-medium transition-colors w-fit"
            style={{ background: 'oklch(0.631 0.118 65)', color: 'white' }}>
            {passo.cta}
          </Link>
        </div>
      </div>

      {/* Cartão Manual */}
      <div className="rounded-lg border p-5 space-y-4"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            Manual Digital
          </p>
          <Link href="/manual"
            className="text-xs font-medium"
            style={{ color: 'var(--primary)' }}>
            Ver todos
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {MODULOS.map(modulo => {
            const desbloqueado = modulosDesbloqueados.includes(modulo.numero)
            const disponivel = modulo.publicado && desbloqueado

            return (
              <div key={modulo.numero}>
                {disponivel ? (
                  <Link href={`/manual/modulo-${modulo.numero}`}
                    className="block rounded-md border p-3 transition-colors hover:border-primary/40 group"
                    style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium" style={{ color: 'var(--primary)' }}>
                          Módulo {modulo.numero}
                        </p>
                        <p className="text-xs font-medium leading-tight" style={{ color: 'var(--foreground)' }}>
                          {modulo.titulo}
                        </p>
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div className="rounded-md border p-3 opacity-50 cursor-not-allowed select-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                          Módulo {modulo.numero}
                        </p>
                        <p className="text-xs font-medium leading-tight" style={{ color: 'var(--muted-foreground)' }}>
                          {modulo.titulo}
                        </p>
                      </div>
                      {!desbloqueado ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          className="shrink-0 mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      ) : (
                        <span className="text-xs shrink-0" style={{ color: 'var(--muted-foreground)' }}>Em breve</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Estatísticas rápidas */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Sonhos registados', valor: totalSonhos ?? 0, href: '/diario' },
          { label: 'Sessões de Supervisão', valor: totalSessoesSup ?? 0, href: '/supervisor' },
          { label: 'Sessões com Avatares', valor: totalSessoesAvt ?? 0, href: '/avatares' },
        ].map(stat => (
          <Link key={stat.label} href={stat.href}
            className="rounded-lg border p-4 text-center space-y-1 transition-colors hover:border-primary/30"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <p className="text-2xl font-semibold"
              style={{ fontFamily: 'var(--font-lora)', color: 'var(--primary)' }}>
              {stat.valor}
            </p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {stat.label}
            </p>
          </Link>
        ))}
      </div>

    </div>
  )
}
