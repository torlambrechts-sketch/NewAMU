// /registers — directory of register types.
//
// Same data-grid pattern as Sjekklister: full-width ModulePageShell, a
// single rounded card with header strip (title + count + search + view
// switcher), then a FilterBar (mode toggle in `leading`, Rammeverk as a
// multi-select chip, saved views on the right) and the table/box body
// below. The previous left-rail compliance summary + due-soon banner
// moved to /registers/analyse where the deeper stats live.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  CircleDot,
  Download,
  History,
  LayoutGrid,
  Plus,
  Rows3,
  Search,
  Settings,
  SlidersHorizontal,
} from 'lucide-react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useRegisters, type ResolvedRegisterType } from '../../hooks/useRegisters'
import { useRegulationFilter } from '../../context/RegulationFilterContext'
import { useRegisterUiPreference } from '../../hooks/useUserUiPreferences'
import { useSavedViews } from '../../hooks/useSavedViews'
import { ModulePageShell } from '../../components/module'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { FilterBar, SavedViewsControl } from '../../components/ui/FilterBar'
import { FilterChip } from '../../components/ui/FilterChip'
import { useAllRegisterRecords } from './dashboards/useAllRegisterRecords'
import { RegisterHubBoxes } from '../../components/registers/RegisterHubBoxes'
import { RegisterHubTable } from '../../components/registers/RegisterHubTable'
import { REGISTER_FRAMEWORKS } from '../../lib/registers/registerFrameworks'
import {
  computeRegisterStats,
  groupRecordsByType,
  type RegisterStats,
} from '../../lib/registers/registerStats'
import { exportRecordsToCsv, downloadRegisterCsv } from '../../lib/registers/registerCsv'

// Filter payload persisted in `module_saved_views.filters` for the
// "registers" module slug. Empty arrays = no filter.
type RegisterFilters = {
  frameworks: string[]
}

const EMPTY_FILTERS: RegisterFilters = {
  frameworks: [],
}

function filtersEqual(a: RegisterFilters, b: RegisterFilters): boolean {
  if (a.frameworks.length !== b.frameworks.length) return false
  const setA = new Set(a.frameworks)
  for (const id of b.frameworks) if (!setA.has(id)) return false
  return true
}

function countActiveFilters(f: RegisterFilters): number {
  return f.frameworks.length
}

function filtersFromSearchParams(params: URLSearchParams): RegisterFilters {
  const validIds = new Set(REGISTER_FRAMEWORKS.map((f) => f.id))
  const raw = params.get('framework')
  const list = raw ? raw.split(',').filter((id) => validIds.has(id)) : []
  return { frameworks: list }
}

// history.replaceState instead of setSearchParams — chip toggles
// shouldn't cascade-rerender every useSearchParams consumer (same
// trick the cross-module Regelverk filter + Sjekklister use).
function syncFiltersToUrl(f: RegisterFilters) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (f.frameworks.length > 0) url.searchParams.set('framework', f.frameworks.join(','))
  else url.searchParams.delete('framework')
  window.history.replaceState(null, '', url.toString())
}

export function RegistersHubPage() {
  const orgSetup = useOrgSetupContext()
  const navigate = useNavigate()
  const registers = useRegisters({ supabase: orgSetup.supabase })
  const allRecords = useAllRegisterRecords(
    orgSetup.supabase,
    orgSetup.organization?.id ?? null,
  )
  const ui = useRegisterUiPreference()
  const easy = ui.mode === 'easy'
  const { isActive: isRegulationActive } = useRegulationFilter()

  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')

  // Filter state — hydrated from URL on first mount, pushed back via
  // history.replaceState in the effect below.
  const [filters, setFiltersState] = useState<RegisterFilters>(() =>
    filtersFromSearchParams(searchParams),
  )
  const setFilters = useCallback((next: RegisterFilters) => {
    setFiltersState(next)
  }, [])
  useEffect(() => {
    syncFiltersToUrl(filters)
  }, [filters])
  const activeFilterCount = countActiveFilters(filters)

  // Saved views — org-shared content, per-user default landing.
  const savedViews = useSavedViews<RegisterFilters>('registers')
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const [defaultApplied, setDefaultApplied] = useState(false)
  useEffect(() => {
    if (defaultApplied) return
    if (savedViews.loading) return
    if (activeFilterCount > 0) {
      const match = savedViews.views.find((v) =>
        filtersEqual(filters, { ...EMPTY_FILTERS, ...v.filters }),
      )
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (match) setActiveViewId(match.id)
      setDefaultApplied(true)
      return
    }
    if (savedViews.defaultViewId) {
      const def = savedViews.views.find((v) => v.id === savedViews.defaultViewId)
      if (def) {
        setFilters({ ...EMPTY_FILTERS, ...def.filters })
        setActiveViewId(def.id)
      }
    }
    setDefaultApplied(true)
  }, [
    defaultApplied,
    savedViews.loading,
    savedViews.defaultViewId,
    savedViews.views,
    activeFilterCount,
    filters,
    setFilters,
  ])

  const hasUnsavedChanges = useMemo(() => {
    if (!activeViewId) return false
    const view = savedViews.views.find((v) => v.id === activeViewId)
    if (!view) return false
    return !filtersEqual(filters, { ...EMPTY_FILTERS, ...view.filters })
  }, [activeViewId, filters, savedViews.views])

  // ── Compute the filtered + searched type list ────────────────────────
  const enabledTypes = useMemo(
    () => registers.types.filter((t) => t.isEnabledForOrg),
    [registers.types],
  )

  // Per-framework counts for the chip option counts.
  const countsByFramework = useMemo(() => {
    const out: Record<string, number> = {}
    for (const f of REGISTER_FRAMEWORKS) out[f.id] = 0
    for (const t of enabledTypes) {
      for (const f of REGISTER_FRAMEWORKS) {
        if (t.regulationIds.includes(f.id)) out[f.id] += 1
      }
    }
    return out
  }, [enabledTypes])

  const recordsByType = useMemo(() => groupRecordsByType(allRecords.records), [allRecords.records])
  const statsByType = useMemo(() => {
    const out = new Map<string, RegisterStats>()
    for (const t of enabledTypes) {
      out.set(t.id, computeRegisterStats(t, recordsByType.get(t.id) ?? []))
    }
    return out
  }, [enabledTypes, recordsByType])

  // Final filtered list (framework multi-select + regulation chip + search).
  const filteredTypes = useMemo(() => {
    const norm = search.trim().toLowerCase()
    const fwSet = filters.frameworks.length ? new Set(filters.frameworks) : null
    return enabledTypes.filter((t) => {
      if (fwSet) {
        const hit = t.regulationIds.some((rid) => fwSet.has(rid))
        if (!hit) return false
      }
      // Cross-module regelverk filter (header chip) only narrows when
      // the type declares regulations and none of them are active.
      if (t.regulationIds.length > 0 && !t.regulationIds.some((rid) => isRegulationActive(rid))) {
        return false
      }
      if (norm && !t.resolvedName.toLowerCase().includes(norm)) return false
      return true
    })
  }, [enabledTypes, filters.frameworks, isRegulationActive, search])

  const handleOpen = (t: ResolvedRegisterType) => {
    navigate(`/registers/${encodeURIComponent(t.id)}`)
  }

  // Export-all: one CSV per type, downloaded back-to-back.
  const handleExportAll = () => {
    for (const t of enabledTypes) {
      const records = recordsByType.get(t.id) ?? []
      if (records.length === 0) continue
      downloadRegisterCsv(exportRecordsToCsv(t, records))
    }
  }

  const frameworkOptions = useMemo(
    () =>
      REGISTER_FRAMEWORKS.map((f) => ({
        value: f.id,
        label: f.short,
        count: countsByFramework[f.id] ?? 0,
      })),
    [countsByFramework],
  )

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'Workspace', to: '/' }, { label: 'Register' }]}
      width="full"
      title="Register"
      description="Lovpålagte og virksomhetsspesifikke registre — kjemikalier, behandlingsprotokoll, beredskap m.fl. Skalerer fra AML/IK til ISO 9001/45001/27001/14001 + GDPR Art. 30."
      headerActions={
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            icon={<Download className="h-4 w-4" />}
            onClick={handleExportAll}
            type="button"
          >
            Eksporter alle
          </Button>
          <Link
            to="/registers/analyse"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            <History className="h-4 w-4" />
            Analyse
          </Link>
          <Link
            to="/admin/settings/registers"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            <Settings className="h-4 w-4" />
            Innstillinger
          </Link>
          <Link
            to="/admin/settings/registers"
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#1a3d32] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#14312a]"
          >
            <Plus className="h-4 w-4" />
            Nytt register
          </Link>
        </div>
      }
    >
      {registers.loading && registers.types.length === 0 ? (
        <p className="py-12 text-center text-sm text-neutral-500">Laster registre …</p>
      ) : enabledTypes.length === 0 ? (
        <div className="rounded-xl border border-neutral-200/80 bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-700">
            Ingen registre aktivert ennå. Gå til{' '}
            <Link to="/admin/settings/registers" className="font-medium text-[#1a3d32] underline">
              Innstillinger
            </Link>{' '}
            for å aktivere registre eller opprette egne.
          </p>
        </div>
      ) : (
        <section className="space-y-3">
          <div className="rounded-xl border border-neutral-200/80 bg-white" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            {/* Header strip: title (count) + search + view switcher */}
            <div className="flex flex-col gap-2 border-b border-neutral-100 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <h3 className="text-sm font-semibold text-neutral-900">
                {filteredTypes.length}{' '}
                {filteredTypes.length === 1 ? 'register' : 'registre'}
              </h3>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
                  <StandardInput
                    type="search"
                    placeholder="Søk i registre …"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Søk i registre"
                    className="w-full !py-1.5 pl-9 text-sm sm:w-64"
                  />
                </div>
                <div className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 p-0.5">
                  <ViewModeButton
                    icon={<Rows3 className="h-4 w-4" />}
                    label="Tabell"
                    active={ui.view === 'tabell'}
                    onClick={() => void ui.setView('tabell')}
                  />
                  <ViewModeButton
                    icon={<LayoutGrid className="h-4 w-4" />}
                    label="Bokser"
                    active={ui.view === 'bokser'}
                    onClick={() => void ui.setView('bokser')}
                  />
                </div>
              </div>
            </div>

            {/* Filter bar — Enkel/Avansert toggle (left) + Rammeverk
                multi-select chip + saved views. */}
            <FilterBar
              leading={
                <div
                  role="tablist"
                  aria-label="Visningsmodus"
                  className="inline-flex items-center gap-1 rounded-md border border-neutral-200/80 bg-neutral-50 p-0.5"
                >
                  {([
                    { id: 'easy' as const, label: 'Enkel', Icon: CircleDot },
                    { id: 'advanced' as const, label: 'Avansert', Icon: SlidersHorizontal },
                  ]).map(({ id, label, Icon }) => {
                    const active = ui.mode === id
                    return (
                      <Button
                        key={id}
                        variant="ghost"
                        size="sm"
                        role="tab"
                        aria-selected={active}
                        onClick={() => void ui.setMode(id)}
                        className={[
                          '!gap-1.5 rounded px-2.5 py-1.5 text-sm font-medium',
                          active
                            ? '!bg-[var(--ui-accent)] !text-white !shadow-sm'
                            : '!bg-transparent text-neutral-600 hover:text-neutral-900',
                        ].join(' ')}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        <span className="hidden sm:inline">{label}</span>
                      </Button>
                    )
                  })}
                </div>
              }
              chips={
                <FilterChip
                  label="Rammeverk"
                  options={frameworkOptions}
                  value={filters.frameworks}
                  onChange={(next) => {
                    setFilters({ ...filters, frameworks: next })
                    setActiveViewId(null)
                  }}
                />
              }
              activeFilterCount={activeFilterCount}
              onReset={() => {
                setFilters(EMPTY_FILTERS)
                setActiveViewId(null)
              }}
              savedViews={
                <SavedViewsControl<RegisterFilters>
                  currentFilters={filters}
                  activeViewId={activeViewId}
                  hasUnsavedChanges={hasUnsavedChanges}
                  onApplyView={(view) => {
                    setFilters({ ...EMPTY_FILTERS, ...view.filters })
                    setActiveViewId(view.id)
                  }}
                  onClearActive={() => setActiveViewId(null)}
                  saved={savedViews}
                />
              }
            />

            {/* Body */}
            {filteredTypes.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <AlertTriangle className="mx-auto h-6 w-6 text-neutral-300" aria-hidden />
                <p className="mt-2 text-sm text-neutral-500">
                  Ingen registre matcher filterne.
                </p>
              </div>
            ) : ui.view === 'bokser' ? (
              <RegisterHubBoxes
                types={filteredTypes}
                statsByType={statsByType}
                easy={easy}
                onOpen={handleOpen}
              />
            ) : (
              <RegisterHubTable
                types={filteredTypes}
                statsByType={statsByType}
                easy={easy}
                onOpen={handleOpen}
              />
            )}
          </div>
        </section>
      )}
    </ModulePageShell>
  )
}

function ViewModeButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      title={label}
      aria-pressed={active}
      className={[
        '!gap-2 rounded px-3 py-1.5 text-sm font-medium',
        active
          ? '!bg-white text-neutral-900 !shadow-sm ring-1 ring-neutral-200'
          : '!bg-transparent text-neutral-500 hover:text-neutral-800',
      ].join(' ')}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </Button>
  )
}
