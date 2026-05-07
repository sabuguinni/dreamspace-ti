import { Skeleton } from '@/components/ui/skeleton'

export default function ModuloLoading() {
  return (
    <div className="max-w-5xl">
      {/* Breadcrumb */}
      <Skeleton className="h-3 w-40 mb-6" />

      <div className="flex gap-8">
        {/* Sidebar */}
        <aside className="hidden lg:block w-52 shrink-0 space-y-2">
          {[1, 2, 3, 4, 5, 6, 7].map(i => (
            <Skeleton key={i} className="h-8 w-full rounded-md" />
          ))}
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Progress bar */}
          <div className="rounded-lg border p-4"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex justify-between mb-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-8" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>

          {/* Content blocks */}
          <div className="space-y-4">
            <Skeleton className="h-9 w-72" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-8 w-56 mt-4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
