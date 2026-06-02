'use client'

import { labelErro, type TipoErro } from '@/lib/anamnese/types'

interface Props {
  tipoErro: TipoErro | string
  intervencao: string
}

/**
 * Bloco de intervenção do Supervisor de Anamnese.
 * Visualmente distinto do chat normal — fundo âmbar escuro, borda dourada,
 * para o formando distinguir do Supervisor de Sonhos.
 */
export function BlocoSupervisorAnamnese({ tipoErro, intervencao }: Props) {
  return (
    <div
      className="rounded-xl p-4 space-y-2.5 animate-fade-in"
      style={{
        background: '#3D2B00',
        border: '1px solid #C9A961',
        color: '#F0E6D2',
        boxShadow: '0 2px 12px rgba(201, 169, 97, 0.12)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 pb-2" style={{ borderBottom: '1px solid rgba(201,169,97,0.3)' }}>
        <span className="text-base leading-none">👁</span>
        <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#C9A961' }}>
          Supervisor · Anamnese
        </span>
      </div>

      {/* Tipo de erro */}
      <p className="text-sm font-semibold" style={{ color: '#F0E6D2' }}>
        {labelErro(tipoErro)}
        <span className="ml-2 text-xs font-mono font-normal" style={{ color: 'rgba(201,169,97,0.7)' }}>
          ({String(tipoErro)})
        </span>
      </p>

      {/* Intervenção */}
      <p className="text-sm leading-relaxed" style={{ color: '#E8DCC4' }}>
        {intervencao}
      </p>
    </div>
  )
}
