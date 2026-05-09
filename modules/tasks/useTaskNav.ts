// useTaskNav — dynamic sidebar feed for the Oppgaver group.
// Supplies AticsShell with pinned templates grouped by admin-defined
// categories. Mirrors useComplianceNav / useSurveyNav exactly.
//
// Read-only. Two queries: pinned org_templates + categories.
// Mutations are in TasksAdminPage (activate/pin).

import { useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'

export type TaskPinnedNavItem = {
  templateId: string
  templateSlug: string
  name: string
  /** Category id, null = uncategorised */
  categoryId: string | null
  /** Stable key for sidebar header grouping */
  headerKey: string
  /** Full path including ?template= */
  to: string
}

export type TaskNavCategory = {
  id: string
  name: string
  position: number
  regulationId?: string
}

export type UseTaskNavReturn = {
  loading: boolean
  items: TaskPinnedNavItem[]
  categories: TaskNavCategory[]
}

type PinnedRow = {
  id: string
  slug: string
  name: string
  category_id: string | null
}

type CategoryRow = {
  id: string
  name: string
  position: number
  regulation_id: string | null
}

export function useTaskNav(): UseTaskNavReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [pinned, setPinned] = useState<PinnedRow[]>([])
  const [categoryRows, setCategoryRows] = useState<CategoryRow[]>([])
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase || !orgId) return
    let cancelled = false
    void Promise.all([
      supabase
        .from('task_template_catalog')
        .select('id, slug, name, category_id:task_org_templates!inner(category_id)')
        .eq('task_org_templates.organization_id', orgId)
        .eq('task_org_templates.nav_pinned', true)
        .eq('task_org_templates.is_active', true)
        .is('task_org_templates.deleted_at', null)
        .eq('is_active', true)
        .order('name', { ascending: true }),
      supabase
        .from('task_template_categories')
        .select('id, name, position, regulation_id')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('position', { ascending: true })
        .order('name', { ascending: true }),
    ]).then(([tplRes, catRes]) => {
      if (cancelled) return
      // Supabase join flattens category_id — unwrap from the nested object
      const rows = (tplRes.data ?? []).map((r) => {
        const raw = r as Record<string, unknown>
        const join = raw.category_id as { category_id: string | null } | null
        return {
          id: String(raw.id),
          slug: String(raw.slug ?? ''),
          name: String(raw.name ?? ''),
          category_id: join?.category_id ?? null,
        }
      })
      setPinned(tplRes.error ? [] : rows)
      setCategoryRows(catRes.error ? [] : ((catRes.data ?? []) as CategoryRow[]))
      setFetchedFor(orgId)
    })
    return () => { cancelled = true }
  }, [supabase, orgId])

  const loading = orgId !== null && orgId !== fetchedFor

  const items = useMemo<TaskPinnedNavItem[]>(() =>
    pinned.map((t) => ({
      templateId: t.id,
      templateSlug: t.slug,
      name: t.name,
      categoryId: t.category_id,
      headerKey: t.category_id ?? '__uncat__',
      to: `/tasks/management?template=${encodeURIComponent(t.slug)}`,
    }))
  , [pinned])

  const categories = useMemo<TaskNavCategory[]>(() =>
    categoryRows.map((c) => ({
      id: c.id,
      name: c.name,
      position: c.position,
      regulationId: c.regulation_id ?? undefined,
    }))
  , [categoryRows])

  return { loading, items, categories }
}
