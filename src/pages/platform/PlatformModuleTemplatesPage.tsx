/**
 * PlatformModuleTemplatesPage
 *
 * Platform-admin page for managing module templates.
 * Provides a full CRUD editor for all configurable aspects
 * of a module: heading, table columns, status workflow,
 * case types, workflow rules, schedules, KPIs and access control.
 *
 * Built with the same visual language as the rest of platform-admin
 * (dark chrome, amber accents, cream preview panels).
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle, CheckCircle2, ChevronDown,
  Database, GripVertical, LayoutList,
  ListTodo, Plus, Save, Settings, Trash2, Zap,
} from 'lucide-react'
import { ModuleTemplateWorkflowRulesEditor } from '../../components/workflow/ModuleTemplateWorkflowRulesEditor'
import { createNewWorkflowRule } from '../../components/workflow/workflowRuleFactory'
import { useModuleTemplate } from '../../hooks/useModuleTemplate'
import { defaultInspeksjonsrunderTemplate } from '../../types/moduleTemplate'
import type {
  CaseType,
  KpiDef,
  ModuleTemplate,
  ScheduleFrequency,
  ScheduleRule,
  StatusColor,
  StatusDef,
  TableColumn,
} from '../../types/moduleTemplate'

/* ── Constants ────────────────────────────────────────────────────────────── */

const CREAM = '#F9F7F2'
const BORDER = 'border-white/10'

const INPUT = 'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-[#1a3d32]/25'
const BTN_PRIMARY = 'flex items-center gap-1.5 rounded-lg bg-amber-500/90 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 transition-colors'
const BTN_GHOST = 'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-white/10 transition-colors'
const BTN_DANGER = 'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors'

const STATUS_COLOR_OPTIONS: { value: StatusColor; label: string }[] = [
  { value: 'neutral', label: 'Nøytral' },
  { value: 'green',   label: 'Grønn' },
  { value: 'amber',   label: 'Gul' },
  { value: 'red',     label: 'Rød' },
  { value: 'blue',    label: 'Blå' },
  { value: 'purple',  label: 'Lilla' },
  { value: 'teal',    label: 'Teal' },
]

const SCHEDULE_FREQ_OPTIONS: { value: ScheduleFrequency; label: string }[] = [
  { value: 'daily',       label: 'Daglig' },
  { value: 'weekly',      label: 'Ukentlig' },
  { value: 'biweekly',    label: 'Annenhver uke' },
  { value: 'monthly',     label: 'Månedlig' },
  { value: 'quarterly',   label: 'Kvartalsvis' },
  { value: 'semi-annual', label: 'Halvårlig' },
  { value: 'annual',      label: 'Årlig' },
  { value: 'custom',      label: 'Egendefinert' },
]

function uid() { return Math.random().toString(36).slice(2, 10) }

/* ── Section heading ──────────────────────────────────────────────────────── */

function SectionH({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
      <h3 className="text-sm font-semibold text-white">{children}</h3>
      {action}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-neutral-300 mb-1">{children}</label>
}

/* ── Module picker sidebar ────────────────────────────────────────────────── */

const BUILT_IN_MODULES = [
  { key: 'hse.inspections', label: 'Inspeksjonsrunder' },
  { key: 'hse.sja',         label: 'SJA (Sikker jobb analyse)' },
  { key: 'hse.vernerunder', label: 'Vernerunder' },
  { key: 'hse.incidents',   label: 'Hendelsesrapportering' },
  { key: 'hse.training',    label: 'Opplæring' },
]

/* ── Main page ────────────────────────────────────────────────────────────── */

type EditorTab = 'heading' | 'columns' | 'statuses' | 'types' | 'workflow' | 'schedules' | 'kpis' | 'preview'

export function PlatformModuleTemplatesPage() {
  const [moduleKey, setModuleKey] = useState('hse.inspections')
  const { template, loading, error, save, publish, unpublish } = useModuleTemplate(moduleKey)
  const [activeTab, setActiveTab] = useState<EditorTab>('heading')
  const [saving, setSaving] = useState(false)

  // Local editable state — mirrored from template, patched on each save
  const [draft, setDraft] = useState<ModuleTemplate>(() => defaultInspeksjonsrunderTemplate())
  const [draftLoaded, setDraftLoaded] = useState(false)

  // Sync draft when template loads
  if (!loading && !draftLoaded) {
    setDraft(template)
    setDraftLoaded(true)
  }

  function patch(partial: Partial<ModuleTemplate>) {
    setDraft((prev) => ({ ...prev, ...partial }))
  }

  async function handleSave() {
    setSaving(true)
    await save(draft)
    setSaving(false)
  }

  const EDITOR_TABS: { id: EditorTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'heading',   label: 'Overskrift',     icon: LayoutList },
    { id: 'columns',   label: 'Kolonner',        icon: Database },
    { id: 'statuses',  label: 'Statusflyt',      icon: ChevronDown },
    { id: 'types',     label: 'Typer',           icon: Settings },
    { id: 'workflow',  label: 'Arbeidsflyt',     icon: Zap },
    { id: 'schedules', label: 'Tidsplaner',      icon: ListTodo },
    { id: 'kpis',      label: 'KPI-bokser',      icon: CheckCircle2 },
    { id: 'preview',   label: 'Forhåndsvisning', icon: AlertCircle },
  ]

  return (
    <div className="space-y-6 text-neutral-100">
      {/* Page header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Settings className="size-5 text-amber-400/80" />
            <h1 className="text-2xl font-semibold text-white">Modul-maler</h1>
          </div>
          <p className="max-w-2xl text-sm text-neutral-400">
            Administrer konfigurasjonen for alle compliance-moduler. Endringer publiseres og gjøres tilgjengelig for alle brukere.
            Se{' '}
            <Link to="/platform-admin/layout-templates" className="text-amber-400/90 hover:underline">Layout-maler</Link>{' '}
            for sidestruktur.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {draft.published ? (
            <button type="button" className={BTN_GHOST} onClick={unpublish}>Avpubliser</button>
          ) : (
            <button type="button" className={BTN_GHOST} onClick={publish}>Publiser</button>
          )}
          <button type="button" className={BTN_PRIMARY} onClick={handleSave} disabled={saving}>
            <Save className="size-3.5" />
            {saving ? 'Lagrer…' : 'Lagre'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Left: module picker */}
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Moduler</p>
          {BUILT_IN_MODULES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => { setModuleKey(m.key); setDraftLoaded(false) }}
              className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition ${
                moduleKey === m.key
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                  : `${BORDER} text-neutral-400 hover:bg-white/5 hover:text-neutral-200`
              }`}
            >
              {m.label}
              {moduleKey === m.key && draft.published && (
                <CheckCircle2 className="ml-auto size-3.5 shrink-0 text-emerald-400" />
              )}
            </button>
          ))}
          <div className="pt-2">
            <div className={`rounded-xl border ${BORDER} bg-slate-900/40 p-3 text-xs text-neutral-500`}>
              <p className="font-semibold text-neutral-400">Aktiv modul</p>
              <code className="mt-1 block break-all font-mono text-[11px] text-amber-300/80">{draft.moduleKey}</code>
              <p className="mt-1">v{draft.schemaVersion}</p>
              <p className={`mt-1 font-semibold ${draft.published ? 'text-emerald-400' : 'text-amber-400'}`}>
                {draft.published ? '✓ Publisert' : 'Utkast'}
              </p>
            </div>
          </div>
        </div>

        {/* Right: editor */}
        <div className={`rounded-xl border ${BORDER} bg-slate-900/60`}>
          {/* Editor tabs */}
          <div className="flex flex-wrap gap-1 border-b border-white/10 px-4 pt-3">
            {EDITOR_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-xs font-semibold transition ${
                  activeTab === t.id
                    ? 'border-amber-400/80 text-amber-300'
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <t.icon className="size-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-5">

            {/* ── Heading ──────────────────────────────────────────────── */}
            {activeTab === 'heading' && (
              <div className="space-y-5">
                <SectionH>Sidetittel og beskrivelse</SectionH>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Modulnavn (platform)</FieldLabel>
                    <input type="text" value={draft.name} onChange={(e) => patch({ name: e.target.value })} className={INPUT} />
                  </div>
                  <div>
                    <FieldLabel>H1 — Sidetittel</FieldLabel>
                    <input type="text" value={draft.heading.title} onChange={(e) => patch({ heading: { ...draft.heading, title: e.target.value } })} className={INPUT} />
                  </div>
                </div>
                <div>
                  <FieldLabel>Beskrivelse (ingress)</FieldLabel>
                  <textarea rows={3} value={draft.heading.description} onChange={(e) => patch({ heading: { ...draft.heading, description: e.target.value } })} className={`${INPUT} resize-y`} />
                </div>
                <div>
                  <FieldLabel>Brødsmule (kommaseparert)</FieldLabel>
                  <input
                    type="text"
                    value={(draft.heading.breadcrumb ?? []).join(', ')}
                    onChange={(e) => patch({ heading: { ...draft.heading, breadcrumb: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } })}
                    className={INPUT}
                    placeholder="Workspace, Samsvar, HSE / HMS"
                  />
                </div>
              </div>
            )}

            {/* ── Columns ──────────────────────────────────────────────── */}
            {activeTab === 'columns' && (
              <div className="space-y-4">
                <SectionH action={
                  <button type="button" className={BTN_GHOST} onClick={() => {
                    const newCol: TableColumn = { id: `col-${uid()}`, label: 'Ny kolonne', format: 'text', sortOrder: draft.tableColumns.length } as TableColumn & { sortOrder: number }
                    patch({ tableColumns: [...draft.tableColumns, newCol] })
                  }}>
                    <Plus className="size-3.5" /> Legg til
                  </button>
                }>Tabellkolonner</SectionH>
                <div className="space-y-2">
                  {draft.tableColumns.map((col, i) => (
                    <div key={col.id} className={`flex items-center gap-3 rounded-xl border ${BORDER} bg-slate-800/60 p-3`}>
                      <GripVertical className="size-4 shrink-0 text-neutral-600" />
                      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-3">
                        <div>
                          <p className="mb-0.5 text-[10px] text-neutral-500">Felt-ID</p>
                          <input type="text" value={col.id} onChange={(e) => {
                            const cols = draft.tableColumns.map((c, j) => j === i ? { ...c, id: e.target.value } : c)
                            patch({ tableColumns: cols })
                          }} className="w-full rounded-lg border border-white/10 bg-slate-700 px-2 py-1.5 text-xs text-white font-mono" />
                        </div>
                        <div>
                          <p className="mb-0.5 text-[10px] text-neutral-500">Label</p>
                          <input type="text" value={col.label} onChange={(e) => {
                            const cols = draft.tableColumns.map((c, j) => j === i ? { ...c, label: e.target.value } : c)
                            patch({ tableColumns: cols })
                          }} className="w-full rounded-lg border border-white/10 bg-slate-700 px-2 py-1.5 text-xs text-white" />
                        </div>
                        <div>
                          <p className="mb-0.5 text-[10px] text-neutral-500">Format</p>
                          <select value={col.format} onChange={(e) => {
                            const cols = draft.tableColumns.map((c, j) => j === i ? { ...c, format: e.target.value as TableColumn['format'] } : c)
                            patch({ tableColumns: cols })
                          }} className="w-full rounded-lg border border-white/10 bg-slate-700 px-2 py-1.5 text-xs text-white">
                            {(['text','date','datetime','pill','badge','user','boolean','actions'] as const).map(f => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-neutral-400">
                        <label className="flex items-center gap-1">
                          <input type="checkbox" checked={!!col.sortable} onChange={(e) => {
                            const cols = draft.tableColumns.map((c, j) => j === i ? { ...c, sortable: e.target.checked } : c)
                            patch({ tableColumns: cols })
                          }} />
                          Sort
                        </label>
                        <label className="flex items-center gap-1">
                          <input type="checkbox" checked={!col.hidden} onChange={(e) => {
                            const cols = draft.tableColumns.map((c, j) => j === i ? { ...c, hidden: !e.target.checked } : c)
                            patch({ tableColumns: cols })
                          }} />
                          Vis
                        </label>
                      </div>
                      <button type="button" className={BTN_DANGER} onClick={() => patch({ tableColumns: draft.tableColumns.filter((_, j) => j !== i) })}>
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Statuses ─────────────────────────────────────────────── */}
            {activeTab === 'statuses' && (
              <div className="space-y-4">
                <SectionH action={
                  <button type="button" className={BTN_GHOST} onClick={() => {
                    const newStatus: StatusDef = { key: `status-${uid()}`, label: 'Ny status', color: 'neutral', sortOrder: draft.statuses.length }
                    patch({ statuses: [...draft.statuses, newStatus] })
                  }}>
                    <Plus className="size-3.5" /> Legg til
                  </button>
                }>Statusarbeidsflyt</SectionH>
                <div className="space-y-3">
                  {draft.statuses.sort((a, b) => a.sortOrder - b.sortOrder).map((s, i) => (
                    <div key={s.key} className={`rounded-xl border ${BORDER} bg-slate-800/60 p-3`}>
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div>
                          <p className="mb-0.5 text-[10px] text-neutral-500">Nøkkel</p>
                          <input type="text" value={s.key} onChange={(e) => {
                            const list = draft.statuses.map((x, j) => j === i ? { ...x, key: e.target.value } : x)
                            patch({ statuses: list })
                          }} className="w-full rounded-lg border border-white/10 bg-slate-700 px-2 py-1.5 text-xs text-white font-mono" />
                        </div>
                        <div>
                          <p className="mb-0.5 text-[10px] text-neutral-500">Label</p>
                          <input type="text" value={s.label} onChange={(e) => {
                            const list = draft.statuses.map((x, j) => j === i ? { ...x, label: e.target.value } : x)
                            patch({ statuses: list })
                          }} className="w-full rounded-lg border border-white/10 bg-slate-700 px-2 py-1.5 text-xs text-white" />
                        </div>
                        <div>
                          <p className="mb-0.5 text-[10px] text-neutral-500">Farge</p>
                          <select value={s.color} onChange={(e) => {
                            const list = draft.statuses.map((x, j) => j === i ? { ...x, color: e.target.value as StatusColor } : x)
                            patch({ statuses: list })
                          }} className="w-full rounded-lg border border-white/10 bg-slate-700 px-2 py-1.5 text-xs text-white">
                            {STATUS_COLOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                        <div className="flex items-end gap-2">
                          <label className="flex items-center gap-1 text-xs text-neutral-400">
                            <input type="checkbox" checked={!!s.isTerminal} onChange={(e) => {
                              const list = draft.statuses.map((x, j) => j === i ? { ...x, isTerminal: e.target.checked } : x)
                              patch({ statuses: list })
                            }} />
                            Terminal
                          </label>
                          <button type="button" className={BTN_DANGER} onClick={() => patch({ statuses: draft.statuses.filter((_, j) => j !== i) })}>
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2">
                        <p className="mb-0.5 text-[10px] text-neutral-500">Overganger til (kommaseparert nøkler)</p>
                        <input type="text" value={(s.transitions ?? []).join(', ')} onChange={(e) => {
                          const list = draft.statuses.map((x, j) => j === i ? { ...x, transitions: e.target.value.split(',').map(v => v.trim()).filter(Boolean) } : x)
                          patch({ statuses: list })
                        }} className="w-full rounded-lg border border-white/10 bg-slate-700 px-2 py-1.5 text-xs text-white font-mono" placeholder="planned, in_progress" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Case types ───────────────────────────────────────────── */}
            {activeTab === 'types' && (
              <div className="space-y-4">
                <SectionH action={
                  <button type="button" className={BTN_GHOST} onClick={() => {
                    const newType: CaseType = { id: `type-${uid()}`, label: 'Ny type', color: 'neutral', active: true }
                    patch({ caseTypes: [...draft.caseTypes, newType] })
                  }}>
                    <Plus className="size-3.5" /> Legg til
                  </button>
                }>Inspeksjons-/sakstyper</SectionH>
                <div className="space-y-2">
                  {draft.caseTypes.map((ct, i) => (
                    <div key={ct.id} className={`flex items-center gap-3 rounded-xl border ${BORDER} bg-slate-800/60 px-3 py-2.5`}>
                      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-3">
                        <input type="text" value={ct.label} onChange={(e) => {
                          const list = draft.caseTypes.map((c, j) => j === i ? { ...c, label: e.target.value } : c)
                          patch({ caseTypes: list })
                        }} className="rounded-lg border border-white/10 bg-slate-700 px-2 py-1.5 text-xs text-white" placeholder="Typenavn" />
                        <select value={ct.color ?? 'neutral'} onChange={(e) => {
                          const list = draft.caseTypes.map((c, j) => j === i ? { ...c, color: e.target.value as StatusColor } : c)
                          patch({ caseTypes: list })
                        }} className="rounded-lg border border-white/10 bg-slate-700 px-2 py-1.5 text-xs text-white">
                          {STATUS_COLOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <label className="flex items-center gap-1 text-xs text-neutral-400">
                          <input type="checkbox" checked={ct.active} onChange={(e) => {
                            const list = draft.caseTypes.map((c, j) => j === i ? { ...c, active: e.target.checked } : c)
                            patch({ caseTypes: list })
                          }} />
                          Aktiv
                        </label>
                      </div>
                      <button type="button" className={BTN_DANGER} onClick={() => patch({ caseTypes: draft.caseTypes.filter((_, j) => j !== i) })}>
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Workflow rules ────────────────────────────────────────── */}
            {activeTab === 'workflow' && (
              <div className="space-y-4">
                <SectionH
                  action={
                    <button
                      type="button"
                      className={BTN_GHOST}
                      onClick={() => {
                        patch({
                          workflowRules: [...draft.workflowRules, createNewWorkflowRule(draft.workflowRules.length)],
                        })
                      }}
                    >
                      <Plus className="size-3.5" /> Legg til regel
                    </button>
                  }
                >
                  Automatiseringsregler
                </SectionH>
                <ModuleTemplateWorkflowRulesEditor
                  rules={draft.workflowRules}
                  onChange={(next) => patch({ workflowRules: next })}
                  variant="platformAdmin"
                  hideToolbar
                />
              </div>
            )}

            {/* ── Schedules ─────────────────────────────────────────────── */}
            {activeTab === 'schedules' && (
              <div className="space-y-4">
                <SectionH action={
                  <button type="button" className={BTN_GHOST} onClick={() => {
                    const newSched: ScheduleRule = { id: `sched-${uid()}`, label: 'Ny tidsplan', frequency: 'monthly', active: false }
                    patch({ schedules: [...draft.schedules, newSched] })
                  }}>
                    <Plus className="size-3.5" /> Legg til
                  </button>
                }>Automatiske tidsplaner</SectionH>
                <div className="space-y-3">
                  {draft.schedules.map((s, i) => (
                    <div key={s.id} className={`grid gap-3 rounded-xl border ${BORDER} bg-slate-800/60 p-3 sm:grid-cols-4`}>
                      <div>
                        <p className="mb-0.5 text-[10px] text-neutral-500">Navn</p>
                        <input type="text" value={s.label} onChange={(e) => {
                          const list = draft.schedules.map((x, j) => j === i ? { ...x, label: e.target.value } : x)
                          patch({ schedules: list })
                        }} className="w-full rounded-lg border border-white/10 bg-slate-700 px-2 py-1.5 text-xs text-white" />
                      </div>
                      <div>
                        <p className="mb-0.5 text-[10px] text-neutral-500">Frekvens</p>
                        <select value={s.frequency} onChange={(e) => {
                          const list = draft.schedules.map((x, j) => j === i ? { ...x, frequency: e.target.value as ScheduleFrequency } : x)
                          patch({ schedules: list })
                        }} className="w-full rounded-lg border border-white/10 bg-slate-700 px-2 py-1.5 text-xs text-white">
                          {SCHEDULE_FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <p className="mb-0.5 text-[10px] text-neutral-500">Dag i måneden</p>
                        <input type="number" min={1} max={31} value={s.dayOfMonth ?? ''} onChange={(e) => {
                          const list = draft.schedules.map((x, j) => j === i ? { ...x, dayOfMonth: parseInt(e.target.value) || undefined } : x)
                          patch({ schedules: list })
                        }} className="w-full rounded-lg border border-white/10 bg-slate-700 px-2 py-1.5 text-xs text-white" placeholder="1–31" />
                      </div>
                      <div className="flex items-end gap-2">
                        <label className="flex items-center gap-1 text-xs text-neutral-400">
                          <input type="checkbox" checked={s.active} onChange={(e) => {
                            const list = draft.schedules.map((x, j) => j === i ? { ...x, active: e.target.checked } : x)
                            patch({ schedules: list })
                          }} />
                          Aktiv
                        </label>
                        <button type="button" className={BTN_DANGER} onClick={() => patch({ schedules: draft.schedules.filter((_, j) => j !== i) })}>
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── KPIs ─────────────────────────────────────────────────── */}
            {activeTab === 'kpis' && (
              <div className="space-y-4">
                <SectionH action={
                  <button type="button" className={BTN_GHOST} onClick={() => {
                    const newKpi: KpiDef = { id: `kpi-${uid()}`, label: 'Ny KPI', aggregation: 'count', sub: '', sortOrder: draft.kpis.length }
                    patch({ kpis: [...draft.kpis, newKpi] })
                  }}>
                    <Plus className="size-3.5" /> Legg til
                  </button>
                }>KPI-bokser</SectionH>
                <div className="space-y-3">
                  {draft.kpis.sort((a, b) => a.sortOrder - b.sortOrder).map((k, i) => (
                    <div key={k.id} className={`grid gap-3 rounded-xl border ${BORDER} bg-slate-800/60 p-3 sm:grid-cols-4`}>
                      <input type="text" value={k.label} onChange={(e) => {
                        const list = draft.kpis.map((x, j) => j === i ? { ...x, label: e.target.value } : x)
                        patch({ kpis: list })
                      }} className="rounded-lg border border-white/10 bg-slate-700 px-2 py-1.5 text-xs text-white" placeholder="KPI-navn" />
                      <input type="text" value={k.sub} onChange={(e) => {
                        const list = draft.kpis.map((x, j) => j === i ? { ...x, sub: e.target.value } : x)
                        patch({ kpis: list })
                      }} className="rounded-lg border border-white/10 bg-slate-700 px-2 py-1.5 text-xs text-white" placeholder="Undertekst" />
                      <select value={k.aggregation} onChange={(e) => {
                        const list = draft.kpis.map((x, j) => j === i ? { ...x, aggregation: e.target.value as KpiDef['aggregation'] } : x)
                        patch({ kpis: list })
                      }} className="rounded-lg border border-white/10 bg-slate-700 px-2 py-1.5 text-xs text-white">
                        {(['count','percentage','average'] as const).map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                      <button type="button" className={BTN_DANGER} onClick={() => patch({ kpis: draft.kpis.filter((_, j) => j !== i) })}>
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Preview ───────────────────────────────────────────────── */}
            {activeTab === 'preview' && (
              <div className="space-y-4">
                <SectionH>Forhåndsvisning (konfigurasjonssammendrag)</SectionH>
                <div className="rounded-xl border border-white/10 p-4" style={{ backgroundColor: CREAM, fontFamily: 'Inter, system-ui, sans-serif', color: '#171717' }}>
                  {/* Breadcrumb */}
                  <p className="text-xs text-neutral-400">
                    {(draft.heading.breadcrumb ?? []).join(' › ')}
                  </p>
                  {/* H1 */}
                  <h1 className="mt-1 text-2xl font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                    {draft.heading.title}
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm text-neutral-600">{draft.heading.description}</p>

                  {/* KPI row */}
                  <div className={`mt-4 grid gap-3`} style={{ gridTemplateColumns: `repeat(${draft.kpis.length}, minmax(0,1fr))` }}>
                    {draft.kpis.sort((a, b) => a.sortOrder - b.sortOrder).map((k) => (
                      <div key={k.id} className="rounded-xl px-4 py-3" style={{ backgroundColor: '#f2eee6' }}>
                        <p className="text-2xl font-bold text-neutral-900">0</p>
                        <p className="text-sm font-semibold text-neutral-900">{k.label}</p>
                        <p className="text-xs text-neutral-600">{k.sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Table header */}
                  <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-neutral-200 bg-[#EFE8DC]">
                          {draft.tableColumns.filter(c => !c.hidden).map(col => (
                            <th key={col.id} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-neutral-600">
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={draft.tableColumns.filter(c => !c.hidden).length} className="px-5 py-8 text-center text-sm text-neutral-400">
                            Data vises her fra modulen
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
