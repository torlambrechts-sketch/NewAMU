/**
 * workflow-queue-worker — drains workflow_action_queue.
 *
 * Polls up to BATCH_SIZE rows where status='pending' AND execute_after<=now,
 * dispatches each by action_type:
 *   * wait_until        → mark done (the delay was already enforced by
 *                         execute_after).
 *   * send_email        → insert into compliance_notifications kind=email.
 *   * send_notification → insert into compliance_notifications kind=notification.
 *   * call_webhook      → fetch the configured URL with the payload.
 *   * escalate          → bump task / queue an escalation notification.
 *   * on_error          → no-op (handled implicitly by the failure path).
 *   * Government types  → invoke the matching gov-* edge function:
 *       rapporter_alvorlig_skade_arbeidstilsynet  → gov-arbeidstilsynet-rapport
 *       meld_personvernbrudd_datatilsynet         → gov-datatilsynet-breach
 *       altinn_send_melding                       → gov-altinn-submit
 *       nav_sykefravar_oppfolging                 → gov-nav-sykefravar
 *       varsel_ldo_export                         → handled inline (no API)
 *
 * Rows are picked with `for update skip locked` so multiple worker
 * invocations can run in parallel safely. On failure we increment
 * attempt_count and re-queue with backoff up to 5 attempts.
 *
 * Triggered every minute by a pg_cron job that POSTs to this endpoint
 * with a service-role token. The migration that registers the cron is
 * supabase/migrations/20260905121400_workflow_queue_worker_cron.sql.
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
const MAX_ATTEMPTS = 5

type QueueRow = {
  id: string
  organization_id: string
  rule_id: string | null
  action_type: string | null
  step_type: string | null
  payload: Record<string, unknown> | null
  config_json: Record<string, unknown> | null
  context_json: Record<string, unknown> | null
  attempt_count: number
}

const GOV_TO_FN: Record<string, string> = {
  rapporter_alvorlig_skade_arbeidstilsynet: 'gov-arbeidstilsynet-rapport',
  meld_personvernbrudd_datatilsynet: 'gov-datatilsynet-breach',
  altinn_send_melding: 'gov-altinn-submit',
  nav_sykefravar_oppfolging: 'gov-nav-sykefravar',
}

async function invokeGovFunction(
  supabaseUrl: string,
  serviceRoleKey: string,
  fnName: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const responseBody = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body: responseBody }
}

async function dispatchRow(
  supabase: SupabaseClient,
  row: QueueRow,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<{ ok: boolean; error?: string }> {
  const effectiveType = row.action_type ?? row.step_type
  if (!effectiveType) return { ok: false, error: 'missing_action_type' }

  const effectivePayload =
    row.payload ?? { ...(row.config_json ?? {}), ...(row.context_json ?? {}) }

  // wait_until: nothing to do — the delay already elapsed when we picked
  // this row (execute_after <= now). Just mark done.
  if (effectiveType === 'wait_until' || effectiveType === 'on_error' || effectiveType === 'log_only') {
    return { ok: true }
  }

  // Notifications (email + in-app) land in compliance_notifications so
  // there's a single inbox per CLAUDE.md reuse rule.
  if (effectiveType === 'send_email' || effectiveType === 'send_notification') {
    const { error } = await supabase.from('compliance_notifications').insert({
      organization_id: row.organization_id,
      kind: effectiveType === 'send_email' ? 'workflow_email' : 'workflow_in_app',
      payload: effectivePayload,
    })
    return error ? { ok: false, error: error.message } : { ok: true }
  }

  if (effectiveType === 'call_webhook') {
    const url = (effectivePayload as { url?: string }).url
    if (!url) return { ok: false, error: 'missing_webhook_url' }
    try {
      const res = await fetch(url, {
        method: (effectivePayload as { method?: string }).method ?? 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(effectivePayload),
      })
      return res.ok ? { ok: true } : { ok: false, error: `webhook_status_${res.status}` }
    } catch (err) {
      return { ok: false, error: `webhook_failed:${(err as Error).message}` }
    }
  }

  if (effectiveType === 'escalate') {
    // Insert a follow-up task. Keeps it simple — the bigger escalation
    // chain (role bumping, notifications) is layered via subsequent rules.
    const note = (effectivePayload as { note?: string }).note ?? 'Eskalering fra arbeidsflyt'
    const toRole = (effectivePayload as { toRole?: string }).toRole ?? 'hms_leder'
    const { error } = await supabase.from('compliance_notifications').insert({
      organization_id: row.organization_id,
      kind: 'workflow_escalation',
      payload: { note, toRole, ruleId: row.rule_id, queueId: row.id },
    })
    return error ? { ok: false, error: error.message } : { ok: true }
  }

  if (effectiveType === 'varsel_ldo_export') {
    // LDO has no API — generate a notification carrying the export pointer.
    const { error } = await supabase.from('compliance_notifications').insert({
      organization_id: row.organization_id,
      kind: 'ldo_export_pending',
      payload: { queueId: row.id, ruleId: row.rule_id, body: effectivePayload },
    })
    return error ? { ok: false, error: error.message } : { ok: true }
  }

  // Government action types route to their dedicated edge functions.
  const govFn = GOV_TO_FN[effectiveType]
  if (govFn) {
    const result = await invokeGovFunction(supabaseUrl, serviceRoleKey, govFn, {
      organization_id: row.organization_id,
      rule_id: row.rule_id,
      run_id: (effectivePayload as { run_id?: string }).run_id,
      event_name: (effectivePayload as { eventName?: string }).eventName ?? effectiveType,
      payload: effectivePayload,
    })
    if (!result.ok) {
      return {
        ok: false,
        error: `gov_function_failed:${result.status}:${JSON.stringify(result.body).slice(0, 240)}`,
      }
    }
    return { ok: true }
  }

  return { ok: false, error: `unknown_action_type:${effectiveType}` }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json({ ok: false, error: 'missing_env' }, 500)
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

  // Pull a batch of pending rows. We do this in a single statement so
  // FOR UPDATE SKIP LOCKED gives us a clean lease.
  const { data: rows, error: selErr } = await supabase.rpc('workflow_queue_lease', {
    p_batch_size: BATCH_SIZE,
  })
  if (selErr) return json({ ok: false, error: 'lease_failed', detail: selErr.message }, 500)

  const queue = (rows ?? []) as QueueRow[]
  const results: Array<{ id: string; ok: boolean; error?: string }> = []

  for (const row of queue) {
    const result = await dispatchRow(supabase, row, SUPABASE_URL, SERVICE_ROLE)
    if (result.ok) {
      await supabase
        .from('workflow_action_queue')
        .update({ status: 'done', last_error: null })
        .eq('id', row.id)
    } else {
      const newAttempts = row.attempt_count + 1
      const giveUp = newAttempts >= MAX_ATTEMPTS
      const backoffSeconds = Math.min(2 ** newAttempts * 5, 600)
      await supabase
        .from('workflow_action_queue')
        .update({
          status: giveUp ? 'failed' : 'pending',
          attempt_count: newAttempts,
          last_error: result.error?.slice(0, 1000) ?? null,
          execute_after: giveUp ? null : new Date(Date.now() + backoffSeconds * 1000).toISOString(),
        })
        .eq('id', row.id)
    }
    results.push({ id: row.id, ...result })
  }

  return json({ ok: true, processed: results.length, results })
})
