// useDashboardLayout — load + save a single dashboard layout for a scope.
//
// Resolution order at load time:
//   1. If a `slug` was passed and that row exists → use it.
//   2. Else the org's default-shared row (owner_user_id null, is_default=true).
//   3. Else the most recently updated shared row.
//   4. Else the registry's defaultLayout (no DB row exists yet).
//
// On save we upsert by (org, scope, slug, owner=null) and bump version.
// The hook intentionally only deals with shared (org-wide) layouts in
// phase 2; per-user copies and slug switching land with the editor UI.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../supabaseError'
import { getDashboardScope } from './dashboardRegistry'
import type { DashboardFilter } from './dashboardFilters'
import type { ReportModule } from '../../types/reportBuilder'

const ReportModuleSchema = z.object({
  id: z.string(),
  title: z.string(),
  datasetKey: z.string(),
  kind: z.enum(['kpi', 'table', 'bar', 'donut']),
}).passthrough()

const DashboardLayoutRowSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  scope_id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  layout: z.array(ReportModuleSchema).default([]),
  filters: z.array(z.unknown()).default([]),
  owner_user_id: z.string().uuid().nullable(),
  is_default: z.boolean(),
  version: z.number().int(),
  deleted_at: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type DashboardLayoutRow = z.infer<typeof DashboardLayoutRowSchema>

type State = {
  loading: boolean
  error: string | null
  /** The persisted row, when one exists for this scope. */
  row: DashboardLayoutRow | null
  /** Effective layout: row.layout if a row exists, else registry default. */
  layout: ReportModule[]
  /** Effective filter chips. */
  filters: DashboardFilter[]
  /** True iff `layout` came from the registry default (no DB row yet). */
  isDefault: boolean
}

export function useDashboardLayout({
  supabase,
  scopeId,
  slug = 'default',
}: {
  supabase: SupabaseClient | null
  scopeId: string
  slug?: string
}) {
  const { organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const registryDefault = useMemo(() => {
    const scope = getDashboardScope(scopeId)
    return scope?.defaultLayout ?? []
  }, [scopeId])

  const [state, setState] = useState<State>({
    loading: false,
    error: null,
    row: null,
    layout: registryDefault,
    filters: [],
    isDefault: true,
  })

  const reload = useCallback(async () => {
    if (!supabase || !orgId) return
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      // Try the named slug first.
      const named = await supabase
        .from('dashboard_layouts')
        .select('*')
        .eq('organization_id', orgId)
        .eq('scope_id', scopeId)
        .eq('slug', slug)
        .is('owner_user_id', null)
        .is('deleted_at', null)
        .maybeSingle()
      if (named.error && named.error.code !== 'PGRST116') throw named.error

      let rowData: unknown = named.data
      if (!rowData) {
        // Fall back to the org's marked default; then most-recently-updated.
        const fallback = await supabase
          .from('dashboard_layouts')
          .select('*')
          .eq('organization_id', orgId)
          .eq('scope_id', scopeId)
          .is('owner_user_id', null)
          .is('deleted_at', null)
          .order('is_default', { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (fallback.error && fallback.error.code !== 'PGRST116') throw fallback.error
        rowData = fallback.data
      }

      if (!rowData) {
        setState({
          loading: false,
          error: null,
          row: null,
          layout: registryDefault,
          filters: [],
          isDefault: true,
        })
        return
      }
      const parsed = DashboardLayoutRowSchema.safeParse(rowData)
      if (!parsed.success) {
        setState({
          loading: false,
          error: 'Kunne ikke tolke lagret oppsett — viser standard.',
          row: null,
          layout: registryDefault,
          filters: [],
          isDefault: true,
        })
        return
      }
      setState({
        loading: false,
        error: null,
        row: parsed.data,
        layout: parsed.data.layout as ReportModule[],
        filters: (parsed.data.filters as DashboardFilter[]) ?? [],
        isDefault: false,
      })
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: getSupabaseErrorMessage(err),
      }))
    }
  }, [supabase, orgId, scopeId, slug, registryDefault])

  useEffect(() => {
    void reload()
  }, [reload])

  const persist = useCallback(
    async (patch: { layout?: ReportModule[]; filters?: DashboardFilter[] }): Promise<boolean> => {
      if (!supabase || !orgId) return false
      setState((s) => ({ ...s, error: null }))
      const nextLayout = patch.layout ?? state.layout
      const nextFilters = patch.filters ?? state.filters
      try {
        if (state.row) {
          const { data, error } = await supabase
            .from('dashboard_layouts')
            .update({ layout: nextLayout, filters: nextFilters })
            .eq('id', state.row.id)
            .eq('version', state.row.version)
            .select('*')
            .single()
          if (error) throw error
          const parsed = DashboardLayoutRowSchema.safeParse(data)
          if (parsed.success) {
            setState({
              loading: false,
              error: null,
              row: parsed.data,
              layout: parsed.data.layout as ReportModule[],
              filters: (parsed.data.filters as DashboardFilter[]) ?? [],
              isDefault: false,
            })
          }
          return true
        }
        // First save → insert a "Standard" shared row for this scope.
        const { data, error } = await supabase
          .from('dashboard_layouts')
          .insert({
            scope_id: scopeId,
            slug,
            name: 'Standard',
            layout: nextLayout,
            filters: nextFilters,
            is_default: true,
          })
          .select('*')
          .single()
        if (error) throw error
        const parsed = DashboardLayoutRowSchema.safeParse(data)
        if (parsed.success) {
          setState({
            loading: false,
            error: null,
            row: parsed.data,
            layout: parsed.data.layout as ReportModule[],
            filters: (parsed.data.filters as DashboardFilter[]) ?? [],
            isDefault: false,
          })
        }
        return true
      } catch (err) {
        setState((s) => ({ ...s, error: getSupabaseErrorMessage(err) }))
        return false
      }
    },
    [supabase, orgId, scopeId, slug, state.row, state.layout, state.filters],
  )

  const saveLayout = useCallback(
    (layout: ReportModule[]) => persist({ layout }),
    [persist],
  )

  const saveFilters = useCallback(
    (filters: DashboardFilter[]) => persist({ filters }),
    [persist],
  )

  /**
   * Reset back to the registry default by soft-deleting the saved row.
   * Useful when an admin gets the layout into a weird state and just
   * wants to start over.
   */
  const resetToDefault = useCallback(async (): Promise<boolean> => {
    if (!supabase || !orgId || !state.row) {
      setState({
        loading: false,
        error: null,
        row: null,
        layout: registryDefault,
        filters: [],
        isDefault: true,
      })
      return true
    }
    try {
      const { error } = await supabase
        .from('dashboard_layouts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', state.row.id)
      if (error) throw error
      setState({
        loading: false,
        error: null,
        row: null,
        layout: registryDefault,
        filters: [],
        isDefault: true,
      })
      return true
    } catch (err) {
      setState((s) => ({ ...s, error: getSupabaseErrorMessage(err) }))
      return false
    }
  }, [supabase, orgId, state.row, registryDefault])

  return {
    ...state,
    reload,
    saveLayout,
    saveFilters,
    resetToDefault,
  }
}
