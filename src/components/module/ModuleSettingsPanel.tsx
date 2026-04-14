/**
 * ModuleSettingsPanel
 *
 * Right-side drawer for configuring a module template.
 * Shows four tabs: Generelt, Typer, Arbeidsflyt, Tilgang.
 * All changes are local until saved. Designed to be reused
 * for any module (Inspeksjoner, SJA, Vernerunder, etc.)
 */

import { useState, type ReactNode } from 'react'
import { X, Plus, Trash2, AlertCircle, CheckCircle2, Mail, ListTodo } from 'lucide-react'
import type {
  CaseType,
  ModuleTemplate,
  StatusColor,
  StatusDef,
  WorkflowRule,
} from '../../types/moduleTemplate'

/* ── Constants ────────────────────────────────────────────────────────────── */

const FOREST = '#1a3d32'
void FOREST // used via STATUS_COLOR_OPTIONS reference
const INPUT = 'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-[#1a3d32]/25'
const BTN_PRIMARY = 'flex items-center gap-1.5 rounded-lg bg-[#1a3d32] px-3 py-2 text-xs font-semibold text-white hover:bg-[#14302a] transition-colors'
const BTN_GHOST = 'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 transition-colors'
const BTN_DANGER = 'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors'

const STATUS_COLOR_OPTIONS: { value: StatusColor; label: string; cls: string }[] = [
  { value: 'neutral', label: 'Nøytral',   cls: 'bg-neutral-100 text-neutral-700' },
  { value: 'green',   label: 'Grønn',     cls: 'bg-emerald-100 text-emerald-800' },
  { value: 'amber',   label: 'Gul/Amber', cls: 'bg-amber-100 text-amber-800' },
  { value: 'red',     label: 'Rød',       cls: 'bg-red-100 text-red-800' },
  { value: 'blue',    label: 'Blå',       cls: 'bg-sky-100 text-sky-800' },
  { value: 'purple',  label: 'Lilla',     cls: 'bg-violet-100 text-violet-800' },
  { value: 'teal',    label: 'Teal',      cls: 'bg-teal-100 text-teal-800' },
]

type Tab = 'general' | 'types' | 'workflow' | 'access'

/* ── Small helpers ────────────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400">{children}</p>
}

function Divider() {
  return <hr className="border-neutral-200" />
}

/* ── Workflow action icon ─────────────────────────────────────────────────── */

function WorkflowActionIcon({ type }: { type: string }) {
  if (type === 'create_task') return <ListTodo className="size-4 text-[#1a3d32]" />
  if (type === 'send_email')  return <Mail className="size-4 text-blue-600" />
  return <AlertCircle className="size-4 text-amber-500" />
}

/* ── Main component ───────────────────────────────────────────────────────── */

export type ModuleSettingsPanelProps = {
  template: ModuleTemplate
  saving: boolean
  hasDb: boolean
  onSave: (partial: Partial<ModuleTemplate>) => Promise<void>
  onPublish: () => Promise<void>
  onUnpublish: () => Promise<void>
  onClose: () => void
}

export function ModuleSettingsPanel({
  template,
  saving,
  hasDb,
  onSave,
  onPublish,
  onUnpublish,
  onClose,
}: ModuleSettingsPanelProps) {
  const [tab, setTab] = useState<Tab>('general')
  const [dirty, setDirty] = useState(false)

  // Local editable copies
  const [title, setTitle] = useState(template.heading.title)
  const [description, setDescription] = useState(template.heading.description)
  const [caseTypes, setCaseTypes] = useState<CaseType[]>(template.caseTypes)
  const [statuses, _setStatuses] = useState<StatusDef[]>(template.statuses)
  const [workflowRules, setWorkflowRules] = useState<WorkflowRule[]>(template.workflowRules)

  function markDirty() { setDirty(true) }

  async function handleSave() {
    await onSave({
      heading: { ...template.heading, title, description },
      caseTypes,
      statuses,
      workflowRules,
    })
    setDirty(false)
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'general',  label: 'Generelt' },
    { id: 'types',    label: 'Typer' },
    { id: 'workflow', label: 'Arbeidsflyt' },
    { id: 'access',   label: 'Tilgang' },
  ]

  return (
    <div className="flex h-full flex-col" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900">Innstillinger</p>
          <p className="truncate text-xs text-neutral-400">{template.name}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasDb && (
            template.published
              ? <button type="button" className={BTN_GHOST} onClick={onUnpublish}>Avpubliser</button>
              : <button type="button" className={BTN_GHOST} onClick={onPublish} disabled={dirty}>
                  {dirty ? 'Lagre først' : 'Publiser'}
                </button>
          )}
          <button
            type="button"
            disabled={!dirty || saving}
            className={`${BTN_PRIMARY} disabled:opacity-50`}
            onClick={handleSave}
          >
            {saving ? 'Lagrer…' : 'Lagre'}
          </button>
          <button type="button" className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100" onClick={onClose} aria-label="Lukk">
            <X className="size-4" />
          </button>
        </div>
      </header>

      {/* Status bar */}
      {template.published ? (
        <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
          <CheckCircle2 className="size-3.5" />
          Publisert — endringer er synlige for alle brukere etter lagring + publisering.
        </div>
      ) : (
        <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 text-xs text-amber-700">
          <AlertCircle className="size-3.5" />
          Utkast — ikke publisert. Bare administratorer ser denne konfigurasjonen.
        </div>
      )}

      {/* Tabs */}
      <div className="flex shrink-0 gap-1 border-b border-neutral-200 px-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors ${
              tab === t.id
                ? 'border-[#1a3d32] text-[#1a3d32]'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-0 flex-1 overflow-y-auto">

        {/* ── General ───────────────────────────────────────────────────── */}
        {tab === 'general' && (
          <div className="space-y-5 p-4">
            <div className="space-y-1">
              <SectionLabel>Modulnavn og beskrivelse</SectionLabel>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700">Tittel (H1)</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); markDirty() }}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700">Beskrivelse</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); markDirty() }}
                    className={`${INPUT} resize-y`}
                  />
                </div>
              </div>
            </div>

            <Divider />

            <div className="space-y-1">
              <SectionLabel>KPI-bokser</SectionLabel>
              <div className="space-y-2">
                {template.kpis.sort((a, b) => a.sortOrder - b.sortOrder).map((k) => (
                  <div key={k.id} className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-900">{k.label}</p>
                      <p className="text-xs text-neutral-400">{k.sub}</p>
                    </div>
                    <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-mono text-neutral-600">{k.aggregation}</span>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-neutral-400">KPI-bokser konfigureres fra platform-admin (full redigering).</p>
            </div>

            <Divider />

            <div className="space-y-1">
              <SectionLabel>Modul-ID</SectionLabel>
              <code className="block rounded-lg bg-neutral-100 px-3 py-2 text-xs font-mono text-neutral-700">
                {template.moduleKey}
              </code>
              <p className="text-[11px] text-neutral-400">Brukes for å koble modulen til riktig datakilde.</p>
            </div>
          </div>
        )}

        {/* ── Types ─────────────────────────────────────────────────────── */}
        {tab === 'types' && (
          <div className="space-y-5 p-4">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <SectionLabel>Inspeksjonstyper</SectionLabel>
                <button
                  type="button"
                  className={BTN_GHOST}
                  onClick={() => {
                    const newType: CaseType = {
                      id: `type-${Date.now()}`,
                      label: 'Ny type',
                      color: 'neutral',
                      active: true,
                    }
                    setCaseTypes((prev) => [...prev, newType])
                    markDirty()
                  }}
                >
                  <Plus className="size-3.5" />
                  Legg til
                </button>
              </div>
              <div className="space-y-2">
                {caseTypes.map((ct, i) => (
                  <div key={ct.id} className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2.5">
                    <div className="min-w-0 flex-1 space-y-1">
                      <input
                        type="text"
                        value={ct.label}
                        onChange={(e) => {
                          const next = caseTypes.map((c, j) => j === i ? { ...c, label: e.target.value } : c)
                          setCaseTypes(next); markDirty()
                        }}
                        className="w-full rounded border border-neutral-200 px-2 py-1 text-sm text-neutral-900 focus:outline-none focus:ring-1 focus:ring-[#1a3d32]/25"
                      />
                      <div className="flex items-center gap-2">
                        <select
                          value={ct.color ?? 'neutral'}
                          onChange={(e) => {
                            const next = caseTypes.map((c, j) => j === i ? { ...c, color: e.target.value as StatusColor } : c)
                            setCaseTypes(next); markDirty()
                          }}
                          className="rounded border border-neutral-200 px-1.5 py-0.5 text-xs"
                        >
                          {STATUS_COLOR_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1 text-xs text-neutral-500">
                          <input
                            type="checkbox"
                            checked={ct.active}
                            onChange={(e) => {
                              const next = caseTypes.map((c, j) => j === i ? { ...c, active: e.target.checked } : c)
                              setCaseTypes(next); markDirty()
                            }}
                            className="rounded"
                          />
                          Aktiv
                        </label>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={BTN_DANGER}
                      onClick={() => { setCaseTypes((prev) => prev.filter((_, j) => j !== i)); markDirty() }}
                      title="Slett"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <Divider />

            <div>
              <div className="mb-3 flex items-center justify-between">
                <SectionLabel>Statusarbeidsflyt</SectionLabel>
              </div>
              <div className="space-y-2">
                {statuses.sort((a, b) => a.sortOrder - b.sortOrder).map((s) => (
                  <div key={s.key} className="rounded-lg border border-neutral-200 bg-white p-3">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_COLOR_OPTIONS.find(o => o.value === s.color)?.cls ?? ''}`}>
                        {s.label}
                      </span>
                      <span className="ml-auto text-[10px] font-mono text-neutral-400">{s.key}</span>
                    </div>
                    {s.transitions && s.transitions.length > 0 && (
                      <p className="mt-1.5 text-[11px] text-neutral-400">
                        → {s.transitions.map(k => statuses.find(x => x.key === k)?.label ?? k).join(', ')}
                      </p>
                    )}
                    {s.isTerminal && (
                      <p className="mt-1 text-[11px] text-teal-600">Terminal (lukker saken)</p>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-neutral-400">Full redigering av statusflyt er tilgjengelig i platform-admin.</p>
            </div>
          </div>
        )}

        {/* ── Workflow ───────────────────────────────────────────────────── */}
        {tab === 'workflow' && (
          <div className="space-y-5 p-4">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <SectionLabel>Automatiseringsregler</SectionLabel>
              </div>
              <div className="space-y-3">
                {workflowRules.sort((a, b) => a.priority - b.priority).map((rule) => (
                  <div key={rule.id} className="rounded-xl border border-neutral-200 bg-white p-3.5">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100">
                        {rule.actions[0] ? <WorkflowActionIcon type={rule.actions[0].type} /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-neutral-900">{rule.name}</p>
                          <label className="flex items-center gap-1 text-xs text-neutral-500">
                            <input
                              type="checkbox"
                              checked={rule.active}
                              onChange={(e) => {
                                setWorkflowRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: e.target.checked } : r))
                                markDirty()
                              }}
                              className="rounded"
                            />
                            Aktiv
                          </label>
                        </div>
                        {rule.description && (
                          <p className="mt-0.5 text-xs text-neutral-500">{rule.description}</p>
                        )}
                        <div className="mt-2 space-y-1">
                          <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">Utløser</p>
                          <p className="rounded-md bg-neutral-50 px-2 py-1 text-xs font-mono text-neutral-600">
                            {rule.trigger.type}
                            {'toStatus' in rule.trigger ? ` → ${rule.trigger.toStatus}` : ''}
                            {'severity' in rule.trigger && rule.trigger.severity ? ` (${rule.trigger.severity})` : ''}
                            {'daysOverdue' in rule.trigger ? ` (+${rule.trigger.daysOverdue}d)` : ''}
                          </p>
                          <p className="mt-1.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">Handlinger</p>
                          {rule.actions.map((a, ai) => (
                            <p key={ai} className="rounded-md bg-neutral-50 px-2 py-1 text-xs font-mono text-neutral-600">
                              {a.type}
                              {'assigneeRole' in a ? ` → ${a.assigneeRole}` : ''}
                              {'toRole' in a ? ` → ${a.toRole}` : ''}
                              {'dueDays' in a ? ` (frist: ${a.dueDays}d)` : ''}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-neutral-400">
                For å legge til nye regler, gå til platform-admin → Moduler.
              </p>
            </div>
          </div>
        )}

        {/* ── Access ────────────────────────────────────────────────────── */}
        {tab === 'access' && (
          <div className="space-y-5 p-4">
            <div>
              <SectionLabel>Rolletilgang</SectionLabel>
              <div className="overflow-x-auto rounded-xl border border-neutral-200">
                <table className="w-full min-w-[380px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50">
                      <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-500">Rolle</th>
                      {(['Oppr.', 'Redig.', 'Slett', 'Godkj.', 'Eksport'] as const).map(h => (
                        <th key={h} className="px-2 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-neutral-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {template.rolePermissions.map((rp) => (
                      <tr key={rp.role} className="border-b border-neutral-100 last:border-0">
                        <td className="px-3 py-2.5">
                          <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-mono text-neutral-700">{rp.role}</span>
                        </td>
                        {([rp.canCreate, rp.canEdit, rp.canDelete, rp.canApprove, rp.canExport] as boolean[]).map((v, vi) => (
                          <td key={vi} className="px-2 py-2.5 text-center">
                            {v ? (
                              <CheckCircle2 className="mx-auto size-4 text-emerald-500" />
                            ) : (
                              <span className="text-neutral-300">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-neutral-400">
                Rolletilgang endres i platform-admin → Moduler.
              </p>
            </div>

            <Divider />

            <div>
              <SectionLabel>Tidsplaner</SectionLabel>
              <div className="space-y-2">
                {template.schedules.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-900">{s.label}</p>
                      <p className="text-xs text-neutral-400">{s.frequency}{s.dayOfMonth ? `, dag ${s.dayOfMonth}` : ''}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s.active ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                      {s.active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
