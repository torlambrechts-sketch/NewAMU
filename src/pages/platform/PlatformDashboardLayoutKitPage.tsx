import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, LayoutDashboard, ListChecks } from 'lucide-react'
import type { HubMenu1Item } from '../../components/layout/HubMenu1Bar'
import { WorkplaceDashboardShell } from '../../components/layout/WorkplaceDashboardShell'
import { WorkplaceSplit7030Layout } from '../../components/layout/WorkplaceSplit7030Layout'

const CREAM_DEEP = '#EFE8DC'

/**
 * Platform-admin reference for {@link WorkplaceDashboardShell}: heading, hub, KPI-rad, body.
 * Live demo uses {@link WorkplaceSplit7030Layout} in the body.
 */
export function PlatformDashboardLayoutKitPage() {
  const [tab, setTab] = useState<'overview' | 'activity'>('overview')

  const hubItems: HubMenu1Item[] = useMemo(
    () => [
      {
        key: 'overview',
        label: 'Oversikt',
        icon: LayoutDashboard,
        active: tab === 'overview',
        onClick: () => setTab('overview'),
      },
      {
        key: 'activity',
        label: 'Aktivitet',
        icon: ListChecks,
        active: tab === 'activity',
        onClick: () => setTab('activity'),
      },
    ],
    [tab],
  )

  const kpiSlot = (
    <div className="grid gap-3 sm:grid-cols-3">
      {(
        [
          { label: 'Åpne punkter', value: '12', sub: 'Siste 7 dager' },
          { label: 'Fullført', value: '48', sub: 'Denne måneden' },
          { label: 'Varsler', value: '3', sub: 'Krever oppmerksomhet' },
        ] as const
      ).map((k) => (
        <div
          key={k.label}
          className="rounded-lg border border-neutral-200/70 px-4 py-3"
          style={{ backgroundColor: CREAM_DEEP }}
        >
          <p className="text-2xl font-bold tabular-nums text-neutral-900">{k.value}</p>
          <p className="text-sm font-medium text-neutral-800">{k.label}</p>
          <p className="text-xs text-neutral-600">{k.sub}</p>
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-6 text-neutral-100">
      <div>
        <h1 className="text-2xl font-semibold text-white">Standard layout — dashbord</h1>
        <p className="mt-2 max-w-3xl text-sm text-neutral-400">
          Bruk <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-amber-200/90">WorkplaceDashboardShell</code>{' '}
          fra <code className="rounded bg-white/10 px-1 text-xs">components/layout/WorkplaceDashboardShell.tsx</code> for
          forsider med oversikt: brødsmule, tittel, beskrivelse, valgfri hub, KPI-rad og hovedinnhold.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Kombiner med{' '}
          <Link to="/platform-admin/layout-split" className="text-amber-400/90 hover:underline">
            Split 7/3
          </Link>{' '}
          eller eget rutenett i <code className="rounded bg-white/10 px-1 text-xs">children</code>.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4 md:p-6">
        <div className="rounded-xl border border-white/10 bg-[#F9F7F2] text-neutral-900 shadow-lg">
          <WorkplaceDashboardShell
            breadcrumb={[
              { label: 'Plattformadmin', to: '/platform-admin' },
              { label: 'Layout-kit' },
              { label: 'Dashbord' },
            ]}
            title="Oversikt (demo)"
            description={
              <>
                <p className="text-xs text-neutral-500">Fredag 10. april 2026</p>
                <p className="mt-2">Eksempeltekst under tittelen — erstatt med modulkontekst.</p>
              </>
            }
            hubAriaLabel="Demo dashbord — faner"
            hubItems={hubItems}
            kpiSlot={kpiSlot}
          >
            {tab === 'overview' ? (
              <WorkplaceSplit7030Layout
                main={
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-neutral-500">
                      <BarChart3 className="size-4" aria-hidden />
                      Hovedkolonne (7/10)
                    </h2>
                    <p className="mt-2 text-sm text-neutral-600">
                      Her plasseres grafer, «neste steg», feed eller tabeller. Bruk{' '}
                      <code className="rounded bg-neutral-100 px-1 text-xs">WorkplaceSplit7030Layout</code> når du vil ha
                      fast høyre kolonne.
                    </p>
                    <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-neutral-700">
                      <li>KPI-rad over er valgfri via <code className="rounded bg-neutral-100 px-1 text-xs">kpiSlot</code></li>
                      <li>Hub er valgfri — utelat <code className="rounded bg-neutral-100 px-1 text-xs">hubItems</code> for ren oversikt</li>
                    </ul>
                  </div>
                }
                aside={
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Sidelinje (3/10)</h2>
                    <p className="mt-2 text-sm text-neutral-600">
                      Kalender, snarveier, mini-varsler eller oppsummering.
                    </p>
                  </div>
                }
              />
            ) : (
              <p className="rounded-lg border border-dashed border-neutral-300 bg-white/80 px-4 py-8 text-center text-sm text-neutral-600">
                Annen fane — bytt <code className="rounded bg-neutral-100 px-1 text-xs">children</code> etter valgt hub-fane.
              </p>
            )}
          </WorkplaceDashboardShell>
        </div>
      </div>
    </div>
  )
}
