// <SystemReport id="..." /> — embed a code-owned, locked-down dashboard
// layout on any page.
//
// The component:
//   1. Resolves the system row by slug via useSystemReport (RLS lets
//      every authenticated user read system rows).
//   2. Dispatches on the row's scope_id to a per-scope renderer that
//      knows how to call the right datasets hook.
//   3. The renderer mounts <ModuleAnalyticsDashboard readOnly /> so
//      there is no edit chrome, no add-widget, no filter editing, no
//      resize, and no per-widget menu. Drill-down + slide-over remain
//      active so the embedded view is drop-in usable.
//
// Adding a new scope: implement <XxxSystemReport row={row} /> beside
// the scope file (see RegelverkCoverageSystemReport for the pattern),
// then add a case to `SystemReport`'s switch. Keeping the dispatch
// component-level (one branch = one component) is Rules-of-Hooks safe
// even though each branch calls a different datasets hook.

import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useSystemReport } from './useSystemReport'
import { RegelverkCoverageSystemReport } from '../../pages/overview/regelverk/RegelverkCoverageSystemReport'
import { InternkontrollDashboardSystemReport } from '../../pages/overview/internkontroll/InternkontrollDashboardSystemReport'
import { InternkontrollGapSystemReport } from '../../pages/overview/internkontroll/InternkontrollGapSystemReport'

export type SystemReportProps = {
  /** The system row's slug, e.g. 'regelverk-coverage-overview'. */
  id: string
  /** Optional breadcrumb forwarded to the underlying page shell. */
  breadcrumb?: { label: string; to?: string }[]
  /** Optional className wrapper for layout containers (margin etc). */
  className?: string
}

export function SystemReport({ id, breadcrumb, className }: SystemReportProps) {
  const { supabase } = useOrgSetupContext()
  const { row, loading, error } = useSystemReport({ supabase, id })

  if (loading) {
    return (
      <div className={className}>
        <div
          role="status"
          aria-label={`Laster system-rapport «${id}» …`}
          className="rounded-md border border-neutral-200 bg-neutral-50/60 px-4 py-6 text-sm text-neutral-500"
        >
          Laster system-rapport …
        </div>
      </div>
    )
  }

  if (error || !row) {
    return (
      <div className={className}>
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50/70 px-4 py-3 text-sm text-red-900"
        >
          Kunne ikke laste system-rapport «{id}». {error ?? ''}
        </div>
      </div>
    )
  }

  // Per-scope dispatch. Each branch returns a different component so
  // each renderer can call its own datasets hook without violating the
  // Rules of Hooks (the hook order within one rendered component stays
  // stable; switching scopes unmounts/remounts the renderer).
  if (row.scopeId === 'regelverk_coverage') {
    return (
      <div className={className}>
        <RegelverkCoverageSystemReport row={row} breadcrumb={breadcrumb} />
      </div>
    )
  }

  if (row.scopeId === 'internkontroll') {
    // Two system reports share the scope; dispatch on slug. The slugs
    // are seeded by 20260915120000_internkontroll_system_reports.sql.
    if (row.slug === 'internkontroll-gap-analysis') {
      return (
        <div className={className}>
          <InternkontrollGapSystemReport row={row} breadcrumb={breadcrumb} />
        </div>
      )
    }
    return (
      <div className={className}>
        <InternkontrollDashboardSystemReport row={row} breadcrumb={breadcrumb} />
      </div>
    )
  }

  return (
    <div className={className}>
      <div
        role="alert"
        className="rounded-md border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900"
      >
        System-rapporten «{row.name}» bruker scopet «{row.scopeId}» som ennå ikke har
        en renderer. Legg til en case i SystemReport-dispatcheren.
      </div>
    </div>
  )
}
