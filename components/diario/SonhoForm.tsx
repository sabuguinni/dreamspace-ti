'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { EmocaoSlider } from './EmocaoSlider'
import { TagInput } from './TagInput'
import type { SonhoDiario } from '@/lib/types'

const schema = z.object({
  data_sonho: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  titulo: z.string().max(200).optional().nullable(),
  texto: z.string().min(1, 'O texto do sonho é obrigatório').max(20000),
  emocao_score: z.number().int().min(1).max(10).optional().nullable(),
  notas: z.string().max(5000).optional().nullable(),
  tags: z.array(z.string()).max(20),
})

export type SonhoFormValues = z.infer<typeof schema>

interface SonhoFormProps {
  defaultValues?: Partial<SonhoDiario>
  onSubmit: (values: SonhoFormValues) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
  submitLabel?: string
}

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function SonhoForm({ defaultValues, onSubmit, onCancel, isLoading, submitLabel = 'Guardar' }: SonhoFormProps) {
  const { register, handleSubmit, control, formState: { errors } } = useForm<SonhoFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      data_sonho: defaultValues?.data_sonho ?? todayLocal(),
      titulo: defaultValues?.titulo ?? '',
      texto: defaultValues?.texto ?? '',
      emocao_score: defaultValues?.emocao_score ?? null,
      notas: defaultValues?.notas ?? '',
      tags: defaultValues?.tags ?? [],
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="data_sonho">Data do sonho</Label>
          <Input
            id="data_sonho"
            type="date"
            {...register('data_sonho')}
            max={todayLocal()}
          />
          {errors.data_sonho && (
            <p className="text-xs" style={{ color: 'oklch(0.55 0.22 25)' }}>{errors.data_sonho.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="titulo">Título <span style={{ color: 'var(--muted-foreground)' }}>(opcional)</span></Label>
          <Input
            id="titulo"
            {...register('titulo')}
            placeholder="Ex: A casa da infância"
            maxLength={200}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="texto">Texto do sonho <span style={{ color: 'oklch(0.55 0.22 25)' }}>*</span></Label>
        <textarea
          id="texto"
          {...register('texto')}
          rows={8}
          placeholder="Descreve o sonho com o máximo de detalhe. Não edites — escreve como te recordas..."
          className="w-full rounded-md border px-3 py-2 text-sm resize-y font-mono leading-relaxed"
          style={{
            background: 'oklch(0.965 0.008 85)',
            borderColor: errors.texto ? 'oklch(0.55 0.22 25)' : 'var(--border)',
            color: 'var(--foreground)',
            fontFamily: 'var(--font-jetbrains)',
            borderLeft: '3px solid oklch(0.375 0.132 288 / 0.5)',
          }}
          maxLength={20000}
        />
        {errors.texto && (
          <p className="text-xs" style={{ color: 'oklch(0.55 0.22 25)' }}>{errors.texto.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Score emocional <span style={{ color: 'var(--muted-foreground)' }}>(opcional)</span></Label>
        <Controller
          name="emocao_score"
          control={control}
          render={({ field }) => (
            <EmocaoSlider value={field.value ?? null} onChange={field.onChange} />
          )}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Tags <span style={{ color: 'var(--muted-foreground)' }}>(opcional)</span></Label>
        <Controller
          name="tags"
          control={control}
          render={({ field }) => (
            <TagInput tags={field.value} onChange={field.onChange} />
          )}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notas">Notas pessoais <span style={{ color: 'var(--muted-foreground)' }}>(opcional)</span></Label>
        <textarea
          id="notas"
          {...register('notas')}
          rows={3}
          placeholder="Reflexões, associações, contexto de vida..."
          className="w-full rounded-md border px-3 py-2 text-sm resize-y"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
          }}
          maxLength={5000}
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'A guardar…' : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  )
}
