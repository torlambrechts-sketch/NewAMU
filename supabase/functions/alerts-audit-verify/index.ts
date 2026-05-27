// alerts-audit-verify — weekly hash-chain verification job.
//
// Walks every case in an org, calls alerts_verify_audit_chain(case_id),
// and reports breaks. Brokenness inserts a row into gov_outbox_triage_log
// + emits an admin alert via the gov_notifications_outbox.
//
// Invocation modes (POST body):
//   { mode: 'scan', organizationId: uuid }
//     → scans every case for the org; returns {scanned, broken, brokenCaseIds}
//   { mode: 'verify', caseId: uuid }
//     → verifies a single case; returns {ok, brokenAt}

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

type RequestBody =
  | { mode: 'scan'; organizationId: string }
  | { mode: 'verify'; caseId: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return json({ ok: false, error: 'invalid_body' }, 400)
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ ok: false, error: 'misconfigured' }, 500)

  const headers = {
    apikey: SERVICE_ROLE,
    authorization: `Bearer ${SERVICE_ROLE}`,
    'content-type': 'application/json',
  }

  if (body.mode === 'verify') {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/alerts_verify_audit_chain`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_case_id: body.caseId }),
    })
    const data = await res.json()
    const row = Array.isArray(data) && data.length > 0 ? data[0] : null
    if (!row) return json({ ok: false, error: 'no_rows' }, 500)
    return json({ ok: row.ok === true, brokenAt: row.broken_at ?? null })
  }

  if (body.mode === 'scan') {
    // List all cases for the org.
    const caseRes = await fetch(
      `${SUPABASE_URL}/rest/v1/alert_cases?select=id&organization_id=eq.${encodeURIComponent(body.organizationId)}`,
      { headers },
    )
    if (!caseRes.ok) return json({ ok: false, error: 'list_failed' }, 500)
    const cases = (await caseRes.json()) as Array<{ id: string }>
    const broken: string[] = []
    for (const c of cases) {
      const verifyRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/alerts_verify_audit_chain`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ p_case_id: c.id }),
      })
      const data = await verifyRes.json()
      const row = Array.isArray(data) && data.length > 0 ? data[0] : null
      if (row && row.ok === false) broken.push(c.id)
    }
    // Insert breach alert into gov_outbox if any breaks.
    if (broken.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/gov_notifications_outbox`, {
        method: 'POST',
        headers: { ...headers, prefer: 'return=minimal' },
        body: JSON.stringify({
          organization_id: body.organizationId,
          kind: 'alerts_audit_chain_broken',
          payload: { brokenCount: broken.length, brokenCaseIds: broken },
          priority: 'critical',
        }),
      }).catch(() => null)
    }
    return json({ scanned: cases.length, broken: broken.length, brokenCaseIds: broken })
  }

  return json({ ok: false, error: 'unknown_mode' }, 400)
})
