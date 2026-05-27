// alerts-audit-export — replicate timeline events to S3 Object Lock (WORM)
// or, when S3 is not configured, to the local alert_worm_local table.
//
// Production env vars:
//   ALERTS_WORM_S3_BUCKET, ALERTS_WORM_S3_REGION, ALERTS_WORM_S3_ENDPOINT?
//   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (or AWS_SESSION_TOKEN)
// Dev: missing → falls back to alert_worm_local.

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

type ReplicateBody = { eventId: string; mode: 'replicate' }

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function putToS3(bucket: string, region: string, key: string, body: string): Promise<boolean> {
  // Minimal SigV4 PUT with Object Lock retention. Implements the
  // x-amz-object-lock-mode=COMPLIANCE + retain-until header set so the
  // bucket policy holds the object immutable.
  const accessKey = Deno.env.get('AWS_ACCESS_KEY_ID')
  const secretKey = Deno.env.get('AWS_SECRET_ACCESS_KEY')
  const sessionToken = Deno.env.get('AWS_SESSION_TOKEN')
  if (!accessKey || !secretKey) return false

  const endpoint = Deno.env.get('ALERTS_WORM_S3_ENDPOINT') ?? `https://${bucket}.s3.${region}.amazonaws.com`
  const host = new URL(endpoint).host
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const retainUntil = new Date(now.getTime() + 7 * 365 * 24 * 60 * 60 * 1000).toISOString()

  const payloadHash = await sha256Hex(body)
  const headerEntries: Array<[string, string]> = [
    ['host', host],
    ['x-amz-content-sha256', payloadHash],
    ['x-amz-date', amzDate],
    ['x-amz-object-lock-mode', 'COMPLIANCE'],
    ['x-amz-object-lock-retain-until-date', retainUntil],
  ]
  if (sessionToken) headerEntries.push(['x-amz-security-token', sessionToken])
  headerEntries.sort((a, b) => a[0].localeCompare(b[0]))

  const canonicalHeaders = headerEntries.map(([k, v]) => `${k}:${v}\n`).join('')
  const signedHeaders = headerEntries.map(([k]) => k).join(';')
  const canonicalRequest = [
    'PUT',
    `/${encodeURIComponent(key)}`,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n')

  async function hmac(key: Uint8Array, data: string): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey(
      'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data))
    return new Uint8Array(sig)
  }

  const kDate = await hmac(new TextEncoder().encode(`AWS4${secretKey}`), dateStamp)
  const kRegion = await hmac(kDate, region)
  const kService = await hmac(kRegion, 's3')
  const kSigning = await hmac(kService, 'aws4_request')
  const signature = Array.from(await hmac(kSigning, stringToSign))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  const authHeader =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`

  const res = await fetch(`${endpoint}/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: {
      ...Object.fromEntries(headerEntries),
      authorization: authHeader,
    },
    body,
  })
  return res.ok
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  let body: ReplicateBody
  try {
    body = (await req.json()) as ReplicateBody
  } catch {
    return json({ ok: false, error: 'invalid_body' }, 400)
  }
  if (!body.eventId) return json({ ok: false, error: 'missing_event_id' }, 400)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ ok: false, error: 'misconfigured' }, 500)

  const headers = {
    apikey: SERVICE_ROLE,
    authorization: `Bearer ${SERVICE_ROLE}`,
    'content-type': 'application/json',
  }

  const eventRes = await fetch(
    `${SUPABASE_URL}/rest/v1/alert_case_timeline_events?id=eq.${encodeURIComponent(body.eventId)}&select=*`,
    { headers },
  )
  if (!eventRes.ok) return json({ ok: false, error: 'fetch_event_failed' }, 500)
  const rows = (await eventRes.json()) as Array<Record<string, unknown>>
  if (rows.length === 0) return json({ ok: false, error: 'event_not_found' }, 404)
  const event = rows[0]!

  const s3Bucket = Deno.env.get('ALERTS_WORM_S3_BUCKET')
  const s3Region = Deno.env.get('ALERTS_WORM_S3_REGION')

  if (s3Bucket && s3Region) {
    const key = `audit/${event.organization_id}/${event.case_id}/${body.eventId}.json`
    const payload = JSON.stringify(event)
    const ok = await putToS3(s3Bucket, s3Region, key, payload)
    if (ok) return json({ replicated: true, target: 'worm_s3' })
    // S3 failed → fall through to local fallback.
  }

  // Dev / fallback: write to alert_worm_local.
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/alert_worm_local`, {
    method: 'POST',
    headers: { ...headers, prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify({
      event_id: body.eventId,
      organization_id: event.organization_id,
      case_id: event.case_id,
      event_hash: event.event_hash,
      canonical_payload: event.canonical_payload,
    }),
  })
  if (!insertRes.ok && insertRes.status !== 409) {
    return json({ replicated: false, target: 'skipped', error: await insertRes.text() }, 500)
  }
  return json({ replicated: true, target: 'worm_local' })
})
