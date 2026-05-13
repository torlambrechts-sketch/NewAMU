// Scorecard-visning for Regelverk-dekning — ett kort per kategori, én rad per krav.
// Følger platform-admin/layout scorecard-mønsteret:
//   - Hvitt kort med krem-detalj-seksjon
//   - Kort-header: kategorinavn + dekning-bar + X/Y-teller
//   - Rad: § (serif) · tittel · plikt-pill · status-ikon
//   - Klikk på rad → slide-over

import { AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react'
import type { RequirementWithCoverage } from './regelverkCoverageTypes'
import { obligationLabel } from './regelverkCoverageTypes'

const FOREST = '#1a3d32'
const CREAM_DEEP = 'rgba(245, 230, 211, 0.50)'
const SERIF = "'Libre Baskerville', Georgia, serif"

function StatusIcon({ status }: { status: RequirementWithCoverage['status'] }) {
  if (status === 'covered')
    return <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-label="Dekket" />
  if (status === 'partial')
    return <Clock className="size-4 shrink-0 text-amber-500" aria-label="Mangler bevis" />
  if (status === 'only_avvik')
    return <AlertTriangle className="size-4 shrink-0 text-amber-600" aria-label="Kun avvik" />
  return <XCircle className="size-4 shrink-0 text-red-500" aria-label="Udekket" />
}

function ObligationDot({ o }: { o: RequirementWithCoverage['obligation'] }) {
  const cls =
    o === 'mandatory'
      ? 'bg-red-50 text-red-900 ring-red-200'
      : o === 'recommended'
        ? 'bg-amber-50 text-amber-900 ring-amber-200'
        : 'bg-neutral-50 text-neutral-700 ring-neutral-200'
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${cls}`}
    >
      {obligationLabel(o)}
    </span>
  )
}

function CategoryCard({
  category,
  rows,
  onOpenRow,
}: {
  category: string
  rows: RequirementWithCoverage[]
  onOpenRow: (lawRef: string) => void
}) {
  const total = rows.length
  const covered = rows.filter((r) => r.status === 'covered').length
  const partial = rows.filter((r) => r.status === 'partial').length
  const pct = total === 0 ? 0 : Math.round((covered / total) * 100)
  const needsAttention = rows.filter(
    (r) => r.status === 'uncovered' || r.status === 'only_avvik',
  ).length

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200/80 bg-white shadow-sm">
      {/* Card header */}
      <div className="border-b border-neutral-100 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <h3
            className="text-base font-semibold text-neutral-900"
            style={{ fontFamily: SERIF }}
          >
            {category}
          </h3>
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
              Dekket
            </p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums" style={{ color: FOREST }}>
              {pct}%
            </p>
          </div>
        </div>

        {/* Coverage bar */}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: FOREST }}
          />
        </div>

        {/* Counts row */}
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-500">
          <span>
            <span className="font-semibold text-emerald-700">{covered}</span> dekket
          </span>
          {partial > 0 ? (
            <span>
              <span className="font-semibold text-amber-700">{partial}</span> mangler bevis
            </span>
          ) : null}
          {needsAttention > 0 ? (
            <span>
              <span className="font-semibold text-red-700">{needsAttention}</span> udekket/avvik
            </span>
          ) : null}
          <span className="text-neutral-400">av {total} krav</span>
        </div>
      </div>

      {/* Per-krav rows */}
      <div style={{ backgroundColor: CREAM_DEEP }}>
        <ul className="divide-y divide-neutral-100/80">
          {rows.map((r) => (
            <li key={r.lawRef}>
              <button
                type="button"
                onClick={() => onOpenRow(r.lawRef)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-white/60"
              >
                <StatusIcon status={r.status} />
                <span
                  className="w-28 shrink-0 text-[13px] font-semibold text-neutral-900"
                  style={{ fontFamily: SERIF }}
                >
                  {r.lawRef}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-neutral-700">
                  {r.title}
                </span>
                {r.applies ? (
                  <span className="hidden shrink-0 text-[11px] text-neutral-400 lg:block">
                    {r.applies}
                  </span>
                ) : null}
                <ObligationDot o={r.obligation} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function RegelverkScorecardView({
  requirements,
  search,
  selectedCategory,
  onOpenRow,
}: {
  requirements: RequirementWithCoverage[]
  search: string
  selectedCategory: string | null
  onOpenRow: (lawRef: string) => void
}) {
  const q = search.trim().toLowerCase()

  const filtered = requirements.filter((r) => {
    if (selectedCategory && r.category !== selectedCategory) return false
    if (!q) return true
    return `${r.lawRef} ${r.title} ${r.category}`.toLowerCase().includes(q)
  })

  // Group by category, preserving insertion order from requirements array
  const groups = new Map<string, RequirementWithCoverage[]>()
  for (const r of filtered) {
    if (!groups.has(r.category)) groups.set(r.category, [])
    groups.get(r.category)!.push(r)
  }

  if (groups.size === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white px-6 py-10 text-center text-neutral-500">
        Ingen krav matcher søket.
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {[...groups.entries()].map(([cat, rows]) => (
        <CategoryCard key={cat} category={cat} rows={rows} onOpenRow={onOpenRow} />
      ))}
    </div>
  )
}
