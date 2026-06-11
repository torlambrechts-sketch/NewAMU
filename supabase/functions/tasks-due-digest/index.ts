/**
 * Daily digest of task due dates (H2.5). Mirrors documents-notification-digest.
 *
 * For each user with email + opt-in (channels.email AND categories.tasks_due),
 * collects open task_items where they are assignee or owner (by user id —
 * the H1.1 link) and:
 *   - overdue            (due_date < today,        due_notified_stage < 2)
 *   - approaching ≤3 days (due_date <= today+3,    due_notified_stage < 1,
 *                          only when taskDigestPreDue !== false)
 *
 * Sends one Resend email per user, then bumps due_notified_stage so a daily
 * cron never repeats the same nudge. Users with taskDigestFrequency
 * 'weekly' are only processed on Mondays.
 *
 * Invocation: scheduled cron POST with header X-Tasks-Cron-Secret.
 * Body: { "cron_tasks_due_digest": true }.
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
    'authorization, x-client-info, apikey, content-type, x-tasks-cron-secret',
}

type ProfileRow = {
  id: string
  organization_id: string
  display_name: string | null
  email: string | null
  notification_preferences: Record<string, unknown> | null
}

type TaskRow = {
  id: string
  title: string
  due_date: string
  due_notified_stage: number
}

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

function fmtDateNb(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return iso
  }
}

function digestEmailHtml(args: {
  displayName: string
  appUrl: string
  overdue: TaskRow[]
  approaching: TaskRow[]
}): string {
  const base = args.appUrl.replace(/\/$/, '')
  const taskLine = (t: TaskRow) =>
    `<li><strong>${escapeHtml(t.title).slice(0, 160)}</strong> — frist ${fmtDateNb(t.due_date)}<br/>` +
    `<a href="${base}/tasks/management?taskId=${t.id}">Åpne oppgaven</a></li>`
  const lines: string[] = [
    `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">`,
    `<p>Hei ${escapeHtml(args.displayName || 'kollega')},</p>`,
    `<p>Status på oppgavefrister som gjelder deg:</p>`,
  ]
  if (args.overdue.length > 0) {
    lines.push(`<h3 style="margin-top:20px;color:#b03020">Forfalt (${args.overdue.length})</h3><ul>`)
    for (const t of args.overdue.slice(0, 15)) lines.push(taskLine(t))
    lines.push(`</ul>`)
  }
  if (args.approaching.length > 0) {
    lines.push(`<h3 style="margin-top:20px">Frist innen 3 dager (${args.approaching.length})</h3><ul>`)
    for (const t of args.approaching.slice(0, 15)) lines.push(taskLine(t))
    lines.push(`</ul>`)
  }
  lines.push(
    `<p style="margin-top:24px;font-size:12px;color:#666">Du kan endre frekvens eller slå av denne e-posten under Innstillinger → Varsler i Klarert.</p>`,
    `</body></html>`,
  )
  return lines.join('\n')
}

async function sendEmail(args: {
  to: string
  subject: string
  html: string
}): Promise<{ ok: boolean; error?: string }> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromAddr = (Deno.env.get('RESEND_FROM') ?? '').trim() || 'Klarert <onboarding@resend.dev>'
  if (!resendKey) return { ok: false, error: 'RESEND_API_KEY missing' }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromAddr, to: [args.to], subject: args.subject, html: args.html }),
  })
  if (!res.ok) {
    const text = await res.text()
    return { ok: false, error: `Resend ${res.status}: ${text.slice(0, 300)}` }
  }
  return { ok: true }
}

type DigestPrefs = { optedIn: boolean; weekly: boolean; preDue: boolean }

function digestPrefs(prefs: Record<string, unknown> | null | undefined): DigestPrefs {
  const o = prefs && typeof prefs === 'object' ? (prefs as Record<string, unknown>) : {}
  const channels = o.channels as Record<string, unknown> | undefined
  const categories = o.categories as Record<string, unknown> | undefined
  return {
    optedIn: channels?.email === true && categories?.tasks_due !== false,
    weekly: o.taskDigestFrequency === 'weekly',
    preDue: o.taskDigestPreDue !== false,
  }
}

async function processOne(args: {
  supabase: SupabaseClient
  profile: ProfileRow
  appUrl: string
  todayIso: string
  soonIso: string
  isMonday: boolean
  stage1Ids: Set<string>
  stage2Ids: Set<string>
  failedTaskIds: Set<string>
}): Promise<{ skipped: boolean; sent: boolean; reason?: string }> {
  const { supabase, profile, appUrl, todayIso, soonIso } = args
  const email = profile.email?.trim()
  if (!email) return { skipped: true, reason: 'no_email' }
  const prefs = digestPrefs(profile.notification_preferences)
  if (!prefs.optedIn) return { skipped: true, reason: 'opted_out' }
  if (prefs.weekly && !args.isMonday) return { skipped: true, reason: 'weekly_not_today' }

  const { data, error } = await supabase
    .from('task_items')
    .select('id, title, due_date, due_notified_stage')
    .eq('organization_id', profile.organization_id)
    .or(`assignee_user_id.eq.${profile.id},owner_user_id.eq.${profile.id}`)
    .not('due_date', 'is', null)
    .lte('due_date', soonIso)
    .lt('due_notified_stage', 2)
    .is('deleted_at', null)
    .not('status', 'in', '("closed","cancelled")')
    .order('due_date', { ascending: true })
    .limit(50)
  if (error) {
    // Mid-pass failure: nothing was sent for these tasks, nothing to veto.
    return { skipped: false, sent: false, reason: error.message }
  }

  const rows = (data ?? []) as TaskRow[]
  const overdue = rows.filter((t) => t.due_date < todayIso)
  const approaching = prefs.preDue
    ? rows.filter((t) => t.due_date >= todayIso && t.due_notified_stage < 1)
    : []

  if (overdue.length === 0 && approaching.length === 0) {
    return { skipped: true, reason: 'empty' }
  }

  const subject =
    overdue.length > 0
      ? `${overdue.length} forfalt${overdue.length === 1 ? '' : 'e'} oppgave${overdue.length === 1 ? '' : 'r'}${
          approaching.length > 0 ? ` + ${approaching.length} med frist snart` : ''
        }`
      : `${approaching.length} oppgave${approaching.length === 1 ? '' : 'r'} med frist innen 3 dager`

  const html = digestEmailHtml({
    displayName: profile.display_name ?? '',
    appUrl,
    overdue,
    approaching,
  })

  const send = await sendEmail({ to: email, subject, html })
  if (!send.ok) {
    // Veto the stage bump for every task in this user's failed digest —
    // otherwise a co-recipient (assignee + owner pair) whose email succeeded
    // would bump the stage and this user would never be retried.
    for (const t of [...overdue, ...approaching]) args.failedTaskIds.add(t.id)
    return { skipped: false, sent: false, reason: send.error }
  }

  // Collect stage bumps; applied once after ALL users are processed so a
  // task with distinct assignee + owner reaches both inboxes the same day.
  for (const t of overdue) args.stage2Ids.add(t.id)
  for (const t of approaching) args.stage1Ids.add(t.id)
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
  if (!cronSecret || req.headers.get('X-Tasks-Cron-Secret') !== cronSecret) {
    return respondJson({ error: 'Forbidden' }, 403)
  }

  let body: { cron_tasks_due_digest?: boolean }
  try {
    body = (await req.json()) as { cron_tasks_due_digest?: boolean }
  } catch {
    body = {}
  }
  if (!body.cron_tasks_due_digest) {
    return respondJson({ error: 'Expected { cron_tasks_due_digest: true }' }, 400)
  }

  const now = new Date()
  const todayIso = now.toISOString().slice(0, 10)
  const soonIso = new Date(now.getTime() + 3 * 86400000).toISOString().slice(0, 10)
  const isMonday = now.getUTCDay() === 1

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: profiles, error: pErr } = await admin
    .from('profiles')
    .select('id, organization_id, display_name, email, notification_preferences')
    .not('email', 'is', null)
    .not('organization_id', 'is', null)
  if (pErr) return respondJson({ error: pErr.message }, 500)

  const stage1Ids = new Set<string>()
  const stage2Ids = new Set<string>()
  const failedTaskIds = new Set<string>()
  const summary = { processed: 0, sent: 0, skipped: 0, failed: 0 }

  for (const p of (profiles ?? []) as ProfileRow[]) {
    summary.processed += 1
    try {
      const out = await processOne({
        supabase: admin,
        profile: p,
        appUrl,
        todayIso,
        soonIso,
        isMonday,
        stage1Ids,
        stage2Ids,
        failedTaskIds,
      })
      if (out.skipped) summary.skipped += 1
      else if (out.sent) summary.sent += 1
      else summary.failed += 1
    } catch (err) {
      console.warn('tasks digest user failed:', p.id, err instanceof Error ? err.message : err)
      summary.failed += 1
    }
  }

  // Stage bumps after the full pass (overdue wins over approaching). Tasks
  // in a failed digest are vetoed entirely so the failed recipient retries.
  for (const id of failedTaskIds) {
    stage1Ids.delete(id)
    stage2Ids.delete(id)
  }
  for (const id of stage2Ids) stage1Ids.delete(id)
  if (stage1Ids.size > 0) {
    await admin.from('task_items').update({ due_notified_stage: 1 }).in('id', [...stage1Ids])
  }
  if (stage2Ids.size > 0) {
    await admin.from('task_items').update({ due_notified_stage: 2 }).in('id', [...stage2Ids])
  }

  return respondJson({ ok: true, summary, staged: { approaching: stage1Ids.size, overdue: stage2Ids.size } })
})
