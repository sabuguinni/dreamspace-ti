'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro('')
    setCarregando(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setCarregando(false)

    if (error) {
      setErro('Não foi possível enviar o link. Verifica o endereço de email e tenta novamente.')
      return
    }

    setEnviado(true)
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--background)' }}>
      <div className="w-full max-w-sm space-y-8">

        {/* Cabeçalho */}
        <div className="text-center space-y-2">
          <div className="text-sm font-medium tracking-widest uppercase"
            style={{ color: 'var(--accent)', fontFamily: 'var(--font-inter)' }}>
            Transpersonal International
          </div>
          <h1 className="text-3xl font-medium"
            style={{ fontFamily: 'var(--font-lora)', color: 'var(--primary)' }}>
            DreamSpace TI
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Plataforma de formação prática em trabalho com sonhos
          </p>
        </div>

        {/* Cartão de login */}
        <div className="rounded-lg border p-8 space-y-6"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>

          {enviado ? (
            <div className="space-y-4 text-center animate-fade-in">
              <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center"
                style={{ background: 'oklch(0.520 0.110 151 / 0.1)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                  stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <div>
                <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                  Link enviado para o teu email
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  Verifica a caixa de entrada de <strong>{email}</strong> e clica no link para aceder.
                </p>
              </div>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Não recebeste? Verifica a pasta de spam ou{' '}
                <button
                  onClick={() => setEnviado(false)}
                  className="underline underline-offset-2 cursor-pointer"
                  style={{ color: 'var(--primary)' }}>
                  tenta novamente
                </button>
                .
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <h2 className="text-lg font-medium" style={{ color: 'var(--foreground)', fontFamily: 'var(--font-lora)' }}>
                  Entrar na plataforma
                </h2>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Introduz o teu email para receber o link de acesso.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" style={{ color: 'var(--foreground)' }}>
                  Endereço de email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="o.teu@email.com"
                  required
                  autoFocus
                  disabled={carregando}
                  className="h-11"
                  style={{ background: 'var(--card)' }}
                />
              </div>

              {erro && (
                <p className="text-sm rounded-md px-3 py-2"
                  style={{
                    color: 'var(--warn)',
                    background: 'oklch(0.550 0.140 42 / 0.08)',
                  }}>
                  {erro}
                </p>
              )}

              <Button
                type="submit"
                disabled={carregando || !email}
                className="w-full h-11 font-medium"
                style={{
                  background: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                }}>
                {carregando ? 'A enviar...' : 'Enviar link de acesso'}
              </Button>
            </form>
          )}
        </div>

        {/* Nota de rodapé */}
        <p className="text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Acesso exclusivo para formandos do curso{' '}
          <span style={{ color: 'var(--foreground)' }}>A Linguagem Secreta dos Sonhos</span>.
        </p>
      </div>
    </main>
  )
}
