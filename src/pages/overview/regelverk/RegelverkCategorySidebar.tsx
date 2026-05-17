// Venstre sidebar med kapittel-/kategori-counts (Vanta Tests-stil).
// Klikkbar — setter kategori-filter i tabellen.

import type { RequirementWithCoverage } from './regelverkCoverageTypes'
import { Button } from '../../../components/ui/Button'

export function RegelverkCategorySidebar({
  requirements,
  selectedCategory,
  onSelectCategory,
}: {
  requirements: RequirementWithCoverage[]
  selectedCategory: string | null
  onSelectCategory: (cat: string | null) => void
}) {
  const counts = new Map<string, { total: number; uncovered: number }>()
  for (const r of requirements) {
    const c = counts.get(r.category) ?? { total: 0, uncovered: 0 }
    c.total += 1
    if (r.status === 'uncovered') c.uncovered += 1
    counts.set(r.category, c)
  }
  const cats = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const totalAll = requirements.length
  const uncoveredAll = requirements.filter((r) => r.status === 'uncovered').length

  const Row = ({
    label,
    total,
    uncovered,
    active,
    onClick,
  }: {
    label: string
    total: number
    uncovered: number
    active: boolean
    onClick: () => void
  }) => (
    <Button
      variant="ghost"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-normal transition ${
        active
          ? 'bg-neutral-100 font-semibold text-neutral-900'
          : 'text-neutral-700 hover:bg-neutral-50'
      }`}
    >
      <span className="truncate pr-2">{label}</span>
      <span className="flex items-center gap-2 tabular-nums">
        {uncovered > 0 ? (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-900">
            {uncovered}
          </span>
        ) : null}
        <span className="text-xs text-neutral-500">{total}</span>
      </span>
    </Button>
  )

  return (
    <aside className="rounded-lg border border-neutral-200/80 bg-white p-3 shadow-sm">
      <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
        Kategori
      </p>
      <Row
        label="Alle"
        total={totalAll}
        uncovered={uncoveredAll}
        active={selectedCategory === null}
        onClick={() => onSelectCategory(null)}
      />
      <div className="my-1 border-t border-neutral-100" />
      {cats.map(([cat, c]) => (
        <Row
          key={cat}
          label={cat}
          total={c.total}
          uncovered={c.uncovered}
          active={selectedCategory === cat}
          onClick={() => onSelectCategory(cat)}
        />
      ))}
    </aside>
  )
}
