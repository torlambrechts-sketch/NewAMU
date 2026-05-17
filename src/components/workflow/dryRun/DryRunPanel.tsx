// DryRunPanel — simulate a rule against a real workflow_runs payload or a
// hand-crafted JSON payload, without firing any actions.
//
// The simulation is local — it evaluates conditions against the payload and
// reports which actions WOULD execute, without inserting into the queue or
// touching org_module_payloads. For the v1 we evaluate the rule's
// condition_json using the same operator semantics the DB uses
// (workflow_payload_matches_condition) — re-implemented in TS so the panel
// doesn't need an RPC roundtrip.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, History, PlayCircle } from 'lucide-react'
import { useWorkflows } from '../../../hooks/useWorkflows'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import type {
  WorkflowAction,
  WorkflowCondition,
  WorkflowRuleRow,
  WorkflowXorActionsEnvelope,
} from '../../../types/workflow'
import { isGovernmentActionType } from '../../../types/workflow'
import { summarizeAction } from '../workflowActionDefaults'
import { Button } from '../../ui/Button'
import { SearchableSelect } from '../../ui/SearchableSelect'
import { StandardTextarea } from '../../ui/Textarea'

function matches(cond: WorkflowCondition, payload: Record<string, unknown>): boolean {
  if (!cond) return true
  const m = (cond as { match?: string }).match
  if (!m || m === 'always') return true
  if (m === 'field_equals') {
    const c = cond as { match: 'field_equals'; path: string; value: string }
    const parts = c.path.split('.')
    let cur: unknown = payload
    for (const p of parts) {
      if (cur && typeof cur === 'object') cur = (cur as Record<string, unknown>)[p]
      else return false
    }
    return String(cur) === String(c.value)
  }
  if (m === 'array_any') {
    const c = cond as { match: 'array_any'; path: string; where: Record<string, unknown> }
    const parts = c.path.split('.')
    let cur: unknown = payload
    for (const p of parts) {
      if (cur && typeof cur === 'object') cur = (cur as Record<string, unknown>)[p]
      else return false
    }
    if (!Array.isArray(cur)) return false
    // C-1 patch: scalar array elements (string/number/boolean) match when
    // `where` is an object with only a `value` key and the element equals
    // that value. Keeps the existing array-of-objects field-match path
    // working for arrays of objects.
    const whereKeys = Object.keys(c.where ?? {})
    const isScalarValueMatch =
      whereKeys.length === 1 && whereKeys[0] === 'value'
    return cur.some((el) => {
      if (
        isScalarValueMatch &&
        (typeof el === 'string' || typeof el === 'number' || typeof el === 'boolean')
      ) {
        return el === (c.where as { value: unknown }).value
      }
      if (el && typeof el === 'object') {
        return Object.entries(c.where).every(
          ([k, v]) => (el as Record<string, unknown>)[k] === v,
        )
      }
      return false
    })
  }
  if (m === 'and') {
    const c = cond as { match: 'and'; conditions: WorkflowCondition[] }
    return c.conditions.every((sub) => matches(sub, payload))
  }
  if (m === 'or') {
    const c = cond as { match: 'or'; conditions: WorkflowCondition[] }
    return c.conditions.some((sub) => matches(sub, payload))
  }
  if (m === 'xor') {
    const c = cond as { match: 'xor'; conditions: WorkflowCondition[] }
    return c.conditions.filter((sub) => matches(sub, payload)).length === 1
  }
  return false
}

function flattenActions(actions: WorkflowAction[] | WorkflowXorActionsEnvelope): WorkflowAction[] {
  if (Array.isArray(actions)) return actions
  if (actions && 'mode' in actions && actions.mode === 'xor_branches') {
    return actions.branches.flatMap((b) => b.actions)
  }
  return []
}

/**
 * Snapshot of an actual workflow run loaded via `?fromRun=`. Renders the
 * left side of the "Da kjørte den (faktisk) / Nå ville den kjørt (tørrløp)"
 * comparison panel.
 *
 * The payload fallback chain is documented on `loadFromRun()` below:
 * `input_snapshot → input_payload → detail.payload`. Pre-substrate runs
 * (before migration `_20260905120400`) only have `detail.payload`, so the
 * fallback keeps the replay working for legacy rows.
 */
type FromRunSnapshot = {
  id: string
  ruleId: string | null
  createdAt: string
  sourceModule: string | null
  eventName: string | null
  payload: Record<string, unknown>
  /** The action types that actually ran historically (for diffing). */
  historicalActionTypes: string[]
  /** Historical run status (completed / skipped / failed). */
  historicalStatus: string
}

type SimulationOutput = {
  matched: boolean
  actions: WorkflowAction[]
  governmentActions: number
  reason?: string
}

export function DryRunPanel({ rules }: { rules?: WorkflowRuleRow[] }) {
  const { rules: allRules } = useWorkflows()
  const { supabase } = useOrgSetupContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const fromRunParam = searchParams.get('fromRun')
  // Helsesjekk-fanen deep-links here with `?tab=dry-run&rule=<id>` for the
  // "Test mot siste hendelse"-button on silent rules. We pre-select the
  // rule on mount when no `?fromRun=` (which already hydrates its own rule).
  const ruleParam = searchParams.get('rule')
  const candidateRules = rules ?? allRules
  const [selectedRuleId, setSelectedRuleId] = useState<string>('')
  const [payload, setPayload] = useState<string>('{\n  "severity": "critical",\n  "templateSlug": "vernerunde"\n}')
  const [output, setOutput] = useState<SimulationOutput | null>(null)
  const [fromRun, setFromRun] = useState<FromRunSnapshot | null>(null)
  const [fromRunError, setFromRunError] = useState<string | null>(null)
  const [fromRunLoading, setFromRunLoading] = useState(false)
  /** Track which fromRun id we've already hydrated to avoid re-fetch loops. */
  const hydratedFromRunRef = useRef<string | null>(null)

  const rule = useMemo(
    () => candidateRules.find((r) => r.id === selectedRuleId) ?? null,
    [candidateRules, selectedRuleId],
  )

  // Pre-select from `?rule=` when fromRun isn't driving the selection.
  // We only do this once on first match — the user may change rule
  // manually afterward, and we don't want to clobber that.
  const ruleParamAppliedRef = useRef<string | null>(null)
  useEffect(() => {
    if (fromRunParam) return
    if (!ruleParam) return
    if (ruleParamAppliedRef.current === ruleParam) return
    if (!candidateRules.find((r) => r.id === ruleParam)) return
    setSelectedRuleId(ruleParam)
    ruleParamAppliedRef.current = ruleParam
  }, [fromRunParam, ruleParam, candidateRules])

  // ─── Replay-from-real: hydrate from ?fromRun= ─────────────────────────────
  // Fetch the underlying workflow_runs row and pre-populate the form so the
  // user can compare what actually ran with what the current rule would do
  // for the same payload. Side-effect-free read (uses `.single()` + RLS).
  useEffect(() => {
    if (!fromRunParam || !supabase) return
    if (hydratedFromRunRef.current === fromRunParam) return
    let cancelled = false
    setFromRunLoading(true)
    setFromRunError(null)
    ;(async () => {
      try {
        // NOTE: the spec calls for `input_payload` but the canonical
        // schema (post-`_20260905120400`) only carries `input_snapshot`.
        // `input_payload` lived briefly in pre-substrate detail blobs; we
        // honour it via the fallback chain below if it ever appears nested
        // in `detail`. Listing it in the select would fail with 42703.
        const { data, error } = await supabase
          .from('workflow_runs')
          .select('id, rule_id, input_snapshot, source_module, event, detail, status, created_at')
          .eq('id', fromRunParam)
          .single()
        if (cancelled) return
        if (error || !data) {
          setFromRun(null)
          setFromRunError(error?.message ?? 'Fant ikke kjøringen.')
          return
        }
        // Payload fallback chain: input_snapshot → input_payload (legacy,
        // nested in `detail`) → detail.payload. Pre-substrate runs (before
        // `_20260905120400`) only carry `detail.payload` which mirrors the
        // original trigger blob, so the fallback keeps audit replay working
        // for legacy rows that never got an `input_snapshot` backfill.
        const row = data as Record<string, unknown>
        const detail = (row.detail ?? {}) as Record<string, unknown>
        const rawPayload =
          (row.input_snapshot as Record<string, unknown> | null | undefined) ??
          (detail.input_payload as Record<string, unknown> | undefined) ??
          (detail.payload as Record<string, unknown> | undefined) ??
          {}
        const historicalActions = Array.isArray(detail.actions)
          ? (detail.actions as Array<{ type?: string }>).map((a) => a?.type ?? 'unknown')
          : []
        const snapshot: FromRunSnapshot = {
          id: String(row.id),
          ruleId: (row.rule_id as string | null) ?? null,
          createdAt: String(row.created_at),
          sourceModule: (row.source_module as string | null) ?? null,
          eventName: (row.event as string | null) ?? null,
          payload: rawPayload,
          historicalActionTypes: historicalActions,
          historicalStatus: (row.status as string) ?? 'unknown',
        }
        setFromRun(snapshot)
        if (snapshot.ruleId) setSelectedRuleId(snapshot.ruleId)
        setPayload(JSON.stringify(rawPayload, null, 2))
        // Auto-simulate runs in a separate effect below once the rule has
        // hydrated from candidateRules (rules array may not be populated yet
        // on first render).
        hydratedFromRunRef.current = fromRunParam
      } catch (err) {
        if (cancelled) return
        setFromRun(null)
        setFromRunError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setFromRunLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fromRunParam, supabase])

  const clearFromRun = () => {
    setFromRun(null)
    setFromRunError(null)
    hydratedFromRunRef.current = null
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        params.set('tab', 'runs')
        params.delete('fromRun')
        if (fromRun?.ruleId) params.set('rule', fromRun.ruleId)
        return params
      },
      { replace: false },
    )
  }

  const simulate = () => {
    if (!rule) {
      setOutput({ matched: false, actions: [], governmentActions: 0, reason: 'Velg en regel først.' })
      return
    }
    let parsed: Record<string, unknown> = {}
    try {
      parsed = JSON.parse(payload)
    } catch {
      setOutput({ matched: false, actions: [], governmentActions: 0, reason: 'Ugyldig JSON i data-pakken.' })
      return
    }
    const matched = matches(rule.condition_json, parsed)
    if (!matched) {
      setOutput({ matched: false, actions: [], governmentActions: 0, reason: 'Betingelsen matchet ikke data-pakken.' })
      return
    }
    const actions = flattenActions(rule.actions_json)
    const govCount = actions.filter((a) => isGovernmentActionType((a as { type: string }).type)).length
    setOutput({ matched: true, actions, governmentActions: govCount })
  }

  // ─── Diff helpers for side-by-side render ─────────────────────────────────
  const simulatedActionTypes = output?.matched
    ? output.actions.map((a) => (a as { type: string }).type)
    : []
  const historicalTypes = fromRun?.historicalActionTypes ?? []
  const addedTypes = simulatedActionTypes.filter((t) => !historicalTypes.includes(t))
  const removedTypes = historicalTypes.filter((t) => !simulatedActionTypes.includes(t))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <h2 className="text-sm font-semibold text-neutral-900">Tørrløp-simulator</h2>
        <span className="text-xs text-neutral-500">
          Tester regel mot data-pakke uten å kjøre handlingene
        </span>
      </div>

      {/* Replay-from-real banner */}
      {fromRunLoading && (
        <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">
          Laster kjøring …
        </div>
      )}
      {fromRunError && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Kunne ikke laste kjøringen: {fromRunError}
        </div>
      )}
      {fromRun && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <History className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            Tørrløp basert på faktisk kjøring fra{' '}
            <strong>{new Date(fromRun.createdAt).toLocaleString('nb-NO')}</strong>.
          </span>
          <span className="flex-1" />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            icon={<ArrowLeft className="h-3.5 w-3.5" />}
            onClick={clearFromRun}
          >
            Tilbake til faktisk kjøring
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4">
          <label className="text-xs font-medium text-neutral-700">Regel</label>
          <SearchableSelect
            value={selectedRuleId}
            onChange={setSelectedRuleId}
            options={[
              { value: '', label: '— velg en regel —' },
              ...candidateRules.map((r) => ({
                value: r.id,
                label: `${r.name} (${r.source_module})`,
              })),
            ]}
          />
          <label className="mt-3 block text-xs font-medium text-neutral-700" htmlFor="dry-run-payload">
            Data-pakke (JSON)
          </label>
          <StandardTextarea
            id="dry-run-payload"
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            rows={10}
            className="bg-neutral-50 font-mono text-xs"
          />
          <Button
            type="button"
            size="sm"
            variant="primary"
            icon={<PlayCircle className="h-3.5 w-3.5" />}
            onClick={simulate}
          >
            Simuler
          </Button>
        </div>

        {/* Side-by-side: historical vs simulated when fromRun is present;
            falls back to the single "Resultat" panel for ad-hoc payloads. */}
        {fromRun ? (
          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-xl border border-neutral-300 bg-neutral-50 p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                Da kjørte den (faktisk)
              </h3>
              <p className="mb-2 text-xs text-neutral-500">
                Status: <strong>{fromRun.historicalStatus}</strong>
                {fromRun.eventName ? (
                  <>
                    {' '}· hendelse: <code>{fromRun.eventName}</code>
                  </>
                ) : null}
              </p>
              {historicalTypes.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  Ingen handlinger registrert på den faktiske kjøringen.
                </p>
              ) : (
                <ul className="space-y-1">
                  {historicalTypes.map((t, i) => (
                    <li
                      key={`hist-${i}`}
                      className={`rounded border bg-white px-2 py-1 text-xs ${
                        removedTypes.includes(t)
                          ? 'border-amber-300 text-amber-900'
                          : 'border-neutral-200 text-neutral-700'
                      }`}
                    >
                      <code className="font-mono">{t}</code>
                      {removedTypes.includes(t) ? (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-700">
                          ikke lenger
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-emerald-300 bg-white p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Nå ville den kjørt (tørrløp)
              </h3>
              {!output ? (
                <p className="text-sm text-neutral-500">
                  Klikk «Simuler» for å se hva regelen ville gjort i dag.
                </p>
              ) : output.matched ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-emerald-700">
                    Regelen ville fyrt {output.actions.length} handlinger.
                  </p>
                  {output.governmentActions > 0 && (
                    <p className="rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-800">
                      ⚖️ Inkluderer {output.governmentActions} statlig melding(er). Krever
                      workflows.activate_external + dobbel godkjenning før reell aktivering.
                    </p>
                  )}
                  <ul className="space-y-1">
                    {output.actions.map((a, i) => {
                      const t = (a as { type: string }).type
                      const isNew = addedTypes.includes(t)
                      return (
                        <li
                          key={`sim-${i}`}
                          className={`rounded border px-2 py-1 text-xs ${
                            isNew ? 'border-emerald-400 bg-emerald-50 text-emerald-900' : 'border-neutral-200 bg-neutral-50 text-neutral-700'
                          }`}
                        >
                          <code className="font-mono">{t}</code>
                          {isNew ? (
                            <span className="ml-2 text-[10px] uppercase tracking-wide text-emerald-700">
                              ny
                            </span>
                          ) : null}
                          <span className="ml-2 text-[11px] text-neutral-500">— {summarizeAction(a)}</span>
                        </li>
                      )
                    })}
                  </ul>
                  {addedTypes.length === 0 && removedTypes.length === 0 ? (
                    <p className="text-xs text-neutral-500">
                      Ingen endringer i handlingsutfallet sammenliknet med den faktiske kjøringen.
                    </p>
                  ) : (
                    <p className="text-xs text-neutral-700">
                      Endringer: +{addedTypes.length} ny, −{removedTypes.length} fjernet.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-neutral-600">
                  {output.reason ?? 'Ingen handlinger ville fyrt.'}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Resultat</h3>
            {!output ? (
              <p className="text-sm text-neutral-500">Klikk «Simuler» for å se hva regelen ville gjort.</p>
            ) : output.matched ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-emerald-700">
                  Regelen ville fyrt {output.actions.length} handlinger.
                </p>
                {output.governmentActions > 0 && (
                  <p className="rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-800">
                    ⚖️ Inkluderer {output.governmentActions} statlig melding(er). Krever
                    workflows.activate_external + dobbel godkjenning før reell aktivering.
                  </p>
                )}
                <ul className="space-y-1">
                  {output.actions.map((a, i) => (
                    <li key={i} className="rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs">
                      <code className="font-mono">{(a as { type: string }).type}</code>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-neutral-600">{output.reason ?? 'Ingen handlinger ville fyrt.'}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
