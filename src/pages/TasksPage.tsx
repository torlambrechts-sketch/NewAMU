import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Calendar, Check, History, LayoutList, Plus, Scale, Search, Trash2, X } from 'lucide-react'
import { MODULE_LABELS } from '../lib/taskNavigation'
import { useTasks } from '../hooks/useTasks'
import { useOrganisation } from '../hooks/useOrganisation'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { useWhistleblowing, acknowledgementUrgency } from '../hooks/useWhistleblowing'
import { TASK_OWNER_ROLE_OPTIONS } from '../lib/taskFormOptions'
import type { Task, TaskModule, TaskSourceType, TaskStatus } from '../types/task'
import type { Level1SystemSignatureMeta } from '../types/level1Signature'
import type { WhistleblowingCaseStatus } from '../types/whistleblowing'
import { WHISTLE_CATEGORY_OPTIONS } from '../types/whistleblowing'
import { AddTaskLink } from '../components/tasks/AddTaskLink'
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
import { formatLevel1AuditLine } from '../lib/level1Signature'

const PAGE_WRAP = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'
const TABLE_CELL_BASE = 'align-middle text-sm text-neutral-800'
const HERO_ACTION_CLASS =
  'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-none px-4 text-sm font-medium leading-none'
const R_FLAT = 'rounded-none'
const SETTINGS_THRESHOLD_BOX =
  'flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5'
/** Task panel: lead text 40% / form inset 60% from md breakpoint */
const TASK_PANEL_ROW_GRID =
  'grid grid-cols-1 gap-4 border-b border-neutral-200 px-4 py-4 last:border-b-0 md:grid-cols-[minmax(0,40%)_minmax(0,60%)] md:items-start md:gap-10 md:px-5 md:py-5'
const SETTINGS_LEAD = 'text-sm leading-relaxed text-neutral-600'
const SETTINGS_FIELD_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-800'
const SETTINGS_INPUT =
  'mt-1.5 w-full rounded-none border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 shadow-none placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900'
const TASK_PANEL_INSET = 'rounded-none border border-neutral-200/90 bg-[#f4f1ea] p-5 sm:p-6'
const TASK_PANEL_SELECT = `${SETTINGS_INPUT} bg-white`

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
    'task_cosign_request',
    'council_meeting',
    'council_compliance',
    'representatives',
    'survey',
    'hse_safety_round',
    'hse_inspection',
    'hse_inspection_finding',
    'hse_incident',
    'nav_report',
    'labor_metric',
    'learning_course',
    'ros_measure',
  ]
  return allowed.includes(s as TaskSourceType) ? (s as TaskSourceType) : null
}

type TaskPageTab = 'list' | 'audit' | 'whistle'

const WHISTLE_STATUS_LABELS: Record<WhistleblowingCaseStatus, string> = {
  received: 'Mottatt',
  triage: 'Vurdering',
  investigation: 'Undersøkelse',
  internal_review: 'Intern revisjon',
  closed: 'Avsluttet',
}

export function TasksPage() {
  const menu1 = useOrgMenu1Styles()
  const { payload: layoutPayload } = useUiTheme()
  const layout = mergeLayoutPayload(layoutPayload)
  const tableCell = `${table1CellPadding(layout)} ${TABLE_CELL_BASE}`
  const theadRow = table1HeaderRowClass(layout)

  const { supabaseConfigured, organization, profile, user } = useOrgSetupContext()
  const org = useOrganisation()
  const wb = useWhistleblowing()
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
  const viewParam = searchParams.get('view')
  const pageTab: TaskPageTab =
    viewParam === 'audit' ? 'audit' : viewParam === 'whistle' ? 'whistle' : 'list'

  const setPageTab = useCallback(
    (t: TaskPageTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (t === 'audit') next.set('view', 'audit')
          else if (t === 'whistle') next.set('view', 'whistle')
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
  const [assigneeEmployeeId, setAssigneeEmployeeId] = useState('')
  const [assigneeSignerEmployeeId, setAssigneeSignerEmployeeId] = useState('')
  const [ownerRole, setOwnerRole] = useState('Ansvarlig')
  const [leaderEmployeeId, setLeaderEmployeeId] = useState('')
  const [managementSignerEmployeeId, setManagementSignerEmployeeId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [moduleFilter, setModuleFilter] = useState<TaskModule | 'all'>('all')
  const [taskSearch, setTaskSearch] = useState('')
  const [formModule, setFormModule] = useState<TaskModule>('general')
  const [formSource, setFormSource] = useState<TaskSourceType>('manual')
  const [sourceId, setSourceId] = useState('')
  const [sourceLabel, setSourceLabel] = useState('')
  const [requiresMgmt, setRequiresMgmt] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [taskPanelOpen, setTaskPanelOpen] = useState(false)

  const [whistlePanelOpen, setWhistlePanelOpen] = useState(false)
  const [wCategory, setWCategory] = useState(WHISTLE_CATEGORY_OPTIONS[0]?.value ?? 'other')
  const [wTitle, setWTitle] = useState('')
  const [wDesc, setWDesc] = useState('')
  const [wWww, setWWww] = useState('')
  const [wOccurred, setWOccurred] = useState('')
  const [wAnonymous, setWAnonymous] = useState(true)
  const [wContact, setWContact] = useState('')
  const [wFiles, setWFiles] = useState('')
  const [wSubmitKey, setWSubmitKey] = useState<string | null>(null)
  const [closeModalCaseId, setCloseModalCaseId] = useState<string | null>(null)
  const [closeSummary, setCloseSummary] = useState('')
  const [whistleCasePanelId, setWhistleCasePanelId] = useState<string | null>(null)
  const [whistlePanelNote, setWhistlePanelNote] = useState('')
  const [nowMs, setNowMs] = useState(() => Date.now())
  const openedTaskIdRef = useRef<string | null>(null)

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- React setState identities are stable
  const resetTaskForm = useCallback(() => {
    setTitle('')
    setDescription('')
    setAssignee('')
    setAssigneeEmployeeId('')
    setAssigneeSignerEmployeeId('')
    setOwnerRole('Ansvarlig')
    setLeaderEmployeeId('')
    setManagementSignerEmployeeId('')
    setDueDate('')
    setFormModule('general')
    setFormSource('manual')
    setSourceId('')
    setSourceLabel('')
    setRequiresMgmt(false)
    setEditingId(null)
  }, [])

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- React setState identities are stable
  const resetWhistleForm = useCallback(() => {
    setWCategory(WHISTLE_CATEGORY_OPTIONS[0]?.value ?? 'other')
    setWTitle('')
    setWDesc('')
    setWWww('')
    setWOccurred('')
    setWAnonymous(true)
    setWContact('')
    setWFiles('')
    setWSubmitKey(null)
  }, [])

  function openWhistlePanel() {
    resetWhistleForm()
    setWhistlePanelOpen(true)
  }

  const closeWhistlePanel = useCallback(() => {
    setWhistlePanelOpen(false)
    resetWhistleForm()
  }, [resetWhistleForm])

  const closeTaskPanel = useCallback(() => {
    setTaskPanelOpen(false)
    resetTaskForm()
  }, [resetTaskForm])

  async function submitWhistleCase(e: React.FormEvent) {
    e.preventDefault()
    if (!wTitle.trim() || !wDesc.trim()) return
    const hints = wFiles
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const r = await wb.createCase({
      category: wCategory,
      title: wTitle,
      description: wDesc,
      whoWhatWhere: wWww,
      occurredAtText: wOccurred,
      isAnonymous: wAnonymous,
      reporterContact: wContact,
      attachmentHints: hints,
    })
    if (r) {
      setWSubmitKey(r.accessKey)
    }
  }

  useEffect(() => {
    const t = searchParams.get('title')
    if (!t || viewParam === 'whistle') return
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
      setEditingId(null)
      setTaskPanelOpen(true)
      const view = searchParams.get('view')
      setSearchParams(view ? { view } : { view: 'list' }, { replace: true })
    })
  }, [searchParams, setSearchParams, viewParam])

  useEffect(() => {
    if (!taskPanelOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [taskPanelOpen])

  useEffect(() => {
    if (!taskPanelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTaskPanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [taskPanelOpen, closeTaskPanel])

  useEffect(() => {
    if (!whistlePanelOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [whistlePanelOpen])

  useEffect(() => {
    if (!whistlePanelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeWhistlePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [whistlePanelOpen, closeWhistlePanel])

  useEffect(() => {
    if (pageTab !== 'whistle') return
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [pageTab])

  const employeePickList = useMemo(
    () =>
      [...org.activeEmployees].sort((a, b) => a.name.localeCompare(b.name, 'nb')),
    [org.activeEmployees],
  )

  const signerPickList = useMemo(
    () =>
      [...org.allowedTaskSignerEmployees].sort((a, b) => a.name.localeCompare(b.name, 'nb')),
    [org.allowedTaskSignerEmployees],
  )

  useEffect(() => {
    const openId = searchParams.get('openTask')?.trim()
    if (!openId || viewParam === 'whistle') {
      openedTaskIdRef.current = null
      return
    }
    const task = tasks.find((x) => x.id === openId)
    if (!task) return
    if (openedTaskIdRef.current === openId) return
    openedTaskIdRef.current = openId
    queueMicrotask(() => {
      setEditingId(task.id)
      setTitle(task.title)
      setDescription(task.description)
      setAssignee(task.assignee)
      setAssigneeEmployeeId(task.assigneeEmployeeId ?? '')
      {
        const def =
          task.assigneeSignerEmployeeId ??
          (task.assigneeEmployeeId && signerPickList.some((e) => e.id === task.assigneeEmployeeId)
            ? task.assigneeEmployeeId
            : '')
        setAssigneeSignerEmployeeId(def)
      }
      setOwnerRole(task.ownerRole)
      setLeaderEmployeeId(task.leaderEmployeeId ?? '')
      {
        const def =
          task.managementSignerEmployeeId ??
          (task.leaderEmployeeId && signerPickList.some((e) => e.id === task.leaderEmployeeId)
            ? task.leaderEmployeeId
            : '')
        setManagementSignerEmployeeId(task.requiresManagementSignOff ? def : '')
      }
      setDueDate(task.dueDate === '—' ? '' : task.dueDate)
      setFormModule(task.module)
      setFormSource(task.sourceType)
      setSourceId(task.sourceId ?? '')
      setSourceLabel(task.sourceLabel ?? '')
      setRequiresMgmt(task.requiresManagementSignOff)
      setTaskPanelOpen(true)
      const view = searchParams.get('view') ?? 'list'
      setSearchParams({ view }, { replace: true })
    })
  }, [searchParams, tasks, viewParam, setSearchParams, signerPickList])

  const leaderCandidates = useMemo(() => {
    const pool = signerPickList.length > 0 ? signerPickList : employeePickList
    const isLeaderLike = (e: (typeof employeePickList)[0]) => {
      const r = (e.role ?? '').toLowerCase()
      const j = (e.jobTitle ?? '').toLowerCase()
      return r.includes('led') || j.includes('leder') || j.includes('director') || j.includes('sjef')
    }
    const leaders = pool.filter(isLeaderLike)
    return leaders.length > 0 ? leaders : pool
  }, [employeePickList, signerPickList])

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

  function normSignerEmail(s: string | null | undefined) {
    const t = s?.trim().toLowerCase()
    return t || undefined
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const effectiveAssigneeSignerId =
      assigneeSignerEmployeeId ||
      (signerPickList.some((e) => e.id === assigneeEmployeeId) ? assigneeEmployeeId : '')
    if (signerPickList.length > 0 && !effectiveAssigneeSignerId) {
      window.alert('Velg hvem som skal signere som utfører (godkjente signatarer).')
      return
    }
    const effectiveMgmtSignerId =
      managementSignerEmployeeId ||
      (requiresMgmt && signerPickList.some((e) => e.id === leaderEmployeeId) ? leaderEmployeeId : '')
    if (requiresMgmt && signerPickList.length > 0 && !effectiveMgmtSignerId) {
      window.alert('Velg hvem som skal signere som leder (godkjente signatarer).')
      return
    }
    const assigneeEmp = assigneeEmployeeId
      ? org.employees.find((e) => e.id === assigneeEmployeeId) ??
        org.displayEmployees.find((e) => e.id === assigneeEmployeeId)
      : undefined
    const leaderEmp = leaderEmployeeId
      ? org.employees.find((e) => e.id === leaderEmployeeId) ?? org.displayEmployees.find((e) => e.id === leaderEmployeeId)
      : undefined
    const assigneeSignerEmp = effectiveAssigneeSignerId
      ? org.employees.find((e) => e.id === effectiveAssigneeSignerId) ??
        org.displayEmployees.find((e) => e.id === effectiveAssigneeSignerId)
      : undefined
    const mgmtSignerEmp = effectiveMgmtSignerId
      ? org.employees.find((e) => e.id === effectiveMgmtSignerId) ??
        org.displayEmployees.find((e) => e.id === effectiveMgmtSignerId)
      : undefined
    const base = {
      title: title.trim(),
      description: description.trim(),
      assignee: assignee.trim() || 'Unassigned',
      assigneeEmployeeId: assigneeEmployeeId || undefined,
      assigneeSignerEmployeeId: effectiveAssigneeSignerId || undefined,
      assigneeSignerEmail: normSignerEmail(assigneeSignerEmp?.email ?? assigneeEmp?.email),
      ownerRole: ownerRole.trim() || 'Ansvarlig',
      leaderEmployeeId: requiresMgmt ? leaderEmployeeId || undefined : undefined,
      leaderName: requiresMgmt && leaderEmp ? leaderEmp.name : undefined,
      managementSignerEmployeeId: requiresMgmt ? effectiveMgmtSignerId || undefined : undefined,
      managementSignerEmail: requiresMgmt
        ? normSignerEmail(mgmtSignerEmp?.email ?? leaderEmp?.email)
        : undefined,
      managementSignerName: requiresMgmt
        ? mgmtSignerEmp?.name ?? leaderEmp?.name
        : undefined,
      dueDate: dueDate || '—',
      module: formModule,
      sourceType: formSource,
      sourceId: sourceId.trim() || undefined,
      sourceLabel: sourceLabel.trim() || undefined,
      requiresManagementSignOff: requiresMgmt,
    }
    if (editingId) {
      updateTask(editingId, base)
    } else {
      addTask({
        ...base,
        status: 'todo',
      })
    }
    setTaskPanelOpen(false)
    resetTaskForm()
  }

  function startEdit(task: Task) {
    setEditingId(task.id)
    setTitle(task.title)
    setDescription(task.description)
    setAssignee(task.assignee)
    setAssigneeEmployeeId(task.assigneeEmployeeId ?? '')
    {
      const def =
        task.assigneeSignerEmployeeId ??
        (task.assigneeEmployeeId && signerPickList.some((e) => e.id === task.assigneeEmployeeId)
          ? task.assigneeEmployeeId
          : '')
      setAssigneeSignerEmployeeId(def)
    }
    setOwnerRole(task.ownerRole)
    setLeaderEmployeeId(task.leaderEmployeeId ?? '')
    {
      const def =
        task.managementSignerEmployeeId ??
        (task.leaderEmployeeId && signerPickList.some((e) => e.id === task.leaderEmployeeId)
          ? task.leaderEmployeeId
          : '')
      setManagementSignerEmployeeId(task.requiresManagementSignOff ? def : '')
    }
    setDueDate(task.dueDate === '—' ? '' : task.dueDate)
    setFormModule(task.module)
    setFormSource(task.sourceType)
    setSourceId(task.sourceId ?? '')
    setSourceLabel(task.sourceLabel ?? '')
    setRequiresMgmt(task.requiresManagementSignOff)
    setTaskPanelOpen(true)
  }

  function openNewTaskPanel() {
    resetTaskForm()
    setTaskPanelOpen(true)
  }

  const taskBeingEdited = editingId ? tasks.find((t) => t.id === editingId) : undefined
  const userSignerEmail = normSignerEmail(profile?.email ?? user?.email ?? undefined) ?? null

  const signUi = useMemo(() => {
    const t = taskBeingEdited
    if (!t) return null
    if (t.sourceType === 'task_cosign_request') {
      const parent = t.cosignParentTaskId ? tasks.find((x) => x.id === t.cosignParentTaskId) : undefined
      const expectedMgmt =
        parent?.managementSignerEmail ??
        (parent?.managementSignerEmployeeId ?? parent?.leaderEmployeeId
          ? normSignerEmail(
              org.employees.find(
                (e) => e.id === (parent.managementSignerEmployeeId ?? parent.leaderEmployeeId),
              )?.email ??
                org.displayEmployees.find(
                  (e) => e.id === (parent.managementSignerEmployeeId ?? parent.leaderEmployeeId),
                )?.email,
            )
          : undefined)
      const canSignParent =
        !!parent?.requiresManagementSignOff &&
        !!expectedMgmt &&
        !!userSignerEmail &&
        expectedMgmt === userSignerEmail &&
        !!parent.assigneeSignature &&
        !parent.managementSignature
      return {
        mode: 'cosign_reminder' as const,
        parentTitle: parent?.title,
        canSignParent,
        missingAssigneeOnParent: !parent?.assigneeSignature,
      }
    }
    const expectedAssignee =
      t.assigneeSignerEmail ??
      (t.assigneeSignerEmployeeId ?? t.assigneeEmployeeId
        ? normSignerEmail(
            org.employees.find((e) => e.id === (t.assigneeSignerEmployeeId ?? t.assigneeEmployeeId))?.email ??
              org.displayEmployees.find((e) => e.id === (t.assigneeSignerEmployeeId ?? t.assigneeEmployeeId))?.email,
          )
        : undefined)
    const expectedMgmt =
      t.managementSignerEmail ??
      (t.managementSignerEmployeeId ?? t.leaderEmployeeId
        ? normSignerEmail(
            org.employees.find((e) => e.id === (t.managementSignerEmployeeId ?? t.leaderEmployeeId))?.email ??
              org.displayEmployees.find((e) => e.id === (t.managementSignerEmployeeId ?? t.leaderEmployeeId))?.email,
          )
        : undefined)
    const canSignAssignee =
      !!expectedAssignee && !!userSignerEmail && expectedAssignee === userSignerEmail && !t.assigneeSignature
    const canSignMgmt =
      t.requiresManagementSignOff &&
      !!expectedMgmt &&
      !!userSignerEmail &&
      expectedMgmt === userSignerEmail &&
      !!t.assigneeSignature &&
      !t.managementSignature
    return {
      mode: 'normal' as const,
      expectedAssignee,
      expectedMgmt,
      canSignAssignee,
      canSignMgmt,
      missingAssigneeEmail:
        !!(t.assigneeSignerEmployeeId || t.assigneeEmployeeId) && !expectedAssignee,
      missingLeaderEmail:
        t.requiresManagementSignOff &&
        !!(t.managementSignerEmployeeId || t.leaderEmployeeId) &&
        !expectedMgmt,
    }
  }, [taskBeingEdited, tasks, userSignerEmail, org.employees, org.displayEmployees])

  const whistleCaseOpen = whistleCasePanelId ? wb.cases.find((c) => c.id === whistleCasePanelId) : undefined

  function formatSig(s?: { signerName: string; signedAt: string; level1?: Level1SystemSignatureMeta }) {
    if (!s) return null
    try {
      const d = new Date(s.signedAt).toLocaleString('no-NO', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
      const l1 = formatLevel1AuditLine(s.level1)
      return l1 ? `${s.signerName} · ${d}\n${l1}` : `${s.signerName} · ${d}`
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
            {pageTab === 'whistle' ? 'Varslingssaker' : 'Oppgaver (samlet)'}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {pageTab === 'whistle'
              ? 'Lukket hvelv: kun varslingsmottak og administrator ser saker. Notater er kun tillegg (kan ikke slettes). Anonym innsending: lenke på innloggingssiden.'
              : 'Alle moduler kan sende oppfølgingsoppgaver hit. Digital signatur = navn + tidspunkt lagret lokalt.'}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {pageTab === 'list' ? (
              <>
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
                <button
                  type="button"
                  onClick={openNewTaskPanel}
                  className={`${HERO_ACTION_CLASS} gap-2 bg-[#1a3d32] text-white hover:bg-[#142e26]`}
                >
                  <Plus className="size-4 shrink-0" />
                  Ny oppgave
                </button>
              </>
            ) : pageTab === 'whistle' ? (
              <>
                <span className={`${HERO_ACTION_CLASS} bg-neutral-200/80 text-neutral-800`}>
                  Saker <strong className="ml-1 font-semibold">{wb.cases.length}</strong>
                </span>
                <button
                  type="button"
                  onClick={openWhistlePanel}
                  className={`${HERO_ACTION_CLASS} gap-2 bg-[#1a3d32] text-white hover:bg-[#142e26]`}
                >
                  <Plus className="size-4 shrink-0" />
                  Ny varslingssak
                </button>
                {organization?.whistle_public_slug ? (
                  <span className={`${HERO_ACTION_CLASS} max-w-full bg-white text-xs text-neutral-600 ring-1 ring-neutral-200`}>
                    Offentlig lenke:{' '}
                    <code className="ml-1 font-mono text-[11px]">
                      /varsle/{organization.whistle_public_slug}
                    </code>
                  </span>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className={menu1.barOuterClass} style={menu1.barStyle}>
        <div className={menu1.innerRowClass}>
          {(
            [
              { id: 'list' as const, label: 'Oppgaver', Icon: LayoutList, iconOnly: false as const },
              { id: 'whistle' as const, label: 'Varslingssaker', Icon: Scale, iconOnly: false as const },
              { id: 'audit' as const, label: 'Revisjonslogg', Icon: History, iconOnly: true as const },
            ] as const
          ).map(({ id, label, Icon, iconOnly }) => {
            const active = pageTab === id
            const tb = menu1.tabButton(active)
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPageTab(id)}
                className={tb.className}
                style={tb.style}
                title={label}
                aria-label={iconOnly ? label : undefined}
              >
                <Icon className="size-4 shrink-0 opacity-90" aria-hidden={!!iconOnly} />
                {!iconOnly ? <span className="whitespace-nowrap">{label}</span> : null}
              </button>
            )
          })}
        </div>
      </div>

      {(error || wb.error) && (
        <p className="mt-4 rounded-none border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error ?? wb.error}
        </p>
      )}
      {loading && supabaseConfigured && (
        <p className="mt-4 text-sm text-neutral-500">Laster oppgaver…</p>
      )}

      {pageTab === 'whistle' && (
        <>
          {!supabaseConfigured ? (
            <div className="mt-8 rounded-none border border-neutral-200 bg-white px-4 py-4 text-sm text-neutral-700">
              Varslingshvelvet krever Supabase med migrasjonene <code className="text-xs">whistleblowing_cases</code> og
              RLS. Konfigurer klienten for å bruke denne modulen.
            </div>
          ) : !wb.canAccessVault ? (
            <div className="mt-8 rounded-none border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              Du har ikke tilgang til varslingshvelvet. Kun brukere med rollen{' '}
              <strong>Varslingsmottak</strong> (<code className="text-xs">whistleblowing.committee</code>) eller
              organisasjonsadministrator kan se saker her.
            </div>
          ) : wb.loading && supabaseConfigured ? (
            <p className="mt-6 text-sm text-neutral-500">Laster varslingssaker…</p>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(
                  [
                    { title: 'Totalt', sub: 'Registrerte saker', value: `${wb.cases.length}` },
                    {
                      title: 'Åpne',
                      sub: 'Ikke avsluttet',
                      value: `${wb.cases.filter((c) => c.status !== 'closed').length}`,
                    },
                    {
                      title: 'Frist nær',
                      sub: '≤2 dager til bekreftelsesfrist',
                      value: `${wb.cases.filter((c) => c.status !== 'closed' && acknowledgementUrgency(c.acknowledgement_due_at) === 'soon').length}`,
                    },
                    {
                      title: 'Forfalt frist',
                      sub: 'Krever oppfølging',
                      value: `${wb.cases.filter((c) => c.status !== 'closed' && acknowledgementUrgency(c.acknowledgement_due_at) === 'overdue').length}`,
                    },
                  ] as const
                ).map((item) => (
                  <div key={item.title} className={SETTINGS_THRESHOLD_BOX} style={menu1.barStyle}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/85">{item.title}</p>
                    <p className="mt-1 text-xs text-white/70">{item.sub}</p>
                    <p className="mt-2 text-lg font-semibold tabular-nums text-white">{item.value}</p>
                  </div>
                ))}
              </div>

              <section className="mt-8 overflow-hidden rounded-none border border-neutral-200 bg-white">
                <div className="border-b border-neutral-200 px-4 py-3">
                  <h2 className="font-semibold text-neutral-900">Saker</h2>
                  <p className="mt-1 text-xs text-neutral-500">
                    Mottatt-dato og frist for bekreftelse (typisk 7 dager). Interne notater er append-only i databasen.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                    <thead>
                      <tr className={theadRow}>
                        <th className={`${tableCell} font-medium`}>Sak</th>
                        <th className={`${tableCell} font-medium`}>Status</th>
                        <th className={`${tableCell} font-medium`}>Mottatt</th>
                        <th className={`${tableCell} font-medium`}>Bekreftelsesfrist</th>
                        <th className={`${tableCell} font-medium`}>Notater</th>
                        <th className={`${tableCell} text-right font-medium`}>Handlinger</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wb.cases.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-sm text-neutral-500">
                            Ingen varslingssaker ennå.
                          </td>
                        </tr>
                      ) : (
                        wb.cases.map((c, rowIdx) => {
                          const urg = acknowledgementUrgency(c.acknowledgement_due_at)
                          const fristCls =
                            urg === 'overdue'
                              ? 'text-red-700 font-semibold'
                              : urg === 'soon'
                                ? 'text-amber-800 font-medium'
                                : 'text-neutral-700'
                          const daysLeft = Math.ceil(
                            (new Date(c.acknowledgement_due_at).getTime() - nowMs) / (24 * 60 * 60 * 1000),
                          )
                          return (
                            <tr key={c.id} className={`${table1BodyRowClass(layout, rowIdx)} hover:bg-neutral-50/50`}>
                              <td className={`${tableCell} align-top`}>
                                <div className="font-medium text-neutral-900">{c.title}</div>
                                <div className="mt-0.5 text-xs text-neutral-500">{c.category}</div>
                                {c.description ? (
                                  <div className="mt-1 line-clamp-2 text-xs text-neutral-600">{c.description}</div>
                                ) : null}
                              </td>
                              <td className={`${tableCell} align-top`}>
                                <span className="rounded-none border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-800">
                                  {WHISTLE_STATUS_LABELS[c.status]}
                                </span>
                              </td>
                              <td className={`${tableCell} align-top text-xs text-neutral-600`}>
                                {new Date(c.received_at).toLocaleString('no-NO', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })}
                              </td>
                              <td className={`${tableCell} align-top text-xs ${fristCls}`}>
                                {new Date(c.acknowledgement_due_at).toLocaleDateString('no-NO')}
                                <div className="mt-0.5">
                                  {urg === 'overdue'
                                    ? `Forfalt (${Math.abs(daysLeft)} d)`
                                    : `Gjenstår ca. ${daysLeft} d`}
                                </div>
                              </td>
                              <td className={`${tableCell} align-top max-w-[240px]`}>
                                <p className="text-[11px] text-neutral-500">
                                  {(wb.notesByCase[c.id] ?? []).length} notat(er)
                                </p>
                              </td>
                              <td className={`${tableCell} align-top text-right`}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setWhistleCasePanelId(c.id)
                                    setWhistlePanelNote('')
                                  }}
                                  className={`${HERO_ACTION_CLASS} border border-neutral-300 bg-white text-neutral-800`}
                                >
                                  Åpne
                                </button>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
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
                            {t.requiresManagementSignOff && (t.leaderName || t.leaderEmployeeId) ? (
                              <div className="mt-1 text-xs text-neutral-500">
                                Leder:{' '}
                                <span className="font-medium text-neutral-700">
                                  {t.leaderName ?? '—'}
                                </span>
                              </div>
                            ) : null}
                          </td>
                          <td className={`${tableCell} align-top text-neutral-600`}>{t.dueDate}</td>
                          <td className={`${tableCell} align-top`}>
                            <span
                              className={`inline-block rounded-none px-2 py-1 text-xs font-medium ${statusStyle(t.status)}`}
                            >
                              {statusLabels[t.status]}
                            </span>
                          </td>
                          <td className={`${tableCell} align-top text-xs`}>
                            <div className="space-y-1">
                              <div>
                                <span className="text-neutral-500">Utfører: </span>
                                {t.assigneeSignature ? (
                                  <span className="text-emerald-800">Signert</span>
                                ) : (
                                  <span className="text-amber-700">Ikke signert</span>
                                )}
                              </div>
                              {t.requiresManagementSignOff ? (
                                <div>
                                  <span className="text-neutral-500">Leder: </span>
                                  {t.managementSignature ? (
                                    <span className="text-emerald-800">Signert</span>
                                  ) : (
                                    <span className="text-amber-700">Mangler</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-neutral-400">—</span>
                              )}
                            </div>
                            <p className="mt-1 text-[10px] text-neutral-400">Signering i sidevindu</p>
                          </td>
                          <td className={`${tableCell} align-top text-right`}>
                            <div className="flex flex-col items-end gap-2">
                              <button
                                type="button"
                                onClick={() => startEdit(t)}
                                className={`${HERO_ACTION_CLASS} border border-neutral-300 bg-white text-neutral-800`}
                              >
                                Åpne
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteTask(t.id)}
                                className="inline-flex rounded-none p-2 text-red-600 hover:bg-red-50"
                                aria-label="Slett"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
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
            title="Revisjonslogg"
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

      {closeModalCaseId ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCloseModalCaseId(null)
          }}
        >
          <div
            className="max-w-md border border-neutral-200 bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-neutral-900">Lukk varslingssak</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Skriv en offisiell konklusjon. Denne lagres på saken og kan ikke fjernes uten databaseinngrep.
            </p>
            <textarea
              value={closeSummary}
              onChange={(e) => setCloseSummary(e.target.value)}
              rows={4}
              className="mt-4 w-full rounded-none border border-neutral-300 px-3 py-2 text-sm"
              placeholder="Konklusjon og eventuelle henvisninger til rutiner…"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCloseModalCaseId(null)}
                className="rounded-none border border-neutral-300 px-4 py-2 text-sm"
              >
                Avbryt
              </button>
              <button
                type="button"
                disabled={closeSummary.trim().length < 10}
                onClick={() => {
                  if (!closeModalCaseId) return
                  void wb.closeCase(closeModalCaseId, closeSummary).then(() => {
                    setCloseModalCaseId(null)
                    setCloseSummary('')
                  })
                }}
                className="rounded-none bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Bekreft lukking
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {whistleCasePanelId && whistleCaseOpen && pageTab === 'whistle' && wb.canAccessVault ? (
        <div
          className="fixed inset-0 z-[110] flex justify-end bg-black/45 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setWhistleCasePanelId(null)
              setWhistlePanelNote('')
            }
          }}
        >
          <div
            className="flex h-full w-full max-w-[min(100vw,920px)] flex-col border-l border-neutral-200 bg-[#f7f6f2] shadow-[-12px_0_40px_rgba(0,0,0,0.12)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="whistle-case-panel-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-200/90 bg-[#f7f6f2] px-6 py-5 sm:px-8">
              <div>
                <h2
                  id="whistle-case-panel-title"
                  className="text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl"
                  style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
                >
                  Varslingssak
                </h2>
                <p className="mt-1 text-sm font-medium text-neutral-900">{whistleCaseOpen.title}</p>
                <p className="mt-0.5 text-xs text-neutral-500">{whistleCaseOpen.category}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setWhistleCasePanelId(null)
                  setWhistlePanelNote('')
                }}
                className="rounded-none p-2 text-neutral-500 transition hover:bg-neutral-200/60"
                aria-label="Lukk"
              >
                <X className="size-6" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
              {whistleCaseOpen.description ? (
                <p className="text-sm text-neutral-700">{whistleCaseOpen.description}</p>
              ) : null}
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className={TASK_PANEL_INSET}>
                  <label className={SETTINGS_FIELD_LABEL}>Status</label>
                  <select
                    value={whistleCaseOpen.status}
                    disabled={whistleCaseOpen.status === 'closed'}
                    onChange={(e) =>
                      void wb.updateStatus(whistleCaseOpen.id, e.target.value as WhistleblowingCaseStatus)
                    }
                    className={`${TASK_PANEL_SELECT} mt-2`}
                  >
                    {(Object.keys(WHISTLE_STATUS_LABELS) as WhistleblowingCaseStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {WHISTLE_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={TASK_PANEL_INSET}>
                  <p className={SETTINGS_FIELD_LABEL}>Frist bekreftelse</p>
                  <p className="mt-2 text-sm text-neutral-800">
                    {new Date(whistleCaseOpen.acknowledgement_due_at).toLocaleDateString('no-NO')}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Mottatt:{' '}
                    {new Date(whistleCaseOpen.received_at).toLocaleString('no-NO', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
              </div>
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-neutral-900">Notater</h3>
                <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-none border border-neutral-200 bg-white p-3 text-xs text-neutral-700">
                  {(wb.notesByCase[whistleCaseOpen.id] ?? []).length === 0 ? (
                    <li className="text-neutral-400">Ingen notater ennå.</li>
                  ) : (
                    (wb.notesByCase[whistleCaseOpen.id] ?? []).map((n) => (
                      <li key={n.id} className="border-b border-neutral-100 pb-2 last:border-0">
                        <span className="text-neutral-400">
                          {new Date(n.created_at).toLocaleString('no-NO', { dateStyle: 'short' })}:{' '}
                        </span>
                        {n.body}
                      </li>
                    ))
                  )}
                </ul>
                <textarea
                  value={whistlePanelNote}
                  onChange={(e) => setWhistlePanelNote(e.target.value)}
                  rows={3}
                  placeholder="Nytt notat (lagres som ny rad)…"
                  className={`${TASK_PANEL_SELECT} mt-3`}
                />
                <button
                  type="button"
                  onClick={() => {
                    const t = whistlePanelNote.trim()
                    if (!t) return
                    void wb.appendNote(whistleCaseOpen.id, t).then(() => setWhistlePanelNote(''))
                  }}
                  className="mt-2 rounded-none bg-neutral-800 px-4 py-2 text-xs font-medium text-white"
                >
                  Legg til notat
                </button>
              </div>
              <div className="mt-8 flex flex-wrap gap-2 border-t border-neutral-200/90 pt-6">
                {whistleCaseOpen.status !== 'internal_review' && whistleCaseOpen.status !== 'closed' ? (
                  <button
                    type="button"
                    onClick={() => void wb.updateStatus(whistleCaseOpen.id, 'internal_review')}
                    className="rounded-none border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-950"
                  >
                    Intern revisjon
                  </button>
                ) : null}
                {whistleCaseOpen.status !== 'closed' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCloseModalCaseId(whistleCaseOpen.id)
                      setCloseSummary('')
                    }}
                    className="rounded-none border border-neutral-300 bg-white px-4 py-2 text-xs font-medium text-neutral-800"
                  >
                    Lukk sak
                  </button>
                ) : null}
                <AddTaskLink
                  title={`Varsling: ${whistleCaseOpen.title.slice(0, 50)}`}
                  module="general"
                  sourceType="manual"
                  sourceId={whistleCaseOpen.id}
                  sourceLabel={`Varsling ${whistleCaseOpen.id.slice(0, 8)}`}
                  ownerRole="Varslingsmottak"
                  requiresManagementSignOff
                  className="inline-flex items-center rounded-none border border-neutral-200 bg-white px-4 py-2 text-xs font-medium text-[#1a3d32]"
                >
                  Oppgave
                </AddTaskLink>
              </div>
            </div>
            <footer className="shrink-0 border-t border-neutral-200/90 bg-[#f0efe9] px-6 py-4 sm:px-8">
              <button
                type="button"
                onClick={() => {
                  setWhistleCasePanelId(null)
                  setWhistlePanelNote('')
                }}
                className="w-full rounded-none border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Lukk panel
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {whistlePanelOpen && pageTab === 'whistle' && wb.canAccessVault ? (
        <div
          className="fixed inset-0 z-[100] flex justify-end bg-black/45 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeWhistlePanel()
          }}
        >
          <div
            className="flex h-full w-full max-w-[min(100vw,920px)] flex-col bg-[#f7f6f2] shadow-[-12px_0_40px_rgba(0,0,0,0.12)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="whistle-panel-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-200/90 bg-[#f7f6f2] px-6 py-5 sm:px-8 sm:py-6">
              <h2
                id="whistle-panel-title"
                className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl"
                style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
              >
                Ny varslingssak
              </h2>
              <button
                type="button"
                onClick={closeWhistlePanel}
                className="rounded-none p-2 text-neutral-500 transition hover:bg-neutral-200/60"
                aria-label="Lukk"
              >
                <X className="size-6" />
              </button>
            </header>
            <form className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => void submitWhistleCase(e)}>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 sm:px-8">
                {wSubmitKey ? (
                  <div className="rounded-none border border-emerald-200 bg-white p-5">
                    <p className="font-medium text-emerald-900">Sak opprettet</p>
                    <p className="mt-2 text-sm text-neutral-700">
                      Saksnøkkel for varsler (hvis ikke anonym):{' '}
                      <code className="break-all text-xs">{wSubmitKey}</code>
                    </p>
                    <p className="mt-2 text-xs text-neutral-500">
                      Varsler kan sjekke status på /varsle/status med denne nøkkelen.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className={TASK_PANEL_ROW_GRID}>
                      <div>
                        <h3 className="text-base font-semibold text-neutral-900">Grunnlag</h3>
                        <p className={`${SETTINGS_LEAD} mt-2`}>
                          Beskriv kritikkverdige forhold etter virksomhetens rutiner. Feltene støtter dokumentasjon under
                          AML kap. 2A.
                        </p>
                      </div>
                      <div className={TASK_PANEL_INSET}>
                        <label className={SETTINGS_FIELD_LABEL}>Kategori</label>
                        <select
                          value={wCategory}
                          onChange={(e) => setWCategory(e.target.value)}
                          className={TASK_PANEL_SELECT}
                        >
                          {WHISTLE_CATEGORY_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <label className={`${SETTINGS_FIELD_LABEL} mt-4`}>Tittel</label>
                        <input
                          required
                          value={wTitle}
                          onChange={(e) => setWTitle(e.target.value)}
                          className={TASK_PANEL_SELECT}
                        />
                        <label className={`${SETTINGS_FIELD_LABEL} mt-4`}>Beskrivelse</label>
                        <textarea
                          required
                          rows={4}
                          value={wDesc}
                          onChange={(e) => setWDesc(e.target.value)}
                          className={TASK_PANEL_SELECT}
                        />
                      </div>
                    </div>
                    <div className="my-8 border-t border-neutral-200/90" />
                    <div className={TASK_PANEL_ROW_GRID}>
                      <div>
                        <h3 className="text-base font-semibold text-neutral-900">Hvem / hva / hvor</h3>
                        <p className={`${SETTINGS_LEAD} mt-2`}>
                          Tidsrom og involverte parter (uten å navngi unødvendig hvis du varsler anonymt).
                        </p>
                      </div>
                      <div className={TASK_PANEL_INSET}>
                        <label className={SETTINGS_FIELD_LABEL}>Hvem, hva, hvor</label>
                        <textarea rows={3} value={wWww} onChange={(e) => setWWww(e.target.value)} className={TASK_PANEL_SELECT} />
                        <label className={`${SETTINGS_FIELD_LABEL} mt-4`}>Tidspunkt (fritekst)</label>
                        <input value={wOccurred} onChange={(e) => setWOccurred(e.target.value)} className={TASK_PANEL_SELECT} />
                      </div>
                    </div>
                    <div className="my-8 border-t border-neutral-200/90" />
                    <div className={TASK_PANEL_ROW_GRID}>
                      <div>
                        <h3 className="text-base font-semibold text-neutral-900">Anonymitet og vedlegg</h3>
                        <p className={`${SETTINGS_LEAD} mt-2`}>
                          Du kan varsle anonymt. Opplasting av filer kobles til lagring i produksjon (nå: filnavn som hint).
                        </p>
                      </div>
                      <div className={TASK_PANEL_INSET}>
                        <fieldset className="space-y-2">
                          <label className="flex items-start gap-2 text-sm">
                            <input type="radio" checked={wAnonymous} onChange={() => setWAnonymous(true)} className="mt-1" />
                            <span>Anonym varsling</span>
                          </label>
                          <label className="flex items-start gap-2 text-sm">
                            <input type="radio" checked={!wAnonymous} onChange={() => setWAnonymous(false)} className="mt-1" />
                            <span>Jeg oppgir kontakt (kobles til min bruker i systemet)</span>
                          </label>
                        </fieldset>
                        {!wAnonymous ? (
                          <>
                            <label className={`${SETTINGS_FIELD_LABEL} mt-4`}>Kontakt</label>
                            <input value={wContact} onChange={(e) => setWContact(e.target.value)} className={TASK_PANEL_SELECT} />
                          </>
                        ) : null}
                        <label className={`${SETTINGS_FIELD_LABEL} mt-4`}>Vedlegg (filnavn, én per linje)</label>
                        <textarea
                          rows={2}
                          value={wFiles}
                          onChange={(e) => setWFiles(e.target.value)}
                          className={TASK_PANEL_SELECT}
                          placeholder="bevis.png"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
              <footer className="shrink-0 border-t border-neutral-200/90 bg-[#f0efe9] px-6 py-5 sm:px-8">
                {wSubmitKey ? (
                  <button
                    type="button"
                    onClick={closeWhistlePanel}
                    className="w-full rounded-none bg-[#1a3d32] px-5 py-3 text-sm font-semibold text-white"
                  >
                    Lukk
                  </button>
                ) : (
                  <>
                    <button
                      type="submit"
                      disabled={!wTitle.trim() || !wDesc.trim()}
                      className="flex w-full items-center justify-center rounded-none px-5 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-45"
                      style={{ backgroundColor: layout.accent }}
                    >
                      Registrer sak
                    </button>
                    <button
                      type="button"
                      onClick={closeWhistlePanel}
                      className="mt-3 w-full rounded-none border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700"
                    >
                      Avbryt
                    </button>
                  </>
                )}
              </footer>
            </form>
          </div>
        </div>
      ) : null}

      {taskPanelOpen && pageTab === 'list' ? (
        <div
          className="fixed inset-0 z-[100] flex justify-end bg-black/45 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeTaskPanel()
          }}
        >
          <div
            className="flex h-full w-full max-w-[min(100vw,920px)] flex-col bg-[#f7f6f2] shadow-[-12px_0_40px_rgba(0,0,0,0.12)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-panel-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-200/90 bg-[#f7f6f2] px-6 py-5 sm:px-8 sm:py-6">
              <h2
                id="task-panel-title"
                className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl"
                style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
              >
                {editingId ? 'Rediger oppgave' : 'Ny oppgave'}
              </h2>
              <button
                type="button"
                onClick={closeTaskPanel}
                className="rounded-none p-2 text-neutral-500 transition hover:bg-neutral-200/60 hover:text-neutral-800"
                aria-label="Lukk"
              >
                <X className="size-6" />
              </button>
            </header>

            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={handleSubmit}
            >
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 sm:px-8">
                <div className={TASK_PANEL_ROW_GRID}>
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">Oppgavens innhold</h3>
                    <p className={`${SETTINGS_LEAD} mt-2`}>
                      Beskriv hva som skal gjøres og hvorfor. Tydelig tittel og kontekst gjør det enklere å følge opp og
                      dokumentere etter AML og internkontroll.
                    </p>
                  </div>
                  <div className={TASK_PANEL_INSET}>
                    <p className="text-sm font-semibold text-neutral-900">
                      {title.trim() ? title.trim() : 'Uten tittel — fyll inn under'}
                    </p>
                    <div className="mt-5 space-y-4">
                      <div>
                        <label className={SETTINGS_FIELD_LABEL} htmlFor="task-panel-title-input">
                          Tittel
                        </label>
                        <input
                          id="task-panel-title-input"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          required
                          className={TASK_PANEL_SELECT}
                          placeholder="F.eks. Revider HMS-rutine"
                        />
                      </div>
                      <div>
                        <label className={SETTINGS_FIELD_LABEL} htmlFor="task-panel-desc">
                          Beskrivelse
                        </label>
                        <textarea
                          id="task-panel-desc"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          rows={4}
                          className={TASK_PANEL_SELECT}
                          placeholder="Bakgrunn, forventet resultat, lenker …"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="my-8 border-t border-neutral-200/90" />

                <div className={TASK_PANEL_ROW_GRID}>
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">Ansvar og frist</h3>
                    <p className={`${SETTINGS_LEAD} mt-2`}>
                      Velg hvem som utfører oppgaven og hvilken rolle de har i sporbarheten. Frist og eventuell
                      ledelsesgodkjenning styrer hva som kreves før lukking.
                    </p>
                  </div>
                  <div className={TASK_PANEL_INSET}>
                    <p className={SETTINGS_FIELD_LABEL}>Ansvarlig</p>
                    {assigneeEmployeeId ? (
                      <div className="mt-2 inline-flex items-center gap-2 rounded-none border border-[#1a3d32] bg-[#1a3d32] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white">
                        <span className="max-w-[220px] truncate">{assignee || 'Valgt ansatt'}</span>
                        <button
                          type="button"
                          className="shrink-0 rounded-none px-1 text-white/80 hover:text-white"
                          onClick={() => {
                            setAssigneeEmployeeId('')
                            setAssignee('')
                          }}
                          aria-label="Fjern valgt ansatt"
                        >
                          ×
                        </button>
                      </div>
                    ) : null}
                    <div className={assigneeEmployeeId ? 'mt-4' : 'mt-2'}>
                      <label className={SETTINGS_FIELD_LABEL} htmlFor="task-panel-assignee-emp">
                        Velg ansatt
                      </label>
                      <select
                        id="task-panel-assignee-emp"
                        value={assigneeEmployeeId}
                        onChange={(e) => {
                          const id = e.target.value
                          setAssigneeEmployeeId(id)
                          const emp = employeePickList.find((x) => x.id === id)
                          setAssignee(emp ? emp.name : assignee)
                          if (signerPickList.some((x) => x.id === id)) {
                            setAssigneeSignerEmployeeId(id)
                          } else {
                            setAssigneeSignerEmployeeId('')
                          }
                        }}
                        className={TASK_PANEL_SELECT}
                      >
                        <option value="">Fritekst (felt under)</option>
                        {employeePickList.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                            {e.jobTitle ? ` — ${e.jobTitle}` : ''}
                          </option>
                        ))}
                      </select>
                      {!assigneeEmployeeId ? (
                        <input
                          value={assignee}
                          onChange={(e) => setAssignee(e.target.value)}
                          className={`${TASK_PANEL_SELECT} mt-2`}
                          placeholder="Navn (hvis ikke i listen)"
                        />
                      ) : null}
                    </div>
                    <div className="mt-5">
                      <label className={SETTINGS_FIELD_LABEL} htmlFor="task-panel-owner-role">
                        Rolle i oppgaven
                      </label>
                      <select
                        id="task-panel-owner-role"
                        value={
                          (TASK_OWNER_ROLE_OPTIONS as readonly string[]).includes(ownerRole) ? ownerRole : 'Annet'
                        }
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === 'Annet') setOwnerRole('')
                          else setOwnerRole(v)
                        }}
                        className={TASK_PANEL_SELECT}
                      >
                        {TASK_OWNER_ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                        <option value="Annet">Annet (fritekst)</option>
                      </select>
                      {!(TASK_OWNER_ROLE_OPTIONS as readonly string[]).includes(ownerRole) ? (
                        <input
                          value={ownerRole}
                          onChange={(e) => setOwnerRole(e.target.value)}
                          className={`${TASK_PANEL_SELECT} mt-2`}
                          placeholder="Beskriv rolle"
                        />
                      ) : null}
                    </div>
                    <div className="mt-5">
                      <label className={SETTINGS_FIELD_LABEL} htmlFor="task-panel-due">
                        Frist
                      </label>
                      <div className="relative mt-1.5">
                        <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
                        <input
                          id="task-panel-due"
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className={`${TASK_PANEL_SELECT} pl-10`}
                        />
                      </div>
                    </div>
                    <div className="mt-6">
                      <label className={SETTINGS_FIELD_LABEL} htmlFor="task-panel-assignee-signer">
                        Signatar (utfører)
                      </label>
                      <select
                        id="task-panel-assignee-signer"
                        value={assigneeSignerEmployeeId}
                        onChange={(e) => setAssigneeSignerEmployeeId(e.target.value)}
                        className={`${TASK_PANEL_SELECT} mt-1.5`}
                        required={signerPickList.length > 0}
                      >
                        <option value="">
                          {signerPickList.length > 0 ? '— Velg signatar —' : 'Alle med e-post (ingen begrensning)'}
                        </option>
                        {signerPickList.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                            {e.email ? ` — ${e.email}` : ''}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1.5 text-xs text-neutral-500">
                        {signerPickList.length > 0
                          ? 'Kun valgt person kan signere som utfører. Listen administreres under Organisasjon → Innstillinger.'
                          : 'Når ingen godkjent liste er satt, brukes ansvarlig med e-post. Legg til godkjente signatarer for tydelig styring.'}
                      </p>
                    </div>
                    <p className={`${SETTINGS_FIELD_LABEL} mt-6`}>Godkjenning</p>
                    <div className="mt-3 space-y-3">
                      <label className="flex cursor-pointer items-start gap-3 rounded-none border border-neutral-300/80 bg-white p-3">
                        <input
                          type="radio"
                          name="task-mgmt"
                          checked={!requiresMgmt}
                          onChange={() => {
                            setRequiresMgmt(false)
                            setLeaderEmployeeId('')
                            setManagementSignerEmployeeId('')
                          }}
                          className="mt-0.5 size-4 rounded-full border-neutral-400 text-[#1a3d32] focus:ring-[#1a3d32]"
                        />
                        <span>
                          <span className="text-sm font-medium text-neutral-900">Kun signatur fra utfører</span>
                          <span className="mt-0.5 block text-xs text-neutral-500">
                            Oppgaven kan lukkes når ansvarlig har signert.
                          </span>
                        </span>
                      </label>
                      <label className="flex cursor-pointer items-start gap-3 rounded-none border border-neutral-300/80 bg-white p-3">
                        <input
                          type="radio"
                          name="task-mgmt"
                          checked={requiresMgmt}
                          onChange={() => setRequiresMgmt(true)}
                          className="mt-0.5 size-4 rounded-full border-neutral-400 text-[#1a3d32] focus:ring-[#1a3d32]"
                        />
                        <span>
                          <span className="text-sm font-medium text-neutral-900">Krever ledelses godkjenning</span>
                          <span className="mt-0.5 block text-xs text-neutral-500">
                            Leder må signere i tillegg før oppgaven regnes som fullført.
                          </span>
                        </span>
                      </label>
                    </div>
                    {requiresMgmt ? (
                      <div className="mt-4">
                        <label className={SETTINGS_FIELD_LABEL} htmlFor="task-panel-leader">
                          Leder (godkjenner)
                        </label>
                        <select
                          id="task-panel-leader"
                          value={leaderEmployeeId}
                          onChange={(e) => {
                            const id = e.target.value
                            setLeaderEmployeeId(id)
                            if (signerPickList.some((x) => x.id === id)) {
                              setManagementSignerEmployeeId(id)
                            } else {
                              setManagementSignerEmployeeId('')
                            }
                          }}
                          className={TASK_PANEL_SELECT}
                        >
                          <option value="">— Velg leder —</option>
                          {leaderCandidates.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name}
                              {e.jobTitle ? ` — ${e.jobTitle}` : ''}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1.5 text-xs italic text-neutral-500">
                          Listen prioriterer roller og titler med «leder». Alle ansatte vises dersom ingen treff.
                        </p>
                        <div className="mt-4">
                          <label className={SETTINGS_FIELD_LABEL} htmlFor="task-panel-mgmt-signer">
                            Signatar (leder)
                          </label>
                          <select
                            id="task-panel-mgmt-signer"
                            value={managementSignerEmployeeId}
                            onChange={(e) => setManagementSignerEmployeeId(e.target.value)}
                            className={`${TASK_PANEL_SELECT} mt-1.5`}
                            required={signerPickList.length > 0}
                          >
                            <option value="">
                              {signerPickList.length > 0 ? '— Velg leder-signatar —' : 'Samme som valgt leder over'}
                            </option>
                            {signerPickList.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.name}
                                {e.email ? ` — ${e.email}` : ''}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1.5 text-xs text-neutral-500">
                            Den som skal motta påminnelsesoppgave og signere som leder (vanligvis samme som godkjenner
                            over).
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                {editingId && taskBeingEdited ? (
                  <>
                    <div className="my-8 border-t border-neutral-200/90" />
                    <div className={TASK_PANEL_ROW_GRID}>
                      <div>
                        <h3 className="text-base font-semibold text-neutral-900">Status og signatur</h3>
                        <p className={`${SETTINGS_LEAD} mt-2`}>
                          Signatur bruker innlogget bruker. Hvem som kan signere styres av «Signatar»-feltene i
                          skjemaet (godkjente personer under Organisasjon → Innstillinger). E-post på profilen må
                          samsvare med signatarens e-post. Nivå 1 loggføres når Supabase er konfigurert.
                        </p>
                      </div>
                      <div className={TASK_PANEL_INSET}>
                        <div>
                          <label className={SETTINGS_FIELD_LABEL} htmlFor="task-panel-status">
                            Status
                          </label>
                          <select
                            id="task-panel-status"
                            value={taskBeingEdited.status}
                            onChange={(e) => setStatus(taskBeingEdited.id, e.target.value as TaskStatus)}
                            className={TASK_PANEL_SELECT}
                          >
                            {(Object.keys(statusLabels) as TaskStatus[]).map((s) => (
                              <option key={s} value={s}>
                                {statusLabels[s]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="mt-5 space-y-2 text-xs">
                          <div className="whitespace-pre-line text-neutral-700">
                            <span className="font-medium text-neutral-500">Utfører: </span>
                            {formatSig(taskBeingEdited.assigneeSignature) ?? (
                              <span className="text-amber-700">Ikke signert</span>
                            )}
                          </div>
                          {taskBeingEdited.requiresManagementSignOff ? (
                            <div className="whitespace-pre-line text-neutral-700">
                              <span className="font-medium text-neutral-500">Leder: </span>
                              {formatSig(taskBeingEdited.managementSignature) ?? (
                                <span className="text-amber-700">Mangler</span>
                              )}
                            </div>
                          ) : null}
                        </div>
                        {signUi?.mode === 'cosign_reminder' ? (
                          <div className="mt-5 space-y-3 rounded-none border border-amber-200/90 bg-amber-50/80 p-4 text-xs text-amber-950">
                            <p className="font-medium">
                              Påminnelse om medsignatur
                              {signUi.parentTitle ? ` for «${signUi.parentTitle}»` : ''}.
                            </p>
                            {signUi.missingAssigneeOnParent ? (
                              <p>Hovedoppgaven er ikke signert av utfører ennå.</p>
                            ) : signUi.canSignParent ? (
                              <p>Du er innlogget som leder som skal godkjenne. Bruk knappen under.</p>
                            ) : (
                              <p>Logg inn som valgt leder (samme e-post som på ansattkortet) for å signere.</p>
                            )}
                          </div>
                        ) : signUi ? (
                          <div className="mt-5 space-y-2 text-xs text-neutral-600">
                            {!userSignerEmail ? (
                              <p className="text-amber-800">Profilen din mangler e-post — signatur er ikke tilgjengelig.</p>
                            ) : null}
                            {signUi.missingAssigneeEmail ? (
                              <p className="text-amber-800">
                                Ansvarlig mangler e-post i organisasjonen. Oppdater ansatt eller velg en annen.
                              </p>
                            ) : null}
                            {signUi.missingLeaderEmail ? (
                              <p className="text-amber-800">
                                Leder mangler e-post i organisasjonen. Oppdater ansatt eller velg en annen leder.
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="mt-4 flex flex-wrap gap-2">
                          {signUi?.mode === 'cosign_reminder' ? (
                            <button
                              type="button"
                              disabled={!signUi.canSignParent}
                              className="rounded-none bg-[#1a3d32] px-4 py-2 text-xs font-medium text-white hover:bg-[#142e26] disabled:cursor-not-allowed disabled:opacity-50"
                              onClick={() => {
                                void (async () => {
                                  await signManagement(taskBeingEdited.id)
                                })()
                              }}
                            >
                              Signer som leder (hovedoppgave)
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={!signUi?.canSignAssignee}
                                className="rounded-none bg-[#1a3d32] px-4 py-2 text-xs font-medium text-white hover:bg-[#142e26] disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={() => {
                                  void (async () => {
                                    await signAsAssignee(taskBeingEdited.id)
                                  })()
                                }}
                              >
                                Signer utfører
                              </button>
                              {taskBeingEdited.requiresManagementSignOff ? (
                                <button
                                  type="button"
                                  disabled={!signUi?.canSignMgmt}
                                  className="rounded-none border border-neutral-300 bg-white px-4 py-2 text-xs font-medium text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  onClick={() => {
                                    void (async () => {
                                      await signManagement(taskBeingEdited.id)
                                    })()
                                  }}
                                >
                                  Ledelsessignatur
                                </button>
                              ) : null}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}

                <div className="my-8 border-t border-neutral-200/90" />

                <div className={TASK_PANEL_ROW_GRID}>
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">Opprinnelse i løsningen</h3>
                    <p className={`${SETTINGS_LEAD} mt-2`}>
                      Koble oppgaven til modul og kilde slik at sporbarhet og rapporter stemmer på tvers av workspace,
                      råd, HMS og læring.
                    </p>
                  </div>
                  <div className={TASK_PANEL_INSET}>
                    <div>
                      <label className={SETTINGS_FIELD_LABEL} htmlFor="task-panel-module">
                        Modul
                      </label>
                      <select
                        id="task-panel-module"
                        value={formModule}
                        onChange={(e) => setFormModule(e.target.value as TaskModule)}
                        className={TASK_PANEL_SELECT}
                      >
                        {(Object.keys(MODULE_LABELS) as TaskModule[]).map((m) => (
                          <option key={m} value={m}>
                            {MODULE_LABELS[m]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-5">
                      <label className={SETTINGS_FIELD_LABEL} htmlFor="task-panel-source">
                        Kilde
                      </label>
                      <select
                        id="task-panel-source"
                        value={formSource}
                        onChange={(e) => setFormSource(e.target.value as TaskSourceType)}
                        className={TASK_PANEL_SELECT}
                      >
                        <option value="manual">Manuell</option>
                        <option value="council_meeting">Rådsmøte</option>
                        <option value="council_compliance">Samsvar (råd)</option>
                        <option value="representatives">Representasjon</option>
                        <option value="survey">Undersøkelse</option>
                        <option value="hse_safety_round">Vernerunde</option>
                        <option value="hse_inspection">HMS-inspeksjon</option>
                        <option value="hse_inspection_finding">Inspeksjonsavvik</option>
                        <option value="hse_incident">Hendelse</option>
                        <option value="nav_report">Sykefravær/NAV</option>
                        <option value="labor_metric">AML-indikator</option>
                        <option value="learning_course">Læringskurs</option>
                      </select>
                    </div>
                    <div className="mt-5">
                      <label className={SETTINGS_FIELD_LABEL}>Kilde-ID og merkelapp</label>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <input
                          value={sourceId}
                          onChange={(e) => setSourceId(e.target.value)}
                          className={`${TASK_PANEL_SELECT} w-full min-w-[6rem] sm:w-32`}
                          placeholder="ID"
                        />
                        <input
                          value={sourceLabel}
                          onChange={(e) => setSourceLabel(e.target.value)}
                          className={`${TASK_PANEL_SELECT} min-w-0 flex-1`}
                          placeholder="F.eks. møtetittel"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {!editingId ? (
                  <div className="mt-10 border-t border-neutral-200/90 pt-8">
                    <WizardButton
                      label="Start veiviser (hurtigutfylling)"
                      variant="outline"
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
                        closeTaskPanel()
                      })}
                      className="w-full justify-center rounded-none border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
                    />
                  </div>
                ) : null}
              </div>

              <footer className="shrink-0 border-t border-neutral-200/90 bg-[#f0efe9] px-6 py-5 sm:px-8">
                <button
                  type="submit"
                  disabled={!title.trim()}
                  className="flex w-full items-center justify-center rounded-none px-5 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] text-white transition disabled:cursor-not-allowed disabled:opacity-45"
                  style={{ backgroundColor: layout.accent }}
                >
                  {editingId ? 'Lagre oppgave' : 'Opprett oppgave'}
                </button>
                <button
                  type="button"
                  onClick={closeTaskPanel}
                  className="mt-3 w-full rounded-none border border-neutral-300 bg-transparent px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-200/40"
                >
                  Avbryt
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
