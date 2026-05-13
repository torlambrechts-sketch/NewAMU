// useWorkflowSystemRules — reads workflow_system_rules.
//
// System rules are platform-owned, non-optional rules required for
// AML / IK-f / GDPR compliance. They run for every org automatically
// (dispatched by workflow_dispatch_db_event in addition to per-org
// workflow_rules). The System tab shows them read-only.

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import { withTimeout } from '../lib/withTimeout'

const TIMEOUT_MS = 15_000

export type WorkflowSystemRuleRow = {
  id: string
  slug: string
  framework: string
  category: string
  category_order: number
  subcategory: string
  name: string | null
  description: string
  rationale: string
  source_module: string
  trigger_type: string
  trigger_event_name: string | null
  schedule_cron: string | null
  trigger_on: 'insert' | 'update' | 'both'
  condition_json: Record<string, unknown>
  actions_json: unknown[]
  law_refs: string[]
  frameworks: string[]
  pdca_phase: 'plan' | 'do' | 'check' | 'act' | null
  applies_if_employee_count_gte: number | null
  enabled: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export function useWorkflowSystemRules() {
  const { supabase } = useOrgSetupContext()
  const [rules, setRules] = useState<WorkflowSystemRuleRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await withTimeout(
        supabase
          .from('workflow_system_rules')
          .select('*')
          .order('framework')
          .order('category_order')
          .order('subcategory'),
        TIMEOUT_MS,
        'workflow_system_rules select',
      )
      if (e) throw e
      setRules((data ?? []) as WorkflowSystemRuleRow[])
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { rules, loading, error, refresh }
}
