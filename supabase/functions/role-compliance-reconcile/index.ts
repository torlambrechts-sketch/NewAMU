/**
 * Nightly role-compliance reconcile.
 *
 * Kjører reconcile_role_requirements() for hver organisasjon. Materialiserer
 * manglende instanser, marker fullført via 3-veis join (learning_progress,
 * wiki_compliance_receipts, bankid_signatures), markerer overdue/superseded
 * og waived. Idempotent — trygt å kjøre om igjen.
 *
 * Schedule anbefales: hver natt 02:00 norsk tid via pg_cron eller GitHub
 * Actions / Supabase Scheduled Functions.
 *
 * Invocation: POST med header X-Compliance-Cron-Secret og body
 *   { "cron_role_compliance_reconcile": true }
 *
 * Eller ad-hoc med X-Compliance-Admin-Secret og body
 *   { "org_id": "<uuid>" } for å reconcile bare én org.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-compliance-cron-secret, x-compliance-admin-secret',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const cronSecret = Deno.env.get('COMPLIANCE_CRON_SECRET') ?? ''
  const adminSecret = Deno.env.get('COMPLIANCE_ADMIN_SECRET') ?? ''
  const cronHeader = req.headers.get('x-compliance-cron-secret') ?? ''
  const adminHeader = req.headers.get('x-compliance-admin-secret') ?? ''

  const isCron = cronSecret && cronHeader === cronSecret
  const isAdmin = adminSecret && adminHeader === adminSecret
  if (!isCron && !isAdmin) return json({ ok: false, error: 'unauthorized' }, 401)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ ok: false, error: 'config' }, 500)
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  })

  let orgIdInput: string | null = null
  try {
    const body = (await req.json()) as { org_id?: string }
    orgIdInput = body.org_id ?? null
  } catch {
    // ignore — kall uten body
  }

  // Hent orgs
  let orgIds: string[] = []
  if (orgIdInput) {
    orgIds = [orgIdInput]
  } else {
    const { data, error } = await supabase.from('organizations').select('id')
    if (error) return json({ ok: false, error: error.message }, 500)
    orgIds = (data ?? []).map((r: { id: string }) => r.id)
  }

  const results: Array<{
    org_id: string
    materialized: number
    completed: number
    overdued: number
    superseded: number
    error?: string
  }> = []

  for (const orgId of orgIds) {
    try {
      const { data, error } = await supabase.rpc('reconcile_role_requirements', { p_org_id: orgId })
      if (error) {
        results.push({ org_id: orgId, materialized: 0, completed: 0, overdued: 0, superseded: 0, error: error.message })
        continue
      }
      const row = Array.isArray(data) ? data[0] : data
      results.push({
        org_id: orgId,
        materialized: row?.materialized ?? 0,
        completed: row?.completed ?? 0,
        overdued: row?.overdued ?? 0,
        superseded: row?.superseded ?? 0,
      })
    } catch (e) {
      results.push({
        org_id: orgId,
        materialized: 0,
        completed: 0,
        overdued: 0,
        superseded: 0,
        error: e instanceof Error ? e.message : 'unknown',
      })
    }
  }

  // Sjekk også brudd-deadlines og brudd-due-soon
  const breachStats = await supabase
    .from('gdpr_breach_status_view')
    .select('organization_id, overdue_count, due_within_24h_count')

  const subjectStats = await supabase
    .from('gdpr_subject_requests_status_view')
    .select('organization_id, overdue_count, due_within_7d_count')

  return json({
    ok: true,
    invoked_at: new Date().toISOString(),
    reconcile: results,
    breach_alerts: breachStats.data ?? [],
    subject_request_alerts: subjectStats.data ?? [],
  })
})
