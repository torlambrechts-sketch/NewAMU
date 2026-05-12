// Batch-leser av alle wizard-runs for aktiv bruker i aktiv org.
// Brukes av Compliance Studio til å vise status-pille per kort.

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import type { WizardRunRow } from '../../../hooks/useWizardRun'

export function useAllWizardRuns() {
  const { supabase, organization, user } = useOrgSetupContext()
  const [runs, setRuns] = useState<Record<string, WizardRunRow>>({})
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!supabase || !organization?.id || !user?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('compliance_wizard_runs')
      .select('*')
      .eq('organization_id', organization.id)
      .eq('user_id', user.id)
    if (error) {
      console.warn('useAllWizardRuns:', error.message)
      setLoading(false)
      return
    }
    const next: Record<string, WizardRunRow> = {}
    for (const row of (data ?? []) as WizardRunRow[]) {
      next[row.wizard_key] = row
    }
    setRuns(next)
    setLoading(false)
  }, [supabase, organization?.id, user?.id])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { runs, loading, refetch }
}
