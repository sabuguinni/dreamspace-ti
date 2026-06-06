import Image from 'next/image'

/**
 * Avatar visual de um cliente de Anamnese.
 * Mostra a foto (retrato IA) circular quando `imagem` existe; caso contrário
 * faz fallback para o círculo com a inicial e a cor do cliente (retrocompatível).
 */
export function AnamneseAvatarFoto({
  imagem,
  nome,
  cor,
  size = 44,
  textClass = 'text-base',
}: {
  imagem?: string | null
  nome?: string
  cor: string
  size?: number
  textClass?: string
}) {
  const dim = `${size}px`
  if (imagem) {
    return (
      <div className="rounded-full overflow-hidden shrink-0" style={{ width: dim, height: dim }}>
        <Image
          src={imagem}
          alt={nome ?? 'cliente'}
          width={size}
          height={size}
          className="w-full h-full object-cover rounded-full"
          unoptimized
        />
      </div>
    )
  }
  return (
    <div
      className={`rounded-full flex items-center justify-center ${textClass} font-semibold text-white shrink-0`}
      style={{ width: dim, height: dim, background: cor }}
    >
      {nome?.[0] ?? '?'}
    </div>
  )
}
