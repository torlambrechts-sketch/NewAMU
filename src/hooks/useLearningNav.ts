// Learning nav feed — supplies the AticsShell sidebar with the
// "Læring" group's category headers + per-category course list.
// Mirrors useSurveyNav / useComplianceNav conceptually: read the
// per-org categories + the courses that reference them, expose
// a flat list of items + a category list. The shell groups them.
//
// Read-only; no mutations. Source data:
//   - learning_categories (active, not deleted) — admin-curated
//   - learning_courses (status=published) — only published courses
//     should surface in the sidebar so admins don't see drafts in
//     the cross-module shell.

import { useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'

export type LearningPinnedNavItem = {
  courseId: string
  title: string
  /** Category id, null = uncategorised. */
  categoryId: string | null
  /** Stable key linking this item to its category header in the sidebar. */
  headerKey: string
  /** Path to the published-course player. */
  to: string
}

export type LearningNavCategory = {
  id: string
  name: string
  position: number
  /** Cat 1 of the cross-module taxonomy (category-architecture §T2). */
  regulationId: string | null
}

export type UseLearningNavReturn = {
  loading: boolean
  items: LearningPinnedNavItem[]
  categories: LearningNavCategory[]
}

type CategoryRow = {
  id: string
  name: string
  position: number
  regulation_id: string | null
  is_active: boolean
}

type CourseRow = {
  id: string
  title: string
  category_id: string | null
}

export function useLearningNav(): UseLearningNavReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [categoryRows, setCategoryRows] = useState<CategoryRow[]>([])
  const [courseRows, setCourseRows] = useState<CourseRow[]>([])
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const targetKey = supabase && orgId ? orgId : null

  useEffect(() => {
    if (!supabase || !orgId) return
    let cancelled = false
    void Promise.all([
      supabase
        .from('learning_categories')
        .select('id, name, position, regulation_id, is_active')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('position', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('learning_courses')
        .select('id, title, category_id')
        .eq('organization_id', orgId)
        .eq('status', 'published')
        .order('title', { ascending: true }),
    ])
      .catch((e) => {
        if (cancelled) return null
        console.warn('useLearningNav fetch failed', e)
        setFetchedFor(orgId)
        return null
      })
      .then((res) => {
        if (!res || cancelled) return
        const [catRes, courseRes] = res
        setCategoryRows(catRes.error ? [] : ((catRes.data ?? []) as CategoryRow[]))
        setCourseRows(courseRes.error ? [] : ((courseRes.data ?? []) as CourseRow[]))
        setFetchedFor(orgId)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, orgId])

  const loading = targetKey !== null && targetKey !== fetchedFor

  const items = useMemo<LearningPinnedNavItem[]>(() => {
    return courseRows
      .map((c) => ({
        courseId: c.id,
        title: c.title,
        categoryId: c.category_id ?? null,
        headerKey: c.category_id ?? '__uncat__',
        to: `/learning/play/${encodeURIComponent(c.id)}`,
      }))
      .sort((a, b) => a.title.localeCompare(b.title, 'nb'))
  }, [courseRows])

  const categories = useMemo<LearningNavCategory[]>(() => {
    return categoryRows.map((c) => ({
      id: c.id,
      name: c.name,
      position: c.position,
      regulationId: c.regulation_id ?? null,
    }))
  }, [categoryRows])

  return { loading, items, categories }
}
