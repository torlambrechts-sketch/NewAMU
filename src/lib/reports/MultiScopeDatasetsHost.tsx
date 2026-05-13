// MultiScopeDatasetsHost — registry-driven cross-scope dataset merger.
//
// A report can pull widgets from multiple scopes (compliance + survey +
// learning…). Each scope registers an optional `datasetsHook` in
// dashboardRegistry; the host mounts one adapter per selected scope, lets
// the adapter call its scope's hook, and merges the resolved dataset maps
// before handing them to ModuleAnalyticsDashboard via a render-prop child.
//
// Why one component per scope: a single component invoking N different
// hooks in a loop would violate the rules of hooks the moment the scope
// selection changes. One stable child per scope means each adapter always
// calls the same hook, every render.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getDashboardScope, type DatasetsHookDeps } from '../dashboards/dashboardRegistry'
import type { DashboardFilter } from '../dashboards/dashboardFilters'

type ResolvedMap = Record<string, Record<string, unknown>>

function ScopeAdapter({
  scopeId,
  deps,
  onResolved,
}: {
  scopeId: string
  deps: DatasetsHookDeps
  onResolved: (scopeId: string, datasets: Record<string, unknown>) => void
}) {
  const scope = getDashboardScope(scopeId)
  const ds = scope?.datasetsHook ? scope.datasetsHook(deps) : EMPTY_OBJECT
  useEffect(() => {
    onResolved(scopeId, ds)
  }, [scopeId, ds, onResolved])
  return null
}

const EMPTY_OBJECT: Record<string, unknown> = Object.freeze({})

export type MultiScopeDatasetsHostProps = {
  supabase: SupabaseClient | null
  organizationId: string | null
  filters: DashboardFilter[]
  /** Stable list of scope ids whose datasets should be merged. */
  scopes: string[]
  /** Render-prop child gets the merged map. */
  children: (merged: Record<string, unknown>) => ReactNode
}

export function MultiScopeDatasetsHost({
  supabase,
  organizationId,
  filters,
  scopes,
  children,
}: MultiScopeDatasetsHostProps) {
  const [byScope, setByScope] = useState<ResolvedMap>({})

  const onResolved = useCallback((scopeId: string, datasets: Record<string, unknown>) => {
    setByScope((prev) => {
      if (prev[scopeId] === datasets) return prev
      return { ...prev, [scopeId]: datasets }
    })
  }, [])

  const deps = useMemo<DatasetsHookDeps>(
    () => ({ supabase, organizationId, filters }),
    [supabase, organizationId, filters],
  )

  const merged = useMemo<Record<string, unknown>>(() => {
    const out: Record<string, unknown> = {}
    for (const id of scopes) {
      const m = byScope[id]
      if (m) Object.assign(out, m)
    }
    return out
  }, [scopes, byScope])

  return (
    <>
      {scopes.map((id) => (
        <ScopeAdapter key={id} scopeId={id} deps={deps} onResolved={onResolved} />
      ))}
      {children(merged)}
    </>
  )
}
