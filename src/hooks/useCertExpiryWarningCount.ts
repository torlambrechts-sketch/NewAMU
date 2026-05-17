// useCertExpiryWarningCount — sidebar badge feed for the cert-rotation
// sub-link under Admin > Integrasjoner.
//
// Counts org_integrations rows whose signing_cert_expires_at is within
// 30 days from now (or already expired) — driving the red pip on
// "Sertifikat-rotasjon". Polls every 5 minutes; cert expiries don't
// change that often and the trigger in _123700 emits the workflow event
// asynchronously, so a slow poll keeps the badge accurate without a
// realtime channel.

import { useCallback, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import { useIntervalWhenVisible } from './useIntervalWhenVisible'

const POLL_INTERVAL_MS = 5 * 60_000
const WARN_WINDOW_DAYS = 30

export function useCertExpiryWarningCount() {
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
      const threshold = new Date(Date.now() + WARN_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const { count: c, error } = await supabase
        .from('org_integrations')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organization.id)
        .not('signing_cert_expires_at', 'is', null)
        .lte('signing_cert_expires_at', threshold)
      if (error) throw error
      setCount(typeof c === 'number' ? c : 0)
    } catch {
      // Don't surface — keep the last-known value (or 0). Column may not
      // exist in dev DBs that haven't applied _123700 yet.
    } finally {
      setLoading(false)
    }
  }, [supabase, organization?.id])

  useIntervalWhenVisible(() => {
    void refresh()
  }, POLL_INTERVAL_MS)

  return { count, loading, refresh }
}
