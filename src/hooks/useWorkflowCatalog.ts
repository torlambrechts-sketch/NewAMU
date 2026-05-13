// Reads workflow_rule_catalog (system templates) + provides install RPC.
// Mirrors useDocumentTemplates / useSurveyCatalog pattern.

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import { withTimeout } from '../lib/withTimeout'
import type { WorkflowRuleCatalogRow } from '../types/workflow'

const TIMEOUT_MS = 20_000

export function useWorkflowCatalog() {
  const { supabase } = useOrgSetupContext()
  const [catalog, setCatalog] = useState<WorkflowRuleCatalogRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await withTimeout(
        supabase
          .from('workflow_rule_catalog')
          .select('*')
          .eq('is_published', true)
          .order('scope_id')
          .order('slug'),
        TIMEOUT_MS,
        'workflow_rule_catalog select',
      )
      if (e) throw e
      setCatalog((data ?? []) as WorkflowRuleCatalogRow[])
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { catalog, loading, error, refresh }
}
