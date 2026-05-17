// Tests for the pluggable signing adapter at `_shared/signing/index.ts`.
//
// The adapter routes Maskinporten signing to Vault-PEM (today) or to an
// HSM (Phase E sprint-3). The stub adapter exists so the routing logic is
// testable end-to-end before vendor contracts are signed. These tests
// pin the contract that the stub adapter:
//   * is selected when GOV_SIGNING_ADAPTER='hsm_stub'
//   * advertises kind='stub'
//   * publishes a stable RS256 kid via publicKeyMetadata()

import { assertEquals, assertMatch } from '@std/assert'
import { getSigner, type SignerFactoryConfig } from '../signing/index.ts'

function withEnv(key: string, value: string | null, fn: () => Promise<void>): Promise<void> {
  const prev = Deno.env.get(key)
  if (value === null) Deno.env.delete(key)
  else Deno.env.set(key, value)
  return fn().finally(() => {
    if (prev === undefined) Deno.env.delete(key)
    else Deno.env.set(key, prev)
  })
}

const baseConfig: SignerFactoryConfig = {
  organizationId: '00000000-0000-0000-0000-000000000001',
  kind: 'datatilsynet',
  vaultSecretName: null,
  // no supabase client — forces fallback to GOV_SIGNING_ADAPTER env var
}

Deno.test("getSigner with GOV_SIGNING_ADAPTER='hsm_stub' returns kind='stub'", async () => {
  await withEnv('GOV_SIGNING_ADAPTER', 'hsm_stub', async () => {
    const signer = await getSigner(baseConfig)
    assertEquals(signer.kind, 'stub')
  })
})

Deno.test('stub signer publicKeyMetadata returns RS256 + a stable kid', async () => {
  await withEnv('GOV_SIGNING_ADAPTER', 'hsm_stub', async () => {
    await withEnv('HSM_STUB_KID', 'hsm-stub-kid', async () => {
      const signer = await getSigner(baseConfig)
      const meta = await signer.publicKeyMetadata()
      assertEquals(meta.algorithm, 'RS256')
      assertEquals(meta.kid, 'hsm-stub-kid')
    })
  })
})

Deno.test("getSigner with explicit kid overrides HSM_STUB_KID env var", async () => {
  await withEnv('GOV_SIGNING_ADAPTER', 'hsm_stub', async () => {
    await withEnv('HSM_STUB_KID', 'env-kid', async () => {
      const signer = await getSigner({ ...baseConfig, kid: 'explicit-kid' })
      const meta = await signer.publicKeyMetadata()
      assertEquals(meta.kid, 'explicit-kid')
    })
  })
})

Deno.test('stub signer sign() produces a base64url signature segment', async () => {
  await withEnv('GOV_SIGNING_ADAPTER', 'hsm_stub', async () => {
    const signer = await getSigner(baseConfig)
    const sig = await signer.sign('header-b64u', 'payload-b64u')
    // Length isn't fixed (depends on RSA key), but the alphabet must be
    // strictly base64url with no padding.
    assertMatch(sig, /^[A-Za-z0-9_-]+$/)
  })
})

Deno.test('unknown GOV_SIGNING_ADAPTER value throws a descriptive error', async () => {
  await withEnv('GOV_SIGNING_ADAPTER', 'nonexistent-adapter', async () => {
    let caught: unknown = null
    try {
      await getSigner(baseConfig)
    } catch (err) {
      caught = err
    }
    if (!(caught instanceof Error)) {
      throw new Error('expected getSigner to throw for unknown adapter')
    }
    assertMatch(caught.message, /unknown GOV_SIGNING_ADAPTER/)
  })
})
