// Hard-delete attachment storage objects after the SQL retention purge
// marked them is_redacted=true. The SQL purge marks the row but the
// actual bytes remain in the bucket until this function runs.
//
// Runs daily via cron. Authenticates via service_role; verify_jwt=false.
// Requires x-cron-secret header matching ALERT_PURGE_CRON_SECRET env.

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
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
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ ok: false, error: 'misconfigured' }, 500)

  const cronSecret = Deno.env.get('ALERT_PURGE_CRON_SECRET') ?? ''
  if (cronSecret) {
    const provided = req.headers.get('x-cron-secret') ?? ''
    if (provided !== cronSecret) return json({ ok: false, error: 'unauthorized' }, 401)
  }

  const listRes = await fetch(
    `${SUPABASE_URL}/rest/v1/alert_case_attachments?select=id,storage_path&is_redacted=eq.true&storage_path=not.is.null&limit=500`,
    { headers: { apikey: SERVICE_ROLE, authorization: `Bearer ${SERVICE_ROLE}` } },
  )
  if (!listRes.ok) return json({ ok: false, error: 'list_failed', status: listRes.status }, 500)
  const rows = (await listRes.json()) as Array<{ id: string; storage_path: string }>
  if (rows.length === 0) return json({ ok: true, deleted: 0 })

  const paths = rows.map((r) => r.storage_path).filter((p): p is string => !!p)
  let deleted = 0
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100)
    const delRes = await fetch(`${SUPABASE_URL}/storage/v1/object/alert-attachments`, {
      method: 'DELETE',
      headers: {
        apikey: SERVICE_ROLE,
        authorization: `Bearer ${SERVICE_ROLE}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ prefixes: batch }),
    })
    if (delRes.ok) deleted += batch.length
  }

  const ids = rows.map((r) => r.id)
  await fetch(`${SUPABASE_URL}/rest/v1/alert_case_attachments?id=in.(${ids.join(',')})`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_ROLE,
      authorization: `Bearer ${SERVICE_ROLE}`,
      'content-type': 'application/json',
      prefer: 'return=minimal',
    },
    body: JSON.stringify({ storage_path: null }),
  })

  return json({ ok: true, deleted })
})
