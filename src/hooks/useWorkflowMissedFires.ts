// Missed-fire revisor surface: reads workflow_missed_fire_log + the related
// workflow_dispatch_events payload so the UI can show a "should have fired
// but didn't" condition trace and let HMS-leder triage each occurrence.
//
// Backed by migration _20260907127900 (workflow_missed_fire_revisor.sql).
// The nightly pg_cron job writes rows; the UI reads them + lets users with
// workflows.activate update triage_status / triaged_by / triaged_at /
// triage_note (the BEFORE UPDATE trigger denies edits to anything else).

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import { withTimeout } from '../lib/withTimeout'
import type {
  WorkflowDispatchEventRow,
  WorkflowMissedFireLogRow,
  WorkflowMissedFireTriageStatus,
} from '../types/workflow'

const TIMEOUT_MS = 20_000
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export function useWorkflowMissedFires() {
  const { supabase, organization, profile, can, isAdmin } = useOrgSetupContext()
  const orgId = organization?.id
  const isOrgAdminProfile = profile?.is_org_admin === true
  const canTriage =
    isOrgAdminProfile ||
    isAdmin ||
    can('workflows.manage') ||
    can('workflows.activate')

  const [rows, setRows] = useState<WorkflowMissedFireLogRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const since = new Date(Date.now() - SEVEN_DAYS_MS).toISOString()
      const { data, error: e } = await withTimeout(
        supabase
          .from('workflow_missed_fire_log')
          .select('*')
          .eq('organization_id', orgId)
          .gte('expected_fire_at', since)
          .order('expected_fire_at', { ascending: false })
          .limit(200),
        TIMEOUT_MS,
        'workflow_missed_fire_log select',
      )
      if (e) throw e
      setRows((data ?? []) as WorkflowMissedFireLogRow[])
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const setTriage = useCallback(
    async (
      id: string,
      status: WorkflowMissedFireTriageStatus,
      note?: string,
    ) => {
      if (!supabase || !canTriage) return { ok: false as const }
      try {
        const { error: e } = await supabase
          .from('workflow_missed_fire_log')
          .update({
            triage_status: status,
            triaged_at: new Date().toISOString(),
            triaged_by: profile?.id ?? null,
            triage_note: note ?? null,
          })
          .eq('id', id)
        if (e) throw e
        await refresh()
        return { ok: true as const }
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return { ok: false as const }
      }
    },
    [supabase, canTriage, profile?.id, refresh],
  )

  return { rows, loading, error, refresh, canTriage, setTriage }
}

/**
 * Loads the workflow_dispatch_events row backing a missed-fire entry, so
 * the slide-panel can show the original payload alongside the condition
 * trace.
 */
export function useWorkflowDispatchEvent(eventId: string | null) {
  const { supabase } = useOrgSetupContext()
  const [event, setEvent] = useState<WorkflowDispatchEventRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!supabase || !eventId) {
      setEvent(null)
      return
    }
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const { data, error: e } = await withTimeout(
          supabase
            .from('workflow_dispatch_events')
            .select('*')
            .eq('id', eventId)
            .maybeSingle(),
          TIMEOUT_MS,
          'workflow_dispatch_events detail',
        )
        if (e) throw e
        if (!cancelled) setEvent((data as WorkflowDispatchEventRow | null) ?? null)
      } catch (err) {
        if (!cancelled) setError(getSupabaseErrorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, eventId])

  return { event, loading, error }
}
