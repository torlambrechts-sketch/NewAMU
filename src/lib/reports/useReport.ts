// useReport — orchestrator hook for the reporting surface.
//
// Thin wrapper around useDashboardLayout with `kindFilter: 'report'` plus
// share-URL convenience. The publish/republish/unpublish/regenerateShareToken
// action methods live on the underlying hook because they operate on the
// currently active row regardless of kind — useReport just types the
// surface so callers don't see dashboard-only concepts like `markActiveDefault`.

import { useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useDashboardLayout } from '../dashboards/useDashboardLayout'

export function useReport({
  supabase,
  scopeId,
}: {
  supabase: SupabaseClient | null
  scopeId: string
}) {
  const dashboard = useDashboardLayout({ supabase, scopeId, kindFilter: 'report' })

  /**
   * Build a /r/<token> URL for the active report's share token. Returns
   * null when the report isn't published or has no token. The caller
   * passes `origin` from `window.location.origin` so this hook stays
   * SSR-safe.
   */
  const getShareUrl = useCallback(
    (origin: string): string | null => {
      const token = dashboard.row?.share_token
      if (!token) return null
      return `${origin.replace(/\/$/, '')}/r/${token}`
    },
    [dashboard.row?.share_token],
  )

  return {
    ...dashboard,
    getShareUrl,
  }
}
