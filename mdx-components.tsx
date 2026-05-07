import type { MDXComponents } from 'mdx/types'
import type { ReactNode } from 'react'
import { CasoPratico } from '@/components/manual/CasoPratico'
import { ExercicioBox } from '@/components/manual/ExercicioBox'
import { CitacaoDestaque } from '@/components/manual/CitacaoDestaque'
import { SinteseModulo } from '@/components/manual/SinteseModulo'

function headingId(children: ReactNode): string {
  const text = typeof children === 'string'
    ? children
    : Array.isArray(children)
      ? children.map(c => (typeof c === 'string' ? c : '')).join('')
      : ''
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-À-ɏ]/gu, '')
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h2: ({ children, ...props }) => (
      <h2 id={headingId(children)} {...props}>{children}</h2>
    ),
    CasoPratico,
    ExercicioBox,
    CitacaoDestaque,
    SinteseModulo,
    ...components,
  }
}
