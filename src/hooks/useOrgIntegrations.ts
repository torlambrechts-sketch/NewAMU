// useOrgIntegrations — shared hook used by the per-provider wizards under
// /admin/integrations/<provider> to read and upsert rows of
// `org_integrations`. Wizards never store secrets in `config`; private
// keys go via workflow_set_vault_secret RPC (vault.secrets).
//
// Why this hook exists: the four wizards (Altinn / Arbeidstilsynet /
// Datatilsynet / NAV) all need the same read-row-by-kind + upsert pattern.
// Keeping it in one place avoids each wizard reinventing the supabase
// query and onConflict shape.

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'

// Widened 2026-09-07 with helsetilsynet + ukom so HelsetilsynetSetup can
// use the shared hook (instead of bypass-upserting). The DB enum extension
// shipped in _126100 (org_integrations.kind CHECK).
export type GovIntegrationKind =
  | 'altinn'
  | 'regint'
  | 'datatilsynet'
  | 'nav'
  | 'helsetilsynet'
  | 'ukom'

export type OrgIntegrationRow = {
  id: string
  organization_id: string
  kind: GovIntegrationKind
  enabled: boolean
  environment: 'tt02' | 'prod'
  config: Record<string, unknown>
  vault_secret_name: string | null
  last_submission_at: string | null
  last_submission_status: 'ok' | 'failed' | null
  last_health_status: 'ok' | 'degraded' | 'down' | null
}

export type UpsertInput = {
  kind: GovIntegrationKind
  environment?: 'tt02' | 'prod'
  enabled?: boolean
  config?: Record<string, unknown>
}

const EMPTY_ROW_MAP: Record<GovIntegrationKind, OrgIntegrationRow | null> = {
  altinn: null,
  regint: null,
  datatilsynet: null,
  nav: null,
  helsetilsynet: null,
  ukom: null,
}

const DEFAULT_KINDS: GovIntegrationKind[] = [
  'altinn',
  'regint',
  'datatilsynet',
  'nav',
  'helsetilsynet',
  'ukom',
]

export function useOrgIntegrations(kinds?: GovIntegrationKind[]) {
  const { supabase, organization } = useOrgSetupContext()
  const [rows, setRows] = useState<Record<GovIntegrationKind, OrgIntegrationRow | null>>(
    () => ({ ...EMPTY_ROW_MAP }),
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !organization?.id) return
    setLoading(true)
    setError(null)
    try {
      const filter = (kinds ?? DEFAULT_KINDS) as GovIntegrationKind[]
      const { data, error: e } = await supabase
        .from('org_integrations')
        .select(
          'id, organization_id, kind, enabled, environment, config, vault_secret_name, last_submission_at, last_submission_status, last_health_status',
        )
        .eq('organization_id', organization.id)
        .in('kind', filter)
      if (e) throw e
      const next: Record<GovIntegrationKind, OrgIntegrationRow | null> = { ...EMPTY_ROW_MAP }
      for (const r of (data ?? []) as OrgIntegrationRow[]) {
        next[r.kind] = r
      }
      setRows(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke laste integrasjoner')
    } finally {
      setLoading(false)
    }
  }, [supabase, organization?.id, kinds])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const upsert = useCallback(
    async (input: UpsertInput): Promise<OrgIntegrationRow | null> => {
      if (!supabase || !organization?.id) return null
      const payload: Record<string, unknown> = {
        organization_id: organization.id,
        kind: input.kind,
        requires_external_activation: true,
      }
      if (input.environment !== undefined) payload.environment = input.environment
      if (input.enabled !== undefined) payload.enabled = input.enabled
      if (input.config !== undefined) payload.config = input.config

      const { data, error: e } = await supabase
        .from('org_integrations')
        .upsert(payload, { onConflict: 'organization_id,kind' })
        .select(
          'id, organization_id, kind, enabled, environment, config, vault_secret_name, last_submission_at, last_submission_status, last_health_status',
        )
        .maybeSingle()
      if (e) throw e
      await refresh()
      return (data as OrgIntegrationRow) ?? null
    },
    [supabase, organization?.id, refresh],
  )

  /**
   * Upload a PEM-encoded virksomhetssertifikat private key to Vault and
   * point the org_integrations row at it. Returns the vault_secret_name
   * on success.
   */
  const setVaultSecret = useCallback(
    async (kind: GovIntegrationKind, pem: string): Promise<string> => {
      if (!supabase || !organization?.id) throw new Error('Supabase / org ikke klar')
      const { data, error: e } = await supabase.rpc('workflow_set_vault_secret', {
        p_organization_id: organization.id,
        p_kind: kind,
        p_secret_value: pem,
      })
      if (e) throw e
      await refresh()
      return (data as string) ?? ''
    },
    [supabase, organization?.id, refresh],
  )

  return { rows, loading, error, refresh, upsert, setVaultSecret }
}
