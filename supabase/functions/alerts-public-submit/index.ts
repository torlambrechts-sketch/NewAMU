// Edge wrapper for public.public_submit_alert — implements §4.1 T9 captcha
// verification. Verifies Cloudflare Turnstile token (or hCaptcha fallback)
// before invoking the RPC.
//
// Production: ALERT_CAPTCHA_SECRET + ALERT_CAPTCHA_PROVIDER env vars set.
// Dev: ALERT_CAPTCHA_REQUIRED=false → captcha verification skipped, RPC
// still invoked.
//
// IP header scrubbing per §4.1 T3: the IP is read ONCE for captcha
// verification (Turnstile/hCaptcha accept the client IP as an optional
// hint for fraud scoring) and is never forwarded to the RPC nor logged
// outside the captcha provider's domain.

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

type SubmitBody = {
  orgSlug?: string
  templateSlug?: string
  payload?: Record<string, unknown>
  captchaToken?: string | null
}

async function verifyTurnstile(token: string, ip: string, secret: string): Promise<boolean> {
  const body = new URLSearchParams()
  body.set('secret', secret)
  body.set('response', token)
  if (ip) body.set('remoteip', ip)
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) return false
  const j = (await res.json()) as { success?: boolean }
  return j.success === true
}

async function verifyHcaptcha(token: string, ip: string, secret: string): Promise<boolean> {
  const body = new URLSearchParams()
  body.set('secret', secret)
  body.set('response', token)
  if (ip) body.set('remoteip', ip)
  const res = await fetch('https://hcaptcha.com/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) return false
  const j = (await res.json()) as { success?: boolean }
  return j.success === true
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  let body: SubmitBody
  try { body = await req.json() } catch { return json({ ok: false, error: 'invalid_body' }, 400) }
  if (!body.orgSlug || !body.templateSlug || !body.payload) {
    return json({ ok: false, error: 'missing_fields' }, 400)
  }

  const captchaRequired = (Deno.env.get('ALERT_CAPTCHA_REQUIRED') ?? 'true').toLowerCase() !== 'false'
  if (captchaRequired) {
    const provider = (Deno.env.get('ALERT_CAPTCHA_PROVIDER') ?? 'turnstile').toLowerCase()
    const secret = Deno.env.get('ALERT_CAPTCHA_SECRET') ?? ''
    if (!secret) return json({ ok: false, error: 'captcha_misconfigured' }, 500)
    if (!body.captchaToken) return json({ ok: false, error: 'captcha_required' }, 400)
    const ip =
      req.headers.get('cf-connecting-ip') ??
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      ''
    const verifier = provider === 'hcaptcha' ? verifyHcaptcha : verifyTurnstile
    const ok = await verifier(body.captchaToken, ip, secret)
    if (!ok) return json({ ok: false, error: 'captcha_failed' }, 400)
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ ok: false, error: 'misconfigured' }, 500)

  // Forward the caller's session if any (so identified employees get
  // reporter_user_id populated). Anonymous calls go through service_role.
  const callerAuth = req.headers.get('authorization')
  const useServiceRole = !callerAuth || !callerAuth.toLowerCase().startsWith('bearer ')

  const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/public_submit_alert`, {
    method: 'POST',
    headers: useServiceRole
      ? {
          apikey: SERVICE_ROLE,
          authorization: `Bearer ${SERVICE_ROLE}`,
          'content-type': 'application/json',
        }
      : {
          apikey: SERVICE_ROLE,
          authorization: callerAuth!,
          'content-type': 'application/json',
        },
    body: JSON.stringify({
      p_org_slug: body.orgSlug,
      p_template_slug: body.templateSlug,
      p_payload: body.payload,
      p_captcha_token: null,
    }),
  })
  const data = await rpcRes.json()
  return json(data, rpcRes.status)
})
