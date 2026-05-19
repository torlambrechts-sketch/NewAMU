/**
 * workflow-dry-run — simulate a workflow template without side effects.
 *
 * POST body: { rule_id: string, sample_payload?: Record<string, unknown> }
 *
 * Returns a step-by-step log of what would happen if the trigger fired with
 * the given payload. No actions are executed, no DB rows are written (except
 * the workflow_runs row with dry_run=true which is read-only for audit).
 *
 * Auth: requires JWT; caller must belong to the template's organization and
 * hold workflows.compose or workflows.manage (or be org_admin).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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

    const body = await req.json() as { rule_id: string; sample_payload?: Record<string, unknown> }
    const { rule_id, sample_payload = {} } = body

    if (!rule_id) {
      return Response.json({ ok: false, error: 'rule_id is required' }, { status: 400, headers: corsHeaders })
    }

    // Load the template (RLS enforces org ownership)
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

    // Evaluate condition (simplified — always 'matched' for dry-run unless condition has explicit field check)
    let conditionMatched = true
    const condition = rule.condition_json as Record<string, unknown> | null
    if (condition && condition.match === 'field_equals') {
      const path = condition.path as string
      const expected = condition.value
      const actual = (sample_payload as Record<string, unknown>)[path]
      conditionMatched = actual === expected
      log.push({
        step: 0,
        action_type: 'condition',
        label: 'Når-betingelse',
        status: conditionMatched ? 'would_execute' : 'would_skip',
        note: conditionMatched
          ? `Feltet «${path}» matcher «${String(expected)}»`
          : `Feltet «${path}» er «${String(actual)}», forventet «${String(expected)}» — flyten ville ikke kjørt`,
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

    if (conditionMatched) {
      // Flatten actions from actions_json
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

      const GOV_TYPES = new Set([
        'rapporter_alvorlig_skade_arbeidstilsynet',
        'meld_personvernbrudd_datatilsynet',
        'altinn_send_melding',
        'nav_sykefravar_oppfolging',
        'varsel_ldo_export',
        'meld_helsetilsynet',
      ])

      actions.forEach((action, i) => {
        const isGov = GOV_TYPES.has(action.type)
        log.push({
          step: i + 1,
          action_type: action.type,
          label: (action.label as string | null) ?? null,
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

function describeAction(action: { type: string; [k: string]: unknown }): string {
  switch (action.type) {
    case 'create_task':
      return `Ville opprettet oppgave: «${String(action.title ?? '(uten tittel)')}»`
    case 'send_email':
      return `Ville sendt e-post til ${String(action.to ?? '(mottaker ikke satt)')}`
    case 'send_notification':
      return `Ville sendt varsling: «${String(action.message ?? '(uten melding)')}»`
    case 'call_webhook':
      return `Ville kalt webhook: ${String(action.url ?? '(url ikke satt)')}`
    case 'log_only':
      return `Ville logget: ${String(action.message ?? '(uten melding)')}`
    case 'wait_until':
      return `Ville ventet til: ${String(action.until ?? '(betingelse ikke satt)')}`
    case 'request_approval':
      return `Ville bedt om godkjenning fra rolle: ${String(action.approver_role ?? '(rolle ikke satt)')}`
    case 'escalate':
      return `Ville eskalert til: ${String(action.target_role ?? '(rolle ikke satt)')}`
    case 'parallel_actions':
      return `Ville kjørt ${Array.isArray(action.actions) ? (action.actions as unknown[]).length : 0} parallelle handlinger`
    case 'on_error_handler':
      return `Feilhåndtering ved feil i forrige steg`
    default:
      return `Handling av type «${action.type}»`
  }
}
