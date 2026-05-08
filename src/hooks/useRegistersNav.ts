// useRegistersNav — supplies the AticsShell sidebar with the
// "Register" group's category headers + per-category list of enabled
// register types. Mirrors useSurveyNav / useDocumentNav / useLearningNav.
//
// Read-only; no mutations. Source data:
//   - register_types         (active, system + org-authored)
//   - register_org_settings  (per-org enable + name override + category)
//   - register_categories    (per-org)
//
// We bypass the per-org settings join by querying separately and
// stitching in JS — same pattern useSurveyNav landed on after the
// PostgREST schema-cache flakiness (see commit 21b4c3c).

import { useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'

export type RegisterPinnedNavItem = {
  typeId: string
  name: string
  /** Category id, null = uncategorised. */
  categoryId: string | null
  /** Stable key linking this item to its category header in the sidebar. */
  headerKey: string
  /** Path to the per-type list page. */
  to: string
  /** Cross-module taxonomy: type-level regulation tags. The sidebar
   *  uses these alongside category.regulation_id so the regelverk
   *  chip can narrow visible types even when their category isn't
   *  classified. */
  regulationIds: string[]
}

export type RegisterNavCategory = {
  id: string
  name: string
  position: number
  /** Cat 1 of the cross-module taxonomy. */
  regulationId: string | null
}

export type UseRegistersNavReturn = {
  loading: boolean
  items: RegisterPinnedNavItem[]
  categories: RegisterNavCategory[]
}

type TypeRow = {
  id: string
  organization_id: string | null
  name: string
  is_active: boolean
  regulation_ids: string[] | null
}
type SettingsRow = {
  register_type_id: string
  enabled: boolean
  nav_pinned: boolean
  name_override: string | null
  category_id: string | null
}
type CategoryRow = {
  id: string
  name: string
  position: number
  regulation_id: string | null
  is_active: boolean
}

export function useRegistersNav(): UseRegistersNavReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [types, setTypes] = useState<TypeRow[]>([])
  const [settings, setSettings] = useState<SettingsRow[]>([])
  const [categoryRows, setCategoryRows] = useState<CategoryRow[]>([])
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const targetKey = supabase && orgId ? orgId : null

  useEffect(() => {
    if (!supabase || !orgId) return
    let cancelled = false
    void Promise.all([
      supabase
        .from('register_types')
        .select('id, organization_id, name, is_active, regulation_ids')
        .eq('is_active', true),
      supabase
        .from('register_org_settings')
        .select('register_type_id, enabled, nav_pinned, name_override, category_id')
        .eq('organization_id', orgId),
      supabase
        .from('register_categories')
        .select('id, name, position, regulation_id, is_active')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('position', { ascending: true })
        .order('name', { ascending: true }),
    ])
      .catch((e) => {
        if (cancelled) return null
        console.warn('useRegistersNav fetch failed', e)
        setFetchedFor(orgId)
        return null
      })
      .then((res) => {
        if (!res || cancelled) return
        const [tRes, sRes, cRes] = res
        setTypes(
          tRes.error
            ? []
            : ((tRes.data ?? []).filter(
                (r) =>
                  ((r as TypeRow).organization_id === null ||
                    (r as TypeRow).organization_id === orgId),
              ) as TypeRow[]),
        )
        setSettings(sRes.error ? [] : ((sRes.data ?? []) as SettingsRow[]))
        setCategoryRows(cRes.error ? [] : ((cRes.data ?? []) as CategoryRow[]))
        setFetchedFor(orgId)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, orgId])

  const loading = targetKey !== null && targetKey !== fetchedFor

  const items = useMemo<RegisterPinnedNavItem[]>(() => {
    const settingsByType = new Map<string, SettingsRow>()
    for (const s of settings) settingsByType.set(s.register_type_id, s)
    return types
      .map((t) => {
        const s = settingsByType.get(t.id)
        const enabled = !s || s.enabled
        const pinned = !s || s.nav_pinned
        if (!enabled || !pinned) return null
        const categoryId = s?.category_id ?? null
        return {
          typeId: t.id,
          name: s?.name_override ?? t.name,
          categoryId,
          headerKey: categoryId ?? '__uncat__',
          to: `/registers/${encodeURIComponent(t.id)}`,
          regulationIds: t.regulation_ids ?? [],
        }
      })
      .filter((x): x is RegisterPinnedNavItem => x !== null)
      .sort((a, b) => a.name.localeCompare(b.name, 'nb'))
  }, [types, settings])

  const categories = useMemo<RegisterNavCategory[]>(() => {
    return categoryRows.map((c) => ({
      id: c.id,
      name: c.name,
      position: c.position,
      regulationId: c.regulation_id ?? null,
    }))
  }, [categoryRows])

  return { loading, items, categories }
}
