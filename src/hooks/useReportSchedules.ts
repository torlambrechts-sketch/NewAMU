import { useCallback, useMemo, useState } from 'react'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import { useOrgSetupContext } from './useOrgSetupContext'

export type ReportScheduleRow = {
  id: string
  organization_id: string
  report_definition_id: string
  title: string
  cron_expr: string
  timezone: string
  enabled: boolean
  channel: 'email' | 'webhook'
  created_at: string
  updated_at: string
}

export type ReportScheduleInput = {
  report_definition_id: string
  title?: string
  cron_expr?: string
  timezone?: string
  enabled?: boolean
  channel?: 'email' | 'webhook'
}

export type ReportSchedulePatch = {
  title?: string
  cron_expr?: string
  timezone?: string
  enabled?: boolean
  channel?: 'email' | 'webhook'
}

export function useReportSchedules() {
  const { supabase, organization, user } = useOrgSetupContext()
  const orgId = organization?.id
  const uid = user?.id
  const enabled = !!(supabase && orgId && uid)

  const [schedules, setSchedules] = useState<ReportScheduleRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('report_schedules')
        .select('*')
        .eq('organization_id', orgId)
        .order('updated_at', { ascending: false })
      if (e) throw e
      setSchedules((data ?? []) as ReportScheduleRow[])
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
      setSchedules([])
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId])

  const createSchedule = useCallback(
    async (input: ReportScheduleInput): Promise<ReportScheduleRow | null> => {
      if (!supabase || !orgId || !uid) return null
      setError(null)
      try {
        const row = {
          organization_id: orgId,
          report_definition_id: input.report_definition_id,
          title: (input.title ?? '').trim() || 'Uten tittel',
          cron_expr: input.cron_expr ?? '0 8 1 * *',
          timezone: input.timezone ?? 'Europe/Oslo',
          enabled: input.enabled ?? false,
          channel: input.channel ?? 'email',
          created_by: uid,
        }
        const { data, error: e } = await supabase.from('report_schedules').insert(row).select('*').single()
        if (e) throw e
        const created = data as ReportScheduleRow
        setSchedules((prev) => [created, ...prev])
        return created
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, orgId, uid],
  )

  const updateSchedule = useCallback(
    async (id: string, patch: ReportSchedulePatch): Promise<boolean> => {
      if (!supabase || !orgId) return false
      setError(null)
      const body: Record<string, unknown> = {}
      if (patch.title !== undefined) body.title = patch.title
      if (patch.cron_expr !== undefined) body.cron_expr = patch.cron_expr
      if (patch.timezone !== undefined) body.timezone = patch.timezone
      if (patch.enabled !== undefined) body.enabled = patch.enabled
      if (patch.channel !== undefined) body.channel = patch.channel
      if (Object.keys(body).length === 0) return true
      try {
        const { data, error: e } = await supabase
          .from('report_schedules')
          .update(body)
          .eq('id', id)
          .eq('organization_id', orgId)
          .select('*')
          .single()
        if (e) throw e
        const next = data as ReportScheduleRow
        setSchedules((prev) => prev.map((s) => (s.id === id ? next : s)))
        return true
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return false
      }
    },
    [supabase, orgId],
  )

  const deleteSchedule = useCallback(
    async (id: string): Promise<boolean> => {
      if (!supabase || !orgId) return false
      setError(null)
      try {
        const { error: e } = await supabase.from('report_schedules').delete().eq('id', id).eq('organization_id', orgId)
        if (e) throw e
        setSchedules((prev) => prev.filter((s) => s.id !== id))
        return true
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return false
      }
    },
    [supabase, orgId],
  )

  return useMemo(
    () => ({
      schedules,
      loading,
      error,
      enabled,
      refresh,
      createSchedule,
      updateSchedule,
      deleteSchedule,
    }),
    [schedules, loading, error, enabled, refresh, createSchedule, updateSchedule, deleteSchedule],
  )
}
