// useAmuAgendaBacklogCount — sidebar badge feed for "Agenda-restanser".
//
// Counts rows in amu_agenda_backlog that are still in the queue
// (drained_at IS NULL) for the current org. Mirrors
// useGovOutboxPendingCount: 60s polling so the badge stays roughly
// fresh without holding open a realtime channel from every admin
// browser. RLS already scopes the count to the active org.

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'

const POLL_INTERVAL_MS = 60_000

export function useAmuAgendaBacklogCount() {
  const { supabase, organization } = useOrgSetupContext()
  const [count, setCount] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)

  const refresh = useCallback(async () => {
    if (!supabase || !organization?.id) {
      setCount(0)
      setLoading(false)
      return
    }
    try {
      const { count: c, error } = await supabase
        .from('amu_agenda_backlog')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organization.id)
        .is('drained_at', null)
      if (error) throw error
      setCount(typeof c === 'number' ? c : 0)
    } catch {
      // Stay quiet — the badge tolerates stale-or-zero on transient errors.
    } finally {
      setLoading(false)
    }
  }, [supabase, organization?.id])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => {
      void refresh()
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [refresh])

  return { count, loading, refresh }
}
