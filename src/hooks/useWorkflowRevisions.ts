// Per-rule revision history. Reads workflow_rule_revisions (trigger-fed
// audit log from migration _20260905120300).

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import { withTimeout } from '../lib/withTimeout'
import type { WorkflowRuleRevisionRow } from '../types/workflow'

const TIMEOUT_MS = 15_000

export function useWorkflowRevisions(ruleId: string | null) {
  const { supabase } = useOrgSetupContext()
  const [revisions, setRevisions] = useState<WorkflowRuleRevisionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !ruleId) {
      setRevisions([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await withTimeout(
        supabase
          .from('workflow_rule_revisions')
          .select('*')
          .eq('rule_id', ruleId)
          .order('changed_at', { ascending: false })
          .limit(50),
        TIMEOUT_MS,
        'workflow_rule_revisions',
      )
      if (e) throw e
      setRevisions((data ?? []) as WorkflowRuleRevisionRow[])
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [supabase, ruleId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { revisions, loading, error, refresh }
}
