// Right-rail inspector panel for the Klarert Studio workflow editor.
// Tabs: Egenskaper / Stil / Lovverk / Historikk
// Simple mode locks all tabs except Egenskaper.
// Shows trigger config when trigger block is selected, per-kind forms for steps.

import { useState } from 'react'
import * as LucideIcons from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import type { ComponentType } from 'react'
import type { WorkflowFlowDocument, WorkflowFlowStep } from '../../../lib/workflowFlowTypes'
import { STUDIO_BLOCK_META, actionTypeToKind, type StudioBlockKind } from './studioBlockMeta'
import type { WorkflowRuleStudioRevisionRow } from '../../../types/workflow'

// ─── Local icon helper ─────────────────────────────────────────────────────────

function LucideIcon({ name, className }: { name: string; className?: string }) {
  const icons = LucideIcons as Record<string, ComponentType<LucideProps>>
  const Icon = icons[name]
  if (!Icon) return null
  return <Icon className={className} />
}

// ─── Form primitives ───────────────────────────────────────────────────────────

function FieldRow({ label, hint, required, children }: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-neutral-600">
          {label}{required && <span className="ml-0.5 text-neutral-500">*</span>}
        </span>
        {hint && <span className="text-[10px] text-neutral-400">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function In({
  value, onChange, mono, placeholder, type = 'text',
}: {
  value?: string | null
  onChange: (v: string) => void
  mono?: boolean
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={[
        'w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[12.5px] outline-none transition-colors',
        'focus:border-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]/25',
        mono ? 'font-mono text-[11px]' : '',
      ].join(' ')}
    />
  )
}

function TA({ value, onChange, placeholder, rows = 3 }: {
  value?: string | null
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      rows={rows}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full resize-y rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[12.5px] outline-none transition-colors focus:border-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]/25"
    />
  )
}

function Sel({ value, onChange, options }: {
  value?: string | null
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]/25"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${value ? 'bg-[#1a3d32]' : 'bg-neutral-300'}`}
    >
      <span
        className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
        style={{ transform: value ? 'translateX(18px)' : 'translateX(2px)' }}
      />
    </button>
  )
}

// ─── MODULE_LABELS (subset from list page) ─────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  compliance_checklist: 'Sjekkliste',
  survey:               'Spørreundersøkelse',
  tasks:                'Oppgaver',
  learning:             'Læring',
  documents:            'Dokumenter',
  meetings:             'Møter',
  registers:            'Register',
  ros:                  'Risikovurdering',
  inspection:           'HMS-inspeksjon',
  vernerunder:          'Vernerunde',
  internkontroll:       'Internkontroll',
  action_plan:          'Handlingsplan',
}

// ─── Trigger properties form ───────────────────────────────────────────────────

type TriggerFilter = { field: string; op: string; value: string }

function TriggerPropsForm({ sourceModule, triggerEventName, onChangeModule, onChangeEvent, disabled }: {
  sourceModule: string
  triggerEventName: string | null
  onChangeModule: (v: string) => void
  onChangeEvent: (v: string | null) => void
  disabled?: boolean
}) {
  const [filters, setFilters] = useState<TriggerFilter[]>([
    { field: 'severity', op: 'equals', value: 'kritisk' },
  ])

  const moduleOptions = Object.entries(MODULE_LABELS).map(([v, l]) => ({ value: v, label: l }))

  return (
    <>
      <FieldRow label="Modul">
        <Sel
          value={sourceModule}
          onChange={onChangeModule}
          options={moduleOptions}
        />
      </FieldRow>
      <FieldRow label="Hendelse">
        <In
          value={triggerEventName ?? ''}
          onChange={(v) => onChangeEvent(v || null)}
          placeholder="t.avvik.critical"
          disabled={disabled}
        />
      </FieldRow>
      <FieldRow label="Filtre" hint={`${filters.length} regel${filters.length === 1 ? '' : 'er'}`}>
        <div className="space-y-1.5">
          {filters.map((f, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_1fr_22px] gap-1">
              <In value={f.field} onChange={(v) => {
                const next = filters.slice(); next[i] = { ...f, field: v }; setFilters(next)
              }} />
              <Sel value={f.op} onChange={(v) => {
                const next = filters.slice(); next[i] = { ...f, op: v }; setFilters(next)
              }} options={[
                { value: 'equals', label: '=' },
                { value: 'not_equals', label: '≠' },
                { value: 'in', label: 'i' },
                { value: 'contains', label: 'inneh.' },
              ]} />
              <In value={f.value} onChange={(v) => {
                const next = filters.slice(); next[i] = { ...f, value: v }; setFilters(next)
              }} />
              <button
                type="button"
                onClick={() => setFilters(filters.filter((_, j) => j !== i))}
                className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-red-600"
              >
                <LucideIcon name="X" className="h-3 w-3" />
              </button>
            </div>
          ))}
          {!disabled && (
            <button
              type="button"
              onClick={() => setFilters([...filters, { field: '', op: 'equals', value: '' }])}
              className="text-[11px] font-semibold text-[#1a3d32] hover:underline"
            >
              + Legg til filter
            </button>
          )}
        </div>
      </FieldRow>
    </>
  )
}

// ─── Per-kind action forms ────────────────────────────────────────────────────

function ActionPropsForm({ step, onUpdateStep }: {
  step: WorkflowFlowStep
  onUpdateStep: (s: WorkflowFlowStep) => void
}) {
  if (step.kind === 'condition') {
    const c = step.condition as Record<string, unknown>
    return (
      <>
        <FieldRow label="Betingelse">
          <div className="inline-flex items-center gap-0 rounded-md border border-neutral-200 bg-white p-0.5">
            {['AND', 'OR'].map((op) => (
              <button key={op} type="button"
                onClick={() => onUpdateStep({ ...step, condition: { ...step.condition, logic: op } as typeof step.condition })}
                className={`rounded px-3 py-1 text-[11px] font-semibold ${(c.logic ?? 'AND') === op ? 'bg-[#1a3d32] text-white' : 'text-neutral-600 hover:bg-neutral-50'}`}>
                {op === 'AND' ? 'OG · alle' : 'ELLER · minst én'}
              </button>
            ))}
          </div>
        </FieldRow>
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[11.5px] text-neutral-600">
          Bruk den avanserte betingelseseditoren nedenfor for å konfigurere regler.
        </div>
      </>
    )
  }

  if (step.kind !== 'actions' || !step.actions.length) {
    return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[11.5px] text-neutral-600">
        Ingen handling konfigurert. Legg til en handling via paletten.
      </div>
    )
  }

  const a = step.actions[0] as Record<string, unknown>
  const kind = actionTypeToKind((a.type as string) ?? '')

  const patchAction = (patch: Record<string, unknown>) => {
    const newActions = step.actions.slice()
    newActions[0] = { ...newActions[0], ...patch } as typeof newActions[0]
    onUpdateStep({ ...step, actions: newActions })
  }

  switch (kind) {
    case 'email': return (
      <>
        <FieldRow label="Til" required>
          <In value={a.toAddress as string} onChange={(v) => patchAction({ toAddress: v })} placeholder="navn@firma.no" />
        </FieldRow>
        <FieldRow label="Emne" required>
          <In value={a.subject as string} onChange={(v) => patchAction({ subject: v })} placeholder="Kritisk avvik — {id}" />
        </FieldRow>
        <FieldRow label="Fra">
          <In value={a.fromAddress as string} onChange={(v) => patchAction({ fromAddress: v })} placeholder="noreply@firma.no" />
        </FieldRow>
        <FieldRow label="Innhold">
          <TA value={a.body as string} onChange={(v) => patchAction({ body: v })} placeholder="E-post innhold…" rows={4} />
        </FieldRow>
      </>
    )

    case 'task': return (
      <>
        <FieldRow label="Tittel" required>
          <In value={a.title as string} onChange={(v) => patchAction({ title: v })} placeholder="Følg opp avvik" />
        </FieldRow>
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Frist (dager)">
            <input
              type="number"
              min="0"
              value={(a.dueInDays as number) ?? 7}
              onChange={(e) => patchAction({ dueInDays: parseInt(e.target.value || '7', 10) })}
              className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[12.5px] tabular-nums outline-none focus:border-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]/25"
            />
          </FieldRow>
          <FieldRow label="Tildeles">
            <Sel value={a.assignee as string} onChange={(v) => patchAction({ assignee: v })} options={[
              { value: 'auto', label: 'Automatisk' },
              { value: 'HMS', label: 'HMS-koordinator' },
              { value: 'Leder', label: 'Linjeleder' },
            ]} />
          </FieldRow>
        </div>
      </>
    )

    case 'notif': return (
      <>
        <FieldRow label="Tittel" required>
          <In value={a.title as string} onChange={(v) => patchAction({ title: v })} placeholder="Arbeidsflyt-hendelse" />
        </FieldRow>
        <FieldRow label="Innhold">
          <TA value={a.body as string} onChange={(v) => patchAction({ body: v })} rows={3} />
        </FieldRow>
      </>
    )

    case 'webhook': return (
      <>
        <FieldRow label="URL" required>
          <In value={a.url as string} onChange={(v) => patchAction({ url: v })} placeholder="https://…" mono />
        </FieldRow>
        <FieldRow label="Metode">
          <Sel value={(a.method as string) || 'POST'} onChange={(v) => patchAction({ method: v })} options={[
            { value: 'POST', label: 'POST' },
            { value: 'GET', label: 'GET' },
            { value: 'PUT', label: 'PUT' },
            { value: 'PATCH', label: 'PATCH' },
          ]} />
        </FieldRow>
        <FieldRow label="Body">
          <TA value={a.body as string} onChange={(v) => patchAction({ body: v })} rows={4} />
        </FieldRow>
      </>
    )

    case 'wait': return (
      <>
        <FieldRow label="Forsinkelse">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min="0"
              value={(a as unknown as { delay?: { amount?: number } }).delay?.amount ?? 1}
              onChange={(e) => patchAction({ delay: { ...(a as unknown as { delay: Record<string, unknown> }).delay, amount: parseInt(e.target.value || '1', 10) } })}
              className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[12.5px] tabular-nums outline-none focus:border-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]/25"
            />
            <Sel
              value={(a as unknown as { delay?: { unit?: string } }).delay?.unit ?? 'days'}
              onChange={(v) => patchAction({ delay: { ...(a as unknown as { delay: Record<string, unknown> }).delay, unit: v } })}
              options={[
                { value: 'minutes', label: 'Minutter' },
                { value: 'hours', label: 'Timer' },
                { value: 'days', label: 'Dager' },
                { value: 'weeks', label: 'Uker' },
              ]}
            />
          </div>
        </FieldRow>
      </>
    )

    case 'assign': return (
      <>
        <FieldRow label="Til rolle">
          <Sel value={(a.toRole as string) ?? 'hms_leder'} onChange={(v) => patchAction({ toRole: v })} options={[
            { value: 'hms_leder', label: 'HMS-leder' },
            { value: 'daglig_leder', label: 'Daglig leder' },
            { value: 'verneombud', label: 'Verneombud' },
            { value: 'amu_leder', label: 'AMU-leder' },
          ]} />
        </FieldRow>
        <FieldRow label="Notat">
          <In value={a.note as string} onChange={(v) => patchAction({ note: v })} placeholder="Krever oppmerksomhet…" />
        </FieldRow>
      </>
    )

    case 'approval': return (
      <>
        <FieldRow label="Godkjenner-rolle" required>
          <Sel value={(a.approverRole as string) ?? 'hms_leder'} onChange={(v) => patchAction({ approverRole: v })} options={[
            { value: 'hms_leder', label: 'HMS-leder' },
            { value: 'daglig_leder', label: 'Daglig leder' },
            { value: 'org_admin', label: 'Org-admin' },
          ]} />
        </FieldRow>
        <FieldRow label="Melding">
          <TA value={a.message as string} onChange={(v) => patchAction({ message: v })} rows={2} />
        </FieldRow>
        <FieldRow label="Eskaler etter (timer)">
          <input
            type="number"
            min="0"
            value={(a.escalateAfterHours as number) ?? 24}
            onChange={(e) => patchAction({ escalateAfterHours: parseInt(e.target.value || '24', 10) })}
            className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[12.5px] tabular-nums outline-none focus:border-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]/25"
          />
        </FieldRow>
      </>
    )

    default: return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[11.5px] text-neutral-600">
        Konfigurer denne blokktypen. Se Avansert-modus for full konfigurasjon.
      </div>
    )
  }
}

// ─── Law refs tab ──────────────────────────────────────────────────────────────

const LAW_REF_SUGGESTIONS = [
  { law: 'AML', section: '§ 3-1 (2) e', text: 'Iverksette tiltak ved avvik og lære av hendelser.' },
  { law: 'IK', section: '§ 5 nr. 6', text: 'Risikovurdering — kartlegg og dokumentér.' },
  { law: 'IK', section: '§ 5 nr. 7', text: 'Overvåking og gjennomgang av internkontrollen.' },
  { law: 'ISO', section: '45001 · 10.2', text: 'Hendelse, avvik og korrigerende tiltak.' },
  { law: 'GDPR', section: 'Art. 35', text: 'Personvernkonsekvensvurdering.' },
]

function LovverkTab({ lawRefs, onLawRefs }: {
  lawRefs: string[]
  onLawRefs: (refs: string[]) => void
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-[#c5d3c8] bg-[#e7efe9] px-2.5 py-2 text-[11.5px] text-neutral-700">
        <div className="flex items-start gap-1.5">
          <LucideIcon name="Scale" className="h-3 w-3 mt-0.5 text-[#1a3d32]" />
          <span>Lovverk-tagger vises i kjørehistorikken og revisor-eksporten.</span>
        </div>
      </div>
      <FieldRow label="Knyttede paragrafer">
        <div className="space-y-1">
          {LAW_REF_SUGGESTIONS.map((r, i) => {
            const ref = `${r.law} ${r.section}`
            const on = lawRefs.includes(ref)
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (on) onLawRefs(lawRefs.filter((l) => l !== ref))
                  else onLawRefs([...lawRefs, ref])
                }}
                className={`w-full flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors ${on ? 'border-[#1a3d32] bg-[#e7efe9]' : 'border-neutral-200 bg-white hover:bg-neutral-50'}`}
              >
                <span className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${on ? 'border-[#1a3d32] bg-[#1a3d32] text-white' : 'border-neutral-300'}`}>
                  {on && <LucideIcon name="Check" className="h-2.5 w-2.5" />}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-blue-100 border border-blue-200 px-1 py-0 text-[9.5px] font-bold text-blue-800 uppercase tracking-wider">
                      {r.law}
                    </span>
                    <span className="text-[11.5px] font-semibold text-neutral-900">{r.section}</span>
                  </div>
                  <p className="text-[11px] text-neutral-600 mt-0.5">{r.text}</p>
                </div>
              </button>
            )
          })}
        </div>
      </FieldRow>
    </div>
  )
}

// ─── History tab ───────────────────────────────────────────────────────────────

function HistoryTab({ revisions, revisionsLoading, onFetch }: {
  revisions: WorkflowRuleStudioRevisionRow[]
  revisionsLoading: boolean
  onFetch: () => void
}) {
  const [fetched, setFetched] = useState(false)
  if (!fetched) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <LucideIcon name="History" className="h-8 w-8 text-neutral-300" />
        <p className="text-[12px] text-neutral-500">Last inn versjonshistorikk</p>
        <button
          type="button"
          onClick={() => { setFetched(true); onFetch() }}
          className="rounded-md bg-[#1a3d32] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#14312a]"
        >
          Last inn
        </button>
      </div>
    )
  }
  if (revisionsLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <LucideIcon name="Loader2" className="h-5 w-5 text-neutral-400 animate-spin" />
      </div>
    )
  }
  if (revisions.length === 0) {
    return (
      <p className="py-8 text-center text-[12px] text-neutral-400">
        Ingen versjoner lagret ennå. Lagring skjer automatisk.
      </p>
    )
  }
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-neutral-100">
        {revisions.map((rev, i) => (
          <li key={rev.id} className="py-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-neutral-700">
                v{rev.revision_number}
                {i === 0 && (
                  <span className="ml-2 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Siste
                  </span>
                )}
              </span>
              <time className="shrink-0 text-[11px] text-neutral-400">
                {new Date(rev.created_at).toLocaleString('nb')}
              </time>
            </div>
            <p className="mt-0.5 truncate text-xs text-neutral-500">{rev.name}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Style tab ─────────────────────────────────────────────────────────────────

function StyleTab() {
  return (
    <div className="space-y-3">
      <FieldRow label="Blokk-ikon">
        <div className="grid grid-cols-6 gap-1">
          {['CircleDot', 'Star', 'Flag', 'Bell', 'Zap', 'Hammer'].map((ic) => (
            <button key={ic} type="button" className="rounded-md border border-neutral-200 bg-white p-1.5 hover:border-[#1a3d32] hover:bg-[#e7efe9]">
              <LucideIcon name={ic} className="h-3.5 w-3.5 text-neutral-700 mx-auto" />
            </button>
          ))}
        </div>
      </FieldRow>
      <FieldRow label="Visning i kjørehistorikk">
        <div className="space-y-1">
          {[
            { l: 'Kompakt linje', d: 'Én linje · ikon + tittel' },
            { l: 'Standard', d: 'Tittel + sammendrag + status' },
            { l: 'Detaljert', d: 'Inkluder felt-verdier' },
          ].map((o, i) => (
            <button key={i} className={`w-full flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-left text-[12px] transition-colors ${i === 1 ? 'border-[#1a3d32] bg-[#e7efe9]' : 'border-neutral-200 hover:bg-neutral-50'}`}>
              <span className={`mt-0.5 h-3 w-3 rounded-full border ${i === 1 ? 'border-[#1a3d32] bg-[#1a3d32]' : 'border-neutral-300'}`} />
              <div>
                <p className="font-semibold text-neutral-900">{o.l}</p>
                <p className="text-[11px] text-neutral-500">{o.d}</p>
              </div>
            </button>
          ))}
        </div>
      </FieldRow>
    </div>
  )
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyInspector() {
  return (
    <div className="studio-inspector">
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <div>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50">
            <LucideIcon name="MousePointerClick" className="h-5 w-5 text-neutral-400" />
          </div>
          <p className="mt-3 text-[12.5px] font-semibold text-neutral-700">Ingen blokk valgt</p>
          <p className="mt-1 text-[11.5px] text-neutral-500 max-w-[200px] mx-auto">
            Klikk en blokk i flyten for å åpne egenskaper og lovverk her.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Main inspector ────────────────────────────────────────────────────────────

type InspectorProps = {
  /** -1 = trigger selected, >=0 = linearSteps index, null = none selected */
  selectedIdx: number | null
  flowDoc: WorkflowFlowDocument
  onUpdateStep: (idx: number, step: WorkflowFlowStep) => void
  sourceModule: string
  triggerEventName: string | null
  onChangeModule: (v: string) => void
  onChangeEvent: (v: string | null) => void
  lawRefs: string[]
  onLawRefs: (refs: string[]) => void
  revisions: WorkflowRuleStudioRevisionRow[]
  revisionsLoading: boolean
  onFetchRevisions: () => void
  mode: 'simple' | 'advanced'
  disabled?: boolean
}

export function StudioWorkflowInspector({
  selectedIdx, flowDoc, onUpdateStep,
  sourceModule, triggerEventName, onChangeModule, onChangeEvent,
  lawRefs, onLawRefs,
  revisions, revisionsLoading, onFetchRevisions,
  mode, disabled,
}: InspectorProps) {
  const [activeTab, setActiveTab] = useState<'properties' | 'style' | 'lovverk' | 'history'>('properties')

  if (selectedIdx === null) return <EmptyInspector />

  const isTrigger = selectedIdx === -1
  const step = isTrigger ? null : flowDoc.linearSteps[selectedIdx] ?? null

  const kind: StudioBlockKind = isTrigger
    ? 'trigger'
    : !step
    ? 'task'
    : step.kind === 'condition'
    ? 'condition'
    : actionTypeToKind((step.actions[0] as { type: string } | undefined)?.type ?? 'create_task')

  const meta = STUDIO_BLOCK_META[kind] ?? STUDIO_BLOCK_META.task
  const label = isTrigger
    ? (triggerEventName ?? 'Utløser')
    : (step?.label ?? meta.label)

  const tabs = [
    { id: 'properties' as const, label: 'Egenskaper', icon: 'SlidersHorizontal', locked: false },
    { id: 'style'      as const, label: 'Stil',       icon: 'Palette',            locked: mode === 'simple' },
    { id: 'lovverk'    as const, label: 'Lovverk',    icon: 'Scale',              locked: mode === 'simple' },
    { id: 'history'    as const, label: 'Historikk',  icon: 'History',            locked: mode === 'simple' },
  ]

  const effectiveTab = (mode === 'simple' && activeTab !== 'properties') ? 'properties' : activeTab
  const stepOrder = isTrigger ? 1 : selectedIdx + 2

  return (
    <div className="studio-inspector flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-200/70">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="k-eyebrow">Blokk · steg {stepOrder}</span>
          <span className="text-[10px] font-semibold text-neutral-500 inline-flex items-center gap-1">
            <LucideIcon name="CircleDot" className="h-3 w-3" />
            Aktiv
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
            style={{ background: meta.tint, color: meta.accent, border: `1px solid ${meta.border}` }}
          >
            <LucideIcon name={meta.icon} className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p
              className="truncate text-[13.5px] font-semibold text-neutral-900"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {label || 'Uten tittel'}
            </p>
            <p className="text-[11px] text-neutral-500">{meta.label}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="k-itabs">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => !tb.locked && setActiveTab(tb.id)}
            className={[
              'k-itab',
              effectiveTab === tb.id ? 'is-active' : '',
              tb.locked ? 'is-locked' : '',
            ].filter(Boolean).join(' ')}
            title={tb.locked ? 'Tilgjengelig i Avansert modus' : tb.label}
          >
            <LucideIcon name={tb.icon} className="h-3.5 w-3.5" />
            {tb.label}
            {tb.locked && <LucideIcon name="Lock" className="h-2.5 w-2.5 ml-0.5" />}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Title + summary for step blocks */}
        {!isTrigger && step && (
          <>
            <FieldRow label="Tittel" required>
              <In
                value={step.label}
                onChange={(v) => onUpdateStep(selectedIdx, { ...step, label: v })}
                disabled={disabled}
              />
            </FieldRow>
            <div className="my-3 h-px bg-neutral-100" />
          </>
        )}

        {effectiveTab === 'properties' && (
          <>
            {isTrigger ? (
              <TriggerPropsForm
                sourceModule={sourceModule}
                triggerEventName={triggerEventName}
                onChangeModule={onChangeModule}
                onChangeEvent={onChangeEvent}
                disabled={disabled}
              />
            ) : step ? (
              <ActionPropsForm
                step={step}
                onUpdateStep={(s) => onUpdateStep(selectedIdx, s)}
              />
            ) : null}
          </>
        )}

        {effectiveTab === 'style' && <StyleTab />}

        {effectiveTab === 'lovverk' && (
          <LovverkTab lawRefs={lawRefs} onLawRefs={onLawRefs} />
        )}

        {effectiveTab === 'history' && (
          <HistoryTab
            revisions={revisions}
            revisionsLoading={revisionsLoading}
            onFetch={onFetchRevisions}
          />
        )}

        {/* Simple mode tip */}
        {mode === 'simple' && (
          <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800">
            <div className="flex items-start gap-1.5">
              <LucideIcon name="Eye" className="h-3 w-3 mt-0.5 shrink-0" />
              <span><b>Stil</b>, <b>Lovverk</b> og <b>Historikk</b> er tilgjengelige i Avansert modus.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
