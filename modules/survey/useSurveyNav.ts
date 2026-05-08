// Survey nav feed — supplies the AticsShell sidebar with dynamically-built
// "Undersøkelser" entries from the org's licensed packs and admin-defined
// categories. Filters by the active pack focus when ?pack= is present.
//
// IMPORTANT design choice (changed during the empty-sidebar bug hunt):
// the sidebar reads the SYSTEM CATALOG directly (`survey_template_catalog`
// where is_system + is_active) rather than the per-org override layer
// (`survey_org_templates`). Reasons:
//   - The hub renders catalog rows directly (the "Festet" badge is
//     `!!pinnedRow`, but the tile renders regardless). The sidebar
//     should mirror that visibility, not depend on an additional
//     provisioning chain that has historically broken (rows missing,
//     nav_pinned=false, FK schema-cache invisibility).
//   - Per-template visibility is configured by toggling the catalog
//     `is_active` flag (admins do this in the Maler tab via
//     useSurveyOrgTemplates, which still owns name overrides + admin
//     state). Sidebar visibility doesn't depend on that.
//   - Category overrides + name overrides from `survey_org_templates`
//     are layered on top when present, but their absence never empties
//     the sidebar.

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useSurveyPacks } from './useSurveyPacks'
import type { SurveyPackSlug } from './types'

export type SurveyPinnedNavItem = {
  catalogId: string
  templateName: string
  pack: SurveyPackSlug
  /** Category id, null = uncategorised. */
  categoryId: string | null
  /** Stable key linking this item to its category header in the sidebar. */
  headerKey: string
  /** Path including ?template= and ?pack= so a deep link reproduces the view. */
  to: string
}

export type SurveyNavCategory = {
  id: string
  pack: SurveyPackSlug
  name: string
  position: number
  /** Cat 1 of the cross-module taxonomy (category-architecture §T2).
   *  Null when the admin hasn't classified this category under a regulation. */
  regulationId: string | null
}

export type UseSurveyNavReturn = {
  loading: boolean
  hasAnyPack: boolean
  items: SurveyPinnedNavItem[]
  categories: SurveyNavCategory[]
  /** Lookup pack short name by slug — used by the sidebar to label
   *  per-pack uncategorised buckets so multiple "Uten kategori"
   *  headers don't collide. */
  packShortNameBySlug: Record<string, string>
}

type CatalogRow = {
  id: string
  pack: SurveyPackSlug
  name: string
}

type OrgOverrideRow = {
  catalog_id: string
  name_override: string | null
  category_id: string | null
}

type CategoryRow = {
  id: string
  pack: SurveyPackSlug
  name: string
  position: number
  regulation_id: string | null
}

export function useSurveyNav(): UseSurveyNavReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const { packs, loading: packsLoading } = useSurveyPacks({ supabase })
  const [searchParams] = useSearchParams()
  const activePackParam = searchParams.get('pack')

  const [catalogRows, setCatalogRows] = useState<CatalogRow[]>([])
  const [overrideRows, setOverrideRows] = useState<OrgOverrideRow[]>([])
  const [categoryRows, setCategoryRows] = useState<CategoryRow[]>([])
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const targetKey = supabase && orgId ? orgId : null

  useEffect(() => {
    if (!supabase || !orgId) return
    let cancelled = false
    void Promise.all([
      supabase
        .from('survey_template_catalog')
        .select('id, pack, name')
        .eq('is_active', true)
        .eq('is_system', true)
        .order('name', { ascending: true }),
      supabase
        .from('survey_org_templates')
        .select('catalog_id, name_override, category_id')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .is('deleted_at', null),
      supabase
        .from('survey_template_categories')
        .select('id, pack, name, position, regulation_id')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('pack', { ascending: true })
        .order('position', { ascending: true })
        .order('name', { ascending: true }),
    ])
      .catch((e) => {
        if (cancelled) return null
        console.warn('useSurveyNav fetch failed', e)
        setFetchedFor(orgId)
        return null
      })
      .then((res) => {
        if (!res || cancelled) return
        const [catalogRes, overrideRes, catRes] = res
        setCatalogRows(catalogRes.error ? [] : ((catalogRes.data ?? []) as CatalogRow[]))
        setOverrideRows(overrideRes.error ? [] : ((overrideRes.data ?? []) as OrgOverrideRow[]))
        setCategoryRows(catRes.error ? [] : ((catRes.data ?? []) as CategoryRow[]))
        setFetchedFor(orgId)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, orgId])

  const loading = packsLoading || (targetKey !== null && targetKey !== fetchedFor)

  const items = useMemo<SurveyPinnedNavItem[]>(() => {
    // Per-catalog overlay: pick up the per-org name + category if an
    // override row exists; otherwise fall through to the catalog row.
    const overrideById = new Map<string, OrgOverrideRow>()
    for (const o of overrideRows) overrideById.set(o.catalog_id, o)

    const focusSlug = activePackParam ? (activePackParam as SurveyPackSlug) : null

    return catalogRows
      .filter((c) => focusSlug === null || c.pack === focusSlug)
      .map((c) => {
        const ov = overrideById.get(c.id)
        const categoryId = ov?.category_id ?? null
        return {
          catalogId: c.id,
          templateName: ov?.name_override ?? c.name,
          pack: c.pack,
          categoryId,
          headerKey: categoryId ?? `${c.pack}:__uncat__`,
          to: `/survey?template=${encodeURIComponent(c.id)}&pack=${encodeURIComponent(c.pack)}`,
        } satisfies SurveyPinnedNavItem
      })
      .sort((a, b) => a.templateName.localeCompare(b.templateName, 'nb'))
  }, [catalogRows, overrideRows, activePackParam])

  const categories = useMemo<SurveyNavCategory[]>(() => {
    return categoryRows.map((c) => ({
      id: c.id,
      pack: c.pack,
      name: c.name,
      position: c.position,
      regulationId: c.regulation_id ?? null,
    }))
  }, [categoryRows])

  return {
    loading,
    hasAnyPack: packs.length > 0,
    items,
    categories,
    packShortNameBySlug: Object.fromEntries(packs.map((p) => [p.slug, p.short_name])),
  }
}
