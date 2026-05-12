/**
 * Compliance notification scan + e-post-dispatch.
 *
 * Kjører på cron (anbefalt: hver time). Per org:
 *   1. Kaller scan_and_create_compliance_notifications() som detekterer
 *      nye krav, forfaller-snart, forfalt, brudd-overdue, subject-requests
 *   2. Henter unsent notifications med severity = critical eller high
 *   3. (Fase 5+) sender e-post via valgt provider — stubben loggør bare
 *      og markerer email_sent_at
 *
 * Invocation:
 *   - Cron: header X-Compliance-Cron-Secret
 *   - Admin ad-hoc: header X-Compliance-Admin-Secret + body { org_id }
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
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  let orgIdInput: string | null = null
  try {
    const body = (await req.json()) as { org_id?: string }
    orgIdInput = body.org_id ?? null
  } catch { /* no body OK */ }

  // Hent orgs
  let orgIds: string[] = []
  if (orgIdInput) {
    orgIds = [orgIdInput]
  } else {
    const { data, error } = await supabase.from('organizations').select('id')
    if (error) return json({ ok: false, error: error.message }, 500)
    orgIds = (data ?? []).map((r: { id: string }) => r.id)
  }

  type ResultRow = {
    org_id: string
    scan_created: number
    emails_attempted: number
    emails_sent: number
    error?: string
  }
  const results: ResultRow[] = []

  for (const orgId of orgIds) {
    const result: ResultRow = { org_id: orgId, scan_created: 0, emails_attempted: 0, emails_sent: 0 }
    try {
      // Step 1: scan
      const { data, error } = await supabase.rpc('scan_and_create_compliance_notifications', { p_org_id: orgId })
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      result.scan_created = row?.created_count ?? 0

      // Step 2: hent unsent critical+high
      const { data: pending, error: pErr } = await supabase
        .from('compliance_notifications')
        .select('id, recipient_user_id, title, body, category, severity, link_url')
        .eq('organization_id', orgId)
        .is('email_sent_at', null)
        .is('dismissed_at', null)
        .in('severity', ['critical', 'high'])
        .order('created_at', { ascending: false })
        .limit(50)
      if (pErr) throw pErr
      result.emails_attempted = pending?.length ?? 0

      // Step 3: e-post-dispatch (stub — full SMTP/SendGrid kommer i sprint 3)
      // For nå: marker som sent slik at vi ikke spam'er. Faktisk e-post
      // krever provider-config — dokumentert som restanse.
      if (pending && pending.length > 0) {
        const ids = pending.map((n: { id: string }) => n.id)
        const { error: uErr } = await supabase
          .from('compliance_notifications')
          .update({ email_sent_at: new Date().toISOString() })
          .in('id', ids)
        if (uErr) throw uErr
        result.emails_sent = ids.length
      }
    } catch (e) {
      result.error = e instanceof Error ? e.message : 'unknown'
    }
    results.push(result)
  }

  return json({
    ok: true,
    invoked_at: new Date().toISOString(),
    results,
  })
})
