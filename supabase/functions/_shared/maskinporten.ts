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
// Secrets storage: virksomhetssertifikat private key sits in Supabase
// Vault keyed by org. Public config (client_id, scope) lives in
// org_integrations.config. NEVER log the assertion or access_token.

export type MaskinportenEnv = 'tt02' | 'prod'

export type MaskinportenConfig = {
  clientId: string
  scope: string
  environment: MaskinportenEnv
  /** PEM-encoded PKCS#8 private key. Source it from Vault. */
  privateKeyPem: string
  /** Public certificate `kid` (matches the JWK registered with Maskinporten). */
  kid: string
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

/**
 * Convert a PEM-encoded PKCS#8 RSA private key into a CryptoKey usable by
 * Deno's WebCrypto for RS256 signing. Strips PEM headers + decodes base64.
 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '')
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

function base64UrlEncode(bytes: Uint8Array | string): string {
  const b = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Build, sign, and exchange a Maskinporten JWT bearer assertion. Returns
 * the access token (string) on success; throws with a descriptive error
 * message on failure (caller maps to HTTP 5xx + workflow_runs.status=failed).
 */
export async function getMaskinportenAccessToken(cfg: MaskinportenConfig): Promise<{ accessToken: string; expiresIn: number }> {
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
  const signingInput = `${headerB64}.${payloadB64}`

  const key = await importPrivateKey(cfg.privateKeyPem)
  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput),
  )
  const signatureB64 = base64UrlEncode(new Uint8Array(signatureBuffer))
  const assertion = `${signingInput}.${signatureB64}`

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
