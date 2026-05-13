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
import { Save, Workflow } from 'lucide-react'
import { useWorkflows } from '../../../hooks/useWorkflows'
import { WorkflowFlowBuilder } from '../WorkflowFlowBuilder'
import {
  defaultWorkflowFlowDocument,
  compileWorkflowFlow,
  parseFlowDocument,
  type WorkflowFlowDocument,
} from '../../../lib/workflowFlowTypes'

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
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <WorkflowFlowBuilder
            value={doc}
            onChange={setDoc}
            sourceModule={rule.source_module}
            compileError={error}
          />
        </div>
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
