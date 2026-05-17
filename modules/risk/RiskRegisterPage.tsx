// RiskRegisterPage — P2 list view over `risk_register_summary_v`.
//
// Shows every risk-bearing row in one table: title, source, hazard,
// likelihood × consequence, score, band, owner, status, last
// reviewed. Free-text search and band/source/hazard chips narrow the
// list. Each row deeplinks back to the source module so the inspector
// can follow the trail (Arbeidstilsynet — ROS, handlingsplan,
// frister, ansvar).
//
// URL state:
//   ?riskId=<id>   — scorecard drill from /risk/analyse highlights and
//                    scrolls to a specific row.
//   ?band=red      — pre-select band chip.
//   ?source=task   — pre-select source chip.

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, Filter, Search, ExternalLink, AlertTriangle } from 'lucide-react'
import { useRiskDashboardRows } from './dashboards/useRiskDashboardRows'
import {
  HAZARD_CATEGORIES,
  riskBandLabel,
  type HazardCategoryId,
  type RiskBand,
} from './dashboards/hazardCategories'
import { RISK_SOURCE_LABELS, type RiskSource, type UnifiedRiskRow } from './dashboards/useRiskDatasets'

// Source-specific deeplinks. Per-row precision (e.g. opening the exact
// task detail panel) requires `selected=<id>` query support on the
// target page; that doesn't exist yet, so we land the user on the
// closest list view and they pick the row by title.
const SOURCE_DEEPLINK: Record<RiskSource, () => string | null> = {
  task: () => `/tasks/management`,
  checklist: () => `/compliance/checklists`,
  deviation: () => `/tasks/management/alle`,
  inspection: () => `/tasks/management/alle`,
  alert: () => `/alerts`,
  ros: () => null,
  sja: () => null,
}

const BAND_PILL: Record<RiskBand, string> = {
  green: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  yellow: 'bg-amber-100 text-amber-800 ring-amber-200',
  red: 'bg-rose-100 text-rose-800 ring-rose-200',
}

function ageDays(iso: string): number {
  return Math.floor((new Date().getTime() - new Date(iso).getTime()) / 86_400_000)
}

function formatAge(iso: string): string {
  const d = ageDays(iso)
  if (d < 30) return `${d} d`
  const months = Math.floor(d / 30)
  if (months < 12) return `${months} mnd`
  return `${Math.floor(months / 12)} år`
}

export function RiskRegisterPage() {
  const location = useLocation()
  const { loading, error, rows, path } = useRiskDashboardRows()

  // URL → initial filter state
  const initialParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const [search, setSearch] = useState('')
  const [bandFilter, setBandFilter] = useState<RiskBand | null>(
    () => {
      const b = initialParams.get('band')
      return b === 'green' || b === 'yellow' || b === 'red' ? b : null
    },
  )
  const [sourceFilter, setSourceFilter] = useState<RiskSource | null>(
    () => {
      const s = initialParams.get('source') as RiskSource | null
      return s && (Object.keys(RISK_SOURCE_LABELS) as RiskSource[]).includes(s) ? s : null
    },
  )
  const [hazardFilter, setHazardFilter] = useState<HazardCategoryId | null>(
    () => {
      const h = initialParams.get('hazardCategory') as HazardCategoryId | null
      return h && HAZARD_CATEGORIES.some((c) => c.id === h) ? h : null
    },
  )
  const [openOnly, setOpenOnly] = useState(true)

  const highlightedId = initialParams.get('riskId')

  // Auto-scroll to highlighted row from scorecard drill
  useEffect(() => {
    if (!highlightedId) return
    const el = document.getElementById(`risk-row-${highlightedId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightedId, rows.length])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (openOnly && !r.isOpen) return false
      if (bandFilter && r.band !== bandFilter) return false
      if (sourceFilter && r.source !== sourceFilter) return false
      if (hazardFilter && r.hazardCategory !== hazardFilter) return false
      if (q && !r.title.toLowerCase().includes(q)) return false
      return true
    }).sort((a, b) => b.riskScore - a.riskScore || (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
  }, [rows, search, bandFilter, sourceFilter, hazardFilter, openOnly])

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <nav className="text-sm text-neutral-500">
            <Link to="/risk/analyse" className="hover:text-neutral-900">Risiko</Link>
            <span className="mx-2">/</span>
            <span className="text-neutral-900">Risikoregister</span>
          </nav>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-900">Risikoregister</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Samlet liste over aktive risikoer på tvers av sjekklister, avvik,
            vernerunder, varslinger og ROS. Klikk en rad for å åpne kilden.
          </p>
        </div>
        <Link
          to="/risk/analyse"
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Til analyse
        </Link>
      </div>

      {/* Filter chrome */}
      <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[12rem]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk i tittel…"
              className="w-full rounded-md border border-neutral-300 bg-white py-1.5 pl-8 pr-3 text-sm placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
            />
          </div>

          <label className="flex items-center gap-1.5 text-sm text-neutral-700">
            <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} className="rounded border-neutral-300" />
            Kun åpne
          </label>

          <FilterPill label="Bånd" active={bandFilter} onClear={() => setBandFilter(null)}>
            {(['red', 'yellow', 'green'] as RiskBand[]).map((b) => (
              <PillOption key={b} active={bandFilter === b} onClick={() => setBandFilter(b)}>
                <span className={`mr-1 inline-block h-2 w-2 rounded-full ${b === 'red' ? 'bg-rose-500' : b === 'yellow' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                {riskBandLabel(b)}
              </PillOption>
            ))}
          </FilterPill>

          <FilterPill label="Kilde" active={sourceFilter} onClear={() => setSourceFilter(null)}>
            {(Object.keys(RISK_SOURCE_LABELS) as RiskSource[]).map((s) => (
              <PillOption key={s} active={sourceFilter === s} onClick={() => setSourceFilter(s)}>
                {RISK_SOURCE_LABELS[s]}
              </PillOption>
            ))}
          </FilterPill>

          <FilterPill label="Fareklasse" active={hazardFilter} onClear={() => setHazardFilter(null)}>
            {HAZARD_CATEGORIES.map((h) => (
              <PillOption key={h.id} active={hazardFilter === h.id} onClick={() => setHazardFilter(h.id)}>
                {h.labelNb}
              </PillOption>
            ))}
          </FilterPill>
        </div>
      </div>

      {/* Results */}
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Kunne ikke laste risikoregisteret.</p>
            <p className="mt-0.5 text-xs">{error}</p>
          </div>
        </div>
      )}

      {!loading && filtered.length === 0 && !error && (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center">
          <p className="text-sm text-neutral-600">
            Ingen risikoer matcher filtrene.
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-xs uppercase tracking-wider text-neutral-500">
            {filtered.length} {filtered.length === 1 ? 'risiko' : 'risikoer'}
            {path === 'source' && (
              <span className="ml-2 text-amber-700">· klientside-aggregering (P1)</span>
            )}
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 text-left text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Tittel</th>
                <th className="px-2 py-2 font-medium">Kilde</th>
                <th className="px-2 py-2 font-medium">Fareklasse</th>
                <th className="px-2 py-2 text-center font-medium">S</th>
                <th className="px-2 py-2 text-center font-medium">K</th>
                <th className="px-2 py-2 text-center font-medium">Score</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Tiltak</th>
                <th className="px-2 py-2 font-medium">Alder</th>
                <th className="px-2 py-2"><span className="sr-only">Åpne</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.map((r) => (
                <RegisterRow key={r.id} row={r} highlighted={r.sourceId === highlightedId || r.id === highlightedId} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RegisterRow({ row, highlighted }: { row: UnifiedRiskRow; highlighted: boolean }) {
  const deeplink = SOURCE_DEEPLINK[row.source]?.() ?? null
  const hazardMeta = HAZARD_CATEGORIES.find((c) => c.id === row.hazardCategory)
  const stale = ageDays(row.lastReviewedAt) > 365 && row.isOpen
  return (
    <tr
      id={`risk-row-${row.id}`}
      className={`${highlighted ? 'bg-amber-50' : ''} hover:bg-neutral-50`}
    >
      <td className="px-4 py-2.5 align-top">
        <div className="font-medium text-neutral-900">{row.title}</div>
        {row.isPsychosocial && (
          <div className="mt-0.5 text-xs text-pink-700">Psykososial (AML § 4-3)</div>
        )}
      </td>
      <td className="px-2 py-2.5 align-top text-neutral-700">{RISK_SOURCE_LABELS[row.source]}</td>
      <td className="px-2 py-2.5 align-top text-neutral-700">{hazardMeta?.labelNb ?? row.hazardCategory}</td>
      <td className="px-2 py-2.5 text-center font-mono text-sm">{row.likelihood}</td>
      <td className="px-2 py-2.5 text-center font-mono text-sm">{row.consequence}</td>
      <td className="px-2 py-2.5 text-center">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${BAND_PILL[row.band]}`}>
          {row.riskScore}
        </span>
      </td>
      <td className="px-2 py-2.5 align-top text-neutral-700">
        {row.status === 'closed' ? 'Lukket' :
         row.status === 'mitigated' ? 'Verifisert' :
         row.status === 'in_progress' ? 'Under behandling' : 'Åpen'}
      </td>
      <td className="px-2 py-2.5 align-top">
        {row.hasOpenAction ? (
          <span className="text-emerald-700">Aktivt</span>
        ) : row.band === 'red' ? (
          <span className="text-rose-700">Mangler</span>
        ) : (
          <span className="text-neutral-400">—</span>
        )}
      </td>
      <td className="px-2 py-2.5 align-top">
        <span className={stale ? 'text-rose-700' : 'text-neutral-600'}>
          {formatAge(row.lastReviewedAt)}
          {stale && ' ⚠'}
        </span>
      </td>
      <td className="px-2 py-2.5 align-top text-right">
        {deeplink ? (
          <Link
            to={deeplink}
            className="inline-flex items-center gap-1 rounded text-neutral-500 hover:text-rose-700"
            aria-label={`Åpne kilde for ${row.title}`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span className="text-neutral-300">—</span>
        )}
      </td>
    </tr>
  )
}

type FilterPillProps = {
  label: string
  active: string | null
  onClear: () => void
  children: ReactNode
}
function FilterPill({ label, active, onClear, children }: FilterPillProps) {
  return (
    <div className="flex items-center gap-1">
      <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
        <Filter className="h-3 w-3" aria-hidden />
        {label}:
      </span>
      <div className="flex flex-wrap items-center gap-1">{children}</div>
      {active && (
        <button
          type="button"
          onClick={onClear}
          className="ml-0.5 text-xs text-neutral-500 hover:text-neutral-900"
          aria-label={`Fjern ${label}-filter`}
        >
          ×
        </button>
      )}
    </div>
  )
}

function PillOption({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${
        active ? 'bg-rose-700 text-white ring-rose-700' : 'bg-white text-neutral-700 ring-neutral-300 hover:ring-neutral-500'
      }`}
    >
      {children}
    </button>
  )
}

