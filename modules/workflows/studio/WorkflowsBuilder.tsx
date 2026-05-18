// WorkflowsBuilder — basic 3-column builder for workflow rules.
//
// Replaces the empty "v3 kommer" placeholder users saw before. Provides
// a real, usable surface for the trigger → condition → action shape
// that workflow_rules carries. The full v3 graph canvas
// (workflow-engine-review.md Phase B) is still pending; this is a
// functional Phase 1.5 builder that uses the same StudioCanvas chrome
// as every other scope, so the visual surface is consistent.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { StudioCanvas, type StudioCanvasAdapter } from '../../../src/components/studio/shell/StudioCanvas'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'

type WorkflowRule = {
  id: string
  name: string
  description: string | null
  trigger_event_name: string | null
  source_module: string | null
  is_active: boolean
  condition_json: Record<string, unknown> | null
  actions_json: Record<string, unknown> | null
}

// Three pseudo-items the user navigates between in the left column.
// Mirrors the workflow_rules row shape (trigger → condition → actions).
type BuilderSection = 'trigger' | 'condition' | 'actions'

const SECTION_LABEL: Record<BuilderSection, string> = {
  trigger: '1 · Trigger',
  condition: '2 · Vilkår',
  actions: '3 · Handlinger',
}

export type WorkflowsBuilderProps = {
  ruleId: string
}

export function WorkflowsBuilder({ ruleId }: WorkflowsBuilderProps) {
  const { supabase } = useOrgSetupContext()
  const [rule, setRule] = useState<WorkflowRule | null>(null)
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<BuilderSection>('trigger')

  const reload = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const { data, error: e } = await supabase
      .from('workflow_rules')
      .select('id, name, description, trigger_event_name, source_module, is_active, condition_json, actions_json')
      .eq('id', ruleId)
      .single()
    if (e) setError(e.message)
    else setRule(data as WorkflowRule)
    setLoading(false)
  }, [supabase, ruleId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- canonical fetch-on-mount
    void reload()
  }, [reload])

  const update = useCallback(
    (patch: Partial<WorkflowRule>) => {
      setRule((prev) => (prev ? { ...prev, ...patch } : prev))
      setDirty(true)
    },
    [],
  )

  const save = useCallback(async () => {
    if (!supabase || !rule) return
    setSaving(true)
    setError(null)
    const { error: e } = await supabase
      .from('workflow_rules')
      .update({
        name: rule.name,
        description: rule.description,
        trigger_event_name: rule.trigger_event_name,
        source_module: rule.source_module,
        is_active: rule.is_active,
        condition_json: rule.condition_json,
        actions_json: rule.actions_json,
      })
      .eq('id', rule.id)
    if (e) setError(e.message)
    else setDirty(false)
    setSaving(false)
  }, [supabase, rule])

  const adapter: StudioCanvasAdapter<BuilderSection> = useMemo(
    () => ({
      items: ['trigger', 'condition', 'actions'] as BuilderSection[],
      getItemId: (s) => s,
      selectedId: selected,
      onSelect: (id) => setSelected(id as BuilderSection),
      renderItemLabel: (s) => SECTION_LABEL[s],
      renderEditor: (s) => {
        if (!rule) return null
        if (s === 'trigger') return <TriggerEditor rule={rule} onChange={update} />
        if (s === 'condition') return <JsonEditor label="Vilkår (condition_json)" value={rule.condition_json} onChange={(v) => update({ condition_json: v })} />
        if (s === 'actions') return <JsonEditor label="Handlinger (actions_json)" value={rule.actions_json} onChange={(v) => update({ actions_json: v })} />
        return null
      },
      renderProperties: () => (rule ? <RuleProperties rule={rule} onChange={update} /> : null),
    }),
    [rule, selected, update],
  )

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Laster regel…
      </div>
    )
  }
  if (!rule) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Fant ikke regel <code>{ruleId}</code>.
      </div>
    )
  }

  return (
    <>
      <StudioCanvas
        title={`Arbeidsflyt · ${rule.name || '(uten navn)'}`}
        subtitle={`${rule.source_module ?? '?'} · ${rule.is_active ? 'aktiv' : 'inaktiv'}`}
        headerActions={
          <Button variant="primary" size="sm" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {dirty ? 'Lagre' : 'Lagret'}
          </Button>
        }
        adapter={adapter}
      />
      {error ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      ) : null}
    </>
  )
}

function TriggerEditor({ rule, onChange }: { rule: WorkflowRule; onChange: (patch: Partial<WorkflowRule>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
          Trigger-hendelse
        </label>
        <StandardInput
          value={rule.trigger_event_name ?? ''}
          onChange={(e) => onChange({ trigger_event_name: e.target.value })}
          placeholder="f.eks. module_compliance_template_signed"
          className="mt-1"
        />
        <p className="mt-1 text-[11px] text-neutral-500">
          Hendelsen som starter denne arbeidsflyten. Hentet fra workflow_dispatch_db_event.
        </p>
      </div>
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
          Kilde-modul
        </label>
        <StandardInput
          value={rule.source_module ?? ''}
          onChange={(e) => onChange({ source_module: e.target.value })}
          placeholder="f.eks. compliance"
          className="mt-1"
        />
      </div>
    </div>
  )
}

function JsonEditor({
  label,
  value,
  onChange,
}: {
  label: string
  value: Record<string, unknown> | null
  onChange: (next: Record<string, unknown>) => void
}) {
  const [text, setText] = useState(JSON.stringify(value ?? {}, null, 2))
  const [parseError, setParseError] = useState<string | null>(null)
  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
        {label}
      </label>
      <StandardTextarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          try {
            const parsed = JSON.parse(e.target.value)
            onChange(parsed)
            setParseError(null)
          } catch (err) {
            setParseError(err instanceof Error ? err.message : String(err))
          }
        }}
        className="h-[280px] w-full font-mono text-xs"
        spellCheck={false}
      />
      {parseError ? (
        <p className="text-xs text-red-700">JSON-feil: {parseError}</p>
      ) : (
        <p className="text-[11px] text-neutral-500">
          Endringer lagres automatisk når JSON er gyldig. Klikk Lagre øverst for å skrive til server.
        </p>
      )}
    </div>
  )
}

function RuleProperties({ rule, onChange }: { rule: WorkflowRule; onChange: (patch: Partial<WorkflowRule>) => void }) {
  return (
    <div className="space-y-4 text-xs">
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
          Navn
        </label>
        <StandardInput
          value={rule.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="mt-1 text-xs"
        />
      </div>
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
          Beskrivelse
        </label>
        <StandardTextarea
          value={rule.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value })}
          className="mt-1 min-h-[80px] text-xs"
        />
      </div>
      <div className="flex items-center gap-2 pt-2">
        <StandardInput
          type="checkbox"
          checked={rule.is_active}
          onChange={(e) => onChange({ is_active: e.target.checked })}
          id="is-active"
          className="h-4 w-4"
        />
        <label htmlFor="is-active" className="text-xs text-neutral-700">
          Aktiv
        </label>
      </div>
    </div>
  )
}
