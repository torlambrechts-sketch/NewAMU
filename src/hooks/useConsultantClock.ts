// Partner Console v0 — consultant clock.
//
// When a user with isPartnerMember=true is viewing a customer org
// (an org reachable via partner_memberships), this hook opens a
// `partner_time_entries` row on entry and closes it on exit. Every
// minute the consultant spends in a customer surface becomes billable
// evidence the partner can later export to a faktura-CSV.
//
// We deliberately keep this hook fire-and-forget: any RPC failure is
// logged but never blocks render. The migration's `auto_session`
// dedup in `partner_start_time_entry` ensures a duplicate-call (e.g.
// React StrictMode double-mount in dev) does not stack entries.

import { useEffect, useRef } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import { usePartnerMembership } from './usePartnerMembership'

export function useConsultantClock() {
  const { supabase, organization } = useOrgSetupContext()
  const { memberships, isPartnerMember, currentPartner } = usePartnerMembership()
  const currentEntryRef = useRef<string | null>(null)
  const currentOrgRef = useRef<string | null>(null)

  const orgId = organization?.id ?? null

  useEffect(() => {
    if (!supabase || !isPartnerMember || !orgId) return
    // Only clock for orgs that are *partner customers* — never clock
    // time when a consultant happens to be inside their own home org.
    const isCustomerOrg = memberships.some(
      (m) => m.organization_id === orgId && m.active,
    )
    if (!isCustomerOrg) return

    // Same org as last render — nothing to do.
    if (currentOrgRef.current === orgId && currentEntryRef.current) return

    let cancelled = false

    void (async () => {
      // Close any prior open entry before starting a new one. The RPC
      // is no-op if the id no longer maps to an open row.
      const priorId = currentEntryRef.current
      if (priorId) {
        try {
          await supabase.rpc('partner_end_time_entry', { p_entry_id: priorId })
        } catch (e) {
          console.warn('partner_end_time_entry failed', e)
        }
      }
      // Hand the partner_id GUC for consortium scenarios (no-op otherwise).
      if (currentPartner?.id) {
        try {
          await supabase.rpc('set_config', {
            parameter: 'app.active_partner_id',
            value: currentPartner.id,
            is_local: false,
          })
        } catch {
          /* set_config rpc isn't installed in v0; ignore silently */
        }
      }
      const { data, error } = await supabase.rpc('partner_start_time_entry', {
        p_org_id: orgId,
        p_description: 'Konsulent-sesjon (auto)',
        p_source: 'auto_session',
      })
      if (cancelled) return
      if (error) {
        console.warn('partner_start_time_entry failed', error.message)
        currentEntryRef.current = null
        currentOrgRef.current = null
        return
      }
      currentEntryRef.current = typeof data === 'string' ? data : null
      currentOrgRef.current = orgId
    })()

    return () => {
      cancelled = true
      const id = currentEntryRef.current
      if (!id || !supabase) return
      // Fire-and-forget close. The auto_session dedup in
      // partner_start_time_entry doubles as a safety net.
      void supabase.rpc('partner_end_time_entry', { p_entry_id: id }).then(() => {
        currentEntryRef.current = null
        currentOrgRef.current = null
      })
    }
  }, [supabase, isPartnerMember, orgId, memberships, currentPartner?.id])

  // Browser tab close → mark the entry closed. This is best-effort
  // because the unload tick rarely lets us complete a network call,
  // but it's enough for honest accounting in the typical case.
  useEffect(() => {
    function onBeforeUnload() {
      const id = currentEntryRef.current
      if (!id || !supabase) return
      try {
        // Use sendBeacon-style fire-and-forget; supabase-js does not
        // expose a sync API so we rely on a fetch keepalive call.
        void supabase.rpc('partner_end_time_entry', { p_entry_id: id })
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [supabase])
}
