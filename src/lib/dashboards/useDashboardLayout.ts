// useDashboardLayout — load + save a dashboard layout for a scope, with
// support for multiple named dashboards per scope.
//
// At mount the hook seeds itself with a single "active" row (resolution
// order in `reload` below). The caller can then switch dashboards via
// `selectLayout(id)`, create new copies with `saveAs(...)`, rename via
// `renameActive(name)`, or soft-delete with `deleteActive()`.
//
// Visibility rules:
//   - Shared rows (`owner_user_id` null) are visible to everyone in the org.
//   - Private rows (`owner_user_id = me`) are visible only to me.
// `availableLayouts` returns the union, ordered shared-then-private.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../supabaseError'
import { getDashboardScope } from './dashboardRegistry'
import type { DashboardFilter } from './dashboardFilters'
import type { ReportModule } from '../../types/reportBuilder'

// Loose widget shape — `passthrough()` keeps kind-specific fields
// (valuePath, segmentsPath, seriesKeys, …) intact across the round-
// trip even though they aren't in the explicit schema. The kind enum
// must stay in sync with the union in src/types/reportBuilder.ts.
const ReportModuleSchema = z.object({
  id: z.string(),
  title: z.string(),
  datasetKey: z.string(),
  kind: z.enum(['kpi', 'table', 'bar', 'donut', 'line', 'heatmap']),
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
  /** All rows visible to the current user, used by the chooser dropdown. */
  available: DashboardLayoutRow[]
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return base.length > 0 ? base.slice(0, 60) : `view-${Date.now().toString(36)}`
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
  const { organization, user } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const userId = user?.id ?? null

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
    available: [],
  })
  /** Remembered explicit selection — when the user picks a non-default
   *  view, we re-resolve to that row across reloads. */
  const [activeRowId, setActiveRowId] = useState<string | null>(null)

  const fetchAvailable = useCallback(async (): Promise<DashboardLayoutRow[]> => {
    if (!supabase || !orgId) return []
    const ownerFilter = userId ? `owner_user_id.is.null,owner_user_id.eq.${userId}` : 'owner_user_id.is.null'
    const { data, error } = await supabase
      .from('dashboard_layouts')
      .select('*')
      .eq('organization_id', orgId)
      .eq('scope_id', scopeId)
      .is('deleted_at', null)
      .or(ownerFilter)
      .order('owner_user_id', { ascending: true, nullsFirst: true })
      .order('is_default', { ascending: false })
      .order('updated_at', { ascending: false })
    if (error) throw error
    const rows: DashboardLayoutRow[] = []
    for (const r of data ?? []) {
      const parsed = DashboardLayoutRowSchema.safeParse(r)
      if (parsed.success) rows.push(parsed.data)
    }
    return rows
  }, [supabase, orgId, scopeId, userId])

  const reload = useCallback(async () => {
    if (!supabase || !orgId) return
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const available = await fetchAvailable()

      // Resolution order:
      //   1. Explicit `activeRowId` from a prior selectLayout call.
      //   2. Row matching the constructor `slug` among shared rows.
      //   3. Org's default-shared row (`is_default = true`).
      //   4. Most-recently-updated shared row.
      //   5. Registry default (no DB row exists yet).
      const pickRow = (): DashboardLayoutRow | null => {
        if (activeRowId) {
          const r = available.find((x) => x.id === activeRowId)
          if (r) return r
        }
        const namedShared = available.find(
          (r) => r.owner_user_id == null && r.slug === slug,
        )
        if (namedShared) return namedShared
        const defaultShared = available.find(
          (r) => r.owner_user_id == null && r.is_default,
        )
        if (defaultShared) return defaultShared
        const anyShared = available.find((r) => r.owner_user_id == null) ?? null
        return anyShared
      }
      const rowData = pickRow()

      if (!rowData) {
        setState({
          loading: false,
          error: null,
          row: null,
          layout: registryDefault,
          filters: [],
          isDefault: true,
          available,
        })
        return
      }
      setState({
        loading: false,
        error: null,
        row: rowData,
        layout: rowData.layout as ReportModule[],
        filters: (rowData.filters as DashboardFilter[]) ?? [],
        isDefault: false,
        available,
      })
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: getSupabaseErrorMessage(err),
      }))
    }
  }, [supabase, orgId, slug, registryDefault, fetchAvailable, activeRowId])

  useEffect(() => {
    void reload()
  }, [reload])

  /** Switch the active dashboard to the row with this id. The new row
   *  must already be in `available` (so it's been fetched + permitted). */
  const selectLayout = useCallback(
    (rowId: string) => {
      setActiveRowId(rowId)
      setState((s) => {
        const next = s.available.find((r) => r.id === rowId)
        if (!next) return s
        return {
          ...s,
          row: next,
          layout: next.layout as ReportModule[],
          filters: (next.filters as DashboardFilter[]) ?? [],
          isDefault: false,
        }
      })
    },
    [setActiveRowId],
  )

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
            setState((s) => ({
              ...s,
              loading: false,
              error: null,
              row: parsed.data,
              layout: parsed.data.layout as ReportModule[],
              filters: (parsed.data.filters as DashboardFilter[]) ?? [],
              isDefault: false,
              available: s.available.map((r) => (r.id === parsed.data.id ? parsed.data : r)),
            }))
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
          setActiveRowId(parsed.data.id)
          setState((s) => ({
            ...s,
            loading: false,
            error: null,
            row: parsed.data,
            layout: parsed.data.layout as ReportModule[],
            filters: (parsed.data.filters as DashboardFilter[]) ?? [],
            isDefault: false,
            available: [...s.available, parsed.data],
          }))
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
   * Create a new dashboard row in this scope, optionally cloning the
   * currently active layout/filters. Switches to the new row on success.
   */
  const saveAs = useCallback(
    async ({
      name,
      isPrivate = false,
      basedOnActive = true,
      description,
    }: {
      name: string
      isPrivate?: boolean
      basedOnActive?: boolean
      description?: string | null
    }): Promise<DashboardLayoutRow | null> => {
      if (!supabase || !orgId) return null
      const trimmed = name.trim()
      if (!trimmed) {
        setState((s) => ({ ...s, error: 'Navnet kan ikke være tomt.' }))
        return null
      }
      // Slug must be unique per (org, scope, owner). Mint from name and
      // disambiguate against existing rows owned by the same scope.
      const baseSlug = slugify(trimmed)
      const existingSlugs = new Set(
        state.available
          .filter((r) => (isPrivate ? r.owner_user_id === userId : r.owner_user_id == null))
          .map((r) => r.slug),
      )
      let nextSlug = baseSlug
      let n = 2
      while (existingSlugs.has(nextSlug)) {
        nextSlug = `${baseSlug}-${n++}`
      }
      const layoutToSave = basedOnActive ? state.layout : registryDefault
      const filtersToSave = basedOnActive ? state.filters : []
      try {
        const { data, error } = await supabase
          .from('dashboard_layouts')
          .insert({
            scope_id: scopeId,
            slug: nextSlug,
            name: trimmed,
            description: description ?? null,
            layout: layoutToSave,
            filters: filtersToSave,
            is_default: false,
            owner_user_id: isPrivate ? userId : null,
          })
          .select('*')
          .single()
        if (error) throw error
        const parsed = DashboardLayoutRowSchema.safeParse(data)
        if (!parsed.success) {
          setState((s) => ({ ...s, error: 'Kunne ikke lese den nye visningen.' }))
          return null
        }
        setActiveRowId(parsed.data.id)
        setState((s) => ({
          ...s,
          row: parsed.data,
          layout: parsed.data.layout as ReportModule[],
          filters: (parsed.data.filters as DashboardFilter[]) ?? [],
          isDefault: false,
          available: [...s.available, parsed.data],
          error: null,
        }))
        return parsed.data
      } catch (err) {
        setState((s) => ({ ...s, error: getSupabaseErrorMessage(err) }))
        return null
      }
    },
    [supabase, orgId, scopeId, userId, state.available, state.layout, state.filters, registryDefault],
  )

  const renameActive = useCallback(
    async (name: string, description?: string | null): Promise<boolean> => {
      if (!supabase || !orgId || !state.row) return false
      const trimmed = name.trim()
      if (!trimmed) {
        setState((s) => ({ ...s, error: 'Navnet kan ikke være tomt.' }))
        return false
      }
      try {
        const update: Record<string, unknown> = { name: trimmed }
        if (description !== undefined) update.description = description
        const { data, error } = await supabase
          .from('dashboard_layouts')
          .update(update)
          .eq('id', state.row.id)
          .select('*')
          .single()
        if (error) throw error
        const parsed = DashboardLayoutRowSchema.safeParse(data)
        if (!parsed.success) return false
        setState((s) => ({
          ...s,
          row: parsed.data,
          available: s.available.map((r) => (r.id === parsed.data.id ? parsed.data : r)),
          error: null,
        }))
        return true
      } catch (err) {
        setState((s) => ({ ...s, error: getSupabaseErrorMessage(err) }))
        return false
      }
    },
    [supabase, orgId, state.row],
  )

  /** Soft-delete the active row. Falls back to the registry default. */
  const deleteActive = useCallback(async (): Promise<boolean> => {
    if (!supabase || !orgId || !state.row) return false
    try {
      const { error } = await supabase
        .from('dashboard_layouts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', state.row.id)
      if (error) throw error
      const removedId = state.row.id
      setActiveRowId(null)
      setState((s) => ({
        ...s,
        row: null,
        layout: registryDefault,
        filters: [],
        isDefault: true,
        available: s.available.filter((r) => r.id !== removedId),
        error: null,
      }))
      return true
    } catch (err) {
      setState((s) => ({ ...s, error: getSupabaseErrorMessage(err) }))
      return false
    }
  }, [supabase, orgId, state.row, registryDefault])

  /** Mark the active org-shared row as the default for the scope. */
  const markActiveDefault = useCallback(async (): Promise<boolean> => {
    if (!supabase || !orgId || !state.row) return false
    if (state.row.owner_user_id !== null) {
      setState((s) => ({
        ...s,
        error: 'Bare delte visninger kan settes som standard.',
      }))
      return false
    }
    try {
      // Atomicity is best-effort: clear any other shared default first,
      // then set ours. The composite UNIQUE per scope keeps the model honest.
      await supabase
        .from('dashboard_layouts')
        .update({ is_default: false })
        .eq('organization_id', orgId)
        .eq('scope_id', scopeId)
        .is('owner_user_id', null)
        .neq('id', state.row.id)
      const { data, error } = await supabase
        .from('dashboard_layouts')
        .update({ is_default: true })
        .eq('id', state.row.id)
        .select('*')
        .single()
      if (error) throw error
      const parsed = DashboardLayoutRowSchema.safeParse(data)
      if (!parsed.success) return false
      const refreshed = await fetchAvailable()
      setState((s) => ({
        ...s,
        row: parsed.data,
        available: refreshed,
        error: null,
      }))
      return true
    } catch (err) {
      setState((s) => ({ ...s, error: getSupabaseErrorMessage(err) }))
      return false
    }
  }, [supabase, orgId, scopeId, state.row, fetchAvailable])

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
        available: state.available,
      })
      return true
    }
    try {
      const { error } = await supabase
        .from('dashboard_layouts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', state.row.id)
      if (error) throw error
      const removedId = state.row.id
      setActiveRowId(null)
      setState((s) => ({
        ...s,
        loading: false,
        error: null,
        row: null,
        layout: registryDefault,
        filters: [],
        isDefault: true,
        available: s.available.filter((r) => r.id !== removedId),
      }))
      return true
    } catch (err) {
      setState((s) => ({ ...s, error: getSupabaseErrorMessage(err) }))
      return false
    }
  }, [supabase, orgId, state.row, registryDefault, state.available])

  return {
    ...state,
    /** Identity of the currently signed-in user; needed by chooser UI. */
    currentUserId: userId,
    reload,
    selectLayout,
    saveLayout,
    saveFilters,
    saveAs,
    renameActive,
    deleteActive,
    markActiveDefault,
    resetToDefault,
  }
}
