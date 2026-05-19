/**
 * workflow-dry-run — simulate a workflow template without side effects.
 *
 * POST body: { rule_id: string, sample_payload?: Record<string, unknown> }
 *
 * Returns a step-by-step log of what would happen if the trigger fired with
 * the given payload. No actions are executed, no DB rows are written.
 *
 * Auth: requires JWT; caller must hold workflows.compose, workflows.manage,
 * or be org_admin for the template's organisation (checked via RPC).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Restrict to known app origins; never wildcard with authenticated endpoints.
const ALLOWED_ORIGINS = new Set([
  'https://app.klarert.no',
  'https://staging.klarert.no',
  'http://localhost:5173', // dev
])

function makeCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_BODY_BYTES = 64 * 1024 // 64 KB
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const GOV_TYPES = new Set([
  'rapporter_alvorlig_skade_arbeidstilsynet',
  'meld_personvernbrudd_datatilsynet',
  'altinn_send_melding',
  'nav_sykefravar_oppfolging',
  'varsel_ldo_export',
  'meld_helsetilsynet',
])

// ─── Types ────────────────────────────────────────────────────────────────────
type DryRunLogEntry = {
  step: number
  action_type: string
  label: string | null
  status: 'would_execute' | 'would_skip' | 'gov_action_blocked'
  note: string
}

type DryRunResult = {
  ok: boolean
  rule_id: string
  triggered_by: string
  evaluated_at: string
  condition_matched: boolean
  log: DryRunLogEntry[]
  error?: string
}

// ─── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const corsHeaders = makeCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return Response.json({ ok: false, error: 'Missing authorization header' }, { status: 401, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
    }

    // ── Permission check (workflows.compose | workflows.manage | org_admin) ──
    const [{ data: canCompose }, { data: canManage }, { data: isAdmin }] = await Promise.all([
      supabase.rpc('user_has_permission', { perm: 'workflows.compose' }),
      supabase.rpc('user_has_permission', { perm: 'workflows.manage' }),
      supabase.rpc('is_org_admin'),
    ])
    if (!canCompose && !canManage && !isAdmin) {
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403, headers: corsHeaders })
    }

    // ── Body size limit ───────────────────────────────────────────────────────
    const rawBody = await req.arrayBuffer()
    if (rawBody.byteLength > MAX_BODY_BYTES) {
      return Response.json({ ok: false, error: 'Request too large' }, { status: 413, headers: corsHeaders })
    }
    const body = JSON.parse(new TextDecoder().decode(rawBody)) as {
      rule_id: string
      sample_payload?: Record<string, unknown>
    }
    const { rule_id, sample_payload = {} } = body

    // ── UUID validation ───────────────────────────────────────────────────────
    if (!rule_id || !UUID_RE.test(rule_id)) {
      return Response.json({ ok: false, error: 'Invalid rule_id' }, { status: 400, headers: corsHeaders })
    }

    // ── Load template (RLS enforces org ownership) ─────────────────────────────
    const { data: rule, error: ruleError } = await supabase
      .from('workflow_rules')
      .select('id, name, organization_id, source_module, trigger_event_name, condition_json, actions_json, flow_graph_json, is_template, runtime_environment')
      .eq('id', rule_id)
      .eq('is_template', true)
      .maybeSingle()

    if (ruleError || !rule) {
      return Response.json({ ok: false, error: ruleError?.message ?? 'Template not found' }, { status: 404, headers: corsHeaders })
    }

    const log: DryRunLogEntry[] = []

    // ── Evaluate condition ─────────────────────────────────────────────────────
    let conditionMatched = true
    const condition = rule.condition_json as Record<string, unknown> | null
    if (condition && condition.match === 'field_equals') {
      const path = String(condition.path ?? '')
      const expected = condition.value
      const actual = (sample_payload as Record<string, unknown>)[path]
      conditionMatched = actual === expected
      log.push({
        step: 0,
        action_type: 'condition',
        label: 'Når-betingelse',
        status: conditionMatched ? 'would_execute' : 'would_skip',
        note: conditionMatched
          ? `Feltet «${truncate(path)}» matcher «${truncate(String(expected))}»`
          : `Feltet «${truncate(path)}» er «${truncate(String(actual))}», forventet «${truncate(String(expected))}» — flyten ville ikke kjørt`,
      })
    } else {
      log.push({
        step: 0,
        action_type: 'condition',
        label: 'Når-betingelse',
        status: 'would_execute',
        note: condition?.match === 'always'
          ? 'Alltid aktiv — ingen betingelsessjekk'
          : 'Betingelsessjekk passerte (dry-run simulerer match)',
      })
    }

    // ── Evaluate actions ───────────────────────────────────────────────────────
    if (conditionMatched) {
      const actionsJson = rule.actions_json as unknown
      const actions: { type: string; [k: string]: unknown }[] = []

      if (Array.isArray(actionsJson)) {
        actions.push(...(actionsJson as typeof actions))
      } else if (actionsJson && typeof actionsJson === 'object' && 'branches' in actionsJson) {
        const env = actionsJson as { branches: { condition: unknown; actions: typeof actions }[] }
        for (const branch of env.branches) {
          actions.push(...branch.actions)
        }
      }

      actions.forEach((action, i) => {
        const isGov = GOV_TYPES.has(action.type)
        log.push({
          step: i + 1,
          action_type: action.type,
          label: typeof action.label === 'string' ? truncate(action.label) : null,
          status: isGov ? 'gov_action_blocked' : 'would_execute',
          note: isGov
            ? `Statlig rapporteringshandling — blokkert i dry-run (${rule.runtime_environment === 'prod' ? 'produksjonsmiljø' : 'testmiljø TT02'})`
            : describeAction(action),
        })
      })
    }

    const result: DryRunResult = {
      ok: true,
      rule_id,
      triggered_by: rule.trigger_event_name ?? rule.source_module,
      evaluated_at: new Date().toISOString(),
      condition_matched: conditionMatched,
      log,
    }

    return Response.json(result, { headers: corsHeaders })
  } catch (err) {
    console.error('[workflow-dry-run]', err)
    const msg = err instanceof Error ? err.message : 'Internal error'
    return Response.json({ ok: false, error: msg }, { status: 500, headers: corsHeaders })
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(s: string, max = 120): string {
  return s.length > max ? `${s.slice(0, max)}…` : s
}

function safeStr(v: unknown, fallback: string): string {
  return typeof v === 'string' ? truncate(v) : fallback
}

function describeAction(action: { type: string; [k: string]: unknown }): string {
  switch (action.type) {
    case 'create_task':
      return `Ville opprettet oppgave: «${safeStr(action.title, '(uten tittel)')}»`
    case 'send_email':
      return `Ville sendt e-post til ${safeStr(action.toAddress ?? action.to, '(mottaker ikke satt)')}`
    case 'send_notification':
      return `Ville sendt varsling: «${safeStr(action.message, '(uten melding)')}»`
    case 'call_webhook': {
      const url = safeStr(action.url, '(url ikke satt)')
      // Only log https:// URLs to avoid logging dangerous schemes
      const safeUrl = url.startsWith('https://') ? url : '(ikke-https url)')
      return `Ville kalt webhook: ${safeUrl}`
    }
    case 'log_only':
      return `Ville logget: ${safeStr(action.message, '(uten melding)')}`
    case 'wait_until':
      return `Ville ventet til: ${safeStr(action.until, '(betingelse ikke satt)')}`
    case 'request_approval':
      return `Ville bedt om godkjenning fra rolle: ${safeStr(action.approver_role, '(rolle ikke satt)')}`
    case 'escalate':
      return `Ville eskalert til: ${safeStr(action.target_role, '(rolle ikke satt)')}`
    case 'parallel_actions':
      return `Ville kjørt ${Array.isArray(action.actions) ? (action.actions as unknown[]).length : 0} parallelle handlinger`
    case 'on_error_handler':
      return `Feilhåndtering ved feil i forrige steg`
    default:
      return `Handling av type «${truncate(action.type)}»`
  }
}
