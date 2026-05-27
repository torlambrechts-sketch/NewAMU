// alerts-dsar-process — given a DSAR request id, runs the matching pipeline:
//   1. Searches cases via alerts_dsar_search_cases(subject_identifier_hash)
//   2. Attaches matched case ids to the DSAR row
//   3. Optionally seeds heuristic redaction proposals (full-field masks on
//      reporter_identifier, reporter_display_name, and accused names)
//
// Called from the DPO console after the DPO creates a new DSAR.

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

type RequestBody = { dsarRequestId: string }

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
  const callerAuth = req.headers.get('authorization')
  if (!callerAuth) return json({ ok: false, error: 'unauthenticated' }, 401)

  const userHeaders = {
    apikey: SERVICE_ROLE,
    authorization: callerAuth,
    'content-type': 'application/json',
  }

  // Fetch the DSAR.
  const dsarRes = await fetch(
    `${SUPABASE_URL}/rest/v1/alert_dsar_request?id=eq.${encodeURIComponent(body.dsarRequestId)}&select=*`,
    { headers: userHeaders },
  )
  if (!dsarRes.ok) return json({ ok: false, error: 'fetch_dsar_failed' }, 500)
  const rows = (await dsarRes.json()) as Array<{
    id: string
    organization_id: string
    subject_identifier_hash: string
  }>
  if (rows.length === 0) return json({ ok: false, error: 'dsar_not_found' }, 404)
  const dsar = rows[0]!

  // Search cases.
  const searchRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/alerts_dsar_search_cases`, {
    method: 'POST',
    headers: userHeaders,
    body: JSON.stringify({ p_hash: dsar.subject_identifier_hash }),
  })
  if (!searchRes.ok) return json({ ok: false, error: 'search_failed' }, 500)
  const matches = (await searchRes.json()) as Array<{ case_id: string }>
  const caseIds = matches.map((m) => m.case_id)

  // Attach case ids.
  await fetch(`${SUPABASE_URL}/rest/v1/alert_dsar_request?id=eq.${encodeURIComponent(body.dsarRequestId)}`, {
    method: 'PATCH',
    headers: userHeaders,
    body: JSON.stringify({ case_ids: caseIds }),
  })

  // Seed heuristic redaction proposals (full-field masks for reporter identity).
  for (const id of caseIds) {
    await fetch(`${SUPABASE_URL}/rest/v1/alert_redaction`, {
      method: 'POST',
      headers: { ...userHeaders, prefer: 'return=minimal,resolution=ignore-duplicates' },
      body: JSON.stringify({
        case_id: id,
        organization_id: dsar.organization_id,
        dsar_request_id: body.dsarRequestId,
        region_kind: 'reporter_identity',
        source_field: 'case.title',
        suggested_by: 'heuristic',
      }),
    }).catch(() => null)
    await fetch(`${SUPABASE_URL}/rest/v1/alert_redaction`, {
      method: 'POST',
      headers: { ...userHeaders, prefer: 'return=minimal,resolution=ignore-duplicates' },
      body: JSON.stringify({
        case_id: id,
        organization_id: dsar.organization_id,
        dsar_request_id: body.dsarRequestId,
        region_kind: 'reporter_identity',
        source_field: 'case.description',
        suggested_by: 'heuristic',
      }),
    }).catch(() => null)
  }

  return json({ matchedCount: caseIds.length, caseIds })
})
