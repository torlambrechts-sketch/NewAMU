/**
 * Sends pending survey invitation emails via Resend.
 * Invoke with user JWT (Authorization: Bearer). Body: { distribution_id, survey_id }.
 *
 * Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, RESEND_API_KEY
 * Optional: RESEND_FROM (default Survey <onboarding@resend.dev>), PUBLIC_APP_URL (origin for links)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type InviteRow = {
  id: string
  survey_id: string
  email_snapshot: string | null
  access_token: string | null
  status: string
  email_sent_at: string | null
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return respondJson({ error: 'Method not allowed' }, 405)
  }

  const resendKey = Deno.env.get('RESEND_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')
  const publicAppUrl = (Deno.env.get('PUBLIC_APP_URL') ?? '').trim() || 'http://localhost:5173'
  const fromAddr = (Deno.env.get('RESEND_FROM') ?? '').trim() || 'Survey <onboarding@resend.dev>'

  if (!resendKey || !supabaseUrl || !supabaseAnon) {
    return respondJson(
      { error: 'Server not configured (RESEND_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY)' },
      503,
    )
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return respondJson({ error: 'Missing Authorization' }, 401)
  }

  let body: { distribution_id?: string; survey_id?: string }
  try {
    body = (await req.json()) as { distribution_id?: string; survey_id?: string }
  } catch {
    return respondJson({ error: 'Invalid JSON' }, 400)
  }

  const distributionId = body.distribution_id?.trim()
  const surveyId = body.survey_id?.trim()
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

  const { data: surveyRow, error: surveyErr } = await supabase
    .from('surveys')
    .select('id, title')
    .eq('id', surveyId)
    .single()
  if (surveyErr || !surveyRow) {
    return respondJson({ error: surveyErr?.message ?? 'Survey not found' }, 404)
  }

  const title = String((surveyRow as { title?: string }).title ?? 'Undersøkelse')

  const { data: invites, error: invErr } = await supabase
    .from('survey_invitations')
    .select('id, survey_id, email_snapshot, access_token, status, email_sent_at')
    .eq('distribution_id', distributionId)
    .eq('survey_id', surveyId)
    .eq('status', 'pending')
  if (invErr) {
    return respondJson({ error: invErr.message }, 500)
  }

  const rows = (invites ?? []) as InviteRow[]
  const results: Array<{ id: string; ok: boolean; error?: string }> = []

  for (const inv of rows) {
    if (inv.email_sent_at) {
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
        .update({ email_send_error: 'Mangler invitasjonstoken — generer mottakere på nytt' })
        .eq('id', inv.id)
      results.push({ id: inv.id, ok: false, error: 'no_token' })
      continue
    }

    const link = buildRespondUrl(publicAppUrl, inv.survey_id, inv.access_token)
    const subject = `Undersøkelse: ${title}`

    const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5">
<p>Hei,</p>
<p>Du er invitert til å svare på undersøkelsen <strong>${escapeHtml(title)}</strong>.</p>
<p><a href="${escapeAttr(link)}">Åpne undersøkelse</a></p>
<p style="font-size:12px;color:#666">Hvis knappen ikke virker, lim inn denne lenken i nettleseren:<br/>${escapeHtml(
      link,
    )}</p>
</body></html>`

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
        html,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      const msg = `Resend ${res.status}: ${errText.slice(0, 500)}`
      await supabase.from('survey_invitations').update({ email_send_error: msg }).eq('id', inv.id)
      results.push({ id: inv.id, ok: false, error: msg })
      continue
    }

    const sentAt = new Date().toISOString()
    await supabase
      .from('survey_invitations')
      .update({ email_sent_at: sentAt, email_send_error: null })
      .eq('id', inv.id)
    results.push({ id: inv.id, ok: true })
  }

  const sent = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length

  return respondJson({
    ok: true,
    summary: { total: rows.length, sent, failed },
    results,
  })
})

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
