import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="max-w-3xl space-y-8">
      {/* Saudação + citação */}
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <div className="rounded-md border-l-4 pl-5 py-4 space-y-2"
          style={{ borderColor: 'var(--accent)', background: 'var(--background)' }}>
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-32 mt-2" />
        </div>
      </div>

      {/* Cartões */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map(i => (
          <div key={i} className="rounded-lg border p-5 space-y-3"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-9 w-36 mt-2" />
          </div>
        ))}
      </div>

      {/* Manual */}
      <div className="rounded-lg border p-5 space-y-4"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <Skeleton className="h-5 w-32" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  )
}
