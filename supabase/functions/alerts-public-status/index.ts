// Edge wrapper for public.public_alert_status — implements §4.1 T4
// brute-force rate limit.
//
// Salt is deterministic per-day: sha256(ALERT_THROTTLE_SECRET + YYYY-MM-DD).
// This avoids the per-instance-memory cold-start problem (the prior
// implementation generated a UUID per Deno instance, which an attacker
// could defeat by triggering cold starts until each got their own salt).
// The secret stays in env; only the hash reaches the throttle table.

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const HOURLY_CAP = 10

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function hashIp(ip: string): Promise<string> {
  const day = new Date().toISOString().slice(0, 10)
  const secret =
    Deno.env.get('ALERT_THROTTLE_SECRET') ?? Deno.env.get('SUPABASE_URL') ?? 'unconfigured'
  const saltHash = await sha256Hex(`${secret}|${day}`)
  return sha256Hex(`${ip}::${saltHash}`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  let body: { accessKey?: string }
  try { body = await req.json() } catch { return json({ ok: false, error: 'invalid_body' }, 400) }
  if (!body.accessKey) return json({ ok: false, error: 'missing_access_key' }, 400)

  const ip =
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  const ipHash = await hashIp(ip)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ ok: false, error: 'misconfigured' }, 500)

  const throttleRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/alerts_record_status_attempt`, {
    method: 'POST',
    headers: { apikey: SERVICE_ROLE, authorization: `Bearer ${SERVICE_ROLE}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_ip_hash: ipHash }),
  })
  if (!throttleRes.ok) return json({ ok: false, error: 'throttle_error' }, 500)
  const attempts = (await throttleRes.json()) as number
  if (attempts > HOURLY_CAP) return json({ ok: false, error: 'too_many_attempts', retryAfterSec: 3600 }, 429)

  const statusRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/public_alert_status`, {
    method: 'POST',
    headers: { apikey: SERVICE_ROLE, authorization: `Bearer ${SERVICE_ROLE}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_access_key: body.accessKey }),
  })
  const data = await statusRes.json()
  return json(data, statusRes.status)
})
