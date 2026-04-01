import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Calendar, History, Pencil, Plus, Trash2 } from 'lucide-react'
import { MODULE_LABELS } from '../lib/taskNavigation'
import { useTasks } from '../hooks/useTasks'
import type { Task, TaskModule, TaskSourceType, TaskStatus } from '../types/task'

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

export function TasksPage() {
  const {
    tasks,
    auditLog,
    addTask,
    updateTask,
    deleteTask,
    setStatus,
    signAsAssignee,
    signManagement,
  } = useTasks()
  const [searchParams, setSearchParams] = useSearchParams()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignee, setAssignee] = useState('')
  const [ownerRole, setOwnerRole] = useState('Ansvarlig')
  const [dueDate, setDueDate] = useState('')
  const [moduleFilter, setModuleFilter] = useState<TaskModule | 'all'>('all')
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
      setSearchParams({}, { replace: true })
    })
  }, [searchParams, setSearchParams])

  const filtered = useMemo(() => {
    if (moduleFilter === 'all') return tasks
    return tasks.filter((t) => t.module === moduleFilter)
  }, [tasks, moduleFilter])

  const stats = useMemo(() => {
    const list = filtered
    const todo = list.filter((t) => t.status === 'todo').length
    const prog = list.filter((t) => t.status === 'in_progress').length
    const done = list.filter((t) => t.status === 'done').length
    return { total: list.length, todo, prog, done }
  }, [filtered])

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

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <nav className="mb-4 text-sm text-neutral-600">
        <Link to="/" className="text-[#1a3d32] hover:underline">
          Projects
        </Link>
        <span className="mx-2 text-neutral-400">→</span>
        <span className="font-medium text-neutral-800">Tasks</span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200/80 pb-6">
        <div>
          <h1
            className="text-2xl font-semibold text-neutral-900 md:text-3xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            Oppgaver (samlet)
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Alle moduler kan sende oppfølgingsoppgaver hit. Digital signatur = navn + tidspunkt lagret lokalt
            (ekte juridisk signatur krever eSignatur-løsning).
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-neutral-200/80">
            Vist: <strong className="text-neutral-900">{stats.total}</strong>
          </span>
          <span className="rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-neutral-200/80">
            To do <strong>{stats.todo}</strong>
          </span>
          <span className="rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-neutral-200/80">
            Active <strong>{stats.prog}</strong>
          </span>
          <span className="rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-neutral-200/80">
            Done <strong>{stats.done}</strong>
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-neutral-600">Modul:</span>
        <select
          value={moduleFilter}
          onChange={(e) =>
            setModuleFilter(e.target.value === 'all' ? 'all' : (e.target.value as TaskModule))
          }
          className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm"
        >
          <option value="all">Alle</option>
          {(Object.keys(MODULE_LABELS) as TaskModule[]).map((m) => (
            <option key={m} value={m}>
              {MODULE_LABELS[m]}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,400px)_1fr]">
        <form
          onSubmit={handleSubmit}
          className="h-fit rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-neutral-900">
            {editingId ? 'Rediger oppgave' : 'Ny oppgave'}
          </h2>
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="task-title" className="text-xs font-medium text-neutral-500">
                Tittel
              </label>
              <input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
                required
              />
            </div>
            <div>
              <label htmlFor="task-desc" className="text-xs font-medium text-neutral-500">
                Beskrivelse
              </label>
              <textarea
                id="task-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1 w-full resize-y rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-neutral-500">Ansvarlig (navn)</label>
                <input
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  placeholder="Navn"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Rolle</label>
                <input
                  value={ownerRole}
                  onChange={(e) => setOwnerRole(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  placeholder="f.eks. verneombud"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-neutral-500">Modul</label>
                <select
                  value={formModule}
                  onChange={(e) => setFormModule(e.target.value as TaskModule)}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                >
                  {(Object.keys(MODULE_LABELS) as TaskModule[]).map((m) => (
                    <option key={m} value={m}>
                      {MODULE_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Kilde</label>
                <select
                  value={formSource}
                  onChange={(e) => setFormSource(e.target.value as TaskSourceType)}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
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
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500">Kilde-ID / merkelapp (valgfritt)</label>
              <div className="mt-1 flex gap-2">
                <input
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  className="w-1/3 rounded-xl border border-neutral-200 px-2 py-2 text-xs"
                  placeholder="UUID"
                />
                <input
                  value={sourceLabel}
                  onChange={(e) => setSourceLabel(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  placeholder="F.eks. møtetittel"
                />
              </div>
            </div>
            <div>
              <label htmlFor="task-due" className="text-xs font-medium text-neutral-500">
                Frist
              </label>
              <div className="relative mt-1">
                <Calendar className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                  id="task-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 py-2 pl-9 pr-2 text-sm"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={requiresMgmt}
                onChange={(e) => setRequiresMgmt(e.target.checked)}
                className="rounded border-neutral-300 text-[#1a3d32]"
              />
              Krever ledelses godkjenning
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26]"
            >
              <Plus className="size-4" />
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
                className="rounded-full px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
              >
                Avbryt
              </button>
            )}
          </div>
        </form>

        <div className="min-w-0 space-y-6">
          <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/80 text-neutral-600">
                    <th className="px-3 py-3 font-medium">Oppgave</th>
                    <th className="px-3 py-3 font-medium">Modul</th>
                    <th className="px-3 py-3 font-medium">Ansvarlig / rolle</th>
                    <th className="px-3 py-3 font-medium">Frist</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Signatur</th>
                    <th className="px-3 py-3 text-right font-medium">Valg</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-neutral-500">
                        Ingen oppgaver i filteret.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((t) => (
                      <tr key={t.id} className="border-b border-neutral-100 hover:bg-neutral-50/80">
                        <td className="px-3 py-3 align-top">
                          <div className="font-medium text-neutral-900">{t.title}</div>
                          {t.description ? (
                            <div className="mt-0.5 text-xs text-neutral-500 line-clamp-2">{t.description}</div>
                          ) : null}
                          {t.sourceLabel ? (
                            <div className="mt-1 text-xs text-[#1a3d32]/80">↳ {t.sourceLabel}</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 align-top text-xs text-neutral-600">
                          {MODULE_LABELS[t.module]}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="text-neutral-800">{t.assignee}</div>
                          <div className="text-xs text-neutral-500">{t.ownerRole}</div>
                        </td>
                        <td className="px-3 py-3 align-top text-neutral-600">{t.dueDate}</td>
                        <td className="px-3 py-3 align-top">
                          <select
                            value={t.status}
                            onChange={(e) => setStatus(t.id, e.target.value as TaskStatus)}
                            className={`rounded-full border-0 px-2 py-1 text-xs font-medium ${statusStyle(t.status)}`}
                          >
                            {(Object.keys(statusLabels) as TaskStatus[]).map((s) => (
                              <option key={s} value={s}>
                                {statusLabels[s]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3 align-top text-xs">
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
                                className="min-w-0 flex-1 rounded border border-neutral-200 px-1.5 py-0.5 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const ok = signAsAssignee(t.id, signName[t.id] ?? '')
                                  if (ok) setSignName((s) => ({ ...s, [t.id]: '' }))
                                }}
                                className="shrink-0 rounded bg-[#1a3d32] px-2 py-0.5 text-xs text-white"
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
                                className="rounded border border-neutral-300 px-2 py-0.5 text-xs"
                              >
                                Ledelsessignatur
                              </button>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top text-right">
                          <button
                            type="button"
                            onClick={() => startEdit(t)}
                            className="inline-flex rounded-lg p-1.5 text-neutral-600 hover:bg-neutral-100"
                            aria-label="Edit"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTask(t.id)}
                            className="inline-flex rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                            aria-label="Delete"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
              <History className="size-5" />
              Oppgavelogg (uforanderlig tillegg)
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Nye hendelser legges til. Sletting av oppgafer logges.
            </p>
            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs text-neutral-700">
              {[...auditLog].reverse().slice(0, 80).map((a) => (
                <li key={a.id} className="border-b border-neutral-100 py-1">
                  <span className="text-neutral-500">
                    {new Date(a.at).toLocaleString('no-NO')} · {a.action}
                  </span>{' '}
                  — {a.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
