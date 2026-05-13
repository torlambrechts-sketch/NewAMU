// CanvasPanel — the visual canvas tab in /workflow/v3.
//
// Wraps the existing WorkflowFlowBuilder (which already implements
// drag-drop linear + XOR flows) and exposes it for any of the org's
// active rules. The user picks a rule, optionally a starting flow
// document (or empty), and edits.  Save commits the compiled
// condition_json + actions_json + flow_graph_json back to workflow_rules.
//
// The WorkflowFlowBuilder template picker now includes the new action
// types (wait_until, request_approval, escalate, parallel, on_error,
// gov actions) — added in this commit. Government actions render with
// a regulator badge and the activation guard from migration
// _20260905120900 prevents accidentally toggling is_active=true on
// a rule with gov actions without workflows.activate_external.

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, FileWarning, Save, ShieldAlert, Workflow, Zap } from 'lucide-react'
import { useWorkflows } from '../../../hooks/useWorkflows'
import { WorkflowFlowBuilder } from '../WorkflowFlowBuilder'
import { getWorkflowScope } from '../../../lib/workflows/workflowRegistry'
import { Badge } from '../../ui/Badge'
import { isGovernmentActionType } from '../../../types/workflow'
import type { WorkflowAction, WorkflowXorActionsEnvelope } from '../../../types/workflow'
import {
  defaultWorkflowFlowDocument,
  compileWorkflowFlow,
  parseFlowDocument,
  type WorkflowFlowDocument,
} from '../../../lib/workflowFlowTypes'

function ruleContainsGovAction(actions: WorkflowAction[] | WorkflowXorActionsEnvelope): boolean {
  if (Array.isArray(actions)) {
    return actions.some((x) => isGovernmentActionType((x as { type: string }).type))
  }
  if (actions && 'mode' in actions && actions.mode === 'xor_branches') {
    return actions.branches.some((b) =>
      (b.actions as WorkflowAction[]).some((x) => isGovernmentActionType((x as { type: string }).type)),
    )
  }
  return false
}

export function CanvasPanel({ initialRuleId }: { initialRuleId?: string | null } = {}) {
  const { rules, upsertRule, canCompose } = useWorkflows()
  const [selectedRuleId, setSelectedRuleId] = useState<string>(initialRuleId ?? '')
  const [doc, setDoc] = useState<WorkflowFlowDocument>(defaultWorkflowFlowDocument())

  useEffect(() => {
    if (initialRuleId && initialRuleId !== selectedRuleId) {
      setSelectedRuleId(initialRuleId)
      const found = rules.find((r) => r.id === initialRuleId)
      if (found?.flow_graph_json) {
        const parsed = parseFlowDocument(found.flow_graph_json as unknown)
        setDoc(parsed ?? defaultWorkflowFlowDocument())
      } else {
        setDoc(defaultWorkflowFlowDocument())
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRuleId, rules])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rule = useMemo(
    () => rules.find((r) => r.id === selectedRuleId) ?? null,
    [rules, selectedRuleId],
  )

  // When the picker changes, hydrate the flow document from the rule's
  // flow_graph_json if present; otherwise start from the default.
  const selectRule = (id: string) => {
    setSelectedRuleId(id)
    setSaved(false)
    setError(null)
    const found = rules.find((r) => r.id === id)
    if (found?.flow_graph_json) {
      const parsed = parseFlowDocument(found.flow_graph_json as unknown)
      setDoc(parsed ?? defaultWorkflowFlowDocument())
    } else {
      setDoc(defaultWorkflowFlowDocument())
    }
  }

  const save = async () => {
    if (!rule) return
    setSaving(true)
    setError(null)
    setSaved(false)
    const compiled = compileWorkflowFlow(doc)
    if ('error' in compiled) {
      setError(compiled.error)
      setSaving(false)
      return
    }
    const result = await upsertRule({
      id: rule.id,
      slug: rule.slug,
      name: rule.name,
      description: rule.description,
      source_module: rule.source_module,
      trigger_on: rule.trigger_on,
      is_active: rule.is_active,
      condition_json: compiled.condition_json,
      actions_json: compiled.actions_json,
      flow_graph_json: doc as unknown as Record<string, unknown>,
      priority: rule.priority,
    })
    setSaving(false)
    if (result?.ok) setSaved(true)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <Workflow className="h-4 w-4 text-emerald-700" />
        <h2 className="text-sm font-semibold text-neutral-900">Visuell canvas</h2>
        <span className="flex-1" />
        <select
          value={selectedRuleId}
          onChange={(e) => selectRule(e.target.value)}
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
        >
          <option value="">— velg en regel —</option>
          {rules.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.source_module})
            </option>
          ))}
        </select>
        {rule && canCompose && (
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Lagrer …' : 'Lagre'}
          </button>
        )}
      </div>
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {saved && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Flyt lagret. Reglens condition_json + actions_json + flow_graph_json er oppdatert.
        </p>
      )}
      {!rule ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
          Velg en regel for å redigere flyten visuelt. Trekker du ikke noen i listen — installer
          startpakker fra Mal-bibliotek først.
        </div>
      ) : (
        <>
          {/* Rule-context header card — surfaces the metadata the canvas alone hides */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-neutral-900">{rule.name}</h3>
                  {rule.is_active ? (
                    <Badge variant="success">
                      <CheckCircle2 className="mr-1 inline h-3 w-3" />
                      Aktiv
                    </Badge>
                  ) : (
                    <Badge variant="neutral">
                      <FileWarning className="mr-1 inline h-3 w-3" />
                      Inaktiv
                    </Badge>
                  )}
                  {ruleContainsGovAction(rule.actions_json) && (
                    <Badge variant="warning">
                      <ShieldAlert className="mr-1 inline h-3 w-3" />
                      Statlig melding
                    </Badge>
                  )}
                  {rule.catalog_slug && (
                    <Badge variant="info">Mal v{rule.catalog_version ?? 1}</Badge>
                  )}
                </div>
                {rule.description && (
                  <p className="mt-1 text-sm text-neutral-600">{rule.description}</p>
                )}
                <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold uppercase tracking-wide text-neutral-500">Modul</span>
                    <span
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
                      style={{
                        borderColor: getWorkflowScope(rule.source_module)?.accent ?? '#d4d4d4',
                        color: getWorkflowScope(rule.source_module)?.accent ?? '#525252',
                      }}
                    >
                      {getWorkflowScope(rule.source_module)?.label ?? rule.source_module}
                    </span>
                    <code className="text-[10px] text-neutral-500">{rule.source_module}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold uppercase tracking-wide text-neutral-500">Trigger</span>
                    {rule.trigger_event_name ? (
                      <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px]">
                        {rule.trigger_event_name}
                      </code>
                    ) : rule.schedule_cron ? (
                      <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px]">
                        {rule.schedule_cron} (cron)
                      </code>
                    ) : (
                      <span className="text-neutral-500">
                        Payload-endring ({rule.trigger_on})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold uppercase tracking-wide text-neutral-500">Lov-refs</span>
                    {(rule.law_refs ?? []).length === 0 ? (
                      <span className="text-neutral-400">—</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {(rule.law_refs ?? []).map((l) => (
                          <code key={l} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-800">
                            {l}
                          </code>
                        ))}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold uppercase tracking-wide text-neutral-500">Fortrolighet</span>
                    <span className="text-neutral-700">
                      {rule.confidentiality_level === 'confidential'
                        ? 'Konfidensielt'
                        : rule.confidentiality_level === 'restricted'
                          ? 'Begrenset'
                          : 'Standard'}
                    </span>
                  </div>
                </div>
              </div>
              <Zap className="mt-1 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <WorkflowFlowBuilder
              value={doc}
              onChange={setDoc}
              sourceModule={rule.source_module}
              compileError={error}
            />
          </div>
        </>
      )}
      <p className="text-xs text-neutral-500">
        Når flyten lagres kompileres den til <code>condition_json</code> +{' '}
        <code>actions_json</code>. Selve grafen lagres i <code>flow_graph_json</code> så åpning
        ser identisk ut. Aktivering av en regel som inneholder en statlig handling (⚖️) krever{' '}
        <code>workflows.activate_external</code> og er beskyttet av activation-guard-trigger fra
        migrasjon <code>_20260905120900</code>.
      </p>
    </div>
  )
}
