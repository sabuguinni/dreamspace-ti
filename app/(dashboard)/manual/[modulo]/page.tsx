import { notFound } from 'next/navigation'
import { MODULOS_CONFIG } from '@/lib/content/manual/config'
import { ManualPageClient } from '@/components/manual/ManualPageClient'

interface Props {
  params: Promise<{ modulo: string }>
}

export default async function ModuloPage({ params }: Props) {
  const { modulo } = await params
  const config = MODULOS_CONFIG[modulo]
  if (!config) notFound()

  let Content: React.ComponentType
  try {
    const mod = await import(`@/lib/content/manual/${modulo}.mdx`)
    Content = mod.default
  } catch {
    notFound()
  }

  return (
    <ManualPageClient config={config} modulo={modulo}>
      <Content />
    </ManualPageClient>
  )
}
