/**
 * Meeting invitation emails (Resend) + ICS calendar attachment.
 *
 * POST JSON:
 * - Caller-driven: { meeting_id, mode?: 'initial' | 'reminder' } + user JWT
 * - Cron (reminder sweep): header X-Meetings-Cron-Secret + body { "cron_reminder_sweep": true }
 *
 * Secrets: RESEND_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY,
 *          SUPABASE_SERVICE_ROLE_KEY (cron only), MEETINGS_CRON_SECRET,
 *          RESEND_FROM, PUBLIC_APP_URL
 *
 * i18n: subject + body are rendered per recipient. `organization_members`
 * has no account FK, so the recipient locale is resolved by matching the
 * member email against `profiles.locale`; members with no app account fall
 * back to the organisation's `default_locale`, then 'nb'. Shared copy and
 * helpers live in `../_shared/i18n.ts`.
 *
 * Returns { ok: true, sent: number, failed: number, results: [...] }.
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import {
  escapeAttr,
  escapeHtml,
  escapeIcs,
  formatDateTime,
  resolveLocale,
  t,
  type ServerLocale,
} from '../_shared/i18n.ts'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-meetings-cron-secret',
}

type MeetingRow = {
  id: string
  organization_id: string
  title: string
  description: string | null
  scheduled_at: string | null
  ends_at: string | null
  location_label: string | null
  participant_member_ids: string[] | null
  invitation_sent_at: string | null
}

type MemberRow = {
  id: string
  display_name: string | null
  email: string | null
}

type SendMode = 'initial' | 'reminder'

function respondJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function defaultInviteHtml(args: {
  locale: ServerLocale
  title: string
  whenLabel: string
  location: string | null
  description: string | null
  meetingUrl: string
}): string {
  const { locale, title, whenLabel, location, description, meetingUrl } = args
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.55;color:#1f2937">
<h2 style="margin:0 0 8px 0">${escapeHtml(t(locale, 'meeting.invite.heading', { title }))}</h2>
<p style="margin:4px 0"><strong>${escapeHtml(t(locale, 'meeting.field.when'))}:</strong> ${escapeHtml(whenLabel)}</p>
${location ? `<p style="margin:4px 0"><strong>${escapeHtml(t(locale, 'meeting.field.location'))}:</strong> ${escapeHtml(location)}</p>` : ''}
${description ? `<p style="margin:12px 0">${escapeHtml(description)}</p>` : ''}
<p style="margin:16px 0"><a href="${escapeAttr(meetingUrl)}" style="display:inline-block;padding:10px 16px;background:#0891b2;color:#fff;text-decoration:none;border-radius:6px">${escapeHtml(t(locale, 'meeting.openButton'))}</a></p>
<p style="font-size:12px;color:#6b7280">${escapeHtml(t(locale, 'meeting.linkFallback'))}<br/>${escapeHtml(meetingUrl)}</p>
<p style="font-size:12px;color:#6b7280">${escapeHtml(t(locale, 'meeting.icsHint'))}</p>
</body></html>`
}

function defaultReminderHtml(args: {
  locale: ServerLocale
  title: string
  whenLabel: string
  meetingUrl: string
}): string {
  const { locale, title, whenLabel, meetingUrl } = args
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.55;color:#1f2937">
<h2 style="margin:0 0 8px 0">${escapeHtml(t(locale, 'meeting.reminder.heading', { title }))}</h2>
<p>${escapeHtml(whenLabel)}</p>
<p style="margin:16px 0"><a href="${escapeAttr(meetingUrl)}" style="display:inline-block;padding:10px 16px;background:#0891b2;color:#fff;text-decoration:none;border-radius:6px">${escapeHtml(t(locale, 'meeting.openButton'))}</a></p>
</body></html>`
}

function buildMeetingUrl(baseUrl: string, meetingId: string): string {
  const origin = baseUrl.replace(/\/$/, '')
  return `${origin}/meetings/${encodeURIComponent(meetingId)}`
}

/** RFC 5545 minimal VEVENT. Returns null when scheduled_at is missing.
 *  Built once per send with the organisation locale (one ICS for all). */
function buildIcs(args: {
  meeting: MeetingRow
  meetingUrl: string
  locale: ServerLocale
}): string | null {
  const { meeting, meetingUrl, locale } = args
  if (!meeting.scheduled_at) return null
  const dtstart = toIcsTimestamp(meeting.scheduled_at)
  const dtend = meeting.ends_at
    ? toIcsTimestamp(meeting.ends_at)
    : toIcsTimestamp(new Date(new Date(meeting.scheduled_at).getTime() + 60 * 60 * 1000).toISOString())
  const uid = `meeting-${meeting.id}@newamu`
  const dtstamp = toIcsTimestamp(new Date().toISOString())
  const summary = escapeIcs(meeting.title)
  const description = escapeIcs(
    [meeting.description ?? '', `${t(locale, 'meeting.ics.linkLabel')}: ${meetingUrl}`]
      .filter(Boolean)
      .join('\\n\\n'),
  )
  const location = meeting.location_label ? escapeIcs(meeting.location_label) : ''
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NewAMU//Meetings//NB',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${summary}`,
    description ? `DESCRIPTION:${description}` : '',
    location ? `LOCATION:${location}` : '',
    `URL:${meetingUrl}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')
}

function toIcsTimestamp(iso: string): string {
  // 20260518T143000Z (basic format, UTC)
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

/** btoa() only handles Latin-1; Norwegian characters (æ/ø/å) in meeting
 *  titles or location labels would otherwise produce corrupt base64. We
 *  UTF-8-encode first, then base64-encode the bytes. */
function base64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]!)
  }
  return btoa(bin)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function loadMeetingAndMembers(args: {
  supabase: SupabaseClient
  meetingId: string
}): Promise<{ meeting: MeetingRow; members: MemberRow[]; orgLocale: ServerLocale }> {
  const { data: meetingData, error: meetingErr } = await args.supabase
    .from('meetings')
    .select(
      'id, organization_id, title, description, scheduled_at, ends_at, location_label, participant_member_ids, invitation_sent_at',
    )
    .eq('id', args.meetingId)
    .single()
  if (meetingErr || !meetingData) {
    throw new Error(meetingErr?.message ?? 'Meeting not found')
  }
  const meeting = meetingData as MeetingRow

  // Organisation default locale — the fallback for recipients with no account.
  const { data: orgData } = await args.supabase
    .from('organizations')
    .select('default_locale')
    .eq('id', meeting.organization_id)
    .single()
  const orgLocale = resolveLocale((orgData as { default_locale?: string } | null)?.default_locale)

  const ids = (meeting.participant_member_ids ?? []).filter((x) => typeof x === 'string')
  if (ids.length === 0) {
    return { meeting, members: [], orgLocale }
  }
  const { data: memberRows, error: memberErr } = await args.supabase
    .from('organization_members')
    .select('id, display_name, email')
    .in('id', ids)
  if (memberErr) throw new Error(memberErr.message)
  return { meeting, members: (memberRows ?? []) as MemberRow[], orgLocale }
}

/** Build an email -> locale map from `profiles`. `organization_members` has
 *  no account FK, so recipients are matched by email; anyone without a
 *  profile is simply absent from the map and falls back to the org locale. */
async function loadRecipientLocales(args: {
  supabase: SupabaseClient
  emails: string[]
}): Promise<Map<string, ServerLocale>> {
  const map = new Map<string, ServerLocale>()
  const clean = args.emails.map((e) => e.trim().toLowerCase()).filter(Boolean)
  if (clean.length === 0) return map
  const { data, error } = await args.supabase
    .from('profiles')
    .select('email, locale')
    .in('email', clean)
  if (error || !data) return map
  for (const row of data as Array<{ email: string | null; locale: string | null }>) {
    if (row.email) map.set(row.email.trim().toLowerCase(), resolveLocale(row.locale))
  }
  return map
}

async function runInvitationBatch(args: {
  supabase: SupabaseClient
  meetingId: string
  mode: SendMode
}): Promise<{
  summary: { total: number; sent: number; failed: number }
  results: Array<{ memberId: string; ok: boolean; error?: string }>
}> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const publicAppUrl = (Deno.env.get('PUBLIC_APP_URL') ?? '').trim() || 'http://localhost:5173'
  const fromAddr = (Deno.env.get('RESEND_FROM') ?? '').trim() || 'Møter <onboarding@resend.dev>'
  const defaultDelay = Number(Deno.env.get('EMAIL_SEND_DELAY_MS') ?? '400') || 400

  if (!resendKey) throw new Error('RESEND_API_KEY missing')

  const { meeting, members, orgLocale } = await loadMeetingAndMembers({
    supabase: args.supabase,
    meetingId: args.meetingId,
  })

  // Early exit: no participants → nothing to send. Caller still gets a
  // 200 with sent=0 so the client can surface the helpful "no recipients"
  // hint rather than treating it as an opaque failure.
  if (members.length === 0) {
    return {
      summary: { total: 0, sent: 0, failed: 0 },
      results: [],
    }
  }

  const localeByEmail = await loadRecipientLocales({
    supabase: args.supabase,
    emails: members.map((m) => m.email ?? '').filter(Boolean),
  })

  const meetingUrl = buildMeetingUrl(publicAppUrl, meeting.id)

  // ICS is the same calendar object for everyone — built once with the org
  // locale. Per-recipient localisation applies to the email subject + body.
  const ics = buildIcs({ meeting, meetingUrl, locale: orgLocale })
  const attachments = ics
    ? [
        {
          filename: `${meeting.title.replace(/[^\w-]+/g, '_')}.ics`,
          content: base64Utf8(ics),
        },
      ]
    : undefined

  const results: Array<{ memberId: string; ok: boolean; error?: string }> = []
  let sent = 0
  let failed = 0

  for (const member of members) {
    const email = member.email?.trim()
    if (!email) {
      results.push({ memberId: member.id, ok: false, error: 'no_email' })
      failed += 1
      continue
    }

    const locale = localeByEmail.get(email.toLowerCase()) ?? orgLocale
    const whenLabel = meeting.scheduled_at
      ? formatDateTime(meeting.scheduled_at, locale)
      : t(locale, 'meeting.whenUnset')
    const subject =
      args.mode === 'reminder'
        ? t(locale, 'meeting.reminder.subject', { title: meeting.title })
        : t(locale, 'meeting.invite.subject', { title: meeting.title })
    const html =
      args.mode === 'reminder'
        ? defaultReminderHtml({ locale, title: meeting.title, whenLabel, meetingUrl })
        : defaultInviteHtml({
            locale,
            title: meeting.title,
            whenLabel,
            location: meeting.location_label,
            description: meeting.description,
            meetingUrl,
          })

    try {
      const resp = await fetch('https://api.resend.com/emails', {
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
          attachments,
        }),
      })
      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        results.push({ memberId: member.id, ok: false, error: text.slice(0, 200) })
        failed += 1
      } else {
        results.push({ memberId: member.id, ok: true })
        sent += 1
      }
    } catch (err) {
      results.push({ memberId: member.id, ok: false, error: (err as Error).message })
      failed += 1
    }
    if (defaultDelay > 0) await sleep(defaultDelay)
  }

  return {
    summary: { total: members.length, sent, failed },
    results,
  }
}

async function handleCron(req: Request): Promise<Response> {
  const cronSecret = Deno.env.get('MEETINGS_CRON_SECRET')
  const provided = req.headers.get('x-meetings-cron-secret') ?? ''
  if (!cronSecret || provided !== cronSecret) {
    return respondJson({ ok: false, error: 'unauthorized' }, 401)
  }
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !serviceKey) {
    return respondJson({ ok: false, error: 'service_role_unset' }, 500)
  }
  const supabase = createClient(url, serviceKey)

  // Reminder sweep: meetings scheduled within next 48h that already had
  // invitations sent but no reminder yet. Conservative: status='planned' only.
  const now = Date.now()
  const horizon = new Date(now + 48 * 3600 * 1000).toISOString()
  const { data: candidates, error: candErr } = await supabase
    .from('meetings')
    .select('id')
    .eq('status', 'planned')
    .gte('scheduled_at', new Date(now).toISOString())
    .lte('scheduled_at', horizon)
    .not('invitation_sent_at', 'is', null)
  if (candErr) return respondJson({ ok: false, error: candErr.message }, 500)

  const results: Array<{ meetingId: string; sent: number; failed: number }> = []
  for (const row of (candidates ?? []) as Array<{ id: string }>) {
    try {
      const out = await runInvitationBatch({
        supabase,
        meetingId: row.id,
        mode: 'reminder',
      })
      results.push({ meetingId: row.id, sent: out.summary.sent, failed: out.summary.failed })
    } catch (err) {
      results.push({
        meetingId: row.id,
        sent: 0,
        failed: -1,
      })
      // Error captured in results; Supabase Edge runtime forwards unhandled
      // exceptions to logs automatically — no need for a separate console.error.
      void err
    }
  }
  return respondJson({ ok: true, count: results.length, results })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return respondJson({ ok: false, error: 'method_not_allowed' }, 405)
  }

  // Cron entry — service-role, scheduled by Supabase.
  if (req.headers.get('x-meetings-cron-secret')) {
    return handleCron(req)
  }

  // Caller-driven send (user JWT).
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.toLowerCase().startsWith('bearer ')) {
    return respondJson({ ok: false, error: 'missing_authorization' }, 401)
  }
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  if (!url || !anon) {
    return respondJson({ ok: false, error: 'env_unset' }, 500)
  }
  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
  })

  let body: { meeting_id?: string; mode?: SendMode } = {}
  try {
    body = (await req.json()) as typeof body
  } catch {
    return respondJson({ ok: false, error: 'invalid_json' }, 400)
  }
  if (!body.meeting_id) {
    return respondJson({ ok: false, error: 'meeting_id_required' }, 400)
  }
  const mode: SendMode = body.mode === 'reminder' ? 'reminder' : 'initial'

  try {
    const out = await runInvitationBatch({
      supabase,
      meetingId: body.meeting_id,
      mode,
    })
    return respondJson({
      ok: true,
      sent: out.summary.sent,
      failed: out.summary.failed,
      total: out.summary.total,
      results: out.results,
    })
  } catch (err) {
    return respondJson({ ok: false, error: (err as Error).message }, 500)
  }
})
