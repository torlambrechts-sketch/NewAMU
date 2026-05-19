// Skeleton placeholder for Studio list pages while data loads.
// Renders animated pulse rows matching the height of real template rows.

type Props = {
  rows?: number
  /** Show a section header skeleton above the rows */
  showHeader?: boolean
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="h-3.5 w-2/5 rounded bg-neutral-200" />
        <div className="h-2.5 w-1/3 rounded bg-neutral-100" />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="h-6 w-14 rounded bg-neutral-100" />
        <div className="h-7 w-20 rounded-lg bg-neutral-100" />
      </div>
    </div>
  )
}

export function StudioListSkeleton({ rows = 4, showHeader = true }: Props) {
  return (
    <div className="animate-pulse space-y-3">
      {showHeader && <div className="h-3 w-24 rounded bg-neutral-200" />}
      <div className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonRow key={`skeleton-row-${i}`} />
        ))}
      </div>
    </div>
  )
}
