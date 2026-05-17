// Vault-PEM Signer — current production adapter.
//
// Reads the virksomhetssertifikat PKCS#8 PEM from Supabase Vault via
// workflow_read_vault_secret() (service-role-only RPC), imports it into
// WebCrypto, signs with RSASSA-PKCS1-v1_5 + SHA-256, and writes one
// row into workflow_signing_audit_log per signature.
//
// This is the path that NSM Grunnprinsipper 2.4 calls out as
// process-memory-bound — keeping it isolated behind the Signer
// interface so the HSM adapters can swap it without touching gov-*
// edge functions.

import type {
  Signer,
  SignerFactory,
  SignerFactoryConfig,
  SignerPublicKeyMetadata,
} from './types.ts'

function base64UrlDecodeToBytes(input: string): Uint8Array {
  return Uint8Array.from(atob(input), (c) => c.charCodeAt(0))
}

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

/**
 * Insert into workflow_signing_audit_log with one retry. Returns
 * { ok: true } on success, { ok: false, error } on terminal failure.
 * Exported here as a module-local helper rather than _shared/util so
 * the hsmStubSigner can re-use it (same module, same import path).
 */
// deno-lint-ignore no-explicit-any
export async function insertAuditLogWithRetry(supabase: any, row: Record<string, unknown>): Promise<{ ok: true } | { ok: false; error: string }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { error } = await supabase.from('workflow_signing_audit_log').insert(row)
      if (!error) return { ok: true }
      if (attempt === 1) {
        return { ok: false, error: error.message ?? String(error) }
      }
      // Brief backoff before retry (50ms).
      await new Promise((resolve) => setTimeout(resolve, 50))
    } catch (e) {
      if (attempt === 1) {
        return { ok: false, error: (e as Error).message }
      }
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }
  return { ok: false, error: 'retries exhausted' }
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
  const der = base64UrlDecodeToBytes(
    body.replace(/-/g, '+').replace(/_/g, '/'),
  )
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

class VaultPemSigner implements Signer {
  readonly kind = 'vault_pem' as const

  // deno-lint-ignore no-explicit-any
  private readonly supabase: any
  private readonly cryptoKey: CryptoKey
  private readonly metadata: SignerPublicKeyMetadata
  private readonly config: SignerFactoryConfig

  constructor(
    // deno-lint-ignore no-explicit-any
    supabase: any,
    cryptoKey: CryptoKey,
    metadata: SignerPublicKeyMetadata,
    config: SignerFactoryConfig,
  ) {
    this.supabase = supabase
    this.cryptoKey = cryptoKey
    this.metadata = metadata
    this.config = config
  }

  async sign(headerB64u: string, payloadB64u: string): Promise<string> {
    const signingInput = `${headerB64u}.${payloadB64u}`
    const sigBuf = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      this.cryptoKey,
      new TextEncoder().encode(signingInput),
    )
    const signatureB64 = base64UrlEncodeBytes(new Uint8Array(sigBuf))

    // Append-only audit-log row. The regulator call MUST proceed even
    // if the audit row can't be persisted right now (otherwise a flaky
    // DB stops gov reporting), but we retry once on the primary insert
    // and fall back to workflow_signing_audit_failures so a daily
    // drainer can re-promote the row. See migration _124900.
    if (this.supabase) {
      const sha = await sha256HexLocal(signingInput)
      const row = {
        organization_id: this.config.organizationId,
        kind: this.config.kind,
        adapter: this.kind,
        public_key_kid: this.metadata.kid,
        cert_serial: this.metadata.certificateSerial ?? null,
        cert_expires_at: this.metadata.certificateExpiresAt ?? null,
        intent: 'maskinporten_jwt_bearer_grant',
        sha256_of_signed_input: sha,
      }
      const inserted = await insertAuditLogWithRetry(this.supabase, row)
      if (!inserted.ok) {
        try {
          const { error: failErr } = await this.supabase
            .from('workflow_signing_audit_failures')
            .insert({
              ...row,
              attempt_count: 1,
              last_error: inserted.error ?? 'unknown',
            })
          if (failErr) {
            console.error(
              `[signing-audit] failure-table insert also failed: ${failErr.message}`,
            )
          } else {
            console.error(
              `[signing-audit] persisted to failures (drainer will retry): ${inserted.error}`,
            )
          }
        } catch (failThrow) {
          console.error(
            `[signing-audit] failure-table insert threw: ${(failThrow as Error).message}`,
          )
        }
      }
    }

    return signatureB64
  }

  publicKeyMetadata(): Promise<SignerPublicKeyMetadata> {
    return Promise.resolve(this.metadata)
  }
}

export const vaultPemSignerFactory: SignerFactory = {
  async build(cfg: SignerFactoryConfig): Promise<Signer> {
    const env = cfg.environment ?? 'tt02'
    let privateKeyPem = cfg.inlinePrivateKeyPem ?? ''

    if (!privateKeyPem && cfg.vaultSecretName) {
      if (!cfg.supabase) {
        throw new Error(
          'vaultPemSignerFactory: supabase client required to read Vault secret',
        )
      }
      const { data: secret, error: sErr } = await cfg.supabase.rpc(
        'workflow_read_vault_secret',
        { p_name: cfg.vaultSecretName },
      )
      if (sErr) {
        throw new Error(
          `Vault read failed for ${cfg.vaultSecretName}: ${sErr.message}`,
        )
      }
      privateKeyPem = (secret as string | null) ?? ''
    }

    if (!privateKeyPem) {
      privateKeyPem = env === 'tt02'
        ? Deno.env.get('MASKINPORTEN_TT02_PRIVATE_KEY') ?? ''
        : Deno.env.get('MASKINPORTEN_PROD_PRIVATE_KEY') ?? ''
    }

    if (!privateKeyPem) {
      throw new Error(
        `No Maskinporten private key for org=${cfg.organizationId} kind=${cfg.kind} env=${env}. ` +
          `Set org_integrations.vault_secret_name or MASKINPORTEN_${env.toUpperCase()}_PRIVATE_KEY.`,
      )
    }

    const kid = cfg.kid ??
      (env === 'tt02'
        ? Deno.env.get('MASKINPORTEN_TT02_KID') ?? ''
        : Deno.env.get('MASKINPORTEN_PROD_KID') ?? '')
    if (!kid) {
      throw new Error(
        `Missing Maskinporten kid for org=${cfg.organizationId} kind=${cfg.kind}`,
      )
    }

    // If org_integrations carries signing_cert_serial / signing_cert_expires_at
    // we surface them in the audit-log row. Best-effort — failure is silent.
    let certificateSerial: string | undefined
    let certificateExpiresAt: string | undefined
    try {
      if (cfg.supabase) {
        const { data } = await cfg.supabase
          .from('org_integrations')
          .select('signing_cert_serial, signing_cert_expires_at, signing_kid')
          .eq('organization_id', cfg.organizationId)
          .eq('kind', cfg.kind)
          .maybeSingle()
        if (data) {
          certificateSerial = (data.signing_cert_serial as string | null) ??
            undefined
          certificateExpiresAt =
            (data.signing_cert_expires_at as string | null) ?? undefined
        }
      }
    } catch (_) {
      // ignore — older deployments may not have these columns yet
    }

    const cryptoKey = await importPrivateKey(privateKeyPem)
    const metadata: SignerPublicKeyMetadata = {
      kid,
      algorithm: 'RS256',
      certificateSerial,
      certificateExpiresAt,
    }
    return new VaultPemSigner(cfg.supabase, cryptoKey, metadata, cfg)
  },
}
