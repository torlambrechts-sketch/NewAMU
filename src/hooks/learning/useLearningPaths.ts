import { useCallback } from 'react'
import type { MutableRefObject } from 'react'
import { getSupabaseErrorMessage } from '../../lib/supabaseError'
import type { SupabaseClient } from '@supabase/supabase-js'

export type LearningPathsDeps = {
  useSupabase: boolean
  supabase: SupabaseClient | null
  orgId: string | undefined
  canManage: boolean
  refreshLearning: () => Promise<void>
  isMountedRef: MutableRefObject<boolean>
}

export function useLearningPaths(deps: LearningPathsDeps) {
  const { useSupabase, supabase, orgId, canManage, refreshLearning, isMountedRef } = deps

  const saveLearningPath = useCallback(
    async (input: {
      id?: string
      name: string
      slug: string
      description: string
      courseIds: string[]
      rules: { metadataKey: string; expectedValue: unknown }[]
    }) => {
      if (!useSupabase || !supabase || !orgId || !canManage) return { ok: false as const, error: 'Krever tilgang.' }
      const slug = input.slug.trim().toLowerCase().replace(/\s+/g, '-')
      let pathId = input.id
      if (!pathId) {
        const { data: ins, error: ie } = await supabase
          .from('learning_paths')
          .insert({
            organization_id: orgId,
            name: input.name.trim(),
            slug,
            description: input.description.trim(),
          })
          .select('id')
          .single()
        if (!isMountedRef.current) return { ok: false as const, error: 'Avbrutt.' }
        if (ie) return { ok: false as const, error: getSupabaseErrorMessage(ie) }
        pathId = (ins as { id: string }).id
      } else {
        const { error: ue } = await supabase
          .from('learning_paths')
          .update({
            name: input.name.trim(),
            slug,
            description: input.description.trim(),
          })
          .eq('id', pathId)
          .eq('organization_id', orgId)
        if (!isMountedRef.current) return { ok: false as const, error: 'Avbrutt.' }
        if (ue) return { ok: false as const, error: getSupabaseErrorMessage(ue) }
        await supabase.from('learning_path_courses').delete().eq('path_id', pathId)
        await supabase.from('learning_path_rules').delete().eq('path_id', pathId)
      }
      const courseRows = input.courseIds.map((course_id, sort_order) => ({
        path_id: pathId!,
        course_id,
        sort_order,
      }))
      if (courseRows.length) {
        const { error: ce } = await supabase.from('learning_path_courses').insert(courseRows)
        if (!isMountedRef.current) return { ok: false as const, error: 'Avbrutt.' }
        if (ce) return { ok: false as const, error: getSupabaseErrorMessage(ce) }
      }
      const ruleRows = input.rules.map((r) => ({
        path_id: pathId!,
        metadata_key: r.metadataKey,
        expected_value: r.expectedValue as never,
      }))
      if (ruleRows.length) {
        const { error: re } = await supabase.from('learning_path_rules').insert(ruleRows)
        if (!isMountedRef.current) return { ok: false as const, error: 'Avbrutt.' }
        if (re) return { ok: false as const, error: getSupabaseErrorMessage(re) }
      }
      const { error: rpcErr } = await supabase.rpc('learning_refresh_path_enrollments_for_user')
      if (rpcErr) console.warn('learning_refresh_path_enrollments_for_user', rpcErr.message)
      if (!isMountedRef.current) return { ok: false as const, error: 'Avbrutt.' }
      await refreshLearning()
      return { ok: true as const, pathId: pathId! }
    },
    [useSupabase, supabase, orgId, canManage, refreshLearning, isMountedRef],
  )

  const deleteLearningPath = useCallback(
    async (pathId: string) => {
      if (!useSupabase || !supabase || !orgId || !canManage) return { ok: false as const, error: 'Krever tilgang.' }
      const { error: e } = await supabase.from('learning_paths').delete().eq('id', pathId).eq('organization_id', orgId)
      if (!isMountedRef.current) return { ok: false as const, error: 'Avbrutt.' }
      if (e) return { ok: false as const, error: getSupabaseErrorMessage(e) }
      await refreshLearning()
      return { ok: true as const }
    },
    [useSupabase, supabase, orgId, canManage, refreshLearning, isMountedRef],
  )

  return { saveLearningPath, deleteLearningPath }
}
