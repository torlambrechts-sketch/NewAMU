// DashboardPage — hub som hoster alle 19 dashboards.
//
// Layout: ModulePageShell + FilterBar med to FilterChips (Kategori +
// Visning) i stedet for den tidligere lange listen med chips per gruppe.
// Brukeren velger en kategori, deretter et spesifikt dashboard innen
// den kategorien. Den valgte widgeten rendres i en innrammet card-boks
// rett under filter-baren — samme mønster som Sjekklister-tabellen.
// URL-state: ?dashboard=<id> for dyplenker.

import { useCallback, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, RefreshCw, Wand2 } from 'lucide-react'
import { ModulePageShell } from '../../components/module/ModulePageShell'
import { Button } from '../../components/ui/Button'
import { FilterBar } from '../../components/ui/FilterBar'
import { FilterChip } from '../../components/ui/FilterChip'
import { DashboardDataProvider, useDashboardData } from './useDashboardData'
import {
  DASHBOARDS,
  DASHBOARD_GROUPS,
  getDashboard,
  type DashboardDef,
  type DashboardGroup,
} from './dashboardCatalog'

const BREADCRUMB = [
  { label: 'Arbeidsflate', to: '/' },
  { label: 'Styringssystem', to: '/internkontroll' },
  { label: 'Dashboards' },
]

const DEFAULT_DASHBOARD_ID = 'timeline'

export function DashboardPage() {
  // Provideren fyrer av én Supabase-fetch og deler resultatet til alle
  // widget-komponenter via Context. Uten provideren ville hver widget
  // kalle useDashboardData() og duplisert nettverkstrafikken.
  return (
    <DashboardDataProvider>
      <DashboardContent />
    </DashboardDataProvider>
  )
}

function DashboardContent() {
  const [searchParams, setSearchParams] = useSearchParams()
  const dashboardId = searchParams.get('dashboard') ?? DEFAULT_DASHBOARD_ID
  const active = getDashboard(dashboardId) ?? getDashboard(DEFAULT_DASHBOARD_ID)
  const data = useDashboardData()
  const navigate = useNavigate()

  const setDashboard = useCallback(
    (id: string) => {
      const sp = new URLSearchParams(searchParams)
      sp.set('dashboard', id)
      setSearchParams(sp, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  // ── Filter-state ──────────────────────────────────────────────────────────
  // To FilterChips: Kategori (multi-select) + Visning (single-select via
  // multi-select-API der vi tar første verdi). Begge synkroniserer mot
  // URL slik at delte lenker reproduserer akkurat samme view.
  //
  // Kategori-filteret driver hvilke visninger som er synlige i
  // visning-dropdownen + farger ikke-matchende widgets på kortene.
  // Når en visning velges som ikke ligger i Kategori-filteret, utvider
  // vi filteret automatisk slik at det forblir konsistent.

  const categoryFromUrl = useMemo<DashboardGroup[]>(() => {
    const raw = searchParams.get('kategori')
    if (!raw) return []
    const valid = new Set(DASHBOARD_GROUPS.map((g) => g.id))
    return raw
      .split(',')
      .filter((s): s is DashboardGroup => valid.has(s as DashboardGroup))
  }, [searchParams])

  const setCategories = useCallback(
    (next: DashboardGroup[]) => {
      const sp = new URLSearchParams(searchParams)
      if (next.length > 0) sp.set('kategori', next.join(','))
      else sp.delete('kategori')
      setSearchParams(sp, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  // Visningsalternativer som vises i dropdownen — filtrert på valgte
  // kategorier hvis brukeren har snevret inn.
  const visibleDashboards = useMemo(() => {
    if (categoryFromUrl.length === 0) return DASHBOARDS
    const cats = new Set(categoryFromUrl)
    return DASHBOARDS.filter((d) => cats.has(d.group))
  }, [categoryFromUrl])

  // Dashboard-options med liten gruppe-prefiks i label slik at brukeren
  // ser konteksten i dropdownen ("Tidsbasert · Gantt").
  const dashboardOptions = useMemo(
    () =>
      visibleDashboards.map((d) => ({
        value: d.id,
        label: `${DASHBOARD_GROUPS.find((g) => g.id === d.group)?.label ?? d.group} · ${d.label}`,
      })),
    [visibleDashboards],
  )

  const categoryOptions = useMemo(
    () =>
      DASHBOARD_GROUPS.map((g) => ({
        value: g.id,
        label: g.label,
        count: DASHBOARDS.filter((d) => d.group === g.id).length,
      })),
    [],
  )

  const activeFilterCount =
    categoryFromUrl.length +
    (dashboardId && dashboardId !== DEFAULT_DASHBOARD_ID ? 1 : 0)

  const handleReset = useCallback(() => {
    const sp = new URLSearchParams(searchParams)
    sp.delete('kategori')
    sp.set('dashboard', DEFAULT_DASHBOARD_ID)
    setSearchParams(sp, { replace: true })
  }, [searchParams, setSearchParams])

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        icon={<RefreshCw className={`h-3.5 w-3.5 ${(data.loading || data.refreshing) ? 'animate-spin' : ''}`} />}
        onClick={() => void data.reload()}
        disabled={data.loading}
        aria-label="Last inn dashboard på nytt"
      >
        {data.refreshing ? 'Oppdaterer …' : 'Oppdater'}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        icon={<Wand2 className="h-3.5 w-3.5" />}
        onClick={() => navigate('/cadence?section=veiviser')}
      >
        Ny cadence-plan
      </Button>
    </div>
  )

  const truncationWarnings = useMemo(() => {
    const out: string[] = []
    if (data.limits.tasksTruncated) out.push(`oppgaver (viser første ${400})`)
    if (data.limits.controlsTruncated) out.push(`kontroller (viser første ${200})`)
    if (data.limits.meetingsTruncated) out.push(`møter (viser første ${60})`)
    if (data.limits.auditTruncated) out.push(`revisjonshendelser (viser siste ${40})`)
    if (data.limits.profilesTruncated) out.push(`personer (viser første ${500})`)
    return out
  }, [data.limits])

  return (
    <ModulePageShell
      breadcrumb={BREADCRUMB}
      width="full"
      title="Dashboards"
      description="Ett HMS-program. Atten visninger. Velg linsen som passer rommet — fra Gantt for revisor til Kanban for daglig drift."
      headerActions={headerActions}
    >
      <div className="space-y-4">
        {/* Empty-org nudge — uendret. */}
        {!data.loading && !data.plan && data.tasks.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <div>
              <div className="font-serif text-base font-semibold text-amber-900">
                Klar til å sette opp HMS-årshjulet?
              </div>
              <p className="mt-1 text-[13px] text-amber-800">
                Visningene nedenfor viser forhåndsforslag inntil du har iverksatt en cadence-plan.
                Veiviseren tar deg gjennom regelverk, paragrafer, moduler og roller.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/cadence?section=veiviser')}
              icon={<Wand2 className="h-3.5 w-3.5" />}
            >
              Start cadence-veiviseren
            </Button>
          </div>
        ) : null}

        {/* Boksen som hoster filter-baren + widget-innholdet — samme mønster
            som Sjekklister-tabellen: avrundet kort med filterbar på topp og
            innholdet under. */}
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <FilterBar
            chips={
              <>
                <FilterChip
                  label="Kategori"
                  options={categoryOptions}
                  value={categoryFromUrl}
                  onChange={(next) => setCategories(next as DashboardGroup[])}
                  searchPlaceholder="Filtrer kategori …"
                />
                <FilterChip
                  label="Visning"
                  options={dashboardOptions}
                  value={[dashboardId]}
                  onChange={(next) => {
                    // Single-select via multi-select-API: ta siste klikk.
                    // Når brukeren tømmer alle returneres en tom array;
                    // vi faller tilbake til default for å unngå tom side.
                    const picked = next.filter((id) => id !== dashboardId)[0]
                    setDashboard(picked ?? DEFAULT_DASHBOARD_ID)
                  }}
                  searchPlaceholder="Søk visninger …"
                />
              </>
            }
            activeFilterCount={activeFilterCount}
            onReset={handleReset}
          />

          {/* Aktiv-widget-header — vises i toppen av boksen, under filter-baren. */}
          {active ? (
            <header className="flex flex-wrap items-end justify-between gap-3 border-t border-neutral-100 px-5 py-3.5">
              <div>
                <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wider text-neutral-500">
                  {(() => {
                    const groupDef = DASHBOARD_GROUPS.find((g) => g.id === active.group)
                    if (!groupDef) return null
                    const GroupIcon = groupDef.Icon
                    return (
                      <>
                        <GroupIcon className="h-3.5 w-3.5" aria-hidden />
                        <span>{groupDef.label}</span>
                      </>
                    )
                  })()}
                  <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 font-mono text-[9.5px] tracking-wider text-neutral-600">
                    {active.method}
                  </span>
                </div>
                <h2 className="mt-1 font-serif text-xl font-semibold text-neutral-900">
                  {active.label}
                </h2>
                <p className="mt-1 max-w-3xl text-[12.5px] text-neutral-500">{active.description}</p>
              </div>
              <div className="flex items-center gap-2">
                {data.plan ? (
                  <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                    {data.plan.name} · {data.plan.status === 'active' ? 'Aktiv' : 'Utkast'}
                  </span>
                ) : (
                  <Link
                    to="/cadence?section=veiviser"
                    className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:underline"
                  >
                    Ingen cadence iverksatt → start veiviser
                  </Link>
                )}
              </div>
            </header>
          ) : null}

          {truncationWarnings.length > 0 ? (
            <div className="border-t border-neutral-100 bg-amber-50 px-5 py-2.5 text-[12px] text-amber-900">
              <strong>Avkortet datavisning:</strong> {truncationWarnings.join(', ')}.
              Bruk modulsidene for fullstendig liste.
            </div>
          ) : null}

          {/* Widget-innhold renderes innenfor boksen. */}
          <div className="border-t border-neutral-100 bg-neutral-50/40 p-5">
            {data.loading ? (
              <div className="flex min-h-[40vh] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--ui-accent)]" aria-hidden />
              </div>
            ) : data.error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
                {data.error}
              </div>
            ) : active ? (
              <ActiveDashboardRenderer dashboard={active} />
            ) : null}
          </div>
        </div>
      </div>
    </ModulePageShell>
  )
}

function ActiveDashboardRenderer({ dashboard }: { dashboard: DashboardDef }) {
  const Component = dashboard.Component
  return <Component />
}
