// Audit-chain helpers — wraps the alerts_verify_audit_chain RPC + the
// alerts-audit-export / alerts-audit-verify edge functions.

import type { SupabaseClient } from '@supabase/supabase-js'

export type ChainVerification = {
  ok: boolean
  brokenAt: string | null
}

export async function verifyChain(
  supabase: SupabaseClient,
  caseId: string,
): Promise<ChainVerification> {
  const { data, error } = await supabase.rpc('alerts_verify_audit_chain', { p_case_id: caseId })
  if (error || !data || !Array.isArray(data) || data.length === 0) {
    return { ok: false, brokenAt: null }
  }
  const row = data[0] as { ok?: boolean; broken_at?: string | null }
  return { ok: row.ok === true, brokenAt: row.broken_at ?? null }
}

export async function triggerWeeklyVerify(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ scanned: number; broken: number } | null> {
  const { data, error } = await supabase.functions.invoke('alerts-audit-verify', {
    body: { organizationId, mode: 'scan' },
  })
  if (error || !data) return null
  return data as { scanned: number; broken: number }
}

export async function replicateEvent(
  supabase: SupabaseClient,
  eventId: string,
): Promise<{ replicated: boolean; target: 'worm_s3' | 'worm_local' | 'skipped' }> {
  const { data, error } = await supabase.functions.invoke('alerts-audit-export', {
    body: { eventId, mode: 'replicate' },
  })
  if (error || !data) return { replicated: false, target: 'skipped' }
  return data as { replicated: boolean; target: 'worm_s3' | 'worm_local' | 'skipped' }
}
