// useStudioOrgContext — resolve the effective organization for studio writes.
//
// The studio supports two write scopes:
//   1. Own-org: the caller is editing their own organization. The
//      mutators target `profiles.organization_id`.
//   2. Partner-on-behalf-of: the caller is a consultant editing a
//      client org. The mutators must target the customer's
//      `organization_id`, NOT the consultant's own org.
//
// PartnerOrgSwitcher persists the active customer to localStorage
// (key: 'studio-active-customer-org-id'). This hook is the single
// resolver every preset mutator + every studio write path consults
// before sending the org id to Supabase. The RLS substrate (Phase 3.3
// partner_admin policies) takes care of authorising the write itself;
// this hook just makes sure the *right* org_id reaches the policy
// in the first place.
//
// Phase 3 Task 3.2 follow-up — fixes the original-review bug where
// the switcher stored the selection but writes still hit the user's
// own org.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import { usePartnerMembership } from './usePartnerMembership'

const ACTIVE_CUSTOMER_KEY = 'studio-active-customer-org-id'

function readStoredCustomer(): string | null {
  try {
    return localStorage.getItem(ACTIVE_CUSTOMER_KEY)
  } catch {
    return null
  }
}

function writeStoredCustomer(orgId: string | null) {
  try {
    if (orgId) localStorage.setItem(ACTIVE_CUSTOMER_KEY, orgId)
    else localStorage.removeItem(ACTIVE_CUSTOMER_KEY)
  } catch {
    /* ignore */
  }
}

/** Listen across tabs so a switch in one tab updates every other tab. */
function useStorageSync(key: string, setter: (v: string | null) => void) {
  useEffect(() => {
    function handle(e: StorageEvent) {
      if (e.key === key) setter(e.newValue)
    }
    window.addEventListener('storage', handle)
    return () => window.removeEventListener('storage', handle)
  }, [key, setter])
}

export function useStudioOrgContext() {
  const { organization, supabase, user } = useOrgSetupContext()
  const { isPartnerMember, customers, currentPartner } = usePartnerMembership()

  const [storedCustomerOrgId, setStoredCustomerOrgIdState] = useState<string | null>(
    readStoredCustomer,
  )
  useStorageSync(ACTIVE_CUSTOMER_KEY, setStoredCustomerOrgIdState)

  // Derive the validated customer id — if the stored value isn't in
  // the caller's current memberships (e.g. revocation while a tab is
  // open), it's not active. resolveActiveOrgId() at write-time provides
  // belt-and-braces validation against the partner_memberships table.
  const activeCustomerOrgId = useMemo(() => {
    if (!storedCustomerOrgId) return null
    if (!isPartnerMember) return null
    const ok = customers.some((c) => c.organization_id === storedCustomerOrgId)
    return ok ? storedCustomerOrgId : null
  }, [storedCustomerOrgId, isPartnerMember, customers])

  const ownOrgId = organization?.id ?? null
  const effectiveOrgId = activeCustomerOrgId ?? ownOrgId
  const isWritingOnBehalfOfCustomer = activeCustomerOrgId != null

  const setActiveCustomerOrgId = useCallback(
    async (customerOrgId: string | null): Promise<boolean> => {
      // Validate the chosen customer is actually one the caller has
      // a membership in. Defends against stale localStorage values.
      if (customerOrgId != null) {
        const ok = customers.some((c) => c.organization_id === customerOrgId)
        if (!ok) return false
      }
      setStoredCustomerOrgIdState(customerOrgId)
      writeStoredCustomer(customerOrgId)

      // Best-effort: set the Postgres GUC so SECURITY DEFINER RPCs
      // (e.g. partner_resolve_active_partner) see the active partner
      // for the lifetime of the next transaction. Supabase pools
      // connections per-call; this is a "hint" the RLS predicate
      // also accepts via the membership fallback in
      // studio_partner_admin_can_edit.
      if (supabase && user && currentPartner && customerOrgId) {
        try {
          await supabase.rpc('set_studio_partner_context', {
            p_partner_id: currentPartner.id,
          })
        } catch {
          // RPC not yet shipped on this env — RLS still works via the
          // membership fallback. Don't block the switch.
        }
      }
      return true
    },
    [customers, supabase, user, currentPartner],
  )

  return useMemo(
    () => ({
      /**
       * The org id every studio mutator should write to. Equals
       * activeCustomerOrgId when a partner consultant is on-behalf-of,
       * else the caller's own org.
       */
      effectiveOrgId,
      ownOrgId,
      activeCustomerOrgId,
      isWritingOnBehalfOfCustomer,
      setActiveCustomerOrgId,
    }),
    [effectiveOrgId, ownOrgId, activeCustomerOrgId, isWritingOnBehalfOfCustomer, setActiveCustomerOrgId],
  )
}
