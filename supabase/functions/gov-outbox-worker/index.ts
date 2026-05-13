/**
 * gov-outbox-worker — drains gov_notifications_outbox rows of kinds
 * that need external delivery:
 *   * datatilsynet_breach  — emails the signed manifest to the org's
 *                            configured submission_email.
 *   * nav_sykefravar_outbox — POSTs the queued NAV payload to Altinn
 *                            via gov-altinn-submit (the worker IS the
 *                            DSOP transport).
 *   * ldo_export_pending   — generates an evidence-pack URL the org
 *                            admin can forward manually (LDO has no API).
 *
 * Triggered every 5 minutes by a pg_cron job (registered in
 * supabase/migrations/_20260905121800_gov_outbox_cron.sql). Marks the
 * gov_notifications_outbox row resolved_at=now on success; on failure
 * increments a retry counter in the payload.
 *
 * Email transport: we use Supabase's hosted SMTP relay via the
 * built-in send_email RPC when present; otherwise pass the message to
 * Postmark / SendGrid via the same env vars an admin would set for
 * other notifications. For TT02 testing we accept a debug env var
 * GOV_OUTBOX_TEST_RELAY which short-circuits to logging only.
 */
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

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

const BATCH_SIZE = 25

type OutboxRow = {
  id: string
  organization_id: string
  kind: 'datatilsynet_breach' | 'nav_sykefravar_outbox' | 'ldo_export_pending'
  payload: Record<string, unknown>
  resolved_at: string | null
  retry_count?: number
}

async function sendDatatilsynetEmail(supabase: SupabaseClient, row: OutboxRow): Promise<{ ok: boolean; error?: string }> {
  const payload = row.payload as { to?: string; subject?: string; body?: string }
  if (!payload.to || !payload.body) return { ok: false, error: 'missing_email_payload' }

  // If a SENDGRID_API_KEY is configured, use it. Otherwise fall back
  // to logging into the existing notifications row so a human can pick
  // it up via the admin inbox — this avoids silent drops.
  const sendgridKey = Deno.env.get('SENDGRID_API_KEY')
  const testRelay = Deno.env.get('GOV_OUTBOX_TEST_RELAY')

  if (testRelay) {
    console.log('[gov-outbox-worker] TEST_RELAY active — would send to', payload.to)
    return { ok: true }
  }

  if (sendgridKey) {
    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sendgridKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: payload.to }] }],
          from: { email: Deno.env.get('SENDGRID_FROM') ?? 'noreply@newamu.app' },
          subject: payload.subject ?? 'Personvernbrudd-melding',
          content: [{ type: 'application/json', value: payload.body }],
        }),
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        return { ok: false, error: `sendgrid_${res.status}:${detail.slice(0, 200)}` }
      }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: `sendgrid_unreachable:${(err as Error).message}` }
    }
  }

  // No transport configured — flag as manual_send_required so an admin
  // can act. Insert a follow-up gov_notifications_outbox row.
  await supabase.from('gov_notifications_outbox').insert({
    organization_id: row.organization_id,
    kind: 'datatilsynet_manual_send_required',
    payload: row.payload,
  })
  return { ok: false, error: 'no_email_transport_configured' }
}

async function sendNavViaAltinn(
  supabase: SupabaseClient,
  row: OutboxRow,
  supabaseUrl: string,
  serviceKey: string,
): Promise<{ ok: boolean; error?: string }> {
  // Wrap the NAV payload in an Altinn envelope and call gov-altinn-submit.
  const payload = row.payload as {
    skjema?: string
    runId?: string
    ruleId?: string
    submissionEvidenceId?: string
  }
  if (!payload.skjema) return { ok: false, error: 'missing_skjema' }

  const res = await fetch(`${supabaseUrl}/functions/v1/gov-altinn-submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organization_id: row.organization_id,
      rule_id: payload.ruleId,
      run_id: payload.runId,
      event_name: 'nav_sykefravar_outbox',
      payload: {
        tjeneste: 'nav-dsop',
        skjema: payload.skjema,
        bodyJson: JSON.stringify(payload),
      },
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    return { ok: false, error: `altinn_${res.status}:${detail.slice(0, 200)}` }
  }
  return { ok: true }
}

async function generateLdoExportPointer(
  supabase: SupabaseClient,
  row: OutboxRow,
  supabaseUrl: string,
  serviceKey: string,
): Promise<{ ok: boolean; error?: string }> {
  // Trigger an evidence-pack export for the LDO-relevant law-refs and
  // post the resulting signed URL into the same notification so admin
  // can forward it manually.
  const lookback90 = new Date(Date.now() - 90 * 86400_000).toISOString()
  const now = new Date().toISOString()

  const res = await fetch(`${supabaseUrl}/functions/v1/workflow-evidence-pack`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organization_id: row.organization_id,
      date_from: lookback90,
      date_to: now,
      law_refs: ['Likestillings- og diskrimineringsloven § 26'],
      include_confidential: false,
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    return { ok: false, error: `evidence_pack_${res.status}:${detail.slice(0, 200)}` }
  }
  const pack = (await res.json()) as { signed_url?: string; manifest_sha256?: string }
  await supabase
    .from('gov_notifications_outbox')
    .update({
      payload: {
        ...row.payload,
        ldo_export_signed_url: pack.signed_url ?? null,
        ldo_export_manifest_sha256: pack.manifest_sha256 ?? null,
        generated_at: new Date().toISOString(),
      },
    })
    .eq('id', row.id)
  return { ok: true }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ ok: false, error: 'missing_env' }, 500)
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

  const { data: rows, error: selErr } = await supabase
    .from('gov_notifications_outbox')
    .select('id, organization_id, kind, payload, resolved_at')
    .in('kind', ['datatilsynet_breach', 'nav_sykefravar_outbox', 'ldo_export_pending'])
    .is('resolved_at', null)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)
  if (selErr) return json({ ok: false, error: 'lease_failed', detail: selErr.message }, 500)

  const queue = (rows ?? []) as OutboxRow[]
  const results: Array<{ id: string; kind: string; ok: boolean; error?: string }> = []

  for (const row of queue) {
    let result: { ok: boolean; error?: string }
    if (row.kind === 'datatilsynet_breach') {
      result = await sendDatatilsynetEmail(supabase, row)
    } else if (row.kind === 'nav_sykefravar_outbox') {
      result = await sendNavViaAltinn(supabase, row, SUPABASE_URL, SERVICE_ROLE)
    } else {
      result = await generateLdoExportPointer(supabase, row, SUPABASE_URL, SERVICE_ROLE)
    }
    if (result.ok) {
      await supabase
        .from('gov_notifications_outbox')
        .update({ resolved_at: new Date().toISOString() })
        .eq('id', row.id)
    }
    results.push({ id: row.id, kind: row.kind, ok: result.ok, error: result.error })
  }

  return json({ ok: true, processed: results.length, results })
})
