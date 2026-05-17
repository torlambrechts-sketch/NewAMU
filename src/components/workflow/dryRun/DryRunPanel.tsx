// DryRunPanel — simulate a rule against a real workflow_runs payload or a
// hand-crafted JSON payload, without firing any actions.
//
// The simulation is local — it evaluates conditions against the payload and
// reports which actions WOULD execute, without inserting into the queue or
// touching org_module_payloads. For the v1 we evaluate the rule's
// condition_json using the same operator semantics the DB uses
// (workflow_payload_matches_condition) — re-implemented in TS so the panel
// doesn't need an RPC roundtrip.

import { useMemo, useState } from 'react'
import { PlayCircle } from 'lucide-react'
import { useWorkflows } from '../../../hooks/useWorkflows'
import type { WorkflowAction, WorkflowCondition, WorkflowRuleRow, WorkflowXorActionsEnvelope } from '../../../types/workflow'
import { isGovernmentActionType } from '../../../types/workflow'
import { Button } from '../../ui/Button'
import { StandardTextarea } from '../../ui/Textarea'
import { SearchableSelect } from '../../ui/SearchableSelect'

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
    return cur.some((el) => {
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

export function DryRunPanel({ rules }: { rules?: WorkflowRuleRow[] }) {
  const { rules: allRules } = useWorkflows()
  const candidateRules = rules ?? allRules
  const [selectedRuleId, setSelectedRuleId] = useState<string>('')
  const [payload, setPayload] = useState<string>('{\n  "severity": "critical",\n  "templateSlug": "vernerunde"\n}')
  const [output, setOutput] = useState<null | {
    matched: boolean
    actions: WorkflowAction[]
    governmentActions: number
    reason?: string
  }>(null)

  const rule = useMemo(
    () => candidateRules.find((r) => r.id === selectedRuleId) ?? null,
    [candidateRules, selectedRuleId],
  )

  const simulate = () => {
    if (!rule) {
      setOutput({ matched: false, actions: [], governmentActions: 0, reason: 'Velg en regel først.' })
      return
    }
    let parsed: Record<string, unknown> = {}
    try {
      parsed = JSON.parse(payload)
    } catch {
      setOutput({ matched: false, actions: [], governmentActions: 0, reason: 'Ugyldig JSON i payload.' })
      return
    }
    const matched = matches(rule.condition_json, parsed)
    if (!matched) {
      setOutput({ matched: false, actions: [], governmentActions: 0, reason: 'Betingelsen matchet ikke payload.' })
      return
    }
    const actions = flattenActions(rule.actions_json)
    const govCount = actions.filter((a) => isGovernmentActionType((a as { type: string }).type)).length
    setOutput({ matched: true, actions, governmentActions: govCount })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <h2 className="text-sm font-semibold text-neutral-900">Dry-run simulator</h2>
        <span className="text-xs text-neutral-500">Tester regel mot payload uten å kjøre handlingene</span>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4">
          <label className="text-xs font-medium text-neutral-700">Regel</label>
          <SearchableSelect
            value={selectedRuleId}
            onChange={(v) => setSelectedRuleId(v)}
            triggerClassName="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm"
            options={[
              { value: '', label: '— velg en regel —' },
              ...candidateRules.map((r) => ({ value: r.id, label: `${r.name} (${r.source_module})` })),
            ]}
          />
          <label className="mt-3 block text-xs font-medium text-neutral-700">Payload (JSON)</label>
          <StandardTextarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            rows={10}
            className="w-full rounded-md border border-neutral-300 bg-neutral-50 px-2 py-1.5 font-mono text-xs"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={simulate}
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            <PlayCircle className="h-3.5 w-3.5" />
            Simuler
          </Button>
        </div>
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
      </div>
    </div>
  )
}
