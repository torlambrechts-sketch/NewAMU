// DashboardPage — hub som hoster alle 19 dashboards.
//
// Layout: samme ModulePageShell + tab-stripe-mønster som /internkontroll
// og /cadence. URL-state via ?dashboard=<id> — dyplenker direkte til
// f.eks. Gantt eller RAID. Når ingen spesifikk dashboard er valgt,
// vises Cadence-oversikten (TimelineWidget) som default landing.

import { useCallback, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, Wand2 } from 'lucide-react'
import { ModulePageShell } from '../../components/module/ModulePageShell'
import { Button } from '../../components/ui/Button'
import { DashboardDataProvider, useDashboardData } from './useDashboardData'
import {
  DASHBOARDS,
  DASHBOARD_GROUPS,
  getDashboard,
  type DashboardDef,
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

  const setDashboard = useCallback(
    (id: string) => {
      const sp = new URLSearchParams(searchParams)
      sp.set('dashboard', id)
      setSearchParams(sp, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const grouped: Record<string, DashboardDef[]> = useMemo(() => {
    const out: Record<string, DashboardDef[]> = {}
    for (const g of DASHBOARD_GROUPS) out[g.id] = []
    for (const d of DASHBOARDS) out[d.group]?.push(d)
    return out
  }, [])

  const navigate = useNavigate()
  const headerActions = (
    <Button
      variant="ghost"
      size="sm"
      icon={<Wand2 className="h-3.5 w-3.5" />}
      onClick={() => navigate('/cadence?section=veiviser')}
    >
      Ny cadence-plan
    </Button>
  )

  return (
    <ModulePageShell
      breadcrumb={BREADCRUMB}
      width="full"
      title="Dashboards"
      description="Ett HMS-program. Atten visninger. Velg linsen som passer rommet — fra Gantt for revisor til Kanban for daglig drift."
      headerActions={headerActions}
    >
      <div className="space-y-4">
        {/* Group nav + dashboard selector */}
        <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {DASHBOARD_GROUPS.map((g) => {
            const items = grouped[g.id] ?? []
            if (items.length === 0) return null
            return (
              <div key={g.id} className="border-b border-neutral-100 last:border-b-0">
                <div className="flex items-center gap-2 bg-neutral-50 px-4 py-2 text-[10.5px] font-bold uppercase tracking-wider text-neutral-500">
                  <g.Icon className="h-3.5 w-3.5" aria-hidden />
                  <span>{g.label}</span>
                  <span className="font-normal normal-case text-neutral-400">· {g.description}</span>
                </div>
                <nav className="flex flex-wrap items-center gap-1 px-3 py-2" aria-label={`${g.label}-dashboards`}>
                  {items.map((d) => {
                    const isActive = active?.id === d.id
                    return (
                      <Button
                        key={d.id}
                        variant="ghost"
                        onClick={() => setDashboard(d.id)}
                        aria-current={isActive ? 'page' : undefined}
                        className={[
                          'inline-flex h-auto items-center gap-2 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                          isActive
                            ? 'bg-[#1a3d32] text-white hover:bg-[#142e26] hover:text-white'
                            : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                        ].join(' ')}
                        title={d.description}
                      >
                        <d.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span>{d.label}</span>
                        <span className={[
                          'ml-1 rounded-full px-1.5 py-0.5 font-mono text-[9px] tracking-wider',
                          isActive ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-500',
                        ].join(' ')}>
                          {d.method}
                        </span>
                      </Button>
                    )
                  })}
                </nav>
              </div>
            )
          })}
        </div>

        {/* Active dashboard header */}
        {active && (
          <header className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200 pb-3">
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-neutral-500">
                {DASHBOARD_GROUPS.find((g) => g.id === active.group)?.label}
              </div>
              <h2 className="mt-1 font-serif text-2xl font-semibold text-neutral-900">{active.label}</h2>
              <p className="mt-1 max-w-3xl text-[13px] text-neutral-500">{active.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-neutral-100 px-2 py-1 font-mono text-[10px] tracking-wider text-neutral-600">
                {active.method}
              </span>
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
        )}

        {/* Active dashboard body */}
        <section className="min-w-0">
          {data.loading ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#1a3d32]" aria-hidden />
            </div>
          ) : data.error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
              {data.error}
            </div>
          ) : active ? (
            <active.Component />
          ) : null}
        </section>
      </div>
    </ModulePageShell>
  )
}
