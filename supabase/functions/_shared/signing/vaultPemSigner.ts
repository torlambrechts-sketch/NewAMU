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

    // Append-only audit-log row. Errors here are non-fatal for the sign
    // itself (the regulator call still proceeds), but we log loudly so the
    // operator can see drift between actual signs and recorded signs.
    try {
      if (this.supabase) {
        const sha = await sha256HexLocal(signingInput)
        const { error } = await this.supabase
          .from('workflow_signing_audit_log')
          .insert({
            organization_id: this.config.organizationId,
            kind: this.config.kind,
            adapter: this.kind,
            public_key_kid: this.metadata.kid,
            cert_serial: this.metadata.certificateSerial ?? null,
            cert_expires_at: this.metadata.certificateExpiresAt ?? null,
            intent: 'maskinporten_jwt_bearer_grant',
            sha256_of_signed_input: sha,
          })
        if (error) {
          console.warn(
            `workflow_signing_audit_log insert failed (non-fatal): ${error.message}`,
          )
        }
      }
    } catch (logErr) {
      console.warn(
        `workflow_signing_audit_log insert threw (non-fatal): ${(logErr as Error).message}`,
      )
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
    let privateKeyPem = ''

    if (cfg.vaultSecretName) {
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
