'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

export default function ConfiguracoesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [nome, setNome] = useState('')
  const [nomeCarregado, setNomeCarregado] = useState(false)
  const [email, setEmail] = useState('')
  const [isSavingNome, setIsSavingNome] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setEmail(user.email ?? '')
      const { data } = await supabase
        .from('profiles')
        .select('nome_completo')
        .eq('id', user.id)
        .single()
      if (data?.nome_completo) setNome(data.nome_completo)
      setNomeCarregado(true)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSaveNome(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    setIsSavingNome(true)
    try {
      const res = await fetch('/api/conta', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome_completo: nome.trim() }),
      })
      if (!res.ok) throw new Error()
      toast.success('Nome actualizado.')
    } catch {
      toast.error('Não foi possível guardar. Tenta daqui a pouco.')
    } finally {
      setIsSavingNome(false)
    }
  }

  async function handleDeleteAccount() {
    setIsDeleting(true)
    try {
      const res = await fetch('/api/conta', { method: 'DELETE' })
      if (!res.ok) throw new Error()
      router.push('/login')
    } catch {
      toast.error('Não foi possível eliminar a conta. Contacta o suporte.')
      setIsDeleting(false)
      setShowDeleteModal(false)
    }
  }

  return (
    <div className="max-w-xl space-y-8 animate-fade-in">
      <div>
        <nav className="text-xs mb-3" style={{ color: 'var(--muted-foreground)' }}>
          <Link href="/" className="hover:underline">Início</Link>
          <span className="mx-1.5">›</span>
          <span>Configurações</span>
        </nav>
        <h1
          className="text-2xl font-medium"
          style={{ fontFamily: 'var(--font-lora)', color: 'var(--primary)' }}
        >
          Configurações
        </h1>
      </div>

      {/* Perfil */}
      <section className="rounded-lg border p-6 space-y-5"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <h2 className="text-sm font-semibold uppercase tracking-wide"
          style={{ color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>
          Perfil
        </h2>

        <form onSubmit={handleSaveNome} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              Nome completo
            </label>
            <input
              type="text"
              value={nomeCarregado ? nome : ''}
              onChange={e => setNome(e.target.value)}
              disabled={!nomeCarregado}
              placeholder={nomeCarregado ? '' : 'A carregar…'}
              className="w-full rounded-md border px-3 h-9 text-sm focus:outline-none focus:ring-1"
              style={{
                background: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              Endereço de correio electrónico
            </label>
            <input
              type="email"
              value={email}
              readOnly
              className="w-full rounded-md border px-3 h-9 text-sm opacity-60 cursor-default"
              style={{
                background: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            />
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              O endereço não pode ser alterado aqui.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSavingNome || !nomeCarregado || !nome.trim()}
            className="inline-flex items-center justify-center rounded-md px-5 h-9 text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            {isSavingNome ? 'A guardar…' : 'Guardar'}
          </button>
        </form>
      </section>

      {/* Os meus dados */}
      <section className="rounded-lg border p-6 space-y-4"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <h2 className="text-sm font-semibold uppercase tracking-wide"
          style={{ color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>
          Os meus dados
        </h2>

        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => toast.info('Exportação de dados em breve.')}
              className="inline-flex items-center justify-center rounded-md border px-4 h-9 text-sm font-medium transition-colors"
              style={{
                background: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            >
              Exportar os meus dados
            </button>
            <p className="text-xs pt-2" style={{ color: 'var(--muted-foreground)' }}>
              Sonhos, sessões e progresso em formato JSON.
            </p>
          </div>

          <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <p className="text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
              Eliminar a conta remove permanentemente todos os teus dados desta plataforma.
              Esta acção é irreversível.
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center justify-center rounded-md px-4 h-9 text-sm font-medium transition-colors"
              style={{ background: 'oklch(0.45 0.18 25)', color: '#fff' }}
            >
              Eliminar conta
            </button>
          </div>
        </div>
      </section>

      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
        Dúvidas sobre os teus dados?{' '}
        <Link href="/privacidade" className="underline underline-offset-2">
          Política de privacidade
        </Link>
      </p>

      {/* Modal confirmação de eliminação */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'oklch(0 0 0 / 0.5)' }}
        >
          <div
            className="w-full max-w-sm rounded-xl border p-6 space-y-4"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <h3 className="text-base font-medium" style={{ color: 'var(--foreground)' }}>
              Confirmar eliminação
            </h3>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Todos os teus sonhos, sessões e progresso serão eliminados de forma permanente.
              Não é possível recuperar estes dados depois de confirmares.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="flex-1 inline-flex items-center justify-center rounded-md h-9 text-sm font-medium disabled:opacity-50"
                style={{ background: 'oklch(0.45 0.18 25)', color: '#fff' }}
              >
                {isDeleting ? 'A eliminar…' : 'Sim, eliminar'}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 inline-flex items-center justify-center rounded-md border h-9 text-sm font-medium"
                style={{
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
