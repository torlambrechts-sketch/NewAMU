// LibrarySectionHeader — category group heading inside template galleries.
// Provides a consistent uppercase tracking style across all module libraries.

type Props = {
  name: string
  /** Item count displayed inline. */
  count?: number
}

export function LibrarySectionHeader({ name, count }: Props) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
        {name}
      </h3>
      {count !== undefined && (
        <span className="text-[11px] text-neutral-500">{count}</span>
      )}
    </div>
  )
}
