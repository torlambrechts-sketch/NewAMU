/**
 * workflow-auditor-view — signed-token read-only API for external auditors.
 *
 * Auth: a token in the Authorization Bearer header OR ?token=… query
 * param. The token must exist in workflow_auditor_tokens (not revoked,
 * not expired). workflow_verify_auditor_token returns the scope_filter
 * which we apply at query time.
 *
 * Returns:
 *   * workflow_runs in the scoped date range
 *   * workflow_run_evidence in the scoped date range, filtered by
 *     law_refs and frameworks if the token's scope_filter specifies them
 *   * workflow_rule_revisions for any rule referenced by the visible runs
 *
 * Confidential runs are ALWAYS hidden in the auditor view — the user
 * who minted the token can include_confidential=false in scope_filter
 * to be explicit, but the function defaults to standard-only.
 *
 * The auditor never sees real identifiers (auth.uid, profile names) —
 * only run/evidence rows + checksums + sha256 chain.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ ok: false, error: 'missing_env' }, 500)

  const url = new URL(req.url)
  const headerToken = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const queryToken = url.searchParams.get('token')
  const token = headerToken || queryToken
  if (!token) return json({ ok: false, error: 'missing_token' }, 401)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

  const { data: tokenRows, error: vErr } = await supabase.rpc('workflow_verify_auditor_token', { p_token: token })
  if (vErr) return json({ ok: false, error: 'verify_failed', detail: vErr.message }, 500)
  const tokenRow = (tokenRows as Array<{
    id: string
    organization_id: string
    label: string
    scope_filter: Record<string, unknown>
    expires_at: string
  }> | null)?.[0]
  if (!tokenRow) return json({ ok: false, error: 'invalid_or_expired_token' }, 403)

  const scope = (tokenRow.scope_filter ?? {}) as {
    date_from?: string
    date_to?: string
    law_refs?: string[]
    frameworks?: string[]
  }

  const dateFrom = scope.date_from ?? new Date(Date.now() - 365 * 86400_000).toISOString()
  const dateTo = scope.date_to ?? new Date().toISOString()

  // 1) Runs (standard confidentiality only).
  const { data: runs, error: rErr } = await supabase
    .from('workflow_runs')
    .select('id, rule_id, source_module, event, status, input_checksum, dry_run, confidentiality_level, created_at')
    .eq('organization_id', tokenRow.organization_id)
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo)
    .in('confidentiality_level', ['standard'])
    .order('created_at', { ascending: false })
    .limit(500)
  if (rErr) return json({ ok: false, error: 'runs_failed', detail: rErr.message }, 500)

  const runRows = runs ?? []
  const ruleIds = [...new Set(runRows.map((r) => r.rule_id).filter(Boolean))] as string[]

  // 2) Evidence in the scope window + law-ref / framework filters.
  let evQ = supabase
    .from('workflow_run_evidence')
    .select('id, run_id, rule_id, artefact_kind, storage_path, sha256_checksum, chain_root_checksum, law_refs, frameworks, created_at')
    .eq('organization_id', tokenRow.organization_id)
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo)
    .order('created_at', { ascending: false })
  if (scope.law_refs && scope.law_refs.length > 0) evQ = evQ.overlaps('law_refs', scope.law_refs)
  if (scope.frameworks && scope.frameworks.length > 0) evQ = evQ.overlaps('frameworks', scope.frameworks)
  const { data: evidence, error: eErr } = await evQ
  if (eErr) return json({ ok: false, error: 'evidence_failed', detail: eErr.message }, 500)

  // 3) Rule names + revision counts so the auditor can correlate.
  let ruleSummaries: Array<{ id: string; name: string; revisionCount: number }> = []
  if (ruleIds.length > 0) {
    const { data: rules } = await supabase
      .from('workflow_rules')
      .select('id, name')
      .in('id', ruleIds)
    const { data: revisions } = await supabase
      .from('workflow_rule_revisions')
      .select('rule_id')
      .in('rule_id', ruleIds)
    const revCount = new Map<string, number>()
    ;(revisions ?? []).forEach((r) => {
      const k = (r as { rule_id: string }).rule_id
      revCount.set(k, (revCount.get(k) ?? 0) + 1)
    })
    ruleSummaries = (rules ?? []).map((r) => ({
      id: (r as { id: string }).id,
      name: (r as { name: string }).name,
      revisionCount: revCount.get((r as { id: string }).id) ?? 0,
    }))
  }

  return json({
    ok: true,
    token: { id: tokenRow.id, label: tokenRow.label, expiresAt: tokenRow.expires_at },
    scope: { dateFrom, dateTo, lawRefs: scope.law_refs ?? [], frameworks: scope.frameworks ?? [] },
    runs: runRows,
    evidence: evidence ?? [],
    rules: ruleSummaries,
  })
})
