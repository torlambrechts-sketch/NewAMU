// Compliance navigation feed — supplies the AticsShell sidebar with
// dynamically-built entries from the org's licensed packs, their
// admin-defined categories, and pinned templates. Filters by the active
// pack focus when ?pack= is present in the URL (the focus principle:
// switching pack switches the sidebar to that regulation's templates).
//
// Read-only. Used by AticsShell at module-tree level, so kept lean —
// two queries (templates, categories), no mutations.

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { usePacks } from './usePacks'
import type { CompliancePackSlug } from './types'

export type CompliancePinnedNavItem = {
  templateId: string
  templateSlug: string
  name: string
  pack: CompliancePackSlug
  /** Category id, null = uncategorised. */
  categoryId: string | null
  /** Stable key linking this item to its category header in the sidebar. */
  headerKey: string
  /** Path including ?template= and ?pack= so a deep link reproduces the view. */
  to: string
}

export type ComplianceNavCategory = {
  id: string
  pack: CompliancePackSlug
  name: string
  position: number
}

export type UseComplianceNavReturn = {
  loading: boolean
  /** Whether the org has any licensed pack at all. */
  hasAnyPack: boolean
  /** Pinned templates for the active pack focus (or all if none active). */
  items: CompliancePinnedNavItem[]
  /** Categories the items reference (active only), sorted for stable headers. */
  categories: ComplianceNavCategory[]
}

type PinnedTemplateRow = {
  id: string
  slug: string
  name: string
  pack: CompliancePackSlug
  category_id: string | null
}

type CategoryRow = {
  id: string
  pack: CompliancePackSlug
  name: string
  position: number
}

export function useComplianceNav(): UseComplianceNavReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const { packs, loading: packsLoading } = usePacks({ supabase })
  const [searchParams] = useSearchParams()
  const activePackParam = searchParams.get('pack')

  const [pinned, setPinned] = useState<PinnedTemplateRow[]>([])
  const [categoryRows, setCategoryRows] = useState<CategoryRow[]>([])
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const targetKey = supabase && orgId ? orgId : null

  useEffect(() => {
    if (!supabase || !orgId) return
    let cancelled = false
    void Promise.all([
      supabase
        .from('compliance_checklist_templates')
        .select('id, slug, name, pack, category_id')
        .eq('organization_id', orgId)
        .eq('nav_pinned', true)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name', { ascending: true }),
      supabase
        .from('compliance_checklist_categories')
        .select('id, pack, name, position')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('pack', { ascending: true })
        .order('position', { ascending: true })
        .order('name', { ascending: true }),
    ]).then(([tplRes, catRes]) => {
      if (cancelled) return
      setPinned(tplRes.error ? [] : ((tplRes.data ?? []) as PinnedTemplateRow[]))
      setCategoryRows(catRes.error ? [] : ((catRes.data ?? []) as CategoryRow[]))
      setFetchedFor(orgId)
    })
    return () => {
      cancelled = true
    }
  }, [supabase, orgId])

  const loading = targetKey !== null && targetKey !== fetchedFor

  const items = useMemo<CompliancePinnedNavItem[]>(() => {
    const licensedSlugs = new Set(packs.map((p) => p.slug))

    // Hub mode (no ?pack=) shows pinned templates from every licensed pack
    // so the sidebar mirrors the hub tile grid. With ?pack= set, narrow.
    const focusSlug =
      activePackParam && licensedSlugs.has(activePackParam as CompliancePackSlug)
        ? (activePackParam as CompliancePackSlug)
        : null

    return pinned
      .filter((t) => licensedSlugs.has(t.pack))
      .filter((t) => focusSlug === null || t.pack === focusSlug)
      .map((t) => ({
        templateId: t.id,
        templateSlug: t.slug,
        name: t.name,
        pack: t.pack,
        categoryId: t.category_id,
        // Stable key shared with the matching header row so the sidebar
        // can group + toggle items by their (org-scoped) category.
        headerKey: t.category_id ?? `${t.pack}:__uncat__`,
        to: `/compliance/checklists?template=${encodeURIComponent(t.slug)}&pack=${encodeURIComponent(t.pack)}`,
      }))
  }, [pinned, packs, activePackParam])

  const categories = useMemo<ComplianceNavCategory[]>(() => {
    const licensedSlugs = new Set(packs.map((p) => p.slug))
    return categoryRows
      .filter((c) => licensedSlugs.has(c.pack))
      .map((c) => ({ id: c.id, pack: c.pack, name: c.name, position: c.position }))
  }, [categoryRows, packs])

  return {
    loading: loading || packsLoading,
    hasAnyPack: packs.length > 0,
    items,
    categories,
  }
}
