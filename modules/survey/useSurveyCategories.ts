// Survey template categories hook — admin CRUD for survey_template_categories.
// Mirrors useChecklistModule's category surface so the same admin tab UX
// works for both modules. Read + create + update + soft-delete.
//
// One hook instance per consumer. Both the admin Kategorier tab and the
// org-template editor (where admins assign category_id to a template) use
// it; the SurveyHubLanding + the sidebar nav read the rows via a separate
// lighter-weight fetcher to avoid coupling to the admin's mutation state.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import {
  SurveyCategoryRowSchema,
  type SurveyCategoryRow,
  type SurveyPackSlug,
} from './types'

type Input = { supabase: SupabaseClient | null }

export type UseSurveyCategoriesReturn = {
  loading: boolean
  error: string | null
  categories: SurveyCategoryRow[]
  refresh: () => Promise<void>

  createCategory: (payload: {
    pack: SurveyPackSlug
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

export function useSurveyCategories(input: Input): UseSurveyCategoriesReturn {
  const { supabase } = input
  const { organization, isAdmin, can } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const canManage = isAdmin || can('survey.manage')

  const [categories, setCategories] = useState<SurveyCategoryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: selErr } = await supabase
        .from('survey_template_categories')
        .select('*')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .order('pack', { ascending: true })
        .order('position', { ascending: true })
        .order('name', { ascending: true })
      if (selErr) throw selErr
      const ok: SurveyCategoryRow[] = []
      for (const row of data ?? []) {
        const parsed = SurveyCategoryRowSchema.safeParse(row)
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
      pack: SurveyPackSlug
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
          .from('survey_template_categories')
          .insert({
            pack: payload.pack,
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
        const parsed = SurveyCategoryRowSchema.safeParse(data)
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
          .from('survey_template_categories')
          .update(update)
          .eq('id', payload.categoryId)
          .eq('organization_id', orgId)
          .select('*')
          .single()
        if (upErr) throw upErr
        const parsed = SurveyCategoryRowSchema.safeParse(data)
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
          .from('survey_template_categories')
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
