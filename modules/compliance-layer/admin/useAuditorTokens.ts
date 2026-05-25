// useAuditorTokens — list + revoke active auditor share-tokens for the org.
//
// Reads directly from `compliance_auditor_tokens` with an explicit safe
// column projection. Migration 20260926140000 added:
//   - generated stored columns `token_prefix` + `token_suffix` (the only
//     parts of the bearer secret that ever ship to the client)
//   - column-level GRANT to authenticated for the 10 safe columns
//   - DENY on the full `token` column (postgres rejects any SELECT that
//     projects it — including ad-hoc `select * from ...`)
// This eliminates exposure via Sentry/Datadog fetch auto-instrumentation,
// browser extensions, and console interception.
//
// Revoke goes through `revoke_compliance_auditor_token_by_id(p_id uuid)`
// — the opaque id, not the full bearer string.
//
// Lives in `modules/compliance-layer/admin/` because the controls page
// is the primary consumer, but the hook is framework-agnostic — the
// internkontroll surface also calls it with `frameworkFilter` to scope
// the list to its own tokens.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../../src/lib/supabaseError'

/**
 * Row shape from `compliance_auditor_tokens_safe`. Note `token_prefix`
 * + `token_suffix` instead of the full `token` — the bearer secret is
 * intentionally absent from this projection.
 */
export type AuditorTokenRow = {
  id: string
  organization_id: string
  framework_id: string
  scope_label: string
  token_prefix: string
  token_suffix: string
  created_by: string | null
  created_at: string
  expires_at: string
  revoked_at: string | null
}

export type UseAuditorTokensInput = {
  /** Optional filter: only return tokens with this framework_id (e.g. 'controls'). */
  frameworkFilter?: string | null
}

export type UseAuditorTokensReturn = {
  loading: boolean
  error: string | null
  /** All non-revoked, non-expired tokens for the org, newest first. */
  tokens: AuditorTokenRow[]
  refresh: () => Promise<void>
  /**
   * Revoke a token by its opaque id. Returns true on success, false
   * when the row didn't update (already revoked, expired, or wrong
   * org). Both outcomes trigger a refresh so the UI re-syncs.
   */
  revoke: (id: string) => Promise<boolean>
}

type LoadedState = {
  orgId: string
  rows: AuditorTokenRow[]
  error: string | null
}

export function useAuditorTokens(
  input: UseAuditorTokensInput = {},
): UseAuditorTokensReturn {
  const { frameworkFilter = null } = input
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  // Single state slot keyed by orgId — when orgId changes, lookups
  // return empty until the new fetch lands, so the UI never renders the
  // previous org's tokens during a context switch.
  const [loaded, setLoaded] = useState<LoadedState | null>(null)
  // Bump to force a refetch after a revoke or external state change.
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    if (!supabase || !orgId) return
    let cancelled = false
    const nowIso = new Date().toISOString()
    void supabase
      .from('compliance_auditor_tokens')
      // NB: explicit safe-column list — postgres column-level ACL denies
      // any query that includes the `token` column. Don't add `*` here.
      .select(
        'id, organization_id, framework_id, scope_label, token_prefix, token_suffix, created_by, created_at, expires_at, revoked_at',
      )
      .eq('organization_id', orgId)
      .is('revoked_at', null)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .then(({ data, error: respErr }) => {
        if (cancelled) return
        if (respErr) {
          setLoaded({
            orgId,
            rows: [],
            error: getSupabaseErrorMessage(respErr),
          })
          return
        }
        setLoaded({
          orgId,
          rows: (data ?? []) as AuditorTokenRow[],
          error: null,
        })
      })
    return () => {
      cancelled = true
    }
  }, [supabase, orgId, refreshTick])

  const refresh = useCallback(async () => {
    setRefreshTick((n) => n + 1)
  }, [])

  const revoke = useCallback(
    async (id: string): Promise<boolean> => {
      if (!supabase || !orgId) return false
      // Org-switch guard: if the loaded snapshot is stale relative to
      // the active org, the user could revoke a row that the next
      // render will discard anyway. Bail rather than mutating an org
      // the caller may not intend to touch.
      if (!loaded || loaded.orgId !== orgId) return false

      const { data, error: rpcErr } = await supabase.rpc(
        'revoke_compliance_auditor_token_by_id',
        { p_id: id },
      )
      if (rpcErr) {
        setLoaded((prev) =>
          prev ? { ...prev, error: getSupabaseErrorMessage(rpcErr) } : prev,
        )
        // Refresh anyway — the row state on the server may have shifted.
        setRefreshTick((n) => n + 1)
        return false
      }
      // RPC returns boolean: true when a row was updated (the caller
      // owned the token), false when no matching active token existed
      // (already revoked or wrong org). Either way, refetch so the UI
      // matches the server state.
      if (data === true) {
        // Optimistic update — drop the row immediately for snappier
        // perceived latency; the refetch reconciles.
        setLoaded((prev) =>
          prev
            ? { ...prev, rows: prev.rows.filter((r) => r.id !== id) }
            : prev,
        )
      } else {
        // No-op revoke — surface a friendly hint so the user understands
        // why the row didn't disappear.
        setLoaded((prev) =>
          prev
            ? {
                ...prev,
                error:
                  'Lenken var allerede tilbakekalt eller utløpt — listen er oppdatert.',
              }
            : prev,
        )
      }
      setRefreshTick((n) => n + 1)
      return data === true
    },
    [supabase, orgId, loaded],
  )

  const isCurrent = loaded !== null && loaded.orgId === orgId
  const stillLoading = !isCurrent

  const filtered = useMemo(() => {
    if (!isCurrent || !loaded) return []
    return frameworkFilter
      ? loaded.rows.filter((r) => r.framework_id === frameworkFilter)
      : loaded.rows
  }, [isCurrent, loaded, frameworkFilter])

  return {
    loading: stillLoading,
    error: isCurrent && loaded ? loaded.error : null,
    tokens: filtered,
    refresh,
    revoke,
  }
}
