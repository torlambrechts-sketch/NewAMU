// Edge wrapper for public submission flows. Multiplexes three modes:
//
//   - { mode: 'submit' (legacy default) | absent | 'submit_v1', ... }
//       → original v1.0 captcha-gated path; calls public_submit_alert RPC.
//   - { mode: 'submit_v2', ... }
//       → v1.1 path with anonymity_mode + encrypted columns + intake form
//         version FK; calls public_submit_alert_v2.
//   - { mode: 'register_voice', orgSlug, storagePath, durationSeconds, requestTranscription }
//       → inserts an alert_voice_intake row via service_role (RLS blocks
//         client insert). Optionally fires alerts-voice-transcribe.
//
// IP-header scrubbing per §4.1 T3: IP is read once for captcha, then headers
// are not forwarded. Cloudflare Turnstile / hCaptcha env-gated.

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

type LegacyBody = {
  mode?: 'submit' | 'submit_v1'
  orgSlug?: string
  templateSlug?: string
  payload?: Record<string, unknown>
  captchaToken?: string | null
}

type V2Body = {
  mode: 'submit_v2'
  orgSlug: string
  templateSlug: string
  intakeFormVersionId: string
  anonymityMode: 'fully_anonymous' | 'pseudonymous' | 'confidential' | 'open'
  payload: Record<string, unknown>
  titleEncryptedHex?: string | null
  descriptionEncryptedHex?: string | null
  titleKeyVersion?: number | null
  descriptionKeyVersion?: number | null
  reporterIdentifierEncryptedHex?: string | null
  reporterIdentifierKeyVersion?: number | null
  reporterEmailHashedHex?: string | null
  voiceIntakeId?: string | null
  draftAccessKey?: string | null
  submissionLocale?: string
  captchaToken?: string | null
}

type RegisterVoiceBody = {
  mode: 'register_voice'
  orgSlug: string
  storagePath: string
  durationSeconds: number
  requestTranscription?: boolean
}

type RequestBody = LegacyBody | V2Body | RegisterVoiceBody

async function verifyCaptcha(token: string, ip: string): Promise<boolean> {
  const provider = (Deno.env.get('ALERT_CAPTCHA_PROVIDER') ?? 'turnstile').toLowerCase()
  const secret = Deno.env.get('ALERT_CAPTCHA_SECRET') ?? ''
  if (!secret) return false
  const verifierUrl = provider === 'hcaptcha'
    ? 'https://hcaptcha.com/siteverify'
    : 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
  const body = new URLSearchParams()
  body.set('secret', secret)
  body.set('response', token)
  if (ip) body.set('remoteip', ip)
  const res = await fetch(verifierUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) return false
  const j = (await res.json()) as { success?: boolean }
  return j.success === true
}

function scrubIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    ''
  )
}

async function jitter(): Promise<void> {
  const ms = 50 + Math.floor(Math.random() * 150)
  await new Promise((resolve) => setTimeout(resolve, ms))
}

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

  const ip = scrubIp(req)
  const captchaRequired = (Deno.env.get('ALERT_CAPTCHA_REQUIRED') ?? 'true').toLowerCase() !== 'false'

  // ── register_voice ─────────────────────────────────────────────────────
  if (body.mode === 'register_voice') {
    // Look up org_id from slug.
    const orgRes = await fetch(
      `${SUPABASE_URL}/rest/v1/organizations?select=id&alerts_public_slug=eq.${encodeURIComponent(body.orgSlug)}`,
      { headers: { apikey: SERVICE_ROLE, authorization: `Bearer ${SERVICE_ROLE}` } },
    )
    const orgRows = (await orgRes.json()) as Array<{ id: string }>
    if (orgRows.length === 0) return json({ ok: false, error: 'org_not_found' }, 404)
    const orgId = orgRows[0]!.id
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/alert_voice_intake`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE,
        authorization: `Bearer ${SERVICE_ROLE}`,
        'content-type': 'application/json',
        prefer: 'return=representation',
      },
      body: JSON.stringify({
        organization_id: orgId,
        storage_bucket: 'alert-attachments',
        storage_path: body.storagePath,
        duration_seconds: body.durationSeconds,
        transcription_status: body.requestTranscription ? 'queued' : 'not_requested',
      }),
    })
    if (!insertRes.ok) return json({ ok: false, error: 'voice_insert_failed' }, 500)
    const rows = (await insertRes.json()) as Array<{ id: string }>
    const voiceIntakeId = rows[0]?.id ?? null
    // Fire-and-forget transcription if requested and enabled.
    if (voiceIntakeId && body.requestTranscription &&
        (Deno.env.get('ALERTS_WHISPER_ENABLED') ?? 'false').toLowerCase() === 'true') {
      fetch(`${SUPABASE_URL}/functions/v1/alerts-voice-transcribe`, {
        method: 'POST',
        headers: {
          apikey: SERVICE_ROLE,
          authorization: `Bearer ${SERVICE_ROLE}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ voiceIntakeId }),
      }).catch(() => null)
    }
    return json({ voiceIntakeId })
  }

  // ── submit_v2 ──────────────────────────────────────────────────────────
  if (body.mode === 'submit_v2') {
    if (!body.orgSlug || !body.templateSlug || !body.intakeFormVersionId || !body.anonymityMode) {
      return json({ ok: false, error: 'missing_fields' }, 400)
    }
    if (captchaRequired) {
      if (!body.captchaToken) {
        await jitter()
        return json({ ok: false, error: 'captcha_required' }, 400)
      }
      const ok = await verifyCaptcha(body.captchaToken, ip)
      if (!ok) {
        await jitter()
        return json({ ok: false, error: 'captcha_failed' }, 400)
      }
    }
    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/public_submit_alert_v2`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE,
        authorization: `Bearer ${SERVICE_ROLE}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        p_org_slug: body.orgSlug,
        p_system_template_id: body.templateSlug,
        p_intake_form_version_id: body.intakeFormVersionId,
        p_anonymity_mode: body.anonymityMode,
        p_payload: body.payload,
        p_title_encrypted: body.titleEncryptedHex ?? null,
        p_description_encrypted: body.descriptionEncryptedHex ?? null,
        p_reporter_identifier_encrypted: body.reporterIdentifierEncryptedHex ?? null,
        p_reporter_identifier_key_version: body.reporterIdentifierKeyVersion ?? null,
        p_reporter_email_hashed: body.reporterEmailHashedHex ?? null,
        p_title_key_version: body.titleKeyVersion ?? null,
        p_description_key_version: body.descriptionKeyVersion ?? null,
        p_voice_intake_id: body.voiceIntakeId ?? null,
        p_draft_access_key: body.draftAccessKey ?? null,
        p_submission_locale: body.submissionLocale ?? 'nb',
      }),
    })
    const data = await rpcRes.json()
    await jitter()
    if (!rpcRes.ok) return json({ ok: false, error: 'rpc_failed', detail: data }, rpcRes.status)
    if (Array.isArray(data) && data.length > 0) {
      const row = data[0] as { case_id: string; access_key: string; case_number: string }
      return json({ caseId: row.case_id, accessKey: row.access_key, caseNumber: row.case_number })
    }
    return json({ ok: false, error: 'rpc_empty' }, 500)
  }

  // ── legacy submit (v1.0) ──────────────────────────────────────────────
  const legacy = body as LegacyBody
  if (!legacy.orgSlug || !legacy.templateSlug || !legacy.payload) {
    return json({ ok: false, error: 'missing_fields' }, 400)
  }
  if (captchaRequired) {
    if (!legacy.captchaToken) return json({ ok: false, error: 'captcha_required' }, 400)
    const ok = await verifyCaptcha(legacy.captchaToken, ip)
    if (!ok) return json({ ok: false, error: 'captcha_failed' }, 400)
  }
  const callerAuth = req.headers.get('authorization')
  const useServiceRole = !callerAuth || !callerAuth.toLowerCase().startsWith('bearer ')
  const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/public_submit_alert`, {
    method: 'POST',
    headers: useServiceRole
      ? { apikey: SERVICE_ROLE, authorization: `Bearer ${SERVICE_ROLE}`, 'content-type': 'application/json' }
      : { apikey: SERVICE_ROLE, authorization: callerAuth!, 'content-type': 'application/json' },
    body: JSON.stringify({
      p_org_slug: legacy.orgSlug,
      p_template_slug: legacy.templateSlug,
      p_payload: legacy.payload,
      p_captcha_token: null,
    }),
  })
  const data = await rpcRes.json()
  return json(data, rpcRes.status)
})
