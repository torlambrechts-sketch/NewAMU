/**
 * Hourly digest of documents collaboration events.
 *
 * For each user with email + opt-in (profiles.notification_preferences.channels.email = true),
 * collects:
 *   - unread wiki_mention_notifications  (someone @-mentioned them)
 *   - pending wiki_review_requests       (where they're the reviewer)
 *   - pending wiki_comment_moderation_flags (only for moderators)
 *
 * If at least one of those is non-empty, sends a single Resend email and
 * marks the mention rows as read so the next run doesn't double-send.
 *
 * Invocation: scheduled cron POST with header X-Documents-Cron-Secret.
 * Body: { "cron_documents_digest": true }.
 *
 * Secrets:
 *   RESEND_API_KEY            — required for outbound email
 *   RESEND_FROM               — defaults to 'Klarert <onboarding@resend.dev>'
 *   CRON_SECRET               — shared cron auth header
 *   SUPABASE_URL              — required
 *   SUPABASE_SERVICE_ROLE_KEY — required (the function runs cross-tenant)
 *   PUBLIC_APP_URL            — base URL for deep links
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-documents-cron-secret',
}

type ProfileRow = {
  id: string
  organization_id: string
  display_name: string | null
  email: string | null
  is_org_admin: boolean | null
  notification_preferences: Record<string, unknown> | null
}

type MentionRow = {
  id: string
  page_id: string | null
  actor_name: string
  snippet: string
  created_at: string
}

type ReviewRow = {
  id: string
  page_id: string
  page_version: number
  created_at: string
}

type ModerationCountResult = { count: number | null }

function respondJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function digestEmailHtml(args: {
  displayName: string
  appUrl: string
  mentions: MentionRow[]
  reviews: ReviewRow[]
  moderationPending: number
}): string {
  const base = args.appUrl.replace(/\/$/, '')
  const lines: string[] = [
    `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">`,
    `<p>Hei ${escapeHtml(args.displayName || 'kollega')},</p>`,
    `<p>Her er en oppsummering av dokumentsamarbeid som venter på deg:</p>`,
  ]
  if (args.mentions.length > 0) {
    lines.push(`<h3 style="margin-top:20px">Du ble nevnt (${args.mentions.length})</h3><ul>`)
    for (const m of args.mentions.slice(0, 10)) {
      const href = m.page_id ? `${base}/documents/page/${m.page_id}?tab=diskusjon` : `${base}/documents`
      lines.push(
        `<li><strong>${escapeHtml(m.actor_name)}</strong> — ${escapeHtml(m.snippet || 'Ny kommentar').slice(0, 200)}<br/><a href="${href}">Åpne dokumentet</a></li>`,
      )
    }
    lines.push(`</ul>`)
  }
  if (args.reviews.length > 0) {
    lines.push(`<h3 style="margin-top:20px">Venter på din godkjenning (${args.reviews.length})</h3><ul>`)
    for (const r of args.reviews.slice(0, 10)) {
      const href = `${base}/documents/page/${r.page_id}?tab=diskusjon`
      lines.push(
        `<li>Dokumentversjon v${r.page_version} — <a href="${href}">Åpne for gjennomgang</a></li>`,
      )
    }
    lines.push(`</ul>`)
  }
  if (args.moderationPending > 0) {
    lines.push(
      `<h3 style="margin-top:20px">Moderering venter (${args.moderationPending})</h3>`,
      `<p>${args.moderationPending} kommentar${args.moderationPending === 1 ? '' : 'er'} er flagget av systemet og venter på beslutning. <a href="${base}/documents/moderation">Åpne moderering</a>.</p>`,
    )
  }
  lines.push(
    `<p style="margin-top:24px;font-size:12px;color:#666">Du kan slå av denne e-posten under Innstillinger → Varsler i Klarert.</p>`,
    `</body></html>`,
  )
  return lines.join('\n')
}

async function sendEmail(args: {
  to: string
  subject: string
  html: string
}): Promise<{ ok: boolean; resendId: string | null; error?: string }> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromAddr = (Deno.env.get('RESEND_FROM') ?? '').trim() || 'Klarert <onboarding@resend.dev>'
  if (!resendKey) return { ok: false, resendId: null, error: 'RESEND_API_KEY missing' }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromAddr, to: [args.to], subject: args.subject, html: args.html }),
  })
  const text = await res.text()
  let resendId: string | null = null
  try {
    const j = JSON.parse(text) as { id?: string }
    resendId = j.id ?? null
  } catch {
    /* ignore */
  }
  if (!res.ok) return { ok: false, resendId, error: `Resend ${res.status}: ${text.slice(0, 300)}` }
  return { ok: true, resendId }
}

function isEmailOptedIn(prefs: Record<string, unknown> | null | undefined): boolean {
  if (!prefs || typeof prefs !== 'object') return false
  const channels = (prefs as Record<string, unknown>).channels as Record<string, unknown> | undefined
  return channels?.email === true
}

async function processOne(args: {
  supabase: SupabaseClient
  profile: ProfileRow
  appUrl: string
}): Promise<{ skipped: boolean; sent: boolean; reason?: string }> {
  const { supabase, profile, appUrl } = args
  const email = profile.email?.trim()
  if (!email) return { skipped: true, reason: 'no_email' }
  if (!isEmailOptedIn(profile.notification_preferences)) return { skipped: true, reason: 'opted_out' }

  const isModerator = profile.is_org_admin === true // service role; permission rows not checked here
  const [mentionsRes, reviewsRes, moderationRes] = await Promise.all([
    supabase
      .from('wiki_mention_notifications')
      .select('id, page_id, actor_name, snippet, created_at')
      .eq('organization_id', profile.organization_id)
      .eq('recipient_user_id', profile.id)
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('wiki_review_requests')
      .select('id, page_id, page_version, created_at')
      .eq('organization_id', profile.organization_id)
      .eq('reviewer_id', profile.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(20),
    isModerator
      ? supabase
          .from('wiki_comment_moderation_flags')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id)
          .eq('action', 'pending_review')
      : Promise.resolve({ count: 0 } as ModerationCountResult),
  ])

  const mentions = (mentionsRes.data ?? []) as MentionRow[]
  const reviews = (reviewsRes.data ?? []) as ReviewRow[]
  const moderationPending = (moderationRes as ModerationCountResult).count ?? 0

  if (mentions.length === 0 && reviews.length === 0 && moderationPending === 0) {
    return { skipped: true, reason: 'empty' }
  }

  const subject = `Dokumentsamarbeid: ${mentions.length} omtaler, ${reviews.length} godkjenninger${
    moderationPending > 0 ? `, ${moderationPending} til moderering` : ''
  }`
  const html = digestEmailHtml({
    displayName: profile.display_name ?? '',
    appUrl,
    mentions,
    reviews,
    moderationPending,
  })

  const send = await sendEmail({ to: email, subject, html })
  if (!send.ok) {
    return { skipped: false, sent: false, reason: send.error }
  }

  // Mark mentions as read so the next run doesn't repeat.
  if (mentions.length > 0) {
    const ids = mentions.map((m) => m.id)
    await supabase
      .from('wiki_mention_notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', ids)
  }

  return { skipped: false, sent: true }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return respondJson({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('CRON_SECRET')
  const appUrl = (Deno.env.get('PUBLIC_APP_URL') ?? '').trim() || 'http://localhost:5173'

  if (!supabaseUrl || !serviceKey) return respondJson({ error: 'SUPABASE_URL or SERVICE_ROLE missing' }, 503)
  if (!cronSecret || req.headers.get('X-Documents-Cron-Secret') !== cronSecret) {
    return respondJson({ error: 'Forbidden' }, 403)
  }

  let body: { cron_documents_digest?: boolean }
  try {
    body = (await req.json()) as { cron_documents_digest?: boolean }
  } catch {
    body = {}
  }
  if (!body.cron_documents_digest) {
    return respondJson({ error: 'Expected { cron_documents_digest: true }' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: profiles, error: pErr } = await admin
    .from('profiles')
    .select('id, organization_id, display_name, email, is_org_admin, notification_preferences')
    .not('email', 'is', null)
    .not('organization_id', 'is', null)
  if (pErr) return respondJson({ error: pErr.message }, 500)

  const summary: { processed: number; sent: number; skipped: number; failed: number } = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  }
  for (const p of (profiles ?? []) as ProfileRow[]) {
    summary.processed += 1
    try {
      const out = await processOne({ supabase: admin, profile: p, appUrl })
      if (out.skipped) summary.skipped += 1
      else if (out.sent) summary.sent += 1
      else summary.failed += 1
    } catch (err) {
      console.warn('digest user failed:', p.id, err instanceof Error ? err.message : err)
      summary.failed += 1
    }
  }

  return respondJson({ ok: true, summary })
})
