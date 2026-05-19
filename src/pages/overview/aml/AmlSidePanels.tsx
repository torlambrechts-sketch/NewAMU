// Zone-3 side panels for the AML overview page.
//
// Three small cards: Årshjul preview · Åpne planer · Trend.
// Årshjul and Trend ship as informative placeholders in Sprint α
// (the datasets they need land in Sprint γ — see unified-aml-view.md
// §9 + §10). The plan-items panel is live data from the existing
// internkontroll_plan_items_by_status dataset.

import { Link } from 'react-router-dom'
import { CalendarDays, ListTodo, LineChart, ArrowRight } from 'lucide-react'
import type { InternkontrollDatasets } from '../internkontroll/useInternkontrollDatasets'

const STATUS_COLOR: Record<string, string> = {
  Planlagt: '#64748b',
  Pågår: '#d97706',
  Blokkert: '#dc2626',
  Fullført: '#16a34a',
}

export function ArshjulPanel() {
  return (
    <div className="flex h-full flex-col rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
        <CalendarDays className="h-4 w-4 text-cyan-600" aria-hidden />
        Årshjul
      </div>
      <div className="mt-3 flex-1 space-y-2 text-sm text-neutral-500">
        <p>
          Kommer i Sprint γ — månedsoversikt over forfallende
          vernerunder, AMU-møter, attestasjoner og beredskapsøvelser.
        </p>
        <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 p-3 text-xs leading-snug text-neutral-500">
          <span className="font-medium text-neutral-700">Eksempel:</span>{' '}
          Mai 4 · Juni 12 · Juli 2 aktiviteter
        </div>
      </div>
    </div>
  )
}

export function PlanItemsPanel({
  data,
}: {
  data: InternkontrollDatasets['internkontroll_plan_items_by_status']
}) {
  const entries = Object.entries(data) as [string, number][]
  const total = entries.reduce((sum, [, n]) => sum + n, 0)

  return (
    <div className="flex h-full flex-col rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
          <ListTodo className="h-4 w-4 text-amber-600" aria-hidden />
          Åpne planer
        </div>
        <Link
          to="/overview/internkontroll"
          className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-700"
        >
          Se alle <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>
      <div className="mt-3 flex-1">
        {total === 0 ? (
          <p className="text-sm text-neutral-500">
            Ingen registrerte tiltak. Naviger til en paragraf for å legge til.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {entries.map(([status, n]) => (
              <li
                key={status}
                className="flex items-center justify-between rounded-md px-2 py-1.5"
                style={{ backgroundColor: `${STATUS_COLOR[status] ?? '#e5e7eb'}10` }}
              >
                <span className="flex items-center gap-2 text-sm">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: STATUS_COLOR[status] ?? '#94a3b8' }}
                    aria-hidden
                  />
                  <span className="text-neutral-700">{status}</span>
                </span>
                <span className="tabular-nums text-sm font-semibold text-neutral-900">
                  {n}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export function TrendPanel() {
  // Decorative sparkline — purely visual. Real trend lands in Sprint γ
  // once tilsyn_score_snapshots starts producing rows.
  return (
    <div className="flex h-full flex-col rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
        <LineChart className="h-4 w-4 text-indigo-600" aria-hidden />
        Trend (30 dager)
      </div>
      <div className="mt-3 flex-1">
        <svg
          viewBox="0 0 120 40"
          className="h-16 w-full text-indigo-300"
          aria-hidden
        >
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            points="0,30 12,28 24,22 36,24 48,18 60,16 72,12 84,14 96,10 108,8 120,6"
          />
        </svg>
        <p className="mt-2 text-xs leading-snug text-neutral-500">
          Sprint γ — daglig snapshot av Tilsyn-beredskap-scoren.
          Linjen vist her er illustrasjon.
        </p>
      </div>
    </div>
  )
}
