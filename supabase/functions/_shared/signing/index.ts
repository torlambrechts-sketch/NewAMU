// Factory router. Selects the adapter based on org configuration.
// Today: vault_pem only. After HSM integration: read
// org_integrations.signing_adapter (or platform-level fallback env var
// GOV_SIGNING_ADAPTER) and dispatch.
//
// TODO (Phase E sprint-3 — vendor-contract gated):
//   * aws_cloudhsm        — AWS CloudHSM via KMS keystore + KMS Sign API
//   * azure_keyvault_hsm  — Azure Key Vault Managed HSM via REST sign
//   * buypass_hsm         — Buypass nShield network HSM (Norwegian
//                           sovereignty option preferred by sikkerhetsloven
//                           §4-3 high-risk virksomheter)
// Each adapter must implement Signer from ./types.ts and add a case to
// the switch below — no other call sites change.

import type { Signer, SignerFactoryConfig } from './types.ts'
import { vaultPemSignerFactory } from './vaultPemSigner.ts'
import { hsmStubSignerFactory } from './hsmStubSigner.ts'

export type { Signer, SignerFactoryConfig } from './types.ts'

/**
 * Resolve the adapter for the given (org, kind) tuple. Adapter selection
 * order:
 *   1. org_integrations.signing_adapter when set (per-org override).
 *   2. GOV_SIGNING_ADAPTER env var (platform default).
 *   3. 'vault_pem' fallback.
 *
 * The caller passes the supabase service-role client so we can look up
 * the per-org override and write the audit-log row.
 */
export async function getSigner(
  config: SignerFactoryConfig,
): Promise<Signer> {
  let adapter: string | null = null

  if (config.supabase) {
    try {
      const { data } = await config.supabase
        .from('org_integrations')
        .select('signing_adapter')
        .eq('organization_id', config.organizationId)
        .eq('kind', config.kind)
        .maybeSingle()
      adapter = (data?.signing_adapter as string | null) ?? null
    } catch (_) {
      // older deployments without signing_adapter column → fall through
      adapter = null
    }
  }

  if (!adapter) {
    adapter = Deno.env.get('GOV_SIGNING_ADAPTER') ?? 'vault_pem'
  }

  switch (adapter) {
    case 'vault_pem':
      return vaultPemSignerFactory.build(config)
    case 'hsm_stub':
    case 'stub':
      return hsmStubSignerFactory.build(config)
    // case 'aws_cloudhsm':       return awsCloudHsmFactory.build(config)
    // case 'azure_keyvault_hsm': return azureKvHsmFactory.build(config)
    // case 'buypass_hsm':        return buypassHsmFactory.build(config)
    default:
      throw new Error(`unknown GOV_SIGNING_ADAPTER: ${adapter}`)
  }
}
