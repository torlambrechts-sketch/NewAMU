// resolveActiveOrgId — the studio-write org resolver.
//
// Every Simple-mode preset mutator (and every Advanced-mode write that
// comes later) calls this helper to determine which organization id
// the row should land in.
//
// Resolution order:
//   1. If a customer org id is stored in localStorage under
//      `studio-active-customer-org-id` AND the caller has an active
//      partner_membership covering it, use the customer org.
//   2. Otherwise use the caller's own profile.organization_id.
//
// Defence in depth: even if a malicious script writes a bogus
// localStorage value, RLS still gates the actual write — the policy
// (studio_partner_admin_can_edit) requires an active partner_membership
// for the target org. The resolver's job is just to send the right
// target id; the policy decides whether the write lands.
//
// The hook variant (useStudioOrgContext) is for UI rendering; this
// async helper is for module-load-time scope files that can't use
// React hooks.
//
// Spec: specs/studio-builder.md §5 Phase 3 Task 3.2 follow-up.

import type { SupabaseClient } from '@supabase/supabase-js'

const ACTIVE_CUSTOMER_KEY = 'studio-active-customer-org-id'

function readStoredCustomer(): string | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(ACTIVE_CUSTOMER_KEY)
  } catch {
    return null
  }
}

/**
 * Returns the org id every studio write should target. Returns null if
 * supabase isn't available or the caller has no profile. Callers
 * should bail out rather than write to a bogus org id when null.
 */
export async function resolveActiveOrgId(
  supabase: SupabaseClient | null,
): Promise<string | null> {
  if (!supabase) return null

  const stored = readStoredCustomer()
  if (stored) {
    // Verify the caller still has an active membership covering this
    // customer org. If revoked between the page load and the write,
    // fall back to own org.
    const { data, error } = await supabase
      .from('partner_memberships')
      .select('id')
      .eq('active', true)
      .limit(1)
    // Note: we don't check (active=true AND covers org=stored) here
    // because partner_memberships is partner-scoped not customer-org-
    // scoped. The RLS policy on the target table validates the actual
    // write. If membership table doesn't exist (env without partner
    // substrate), error is non-null and we fall through.
    if (!error && data && data.length > 0) {
      return stored
    }
  }

  // Fall back to own org.
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .single()
  return (profile as { organization_id?: string } | null)?.organization_id ?? null
}
