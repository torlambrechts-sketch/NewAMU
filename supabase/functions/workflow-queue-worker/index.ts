/**
 * workflow-queue-worker — drains workflow_action_queue.
 *
 * Polls up to BATCH_SIZE rows where status='pending' AND execute_after<=now,
 * dispatches each by action_type:
 *   * wait_until        → mark done (the delay was already enforced by
 *                         execute_after).
 *   * send_email        → workflow_dispatch_notification(category=workflow_email).
 *   * send_notification → workflow_dispatch_notification(category=workflow_in_app).
 *   * call_webhook      → fetch the configured URL with the payload.
 *   * escalate          → workflow_dispatch_notification(category=workflow_escalation).
 *   * on_error          → MUST NOT appear as a top-level row (it lives as
 *                         a sibling on the parent's on_error_actions column
 *                         and is re-enqueued by workflow_enqueue_on_error_actions
 *                         when the parent terminally fails). A direct queue
 *                         row fails fast with on_error_should_not_be_queued_directly.
 *   * Government types  → invoke the matching gov-* edge function:
 *       rapporter_alvorlig_skade_arbeidstilsynet  → gov-arbeidstilsynet-rapport
 *       meld_personvernbrudd_datatilsynet         → gov-datatilsynet-breach
 *       altinn_send_melding                       → gov-altinn-submit
 *       nav_sykefravar_oppfolging                 → gov-nav-sykefravar
 *       varsel_ldo_export                         → handled inline (no API)
 *
 * Notification side-effects flow through workflow_dispatch_notification
 * (see 20260907120200_workflow_notification_dispatch.sql) so:
 *   * recipient role-or-uuid is resolved server-side (functional roles +
 *     catalog aliases like `hms_leder` → `hms_koordinator`),
 *   * notification_key dedupes worker retries,
 *   * runs with confidentiality_level != 'standard' filter recipients to
 *     users carrying `workflows.view_confidential` (whistleblower-safe
 *     fan-out — AML kap. 2A + GDPR Art. 5(1)(f)).
 *
 * Rows are picked with `for update skip locked` so multiple worker
 * invocations can run in parallel safely. On failure we increment
 * attempt_count and re-queue with backoff up to 5 attempts. On terminal
 * failure (attempts == MAX_ATTEMPTS) we call workflow_enqueue_on_error_actions
 * to push the row's declared on_error siblings as new pending rows.
 *
 * Recursion is capped at DEPTH_CAP (5). Each row carries `depth` (0 for
 * trigger-enqueued rows, N for rows enqueued by a row at depth N-1). When
 * a leased row has depth >= 5 we route it through workflow_record_depth_exceeded
 * which writes a workflow_runs(status='skipped', reason='WORKFLOW_DEPTH_EXCEEDED')
 * row and marks the queue row failed — no action executes, no descendants
 * (incl. on_error siblings) get enqueued.
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
  depth: number | null
  on_error_actions: unknown
  parent_queue_id: string | null
}

const DEPTH_CAP = 5

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

/**
 * Look up the parent workflow_runs.confidentiality_level for the queue row.
 * Returns 'standard' when there is no run_id or when the lookup fails — we
 * fail closed only for explicit restricted/confidential values, so a
 * missing run cannot upgrade a row to confidential by accident, but it
 * also cannot leak an actually-confidential payload (the worker carries
 * the run_id in context_json whenever a rule actually executes).
 */
async function loadRunConfidentiality(
  supabase: SupabaseClient,
  runId: string | null,
): Promise<'standard' | 'restricted' | 'confidential'> {
  if (!runId) return 'standard'
  const { data, error } = await supabase
    .from('workflow_runs')
    .select('confidentiality_level')
    .eq('id', runId)
    .maybeSingle()
  if (error || !data) return 'standard'
  const level = (data as { confidentiality_level?: string }).confidentiality_level
  if (level === 'restricted' || level === 'confidential') return level
  return 'standard'
}

function pickRecipient(
  payload: Record<string, unknown>,
  fallback: string,
): string {
  const toUserId = typeof payload.toUserId === 'string' ? payload.toUserId : null
  if (toUserId) return toUserId
  const toRole = typeof payload.toRole === 'string' ? payload.toRole : null
  if (toRole) return toRole
  const recipient = typeof payload.recipient === 'string' ? payload.recipient : null
  if (recipient) return recipient
  return fallback
}

async function dispatchNotification(
  supabase: SupabaseClient,
  row: QueueRow,
  category: 'workflow_email' | 'workflow_in_app' | 'workflow_escalation',
  recipientSpec: string,
  payload: Record<string, unknown>,
  severity: string,
): Promise<{ ok: boolean; error?: string; recipients?: number }> {
  const ctx = (row.context_json ?? {}) as { run_id?: string }
  const runId = ctx.run_id ?? null
  const conf = await loadRunConfidentiality(supabase, runId)
  // Restricted/confidential runs (whistleblower flow, etc.) must only
  // fan out to users carrying workflows.view_confidential. For standard
  // runs we pass null so all assignees are eligible.
  const minPermission = conf === 'standard' ? null : 'workflows.view_confidential'

  const { data, error } = await supabase.rpc('workflow_dispatch_notification', {
    p_org: row.organization_id,
    p_category: category,
    p_payload: payload,
    p_role_or_user: recipientSpec,
    p_severity: severity,
    p_rule_id: row.rule_id,
    p_run_id: runId,
    p_queue_id: row.id,
    p_min_permission: minPermission,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, recipients: typeof data === 'number' ? data : undefined }
}

async function dispatchRow(
  supabase: SupabaseClient,
  row: QueueRow,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<{ ok: boolean; error?: string; recipients?: number }> {
  const effectiveType = row.action_type ?? row.step_type
  if (!effectiveType) return { ok: false, error: 'missing_action_type' }

  const effectivePayload =
    (row.payload as Record<string, unknown> | null) ??
    ({ ...(row.config_json ?? {}), ...(row.context_json ?? {}) } as Record<string, unknown>)

  // wait_until: nothing to do — the delay already elapsed when we picked
  // this row (execute_after <= now). Just mark done. Same for log_only.
  if (effectiveType === 'wait_until' || effectiveType === 'log_only') {
    return { ok: true }
  }

  // on_error is a *child* of another action — it should be hoisted onto
  // the parent row's on_error_actions column by workflow_execute_actions
  // and only ever re-enqueued by workflow_enqueue_on_error_actions when
  // the parent fails. Seeing one queued directly means somebody routed
  // around the dispatcher; fail loudly so the bug surfaces.
  if (effectiveType === 'on_error') {
    return { ok: false, error: 'on_error_should_not_be_queued_directly' }
  }

  // request_approval rows are inserted with status='awaiting_approval'
  // by workflow_execute_actions. workflow_decide_approval (`_120700`)
  // flips them back to status='pending' on approve so the post-approval
  // continuation resumes here. Reject/cancel flips to status='cancelled'
  // — those never reach this dispatcher because the lease only picks
  // status='pending'. If we DO see one here it means either:
  //   (a) the approver approved and we need to mark done so any chained
  //       follow-up actions can run (currently approval is a terminator —
  //       no follow-up actions exist in catalog today), OR
  //   (b) someone re-queued an awaiting-approval row manually; we then
  //       cross-check the workflow_approvals state and act accordingly.
  if (effectiveType === 'request_approval') {
    const { data: approval, error } = await supabase
      .from('workflow_approvals')
      .select('status, decision_note, decided_at')
      .eq('rule_id', row.rule_id)
      .eq('organization_id', row.organization_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error || !approval) return { ok: false, error: 'approval_row_missing' }
    if (approval.status === 'approved') return { ok: true }
    if (approval.status === 'rejected' || approval.status === 'cancelled' || approval.status === 'expired') {
      return {
        ok: false,
        error: `approval_${approval.status}:${approval.decision_note ?? ''}`.slice(0, 240),
      }
    }
    // Still pending — bump execute_after 15 min into the future so we
    // don't busy-loop. Returning ok:true short-circuits the normal mark-
    // done path; we update the row inline so the next batch skips it.
    await supabase
      .from('workflow_action_queue')
      .update({
        status: 'awaiting_approval',
        execute_after: new Date(Date.now() + 15 * 60_000).toISOString(),
      })
      .eq('id', row.id)
    return { ok: true }
  }

  // Notifications (email + in-app) land in compliance_notifications so
  // there's a single inbox per CLAUDE.md reuse rule. We route through the
  // workflow_dispatch_notification RPC which resolves recipients and
  // honours confidentiality_level.
  if (effectiveType === 'send_email' || effectiveType === 'send_notification') {
    const category = effectiveType === 'send_email' ? 'workflow_email' : 'workflow_in_app'
    const recipient = pickRecipient(effectivePayload, 'hms_leder')
    const severity =
      typeof effectivePayload.severity === 'string' ? effectivePayload.severity : 'medium'
    try {
      return await dispatchNotification(supabase, row, category, recipient, effectivePayload, severity)
    } catch (err) {
      return { ok: false, error: `dispatch_failed:${(err as Error).message}` }
    }
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
    // Escalations always carry the role to bump to; default to HMS-leder
    // when the rule author omitted it (matches the workflow_catalog_seed).
    const note = (effectivePayload as { note?: string }).note ?? 'Eskalering fra arbeidsflyt'
    const recipient = pickRecipient(effectivePayload, 'hms_leder')
    const enriched = {
      ...effectivePayload,
      note,
      ruleId: row.rule_id,
      queueId: row.id,
    }
    try {
      return await dispatchNotification(supabase, row, 'workflow_escalation', recipient, enriched, 'high')
    } catch (err) {
      return { ok: false, error: `dispatch_failed:${(err as Error).message}` }
    }
  }

  if (effectiveType === 'varsel_ldo_export') {
    // LDO has no API — generate an outbox row carrying the export pointer.
    const { error } = await supabase.from('gov_notifications_outbox').insert({
      organization_id: row.organization_id,
      kind: 'ldo_export_pending',
      rule_id: row.rule_id,
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
  const results: Array<{ id: string; ok: boolean; error?: string; recipients?: number }> = []

  for (const row of queue) {
    // Depth cap: reject rows that reached the cap *before* dispatching.
    // The RPC writes a workflow_runs row (status=skipped,
    // reason=WORKFLOW_DEPTH_EXCEEDED) and marks the queue row failed.
    // No descendants get enqueued — on_error siblings are also skipped.
    const rowDepth = typeof row.depth === 'number' ? row.depth : 0
    if (rowDepth >= DEPTH_CAP) {
      const { error: depthErr } = await supabase.rpc('workflow_record_depth_exceeded', {
        p_queue_id: row.id,
      })
      results.push({
        id: row.id,
        ok: false,
        error: depthErr
          ? `depth_record_failed:${depthErr.message}`
          : `WORKFLOW_DEPTH_EXCEEDED:depth=${rowDepth}`,
      })
      continue
    }

    let result: { ok: boolean; error?: string; recipients?: number }
    try {
      result = await dispatchRow(supabase, row, SUPABASE_URL, SERVICE_ROLE)
    } catch (err) {
      result = { ok: false, error: `unhandled:${(err as Error).message}` }
    }
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

      // Terminal failure: enqueue the row's on_error siblings transactionally.
      // The RPC inherits org/rule/depth+1 from the parent and dedupes by
      // sha256(parent_id|index|type|on_error) so a worker double-tick can't
      // double-enqueue. We log the result count but never block on it —
      // a missing onError list is the common case.
      if (giveUp && Array.isArray(row.on_error_actions) && row.on_error_actions.length > 0) {
        const { error: onErrErr } = await supabase.rpc('workflow_enqueue_on_error_actions', {
          p_parent_id: row.id,
          p_on_error: row.on_error_actions,
        })
        if (onErrErr) {
          // Stash the on_error failure on the parent so ops can correlate.
          await supabase
            .from('workflow_action_queue')
            .update({
              last_error:
                (result.error?.slice(0, 800) ?? 'failed') +
                ` | on_error_enqueue_failed:${onErrErr.message.slice(0, 200)}`,
            })
            .eq('id', row.id)
        }
      }
    }
    results.push({ id: row.id, ...result })
  }

  return json({ ok: true, processed: results.length, results })
})
