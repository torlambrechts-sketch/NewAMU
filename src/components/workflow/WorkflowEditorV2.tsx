/**
 * WorkflowEditorV2 — step-rail editor for workflow rules.
 * Mirrors the e-learning CourseEditor layout:
 *   320 px left rail (ordered step list) | right scrollable step editor pane
 * Four tabs: Steg · Detaljer · Lovverk · Test-kjør
 * Auto-saves with 1200 ms debounce; shows amber pulse "Lagrer…" → green "Lagret X sek siden".
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Bell,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Circle,
  CircleDot,
  Clock,
  Copy,
  FileText,
  FolderOpen,
  FolderPlus,
  GitFork,
  Hourglass,
  Lock,
  Mail,
  MessageSquare,
  MoreVertical,
  PauseCircle,
  PenLine,
  PlayCircle,
  Plug,
  Plus,
  ShieldAlert,
  Smartphone,
  Split,
  Trash2,
  UserCheck,
  Users,
  Workflow,
  X,
  Zap,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ModulePageShell, ModuleSectionCard } from '../module'
import { useWorkflows } from '../../hooks/useWorkflows'
import { getWorkflowTriggerEventsForModule } from './workflowTriggerRegistry'
import { WORKFLOW_SOURCE_MODULES } from '../../types/workflow'
import type { WorkflowRuleRow } from '../../types/workflow'
import { freshId } from '../../lib/dashboards/freshId'

// ─── Step model ───────────────────────────────────────────────────────────────

type StepKind =
  | 'trigger' | 'condition' | 'branch' | 'wait'
  | 'email' | 'teams' | 'sms' | 'notif'
  | 'task' | 'project' | 'assign'
  | 'ros' | 'amu'
  | 'signreq' | 'doc' | 'archive'
  | 'webhook'

type WfFilter = { field: string; op: string; value: string }
type WfClause = { field: string; op: string; value: string }

type StepContent = Record<string, unknown> & {
  kind: StepKind
  filters?: WfFilter[]
  clauses?: WfClause[]
}

type WfStep = {
  id: string
  order: number
  kind: StepKind
  title: string
  summary: string
  enabled: boolean
  content: StepContent
}

// ─── Step metadata ────────────────────────────────────────────────────────────

type StepMeta = {
  label: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  group: string
  accent: string
  tint: string
  border: string
}

const STEP_META: Record<StepKind, StepMeta> = {
  trigger:   { label: 'Utløser',           icon: Zap,          group: 'Start',       accent: '#6d28d9', tint: '#f5f3ff', border: '#ddd6fe' },
  condition: { label: 'Betingelse',        icon: GitFork,      group: 'Logikk',      accent: '#a16207', tint: '#fefce8', border: '#fde68a' },
  branch:    { label: 'Forgren (Hvis/Da)', icon: Split,        group: 'Logikk',      accent: '#a16207', tint: '#fefce8', border: '#fde68a' },
  wait:      { label: 'Vent',              icon: Hourglass,    group: 'Logikk',      accent: '#a16207', tint: '#fefce8', border: '#fde68a' },
  email:     { label: 'Send e-post',       icon: Mail,         group: 'Varsling',    accent: '#1d4ed8', tint: '#eff6ff', border: '#bfdbfe' },
  teams:     { label: 'Teams-melding',     icon: MessageSquare,group: 'Varsling',    accent: '#1d4ed8', tint: '#eff6ff', border: '#bfdbfe' },
  sms:       { label: 'SMS',               icon: Smartphone,   group: 'Varsling',    accent: '#1d4ed8', tint: '#eff6ff', border: '#bfdbfe' },
  notif:     { label: 'Push-varsel',       icon: Bell,         group: 'Varsling',    accent: '#1d4ed8', tint: '#eff6ff', border: '#bfdbfe' },
  task:      { label: 'Opprett oppgave',   icon: CheckSquare,  group: 'Tiltak',      accent: '#166534', tint: '#f0fdf4', border: '#bbf7d0' },
  project:   { label: 'Tiltaksprosjekt',   icon: FolderPlus,   group: 'Tiltak',      accent: '#166534', tint: '#f0fdf4', border: '#bbf7d0' },
  assign:    { label: 'Tildel ansvarlig',  icon: UserCheck,    group: 'Tiltak',      accent: '#166534', tint: '#f0fdf4', border: '#bbf7d0' },
  ros:       { label: 'ROS-utkast',        icon: ShieldAlert,  group: 'HMS',         accent: '#854d0e', tint: '#fefce8', border: '#fde68a' },
  amu:       { label: 'AMU-saksliste',     icon: Users,        group: 'HMS',         accent: '#5b21b6', tint: '#f5f3ff', border: '#ddd6fe' },
  signreq:   { label: 'Be om signatur',    icon: PenLine,      group: 'Dokument',    accent: '#404040', tint: '#fafafa', border: '#e5e5e5' },
  doc:       { label: 'Generer dokument',  icon: FileText,     group: 'Dokument',    accent: '#404040', tint: '#fafafa', border: '#e5e5e5' },
  archive:   { label: 'Arkiver til mappe',icon: FolderOpen,   group: 'Dokument',    accent: '#404040', tint: '#fafafa', border: '#e5e5e5' },
  webhook:   { label: 'Webhook',           icon: Plug,         group: 'Integrasjon', accent: '#525252', tint: '#fafafa', border: '#e5e5e5' },
}

const STEP_KINDS_ORDERED: StepKind[] = [
  'condition', 'branch', 'wait',
  'email', 'teams', 'sms', 'notif',
  'task', 'project', 'assign',
  'ros', 'amu',
  'signreq', 'doc', 'archive',
  'webhook',
]

function defaultContent(kind: StepKind): StepContent {
  const defaults: Record<StepKind, StepContent> = {
    trigger:   { kind: 'trigger',   triggerId: '', filters: [] },
    condition: { kind: 'condition', logic: 'AND', clauses: [] },
    branch:    { kind: 'branch',    rule: '', truePath: [], falsePath: [] },
    wait:      { kind: 'wait',      amount: 1, unit: 'days' },
    email:     { kind: 'email',     to: '', cc: '', subject: '', template: 'standard.eml' },
    teams:     { kind: 'teams',     channel: '', message: '' },
    sms:       { kind: 'sms',       to: '', message: '' },
    notif:     { kind: 'notif',     audience: 'leder', title: '', body: '' },
    task:      { kind: 'task',      title: '', dueDays: 7, assignee: 'auto' },
    project:   { kind: 'project',   template: 'pdca', name: '', owner: 'auto' },
    assign:    { kind: 'assign',    role: 'verneombud', source: 'auto-fra-hendelse' },
    ros:       { kind: 'ros',       template: 'standard 5×5', linkSource: true },
    amu:       { kind: 'amu',       agendaItem: '', priority: 'normal' },
    signreq:   { kind: 'signreq',   document: '', signers: [], deadlineDays: 14 },
    doc:       { kind: 'doc',       template: '', destination: 'arkiv' },
    archive:   { kind: 'archive',   folder: '/avvik/2026' },
    webhook:   { kind: 'webhook',   url: '', method: 'POST', body: '{}' },
  }
  return defaults[kind]
}

function mkStep(kind: StepKind, order: number): WfStep {
  return {
    id: freshId('st'),
    order,
    kind,
    title: '',
    summary: '',
    enabled: true,
    content: defaultContent(kind),
  }
}

function moveInArray<T>(arr: T[], idx: number, dir: -1 | 1): T[] {
  const j = idx + dir
  if (j < 0 || j >= arr.length) return arr
  if (idx === 0 || j === 0) return arr  // trigger locked at 0
  const next = [...arr]
  ;[next[idx], next[j]] = [next[j], next[idx]]
  return next
}

function fmtAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 5) return 'akkurat nå'
  if (s < 60) return `${Math.floor(s)} sek siden`
  if (s < 3600) return `${Math.floor(s / 60)} min siden`
  return `${Math.floor(s / 3600)} t siden`
}

// ─── StepRailMenu ─────────────────────────────────────────────────────────────

function StepRailMenu({
  enabled,
  onDup,
  onDel,
  onToggle,
}: {
  enabled: boolean
  onDup: () => void
  onDel: () => void
  onToggle: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded p-1 text-neutral-400 hover:bg-white hover:text-neutral-700"
        aria-label="Mer"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg">
          <button
            type="button"
            onClick={() => { setOpen(false); onToggle() }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50"
          >
            {enabled ? <PauseCircle className="h-3 w-3" /> : <PlayCircle className="h-3 w-3" />}
            {enabled ? 'Deaktiver steg' : 'Aktiver steg'}
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onDup() }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50"
          >
            <Copy className="h-3 w-3" />Dupliser
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onDel() }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-3 w-3" />Slett
          </button>
        </div>
      )}
    </div>
  )
}

// ─── AddStepMenu ──────────────────────────────────────────────────────────────

function AddStepMenu({ onAdd }: { onAdd: (kind: StepKind) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  const byGroup = useMemo(() => {
    const map: Record<string, StepKind[]> = {}
    for (const k of STEP_KINDS_ORDERED) {
      const g = STEP_META[k].group
      ;(map[g] = map[g] ?? []).push(k)
    }
    return map
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-neutral-300 bg-white px-3 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:border-[#1a3d32] hover:bg-[#e7efe9] hover:text-[#1a3d32]"
      >
        <Plus className="h-4 w-4" />
        Nytt steg
      </button>
      {open && (
        <div className="absolute bottom-full left-0 right-0 z-30 mb-2 max-h-[420px] overflow-y-auto rounded-md border border-neutral-200 bg-white p-2 shadow-lg">
          {Object.entries(byGroup).map(([group, kinds]) => (
            <div key={group} className="mb-2 last:mb-0">
              <p className="px-1.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                {group}
              </p>
              <div className="grid grid-cols-2 gap-1">
                {kinds.map((k) => {
                  const m = STEP_META[k]
                  const Icon = m.icon
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => { setOpen(false); onAdd(k) }}
                      className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-neutral-700 transition-colors hover:bg-[#e7efe9] hover:text-[#1a3d32]"
                    >
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
                        style={{ background: m.tint, color: m.accent, border: `1px solid ${m.border}` }}
                      >
                        <Icon className="h-3 w-3" />
                      </span>
                      <span className="font-medium">{m.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── StepRail ────────────────────────────────────────────────────────────────

function StepRail({
  steps,
  activeId,
  dirtyIds,
  onSelect,
  onMove,
  onDup,
  onDel,
  onAdd,
  onToggle,
}: {
  steps: WfStep[]
  activeId: string | null
  dirtyIds: Set<string>
  onSelect: (id: string) => void
  onMove: (idx: number, dir: -1 | 1) => void
  onDup: (id: string) => void
  onDel: (id: string) => void
  onAdd: (kind: StepKind) => void
  onToggle: (id: string) => void
}) {
  const totalActions = steps.filter(
    (s) => !['trigger', 'condition', 'branch', 'wait'].includes(s.kind),
  ).length

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Steg</p>
          <p className="mt-0.5 text-xs tabular-nums text-neutral-600">
            {steps.length} steg · {totalActions} handling{totalActions === 1 ? '' : 'er'}
          </p>
        </div>
        <button
          type="button"
          className="rounded p-1 text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700"
          title="Vis som diagram"
        >
          <Workflow className="h-3.5 w-3.5" />
        </button>
      </div>

      <ol className="relative flex-1 space-y-1 overflow-y-auto p-2">
        {steps.map((s, i) => {
          const meta = STEP_META[s.kind]
          const Icon = meta.icon
          const active = s.id === activeId
          const dirty = dirtyIds.has(s.id)
          const dimmed = !s.enabled

          return (
            <li key={s.id} className="relative">
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  className="absolute left-[26px] top-[44px] w-px"
                  style={{ height: 'calc(100% - 32px)', background: '#e5e5e5' }}
                />
              )}
              <div
                className={`group relative flex items-center gap-2.5 rounded-md border px-2 py-2 transition-colors ${
                  active
                    ? 'border-[#1a3d32]/40 bg-[#e7efe9]'
                    : 'border-transparent hover:border-neutral-200 hover:bg-neutral-50'
                }`}
                style={dimmed && !active ? { opacity: 0.55 } : undefined}
              >
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <span className="relative z-10 shrink-0">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${
                        active
                          ? 'bg-[#1a3d32] text-white'
                          : 'border border-neutral-300 bg-white text-neutral-600'
                      }`}
                    >
                      {s.order}
                    </span>
                    <span
                      aria-hidden
                      className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white"
                      style={{ background: meta.accent }}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-neutral-900">
                        {s.title || (
                          <span className="italic text-neutral-400">Uten tittel</span>
                        )}
                      </span>
                      {dirty && (
                        <span
                          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#c98a2b]"
                          title="Endret"
                        />
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-neutral-500">
                      <Icon className="h-3 w-3" style={{ color: meta.accent }} />
                      <span>{meta.label}</span>
                      {dimmed && (
                        <>
                          <span className="text-neutral-300">·</span>
                          <span className="italic">deaktivert</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>

                <div className="invisible flex items-center group-hover:visible">
                  {s.kind !== 'trigger' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onMove(i, -1)}
                        disabled={i <= 1}
                        className="rounded p-1 text-neutral-400 hover:bg-white hover:text-neutral-700 disabled:opacity-30"
                        aria-label="Opp"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onMove(i, 1)}
                        disabled={i === steps.length - 1}
                        className="rounded p-1 text-neutral-400 hover:bg-white hover:text-neutral-700 disabled:opacity-30"
                        aria-label="Ned"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <StepRailMenu
                        enabled={s.enabled}
                        onDup={() => onDup(s.id)}
                        onDel={() => onDel(s.id)}
                        onToggle={() => onToggle(s.id)}
                      />
                    </>
                  ) : (
                    <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                      låst
                    </span>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      <div className="border-t border-neutral-100 p-3">
        <AddStepMenu onAdd={onAdd} />
      </div>
    </div>
  )
}

// ─── Per-kind editors ─────────────────────────────────────────────────────────

function FieldLabel({
  children,
  hint,
  required,
}: {
  children: React.ReactNode
  hint?: string
  required?: boolean
}) {
  return (
    <div className="mb-1 flex items-baseline justify-between gap-2">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
        {children}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </label>
      {hint && <span className="text-[10px] text-neutral-400">{hint}</span>}
    </div>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  mono,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  mono?: boolean
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors focus:border-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]/25 ${
        mono ? 'font-mono text-xs' : ''
      }`}
    />
  )
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full resize-y rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors focus:border-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]/25"
    />
  )
}

function TriggerEditor({
  content,
  onChange,
  sourceModule,
}: {
  content: StepContent
  onChange: (c: StepContent) => void
  sourceModule: string
}) {
  const events = getWorkflowTriggerEventsForModule(sourceModule)
  const filters = (content.filters ?? []) as WfFilter[]

  return (
    <div className="space-y-5">
      <div>
        <FieldLabel>Hendelse</FieldLabel>
        <select
          value={(content.triggerId as string) ?? ''}
          onChange={(e) => onChange({ ...content, triggerId: e.target.value })}
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]/25"
        >
          <option value="">Velg hendelse…</option>
          {events.map((ev) => (
            <option key={ev.value} value={ev.value}>{ev.label}</option>
          ))}
        </select>
        {events.length === 0 && (
          <p className="mt-1.5 text-xs text-amber-600">
            Ingen hendelser registrert for denne modulen ennå.
          </p>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <FieldLabel hint="Kjør kun når alle filtre passer">Filtre på utløseren</FieldLabel>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...content,
                filters: [...filters, { field: '', op: 'equals', value: '' }],
              })
            }
            className="text-[11px] font-semibold text-[#1a3d32] hover:underline"
          >
            + Legg til filter
          </button>
        </div>
        <div className="space-y-1.5">
          {filters.map((f, i) => (
            <div key={i} className="grid grid-cols-[1fr_110px_1fr_28px] items-center gap-1.5">
              <input
                value={f.field}
                onChange={(e) => {
                  const next = [...filters]
                  next[i] = { ...f, field: e.target.value }
                  onChange({ ...content, filters: next })
                }}
                placeholder="felt"
                className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#1a3d32]"
              />
              <select
                value={f.op}
                onChange={(e) => {
                  const next = [...filters]
                  next[i] = { ...f, op: e.target.value }
                  onChange({ ...content, filters: next })
                }}
                className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-[#1a3d32]"
              >
                <option value="equals">=</option>
                <option value="not_equals">≠</option>
                <option value="in">i</option>
                <option value="contains">inneholder</option>
                <option value="gt">&gt;</option>
                <option value="lt">&lt;</option>
              </select>
              <input
                value={f.value}
                onChange={(e) => {
                  const next = [...filters]
                  next[i] = { ...f, value: e.target.value }
                  onChange({ ...content, filters: next })
                }}
                placeholder="verdi"
                className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#1a3d32]"
              />
              <button
                type="button"
                onClick={() =>
                  onChange({ ...content, filters: filters.filter((_, j) => j !== i) })
                }
                className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-red-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {filters.length === 0 && (
            <p className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2.5 text-center text-[11px] text-neutral-500">
              Ingen filtre — kjører på alle hendelser av denne typen.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function ConditionEditor({
  content,
  onChange,
}: {
  content: StepContent
  onChange: (c: StepContent) => void
}) {
  const clauses = (content.clauses ?? []) as WfClause[]
  const logic = (content.logic as string) ?? 'AND'

  return (
    <div className="space-y-5">
      <div>
        <FieldLabel>Logikk mellom regler</FieldLabel>
        <div className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white p-0.5">
          {(['AND', 'OR'] as const).map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => onChange({ ...content, logic: op })}
              className={`rounded px-3 py-1 text-xs font-semibold ${
                logic === op ? 'bg-[#1a3d32] text-white' : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {op === 'AND' ? 'OG · alle må gjelde' : 'ELLER · minst én'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <FieldLabel>Regler</FieldLabel>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...content,
                clauses: [...clauses, { field: '', op: 'equals', value: '' }],
              })
            }
            className="text-[11px] font-semibold text-[#1a3d32] hover:underline"
          >
            + Legg til regel
          </button>
        </div>
        <div className="space-y-1.5">
          {clauses.map((c, i) => (
            <div key={i}>
              {i > 0 && (
                <p className="my-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  {logic}
                </p>
              )}
              <div className="grid grid-cols-[1fr_110px_1fr_28px] items-center gap-1.5">
                <input
                  value={c.field}
                  onChange={(e) => {
                    const n = [...clauses]
                    n[i] = { ...c, field: e.target.value }
                    onChange({ ...content, clauses: n })
                  }}
                  placeholder="felt (f.eks. severity)"
                  className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#1a3d32]"
                />
                <select
                  value={c.op}
                  onChange={(e) => {
                    const n = [...clauses]
                    n[i] = { ...c, op: e.target.value }
                    onChange({ ...content, clauses: n })
                  }}
                  className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-[#1a3d32]"
                >
                  <option value="equals">=</option>
                  <option value="not_equals">≠</option>
                  <option value="in">i</option>
                  <option value="contains">inneholder</option>
                  <option value="gt">&gt;</option>
                  <option value="lt">&lt;</option>
                </select>
                <input
                  value={c.value}
                  onChange={(e) => {
                    const n = [...clauses]
                    n[i] = { ...c, value: e.target.value }
                    onChange({ ...content, clauses: n })
                  }}
                  placeholder="verdi"
                  className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#1a3d32]"
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...content, clauses: clauses.filter((_, j) => j !== i) })
                  }
                  className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-red-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {clauses.length === 0 && (
            <p className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2.5 text-center text-[11px] text-neutral-500">
              Ingen betingelser — steget kjøres alltid.
            </p>
          )}
        </div>
      </div>
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-800">
        Betingelser evalueres mot hendelsens payload. Stopper flyten hvis ingen regler er
        oppfylt.
      </div>
    </div>
  )
}

function WaitEditor({
  content,
  onChange,
}: {
  content: StepContent
  onChange: (c: StepContent) => void
}) {
  const amount = (content.amount as number) ?? 1
  const unit = (content.unit as string) ?? 'days'
  const unitLabels: Record<string, string> = {
    minutes: 'Minutter',
    hours: 'Timer',
    days: 'Dager',
    weeks: 'Uker',
  }
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Ventetid</FieldLabel>
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => onChange({ ...content, amount: parseInt(e.target.value, 10) || 1 })}
            className="w-24 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-[#1a3d32]"
          />
          <select
            value={unit}
            onChange={(e) => onChange({ ...content, unit: e.target.value })}
            className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-[#1a3d32]"
          >
            {Object.entries(unitLabels).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-md bg-neutral-50 px-3 py-2.5 text-xs text-neutral-600">
        <Clock className="h-3.5 w-3.5 text-neutral-400" />
        Arbeidsflyten pauser i {amount} {unitLabels[unit]?.toLowerCase()} før neste steg kjøres.
      </div>
    </div>
  )
}

function EmailEditor({
  content,
  onChange,
}: {
  content: StepContent
  onChange: (c: StepContent) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel required>Til</FieldLabel>
        <TextInput
          value={(content.to as string) ?? ''}
          onChange={(v) => onChange({ ...content, to: v })}
          placeholder="e-post eller {{assignee.email}}"
        />
      </div>
      <div>
        <FieldLabel>Kopi (Cc)</FieldLabel>
        <TextInput
          value={(content.cc as string) ?? ''}
          onChange={(v) => onChange({ ...content, cc: v })}
          placeholder="kommaseparerte adresser"
        />
      </div>
      <div>
        <FieldLabel required>Emne</FieldLabel>
        <TextInput
          value={(content.subject as string) ?? ''}
          onChange={(v) => onChange({ ...content, subject: v })}
          placeholder="Kritisk avvik — {{avvik.id}}"
        />
      </div>
      <div>
        <FieldLabel>Mal</FieldLabel>
        <div className="flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
          <FileText className="h-4 w-4 text-neutral-400" />
          <span className="flex-1 text-neutral-700">
            {(content.template as string) || 'standard.eml'}
          </span>
          <button className="text-xs font-semibold text-[#1a3d32] hover:underline">Endre mal</button>
        </div>
      </div>
    </div>
  )
}

function TaskEditor({
  content,
  onChange,
}: {
  content: StepContent
  onChange: (c: StepContent) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel required>Tittel på oppgaven</FieldLabel>
        <TextInput
          value={(content.title as string) ?? ''}
          onChange={(v) => onChange({ ...content, title: v })}
          placeholder="Behandle funn"
        />
      </div>
      <div>
        <FieldLabel>Frist (dager fra hendelse)</FieldLabel>
        <input
          type="number"
          min={1}
          value={(content.dueDays as number) ?? 7}
          onChange={(e) =>
            onChange({ ...content, dueDays: parseInt(e.target.value, 10) || 7 })
          }
          className="w-28 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1a3d32]"
        />
      </div>
      <div>
        <FieldLabel>Tildel til</FieldLabel>
        <select
          value={(content.assignee as string) ?? 'auto'}
          onChange={(e) => onChange({ ...content, assignee: e.target.value })}
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1a3d32]"
        >
          <option value="auto">Auto (fra hendelse)</option>
          <option value="verneombud">Verneombud</option>
          <option value="linjeleder">Linjeleder</option>
          <option value="hms">HMS-ansvarlig</option>
        </select>
      </div>
    </div>
  )
}

function AssignEditor({
  content,
  onChange,
}: {
  content: StepContent
  onChange: (c: StepContent) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Rolle</FieldLabel>
        <select
          value={(content.role as string) ?? 'verneombud'}
          onChange={(e) => onChange({ ...content, role: e.target.value })}
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1a3d32]"
        >
          <option value="verneombud">Verneombud</option>
          <option value="linjeleder">Linjeleder</option>
          <option value="hms">HMS-ansvarlig</option>
          <option value="amu-leder">AMU-leder</option>
        </select>
      </div>
      <div>
        <FieldLabel>Kilde</FieldLabel>
        {(['lokasjon', 'avdeling', 'auto-fra-hendelse'] as const).map((s) => (
          <label key={s} className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
            <input
              type="radio"
              name="assign-source"
              value={s}
              checked={(content.source as string) === s}
              onChange={() => onChange({ ...content, source: s })}
              className="accent-[#1a3d32]"
            />
            {s === 'lokasjon'
              ? 'Slå opp fra lokasjon'
              : s === 'avdeling'
              ? 'Slå opp fra avdeling'
              : 'Auto fra hendelse'}
          </label>
        ))}
      </div>
    </div>
  )
}

function RosEditor({
  content,
  onChange,
}: {
  content: StepContent
  onChange: (c: StepContent) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Mal</FieldLabel>
        <select
          value={(content.template as string) ?? 'standard 5×5'}
          onChange={(e) => onChange({ ...content, template: e.target.value })}
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1a3d32]"
        >
          <option value="standard 5×5">Standard 5×5</option>
          <option value="kjemikalie 4×4">Kjemikalie 4×4</option>
          <option value="fall fra høyde">Fall fra høyde</option>
          <option value="kontorergonomi">Kontorergonomi</option>
        </select>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={(content.linkSource as boolean) ?? true}
          onChange={(e) => onChange({ ...content, linkSource: e.target.checked })}
          className="rounded accent-[#1a3d32]"
        />
        Koble til kildehendelseens ID automatisk
      </label>
    </div>
  )
}

function AmuEditor({
  content,
  onChange,
}: {
  content: StepContent
  onChange: (c: StepContent) => void
}) {
  const priorities = ['lav', 'normal', 'høy', 'kritisk'] as const
  const priority = (content.priority as string) ?? 'normal'
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel required>Agendapunkt</FieldLabel>
        <TextArea
          value={(content.agendaItem as string) ?? ''}
          onChange={(v) => onChange({ ...content, agendaItem: v })}
          placeholder="Gjennomgang av kritisk avvik — {avvik.id}"
          rows={3}
        />
      </div>
      <div>
        <FieldLabel>Prioritet</FieldLabel>
        <div className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white p-0.5">
          {priorities.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange({ ...content, priority: p })}
              className={`rounded px-3 py-1 text-xs font-semibold capitalize ${
                priority === p ? 'bg-[#1a3d32] text-white' : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function GenericEditor({
  content,
  onChange,
}: {
  content: StepContent
  onChange: (c: StepContent) => void
}) {
  const fields = Object.entries(content).filter(([k]) => k !== 'kind')
  return (
    <div className="space-y-4">
      {fields.map(([k, v]) => (
        <div key={k}>
          <FieldLabel>{k}</FieldLabel>
          {typeof v === 'boolean' ? (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={v}
                onChange={(e) => onChange({ ...content, [k]: e.target.checked })}
                className="rounded accent-[#1a3d32]"
              />
              {k}
            </label>
          ) : typeof v === 'number' ? (
            <input
              type="number"
              value={v}
              onChange={(e) => onChange({ ...content, [k]: parseInt(e.target.value, 10) })}
              className="w-28 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1a3d32]"
            />
          ) : (
            <TextInput
              value={String(v ?? '')}
              onChange={(val) => onChange({ ...content, [k]: val })}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function StepContentEditor({
  step,
  onChangeContent,
  sourceModule,
}: {
  step: WfStep
  onChangeContent: (c: StepContent) => void
  sourceModule: string
}) {
  const meta = STEP_META[step.kind]
  const Icon = meta.icon

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
      <div className="mb-4 flex items-center gap-2 border-b border-neutral-100 pb-4">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: meta.tint, color: meta.accent, border: `1px solid ${meta.border}` }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-sm font-semibold" style={{ color: meta.accent }}>
          {meta.label}
        </span>
        <span className="text-xs text-neutral-400">· konfigurasjon</span>
      </div>

      {step.kind === 'trigger' && (
        <TriggerEditor content={step.content} onChange={onChangeContent} sourceModule={sourceModule} />
      )}
      {step.kind === 'condition' && (
        <ConditionEditor content={step.content} onChange={onChangeContent} />
      )}
      {step.kind === 'wait' && (
        <WaitEditor content={step.content} onChange={onChangeContent} />
      )}
      {step.kind === 'email' && (
        <EmailEditor content={step.content} onChange={onChangeContent} />
      )}
      {step.kind === 'task' && (
        <TaskEditor content={step.content} onChange={onChangeContent} />
      )}
      {step.kind === 'assign' && (
        <AssignEditor content={step.content} onChange={onChangeContent} />
      )}
      {step.kind === 'ros' && (
        <RosEditor content={step.content} onChange={onChangeContent} />
      )}
      {step.kind === 'amu' && (
        <AmuEditor content={step.content} onChange={onChangeContent} />
      )}
      {!['trigger', 'condition', 'wait', 'email', 'task', 'assign', 'ros', 'amu'].includes(
        step.kind,
      ) && <GenericEditor content={step.content} onChange={onChangeContent} />}
    </div>
  )
}

// ─── KindPicker pill ──────────────────────────────────────────────────────────

function KindPickerWf({
  kind,
  onChange,
  disabled,
}: {
  kind: StepKind
  onChange: (k: StepKind) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const meta = STEP_META[kind]
  const Icon = meta.icon
  const ref = useRef<HTMLDivElement>(null)
  const byGroup = useMemo(() => {
    const map: Record<string, StepKind[]> = {}
    for (const k of STEP_KINDS_ORDERED) {
      const g = STEP_META[k].group
      ;(map[g] = map[g] ?? []).push(k)
    }
    return map
  }, [])

  useEffect(() => {
    if (!open) return
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  if (disabled) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
        style={{ background: meta.tint, color: meta.accent, border: `1px solid ${meta.border}` }}
      >
        <Icon className="h-3 w-3" />
        {meta.label}
      </span>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
        style={{ background: meta.tint, color: meta.accent, border: `1px solid ${meta.border}` }}
      >
        <Icon className="h-3 w-3" />
        {meta.label}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-[420px] w-80 overflow-y-auto rounded-md border border-neutral-200 bg-white p-2 shadow-lg">
          {Object.entries(byGroup).map(([group, kinds]) => (
            <div key={group} className="mb-2 last:mb-0">
              <p className="px-1.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                {group}
              </p>
              <div className="grid grid-cols-2 gap-1">
                {kinds.map((k) => {
                  const m = STEP_META[k]
                  const KIcon = m.icon
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => { setOpen(false); onChange(k) }}
                      className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs ${
                        k === kind
                          ? 'bg-[#1a3d32] text-white'
                          : 'text-neutral-700 hover:bg-[#e7efe9] hover:text-[#1a3d32]'
                      }`}
                    >
                      <KIcon className="h-3.5 w-3.5" />
                      <span className="font-medium">{m.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Step editor pane (right side) ───────────────────────────────────────────

function StepEditorPane({
  step,
  stepCount,
  dirtyIds,
  onChange,
  onChangeKind,
  onDelete,
  onSave,
  sourceModule,
}: {
  step: WfStep | null
  stepCount: number
  dirtyIds: Set<string>
  onChange: (s: WfStep) => void
  onChangeKind: (id: string, kind: StepKind) => void
  onDelete: (id: string) => void
  onSave: () => void
  sourceModule: string
}) {
  if (!step) {
    return (
      <div className="flex h-full items-center justify-center text-center text-neutral-400">
        <div>
          <Workflow className="mx-auto mb-3 h-10 w-10 text-neutral-200" />
          <p className="text-sm font-semibold">Velg et steg fra listen</p>
          <p className="mt-1 text-xs">Klikk på et steg i venstremenyen for å redigere det.</p>
        </div>
      </div>
    )
  }

  const isTrigger = step.kind === 'trigger'
  const isDirty = dirtyIds.has(step.id)

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-5">
      {/* Step header card */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center gap-1.5">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg text-base font-bold tabular-nums"
              style={{ background: '#F1ECDF', color: '#1a3d32' }}
            >
              {step.order}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-neutral-400">
              av {stepCount}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={step.title}
              onChange={(e) => onChange({ ...step, title: e.target.value })}
              placeholder="Steg-tittel"
              className="-mx-1 block w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-xl font-semibold text-neutral-900 outline-none transition-colors hover:bg-neutral-50 focus:border-neutral-300 focus:bg-white md:text-2xl"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <KindPickerWf
                kind={step.kind}
                onChange={(k) => onChangeKind(step.id, k)}
                disabled={isTrigger}
              />
              <button
                type="button"
                onClick={() => onChange({ ...step, enabled: !step.enabled })}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  step.enabled
                    ? 'bg-[#1a3d32] text-white hover:bg-[#15302a]'
                    : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {step.enabled ? (
                  <CircleDot className="h-3 w-3" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
                {step.enabled ? 'Aktiv' : 'Deaktivert'}
              </button>
              {isTrigger && (
                <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-600">
                  <Lock className="h-3 w-3" />
                  Steg 1 — utløser
                </span>
              )}
            </div>
            <textarea
              rows={2}
              value={step.summary}
              placeholder="Kort beskrivelse — vises i kjørehistorikken og revisjonsloggen."
              onChange={(e) => onChange({ ...step, summary: e.target.value })}
              className="mt-3 w-full resize-none rounded-md border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-800 outline-none transition-colors focus:border-[#1a3d32] focus:bg-white focus:ring-1 focus:ring-[#1a3d32]/25 placeholder:text-neutral-400"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-4">
          {!isTrigger ? (
            <button
              type="button"
              onClick={() => onDelete(step.id)}
              className="text-xs font-semibold text-red-600 hover:underline"
            >
              Slett steg
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onSave}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              isDirty
                ? 'bg-[#1a3d32] text-white hover:bg-[#15302a]'
                : 'bg-neutral-100 text-neutral-500'
            }`}
          >
            {isDirty ? 'Lagre' : 'Lagret'}
          </button>
        </div>
      </div>

      {/* Kind-specific content editor */}
      <StepContentEditor
        step={step}
        onChangeContent={(c) => onChange({ ...step, content: c })}
        sourceModule={sourceModule}
      />
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function WfDetaljerTab({
  rule,
  onChange,
}: {
  rule: WorkflowRuleRow
  onChange: (patch: Partial<WorkflowRuleRow>) => void
}) {
  return (
    <div className="space-y-5 p-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <ModuleSectionCard className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-neutral-900">Generelt</h3>
            <div className="space-y-4">
              <div>
                <FieldLabel required>Navn</FieldLabel>
                <TextInput
                  value={rule.name}
                  onChange={(v) => onChange({ name: v })}
                />
              </div>
              <div>
                <FieldLabel>Beskrivelse</FieldLabel>
                <TextArea
                  value={rule.description}
                  onChange={(v) => onChange({ description: v })}
                  rows={3}
                />
              </div>
              <div>
                <FieldLabel>Kilde-modul</FieldLabel>
                <select
                  value={rule.source_module}
                  onChange={(e) => onChange({ source_module: e.target.value })}
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1a3d32]"
                >
                  {WORKFLOW_SOURCE_MODULES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </ModuleSectionCard>
        </div>
        <div>
          <ModuleSectionCard className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-neutral-900">Kjøring</h3>
            <div className="space-y-3">
              {[
                { key: 'log_all', label: 'Logg alt for revisor' },
                { key: 'retry_on_fail', label: 'Prøv på nytt ved feil' },
                { key: 'notify_owner', label: 'Varsle eier om feil' },
                { key: 'allow_parallel', label: 'Tillat parallelle kjøringer' },
              ].map(({ key, label }) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
                  <input type="checkbox" className="rounded accent-[#1a3d32]" />
                  {label}
                </label>
              ))}
            </div>
          </ModuleSectionCard>
        </div>
      </div>
    </div>
  )
}

function WfLovverkTab() {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const laws = [
    { id: 'aml-3-1', law: 'AML', section: '§ 3-1 (2) e', desc: 'Iverksette tiltak ved avvik og lære av hendelser.' },
    { id: 'aml-4-6', law: 'AML', section: '§ 4-6',       desc: 'Tilrettelegging for arbeidstakere med redusert arbeidsevne.' },
    { id: 'ik-5-6',  law: 'IK',  section: '§ 5 nr. 6',   desc: 'Tiltak for å forebygge, avdekke og rette opp feil og mangler.' },
    { id: 'ik-5-7',  law: 'IK',  section: '§ 5 nr. 7',   desc: 'Systematisk overvåking og gjennomgang av internkontrollen.' },
    { id: 'bev-25',  law: 'BEV', section: '§ 25',         desc: 'Krav til journalføring og dokumentasjon.' },
    { id: 'iso-10-2',law: 'ISO', section: '45001 · 10.2', desc: 'Hendelse, avvik og korrektive tiltak.' },
  ]
  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  return (
    <div className="p-5">
      <ModuleSectionCard className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-neutral-900">Lovverk denne arbeidsflyten håndhever</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {laws.map((l) => (
            <label
              key={l.id}
              className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                checked.has(l.id)
                  ? 'border-[#1a3d32] bg-[#e7efe9]'
                  : 'border-neutral-200 bg-white hover:border-neutral-300'
              }`}
            >
              <input
                type="checkbox"
                checked={checked.has(l.id)}
                onChange={() => toggle(l.id)}
                className="mt-0.5 rounded accent-[#1a3d32]"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">{l.law}</span>
                  <span className="font-mono text-xs font-semibold text-neutral-700">{l.section}</span>
                </div>
                <p className="mt-1 text-[11px] text-neutral-600">{l.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </ModuleSectionCard>
    </div>
  )
}

function WfTestTab({ steps }: { steps: WfStep[] }) {
  const [ran, setRan] = useState(false)
  const total = steps.filter((s) => s.enabled).length

  return (
    <div className="p-5 space-y-5">
      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        Test-kjør spiller arbeidsflyten gjennom uten å sende ekte e-poster, opprette oppgaver
        eller logge i kjørehistorikken. Kun simulert.
      </div>
      <ModuleSectionCard className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">Simulering</h3>
          <button
            type="button"
            onClick={() => setRan(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a3d32] px-4 py-2 text-sm font-semibold text-white hover:bg-[#15302a]"
          >
            Kjør simulering
          </button>
        </div>
        {ran && (
          <ol className="space-y-2">
            {steps.map((s) => {
              const meta = STEP_META[s.kind]
              const Icon = meta.icon
              return (
                <li key={s.id} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      s.enabled ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    {s.enabled ? '✓' : '—'}
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900">
                      <Icon className="h-3 w-3" style={{ color: meta.accent }} />
                      Steg {s.order}: {s.title || meta.label}
                    </div>
                    <p className="text-[11px] text-neutral-500">
                      {s.enabled ? 'simulert vellykket' : 'hoppet over (deaktivert)'} · 0.{Math.floor(Math.random() * 90 + 10)}s
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
        {ran && (
          <p className="mt-4 text-xs text-neutral-500">
            Total simulert tid: {(total * 0.05 + 0.1).toFixed(2)} s · {total} av {steps.length} steg utført
          </p>
        )}
      </ModuleSectionCard>
    </div>
  )
}

// ─── Main editor ─────────────────────────────────────────────────────────────

type EditorTab = 'steg' | 'detaljer' | 'lovverk' | 'testkjor'

export function WorkflowEditorV2({ ruleId }: { ruleId: string }) {
  const navigate = useNavigate()
  const { rules, upsertRule, loading } = useWorkflows()
  const rule = rules.find((r) => r.id === ruleId)

  // ── Local step state ──────────────────────────────────────────────────────
  const [steps, setSteps] = useState<WfStep[]>([])
  const [activeStepId, setActiveStepId] = useState<string | null>(null)
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<EditorTab>('detaljer')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [rulePatch, setRulePatch] = useState<Partial<WorkflowRuleRow>>({})
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Initialise steps from rule.flow_graph_json ────────────────────────────
  useEffect(() => {
    if (!rule) return
    const graphSteps = (rule.flow_graph_json?.steps as WfStep[] | undefined) ?? []
    if (graphSteps.length > 0) {
      setSteps(graphSteps)
      setActiveStepId(graphSteps[0]?.id ?? null)
    } else {
      // Bootstrap: one trigger step
      const trigger = mkStep('trigger', 1)
      setSteps([trigger])
      setActiveStepId(trigger.id)
    }
  }, [rule?.id]) // only on mount/rule change

  // ── Auto-save debounce ────────────────────────────────────────────────────
  const triggerSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveStatus('saving')
    saveTimerRef.current = setTimeout(() => {
      void (async () => {
        if (!rule) return
        await upsertRule({
          id: rule.id,
          slug: rule.slug,
          name: rulePatch.name ?? rule.name,
          description: rulePatch.description ?? rule.description,
          source_module: rulePatch.source_module ?? rule.source_module,
          trigger_on: rule.trigger_on,
          is_active: rule.is_active,
          condition_json: rule.condition_json,
          actions_json: rule.actions_json,
          flow_graph_json: { steps },
          priority: rule.priority,
        })
        setDirtyIds(new Set())
        setSaveStatus('saved')
        setLastSaved(new Date().toISOString())
      })()
    }, 1200)
  }, [rule, steps, rulePatch, upsertRule])

  // ── Step operations ───────────────────────────────────────────────────────
  const updateStep = useCallback((updated: WfStep) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s)),
    )
    setDirtyIds((prev) => new Set(prev).add(updated.id))
    triggerSave()
  }, [triggerSave])

  const addStep = useCallback((kind: StepKind) => {
    setSteps((prev) => {
      const next = mkStep(kind, prev.length + 1)
      setActiveStepId(next.id)
      return [...prev, next]
    })
    triggerSave()
  }, [triggerSave])

  const moveStep = useCallback((idx: number, dir: -1 | 1) => {
    setSteps((prev) => {
      const moved = moveInArray(prev, idx, dir)
      return moved.map((s, i) => ({ ...s, order: i + 1 }))
    })
    triggerSave()
  }, [triggerSave])

  const dupStep = useCallback((id: string) => {
    setSteps((prev) => {
      const src = prev.find((s) => s.id === id)
      if (!src) return prev
      const dup = { ...src, id: freshId('st'), order: prev.length + 1 }
      return [...prev, dup]
    })
    triggerSave()
  }, [triggerSave])

  const delStep = useCallback((id: string) => {
    setSteps((prev) => {
      const next = prev.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i + 1 }))
      setActiveStepId(next[0]?.id ?? null)
      return next
    })
    setDirtyIds((prev) => { const n = new Set(prev); n.delete(id); return n })
    triggerSave()
  }, [triggerSave])

  const toggleStep = useCallback((id: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    )
    setDirtyIds((prev) => new Set(prev).add(id))
    triggerSave()
  }, [triggerSave])

  const changeKind = useCallback((id: string, kind: StepKind) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, kind, content: defaultContent(kind) } : s,
      ),
    )
    setDirtyIds((prev) => new Set(prev).add(id))
    triggerSave()
  }, [triggerSave])

  const handleRulePatch = useCallback((patch: Partial<WorkflowRuleRow>) => {
    setRulePatch((prev) => ({ ...prev, ...patch }))
    triggerSave()
  }, [triggerSave])

  const activeStep = steps.find((s) => s.id === activeStepId) ?? null

  if (loading && !rule) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'Automatisering', to: '/workflow' }, { label: '…' }]}
        title="Laster…"
        loading
      >
        {null}
      </ModulePageShell>
    )
  }

  if (!rule && !loading) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'Automatisering', to: '/workflow' }, { label: 'Ikke funnet' }]}
        title="Ikke funnet"
        notFound={{ title: 'Arbeidsflyten finnes ikke.', backHref: '/workflow', backLabel: 'Tilbake' }}
      >
        {null}
      </ModulePageShell>
    )
  }

  const displayName = rulePatch.name ?? rule?.name ?? '…'
  const sourceModule = rulePatch.source_module ?? rule?.source_module ?? 'hse'

  const tabDefs: { id: EditorTab; label: string }[] = [
    { id: 'detaljer', label: 'Detaljer' },
    { id: 'steg', label: 'Steg' },
    { id: 'lovverk', label: 'Lovverk' },
    { id: 'testkjor', label: 'Test-kjør' },
  ]

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Automatisering', to: '/workflow' },
        { label: displayName },
      ]}
      title={displayName}
      headerActions={
        <div className="flex items-center gap-2">
          {/* Auto-save indicator */}
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              Lagrer…
            </span>
          )}
          {saveStatus === 'saved' && lastSaved && (
            <span className="text-xs text-green-700">
              Lagret {fmtAgo(lastSaved)}
            </span>
          )}
          <button
            onClick={() => navigate('/workflow')}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Lukk
          </button>
          <button className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
            Test-kjør
          </button>
          <button
            onClick={() => triggerSave()}
            className="rounded-lg bg-[#1a3d32] px-4 py-2 text-sm font-semibold text-white hover:bg-[#15302a]"
          >
            Publiser
          </button>
        </div>
      }
      tabs={
        <div className="flex items-center gap-1 border-b border-neutral-200">
          {tabDefs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? 'border-[#1a3d32] text-[#1a3d32]'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      {/* ── Steg tab ─────────────────────────────────────────────────────────── */}
      {tab === 'steg' && (
        <div
          className="grid overflow-hidden rounded-xl border border-neutral-200 bg-white"
          style={{
            gridTemplateColumns: '320px 1fr',
            height: 'calc(100vh - 260px)',
            minHeight: 640,
          }}
        >
          {/* Left rail */}
          <div className="border-r border-neutral-200 bg-white">
            <StepRail
              steps={steps}
              activeId={activeStepId}
              dirtyIds={dirtyIds}
              onSelect={setActiveStepId}
              onMove={moveStep}
              onDup={dupStep}
              onDel={delStep}
              onAdd={addStep}
              onToggle={toggleStep}
            />
          </div>

          {/* Right editor pane */}
          <div className="bg-neutral-50/60">
            <StepEditorPane
              step={activeStep}
              stepCount={steps.length}
              dirtyIds={dirtyIds}
              onChange={updateStep}
              onChangeKind={changeKind}
              onDelete={delStep}
              onSave={triggerSave}
              sourceModule={sourceModule}
            />
          </div>
        </div>
      )}

      {/* ── Detaljer tab ─────────────────────────────────────────────────────── */}
      {tab === 'detaljer' && rule && (
        <WfDetaljerTab rule={{ ...rule, ...rulePatch }} onChange={handleRulePatch} />
      )}

      {/* ── Lovverk tab ──────────────────────────────────────────────────────── */}
      {tab === 'lovverk' && <WfLovverkTab />}

      {/* ── Test-kjør tab ────────────────────────────────────────────────────── */}
      {tab === 'testkjor' && <WfTestTab steps={steps} />}
    </ModulePageShell>
  )
}
