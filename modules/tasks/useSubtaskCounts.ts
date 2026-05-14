// useSubtaskCounts — single aggregated query returning done/total subtask counts
// for every task_item in the org. Used to drive progress bars on the overview
// without fetching full subtask rows for every visible card.

import { useEffect, useState } from 'react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'

export type SubtaskCount = { done: number; total: number }

export function useSubtaskCounts(): Map<string, SubtaskCount> {
  const { supabase, organization } = useOrgSetupContext()
  const [counts, setCounts] = useState(new Map<string, SubtaskCount>())

  useEffect(() => {
    if (!supabase || !organization?.id) return
    void supabase
      .from('task_subtasks')
      .select('task_item_id, is_done')
      .eq('organization_id', organization.id)
      .is('deleted_at', null)
      .then(({ data }) => {
        if (!data) return
        const m = new Map<string, SubtaskCount>()
        for (const r of data) {
          const id = String(r.task_item_id)
          const prev = m.get(id) ?? { done: 0, total: 0 }
          m.set(id, { done: prev.done + (r.is_done ? 1 : 0), total: prev.total + 1 })
        }
        setCounts(m)
      })
  }, [supabase, organization?.id])

  return counts
}
