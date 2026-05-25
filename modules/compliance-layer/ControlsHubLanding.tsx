// ControlsHubLanding — landing tile grid for /controls.
//
// Groups the org's internal controls by status_label so an owner can
// scan "overdue" + "due soon" at a glance. Mirrors the visual shape of
// `modules/compliance/ChecklistsHubLanding.tsx` (tile grid grouped by
// section) while reusing the established PageShell primitive.

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { PageShell } from '../../template'
import { useInternalControls } from './useInternalControls'
import type {
  ControlFamily,
  ControlStatusLabel,
  InternalControlRow,
} from './types'

const STATUS_ORDER: ControlStatusLabel[] = [
  'overdue',
  'due_soon',
  'never_executed',
  'on_track',
  'retired',
]

const STATUS_LABELS: Record<ControlStatusLabel, string> = {
  on_track: 'På sporet',
  due_soon: 'Forfaller snart',
  overdue: 'Forfalt',
  never_executed: 'Aldri utført',
  retired: 'Pensjonert',
}

const STATUS_COLORS: Record<ControlStatusLabel, string> = {
  on_track: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  due_soon: 'bg-amber-50 text-amber-800 ring-amber-200',
  overdue: 'bg-rose-50 text-rose-800 ring-rose-200',
  never_executed: 'bg-neutral-50 text-neutral-700 ring-neutral-200',
  retired: 'bg-neutral-200 text-neutral-800 ring-neutral-300',
}

const FAMILY_LABELS: Record<ControlFamily, string> = {
  preventive: 'Forebyggende',
  detective: 'Avdekkende',
  corrective: 'Korrigerende',
  directive: 'Styrende',
}

export function ControlsHubLanding() {
  const { supabase } = useOrgSetupContext()
  const { controls, statusByControlId, loading, error } = useInternalControls({
    supabase,
  })

  const grouped = useMemo(() => {
    const map: Record<ControlStatusLabel, InternalControlRow[]> = {
      on_track: [],
      due_soon: [],
      overdue: [],
      never_executed: [],
      retired: [],
    }
    for (const c of controls) {
      const sv = statusByControlId[c.id]
      const label = sv?.status_label ?? 'never_executed'
      map[label].push(c)
    }
    return map
  }, [controls, statusByControlId])

  return (
    <PageShell
      title="Kontroller"
      description="Internkontroller (Tier 2) — koblingen mellom lovkrav og bevisartefakter på tvers av alle modulene."
      actions={
        <Link
          to="/controls/list"
          className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50"
        >
          Vis full liste
        </Link>
      }
    >
      {loading ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
          Laster kontroller…
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}
      <div className="space-y-6">
        {STATUS_ORDER.map((status) => {
          const items = grouped[status]
          if (items.length === 0) return null
          return (
            <section key={status} className="space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-700">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ${STATUS_COLORS[status]}`}
                >
                  {STATUS_LABELS[status]}
                </span>
                <span className="text-neutral-500">{items.length}</span>
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((c) => {
                  const sv = statusByControlId[c.id]
                  return (
                    <li key={c.id}>
                      <Link
                        to={`/controls/${c.id}`}
                        className="block rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-amber-400 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-base font-semibold text-neutral-900">
                            {c.name}
                          </h3>
                          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-neutral-700">
                            {FAMILY_LABELS[c.control_family]}
                          </span>
                        </div>
                        {c.purpose ? (
                          <p className="mt-1 line-clamp-2 text-sm text-neutral-600">
                            {c.purpose}
                          </p>
                        ) : null}
                        <dl className="mt-3 grid grid-cols-2 gap-y-1 text-xs">
                          <dt className="text-neutral-500">Frekvens</dt>
                          <dd className="text-neutral-800">
                            {c.frequency_hint ?? 'Ad hoc'}
                          </dd>
                          <dt className="text-neutral-500">Eier</dt>
                          <dd className="text-neutral-800">
                            {c.owner_role ?? '—'}
                          </dd>
                          <dt className="text-neutral-500">Siste utførelse</dt>
                          <dd className="text-neutral-800">
                            {sv?.last_occurred_at
                              ? new Date(sv.last_occurred_at).toLocaleDateString(
                                  'nb-NO',
                                )
                              : 'Ingen'}
                          </dd>
                        </dl>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
        {controls.length === 0 && !loading ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-600">
            Ingen kontroller ennå. Systemkontroller seedes ved første
            innlogging av en ny organisasjon.
          </div>
        ) : null}
      </div>
    </PageShell>
  )
}
