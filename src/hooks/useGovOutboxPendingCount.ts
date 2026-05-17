// useGovOutboxPendingCount — sidebar badge feed.
//
// Counts rows in gov_notifications_outbox that are sitting in the
// awaiting_human queue for the current org. Polls every 60s so the
// nav badge stays roughly fresh without a websocket subscription.
//
// We deliberately don't use realtime here — the manual-triage queue
// is low-volume and we don't want to keep an open channel from every
// admin browser. A 60s poll is cheap (RLS-scoped count, head:true).

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'

const POLL_INTERVAL_MS = 60_000

export function useGovOutboxPendingCount() {
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
        .from('gov_notifications_outbox')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organization.id)
        .is('resolved_at', null)
        .filter('payload->>status', 'eq', 'awaiting_human')
      if (error) throw error
      setCount(typeof c === 'number' ? c : 0)
    } catch {
      // Don't surface — sidebar badge stays at last-known value (or 0).
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
