import { useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type { LearningFlowSettings } from './learningTypes'
import { getSupabaseErrorMessage } from '../../lib/supabaseError'
import type { SupabaseClient } from '@supabase/supabase-js'

export type LearningAdminDeps = {
  useSupabase: boolean
  supabase: SupabaseClient | null
  orgId: string | undefined
  canManage: boolean
  flowSettings: LearningFlowSettings | null
  refreshLearning: () => Promise<void>
  isMountedRef: MutableRefObject<boolean>
}

export function useLearningAdmin(deps: LearningAdminDeps) {
  const { useSupabase, supabase, orgId, canManage, flowSettings, refreshLearning, isMountedRef } = deps

  const saveFlowSettings = useCallback(
    async (patch: Partial<LearningFlowSettings>) => {
      if (!useSupabase || !supabase || !orgId || !canManage) {
        return { ok: false as const, error: 'Krever tilgang.' }
      }
      const base = flowSettings ?? {
        teamsWebhookUrl: null as string | null,
        slackWebhookUrl: null as string | null,
        genericWebhookUrl: null as string | null,
      }
      const row = {
        organization_id: orgId,
        teams_webhook_url: patch.teamsWebhookUrl ?? base.teamsWebhookUrl,
        slack_webhook_url: patch.slackWebhookUrl ?? base.slackWebhookUrl,
        generic_webhook_url: patch.genericWebhookUrl ?? base.genericWebhookUrl,
        updated_at: new Date().toISOString(),
      }
      const { error: e } = await supabase.from('learning_flow_settings').upsert(row, { onConflict: 'organization_id' })
      if (!isMountedRef.current) return { ok: false as const, error: 'Avbrutt.' }
      if (e) return { ok: false as const, error: getSupabaseErrorMessage(e) }
      await refreshLearning()
      return { ok: true as const }
    },
    [useSupabase, supabase, orgId, canManage, flowSettings, refreshLearning, isMountedRef],
  )

  const setSystemCourseEnabled = useCallback(
    async (systemCourseId: string, enabled: boolean) => {
      if (!useSupabase || !supabase) return { ok: false as const, error: 'Krever innlogget organisasjon.' }
      const { error: e } = await supabase.rpc('learning_set_system_course_enabled', {
        p_system_course_id: systemCourseId,
        p_enabled: enabled,
      })
      if (!isMountedRef.current) return { ok: false as const, error: 'Avbrutt.' }
      if (e) return { ok: false as const, error: getSupabaseErrorMessage(e) }
      await refreshLearning()
      return { ok: true as const }
    },
    [useSupabase, supabase, refreshLearning, isMountedRef],
  )

  return { saveFlowSettings, setSystemCourseEnabled }
}
