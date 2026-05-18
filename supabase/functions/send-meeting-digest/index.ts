/**
 * Meeting protocol digest — post-signing distribution (§8.34).
 *
 * Sends the signed protocol (or vedtak-only extract) to a filtered
 * recipient list defined in `meeting_digest_recipients`. Closes
 * AML § 7-2 (6): "AMU skal avgi rapport ... til virksomhetens
 * styrende organer og arbeidstakernes organisasjoner".
 *
 * POST body:
 *   { meeting_id: uuid, recipient_ids?: uuid[] }
 *     - recipient_ids omitted → all default_selected recipients
 *     - recipient_ids given → just those (chair-curated subset)
 *
 * Requires: caller is authenticated; meeting must be signed
 * (protocol_signed_at is not null). RLS on the SELECT enforces org +
 * confidentiality cascade.
 *
 * Reuses send-meeting-invites Resend pattern: RESEND_API_KEY,
 * RESEND_FROM, PUBLIC_APP_URL.
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

type MeetingRow = {
  id: string
  organization_id: string
  title: string
  scheduled_at: string | null
  location_label: string | null
  protocol_signed_at: string | null
}

type AgendaItemRow = {
  id: string
  position: number
  title: string
  minutes_summary: string | null
  decision_text: string | null
  decision_status: string | null
}

type RecipientRow = {
  id: string
  meeting_id: string
  organization_id: string
  name: string
  recipient_filter: Record<string, unknown>
  extract_mode: 'full' | 'decisions_only'
}

type ResolvedRecipient = { email: string; display_name: string | null }

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

function fmtDateNb(iso: string | null): string {
  if (!iso) return 'Tidspunkt ikke fastsatt'
  try {
    return new Date(iso).toLocaleString('nb-NO', {
      dateStyle: 'long',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function buildMeetingUrl(baseUrl: string, meetingId: string): string {
  return `${baseUrl.replace(/\/$/, '')}/meetings/${encodeURIComponent(meetingId)}`
}

function renderDigestHtml(args: {
  meeting: MeetingRow
  agenda: AgendaItemRow[]
  mode: 'full' | 'decisions_only'
  meetingUrl: string
  recipientName: string
}): string {
  const { meeting, agenda, mode, meetingUrl } = args
  const items =
    mode === 'decisions_only'
      ? agenda.filter((a) => a.decision_text && a.decision_text.trim().length > 0)
      : agenda

  const itemsHtml = items
    .map(
      (a) => `
    <div style="margin: 16px 0; padding: 12px; border-left: 3px solid #0891b2; background: #f9f7f2">
      <p style="margin: 0 0 4px 0; font-size: 11px; color: #6b7280; font-weight: bold; text-transform: uppercase">
        Sak ${a.position}
      </p>
      <p style="margin: 0 0 8px 0; font-size: 15px; font-weight: 600; color: #1f2937">
        ${escapeHtml(a.title)}
      </p>
      ${
        a.minutes_summary && mode === 'full'
          ? `<p style="margin: 0 0 8px 0; font-size: 13px; color: #4b5563; white-space: pre-wrap">${escapeHtml(a.minutes_summary)}</p>`
          : ''
      }
      ${
        a.decision_text
          ? `<div style="padding: 8px; background: #ecfeff; border-radius: 4px; margin-top: 8px">
              <p style="margin: 0; font-size: 11px; font-weight: bold; color: #155e75; text-transform: uppercase">Vedtak</p>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #1f2937">${escapeHtml(a.decision_text)}</p>
            </div>`
          : ''
      }
    </div>`,
    )
    .join('')

  return `<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.55;color:#1f2937;background:#f9f7f2;padding:20px;margin:0">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;padding:24px;border:1px solid #e5e7eb">
<h1 style="margin:0 0 8px 0;font-size:22px;color:#0891b2">Møteprotokoll</h1>
<h2 style="margin:0 0 4px 0;font-size:18px;color:#1f2937">${escapeHtml(meeting.title)}</h2>
<p style="margin:0 0 16px 0;color:#6b7280;font-size:13px">
  ${escapeHtml(fmtDateNb(meeting.scheduled_at))}
  ${meeting.location_label ? `· ${escapeHtml(meeting.location_label)}` : ''}
</p>
${
  mode === 'decisions_only'
    ? '<p style="margin: 0 0 16px 0; padding: 8px 12px; background: #fef3c7; border-radius: 4px; font-size: 12px; color: #92400e">Dette er et utdrag — kun vedtak fra møtet.</p>'
    : ''
}
${itemsHtml || '<p style="color:#6b7280;font-style:italic">Ingen saker å vise.</p>'}
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb">
  <a href="${meetingUrl}" style="display:inline-block;padding:10px 16px;background:#0891b2;color:white;text-decoration:none;border-radius:6px;font-weight:500">Åpne hele protokollen</a>
</div>
<p style="margin-top:16px;font-size:11px;color:#9ca3af">
  AML § 7-2 (6) — AMU-rapport distribueres til virksomhetens styrende organer og arbeidstakernes organisasjoner.
</p>
</div>
</body></html>`
}

/** Resolve a recipient filter to a list of email + name pairs.
 *  Supported shapes (extend as needed; v1 is minimal):
 *    { kind: 'org_members_all' } — all organization_members in org
 *    { kind: 'org_members_role', role: 'verneombud' }
 *    { kind: 'emails', emails: ['x@y.no', ...] }
 */
async function resolveRecipients(args: {
  supabase: SupabaseClient
  orgId: string
  filter: Record<string, unknown>
}): Promise<ResolvedRecipient[]> {
  const { supabase, orgId, filter } = args
  const kind = typeof filter.kind === 'string' ? filter.kind : 'org_members_all'

  if (kind === 'emails' && Array.isArray((filter as { emails?: unknown }).emails)) {
    // Security (§8.34 round-2 fix): intersect the chair-provided email
    // list with the org's organization_members directory. This blocks
    // arbitrary-inbox dispatch where a compromised or malicious chair
    // could weaponise the org's Resend domain to spam external parties.
    // Only emails that match a registered org member will be sent.
    const requested = ((filter as { emails: unknown[] }).emails ?? [])
      .filter((e): e is string => typeof e === 'string' && e.includes('@'))
      .map((e) => e.toLowerCase().trim())
    if (requested.length === 0) return []
    const { data } = await supabase
      .from('organization_members')
      .select('id, display_name, email')
      .eq('organization_id', orgId)
      .in('email', requested)
    const known = (data ?? [])
      .filter((r): r is { id: string; display_name: string | null; email: string } =>
        Boolean((r as { email?: string }).email),
      )
      .map((r) => ({ email: r.email, display_name: r.display_name }))
    const knownEmails = new Set(known.map((k) => k.email.toLowerCase()))
    const dropped = requested.filter((e) => !knownEmails.has(e))
    if (dropped.length > 0) {
      console.warn(
        `send-meeting-digest: dropped ${dropped.length} email(s) not found in organization_members for org ${orgId}`,
      )
    }
    return known
  }

  if (kind === 'org_members_role' && typeof (filter as { role?: unknown }).role === 'string') {
    // Best-effort: many orgs don't store role on organization_members.
    // Fall back to all members in org.
    const { data } = await supabase
      .from('organization_members')
      .select('id, display_name, email')
      .eq('organization_id', orgId)
      .not('email', 'is', null)
    return (data ?? [])
      .filter((r): r is { id: string; display_name: string | null; email: string } => Boolean((r as { email?: string }).email))
      .map((r) => ({ email: r.email, display_name: r.display_name }))
  }

  // Default: all members in org with an email
  const { data } = await supabase
    .from('organization_members')
    .select('id, display_name, email')
    .eq('organization_id', orgId)
    .not('email', 'is', null)
  return (data ?? [])
    .filter((r): r is { id: string; display_name: string | null; email: string } => Boolean((r as { email?: string }).email))
    .map((r) => ({ email: r.email, display_name: r.display_name }))
}

async function dispatchDigest(args: {
  supabase: SupabaseClient
  meetingId: string
  recipientIds: string[] | null
}): Promise<{
  summary: { recipients_resolved: number; emails_sent: number; emails_failed: number }
  results: Array<{ recipient_id: string; sent: number; failed: number; per_email?: Array<{ email: string; ok: boolean; status?: number; error?: string }> }>
}> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const publicAppUrl = (Deno.env.get('PUBLIC_APP_URL') ?? '').trim() || 'http://localhost:5173'
  const fromAddr = (Deno.env.get('RESEND_FROM') ?? '').trim() || 'Møter <onboarding@resend.dev>'

  if (!resendKey) throw new Error('RESEND_API_KEY missing')

  // 1. Load meeting (must be signed)
  const meetingRes = await args.supabase
    .from('meetings')
    .select('id, organization_id, title, scheduled_at, location_label, protocol_signed_at')
    .eq('id', args.meetingId)
    .single()
  if (meetingRes.error || !meetingRes.data) {
    throw new Error(meetingRes.error?.message ?? 'Meeting not found')
  }
  const meeting = meetingRes.data as MeetingRow
  if (!meeting.protocol_signed_at) {
    throw new Error('meeting_not_signed')
  }

  // 2. Load agenda for the protocol body
  const agendaRes = await args.supabase
    .from('meeting_agenda_items')
    .select('id, position, title, minutes_summary, decision_text, decision_status')
    .eq('meeting_id', args.meetingId)
    .order('position', { ascending: true })
  const agenda = (agendaRes.data ?? []) as AgendaItemRow[]

  // 3. Load recipient records
  let recQuery = args.supabase
    .from('meeting_digest_recipients')
    .select('id, meeting_id, organization_id, name, recipient_filter, extract_mode')
    .eq('meeting_id', args.meetingId)
  if (args.recipientIds && args.recipientIds.length > 0) {
    recQuery = recQuery.in('id', args.recipientIds)
  } else {
    recQuery = recQuery.eq('default_selected', true)
  }
  const recRes = await recQuery
  const recipients = (recRes.data ?? []) as RecipientRow[]

  const meetingUrl = buildMeetingUrl(publicAppUrl, meeting.id)
  const results: Array<{ recipient_id: string; sent: number; failed: number; per_email?: Array<{ email: string; ok: boolean; status?: number; error?: string }> }> = []
  let totalResolved = 0
  let totalSent = 0
  let totalFailed = 0

  for (const recipient of recipients) {
    const resolved = await resolveRecipients({
      supabase: args.supabase,
      orgId: meeting.organization_id,
      filter: recipient.recipient_filter,
    })
    totalResolved += resolved.length

    const html = renderDigestHtml({
      meeting,
      agenda,
      mode: recipient.extract_mode,
      meetingUrl,
      recipientName: recipient.name,
    })

    let sent = 0
    let failed = 0
    const perEmail: Array<{ email: string; ok: boolean; status?: number; error?: string }> = []
    for (const r of resolved) {
      try {
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddr,
            to: [r.email],
            subject: `${recipient.extract_mode === 'decisions_only' ? 'Vedtak fra' : 'Protokoll'} — ${meeting.title}`,
            html,
          }),
        })
        if (resp.ok) {
          sent += 1
          perEmail.push({ email: r.email, ok: true, status: resp.status })
        } else {
          failed += 1
          const text = await resp.text().catch(() => '')
          perEmail.push({ email: r.email, ok: false, status: resp.status, error: text.slice(0, 200) })
          console.warn(
            `send-meeting-digest: Resend ${resp.status} for ${r.email} on meeting ${meeting.id}`,
          )
        }
      } catch (err) {
        // Re-mirror the per-recipient detail so the chair sees something
        // useful in the response, not just "failed: N".
        failed += 1
        perEmail.push({ email: r.email, ok: false, error: (err as Error).message })
        console.error(
          `send-meeting-digest: exception sending to ${r.email} on meeting ${meeting.id}:`,
          (err as Error).message,
        )
        continue
      }
    }

    // Stamp sent_at on the recipient row
    if (sent > 0) {
      await args.supabase
        .from('meeting_digest_recipients')
        .update({ sent_at: new Date().toISOString(), sent_count: sent })
        .eq('id', recipient.id)
    }

    totalSent += sent
    totalFailed += failed
    results.push({ recipient_id: recipient.id, sent, failed, per_email: perEmail })
  }

  return {
    summary: {
      recipients_resolved: totalResolved,
      emails_sent: totalSent,
      emails_failed: totalFailed,
    },
    results,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return respondJson({ ok: false, error: 'method_not_allowed' }, 405)

  const auth = req.headers.get('authorization') ?? ''
  if (!auth.toLowerCase().startsWith('bearer ')) {
    return respondJson({ ok: false, error: 'missing_authorization' }, 401)
  }

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  if (!url || !anon) return respondJson({ ok: false, error: 'env_unset' }, 500)

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
  })

  let body: { meeting_id?: string; recipient_ids?: string[] } = {}
  try {
    body = (await req.json()) as typeof body
  } catch {
    return respondJson({ ok: false, error: 'invalid_json' }, 400)
  }
  if (!body.meeting_id) {
    return respondJson({ ok: false, error: 'meeting_id_required' }, 400)
  }

  try {
    const out = await dispatchDigest({
      supabase,
      meetingId: body.meeting_id,
      recipientIds: body.recipient_ids ?? null,
    })
    return respondJson({
      ok: true,
      ...out.summary,
      results: out.results,
    })
  } catch (err) {
    return respondJson({ ok: false, error: (err as Error).message }, 500)
  }
})
