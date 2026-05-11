/**
 * Daily reminder enqueue for "Lest og forstått" acknowledgements.
 *
 * For each published wiki page that requires acknowledgement and whose
 * next_revision_due_at is within 14 days, resolve the audience (all_employees
 * / leaders_only / safety_reps_only / department), find audience members
 * who have NOT signed the current page version, and insert one
 * wiki_mention_notifications row per unsigned user. These rows surface in
 * NotificationTray via useNotifications.
 *
 * The hourly notification digest function picks the same rows up and
 * (optionally) sends them as an email — so adding a row here is enough to
 * reach the user in-app and via email if they've opted in.
 *
 * Invocation: cron POST with header X-Documents-Cron-Secret + body
 * { "cron_documents_ack_reminders": true }.
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-documents-cron-secret',
}

type PageRow = {
  id: string
  organization_id: string
  title: string
  version: number
  requires_acknowledgement: boolean
  acknowledgement_audience: string | null
  acknowledgement_department_id: string | null
  next_revision_due_at: string | null
  status: string
}

type ProfileRow = {
  id: string
  display_name: string | null
  is_org_admin: boolean | null
  learning_metadata: Record<string, unknown> | null
  department_id: string | null
}

type MemberRow = {
  id: string
  organization_id: string
  department_id: string | null
}

type ReceiptRow = {
  user_id: string
  page_version: number
}

const REMINDER_HORIZON_DAYS = 14

function respondJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function audienceUserIds(args: {
  page: PageRow
  members: MemberRow[]
  orgProfiles: ProfileRow[]
}): string[] {
  const aud = args.page.acknowledgement_audience ?? 'all_employees'
  const profileMap = new Map(args.orgProfiles.map((p) => [p.id, p]))
  if (aud === 'all_employees') return args.members.map((m) => m.id)
  if (aud === 'department') {
    const deptId = args.page.acknowledgement_department_id
    if (!deptId) return args.members.map((m) => m.id)
    return args.members.filter((m) => m.department_id === deptId).map((m) => m.id)
  }
  if (aud === 'leaders_only') {
    return args.members.filter((m) => profileMap.get(m.id)?.is_org_admin === true).map((m) => m.id)
  }
  if (aud === 'safety_reps_only') {
    return args.members
      .filter((m) => profileMap.get(m.id)?.learning_metadata?.is_safety_rep === true)
      .map((m) => m.id)
  }
  return args.members.map((m) => m.id)
}

async function processOrg(args: {
  supabase: SupabaseClient
  orgId: string
}): Promise<{ pagesProcessed: number; remindersQueued: number }> {
  const { supabase, orgId } = args
  const horizonIso = new Date(Date.now() + REMINDER_HORIZON_DAYS * 24 * 3600 * 1000).toISOString()

  const { data: pages, error: pErr } = await supabase
    .from('wiki_pages')
    .select(
      'id, organization_id, title, version, requires_acknowledgement, acknowledgement_audience, acknowledgement_department_id, next_revision_due_at, status',
    )
    .eq('organization_id', orgId)
    .eq('status', 'published')
    .eq('requires_acknowledgement', true)
    .not('next_revision_due_at', 'is', null)
    .lte('next_revision_due_at', horizonIso)
  if (pErr) {
    console.warn('reminders pages:', pErr.message)
    return { pagesProcessed: 0, remindersQueued: 0 }
  }
  const pageRows = (pages ?? []) as PageRow[]
  if (pageRows.length === 0) return { pagesProcessed: 0, remindersQueued: 0 }

  const [{ data: members }, { data: profiles }] = await Promise.all([
    supabase.from('organization_members').select('id, organization_id, department_id').eq('organization_id', orgId),
    supabase
      .from('profiles')
      .select('id, display_name, is_org_admin, learning_metadata, department_id')
      .eq('organization_id', orgId),
  ])
  const memberRows = (members ?? []) as MemberRow[]
  const profileRows = (profiles ?? []) as ProfileRow[]

  let queued = 0
  for (const page of pageRows) {
    const expected = new Set(audienceUserIds({ page, members: memberRows, orgProfiles: profileRows }))
    if (expected.size === 0) continue

    const { data: receipts } = await supabase
      .from('wiki_compliance_receipts')
      .select('user_id, page_version')
      .eq('organization_id', orgId)
      .eq('page_id', page.id)
      .eq('page_version', page.version)
    const signed = new Set((receipts ?? []).map((r: ReceiptRow) => r.user_id))
    const missing = [...expected].filter((uid) => !signed.has(uid))
    if (missing.length === 0) continue

    // Don't double-queue: skip users who already have an unread reminder for
    // this page in the last 7 days.
    const cutoffIso = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
    const { data: recentRows } = await supabase
      .from('wiki_mention_notifications')
      .select('recipient_user_id')
      .eq('organization_id', orgId)
      .eq('page_id', page.id)
      .eq('context', 'comment')
      .gte('created_at', cutoffIso)
      .in('recipient_user_id', missing)
    const alreadyNudged = new Set(
      (recentRows ?? []).map((r: { recipient_user_id: string }) => r.recipient_user_id),
    )
    const toNotify = missing.filter((uid) => !alreadyNudged.has(uid))
    if (toNotify.length === 0) continue

    const dueIso = page.next_revision_due_at ?? new Date().toISOString()
    const snippet = `Påminnelse: dokumentet «${page.title}» krever signatur før ${new Date(dueIso).toLocaleDateString('nb-NO')}.`
    const rows = toNotify.map((uid) => ({
      organization_id: orgId,
      recipient_user_id: uid,
      actor_user_id: uid, // self-targeted; we need a non-null actor for RLS
      actor_name: 'Klarert',
      page_id: page.id,
      context: 'comment',
      snippet,
    }))
    const { error: insErr } = await supabase.from('wiki_mention_notifications').insert(rows)
    if (insErr) {
      console.warn('reminder insert:', insErr.message)
      continue
    }
    queued += toNotify.length
  }

  return { pagesProcessed: pageRows.length, remindersQueued: queued }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return respondJson({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('CRON_SECRET')

  if (!supabaseUrl || !serviceKey) return respondJson({ error: 'SUPABASE_URL or SERVICE_ROLE missing' }, 503)
  if (!cronSecret || req.headers.get('X-Documents-Cron-Secret') !== cronSecret) {
    return respondJson({ error: 'Forbidden' }, 403)
  }

  let body: { cron_documents_ack_reminders?: boolean }
  try {
    body = (await req.json()) as { cron_documents_ack_reminders?: boolean }
  } catch {
    body = {}
  }
  if (!body.cron_documents_ack_reminders) {
    return respondJson({ error: 'Expected { cron_documents_ack_reminders: true }' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: orgs, error: oErr } = await admin.from('organizations').select('id')
  if (oErr) return respondJson({ error: oErr.message }, 500)

  let totalPages = 0
  let totalReminders = 0
  for (const org of orgs ?? []) {
    const row = org as { id: string }
    try {
      const out = await processOrg({ supabase: admin, orgId: row.id })
      totalPages += out.pagesProcessed
      totalReminders += out.remindersQueued
    } catch (err) {
      console.warn('processOrg failed:', row.id, err instanceof Error ? err.message : err)
    }
  }

  return respondJson({
    ok: true,
    summary: { pagesProcessed: totalPages, remindersQueued: totalReminders },
  })
})
