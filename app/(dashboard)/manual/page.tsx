import Link from 'next/link'
import { TODOS_MODULOS } from '@/lib/content/manual/config'

export default function ManualPage() {
  return (
    <div className="max-w-3xl space-y-8 animate-fade-in">
      <div>
        <h1
          className="text-2xl font-medium"
          style={{ fontFamily: 'var(--font-lora)', color: 'var(--primary)' }}
        >
          Manual de Trabalho com Sonhos
        </h1>
        <p className="text-sm mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
          9 módulos de formação em trabalho terapêutico com sonhos. Teoria, casos práticos e prática guiada.
        </p>
      </div>

      <div className="space-y-3">
        {TODOS_MODULOS.map((mod, i) => (
          mod.disponivel ? (
            <Link
              key={mod.slug}
              href={`/manual/${mod.slug}`}
              className="flex items-start gap-4 rounded-lg border p-4 transition-colors group"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0"
                style={{ background: 'oklch(0.26 0.15 252 / 0.1)', color: 'oklch(0.26 0.15 252)' }}
              >
                {mod.numero}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium group-hover:underline" style={{ color: 'var(--foreground)' }}>
                  {mod.titulo}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  {mod.subtitulo}
                </p>
              </div>
              <div className="shrink-0 text-right space-y-0.5">
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{mod.duracao}</p>
                {mod.casos > 0 && (
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {mod.casos} caso{mod.casos !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </Link>
          ) : (
            <div
              key={mod.slug}
              className="flex items-start gap-4 rounded-lg border p-4 opacity-50"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0"
                style={{ background: 'var(--muted-foreground)', color: 'var(--card)', opacity: 0.4 }}
              >
                {mod.numero}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {mod.titulo}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  {mod.subtitulo}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted-foreground)' }}>
                  <rect x="2" y="5" width="8" height="6" rx="1" />
                  <path d="M4 5V3.5a2 2 0 014 0V5" />
                </svg>
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Em breve</span>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  )
}
