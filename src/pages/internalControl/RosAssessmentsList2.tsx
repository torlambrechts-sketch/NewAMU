import { AlertTriangle, ChevronLeft, ChevronRight, Filter, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { RosAssessment } from '../../types/internalControl'
import { List2Shell } from '../../components/layout/List2Shell'

const FOREST = '#1a3d32'
const CREAM_DEEP = '#EFE8DC'
const SERIF = "'Libre Baskerville', Georgia, serif"

function SerifHeading({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`font-semibold text-neutral-900 ${className}`} style={{ fontFamily: SERIF }}>
      {children}
    </h2>
  )
}

type StatusFilter = 'all' | 'draft' | 'locked'

export function RosAssessmentsList2({
  assessments,
  search,
  onSearchChange,
  onNewRos,
  onOpenRow,
}: {
  assessments: RosAssessment[]
  search: string
  onSearchChange: (q: string) => void
  onNewRos: () => void
  onOpenRow: (id: string) => void
}) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [perPage, setPerPage] = useState(10)
  const [page, setPage] = useState(1)

  const activeFilters = statusFilter !== 'all'

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return assessments.filter((r) => {
      if (statusFilter === 'draft' && r.locked) return false
      if (statusFilter === 'locked' && !r.locked) return false
      if (!q) return true
      const hay = `${r.title} ${r.department ?? ''} ${r.assessor ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [assessments, search, statusFilter])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const pageSafe = Math.min(page, totalPages)
  const start = (pageSafe - 1) * perPage
  const pageRows = filtered.slice(start, start + perPage)

  return (
    <section aria-label="ROS-vurderinger">
      <List2Shell>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div>
            <SerifHeading className="text-xl">ROS-vurderinger</SerifHeading>
            <p className="mt-1 text-sm text-neutral-600">
              Klikk på en rad for å åpne analysen i sidevinduet. «Ny ROS» oppretter nytt dokument i samme panel.
            </p>
          </div>
          <button
            type="button"
            onClick={onNewRos}
            className="rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wide text-white"
            style={{ backgroundColor: FOREST }}
          >
            Ny ROS
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-4 py-3 md:px-5">
          <div className="relative min-w-[200px] flex-1">
            <label htmlFor="ros-list2-search" className="sr-only">
              Søk i ROS-vurderinger
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              id="ros-list2-search"
              type="search"
              value={search}
              onChange={(e) => {
                onSearchChange(e.target.value)
                setPage(1)
              }}
              placeholder="Søk i tittel, avdeling, vurderer …"
              className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-[#1a3d32]/25"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
              Filter
            </button>
            <span className="text-xs text-neutral-500">{activeFilters ? 'Filter aktive' : 'Ingen filter'}</span>
          </div>
        </div>
        {filtersOpen ? (
          <div className="border-b border-neutral-100 px-4 py-3 md:px-5" style={{ backgroundColor: CREAM_DEEP }}>
            <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
              Status
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as StatusFilter)
                  setPage(1)
                }}
                className="mt-1.5 block max-w-xs rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
              >
                <option value="all">Alle</option>
                <option value="draft">Utkast</option>
                <option value="locked">Låst</option>
              </select>
            </label>
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/90 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                <th className="px-5 py-3">ROS / tittel</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Avdeling</th>
                <th className="px-5 py-3">Dato</th>
                <th className="px-5 py-3">Rader</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-neutral-500">
                    {search.trim() || activeFilters ? 'Ingen ROS matcher søk eller filter.' : 'Ingen ROS-vurderinger ennå.'}
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => (
                  <tr
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenRow(r.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onOpenRow(r.id)
                      }
                    }}
                    className="cursor-pointer border-b border-neutral-100 transition hover:bg-neutral-50/80"
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-neutral-900">{r.title}</p>
                      <p className="text-xs text-neutral-500">{r.assessor || '—'}</p>
                    </td>
                    <td className="px-5 py-4">
                      {r.locked ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-900">
                          Låst
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-950">
                          <AlertTriangle className="size-3.5 shrink-0 text-amber-700" aria-hidden />
                          Utkast
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-neutral-700">{r.department || '—'}</td>
                    <td className="px-5 py-4 text-neutral-700">{r.assessedAt}</td>
                    <td className="px-5 py-4 tabular-nums text-neutral-800">{r.rows.length}</td>
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
