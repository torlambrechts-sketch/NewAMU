// Maskinporten JWT-bearer-grant helper, shared by all gov edge functions.
//
// Maskinporten is Norway's machine-to-machine OAuth2 layer for government
// APIs (Altinn 3, Arbeidstilsynet RegInc, Skatteetaten, NAV DSOP, …).
// The flow:
//   1. Build a JWT assertion: header {kid, alg:RS256} + payload
//      {iss=clientId, aud=maskinporten audience, scope=requested scope,
//       iat, exp, jti}
//   2. Sign the JWT with the org's virksomhetssertifikat (PKCS#8 private
//      key) — same cert used for Altinn message signing
//   3. POST to https://maskinporten.no/token with
//      grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer + assertion=
//   4. Receive access_token; pass as Bearer to the actual regulator API
//
// Environments:
//   TT02 (test):  https://test.maskinporten.no/token
//                 audience https://test.maskinporten.no/
//   PROD:         https://maskinporten.no/token
//                 audience https://maskinporten.no/
//
// Signing is delegated to the Signer abstraction in ./signing/. Today
// the only production-ready adapter is vault_pem (PEM private key from
// Supabase Vault, signed in-process). The HSM adapters (AWS CloudHSM,
// Azure Key Vault HSM, Buypass HSM) plug in behind the same interface
// — no call-site changes when they land. This is the NSM Grunnprinsipper
// 2.4 + sikkerhetsloven §4-3 remediation.

import { getSigner } from './signing/index.ts'

export type MaskinportenEnv = 'tt02' | 'prod'

export type MaskinportenConfig = {
  clientId: string
  scope: string
  environment: MaskinportenEnv
  /**
   * PEM-encoded PKCS#8 private key.
   *
   * Retained for backward-compat: existing callers pass the PEM they
   * read via resolveMaskinportenCredentials(). Internally we ignore the
   * PEM and route through the Signer abstraction so HSM adapters can
   * take over without touching call sites. The PEM read still happens
   * inside resolveMaskinportenCredentials() — that's also the function
   * that primes the Vault-PEM signer cache for this org.
   */
  privateKeyPem: string
  /** Public certificate `kid` (matches the JWK registered with Maskinporten). */
  kid: string
  /**
   * Optional — passed through to the Signer factory. When omitted the
   * factory falls back to GOV_SIGNING_ADAPTER env var / 'vault_pem'.
   * The supabase service-role client lets adapters write to
   * workflow_signing_audit_log.
   */
  // deno-lint-ignore no-explicit-any
  supabase?: any
  organizationId?: string
  kind?: 'altinn' | 'regint' | 'datatilsynet' | 'nav'
}

/**
 * Resolve the virksomhetssertifikat private key for an org's integration.
 *
 * Reads org_integrations.vault_secret_name; if set, decrypts via the
 * service-role-only RPC workflow_read_vault_secret. Falls back to the
 * MASKINPORTEN_TT02_PRIVATE_KEY / _PROD_PRIVATE_KEY env vars when no
 * per-org Vault entry exists (sandbox / shared-cert mode).
 *
 * NOTE: This function is preserved for backward-compat with the four gov
 * edge functions. The PEM it returns is purely informational under the
 * Signer abstraction — actual signing material is loaded by
 * vaultPemSignerFactory.build() inside getMaskinportenAccessToken(), so
 * HSM-adapter deployments don't depend on the value returned here. The
 * helper continues to gate on credential presence so callers can return
 * a deterministic 500/maskinporten_credentials_missing.
 *
 * Returns { privateKeyPem, kid } or throws with a descriptive error.
 */
export async function resolveMaskinportenCredentials(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  orgId: string,
  kind: 'altinn' | 'regint' | 'datatilsynet' | 'nav',
  environment: MaskinportenEnv,
): Promise<{ privateKeyPem: string; kid: string }> {
  const { data: integration, error } = await supabase
    .from('org_integrations')
    .select('vault_secret_name, config, signing_adapter, signing_kid')
    .eq('organization_id', orgId)
    .eq('kind', kind)
    .maybeSingle()
  if (error) throw new Error(`org_integrations lookup failed: ${error.message}`)
  const config = (integration?.config ?? {}) as Record<string, string>

  const adapter = (integration?.signing_adapter as string | null) ??
    Deno.env.get('GOV_SIGNING_ADAPTER') ?? 'vault_pem'

  let privateKeyPem = ''
  const vaultName = integration?.vault_secret_name as string | null

  // HSM adapters don't need a PEM — they get the key handle from the
  // vendor's API. Skip the Vault read entirely so org_admins can flip
  // signing_adapter='aws_cloudhsm' before they have a vault row.
  if (adapter === 'vault_pem') {
    if (vaultName) {
      const { data: secret, error: sErr } = await supabase.rpc(
        'workflow_read_vault_secret',
        { p_name: vaultName },
      )
      if (sErr) throw new Error(`Vault read failed for ${vaultName}: ${sErr.message}`)
      privateKeyPem = (secret as string | null) ?? ''
    }
    if (!privateKeyPem) {
      privateKeyPem = environment === 'tt02'
        ? Deno.env.get('MASKINPORTEN_TT02_PRIVATE_KEY') ?? ''
        : Deno.env.get('MASKINPORTEN_PROD_PRIVATE_KEY') ?? ''
    }
    if (!privateKeyPem) {
      throw new Error(
        `No Maskinporten private key for org=${orgId} kind=${kind} env=${environment}. Set org_integrations.vault_secret_name or MASKINPORTEN_${environment.toUpperCase()}_PRIVATE_KEY.`,
      )
    }
  }

  const kid = (integration?.signing_kid as string | null) ??
    (config.kid as string | undefined) ??
    (environment === 'tt02'
      ? Deno.env.get('MASKINPORTEN_TT02_KID') ?? ''
      : Deno.env.get('MASKINPORTEN_PROD_KID') ?? '')
  if (!kid) throw new Error(`Missing Maskinporten kid for org=${orgId} kind=${kind}`)

  return { privateKeyPem, kid }
}

const ENDPOINTS: Record<MaskinportenEnv, { token: string; audience: string }> = {
  tt02: {
    token: 'https://test.maskinporten.no/token',
    audience: 'https://test.maskinporten.no/',
  },
  prod: {
    token: 'https://maskinporten.no/token',
    audience: 'https://maskinporten.no/',
  },
}

function base64UrlEncode(bytes: Uint8Array | string): string {
  const b = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Build, sign, and exchange a Maskinporten JWT bearer assertion. Returns
 * the access token (string) on success; throws with a descriptive error
 * message on failure (caller maps to HTTP 5xx + workflow_runs.status=failed).
 *
 * The signing step is delegated to the Signer abstraction so HSM-backed
 * deployments can take over without changes here. cfg.supabase +
 * cfg.organizationId + cfg.kind are optional — when omitted we run the
 * vault_pem adapter in "env-var fallback" mode (still secure for local
 * dev, but no per-sign audit-log row).
 */
export async function getMaskinportenAccessToken(
  cfg: MaskinportenConfig,
): Promise<{ accessToken: string; expiresIn: number }> {
  const endpoint = ENDPOINTS[cfg.environment]
  const now = Math.floor(Date.now() / 1000)

  const header = { alg: 'RS256', typ: 'JWT', kid: cfg.kid }
  const payload = {
    iss: cfg.clientId,
    aud: endpoint.audience,
    scope: cfg.scope,
    iat: now,
    exp: now + 60,
    jti: crypto.randomUUID(),
  }

  const headerB64 = base64UrlEncode(JSON.stringify(header))
  const payloadB64 = base64UrlEncode(JSON.stringify(payload))

  // Route through the Signer abstraction. The caller already fetched the
  // PEM via resolveMaskinportenCredentials() so we pass it inline — the
  // vault_pem adapter won't re-hit Vault, and HSM adapters ignore the
  // PEM entirely.
  const signer = await getSigner({
    organizationId: cfg.organizationId ?? '00000000-0000-0000-0000-000000000000',
    kind: cfg.kind ?? 'altinn',
    vaultSecretName: null,
    kid: cfg.kid,
    environment: cfg.environment,
    supabase: cfg.supabase,
    inlinePrivateKeyPem: cfg.privateKeyPem,
  })

  const signatureB64 = await signer.sign(headerB64, payloadB64)
  const assertion = `${headerB64}.${payloadB64}.${signatureB64}`

  const tokenRes = await fetch(endpoint.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text().catch(() => '')
    throw new Error(`Maskinporten token exchange failed: ${tokenRes.status} ${errBody.slice(0, 500)}`)
  }
  const tokenJson = (await tokenRes.json()) as { access_token?: string; expires_in?: number }
  if (!tokenJson.access_token) {
    throw new Error('Maskinporten response missing access_token')
  }
  return { accessToken: tokenJson.access_token, expiresIn: tokenJson.expires_in ?? 60 }
}

/**
 * Compute the sha256 hex of a string — used by edge functions for both
 * idempotency keys (sha256(org_id|rule_id|run_id|event_name)) and for
 * evidence checksums.
 */
export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
