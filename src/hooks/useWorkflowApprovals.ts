// Hooks for the approver inbox: list pending approvals + decide them
// via the workflow_decide_approval RPC.

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import { withTimeout } from '../lib/withTimeout'
import type { WorkflowApprovalRow } from '../types/workflow'

const TIMEOUT_MS = 15_000

export function useWorkflowApprovals(filter: { status?: WorkflowApprovalRow['status'] } = {}) {
  const { supabase, organization, profile } = useOrgSetupContext()
  const orgId = organization?.id
  const userId = profile?.id

  const [approvals, setApprovals] = useState<WorkflowApprovalRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('workflow_approvals')
        .select('*')
        .eq('organization_id', orgId)
        .order('requested_at', { ascending: false })
        .limit(100)
      if (filter.status) {
        query = query.eq('status', filter.status)
      }
      const { data, error: e } = await withTimeout(
        query,
        TIMEOUT_MS,
        'workflow_approvals select',
      )
      if (e) throw e
      setApprovals((data ?? []) as WorkflowApprovalRow[])
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId, filter.status])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const decide = useCallback(
    async (approvalId: string, decision: 'approved' | 'rejected', note?: string) => {
      if (!supabase) return { ok: false as const, error: 'No supabase client' }
      try {
        const { error: e } = await supabase.rpc('workflow_decide_approval', {
          p_approval_id: approvalId,
          p_decision: decision,
          p_note: note ?? null,
        })
        if (e) throw e
        await refresh()
        return { ok: true as const }
      } catch (err) {
        const msg = getSupabaseErrorMessage(err)
        setError(msg)
        return { ok: false as const, error: msg }
      }
    },
    [supabase, refresh],
  )

  return { approvals, loading, error, refresh, decide, userId }
}
