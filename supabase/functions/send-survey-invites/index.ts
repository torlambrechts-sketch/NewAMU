/**
 * Survey invitation emails (Resend) + optional webhook + scheduled cron.
 *
 * POST JSON:
 * - Normal: { distribution_id, survey_id, mode?: 'initial'|'reminder'|'scheduled_initial' } + user JWT
 * - Cron: header X-Survey-Cron-Secret + body { "cron_scheduled_initial": true } (uses SUPABASE_SERVICE_ROLE_KEY)
 * - Webhook: POST body Resend event JSON + Authorization: Bearer RESEND_WEBHOOK_SECRET
 *
 * Secrets: RESEND_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (cron),
 *          CRON_SECRET, RESEND_WEBHOOK_SECRET (optional), RESEND_FROM, PUBLIC_APP_URL
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-survey-cron-secret',
}

type InviteRow = {
  id: string
  survey_id: string
  email_snapshot: string | null
  access_token: string | null
  status: string
  email_sent_at: string | null
  reminder_sent_at: string | null
  reminder_count: number | null
}

type SurveySettings = {
  invite_email_subject_template?: string
  invite_email_html_template?: string
  reminder_email_subject_template?: string
  reminder_email_html_template?: string
  max_reminders_per_invitation?: number
  reminder_min_hours_since_last?: number
  email_send_delay_ms?: number
}

function respondJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function buildRespondUrl(baseUrl: string, surveyId: string, token: string): string {
  const origin = baseUrl.replace(/\/$/, '')
  return `${origin}/survey-respond/${encodeURIComponent(surveyId)}?invite=${encodeURIComponent(token)}`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;')
}

function applyTemplate(tpl: string | undefined, vars: Record<string, string>): string {
  let out = tpl ?? ''
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v)
  }
  return out
}

function defaultInviteHtml(title: string, link: string): string {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5">
<p>Hei,</p>
<p>Du er invitert til å svare på undersøkelsen <strong>${escapeHtml(title)}</strong>.</p>
<p><a href="${escapeAttr(link)}">Åpne undersøkelse</a></p>
<p style="font-size:12px;color:#666">Hvis knappen ikke virker, lim inn denne lenken i nettleseren:<br/>${escapeHtml(link)}</p>
</body></html>`
}

function defaultReminderHtml(title: string, link: string): string {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5">
<p>Hei,</p>
<p>Dette er en vennlig påminnelse — vi har ikke registrert svar fra deg ennå.</p>
<p><strong>${escapeHtml(title)}</strong></p>
<p><a href="${escapeAttr(link)}">Åpne undersøkelse</a></p>
<p style="font-size:12px;color:#666">${escapeHtml(link)}</p>
</body></html>`
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchSurveySettings(supabase: SupabaseClient, orgId: string): Promise<SurveySettings> {
  const { data, error } = await supabase.rpc('survey_get_org_settings', {
    p_organization_id: orgId,
  })
  if (error) throw error
  return data && typeof data === 'object' && !Array.isArray(data) ? (data as SurveySettings) : {}
}

async function runInvitationBatch(args: {
  supabase: SupabaseClient
  distributionId: string
  surveyId: string
  organizationId: string
  mode: 'initial' | 'reminder' | 'scheduled_initial'
  skipSurveyClosedCheck?: boolean
}): Promise<{ summary: { total: number; sent: number; failed: number }; results: Array<{ id: string; ok: boolean; error?: string }> }> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const publicAppUrl = (Deno.env.get('PUBLIC_APP_URL') ?? '').trim() || 'http://localhost:5173'
  const fromAddr = (Deno.env.get('RESEND_FROM') ?? '').trim() || 'Survey <onboarding@resend.dev>'
  const defaultDelay = Number(Deno.env.get('EMAIL_SEND_DELAY_MS') ?? '400') || 400

  if (!resendKey) throw new Error('RESEND_API_KEY missing')

  const { data: surveyRow, error: surveyErr } = await supabase
    .from('surveys')
    .select('id, title, organization_id, status')
    .eq('id', args.surveyId)
    .single()
  if (surveyErr || !surveyRow) throw new Error(surveyErr?.message ?? 'Survey not found')

  const survey = surveyRow as { id: string; title?: string; organization_id: string; status: string }
  if (!args.skipSurveyClosedCheck && (survey.status === 'closed' || survey.status === 'archived')) {
    return { summary: { total: 0, sent: 0, failed: 0 }, results: [] }
  }

  const title = String(survey.title ?? 'Undersøkelse')
  const oid = args.organizationId

  const settings = await fetchSurveySettings(supabase, oid)
  const delayMs = Math.min(60000, Math.max(0, settings.email_send_delay_ms ?? defaultDelay))
  const maxRem = settings.max_reminders_per_invitation ?? 3
  const minHours = settings.reminder_min_hours_since_last ?? 72

  const { data: invites, error: invErr } = await supabase
    .from('survey_invitations')
    .select(
      'id, survey_id, email_snapshot, access_token, status, email_sent_at, reminder_sent_at, reminder_count',
    )
    .eq('distribution_id', args.distributionId)
    .eq('survey_id', args.surveyId)
    .eq('status', 'pending')
  if (invErr) throw invErr

  const rowsAll = (invites ?? []) as InviteRow[]
  const now = Date.now()
  const minMs = minHours * 3600000

  let rows: InviteRow[] = rowsAll
  if (args.mode === 'reminder') {
    rows = rowsAll.filter((inv) => {
      if (!inv.email_sent_at) return false
      if (maxRem > 0 && (inv.reminder_count ?? 0) >= maxRem) return false
      const last = inv.reminder_sent_at ?? inv.email_sent_at
      const t = new Date(last).getTime()
      if (now - t < minMs) return false
      return true
    })
  } else if (args.mode === 'scheduled_initial') {
    rows = rowsAll.filter((inv) => !inv.email_sent_at)
  } else {
    rows = rowsAll.filter((inv) => !inv.email_sent_at)
  }

  const results: Array<{ id: string; ok: boolean; error?: string }> = []

  for (let i = 0; i < rows.length; i += 1) {
    const inv = rows[i]!
    if (args.mode === 'initial' && inv.email_sent_at) {
      results.push({ id: inv.id, ok: true })
      continue
    }

    const email = inv.email_snapshot?.trim()
    if (!email) {
      await supabase
        .from('survey_invitations')
        .update({ email_send_error: 'Mangler e-postadresse på profilen' })
        .eq('id', inv.id)
      results.push({ id: inv.id, ok: false, error: 'no_email' })
      continue
    }
    if (!inv.access_token) {
      await supabase
        .from('survey_invitations')
        .update({ email_send_error: 'Mangler invitasjonstoken' })
        .eq('id', inv.id)
      results.push({ id: inv.id, ok: false, error: 'no_token' })
      continue
    }

    const link = buildRespondUrl(publicAppUrl, inv.survey_id, inv.access_token)
    const vars = { title, link, survey_title: title }

    const subject =
      args.mode === 'reminder'
        ? applyTemplate(settings.reminder_email_subject_template, vars).trim() || `Påminnelse: ${title}`
        : applyTemplate(settings.invite_email_subject_template, vars).trim() || `Undersøkelse: ${title}`

    const htmlBody =
      args.mode === 'reminder'
        ? (() => {
            const t = settings.reminder_email_html_template?.trim()
            return t ? applyTemplate(t, vars) : defaultReminderHtml(title, link)
          })()
        : (() => {
            const t = settings.invite_email_html_template?.trim()
            return t ? applyTemplate(t, vars) : defaultInviteHtml(title, link)
          })()

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddr,
        to: [email],
        subject,
        html: htmlBody,
      }),
    })

    const resBody = await res.text()
    let resendId: string | null = null
    try {
      const j = JSON.parse(resBody) as { id?: string }
      resendId = j.id ?? null
    } catch {
      /* ignore */
    }

    if (!res.ok) {
      const msg = `Resend ${res.status}: ${resBody.slice(0, 500)}`
      await supabase.from('survey_invitations').update({ email_send_error: msg }).eq('id', inv.id)
      results.push({ id: inv.id, ok: false, error: msg })
      continue
    }

    const sentAt = new Date().toISOString()
    if (args.mode === 'reminder') {
      await supabase
        .from('survey_invitations')
        .update({
          reminder_sent_at: sentAt,
          reminder_count: (inv.reminder_count ?? 0) + 1,
          resend_email_id: resendId,
          email_send_error: null,
          email_delivery_status: 'queued',
        })
        .eq('id', inv.id)
    } else {
      await supabase
        .from('survey_invitations')
        .update({
          email_sent_at: sentAt,
          resend_email_id: resendId,
          email_send_error: null,
          email_delivery_status: 'queued',
        })
        .eq('id', inv.id)
    }
    results.push({ id: inv.id, ok: true })

    if (i < rows.length - 1 && delayMs > 0) {
      await sleep(delayMs)
    }
  }

  const sent = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  return { summary: { total: rows.length, sent, failed }, results }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('CRON_SECRET')
  const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')

  if (!supabaseUrl || !supabaseAnon) {
    return respondJson({ error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY' }, 503)
  }

  /* ─── Resend delivery webhook (Bearer secret) ─── */
  const authHdr = req.headers.get('Authorization')
  if (req.method === 'POST' && authHdr === `Bearer ${webhookSecret}` && webhookSecret) {
    let payload: { type?: string; data?: { email_id?: string } }
    try {
      payload = (await req.json()) as { type?: string; data?: { email_id?: string } }
    } catch {
      return respondJson({ error: 'Invalid JSON' }, 400)
    }
    const emailId = payload.data?.email_id
    const ev = payload.type ?? ''
    if (!emailId) return respondJson({ ok: true, ignored: true })

    const admin = createClient(supabaseUrl, serviceKey ?? supabaseAnon)
    let status: string | null = null
    if (ev.includes('delivered')) status = 'delivered'
    else if (ev.includes('bounce') || ev.includes('failed')) status = 'failed'
    else if (ev.includes('sent')) status = 'sent'

    const patch: Record<string, unknown> = {}
    if (status) patch.email_delivery_status = status
    if (ev.includes('bounce') || ev.includes('failed')) {
      patch.email_send_error = ev.slice(0, 200)
    }

    const { error: upErr } = await admin
      .from('survey_invitations')
      .update(patch)
      .eq('resend_email_id', emailId)
    if (upErr) return respondJson({ error: upErr.message }, 500)
    return respondJson({ ok: true })
  }

  /* ─── Cron: scheduled initial sends ─── */
  if (req.method === 'POST' && req.headers.get('X-Survey-Cron-Secret') === cronSecret && cronSecret && serviceKey) {
    let body: { cron_scheduled_initial?: boolean }
    try {
      body = (await req.json()) as { cron_scheduled_initial?: boolean }
    } catch {
      body = {}
    }
    if (!body.cron_scheduled_initial) {
      return respondJson({ error: 'Expected { cron_scheduled_initial: true }' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const nowIso = new Date().toISOString()

    const { data: dists, error: dErr } = await admin
      .from('survey_distributions')
      .select('id, survey_id, organization_id, scheduled_initial_send_at, initial_send_started_at, status')
      .eq('status', 'generated')
      .not('scheduled_initial_send_at', 'is', null)
      .lte('scheduled_initial_send_at', nowIso)
      .is('initial_send_started_at', null)

    if (dErr) return respondJson({ error: dErr.message }, 500)

    const processed: unknown[] = []
    for (const d of dists ?? []) {
      const row = d as {
        id: string
        survey_id: string
        organization_id: string
      }
      await admin
        .from('survey_distributions')
        .update({ initial_send_started_at: nowIso })
        .eq('id', row.id)

      const batch = await runInvitationBatch({
        supabase: admin,
        distributionId: row.id,
        surveyId: row.survey_id,
        organizationId: row.organization_id,
        mode: 'scheduled_initial',
        skipSurveyClosedCheck: false,
      })
      processed.push({ distribution_id: row.id, ...batch.summary })
    }

    return respondJson({ ok: true, cron: true, processed })
  }

  if (req.method !== 'POST') {
    return respondJson({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return respondJson({ error: 'Missing Authorization' }, 401)
  }

  let body: { distribution_id?: string; survey_id?: string; mode?: string }
  try {
    body = (await req.json()) as { distribution_id?: string; survey_id?: string; mode?: string }
  } catch {
    return respondJson({ error: 'Invalid JSON' }, 400)
  }

  const distributionId = body.distribution_id?.trim()
  const surveyId = body.survey_id?.trim()
  const modeRaw = body.mode ?? 'initial'
  const mode =
    modeRaw === 'reminder'
      ? 'reminder'
      : modeRaw === 'scheduled_initial'
        ? 'scheduled_initial'
        : 'initial'

  if (!distributionId || !surveyId) {
    return respondJson({ error: 'distribution_id and survey_id required' }, 400)
  }

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  })

  const { error: gateErr } = await supabase.rpc('survey_check_distribution_send_access', {
    p_distribution_id: distributionId,
    p_survey_id: surveyId,
  })
  if (gateErr) {
    return respondJson({ error: gateErr.message }, 403)
  }

  const { data: distRow } = await supabase
    .from('survey_distributions')
    .select('organization_id')
    .eq('id', distributionId)
    .single()
  const orgId = (distRow as { organization_id?: string } | null)?.organization_id
  if (!orgId) return respondJson({ error: 'Distribution not found' }, 404)

  try {
    const out = await runInvitationBatch({
      supabase,
      distributionId,
      surveyId,
      organizationId: orgId,
      mode,
    })
    return respondJson({
      ok: true,
      mode,
      summary: out.summary,
      results: out.results,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return respondJson({ error: msg }, 500)
  }
})
