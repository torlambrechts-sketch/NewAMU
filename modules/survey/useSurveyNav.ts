// Survey nav feed — supplies the AticsShell sidebar with dynamically-built
// "Undersøkelser" entries from the org's licensed packs, their admin-defined
// categories, and pinned templates. Filters by the active pack focus when
// ?pack= is present in the URL.
//
// Mirrors modules/compliance/useComplianceNav.ts. Read-only; no mutations
// (admin pinning lives in the Maler tab via useSurveyOrgTemplates updates).

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
}

type PinnedRow = {
  catalog_id: string
  pack: SurveyPackSlug
  name_override: string | null
  catalog_name: string
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

  const [pinned, setPinned] = useState<PinnedRow[]>([])
  const [categoryRows, setCategoryRows] = useState<CategoryRow[]>([])
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const targetKey = supabase && orgId ? orgId : null

  useEffect(() => {
    if (!supabase || !orgId) return
    let cancelled = false
    void Promise.all([
      supabase
        .from('survey_org_templates')
        .select(
          'catalog_id, pack, name_override, category_id, survey_template_catalog!inner(name)',
        )
        .eq('organization_id', orgId)
        .eq('nav_pinned', true)
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
    ]).then(([tplRes, catRes]) => {
      if (cancelled) return
      if (tplRes.error) {
        setPinned([])
      } else {
        const rows: PinnedRow[] = []
        for (const raw of tplRes.data ?? []) {
          // PostgREST returns the FK join as either a single object or
          // a single-element array depending on schema-cache visibility
          // of the FK constraint. Accept both shapes — historically the
          // array form silently dropped pinned templates from the
          // sidebar even when the hub showed them, because the
          // single-object access path saw `undefined`.
          const rawJoin = (raw as { survey_template_catalog?: unknown })
            .survey_template_catalog
          const catalog = Array.isArray(rawJoin)
            ? (rawJoin[0] as { name?: string } | undefined)
            : (rawJoin as { name?: string } | null | undefined)
          if (!catalog?.name) continue
          rows.push({
            catalog_id: (raw as { catalog_id: string }).catalog_id,
            pack: (raw as { pack: SurveyPackSlug }).pack,
            name_override: (raw as { name_override: string | null }).name_override,
            catalog_name: catalog.name,
            category_id: (raw as { category_id: string | null }).category_id ?? null,
          })
        }
        setPinned(rows)
      }
      setCategoryRows(catRes.error ? [] : ((catRes.data ?? []) as CategoryRow[]))
      setFetchedFor(orgId)
    })
    return () => {
      cancelled = true
    }
  }, [supabase, orgId])

  const loading = packsLoading || (targetKey !== null && targetKey !== fetchedFor)

  const items = useMemo<SurveyPinnedNavItem[]>(() => {
    const licensedSlugs = new Set(packs.map((p) => p.slug))
    const focusSlug =
      activePackParam && licensedSlugs.has(activePackParam as SurveyPackSlug)
        ? (activePackParam as SurveyPackSlug)
        : null

    return pinned
      .filter((t) => licensedSlugs.has(t.pack))
      .filter((t) => focusSlug === null || t.pack === focusSlug)
      .map((t) => ({
        catalogId: t.catalog_id,
        templateName: t.name_override ?? t.catalog_name,
        pack: t.pack,
        categoryId: t.category_id,
        headerKey: t.category_id ?? `${t.pack}:__uncat__`,
        to: `/survey?template=${encodeURIComponent(t.catalog_id)}&pack=${encodeURIComponent(t.pack)}`,
      }))
      .sort((a, b) => a.templateName.localeCompare(b.templateName, 'nb'))
  }, [pinned, packs, activePackParam])

  const categories = useMemo<SurveyNavCategory[]>(() => {
    const licensedSlugs = new Set(packs.map((p) => p.slug))
    return categoryRows
      .filter((c) => licensedSlugs.has(c.pack))
      .map((c) => ({
        id: c.id,
        pack: c.pack,
        name: c.name,
        position: c.position,
        regulationId: c.regulation_id ?? null,
      }))
  }, [categoryRows, packs])

  return {
    loading,
    hasAnyPack: packs.length > 0,
    items,
    categories,
  }
}
