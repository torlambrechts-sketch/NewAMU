// Partner Console v0 — faktura-CSV export.
//
// Input: { partner_id, invoice_id }.
// Auth: caller's JWT is verified; the user must be a partner manager
//   or admin (checked via the `is_partner_member_of` + role lookup).
// Output: CSV uploaded to the `partner-invoices` Storage bucket at
//   `<partner_id>/<invoice_id>.csv`, with a signed URL (1h TTL) and
//   the row count returned in the JSON body. The invoice's
//   csv_storage_path column is stamped so future downloads short-
//   circuit re-generation.
//
// Self-audit (GDPR Art. 32 + IK-f § 5 nr. 8): the CSV contains the
// consultant's display_name, descriptions of work, and per-row NOK.
// We use the service-role key on the server so storage RLS does not
// apply, but the partner-firm membership check above prevents any
// caller from reading another firm's invoice trail.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

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

type Body = {
  partner_id: string
  invoice_id: string
}

type EntryRow = {
  id: string
  started_at: string
  ended_at: string | null
  description: string | null
  hourly_rate: number
  billable: boolean
  user_id: string
  organization_id: string
}

type ProfileRow = { id: string; display_name: string | null; email: string | null }

type OrgRow = { id: string; name: string }

type InvoiceRow = {
  id: string
  partner_id: string
  organization_id: string
  period_start: string
  period_end: string
  status: string
  total_minutes: number
  total_amount_nok: number
}

function minutesBetween(startedAt: string, endedAt: string | null): number {
  const start = new Date(startedAt).getTime()
  const end = endedAt ? new Date(endedAt).getTime() : Date.now()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0
  return Math.round((end - start) / 60000)
}

function quote(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json({ ok: false, error: 'missing_env' }, 500)
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return json({ ok: false, error: 'invalid_body' }, 400)
  }
  if (!body.partner_id || !body.invoice_id) {
    return json({ ok: false, error: 'missing_fields' }, 400)
  }

  // 1) Resolve the caller via their JWT.
  const authz = req.headers.get('Authorization') ?? ''
  if (!authz.startsWith('Bearer ')) {
    return json({ ok: false, error: 'unauthorized' }, 401)
  }
  const userClient = createClient(SUPABASE_URL, ANON_KEY || SERVICE_ROLE, {
    global: { headers: { Authorization: authz } },
    auth: { persistSession: false },
  })
  const { data: userInfo, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userInfo?.user) {
    return json({ ok: false, error: 'unauthorized', detail: userErr?.message }, 401)
  }
  const userId = userInfo.user.id

  // 2) Service-role client for everything else.
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

  // 3) Verify the caller is a manager/admin of the requested partner.
  const { data: mRow, error: mErr } = await supabase
    .from('partner_memberships')
    .select('role, active')
    .eq('partner_id', body.partner_id)
    .eq('user_id', userId)
    .eq('active', true)
    .limit(1)
    .maybeSingle()
  if (mErr) return json({ ok: false, error: 'membership_query_failed', detail: mErr.message }, 500)
  if (!mRow || !['manager', 'admin'].includes((mRow as { role: string }).role)) {
    return json({ ok: false, error: 'forbidden' }, 403)
  }

  // 4) Pull the invoice + scope-check it.
  const { data: invRow, error: invErr } = await supabase
    .from('partner_invoices')
    .select('id, partner_id, organization_id, period_start, period_end, status, total_minutes, total_amount_nok')
    .eq('id', body.invoice_id)
    .maybeSingle()
  if (invErr) return json({ ok: false, error: 'invoice_query_failed', detail: invErr.message }, 500)
  if (!invRow || (invRow as InvoiceRow).partner_id !== body.partner_id) {
    return json({ ok: false, error: 'invoice_not_found' }, 404)
  }
  const invoice = invRow as InvoiceRow

  // 5) Pull all entries on this invoice.
  const { data: entRows, error: entErr } = await supabase
    .from('partner_time_entries')
    .select('id, started_at, ended_at, description, hourly_rate, billable, user_id, organization_id')
    .eq('partner_id', body.partner_id)
    .eq('invoice_line_id', body.invoice_id)
    .order('started_at', { ascending: true })
  if (entErr) return json({ ok: false, error: 'entries_query_failed', detail: entErr.message }, 500)
  const entries = (entRows ?? []) as EntryRow[]

  // 6) Hydrate consultant + customer-org names.
  const userIds = Array.from(new Set(entries.map((e) => e.user_id)))
  const orgIds = Array.from(new Set([invoice.organization_id, ...entries.map((e) => e.organization_id)]))
  const [pRes, oRes] = await Promise.all([
    userIds.length
      ? supabase.from('profiles').select('id, display_name, email').in('id', userIds)
      : Promise.resolve({ data: [], error: null }),
    orgIds.length
      ? supabase.from('organizations').select('id, name').in('id', orgIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  const profileIndex = new Map<string, ProfileRow>(
    ((pRes.data ?? []) as ProfileRow[]).map((p) => [p.id, p]),
  )
  const orgIndex = new Map<string, OrgRow>(
    ((oRes.data ?? []) as OrgRow[]).map((o) => [o.id, o]),
  )

  // 7) Build the CSV.
  const header = ['dato', 'kunde', 'ansatt', 'beskrivelse', 'varighet_min', 'timepris_nok', 'sum_nok', 'billable']
  const rows: string[][] = entries.map((e) => {
    const min = minutesBetween(e.started_at, e.ended_at)
    const nok = (min / 60) * Number(e.hourly_rate)
    return [
      e.started_at.slice(0, 10),
      orgIndex.get(e.organization_id)?.name ?? '',
      profileIndex.get(e.user_id)?.display_name ?? profileIndex.get(e.user_id)?.email ?? '',
      e.description ?? '',
      String(min),
      Number(e.hourly_rate).toFixed(2),
      nok.toFixed(2),
      e.billable ? 'true' : 'false',
    ]
  })
  // Append summary line for accounting reconciliation.
  rows.push([
    'TOTAL',
    orgIndex.get(invoice.organization_id)?.name ?? '',
    '',
    `Periode ${invoice.period_start} → ${invoice.period_end}`,
    String(invoice.total_minutes),
    '',
    Number(invoice.total_amount_nok).toFixed(2),
    '',
  ])
  const csv =
    header.map(quote).join(',') +
    '\n' +
    rows.map((r) => r.map(quote).join(',')).join('\n') +
    '\n'

  // 8) Upload to Storage.
  const bucket = 'partner-invoices'
  const path = `${body.partner_id}/${body.invoice_id}.csv`
  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(path, new TextEncoder().encode(csv), {
      contentType: 'text/csv',
      upsert: true,
    })
  if (upErr) {
    return json({ ok: false, error: 'upload_failed', detail: upErr.message }, 500)
  }

  // 9) Sign a 1-hour URL.
  const { data: signed, error: signErr } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60)
  if (signErr) {
    return json({ ok: false, error: 'sign_failed', detail: signErr.message }, 500)
  }

  // 10) Stamp csv_storage_path on the invoice (idempotent).
  await supabase
    .from('partner_invoices')
    .update({ csv_storage_path: path })
    .eq('id', body.invoice_id)

  return json({
    ok: true,
    rows: entries.length,
    storage_path: path,
    signed_url: signed?.signedUrl,
    expires_in_seconds: 60 * 60,
  })
})
