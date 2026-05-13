// List2-tabell over krav med modul-chips, plikt-pill og status-pill.
// Klikk på rad → onOpenRow med kravets lawRef.

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  XCircle,
} from 'lucide-react'
import { List2Shell } from '../../../components/layout/List2Shell'
import {
  CONTENT_AXES,
  OPERATIONAL_AXES,
  obligationLabel,
  type RequirementWithCoverage,
} from './regelverkCoverageTypes'

const CREAM_DEEP = '#EFE8DC'
const SERIF = "'Libre Baskerville', Georgia, serif"

type ObligationFilter = 'all' | 'mandatory' | 'recommended' | 'conditional'
type StatusFilter = 'all' | 'covered' | 'partial' | 'only_avvik' | 'uncovered'

function StatusPill({ req }: { req: RequirementWithCoverage }) {
  if (req.status === 'covered') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-900"
        title={`${req.proof.freshInstances} fersk publisert instans innen 12 mnd`}
      >
        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-700" aria-hidden />
        Dekket
      </span>
    )
  }
  if (req.status === 'partial') {
    const bits: string[] = []
    if (req.proof.templatesOnly > 0) bits.push(`${req.proof.templatesOnly} mal`)
    if (req.proof.staleInstances > 0) bits.push(`${req.proof.staleInstances} foreldet`)
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900 ring-1 ring-inset ring-amber-200"
        title={`Mangler reelt bevis — ${bits.join(', ') || 'kun mal tilgjengelig'}`}
      >
        <Clock className="size-3.5 shrink-0 text-amber-600" aria-hidden />
        Mangler bevis
      </span>
    )
  }
  if (req.status === 'only_avvik') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-950"
        title="Registrert avvik på denne §, men ingen preventiv rutine"
      >
        <AlertTriangle className="size-3.5 shrink-0 text-amber-700" aria-hidden />
        Kun avvik
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-semibold text-red-900">
      <XCircle className="size-3.5 shrink-0 text-red-700" aria-hidden />
      Udekket
    </span>
  )
}

function ObligationPill({ o }: { o: RequirementWithCoverage['obligation'] }) {
  const cls =
    o === 'mandatory'
      ? 'bg-red-50 text-red-900 ring-red-200'
      : o === 'recommended'
        ? 'bg-amber-50 text-amber-900 ring-amber-200'
        : 'bg-neutral-50 text-neutral-700 ring-neutral-200'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${cls}`}
    >
      {obligationLabel(o)}
    </span>
  )
}

function ModuleChips({ req }: { req: RequirementWithCoverage }) {
  const contentChips = CONTENT_AXES.map((axis) => ({
    id: axis.id,
    label: axis.label,
    count: axis.kinds.reduce((sum, k) => sum + (req.byKind[k] ?? 0), 0),
  })).filter((c) => c.count > 0)

  const operationalChips = OPERATIONAL_AXES.map((axis) => ({
    id: axis.id,
    label: axis.label,
    count: axis.kinds.reduce((sum, k) => sum + (req.byKind[k] ?? 0), 0),
  })).filter((c) => c.count > 0)

  if (contentChips.length === 0 && operationalChips.length === 0) {
    return <span className="text-xs italic text-neutral-400">Ingen ressurser</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {contentChips.map((c) => (
        <span
          key={c.id}
          className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-900 ring-1 ring-inset ring-emerald-100"
        >
          {c.label}
          <span className="rounded-sm bg-white px-1 text-[10px] font-bold tabular-nums text-emerald-900">
            {c.count}
          </span>
        </span>
      ))}
      {operationalChips.map((c) => (
        <span
          key={c.id}
          title="Operasjonelt signal — teller ikke som dekning"
          className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 ring-1 ring-inset ring-amber-100"
        >
          {c.label}
          <span className="rounded-sm bg-white px-1 text-[10px] font-bold tabular-nums text-amber-900">
            {c.count}
          </span>
        </span>
      ))}
    </div>
  )
}

export function RegelverkCoverageTable({
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
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [obligation, setObligation] = useState<ObligationFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [perPage, setPerPage] = useState(25)
  const [page, setPage] = useState(1)

  const activeFilters =
    obligation !== 'all' || status !== 'all' || selectedCategory !== null

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return requirements.filter((r) => {
      if (selectedCategory && r.category !== selectedCategory) return false
      if (obligation !== 'all' && r.obligation !== obligation) return false
      if (status !== 'all' && r.status !== status) return false
      if (!q) return true
      const hay = `${r.lawRef} ${r.title} ${r.category} ${(r.alternateRefs ?? []).join(' ')}`.toLowerCase()
      return hay.includes(q)
    })
  }, [requirements, search, obligation, status, selectedCategory])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const pageSafe = Math.min(page, totalPages)
  const start = (pageSafe - 1) * perPage
  const pageRows = filtered.slice(start, start + perPage)

  return (
    <section aria-label="Lovkrav">
      <List2Shell>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 md:px-5">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
              filtersOpen || activeFilters
                ? 'border-neutral-400 bg-neutral-50 text-neutral-900'
                : 'border-neutral-200 bg-white text-neutral-700'
            }`}
            aria-expanded={filtersOpen}
          >
            <Filter className="size-3.5 text-neutral-500" />
            Plikt / status
            {activeFilters ? (
              <span className="ml-1 rounded-full bg-[#1a3d32] px-1.5 py-0.5 text-[10px] font-bold text-white">
                {(obligation !== 'all' ? 1 : 0) +
                  (status !== 'all' ? 1 : 0) +
                  (selectedCategory ? 1 : 0)}
              </span>
            ) : null}
          </button>
          <span className="text-xs text-neutral-500">
            {total} av {requirements.length} krav
          </span>
        </div>

        {filtersOpen ? (
          <div
            className="flex flex-wrap gap-6 border-b border-neutral-100 px-4 py-3 md:px-5"
            style={{ backgroundColor: CREAM_DEEP }}
          >
            <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
              Plikt
              <select
                value={obligation}
                onChange={(e) => {
                  setObligation(e.target.value as ObligationFilter)
                  setPage(1)
                }}
                className="mt-1.5 block min-w-[160px] rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
              >
                <option value="all">Alle</option>
                <option value="mandatory">Pliktig</option>
                <option value="recommended">Anbefalt</option>
                <option value="conditional">Betinget</option>
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
              Status
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as StatusFilter)
                  setPage(1)
                }}
                className="mt-1.5 block min-w-[160px] rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
              >
                <option value="all">Alle</option>
                <option value="covered">Dekket</option>
                <option value="partial">Mangler bevis</option>
                <option value="only_avvik">Kun avvik</option>
                <option value="uncovered">Udekket</option>
              </select>
            </label>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/90 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                <th className="px-5 py-3">§ / Krav</th>
                <th className="px-5 py-3">Dekkes av</th>
                <th className="px-5 py-3">Plikt</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-neutral-500">
                    {search.trim() || activeFilters
                      ? 'Ingen krav matcher søk eller filter.'
                      : 'Ingen krav i dette regelverket.'}
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => (
                  <tr
                    key={r.lawRef}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenRow(r.lawRef)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onOpenRow(r.lawRef)
                      }
                    }}
                    className="cursor-pointer border-b border-neutral-100 transition hover:bg-neutral-50/80"
                  >
                    <td className="px-5 py-4">
                      <p
                        className="font-semibold text-neutral-900"
                        style={{ fontFamily: SERIF }}
                      >
                        {r.lawRef}
                      </p>
                      <p className="mt-0.5 text-sm text-neutral-700">{r.title}</p>
                      {r.applies ? (
                        <p className="mt-0.5 text-[11px] text-neutral-500">
                          Gjelder: {r.applies}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">
                      <ModuleChips req={r} />
                    </td>
                    <td className="px-5 py-4">
                      <ObligationPill o={r.obligation} />
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill req={r} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-5 py-3 text-xs text-neutral-600">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="text-neutral-500">Rader per side</span>
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value))
                  setPage(1)
                }}
                className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
            <span className="text-neutral-500">
              {total === 0 ? 0 : start + 1} – {Math.min(start + perPage, total)} av {total}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={pageSafe <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded p-1 text-neutral-400 hover:bg-neutral-100 disabled:opacity-40"
              aria-label="Forrige side"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="px-2 tabular-nums">
              {pageSafe} / {totalPages}
            </span>
            <button
              type="button"
              disabled={pageSafe >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded p-1 text-neutral-400 hover:bg-neutral-100 disabled:opacity-40"
              aria-label="Neste side"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </List2Shell>
    </section>
  )
}
