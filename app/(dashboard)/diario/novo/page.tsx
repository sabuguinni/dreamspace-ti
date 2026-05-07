'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { SonhoForm, type SonhoFormValues } from '@/components/diario/SonhoForm'
import { useCriarSonho } from '@/lib/hooks/useSonhos'

export default function NovoSonhoPage() {
  const router = useRouter()
  const { mutateAsync, isPending } = useCriarSonho()

  async function handleSubmit(values: SonhoFormValues) {
    await mutateAsync({
      data_sonho: values.data_sonho,
      titulo: values.titulo || null,
      texto: values.texto,
      emocao_score: values.emocao_score ?? null,
      notas: values.notas || null,
      tags: values.tags,
    })
    toast.success('Sonho guardado.')
    router.push('/diario')
  }

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-medium" style={{ fontFamily: 'var(--font-lora)', color: 'var(--primary)' }}>
          Registar sonho
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Descreve o sonho com o máximo de detalhe enquanto ainda está fresco.
        </p>
      </div>

      <div className="rounded-lg border p-6"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <SonhoForm
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
          isLoading={isPending}
          submitLabel="Guardar sonho"
        />
      </div>
    </div>
  )
}
