// HSM Stub Signer — keeps the interface honest in dev/CI.
//
// NEVER USE IN PRODUCTION. The whole point of the HSM swap is to keep
// key material off the process heap; this stub holds the key in-process
// just like the Vault-PEM adapter. It exists so we can exercise the
// adapter-routing logic end-to-end before vendor contracts are signed.
//
// Behaviour:
//   * If HSM_STUB_PRIVATE_KEY_PEM is set, parse it.
//   * Otherwise generate an ephemeral RSA-2048 key on first use and
//     cache it in module memory for the life of the worker.
//   * Logs a console.warn on every sign() so it shows up in the
//     Supabase Functions log stream — operators cannot miss it.

import type {
  Signer,
  SignerFactory,
  SignerFactoryConfig,
  SignerPublicKeyMetadata,
} from './types.ts'
import { insertAuditLogWithRetry } from './vaultPemSigner.ts'

let cachedKeyPair: CryptoKeyPair | null = null
let cachedImportedKey: CryptoKey | null = null

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function sha256HexLocal(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function importPemPrivateKey(pem: string): Promise<CryptoKey> {
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

async function getOrCreatePrivateKey(): Promise<CryptoKey> {
  const envPem = Deno.env.get('HSM_STUB_PRIVATE_KEY_PEM')
  if (envPem) {
    if (cachedImportedKey) return cachedImportedKey
    cachedImportedKey = await importPemPrivateKey(envPem)
    return cachedImportedKey
  }
  if (cachedKeyPair) return cachedKeyPair.privateKey
  cachedKeyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: 'SHA-256',
    },
    false,
    ['sign', 'verify'],
  ) as CryptoKeyPair
  return cachedKeyPair.privateKey
}

class HsmStubSigner implements Signer {
  readonly kind = 'stub' as const
  private readonly metadata: SignerPublicKeyMetadata
  // deno-lint-ignore no-explicit-any
  private readonly supabase: any
  private readonly config: SignerFactoryConfig

  constructor(
    metadata: SignerPublicKeyMetadata,
    // deno-lint-ignore no-explicit-any
    supabase: any,
    config: SignerFactoryConfig,
  ) {
    this.metadata = metadata
    this.supabase = supabase
    this.config = config
  }

  async sign(headerB64u: string, payloadB64u: string): Promise<string> {
    console.warn(
      'STUB HSM signer in use — replace with vendor adapter in production',
    )
    const key = await getOrCreatePrivateKey()
    const signingInput = `${headerB64u}.${payloadB64u}`
    const sigBuf = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      new TextEncoder().encode(signingInput),
    )

    // Mirror the vaultPemSigner audit-log behaviour: writes a row tagged
    // adapter='stub' so future readers can identify which signs were
    // stub-produced. Same retry-once + failure-table fallback path.
    if (this.supabase) {
      try {
        const sha = await sha256HexLocal(signingInput)
        const row = {
          organization_id: this.config.organizationId,
          kind: this.config.kind,
          adapter: this.kind, // 'stub'
          public_key_kid: this.metadata.kid,
          cert_serial: this.metadata.certificateSerial ?? null,
          cert_expires_at: this.metadata.certificateExpiresAt ?? null,
          intent: 'maskinporten_jwt_bearer_grant',
          sha256_of_signed_input: sha,
        }
        const inserted = await insertAuditLogWithRetry(this.supabase, row)
        if (!inserted.ok) {
          const { error: failErr } = await this.supabase
            .from('workflow_signing_audit_failures')
            .insert({
              ...row,
              attempt_count: 1,
              last_error: inserted.error ?? 'unknown',
            })
          if (failErr) {
            console.error(
              `[signing-audit:stub] failure-table insert also failed: ${failErr.message}`,
            )
          } else {
            console.error(
              `[signing-audit:stub] persisted to failures: ${inserted.error}`,
            )
          }
        }
      } catch (logErr) {
        console.error(
          `[signing-audit:stub] audit-log threw: ${(logErr as Error).message}`,
        )
      }
    }

    return base64UrlEncodeBytes(new Uint8Array(sigBuf))
  }

  publicKeyMetadata(): Promise<SignerPublicKeyMetadata> {
    return Promise.resolve(this.metadata)
  }
}

export const hsmStubSignerFactory: SignerFactory = {
  build(cfg: SignerFactoryConfig): Promise<Signer> {
    const kid = cfg.kid ?? Deno.env.get('HSM_STUB_KID') ?? 'hsm-stub-kid'
    return Promise.resolve(
      new HsmStubSigner(
        {
          kid,
          algorithm: 'RS256',
        },
        cfg.supabase,
        cfg,
      ),
    )
  },
}
