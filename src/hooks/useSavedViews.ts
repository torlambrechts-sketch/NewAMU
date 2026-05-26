// Reusable saved-views client for the data-grid filter bar. Backs the
// FilterBar's "select a saved view" dropdown + star-to-set-default. The
// view payload (filters) is opaque to this hook — each module's filter
// bar defines its own shape and serialises/deserialises it itself.
//
// DB: see `supabase/migrations/20260930120000_module_saved_views.sql`.
// Two tables — module_saved_views (org-shared content) and
// module_saved_view_defaults (per-user landing preference).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'

export type SavedView<Filters = Record<string, unknown>> = {
  id: string
  name: string
  filters: Filters
  createdBy: string | null
  createdAt: string
}

export interface UseSavedViewsResult<Filters = Record<string, unknown>> {
  /** All saved views in the org for this module, sorted by name (nb). */
  views: SavedView<Filters>[]
  /** This user's default view id, or null. */
  defaultViewId: string | null
  /** True while the initial fetch is in flight. */
  loading: boolean
  /** First error from any operation; cleared on next success. */
  error: string | null
  /** Refetch from the server (e.g. after another tab edited a view). */
  refresh: () => Promise<void>
  /** Create a new view; resolves to the new id. */
  createView: (name: string, filters: Filters) => Promise<string | null>
  /** Rename a view the user owns (or any view if they're an org admin). */
  renameView: (id: string, name: string) => Promise<boolean>
  /** Overwrite an existing view's filters (e.g. "save changes"). */
  updateViewFilters: (id: string, filters: Filters) => Promise<boolean>
  /** Delete a view; only the owner / admin can. */
  deleteView: (id: string) => Promise<boolean>
  /** Pin a view as this user's default for this module. */
  setDefaultView: (id: string) => Promise<boolean>
  /** Remove this user's default selection. */
  clearDefaultView: () => Promise<boolean>
}

export function useSavedViews<Filters = Record<string, unknown>>(
  moduleSlug: string,
): UseSavedViewsResult<Filters> {
  const { supabase, organization, user } = useOrgSetupContext()
  const [views, setViews] = useState<SavedView<Filters>[]>([])
  const [defaultViewId, setDefaultViewId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const orgId = organization?.id ?? null
  const userId = user?.id ?? null

  const refresh = useCallback(async () => {
    if (!supabase || !orgId || !moduleSlug) {
      setViews([])
      setDefaultViewId(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [viewsRes, defaultRes] = await Promise.all([
        supabase
          .from('module_saved_views')
          .select('id, name, filters, created_by, created_at')
          .eq('organization_id', orgId)
          .eq('module_slug', moduleSlug)
          .order('name', { ascending: true }),
        userId
          ? supabase
              .from('module_saved_view_defaults')
              .select('view_id')
              .eq('organization_id', orgId)
              .eq('module_slug', moduleSlug)
              .eq('user_id', userId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])
      if (viewsRes.error) throw viewsRes.error
      if (defaultRes.error) throw defaultRes.error
      setViews(
        (viewsRes.data ?? []).map((row) => ({
          id: row.id as string,
          name: row.name as string,
          filters: (row.filters ?? {}) as Filters,
          createdBy: (row.created_by as string | null) ?? null,
          createdAt: row.created_at as string,
        })),
      )
      setDefaultViewId(((defaultRes.data as { view_id?: string } | null)?.view_id) ?? null)
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId, userId, moduleSlug])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createView = useCallback<UseSavedViewsResult<Filters>['createView']>(
    async (name, filters) => {
      if (!supabase || !orgId) return null
      try {
        const { data, error: insertErr } = await supabase
          .from('module_saved_views')
          .insert({
            organization_id: orgId,
            module_slug: moduleSlug,
            name: name.trim(),
            filters,
          })
          .select('id, name, filters, created_by, created_at')
          .single()
        if (insertErr) throw insertErr
        const row = data as {
          id: string
          name: string
          filters: Filters
          created_by: string | null
          created_at: string
        }
        setViews((prev) =>
          [
            ...prev,
            {
              id: row.id,
              name: row.name,
              filters: row.filters ?? ({} as Filters),
              createdBy: row.created_by,
              createdAt: row.created_at,
            },
          ].sort((a, b) => a.name.localeCompare(b.name, 'nb')),
        )
        setError(null)
        return row.id
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        return null
      }
    },
    [supabase, orgId, moduleSlug],
  )

  const renameView = useCallback<UseSavedViewsResult<Filters>['renameView']>(
    async (id, name) => {
      if (!supabase) return false
      try {
        const { error: updErr } = await supabase
          .from('module_saved_views')
          .update({ name: name.trim() })
          .eq('id', id)
        if (updErr) throw updErr
        setViews((prev) =>
          prev
            .map((v) => (v.id === id ? { ...v, name: name.trim() } : v))
            .sort((a, b) => a.name.localeCompare(b.name, 'nb')),
        )
        setError(null)
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        return false
      }
    },
    [supabase],
  )

  const updateViewFilters = useCallback<UseSavedViewsResult<Filters>['updateViewFilters']>(
    async (id, filters) => {
      if (!supabase) return false
      try {
        const { error: updErr } = await supabase
          .from('module_saved_views')
          .update({ filters })
          .eq('id', id)
        if (updErr) throw updErr
        setViews((prev) => prev.map((v) => (v.id === id ? { ...v, filters } : v)))
        setError(null)
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        return false
      }
    },
    [supabase],
  )

  const deleteView = useCallback<UseSavedViewsResult<Filters>['deleteView']>(
    async (id) => {
      if (!supabase) return false
      try {
        const { error: delErr } = await supabase
          .from('module_saved_views')
          .delete()
          .eq('id', id)
        if (delErr) throw delErr
        setViews((prev) => prev.filter((v) => v.id !== id))
        setDefaultViewId((prev) => (prev === id ? null : prev))
        setError(null)
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        return false
      }
    },
    [supabase],
  )

  const setDefaultView = useCallback<UseSavedViewsResult<Filters>['setDefaultView']>(
    async (id) => {
      if (!supabase || !orgId || !userId) return false
      try {
        // Upsert: one row per (user, org, module). The PK enforces uniqueness;
        // a second star moves the bookmark without leaving an orphan row.
        const { error: upErr } = await supabase
          .from('module_saved_view_defaults')
          .upsert(
            {
              user_id: userId,
              organization_id: orgId,
              module_slug: moduleSlug,
              view_id: id,
            },
            { onConflict: 'user_id,organization_id,module_slug' },
          )
        if (upErr) throw upErr
        setDefaultViewId(id)
        setError(null)
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        return false
      }
    },
    [supabase, orgId, userId, moduleSlug],
  )

  const clearDefaultView = useCallback<UseSavedViewsResult<Filters>['clearDefaultView']>(
    async () => {
      if (!supabase || !orgId || !userId) return false
      try {
        const { error: delErr } = await supabase
          .from('module_saved_view_defaults')
          .delete()
          .eq('user_id', userId)
          .eq('organization_id', orgId)
          .eq('module_slug', moduleSlug)
        if (delErr) throw delErr
        setDefaultViewId(null)
        setError(null)
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        return false
      }
    },
    [supabase, orgId, userId, moduleSlug],
  )

  return useMemo(
    () => ({
      views,
      defaultViewId,
      loading,
      error,
      refresh,
      createView,
      renameView,
      updateViewFilters,
      deleteView,
      setDefaultView,
      clearDefaultView,
    }),
    [
      views,
      defaultViewId,
      loading,
      error,
      refresh,
      createView,
      renameView,
      updateViewFilters,
      deleteView,
      setDefaultView,
      clearDefaultView,
    ],
  )
}
