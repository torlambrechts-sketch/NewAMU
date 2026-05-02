import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Loader2,
  Mail,
  Plus,
  Radio,
  Save,
  Trash2,
  Webhook,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { getWorkflowTriggerEventsForModule } from './workflowTriggerRegistry'
import { Button } from '../ui/Button'
import { StandardInput } from '../ui/Input'
import { StandardTextarea } from '../ui/Textarea'
import { SearchableSelect } from '../ui/SearchableSelect'
import { WarningBox } from '../ui/AlertBox'

// ── Types ──────────────────────────────────────────────────────────────────────

type StepType =
  | 'create_task'
  | 'create_deviation'
  | 'send_notification'
  | 'send_email'
  | 'call_webhook'
  | 'call_api'
  | 'send_sms'
  | 'slack_message'
  | 'teams_message'
  | 'update_record'
  | 'run_workflow'
  | 'wait'

interface WorkflowStep {
  id?: string
  step_order: number
  step_type: StepType
  config_json: Record<string, unknown>
  delay_minutes: number
  _local?: boolean
}

interface WorkflowRule {
  id: string
  name: string
  description: string
  trigger_event_name: string | null
  is_active: boolean
  condition_json: Record<string, unknown>
  steps?: WorkflowStep[]
}

export interface WorkflowRulesTabProps {
  supabase: SupabaseClient | null
  /** @deprecated Prefer `module` — same value as `source_module` in workflow_rules */
  triggerModule?: string
  /** Module slug for workflow rules (e.g. `ros`, `inspection`). */
  module?: string
  triggerEvents?: { value: string; label: string }[]
}

// ── Constants ──────────────────────────────────────────────────────────────────

const CARD_SHADOW = { boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } as const

const STEP_TYPE_OPTIONS: { value: StepType; label: string }[] = [
  { value: 'create_task', label: 'Opprett oppgave' },
  { value: 'create_deviation', label: 'Opprett avvik' },
  { value: 'send_notification', label: 'Send varsling (in-app)' },
  { value: 'send_email', label: 'Send e-post' },
  { value: 'call_webhook', label: 'Kall webhook' },
  { value: 'call_api', label: 'Kall API' },
  { value: 'send_sms', label: 'Send SMS' },
  { value: 'slack_message', label: 'Slack-melding' },
  { value: 'teams_message', label: 'Teams-melding' },
  { value: 'update_record', label: 'Oppdater post' },
  { value: 'run_workflow', label: 'Kjør annen regel' },
  { value: 'wait', label: 'Vent (delay)' },
]

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Lav' },
  { value: 'medium', label: 'Middels' },
  { value: 'high', label: 'Høy' },
  { value: 'critical', label: 'Kritisk' },
]

const HTTP_METHOD_OPTIONS = [
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'GET', label: 'GET' },
  { value: 'PATCH', label: 'PATCH' },
]

function stepTypeLabel(t: StepType): string {
  return STEP_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t
}

function defaultConfigForType(t: StepType): Record<string, unknown> {
  switch (t) {
    case 'create_task':
      return { title: 'Oppfølgingsoppgave', description: '', assignee: '', dueInDays: 7, ownerRole: 'HMS' }
    case 'create_deviation':
      return { title: 'Avvik fra arbeidsflyt', description: '', severity: 'medium' }
    case 'send_notification':
      return { title: 'Arbeidsflyt-varsling', body: '' }
    case 'send_email':
      return { to: '', subject: '', body: '', from: 'noreply@bedrift.no' }
    case 'call_webhook':
      return { url: '', method: 'POST', body: '{}', headers: '{}' }
    case 'call_api':
      return { url: '', method: 'POST', body: '{}', headers: '{}' }
    case 'send_sms':
      return { to: '', message: '' }
    case 'slack_message':
      return { channel: '', message: '' }
    case 'teams_message':
      return { webhookUrl: '', message: '' }
    case 'update_record':
      return { table: '', idField: 'id', idValue: '', fields: {} }
    case 'run_workflow':
      return { ruleSlug: '' }
    case 'wait':
      return {}
  }
}

// ── Step config editors ────────────────────────────────────────────────────────

function StepConfigEditor({
  step,
  onChange,
}: {
  step: WorkflowStep
  onChange: (patch: Partial<WorkflowStep>) => void
}) {
  const cfg = step.config_json
  const set = (key: string, val: unknown) =>
    onChange({ config_json: { ...cfg, [key]: val } })

  switch (step.step_type) {
    case 'create_task':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tittel">
            <StandardInput value={String(cfg.title ?? '')} onChange={(e) => set('title', e.target.value)} />
          </Field>
          <Field label="Ansvarlig">
            <StandardInput value={String(cfg.assignee ?? '')} onChange={(e) => set('assignee', e.target.value)} placeholder="HMS" />
          </Field>
          <Field label="Frist (dager)">
            <StandardInput type="number" min={0} value={Number(cfg.dueInDays ?? 7)} onChange={(e) => set('dueInDays', Number(e.target.value))} />
          </Field>
          <Field label="Eierrolle">
            <StandardInput value={String(cfg.ownerRole ?? 'HMS')} onChange={(e) => set('ownerRole', e.target.value)} />
          </Field>
          <Field label="Beskrivelse" className="sm:col-span-2">
            <StandardTextarea rows={2} value={String(cfg.description ?? '')} onChange={(e) => set('description', e.target.value)} />
          </Field>
        </div>
      )

    case 'create_deviation':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tittel">
            <StandardInput value={String(cfg.title ?? '')} onChange={(e) => set('title', e.target.value)} />
          </Field>
          <Field label="Alvorlighetsgrad">
            <SearchableSelect
              value={String(cfg.severity ?? 'medium')}
              options={SEVERITY_OPTIONS}
              onChange={(val) => set('severity', val)}
            />
          </Field>
          <Field label="Beskrivelse" className="sm:col-span-2">
            <StandardTextarea rows={2} value={String(cfg.description ?? '')} onChange={(e) => set('description', e.target.value)} />
          </Field>
        </div>
      )

    case 'send_notification':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tittel">
            <StandardInput value={String(cfg.title ?? '')} onChange={(e) => set('title', e.target.value)} />
          </Field>
          <Field label="Tekst" className="sm:col-span-2">
            <StandardTextarea rows={2} value={String(cfg.body ?? '')} onChange={(e) => set('body', e.target.value)} />
          </Field>
        </div>
      )

    case 'send_email':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fra">
            <StandardInput value={String(cfg.from ?? '')} onChange={(e) => set('from', e.target.value)} placeholder="noreply@bedrift.no" />
          </Field>
          <Field label="Til">
            <StandardInput value={String(cfg.to ?? '')} onChange={(e) => set('to', e.target.value)} placeholder="hms@bedrift.no" />
          </Field>
          <Field label="Emne" className="sm:col-span-2">
            <StandardInput value={String(cfg.subject ?? '')} onChange={(e) => set('subject', e.target.value)} />
          </Field>
          <Field label="Innhold" className="sm:col-span-2">
            <StandardTextarea rows={4} value={String(cfg.body ?? '')} onChange={(e) => set('body', e.target.value)} />
          </Field>
        </div>
      )

    case 'call_webhook':
    case 'call_api':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="URL" className="sm:col-span-2">
            <StandardInput value={String(cfg.url ?? '')} onChange={(e) => set('url', e.target.value)} className="font-mono text-xs" placeholder="https://…" />
          </Field>
          <Field label="Metode">
            <SearchableSelect
              value={String(cfg.method ?? 'POST')}
              options={HTTP_METHOD_OPTIONS}
              onChange={(val) => set('method', val)}
            />
          </Field>
          <Field label="Headers (JSON)">
            <StandardTextarea rows={2} value={String(cfg.headers ?? '{}')} onChange={(e) => set('headers', e.target.value)} className="font-mono text-xs" />
          </Field>
          <Field label="Body" className="sm:col-span-2">
            <StandardTextarea rows={3} value={String(cfg.body ?? '{}')} onChange={(e) => set('body', e.target.value)} className="font-mono text-xs" />
          </Field>
        </div>
      )

    case 'send_sms':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Til (telefonnummer)">
            <StandardInput value={String(cfg.to ?? '')} onChange={(e) => set('to', e.target.value)} placeholder="+47 …" />
          </Field>
          <Field label="Melding" className="sm:col-span-2">
            <StandardTextarea rows={2} value={String(cfg.message ?? '')} onChange={(e) => set('message', e.target.value)} />
          </Field>
        </div>
      )

    case 'slack_message':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kanal">
            <StandardInput value={String(cfg.channel ?? '')} onChange={(e) => set('channel', e.target.value)} placeholder="#hms-varslinger" />
          </Field>
          <Field label="Melding" className="sm:col-span-2">
            <StandardTextarea rows={2} value={String(cfg.message ?? '')} onChange={(e) => set('message', e.target.value)} />
          </Field>
        </div>
      )

    case 'teams_message':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Webhook URL">
            <StandardInput value={String(cfg.webhookUrl ?? '')} onChange={(e) => set('webhookUrl', e.target.value)} className="font-mono text-xs" />
          </Field>
          <Field label="Melding" className="sm:col-span-2">
            <StandardTextarea rows={2} value={String(cfg.message ?? '')} onChange={(e) => set('message', e.target.value)} />
          </Field>
        </div>
      )

    case 'wait':
      return (
        <p className="text-xs text-neutral-500">
          Forsinkelse konfigureres via «Forsinkelse (min)» nedenfor.
        </p>
      )

    default:
      return null
  }
}

function Field({
  label, children, className = '',
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</p>
      {children}
    </div>
  )
}

// ── Step row ───────────────────────────────────────────────────────────────────

function StepRow({
  step,
  index,
  onChange,
  onDelete,
}: {
  step: WorkflowStep
  index: number
  onChange: (patch: Partial<WorkflowStep>) => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(true)
  const Chevron = open ? ChevronDown : ChevronRight

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-neutral-300" />
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-bold text-neutral-600">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <SearchableSelect
            value={step.step_type}
            options={STEP_TYPE_OPTIONS}
            onChange={(val) => {
              const t = val as StepType
              onChange({ step_type: t, config_json: defaultConfigForType(t) })
            }}
            triggerClassName="py-1 text-xs"
          />
        </div>
        <div className="flex items-center gap-1 text-xs text-neutral-500">
          <span>+</span>
          <StandardInput
            type="number"
            min={0}
            value={step.delay_minutes}
            onChange={(e) => onChange({ delay_minutes: Number(e.target.value) })}
            className="w-14 px-1.5 py-1 text-center text-xs"
          />
          <span>min</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOpen((p) => !p)}>
          <Chevron className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete} className="text-neutral-300 hover:text-red-500">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {open && (
        <div className="border-t border-neutral-200 bg-white px-4 py-3">
          <StepConfigEditor step={step} onChange={onChange} />
        </div>
      )}
    </div>
  )
}

// ── Rule editor panel ──────────────────────────────────────────────────────────

function RuleEditor({
  rule,
  triggerEvents,
  onSave,
  onDelete,
  saving,
}: {
  rule: WorkflowRule
  triggerEvents: { value: string; label: string }[]
  onSave: (r: WorkflowRule) => void
  onDelete: (id: string) => void
  saving: boolean
}) {
  const [draft, setDraft] = useState<WorkflowRule>({ ...rule, steps: rule.steps ? [...rule.steps] : [] })

  const patch = (p: Partial<WorkflowRule>) => setDraft((d) => ({ ...d, ...p }))

  const addStep = () => {
    const steps = draft.steps ?? []
    setDraft((d) => ({
      ...d,
      steps: [
        ...(d.steps ?? []),
        {
          step_order: steps.length,
          step_type: 'create_task' as StepType,
          config_json: defaultConfigForType('create_task'),
          delay_minutes: 0,
          _local: true,
        },
      ],
    }))
  }

  const patchStep = (index: number, p: Partial<WorkflowStep>) => {
    setDraft((d) => {
      const steps = [...(d.steps ?? [])]
      steps[index] = { ...steps[index], ...p }
      return { ...d, steps }
    })
  }

  const removeStep = (index: number) => {
    setDraft((d) => ({ ...d, steps: (d.steps ?? []).filter((_, i) => i !== index) }))
  }

  const triggerEventOptions = [
    { value: '', label: '— Velg hendelse —' },
    ...triggerEvents,
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm" style={CARD_SHADOW}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Regelnavn">
            <StandardInput
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              className="mt-1"
            />
          </Field>
          <Field label="Utløsende hendelse">
            <div className="mt-1">
              <SearchableSelect
                value={draft.trigger_event_name ?? ''}
                options={triggerEventOptions}
                onChange={(val) => patch({ trigger_event_name: val || null })}
              />
            </div>
          </Field>
          <Field label="Beskrivelse" className="sm:col-span-2">
            <StandardTextarea
              rows={2}
              value={draft.description}
              onChange={(e) => patch({ description: e.target.value })}
              className="mt-1"
            />
          </Field>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.is_active}
            onChange={(e) => patch({ is_active: e.target.checked })}
            className="h-4 w-4 accent-[#1a3d32]"
          />
          <span className="font-medium text-neutral-700">Aktiv</span>
        </label>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm" style={CARD_SHADOW}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Steg ({draft.steps?.length ?? 0})
          </p>
          <Button variant="secondary" size="sm" onClick={addStep}>
            <Plus className="h-3.5 w-3.5" /> Legg til steg
          </Button>
        </div>

        <div className="space-y-2">
          {(draft.steps ?? []).map((step, i) => (
            <StepRow
              key={step.id ?? `local-${i}`}
              step={step}
              index={i}
              onChange={(p) => patchStep(i, p)}
              onDelete={() => removeStep(i)}
            />
          ))}
          {(draft.steps ?? []).length === 0 && (
            <p className="py-6 text-center text-xs text-neutral-400">
              Ingen steg ennå — klikk «Legg til steg»
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-between">
        <Button
          variant="danger"
          size="sm"
          onClick={() => onDelete(draft.id)}
        >
          <Trash2 className="h-3.5 w-3.5" /> Slett regel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onSave(draft)}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Lagre regel
        </Button>
      </div>
    </div>
  )
}

// ── Step type icon helper ──────────────────────────────────────────────────────

function StepIcon({ type }: { type: StepType }) {
  if (type === 'send_email') return <Mail className="h-3 w-3" />
  if (type === 'send_notification') return <Radio className="h-3 w-3" />
  if (type === 'call_webhook' || type === 'call_api') return <Webhook className="h-3 w-3" />
  if (type === 'create_deviation') return <AlertTriangle className="h-3 w-3" />
  return <Zap className="h-3 w-3" />
}

// ── Main tab component ─────────────────────────────────────────────────────────

export function WorkflowRulesTab({ supabase, triggerModule, module, triggerEvents }: WorkflowRulesTabProps) {
  const moduleSlug = module ?? triggerModule ?? 'inspection'
  const resolvedTriggerEvents = useMemo(
    () => triggerEvents ?? getWorkflowTriggerEventsForModule(moduleSlug),
    [triggerEvents, moduleSlug],
  )

  const [rules, setRules] = useState<WorkflowRule[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setError(null)
    try {
      const { data: ruleRows, error: rErr } = await supabase
        .from('workflow_rules')
        .select('id, name, description, trigger_event_name, is_active, condition_json')
        .eq('source_module', moduleSlug)
        .eq('trigger_type', 'db_event')
        .order('created_at', { ascending: true })

      if (rErr) throw rErr

      const ruleIds = (ruleRows ?? []).map((r) => r.id as string)
      const stepsByRule: Record<string, WorkflowStep[]> = {}

      if (ruleIds.length > 0) {
        const { data: stepRows, error: sErr } = await supabase
          .from('workflow_steps')
          .select('id, rule_id, step_order, step_type, config_json, delay_minutes')
          .in('rule_id', ruleIds)
          .order('step_order', { ascending: true })

        if (sErr) throw sErr

        for (const s of stepRows ?? []) {
          const rid = s.rule_id as string
          if (!stepsByRule[rid]) stepsByRule[rid] = []
          stepsByRule[rid].push({
            id: s.id as string,
            step_order: s.step_order as number,
            step_type: s.step_type as StepType,
            config_json: (s.config_json as Record<string, unknown>) ?? {},
            delay_minutes: (s.delay_minutes as number) ?? 0,
          })
        }
      }

      const loaded: WorkflowRule[] = (ruleRows ?? []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        description: (r.description as string) ?? '',
        trigger_event_name: r.trigger_event_name as string | null,
        is_active: r.is_active as boolean,
        condition_json: (r.condition_json as Record<string, unknown>) ?? {},
        steps: stepsByRule[r.id as string] ?? [],
      }))

      setRules(loaded)
      if (loaded.length > 0 && !selectedId) setSelectedId(loaded[0].id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke laste arbeidsflytregler')
    } finally {
      setLoading(false)
    }
  }, [supabase, moduleSlug, selectedId])

  useEffect(() => { void load() }, [load])

  const createRule = async () => {
    if (!supabase) return
    const { data, error: insErr } = await supabase
      .from('workflow_rules')
      .insert({
        name: 'Ny regel',
        description: '',
        source_module: moduleSlug,
        trigger_type: 'db_event',
        trigger_event_name: resolvedTriggerEvents[0]?.value ?? null,
        is_active: false,
        condition_json: { match: 'always' },
        actions_json: [],
        slug: `db_event_${moduleSlug}_${Date.now()}`,
        trigger_on: 'insert',
      })
      .select('id')
      .single()

    if (insErr) { setError(insErr.message); return }
    setSelectedId(data.id as string)
    await load()
  }

  const saveRule = async (rule: WorkflowRule) => {
    if (!supabase) return
    setSaving(true)
    setError(null)
    try {
      const { error: updErr } = await supabase
        .from('workflow_rules')
        .update({
          name: rule.name,
          description: rule.description,
          trigger_event_name: rule.trigger_event_name,
          is_active: rule.is_active,
          condition_json: rule.condition_json,
        })
        .eq('id', rule.id)

      if (updErr) throw updErr

      // Replace all steps: delete existing, insert new
      await supabase.from('workflow_steps').delete().eq('rule_id', rule.id)

      const steps = rule.steps ?? []
      if (steps.length > 0) {
        const { error: stepsErr } = await supabase.from('workflow_steps').insert(
          steps.map((s, i) => ({
            rule_id: rule.id,
            step_order: i,
            step_type: s.step_type,
            config_json: s.config_json,
            delay_minutes: s.delay_minutes,
          })),
        )
        if (stepsErr) throw stepsErr
      }

      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke lagre')
    } finally {
      setSaving(false)
    }
  }

  const deleteRule = async (id: string) => {
    if (!supabase) return
    if (!confirm('Slett denne regelen?')) return
    const { error: delErr } = await supabase.from('workflow_rules').delete().eq('id', id)
    if (delErr) { setError(delErr.message); return }
    setSelectedId(null)
    await load()
  }

  const toggleActive = async (rule: WorkflowRule) => {
    if (!supabase) return
    await supabase.from('workflow_rules').update({ is_active: !rule.is_active }).eq('id', rule.id)
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, is_active: !r.is_active } : r)))
  }

  const selectedRule = rules.find((r) => r.id === selectedId) ?? null

  return (
    <div className="grid gap-5 lg:grid-cols-[15rem_1fr]">
      {/* Rule list */}
      <aside className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Regler</p>
          <Button variant="secondary" size="sm" onClick={() => void createRule()}>
            <Plus className="h-3.5 w-3.5" /> Ny
          </Button>
        </div>
        <Link
          to="/workflow"
          className="flex items-center gap-1 text-[10px] font-medium text-[#1a3d32] hover:underline"
        >
          <ArrowRight className="h-3 w-3" />
          Se alle regler i Arbeidsflyt
        </Link>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
          </div>
        )}

        <ul className="space-y-1">
          {rules.map((rule) => {
            const active = selectedId === rule.id
            const eventLabel =
              resolvedTriggerEvents.find((e) => e.value === rule.trigger_event_name)?.label ??
              rule.trigger_event_name ??
              '—'
            return (
              <li key={rule.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(rule.id)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    active ? 'border-[#1a3d32] bg-[#1a3d32]/5' : 'border-neutral-200 bg-white hover:border-neutral-300'
                  }`}
                  style={active ? undefined : CARD_SHADOW}
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">{rule.name}</p>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void toggleActive(rule) }}
                      className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        rule.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-neutral-100 text-neutral-500'
                      }`}
                    >
                      {rule.is_active ? 'Aktiv' : 'Av'}
                    </button>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-neutral-500">{eventLabel}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(rule.steps ?? []).slice(0, 3).map((s, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-0.5 rounded bg-neutral-100 px-1 py-0.5 text-[10px] text-neutral-600"
                      >
                        <StepIcon type={s.step_type} />
                        {stepTypeLabel(s.step_type).split(' ')[0]}
                      </span>
                    ))}
                    {(rule.steps ?? []).length > 3 && (
                      <span className="rounded bg-neutral-100 px-1 py-0.5 text-[10px] text-neutral-500">
                        +{(rule.steps ?? []).length - 3}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            )
          })}
          {!loading && rules.length === 0 && (
            <li className="rounded-xl border border-dashed border-neutral-300 px-3 py-6 text-center text-xs text-neutral-500">
              Ingen regler ennå
            </li>
          )}
        </ul>
      </aside>

      {/* Rule editor */}
      <div>
        {error && (
          <div className="mb-4">
            <WarningBox>{error}</WarningBox>
          </div>
        )}
        {selectedRule ? (
          <RuleEditor
            key={selectedRule.id}
            rule={selectedRule}
            triggerEvents={resolvedTriggerEvents}
            onSave={(r) => void saveRule(r)}
            onDelete={(id) => void deleteRule(id)}
            saving={saving}
          />
        ) : !loading ? (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-neutral-300 py-20 text-sm text-neutral-400">
            Velg eller opprett en regel
          </div>
        ) : null}
      </div>
    </div>
  )
}
