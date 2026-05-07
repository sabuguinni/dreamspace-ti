'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { useSonho, useEditarSonho, useApagarSonho } from '@/lib/hooks/useSonhos'
import { SonhoForm, type SonhoFormValues } from '@/components/diario/SonhoForm'
import { EmocaoScore } from '@/components/diario/EmocaoScore'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

function formatDataSonho(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function SonhoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: sonho, isLoading } = useSonho(id)
  const { mutateAsync: editar, isPending: isEditing } = useEditarSonho()
  const { mutateAsync: apagar, isPending: isDeleting } = useApagarSonho()

  const [editMode, setEditMode] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleEdit(values: SonhoFormValues) {
    await editar({
      id,
      data_sonho: values.data_sonho,
      titulo: values.titulo || null,
      texto: values.texto,
      emocao_score: values.emocao_score ?? null,
      notas: values.notas || null,
      tags: values.tags,
    })
    toast.success('Sonho actualizado.')
    setEditMode(false)
  }

  async function handleDelete() {
    await apagar(id)
    toast.success('Sonho eliminado.')
    router.push('/diario')
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-6">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-1/4" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    )
  }

  if (!sonho) {
    return (
      <div className="max-w-2xl space-y-4">
        <p style={{ color: 'var(--muted-foreground)' }}>Sonho não encontrado.</p>
        <Link href="/diario" className="text-sm underline" style={{ color: 'var(--primary)' }}>
          Voltar ao diário
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
        <Link href="/diario" className="hover:underline">Diário</Link>
        <span className="mx-1.5">›</span>
        <span>{sonho.titulo || formatDataSonho(sonho.data_sonho)}</span>
      </nav>

      {editMode ? (
        <div className="space-y-4">
          <h1 className="text-2xl font-medium" style={{ fontFamily: 'var(--font-lora)', color: 'var(--primary)' }}>
            Editar sonho
          </h1>
          <div className="rounded-lg border p-6"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <SonhoForm
              defaultValues={sonho}
              onSubmit={handleEdit}
              onCancel={() => setEditMode(false)}
              isLoading={isEditing}
              submitLabel="Actualizar"
            />
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-medium leading-tight" style={{ fontFamily: 'var(--font-lora)', color: 'var(--primary)' }}>
                {sonho.titulo || 'Sem título'}
              </h1>
              <button
                type="button"
                onClick={() => setEditMode(true)}
                className="shrink-0 text-sm underline"
                style={{ color: 'var(--muted-foreground)' }}
              >
                Editar
              </button>
            </div>
            <p className="text-sm capitalize" style={{ color: 'var(--muted-foreground)' }}>
              {formatDataSonho(sonho.data_sonho)}
            </p>
          </div>

          {/* Score */}
          {sonho.emocao_score != null && (
            <EmocaoScore score={sonho.emocao_score} />
          )}

          {/* Tags */}
          {sonho.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sonho.tags.map(tag => (
                <Link
                  key={tag}
                  href={`/diario?tag=${encodeURIComponent(tag)}`}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    background: 'oklch(0.375 0.132 288 / 0.1)',
                    color: 'oklch(0.375 0.132 288)',
                    border: '1px solid oklch(0.375 0.132 288 / 0.25)',
                  }}
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}

          {/* Texto do sonho */}
          <div
            className="rounded-lg p-5 text-sm leading-relaxed whitespace-pre-wrap"
            style={{
              background: 'oklch(0.965 0.008 85)',
              borderLeft: '3px solid oklch(0.375 0.132 288 / 0.5)',
              color: 'var(--foreground)',
              fontFamily: 'var(--font-jetbrains)',
            }}
          >
            {sonho.texto}
          </div>

          {/* Notas */}
          {sonho.notas && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
                Notas pessoais
              </p>
              <div
                className="rounded-lg border p-4 text-sm leading-relaxed whitespace-pre-wrap"
                style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                {sonho.notas}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <Link
              href={`/supervisor/nova?sonho_id=${sonho.id}`}
              className="inline-flex items-center justify-center rounded-md px-4 h-9 text-sm font-medium"
              style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              Levar à supervisão
            </Link>
            <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
              Editar
            </Button>
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-sm ml-auto"
                style={{ color: 'oklch(0.55 0.22 25)' }}
              >
                Eliminar
              </button>
            ) : (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Tens a certeza?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-sm font-medium"
                  style={{ color: 'oklch(0.55 0.22 25)' }}
                >
                  {isDeleting ? 'A eliminar…' : 'Confirmar'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-sm"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
