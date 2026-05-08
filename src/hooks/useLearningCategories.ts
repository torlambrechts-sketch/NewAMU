// Per-org learning category CRUD. Mirrors useSurveyCategories /
// useChecklistModule's category surface so the admin tab UX is the
// same across all three modules.
//
// Categories are pure metadata — no provisioning of courses on category
// create. Courses get `category_id` set via the course-builder UI or
// a bulk-assign action in the admin.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useOrgSetupContext } from './useOrgSetupContext'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import type { LearningCategory } from '../types/learning'

const LearningCategoryRowSchema: z.ZodType<LearningCategory> = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  position: z.number().int().default(0),
  is_active: z.boolean().default(true),
  is_system: z.boolean().default(false),
  regulation_id: z.string().nullable().optional(),
})

type Input = { supabase: SupabaseClient | null }

export type UseLearningCategoriesReturn = {
  loading: boolean
  error: string | null
  categories: LearningCategory[]
  refresh: () => Promise<void>

  createCategory: (payload: {
    slug: string
    name: string
    description?: string | null
    position?: number
  }) => Promise<string | null>

  updateCategory: (payload: {
    categoryId: string
    name?: string
    description?: string | null
    position?: number
    is_active?: boolean
  }) => Promise<void>

  /** Soft delete (deleted_at + is_active=false). System rows are blocked client-side. */
  softDeleteCategory: (categoryId: string) => Promise<void>
}

export function useLearningCategories(input: Input): UseLearningCategoriesReturn {
  const { supabase } = input
  const { organization, isAdmin, can } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const canManage = isAdmin || can('learning.manage')

  const [categories, setCategories] = useState<LearningCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: selErr } = await supabase
        .from('learning_categories')
        .select('*')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .order('position', { ascending: true })
        .order('name', { ascending: true })
      if (selErr) throw selErr
      const ok: LearningCategory[] = []
      for (const row of data ?? []) {
        const parsed = LearningCategoryRowSchema.safeParse(row)
        if (parsed.success) ok.push(parsed.data)
      }
      setCategories(ok)
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createCategory = useCallback(
    async (payload: {
      slug: string
      name: string
      description?: string | null
      position?: number
    }): Promise<string | null> => {
      if (!supabase || !orgId) return null
      if (!canManage) {
        setError('Du har ikke tilgang til å opprette kategorier.')
        return null
      }
      setError(null)
      try {
        const { data, error: insErr } = await supabase
          .from('learning_categories')
          .insert({
            slug: payload.slug,
            name: payload.name,
            description: payload.description ?? null,
            position: payload.position ?? 100,
            is_active: true,
            is_system: false,
          })
          .select('*')
          .single()
        if (insErr) throw insErr
        const parsed = LearningCategoryRowSchema.safeParse(data)
        if (parsed.success) {
          setCategories((prev) => [...prev, parsed.data])
          return parsed.data.id
        }
        return null
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, orgId, canManage],
  )

  const updateCategory = useCallback(
    async (payload: {
      categoryId: string
      name?: string
      description?: string | null
      position?: number
      is_active?: boolean
    }): Promise<void> => {
      if (!supabase || !orgId) return
      if (!canManage) {
        setError('Du har ikke tilgang til å redigere kategorier.')
        return
      }
      setError(null)

      const update: Record<string, unknown> = {}
      if (payload.name !== undefined) update.name = payload.name
      if (payload.description !== undefined) update.description = payload.description
      if (payload.position !== undefined) update.position = payload.position
      if (payload.is_active !== undefined) update.is_active = payload.is_active
      if (Object.keys(update).length === 0) return

      try {
        const { data, error: upErr } = await supabase
          .from('learning_categories')
          .update(update)
          .eq('id', payload.categoryId)
          .eq('organization_id', orgId)
          .select('*')
          .single()
        if (upErr) throw upErr
        const parsed = LearningCategoryRowSchema.safeParse(data)
        if (parsed.success) {
          setCategories((prev) =>
            prev.map((c) => (c.id === parsed.data.id ? parsed.data : c)),
          )
        }
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
      }
    },
    [supabase, orgId, canManage],
  )

  const softDeleteCategory = useCallback(
    async (categoryId: string): Promise<void> => {
      if (!supabase || !orgId) return
      if (!canManage) {
        setError('Du har ikke tilgang til å slette kategorier.')
        return
      }
      setError(null)
      try {
        const { error: upErr } = await supabase
          .from('learning_categories')
          .update({ deleted_at: new Date().toISOString(), is_active: false })
          .eq('id', categoryId)
          .eq('organization_id', orgId)
        if (upErr) throw upErr
        setCategories((prev) => prev.filter((c) => c.id !== categoryId))
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
      }
    },
    [supabase, orgId, canManage],
  )

  return useMemo(
    () => ({
      loading,
      error,
      categories,
      refresh,
      createCategory,
      updateCategory,
      softDeleteCategory,
    }),
    [loading, error, categories, refresh, createCategory, updateCategory, softDeleteCategory],
  )
}
