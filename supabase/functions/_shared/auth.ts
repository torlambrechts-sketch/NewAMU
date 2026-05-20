// Shared authorization helpers for edge functions.
//
// Two cross-tenant guards:
//
//   * assertCallerOrg() — per-user authz. Verifies the caller's JWT, looks
//     up their org via current_org_id() and asserts it matches the org id
//     the request is acting on. Service-role callers (server-to-server
//     fan-out, e.g. workflow-queue-worker) are allowed through since the
//     role *is* the system. Modelled on helsetilsynet-build-melding.
//
//   * assertServiceRole() — for cron-only / system-only functions. The
//     pg_cron jobs invoke these with the service-role key as the bearer
//     token, so requiring service-role rejects every ordinary user JWT
//     without any extra shared-secret configuration.
//
// Both throw GuardError on denial; handlers catch it and emit json(err).

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

/** Thrown by the guards on denial. `status` is the HTTP code to return. */
export class GuardError extends Error {
  status: number
  code: string
  detail?: string
  constructor(status: number, code: string, detail?: string) {
    super(code)
    this.name = 'GuardError'
    this.status = status
    this.code = code
    this.detail = detail
  }
}

/** Service-role caller if the bearer token equals SUPABASE_SERVICE_ROLE_KEY. */
export function isServiceRole(authHeader: string): boolean {
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  return token.length > 0 && key.length > 0 && token === key
}

/** Anon-key client bound to the caller's JWT (RLS-aware). */
function userClient(authHeader: string): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  return createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  })
}

/**
 * Assert the caller may act on `organizationId`.
 *
 * Service-role callers are allowed through unconditionally (trusted
 * server-to-server traffic). For every other caller we verify the JWT
 * with auth.getUser(), resolve current_org_id() and require an exact
 * match — this is the control that stops one tenant from filing forged
 * submissions / exporting evidence in another tenant's name.
 *
 * Throws GuardError (401 / 403) on any failure. Returns the caller's
 * org id (or 'service_role') on success.
 */
export async function assertCallerOrg(
  req: Request,
  organizationId: string,
): Promise<string> {
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    throw new GuardError(401, 'unauthorized')
  }
  if (isServiceRole(authHeader)) {
    return 'service_role'
  }
  const userSb = userClient(authHeader)
  const { data: userData, error: userErr } = await userSb.auth.getUser()
  if (userErr || !userData?.user) {
    throw new GuardError(401, 'unauthenticated', userErr?.message)
  }
  const { data: callerOrgId, error: orgErr } = await userSb.rpc('current_org_id')
  if (orgErr || !callerOrgId) {
    throw new GuardError(403, 'no_current_org', orgErr?.message)
  }
  if (String(callerOrgId) !== String(organizationId)) {
    throw new GuardError(403, 'cross_org_denied')
  }
  return String(callerOrgId)
}

/**
 * Require the caller to be the service role.
 *
 * Used by cron-only / system-only functions (queue + outbox workers).
 * The pg_cron jobs invoke them with `Authorization: Bearer <service role
 * key>`, so this rejects every ordinary user JWT — an authenticated
 * tenant user cannot forge the service-role key. No shared-secret env
 * var or cron-job change is needed.
 *
 * Throws GuardError (401 / 403) on any failure.
 */
export function assertServiceRole(req: Request): void {
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    throw new GuardError(401, 'unauthorized')
  }
  if (!isServiceRole(authHeader)) {
    throw new GuardError(403, 'service_role_required')
  }
}
