'use client'

import { useAnamneseEstado } from '@/lib/hooks/useAnamnese'
import { AnamneseLock } from '@/components/anamnese/AnamneseLock'
import { AvatarSelectorAnamnese } from '@/components/anamnese/AvatarSelectorAnamnese'
import { TreinoTabs } from '@/components/anamnese/TreinoTabs'
import { Skeleton } from '@/components/ui/skeleton'

export default function AnamnesePage() {
  const { data: estado, isLoading } = useAnamneseEstado()

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-medium" style={{ fontFamily: 'var(--font-lora)', color: 'var(--primary)' }}>
          Anamnese Supervisionada
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          A narrativa é a superfície. O Supervisor garante que a usas como portal para o interior.
        </p>
      </div>

      <TreinoTabs />

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
          </div>
        </div>
      )}

      {!isLoading && estado && !estado.desbloqueada && (
        <AnamneseLock sessoesConcluidas={estado.sessoesConcluidas} necessarias={estado.necessarias} />
      )}

      {!isLoading && estado?.desbloqueada && (
        <div className="space-y-5">
          <div
            className="rounded-lg border p-4 text-sm leading-relaxed"
            style={{ borderColor: '#C9A96155', background: '#3D2B0010', color: 'var(--foreground)' }}
          >
            <p className="font-medium mb-1" style={{ color: '#B8924A' }}>Como funciona</p>
            <p style={{ color: 'var(--muted-foreground)' }}>
              Conduzes uma primeira sessão de anamnese com um cliente simulado. O Supervisor observa em silêncio
              e só intervém quando ficas no manifesto — quando exploras factos externos, validas a narrativa
              sem a questionar, ou deixas passar uma porta latente. No fim recebes uma avaliação.
            </p>
          </div>

          <div>
            <p className="text-xs font-medium tracking-widest uppercase mb-3" style={{ color: 'var(--muted-foreground)' }}>
              Escolhe um cliente
            </p>
            <AvatarSelectorAnamnese />
          </div>
        </div>
      )}
    </div>
  )
}
