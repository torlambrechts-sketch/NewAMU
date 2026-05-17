// Shared "Test forbindelsen" helper. Posts a `{ dryRun: true,
// organization_id }` envelope to the corresponding `gov-<provider>` edge
// function. The edge functions short-circuit on `body.dryRun === true` and
// return `{ ok: true, mode: 'dry-run' }` without writing evidence or
// hitting the regulator.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { GovIntegrationKind } from '../../../hooks/useOrgIntegrations'

const FUNCTION_NAME: Record<GovIntegrationKind, string> = {
  altinn: 'gov-altinn-submit',
  regint: 'gov-arbeidstilsynet-rapport',
  datatilsynet: 'gov-datatilsynet-breach',
  nav: 'gov-nav-sykefravar',
  helsetilsynet: 'helsetilsynet-build-melding',
  ukom: 'helsetilsynet-build-melding',
}

export type DryRunResult =
  | { ok: true; mode: string; detail?: string }
  | { ok: false; error: string; detail?: string }

export async function runGovDryRun(
  supabase: SupabaseClient,
  kind: GovIntegrationKind,
  organizationId: string,
): Promise<DryRunResult> {
  const fn = FUNCTION_NAME[kind]
  try {
    const { data, error } = await supabase.functions.invoke(fn, {
      body: {
        dryRun: true,
        organization_id: organizationId,
        // The shared CommonRequestBody fields are stubbed so callers that
        // are stricter than the dryRun short-circuit still parse the
        // envelope without throwing.
        rule_id: 'dry-run',
        run_id: 'dry-run',
        event_name: 'dry_run',
        payload: { dryRun: true },
      },
    })
    if (error) {
      const detail =
        typeof error === 'object' && error && 'message' in error
          ? String((error as { message: unknown }).message)
          : String(error)
      return { ok: false, error: 'function_invoke_failed', detail }
    }
    const result = data as Record<string, unknown> | null
    if (result && typeof result === 'object' && result.ok === true) {
      return {
        ok: true,
        mode: (result.mode as string) ?? 'dry-run',
        detail: (result.detail as string) ?? undefined,
      }
    }
    return {
      ok: false,
      error: (result?.error as string) ?? 'unknown_error',
      detail: (result?.detail as string) ?? undefined,
    }
  } catch (err) {
    return {
      ok: false,
      error: 'network_error',
      detail: err instanceof Error ? err.message : String(err),
    }
  }
}
