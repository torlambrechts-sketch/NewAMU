/**
 * gov-outbox-worker — drains gov_notifications_outbox rows of kinds
 * that need external delivery:
 *   * datatilsynet_breach  — LEGACY kind from the SendGrid era. Now
 *                            treated identically to
 *                            manual_datatilsynet_submission: flagged
 *                            awaiting_human so an admin can file the
 *                            report manually via the Datatilsynet web
 *                            form. SendGrid was removed (GDPR Art. 44
 *                            / Schrems-II — no US relay for regulator
 *                            notifications).
 *   * manual_datatilsynet_submission — same handling: awaiting_human.
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
 */
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { assertServiceRole, GuardError } from '../_shared/auth.ts'

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
  kind:
    | 'datatilsynet_breach'
    | 'manual_datatilsynet_submission'
    | 'manual_arbeidstilsynet_submission'
    | 'manual_ldo_export'
    | 'nav_sykefravar_outbox'
    | 'ldo_export_pending'
  payload: Record<string, unknown>
  resolved_at: string | null
  retry_count?: number
}

async function flagAwaitingHuman(
  supabase: SupabaseClient,
  row: OutboxRow,
): Promise<{ ok: boolean; error?: string }> {
  // Datatilsynet rows never auto-send. Mark them awaiting_human in the
  // payload so the admin UI (out of scope for this PR) can surface
  // them. We deliberately do NOT set resolved_at — a human must close
  // the row once they have a Datatilsynet reference number.
  const existingPayload = (row.payload ?? {}) as Record<string, unknown>
  if (existingPayload.status === 'awaiting_human') {
    return { ok: true }
  }
  const { error } = await supabase
    .from('gov_notifications_outbox')
    .update({
      payload: {
        ...existingPayload,
        status: 'awaiting_human',
        awaiting_human_since: new Date().toISOString(),
      },
    })
    .eq('id', row.id)
  if (error) return { ok: false, error: `flag_failed:${error.message}` }
  return { ok: true }
}

async function sendNavViaAltinn(
  _supabase: SupabaseClient,
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

  // Cron-only: this is a service-role cross-tenant outbox drainer. The
  // pg_cron job invokes it with the service-role key; requiring service
  // role rejects every ordinary user JWT, so a logged-in tenant user can
  // no longer force-drain other tenants' gov outbox.
  try {
    assertServiceRole(req)
  } catch (err) {
    if (err instanceof GuardError) {
      return json({ ok: false, error: err.code, detail: err.detail }, err.status)
    }
    throw err
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ ok: false, error: 'missing_env' }, 500)
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

  const { data: rows, error: selErr } = await supabase
    .from('gov_notifications_outbox')
    .select('id, organization_id, kind, payload, resolved_at')
    .in('kind', [
      'datatilsynet_breach',
      'manual_datatilsynet_submission',
      'manual_arbeidstilsynet_submission',
      'manual_ldo_export',
      'nav_sykefravar_outbox',
      'ldo_export_pending',
    ])
    .is('resolved_at', null)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)
  if (selErr) return json({ ok: false, error: 'lease_failed', detail: selErr.message }, 500)

  const queue = (rows ?? []) as OutboxRow[]
  const results: Array<{ id: string; kind: string; ok: boolean; error?: string; status?: string }> = []

  for (const row of queue) {
    let result: { ok: boolean; error?: string }
    let status: string | undefined
    if (
      row.kind === 'datatilsynet_breach' ||
      row.kind === 'manual_datatilsynet_submission' ||
      row.kind === 'manual_arbeidstilsynet_submission' ||
      row.kind === 'manual_ldo_export'
    ) {
      // No auto-send: flag awaiting_human. SendGrid is gone, and the
      // LDO-export-pointer flow (generateLdoExportPointer below) still
      // requires a separate review pass — for the new manual_* kinds we
      // therefore leave them parked in the admin inbox rather than
      // auto-generating an evidence pack that nobody has signed off.
      result = await flagAwaitingHuman(supabase, row)
      status = 'awaiting_human'
    } else if (row.kind === 'nav_sykefravar_outbox') {
      result = await sendNavViaAltinn(supabase, row, SUPABASE_URL, SERVICE_ROLE)
    } else {
      // ldo_export_pending — the legacy pre-review LDO export path.
      result = await generateLdoExportPointer(supabase, row, SUPABASE_URL, SERVICE_ROLE)
    }
    if (result.ok && status !== 'awaiting_human') {
      await supabase
        .from('gov_notifications_outbox')
        .update({ resolved_at: new Date().toISOString() })
        .eq('id', row.id)
    }
    results.push({ id: row.id, kind: row.kind, ok: result.ok, error: result.error, status })
  }

  return json({ ok: true, processed: results.length, results })
})
