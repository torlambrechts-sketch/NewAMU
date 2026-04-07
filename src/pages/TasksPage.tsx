import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Calendar, Check, History, LayoutList, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { MODULE_LABELS } from '../lib/taskNavigation'
import { useTasks } from '../hooks/useTasks'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import type { Task, TaskModule, TaskSourceType, TaskStatus } from '../types/task'
import { WizardButton } from '../components/wizard/WizardButton'
import { makeTaskWizard } from '../components/wizard/wizards'
import { Mainbox1 } from '../components/layout/Mainbox1'
import { Table1Shell } from '../components/layout/Table1Shell'
import { Table1Toolbar } from '../components/layout/Table1Toolbar'
import {
  mergeLayoutPayload,
  table1BodyRowClass,
  table1CellPadding,
  table1HeaderRowClass,
} from '../lib/layoutLabTokens'
import { useOrgMenu1Styles } from '../hooks/useOrgMenu1Styles'
import { useUiTheme } from '../hooks/useUiTheme'

const PAGE_WRAP = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'
const TABLE_CELL_BASE = 'align-middle text-sm text-neutral-800'
const HERO_ACTION_CLASS =
  'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-none px-4 text-sm font-medium leading-none'
const R_FLAT = 'rounded-none'
const SETTINGS_THRESHOLD_BOX =
  'flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5'
const ORG_MERGED_PANEL =
  'flex min-h-0 flex-col border border-black/15 lg:flex-row lg:items-stretch lg:divide-x lg:divide-white/15'
const ORG_MERGED_COL = 'min-w-0 flex-1 p-4 sm:p-5'
const ORG_MERGED_ACTION_COL =
  'flex shrink-0 flex-col justify-center gap-3 border-t border-white/15 p-4 sm:p-5 lg:border-t-0 lg:border-l lg:border-white/15'
const SETTINGS_LEAD_ON_DARK = 'text-sm leading-relaxed text-white/90'
const SETTINGS_FIELD_LABEL_ON_DARK = 'text-[10px] font-bold uppercase tracking-wider text-white/90'
const SETTINGS_INPUT_ON_DARK =
  'mt-1.5 w-full rounded-none border border-white/25 bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-none placeholder:text-neutral-400 focus:border-white focus:outline-none focus:ring-1 focus:ring-white'

const statusLabels: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
}

function statusStyle(s: TaskStatus) {
  switch (s) {
    case 'done':
      return 'bg-emerald-100 text-emerald-800'
    case 'in_progress':
      return 'bg-sky-100 text-sky-800'
    default:
      return 'bg-neutral-100 text-neutral-700'
  }
}

function parseModule(s: string | null): TaskModule | null {
  const allowed: TaskModule[] = [
    'general',
    'council',
    'members',
    'org_health',
    'hse',
    'hrm',
    'learning',
  ]
  return allowed.includes(s as TaskModule) ? (s as TaskModule) : null
}

function parseSource(s: string | null): TaskSourceType | null {
  const allowed: TaskSourceType[] = [
    'manual',
    'council_meeting',
    'council_compliance',
    'representatives',
    'survey',
    'hse_safety_round',
    'hse_inspection',
    'hse_incident',
    'nav_report',
    'labor_metric',
    'learning_course',
  ]
  return allowed.includes(s as TaskSourceType) ? (s as TaskSourceType) : null
}

type TaskPageTab = 'list' | 'audit'

export function TasksPage() {
  const menu1 = useOrgMenu1Styles()
  const { payload: layoutPayload } = useUiTheme()
  const layout = mergeLayoutPayload(layoutPayload)
  const tableCell = `${table1CellPadding(layout)} ${TABLE_CELL_BASE}`
  const theadRow = table1HeaderRowClass(layout)

  const { supabaseConfigured } = useOrgSetupContext()
  const {
    tasks,
    auditLog,
    addTask,
    updateTask,
    deleteTask,
    setStatus,
    signAsAssignee,
    signManagement,
    loading,
    error,
  } = useTasks()
  const [searchParams, setSearchParams] = useSearchParams()
  const pageTab: TaskPageTab = searchParams.get('view') === 'audit' ? 'audit' : 'list'

  const setPageTab = useCallback(
    (t: TaskPageTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (t === 'audit') next.set('view', 'audit')
          else {
            next.delete('view')
            next.set('view', 'list')
          }
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignee, setAssignee] = useState('')
  const [ownerRole, setOwnerRole] = useState('Ansvarlig')
  const [dueDate, setDueDate] = useState('')
  const [moduleFilter, setModuleFilter] = useState<TaskModule | 'all'>('all')
  const [taskSearch, setTaskSearch] = useState('')
  const [formModule, setFormModule] = useState<TaskModule>('general')
  const [formSource, setFormSource] = useState<TaskSourceType>('manual')
  const [sourceId, setSourceId] = useState('')
  const [sourceLabel, setSourceLabel] = useState('')
  const [requiresMgmt, setRequiresMgmt] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [signName, setSignName] = useState<Record<string, string>>({})

  useEffect(() => {
    const t = searchParams.get('title')
    if (!t) return
    queueMicrotask(() => {
      setTitle(t)
      setDescription(searchParams.get('desc') ?? '')
      const m = parseModule(searchParams.get('module'))
      if (m) {
        setFormModule(m)
        setModuleFilter(m)
      }
      const src = parseSource(searchParams.get('source'))
      if (src) setFormSource(src)
      setSourceId(searchParams.get('sourceId') ?? '')
      setSourceLabel(searchParams.get('sourceLabel') ?? '')
      setOwnerRole(searchParams.get('role') ?? 'Ansvarlig')
      setRequiresMgmt(searchParams.get('mgmt') === '1')
      const view = searchParams.get('view')
      setSearchParams(view ? { view } : { view: 'list' }, { replace: true })
    })
  }, [searchParams, setSearchParams])

  const filtered = useMemo(() => {
    let list = moduleFilter === 'all' ? tasks : tasks.filter((t) => t.module === moduleFilter)
    const q = taskSearch.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.assignee.toLowerCase().includes(q) ||
          MODULE_LABELS[t.module].toLowerCase().includes(q),
      )
    }
    return list
  }, [tasks, moduleFilter, taskSearch])

  const stats = useMemo(() => {
    const list = moduleFilter === 'all' ? tasks : tasks.filter((t) => t.module === moduleFilter)
    const todo = list.filter((t) => t.status === 'todo').length
    const prog = list.filter((t) => t.status === 'in_progress').length
    const done = list.filter((t) => t.status === 'done').length
    return { total: list.length, todo, prog, done }
  }, [tasks, moduleFilter])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const base = {
      title: title.trim(),
      description: description.trim(),
      assignee: assignee.trim() || 'Unassigned',
      ownerRole: ownerRole.trim() || 'Ansvarlig',
      dueDate: dueDate || '—',
      module: formModule,
      sourceType: formSource,
      sourceId: sourceId.trim() || undefined,
      sourceLabel: sourceLabel.trim() || undefined,
      requiresManagementSignOff: requiresMgmt,
    }
    if (editingId) {
      updateTask(editingId, base)
      setEditingId(null)
    } else {
      addTask({
        ...base,
        status: 'todo',
      })
    }
    setTitle('')
    setDescription('')
    setAssignee('')
    setOwnerRole('Ansvarlig')
    setDueDate('')
    setFormModule('general')
    setFormSource('manual')
    setSourceId('')
    setSourceLabel('')
    setRequiresMgmt(false)
  }

  function startEdit(task: Task) {
    setEditingId(task.id)
    setTitle(task.title)
    setDescription(task.description)
    setAssignee(task.assignee)
    setOwnerRole(task.ownerRole)
    setDueDate(task.dueDate === '—' ? '' : task.dueDate)
    setFormModule(task.module)
    setFormSource(task.sourceType)
    setSourceId(task.sourceId ?? '')
    setSourceLabel(task.sourceLabel ?? '')
    setRequiresMgmt(task.requiresManagementSignOff)
  }

  function formatSig(s?: { signerName: string; signedAt: string }) {
    if (!s) return null
    try {
      const d = new Date(s.signedAt).toLocaleString('no-NO', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
      return `${s.signerName} · ${d}`
    } catch {
      return s.signerName
    }
  }

  const MODULE_SEGMENTS: { id: TaskModule | 'all'; label: string }[] = [
    { id: 'all', label: 'Alle' },
    ...(Object.keys(MODULE_LABELS) as TaskModule[]).map((m) => ({ id: m, label: MODULE_LABELS[m] })),
  ]

  return (
    <div className={PAGE_WRAP}>
      <nav className="mb-6 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
        <Link to="/" className="text-neutral-500 hover:text-[#1a3d32]">
          Workspace
        </Link>
        <span className="text-neutral-400">→</span>
        <span className="font-medium text-neutral-800">Oppgaver</span>
      </nav>

      <div className="flex flex-col gap-6 border-b border-neutral-200/80 pb-8 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <div className="min-w-0 flex-1">
          <h1
            className="text-2xl font-semibold text-neutral-900 md:text-3xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            Oppgaver (samlet)
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Alle moduler kan sende oppfølgingsoppgaver hit. Digital signatur = navn + tidspunkt lagret lokalt.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className={`${HERO_ACTION_CLASS} bg-neutral-200/80 text-neutral-800`}>
              Vist: <strong className="font-semibold">{stats.total}</strong>
            </span>
            <span className={`${HERO_ACTION_CLASS} bg-neutral-100 text-neutral-700`}>
              To do <strong className="ml-1 font-semibold">{stats.todo}</strong>
            </span>
            <span className={`${HERO_ACTION_CLASS} bg-sky-100 text-sky-900`}>
              Aktiv <strong className="ml-1 font-semibold">{stats.prog}</strong>
            </span>
            <span className={`${HERO_ACTION_CLASS} bg-emerald-100 text-emerald-900`}>
              Ferdig <strong className="ml-1 font-semibold">{stats.done}</strong>
            </span>
          </div>
        </div>
      </div>

      <div className={menu1.barOuterClass} style={menu1.barStyle}>
        <div className={menu1.innerRowClass}>
          {(
            [
              { id: 'list' as const, label: 'Oppgaver', Icon: LayoutList },
              { id: 'audit' as const, label: 'Oppgavelogg', Icon: History },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = pageTab === id
            const tb = menu1.tabButton(active)
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPageTab(id)}
                className={tb.className}
                style={tb.style}
              >
                <Icon className="size-4 shrink-0 opacity-90" />
                <span className="whitespace-nowrap">{label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-none border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}
      {loading && supabaseConfigured && (
        <p className="mt-4 text-sm text-neutral-500">Laster oppgaver…</p>
      )}

      {pageTab === 'list' && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                { title: 'Totalt i filter', sub: 'Oppgaver som matcher modulfilter', value: `${stats.total}` },
                { title: 'To do', sub: 'Ikke påbegynt', value: `${stats.todo}` },
                { title: 'Pågår', sub: 'Under arbeid', value: `${stats.prog}` },
                { title: 'Ferdig', sub: 'Fullført', value: `${stats.done}` },
              ] as const
            ).map((item) => (
              <div key={item.title} className={SETTINGS_THRESHOLD_BOX} style={menu1.barStyle}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/85">{item.title}</p>
                <p className="mt-1 text-xs text-white/70">{item.sub}</p>
                <p className="mt-2 text-lg font-semibold tabular-nums text-white">{item.value}</p>
              </div>
            ))}
          </div>

          <form
            className="mt-6 overflow-hidden rounded-none border border-black/10"
            onSubmit={handleSubmit}
            style={menu1.barStyle}
          >
            <div className={ORG_MERGED_PANEL}>
              <div className={ORG_MERGED_COL}>
                <p className={SETTINGS_LEAD_ON_DARK}>Hva skal gjøres, og hva er bakgrunnen?</p>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className={SETTINGS_FIELD_LABEL_ON_DARK} htmlFor="task-title">
                      Tittel
                    </label>
                    <input
                      id="task-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      className={SETTINGS_INPUT_ON_DARK}
                    />
                  </div>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL_ON_DARK} htmlFor="task-desc">
                      Beskrivelse
                    </label>
                    <textarea
                      id="task-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className={SETTINGS_INPUT_ON_DARK}
                    />
                  </div>
                </div>
              </div>
              <div className={ORG_MERGED_COL}>
                <p className={SETTINGS_LEAD_ON_DARK}>Hvem eier oppgaven, når skal den være ferdig?</p>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className={SETTINGS_FIELD_LABEL_ON_DARK}>Ansvarlig (navn)</label>
                    <input
                      value={assignee}
                      onChange={(e) => setAssignee(e.target.value)}
                      className={SETTINGS_INPUT_ON_DARK}
                      placeholder="Navn"
                    />
                  </div>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL_ON_DARK}>Rolle</label>
                    <input
                      value={ownerRole}
                      onChange={(e) => setOwnerRole(e.target.value)}
                      className={SETTINGS_INPUT_ON_DARK}
                      placeholder="f.eks. verneombud"
                    />
                  </div>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL_ON_DARK} htmlFor="task-due">
                      Frist
                    </label>
                    <div className="relative mt-1.5">
                      <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
                      <input
                        id="task-due"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className={`${SETTINGS_INPUT_ON_DARK} pl-10`}
                      />
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-white/95">
                    <input
                      type="checkbox"
                      checked={requiresMgmt}
                      onChange={(e) => setRequiresMgmt(e.target.checked)}
                      className="size-4 rounded-none border-white/40 bg-white/10 text-[#1a3d32] focus:ring-1 focus:ring-white"
                    />
                    Krever ledelses godkjenning
                  </label>
                </div>
              </div>
              <div className={ORG_MERGED_COL}>
                <p className={SETTINGS_LEAD_ON_DARK}>Hvor kommer oppgaven fra i løsningen?</p>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className={SETTINGS_FIELD_LABEL_ON_DARK}>Modul</label>
                    <select
                      value={formModule}
                      onChange={(e) => setFormModule(e.target.value as TaskModule)}
                      className={SETTINGS_INPUT_ON_DARK}
                    >
                      {(Object.keys(MODULE_LABELS) as TaskModule[]).map((m) => (
                        <option key={m} value={m}>
                          {MODULE_LABELS[m]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL_ON_DARK}>Kilde</label>
                    <select
                      value={formSource}
                      onChange={(e) => setFormSource(e.target.value as TaskSourceType)}
                      className={SETTINGS_INPUT_ON_DARK}
                    >
                      <option value="manual">Manuell</option>
                      <option value="council_meeting">Rådsmøte</option>
                      <option value="council_compliance">Samsvar (råd)</option>
                      <option value="representatives">Representasjon</option>
                      <option value="survey">Undersøkelse</option>
                      <option value="hse_safety_round">Vernerunde</option>
                      <option value="hse_inspection">HMS-inspeksjon</option>
                      <option value="hse_incident">Hendelse</option>
                      <option value="nav_report">Sykefravær/NAV</option>
                      <option value="labor_metric">AML-indikator</option>
                      <option value="learning_course">Læringskurs</option>
                    </select>
                  </div>
                  <div>
                    <label className={SETTINGS_FIELD_LABEL_ON_DARK}>Kilde-ID / merkelapp</label>
                    <div className="mt-1.5 flex gap-2">
                      <input
                        value={sourceId}
                        onChange={(e) => setSourceId(e.target.value)}
                        className={`${SETTINGS_INPUT_ON_DARK} w-1/3 text-xs`}
                        placeholder="ID"
                      />
                      <input
                        value={sourceLabel}
                        onChange={(e) => setSourceLabel(e.target.value)}
                        className={`${SETTINGS_INPUT_ON_DARK} min-w-0 flex-1`}
                        placeholder="F.eks. møtetittel"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className={ORG_MERGED_ACTION_COL}>
                {!editingId && (
                  <WizardButton
                    label="Veiviser"
                    variant="ghost"
                    def={makeTaskWizard((data) => {
                      addTask({
                        title: String(data.title),
                        description: String(data.description) || '',
                        assignee: String(data.assignee) || '',
                        ownerRole: String(data.ownerRole) || 'Ansvarlig',
                        dueDate: String(data.dueDate) || '',
                        module: String(data.module) as TaskModule,
                        sourceType: 'manual' as TaskSourceType,
                        status: 'todo' as TaskStatus,
                        requiresManagementSignOff: Boolean(data.requiresManagementSignOff),
                      })
                    })}
                    className="w-full justify-center rounded-none border border-white/35 bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/15 hover:text-white"
                  />
                )}
                <button
                  type="submit"
                  className="inline-flex w-full min-w-[10rem] items-center justify-center gap-2 rounded-none border border-white/35 bg-white px-5 py-3 text-sm font-semibold shadow-none transition hover:bg-white/95"
                  style={{ color: layout.accent }}
                >
                  <Plus className="size-4 shrink-0" />
                  {editingId ? 'Lagre' : 'Legg til'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null)
                      setTitle('')
                      setDescription('')
                      setAssignee('')
                      setOwnerRole('Ansvarlig')
                      setDueDate('')
                      setFormModule('general')
                      setFormSource('manual')
                      setSourceId('')
                      setSourceLabel('')
                      setRequiresMgmt(false)
                    }}
                    className="w-full rounded-none border border-white/25 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10"
                  >
                    Avbryt
                  </button>
                )}
              </div>
            </div>
          </form>

          <section className="mt-8 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Oppgaveliste</h2>
                <p className="mt-1 text-sm text-neutral-500">Søk og filtrer på modul — samme tabellramme som Organisasjon.</p>
              </div>
              <span className="text-xs text-neutral-400">{filtered.length} vist</span>
            </div>

            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-none border border-dashed border-neutral-300 bg-white py-16 text-center shadow-sm">
                <p className="text-sm text-neutral-500">Ingen oppgaver ennå</p>
              </div>
            ) : (
              <Table1Shell
                toolbar={
                  <Table1Toolbar
                    payloadOverride={layout}
                    searchSlot={
                      <div
                        className="relative min-w-[200px] flex-1"
                        style={{ ['--layout-accent' as string]: layout.accent }}
                      >
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                        <input
                          value={taskSearch}
                          onChange={(e) => setTaskSearch(e.target.value)}
                          placeholder="Søk tittel, beskrivelse, ansvarlig…"
                          className={`w-full border border-neutral-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-[color:var(--layout-accent)] ${R_FLAT}`}
                        />
                      </div>
                    }
                    segmentSlot={
                      <div className={`inline-flex max-w-full flex-wrap border border-neutral-200 bg-neutral-50/80 p-1 ${R_FLAT}`}>
                        {MODULE_SEGMENTS.map(({ id, label }) => {
                          const selected = moduleFilter === id
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setModuleFilter(id)}
                              className={`inline-flex items-center gap-2 px-2.5 py-2 text-xs font-medium transition sm:px-3 sm:text-sm ${R_FLAT} ${
                                selected ? 'text-white shadow-sm' : 'text-neutral-600 hover:bg-white'
                              }`}
                              style={selected ? { backgroundColor: layout.accent, color: '#fff' } : undefined}
                            >
                              {selected ? (
                                <span className="flex size-4 items-center justify-center rounded-none bg-white/20">
                                  <Check className="size-3" />
                                </span>
                              ) : (
                                <span className="size-4 rounded-none border-2 border-neutral-300" />
                              )}
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    }
                  />
                }
              >
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center border-t border-neutral-100 bg-neutral-50/50 px-6 py-14 text-center">
                    <p className="text-sm font-medium text-neutral-700">Ingen treff</p>
                    <p className="mt-1 text-xs text-neutral-500">Juster søk eller modulfilter.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setTaskSearch('')
                        setModuleFilter('all')
                      }}
                      className="mt-4 rounded-none bg-[#1a3d32] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#142e26]"
                    >
                      Nullstill filtre
                    </button>
                  </div>
                ) : (
                  <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                    <thead>
                      <tr className={`text-sm ${theadRow}`}>
                        <th className={`${tableCell} font-medium`}>Oppgave</th>
                        <th className={`${tableCell} font-medium`}>Modul</th>
                        <th className={`${tableCell} font-medium`}>Ansvarlig / rolle</th>
                        <th className={`${tableCell} font-medium`}>Frist</th>
                        <th className={`${tableCell} font-medium`}>Status</th>
                        <th className={`${tableCell} font-medium`}>Signatur</th>
                        <th className={`${tableCell} text-right font-medium`} />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((t, rowIdx) => (
                        <tr key={t.id} className={`${table1BodyRowClass(layout, rowIdx)} hover:bg-neutral-50/50`}>
                          <td className={`${tableCell} align-top`}>
                            <div className="font-medium text-neutral-900">{t.title}</div>
                            {t.description ? (
                              <div className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{t.description}</div>
                            ) : null}
                            {t.sourceLabel ? (
                              <div className="mt-1 text-xs text-[#1a3d32]/80">↳ {t.sourceLabel}</div>
                            ) : null}
                          </td>
                          <td className={`${tableCell} align-top text-xs text-neutral-600`}>
                            {MODULE_LABELS[t.module]}
                          </td>
                          <td className={`${tableCell} align-top`}>
                            <div className="text-neutral-800">{t.assignee}</div>
                            <div className="text-xs text-neutral-500">{t.ownerRole}</div>
                          </td>
                          <td className={`${tableCell} align-top text-neutral-600`}>{t.dueDate}</td>
                          <td className={`${tableCell} align-top`}>
                            <select
                              value={t.status}
                              onChange={(e) => setStatus(t.id, e.target.value as TaskStatus)}
                              className={`rounded-none border-0 px-2 py-1 text-xs font-medium ${statusStyle(t.status)}`}
                            >
                              {(Object.keys(statusLabels) as TaskStatus[]).map((s) => (
                                <option key={s} value={s}>
                                  {statusLabels[s]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className={`${tableCell} align-top text-xs`}>
                            <div className="space-y-1">
                              <div>
                                <span className="text-neutral-500">Utfører: </span>
                                {formatSig(t.assigneeSignature) ?? (
                                  <span className="text-amber-700">Ikke signert</span>
                                )}
                              </div>
                              {t.requiresManagementSignOff ? (
                                <div>
                                  <span className="text-neutral-500">Leder: </span>
                                  {formatSig(t.managementSignature) ?? (
                                    <span className="text-amber-700">Mangler</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-neutral-400">—</span>
                              )}
                            </div>
                            <div className="mt-2 flex flex-col gap-1">
                              <div className="flex gap-1">
                                <input
                                  value={signName[t.id] ?? ''}
                                  onChange={(e) =>
                                    setSignName((s) => ({ ...s, [t.id]: e.target.value }))
                                  }
                                  placeholder="Fullt navn"
                                  className="min-w-0 flex-1 rounded-none border border-neutral-200 px-1.5 py-0.5 text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const ok = signAsAssignee(t.id, signName[t.id] ?? '')
                                    if (ok) setSignName((s) => ({ ...s, [t.id]: '' }))
                                  }}
                                  className="shrink-0 rounded-none bg-[#1a3d32] px-2 py-0.5 text-xs text-white"
                                >
                                  Signer utfører
                                </button>
                              </div>
                              {t.requiresManagementSignOff ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const ok = signManagement(t.id, signName[t.id] ?? '')
                                    if (ok) setSignName((s) => ({ ...s, [t.id]: '' }))
                                  }}
                                  className="rounded-none border border-neutral-300 px-2 py-0.5 text-xs"
                                >
                                  Ledelsessignatur
                                </button>
                              ) : null}
                            </div>
                          </td>
                          <td className={`${tableCell} align-top text-right`}>
                            <button
                              type="button"
                              onClick={() => startEdit(t)}
                              className="inline-flex rounded-none p-2 text-neutral-600 hover:bg-neutral-100"
                              aria-label="Rediger"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteTask(t.id)}
                              className="inline-flex rounded-none p-2 text-red-600 hover:bg-red-50"
                              aria-label="Slett"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Table1Shell>
            )}
          </section>
        </>
      )}

      {pageTab === 'audit' && (
        <section className="mt-8 w-full">
          <Mainbox1
            title="Oppgavelogg"
            subtitle="Nye hendelser legges til. Sletting av oppgaver logges."
          >
            <ul className="max-h-[min(70vh,520px)] space-y-1 overflow-y-auto text-xs text-neutral-700">
              {[...auditLog].reverse().slice(0, 200).map((a) => (
                <li key={a.id} className="border-b border-neutral-100 py-2">
                  <span className="text-neutral-500">
                    {new Date(a.at).toLocaleString('no-NO')} · {a.action}
                  </span>{' '}
                  — {a.message}
                </li>
              ))}
            </ul>
          </Mainbox1>
        </section>
      )}
    </div>
  )
}
