'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { METODO_LABELS, type MetodoTerapeutico } from '@/lib/types'
import { useCriarSessaoSupervisor } from '@/lib/hooks/useSupervisor'

const METODOS = Object.entries(METODO_LABELS) as [MetodoTerapeutico, string][]

function NovaSessaoForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sonhoId = searchParams.get('sonho_id')
  const sonhoTextoParam = searchParams.get('sonho_texto')

  const [sonhoTexto, setSonhoTexto] = useState(sonhoTextoParam ?? '')
  const [casoDescricao, setCasoDescricao] = useState('')
  const [analiseInicial, setAnaliseInicial] = useState('')
  const [metodo, setMetodo] = useState<MetodoTerapeutico>('nao_definido')
  const [isLoadingSonho, setIsLoadingSonho] = useState(false)

  const { mutateAsync: criarSessao, isPending } = useCriarSessaoSupervisor()

  useEffect(() => {
    if (!sonhoId) return
    setIsLoadingSonho(true)
    const supabase = createClient()
    async function load() {
      try {
        const { data } = await supabase
          .from('sonhos_diario')
          .select('texto')
          .eq('id', sonhoId!)
          .single()
        if (data?.texto) setSonhoTexto(data.texto)
      } finally {
        setIsLoadingSonho(false)
      }
    }
    load()
  }, [sonhoId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!sonhoTexto.trim()) {
      toast.error('O texto do sonho é obrigatório.')
      return
    }
    try {
      const sessao = await criarSessao({
        sonho_texto: sonhoTexto.trim(),
        caso_descricao: casoDescricao.trim() || null,
        metodo_escolhido: metodo,
        sonho_id: sonhoId ?? null,
      })
      const analise = analiseInicial.trim()
      const dest = analise
        ? `/supervisor/${sessao.id}?m=${encodeURIComponent(analise)}`
        : `/supervisor/${sessao.id}`
      router.push(dest)
    } catch (err) {
      toast.error('O Supervisor não está disponível neste momento. Tenta daqui a pouco.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border p-6 space-y-5"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>

      {/* Sonho */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          Sonho <span style={{ color: 'oklch(0.55 0.22 25)' }}>*</span>
        </label>
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Transcreve o sonho que queres explorar na supervisão.
        </p>
        <textarea
          value={isLoadingSonho ? 'A carregar…' : sonhoTexto}
          onChange={e => setSonhoTexto(e.target.value)}
          disabled={isLoadingSonho}
          required
          rows={5}
          className="w-full rounded-md border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1"
          style={{
            background: 'var(--background)',
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
            fontFamily: 'var(--font-jetbrains)',
            fontSize: '0.8125rem',
            lineHeight: '1.6',
          }}
          placeholder="Descreve o sonho com o máximo de detalhe…"
        />
      </div>

      {/* Método */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          Abordagem terapêutica
        </label>
        <select
          value={metodo}
          onChange={e => setMetodo(e.target.value as MetodoTerapeutico)}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1"
          style={{
            background: 'var(--background)',
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
          }}
        >
          {METODOS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Contexto terapêutico */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          Contexto do caso{' '}
          <span className="font-normal" style={{ color: 'var(--muted-foreground)' }}>(opcional)</span>
        </label>
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Informação relevante sobre o cliente ou o contexto terapêutico.
        </p>
        <textarea
          value={casoDescricao}
          onChange={e => setCasoDescricao(e.target.value)}
          rows={3}
          className="w-full rounded-md border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1"
          style={{
            background: 'var(--background)',
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
          }}
          placeholder="Ex.: cliente com 40 anos, 3ª sessão, padrão de evitamento emocional…"
        />
      </div>

      {/* Análise inicial */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          A tua análise inicial{' '}
          <span className="font-normal" style={{ color: 'var(--muted-foreground)' }}>(opcional)</span>
        </label>
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          A tua primeira leitura do sonho. Será pré-preenchida como mensagem de abertura.
        </p>
        <textarea
          value={analiseInicial}
          onChange={e => setAnaliseInicial(e.target.value)}
          rows={3}
          className="w-full rounded-md border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1"
          style={{
            background: 'var(--background)',
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
          }}
          placeholder="Ex.: Julgo que o sonho reflecte um conflito entre…"
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isPending || isLoadingSonho || !sonhoTexto.trim()}
          className="inline-flex items-center justify-center rounded-md px-5 h-9 text-sm font-medium transition-colors disabled:opacity-50"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          {isPending ? 'A criar…' : 'Iniciar supervisão'}
        </button>
        <Link href="/supervisor" className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Cancelar
        </Link>
      </div>
    </form>
  )
}

export default function NovaSessaoPage() {
  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div>
        <nav className="text-xs mb-3" style={{ color: 'var(--muted-foreground)' }}>
          <Link href="/supervisor" className="hover:underline">Supervisor</Link>
          <span className="mx-1.5">›</span>
          <span>Nova sessão</span>
        </nav>
        <h1 className="text-2xl font-medium" style={{ fontFamily: 'var(--font-lora)', color: 'var(--primary)' }}>
          Nova sessão de Supervisão
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          O Supervisor vai guiar-te pelos 4 níveis de reflexão socrática em psicoterapia transpessoal.
        </p>
      </div>

      <Suspense fallback={
        <div className="rounded-lg border p-6" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="h-48 flex items-center justify-center">
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>A carregar…</p>
          </div>
        </div>
      }>
        <NovaSessaoForm />
      </Suspense>
    </div>
  )
}
