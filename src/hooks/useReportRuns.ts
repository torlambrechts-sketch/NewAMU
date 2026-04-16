import { useCallback, useMemo, useState } from 'react'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import { useOrgSetupContext } from './useOrgSetupContext'

export type ReportRunRow = {
  id: string
  organization_id: string
  user_id: string
  run_at: string
  kind: 'standard' | 'custom'
  standard_report_id: string | null
  custom_template_id: string | null
  title: string
  report_year: number | null
  meta: Record<string, unknown>
}

export type LogReportRunInput = {
  kind: 'standard' | 'custom'
  title: string
  reportYear?: number
  standardReportId?: string
  customTemplateId?: string
  meta?: Record<string, unknown>
}

export function useReportRuns() {
  const { supabase, organization, user } = useOrgSetupContext()
  const orgId = organization?.id
  const uid = user?.id
  const enabled = !!(supabase && orgId && uid)

  const [runs, setRuns] = useState<ReportRunRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('report_runs')
        .select('*')
        .eq('organization_id', orgId)
        .order('run_at', { ascending: false })
        .limit(80)
      if (e) throw e
      setRuns((data ?? []) as ReportRunRow[])
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
      setRuns([])
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId])

  const logRun = useCallback(
    async (input: LogReportRunInput): Promise<boolean> => {
      if (!supabase || !orgId || !uid) return false
      setError(null)
      try {
        const meta: Record<string, unknown> = { ...(input.meta ?? {}) }
        const row = {
          organization_id: orgId,
          user_id: uid,
          kind: input.kind,
          title: input.title,
          report_year: input.reportYear ?? null,
          standard_report_id: input.standardReportId ?? null,
          custom_template_id: input.customTemplateId ?? null,
          meta,
        }
        const { error: e } = await supabase.from('report_runs').insert(row)
        if (e) throw e
        return true
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return false
      }
    },
    [supabase, orgId, uid],
  )

  return useMemo(
    () => ({
      runs,
      loading,
      error,
      enabled,
      refresh,
      logRun,
    }),
    [runs, loading, error, enabled, refresh, logRun],
  )
}
