// Per-run hook: loads input/output snapshots + evidence artefacts + revision
// history for a workflow_runs row. Respects confidentiality_level via RLS.

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import { withTimeout } from '../lib/withTimeout'
import type { WorkflowRunRow, WorkflowRunEvidenceRow } from '../types/workflow'

const TIMEOUT_MS = 20_000

export function useWorkflowRunDetail(runId: string | null) {
  const { supabase } = useOrgSetupContext()
  const [run, setRun] = useState<WorkflowRunRow | null>(null)
  const [evidence, setEvidence] = useState<WorkflowRunEvidenceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !runId) {
      setRun(null)
      setEvidence([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [{ data: r, error: er }, { data: ev, error: ee }] = await Promise.all([
        withTimeout(
          supabase.from('workflow_runs').select('*').eq('id', runId).maybeSingle(),
          TIMEOUT_MS,
          'workflow_runs detail',
        ),
        withTimeout(
          supabase
            .from('workflow_run_evidence')
            .select('*')
            .eq('run_id', runId)
            .order('created_at', { ascending: true }),
          TIMEOUT_MS,
          'workflow_run_evidence',
        ),
      ])
      if (er) throw er
      if (ee) throw ee
      setRun((r as WorkflowRunRow | null) ?? null)
      setEvidence((ev ?? []) as WorkflowRunEvidenceRow[])
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [supabase, runId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { run, evidence, loading, error, refresh }
}
