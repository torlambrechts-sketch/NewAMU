// Abstract signer interface — every Maskinporten / gov signing
// adapter implements this. Lets us swap Vault-PEM signing (today)
// for HSM-backed signing (Phase E sprint-3) without touching the
// call sites in gov-altinn-submit / gov-arbeidstilsynet-rapport /
// gov-datatilsynet-breach / gov-nav-sykefravar.
//
// Threat-model anchor: NSM Grunnprinsipper 2.4 + sikkerhetsloven §4-3
// require that key material for signaturer mot myndighetsregistre lever
// utenfor prosess­minnet. The Vault-PEM adapter is the bootstrap; the
// HSM adapters land when vendor contracts (AWS CloudHSM / Azure Key
// Vault HSM / Buypass HSM) are signed.

export type SignerKind =
  | 'vault_pem'
  | 'aws_cloudhsm'
  | 'azure_keyvault_hsm'
  | 'buypass_hsm'
  | 'stub'

export interface SignerPublicKeyMetadata {
  kid: string
  algorithm: 'RS256' | 'ES256'
  certificateSerial?: string
  certificateExpiresAt?: string
}

export interface Signer {
  /** Stable identifier for audit logs and metrics. */
  readonly kind: SignerKind

  /** Signs a Maskinporten JWT-bearer-grant header+payload (already base64url-encoded) */
  sign(headerB64u: string, payloadB64u: string): Promise<string>

  /** Returns the public key info for the audit evidence row */
  publicKeyMetadata(): Promise<SignerPublicKeyMetadata>

  /** Optional rotation check — adapter signals "key is rotating, refresh me" */
  isRotating?(): boolean
}

export interface SignerFactoryConfig {
  organizationId: string
  kind: 'altinn' | 'regint' | 'datatilsynet' | 'nav'
  vaultSecretName: string | null // null → adapter must come from env
  /**
   * Used by HSM adapters to look up the right key handle / KID. The
   * Vault-PEM adapter ignores this when missing and falls back to
   * org_integrations.config.kid + env fallbacks.
   */
  kid?: string | null
  /** TT02 vs prod — controls env-var fallback inside the adapter. */
  environment?: 'tt02' | 'prod'
  /**
   * Optional Supabase client (service role) so the adapter can read
   * Vault, write the audit-log row, and look up org_integrations.
   * Vault-PEM adapter REQUIRES it when vaultSecretName is set; HSM
   * adapters use it for the audit-log row only.
   */
  // deno-lint-ignore no-explicit-any
  supabase?: any
  /**
   * Optional already-fetched PEM. When set, the vault_pem adapter skips
   * its own Vault read and uses this material directly. The four gov
   * edge functions still call resolveMaskinportenCredentials() first
   * (so they can return a clean 500/maskinporten_credentials_missing
   * before the signer is constructed) and then thread the PEM through.
   * HSM adapters ignore this field.
   */
  inlinePrivateKeyPem?: string | null
}

export interface SignerFactory {
  build(config: SignerFactoryConfig): Promise<Signer>
}
