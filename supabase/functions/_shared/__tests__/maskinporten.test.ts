// Tests for the pure helpers in `_shared/maskinporten.ts`: sha256Hex
// (used by both idempotency and evidence checksums) plus a stub-Signer
// JWT-bearer assembly check. We deliberately do NOT exercise
// `getMaskinportenAccessToken` here — it hits a real HTTPS endpoint and
// `--allow-net=localhost` blocks that. Integration coverage for the
// token exchange is tracked as a separate work item (TODO).

import { assertEquals, assertMatch } from '@std/assert'
import { sha256Hex } from '../maskinporten.ts'

Deno.test('sha256Hex output is 64 lowercase hex chars', async () => {
  const out = await sha256Hex('arbitrary-input')
  assertEquals(out.length, 64)
  assertMatch(out, /^[0-9a-f]{64}$/)
})

Deno.test('sha256Hex is deterministic for identical input', async () => {
  const a = await sha256Hex('repeat me')
  const b = await sha256Hex('repeat me')
  assertEquals(a, b)
})

Deno.test("sha256Hex snapshot — sha256('hello')", async () => {
  // RFC-correctness anchor: hashing of 'hello' is a well-known value.
  const expected = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
  assertEquals(await sha256Hex('hello'), expected)
})

// ---------------------------------------------------------------------------
// JWT-bearer composition with a stub Signer interface. The real
// `getMaskinportenAccessToken` builds {headerB64}.{payloadB64}.{sigB64} and
// posts it as `assertion`. We mirror the structure with a stub signer so
// the assertion-string shape is testable without RSA key handling.

type Signer = {
  kind: 'stub' | 'webcrypto' | 'hsm'
  sign: (header: string, payload: string) => Promise<string>
  publicKeyMetadata: () => Promise<{ kid: string; algorithm: 'RS256' }>
}

function base64UrlEncode(bytes: Uint8Array | string): string {
  const b = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const stubSigner: Signer = {
  kind: 'stub',
  async sign(h, p) {
    return base64UrlEncode(new TextEncoder().encode('signature-for-' + h + '.' + p))
  },
  async publicKeyMetadata() {
    return { kid: 'stub-kid', algorithm: 'RS256' as const }
  },
}

async function composeAssertion(signer: Signer): Promise<string> {
  const { kid, algorithm } = await signer.publicKeyMetadata()
  const header = { alg: algorithm, typ: 'JWT', kid }
  const payload = {
    iss: 'test-client',
    aud: 'https://test.maskinporten.no/',
    scope: 'datatilsynet:breach',
    iat: 1700000000,
    exp: 1700000060,
    jti: '11111111-1111-1111-1111-111111111111',
  }
  const headerB64 = base64UrlEncode(JSON.stringify(header))
  const payloadB64 = base64UrlEncode(JSON.stringify(payload))
  const signatureB64 = await signer.sign(headerB64, payloadB64)
  return `${headerB64}.${payloadB64}.${signatureB64}`
}

Deno.test('JWT-bearer assertion has three dot-separated base64url segments', async () => {
  const assertion = await composeAssertion(stubSigner)
  const parts = assertion.split('.')
  assertEquals(parts.length, 3, 'JWT must be header.payload.signature')
  for (const part of parts) {
    assertMatch(part, /^[A-Za-z0-9_-]+$/, 'each segment must be base64url')
  }
})

Deno.test('stub signer publicKeyMetadata returns RS256 + stub-kid', async () => {
  const meta = await stubSigner.publicKeyMetadata()
  assertEquals(meta.kid, 'stub-kid')
  assertEquals(meta.algorithm, 'RS256')
})
