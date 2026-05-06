import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ClipboardList,
  KanbanSquare,
  LayoutGrid,
  Plus,
  Settings,
  Users,
  Workflow,
} from 'lucide-react'
import { ModuleLegalBanner, ModulePageShell } from '../../src/components/module'
import { Tabs, type TabItem } from '../../src/components/ui/Tabs'
import { Button } from '../../src/components/ui/Button'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import { StandardInput } from '../../src/components/ui/Input'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { YesNoToggle } from '../../src/components/ui/FormToggles'
import { WarningBox } from '../../src/components/ui/AlertBox'
import { SlidePanel } from '../../src/components/layout/SlidePanel'
import { WPSTD_FORM_FIELD_LABEL } from '../../src/components/layout/WorkplaceStandardFormPanel'
import { useTasks } from '../../src/hooks/useTasks'
import { useOrganisation } from '../../src/hooks/useOrganisation'
import { TASK_OWNER_ROLE_OPTIONS } from '../../src/lib/taskFormOptions'
import { MODULE_LABELS } from '../../src/lib/taskNavigation'
import type { TaskModule, TaskStatus } from '../../src/types/task'
import { TASK_MODULE_LEGAL_REFERENCES } from './taskLegalReferences'
import { TasksOverviewTab } from './tabs/TasksOverviewTab'
import { TasksKanbanTab } from './tabs/TasksKanbanTab'
import { TasksListTab } from './tabs/TasksListTab'
import { TasksPlanningTab } from './tabs/TasksPlanningTab'
import { TasksCollaborationTab } from './tabs/TasksCollaborationTab'
import { TaskDetailPanel } from './TaskDetailPanel'
import { useTaskExtensions } from './useTaskExtensions'
import { TASK_PRIORITY_OPTIONS, type TaskPriority } from './types'

type ModuleTab = 'oversikt' | 'tavle' | 'liste' | 'planlegging' | 'samarbeid'

const TAB_IDS: ReadonlyArray<ModuleTab> = ['oversikt', 'tavle', 'liste', 'planlegging', 'samarbeid']

const MODULE_OPTIONS: ReadonlyArray<{ value: TaskModule; label: string }> = (
  Object.keys(MODULE_LABELS) as TaskModule[]
).map((value) => ({ value, label: MODULE_LABELS[value] }))

/**
 * Comprehensive task management module.
 *
 * Wraps the existing signed `useTasks` store with planning + collaboration
 * extensions, surfaced through five tabs (Oversikt / Tavle / Liste /
 * Planlegging / Samarbeid). Layout, typography and colour tokens come from
 * Survey / Documents (`ModulePageShell`, `Tabs`, `ModuleSectionCard`,
 * `LayoutScoreStatRow`, `SlidePanel`, …) so the module fits seamlessly into
 * the rest of Klarert without introducing a parallel design language.
 */
export function TasksManagementPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tasksApi = useTasks()
  const ext = useTaskExtensions(tasksApi.tasks)
  const org = useOrganisation()

  const tabFromUrl = (searchParams.get('tab') as ModuleTab | null) ?? null
  const initialTab: ModuleTab = TAB_IDS.includes(tabFromUrl as ModuleTab) ? (tabFromUrl as ModuleTab) : 'oversikt'
  const [tab, setTab] = useState<ModuleTab>(initialTab)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  // Create-task draft local state.
  const [draft, setDraft] = useState<DraftTask>(emptyDraft())

  const moduleTabs: TabItem[] = useMemo(() => {
    const open = tasksApi.tasks.filter((t) => t.status !== 'done').length
    return [
      { id: 'oversikt', label: 'Oversikt', icon: LayoutGrid },
      { id: 'tavle', label: 'Tavle', icon: KanbanSquare, badgeCount: open || undefined },
      { id: 'liste', label: 'Liste', icon: ClipboardList },
      { id: 'planlegging', label: 'Planlegging', icon: Workflow, badgeCount: ext.projects.length || undefined },
      { id: 'samarbeid', label: 'Samarbeid', icon: Users },
    ]
  }, [tasksApi.tasks, ext.projects.length])

  const selectedTask = useMemo(
    () => tasksApi.tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasksApi.tasks, selectedTaskId],
  )

  const employeeOptions = useMemo(
    () => [
      { value: '', label: 'Ikke tilknyttet ansatt' },
      ...org.displayEmployees.map((e) => ({ value: e.id, label: e.name })),
    ],
    [org.displayEmployees],
  )

  const onChangeTab = useCallback(
    (next: ModuleTab) => {
      setTab(next)
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('tab', next)
          return p
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const openTask = useCallback((taskId: string) => setSelectedTaskId(taskId), [])
  const closeTask = useCallback(() => setSelectedTaskId(null), [])

  const handleCreate = useCallback(() => {
    if (!draft.title.trim()) return
    const employeeName = draft.assigneeEmployeeId
      ? org.displayEmployees.find((e) => e.id === draft.assigneeEmployeeId)?.name ?? ''
      : draft.assigneeName
    const created = tasksApi.addTask({
      title: draft.title.trim(),
      description: draft.description.trim(),
      status: 'todo',
      assignee: employeeName.trim() || 'Unassigned',
      assigneeEmployeeId: draft.assigneeEmployeeId || undefined,
      ownerRole: draft.ownerRole,
      leaderEmployeeId: draft.leaderEmployeeId || undefined,
      dueDate: draft.dueDate.trim() || '—',
      module: draft.module,
      sourceType: 'manual',
      requiresManagementSignOff: draft.requiresMgmt,
    })
    ext.upsertExtension(created.id, {
      priority: draft.priority,
      labels: [],
      dependsOn: [],
      watchers: [],
      comments: [],
      subtasks: [],
      projectId: draft.projectId || undefined,
    })
    setDraft(emptyDraft())
    setCreateOpen(false)
    onChangeTab('tavle')
    setSelectedTaskId(created.id)
  }, [draft, tasksApi, ext, org.displayEmployees, onChangeTab])

  return (
    <>
      <ModulePageShell
        breadcrumb={[{ label: 'Arbeidsflate' }, { label: 'Oppgavestyring' }]}
        title="Oppgavestyring"
        description="Komplett oppfølging av oppgaver og tiltak — Kanban, sprint og faseplan i ett — med innebygd samsvar mot AML og IK-forskriften."
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              icon={<Settings className="h-4 w-4" />}
              onClick={() => navigate('/tasks?view=audit')}
            >
              <span className="hidden sm:inline">Revisjonslogg</span>
            </Button>
            <Button
              type="button"
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setCreateOpen(true)}
            >
              Ny oppgave
            </Button>
          </div>
        }
        tabs={
          <Tabs
            className="w-full md:w-auto"
            overflow="scroll"
            items={moduleTabs}
            activeId={tab}
            onChange={(id) => onChangeTab(id as ModuleTab)}
          />
        }
      >
        <ModuleLegalBanner
          title="Oppgavestyring i tråd med arbeidsmiljøloven"
          intro={
            <p>
              Hver oppgave er en sporbar del av det systematiske HMS-arbeidet. Modulen knytter
              ansvarlig, frist, prioritet og signatur til regelverk som AML § 3-1, § 4-1 og
              IK-forskriften § 5 — slik at oppfølging dokumenteres uten ekstra arbeid.
            </p>
          }
          references={TASK_MODULE_LEGAL_REFERENCES}
        />

        {tasksApi.error ? <WarningBox>{tasksApi.error}</WarningBox> : null}

        {tab === 'oversikt' && (
          <TasksOverviewTab
            tasks={tasksApi.tasks}
            ext={ext}
            onOpenTask={openTask}
            onJumpToBoard={() => onChangeTab('tavle')}
          />
        )}

        {tab === 'tavle' && (
          <TasksKanbanTab
            tasks={tasksApi.tasks}
            ext={ext}
            onSetStatus={(id, status) => tasksApi.setStatus(id, status as TaskStatus)}
            onOpenTask={openTask}
          />
        )}

        {tab === 'liste' && <TasksListTab tasks={tasksApi.tasks} ext={ext} onOpenTask={openTask} />}

        {tab === 'planlegging' && <TasksPlanningTab tasks={tasksApi.tasks} ext={ext} onOpenTask={openTask} />}

        {tab === 'samarbeid' && (
          <TasksCollaborationTab tasks={tasksApi.tasks} ext={ext} onOpenTask={openTask} />
        )}
      </ModulePageShell>

      <TaskDetailPanel
        open={selectedTaskId !== null}
        task={selectedTask}
        ext={ext}
        onClose={closeTask}
        onSetStatus={(id, status) => tasksApi.setStatus(id, status as TaskStatus)}
        onDelete={(id) => tasksApi.deleteTask(id)}
        onSignAsAssignee={(id) => tasksApi.signAsAssignee(id)}
        onSignManagement={(id) => tasksApi.signManagement(id)}
      />

      <SlidePanel
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Ny oppgave"
        titleId="task-create-panel"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Avbryt
            </Button>
            <Button
              type="button"
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={handleCreate}
              disabled={!draft.title.trim()}
            >
              Opprett
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="task-title">
              Tittel <span className="text-red-500">*</span>
            </label>
            <StandardInput
              id="task-title"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="F.eks. Følg opp risikovurdering avd. lager"
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="task-desc">
              Beskrivelse
            </label>
            <StandardTextarea
              id="task-desc"
              rows={3}
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="Hva må gjøres, hvorfor, og hvem skal informeres?"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <span className={WPSTD_FORM_FIELD_LABEL}>Modul</span>
              <SearchableSelect
                value={draft.module}
                options={MODULE_OPTIONS}
                onChange={(v) => setDraft((d) => ({ ...d, module: v as TaskModule }))}
              />
            </div>
            <div>
              <span className={WPSTD_FORM_FIELD_LABEL}>Prioritet</span>
              <SearchableSelect
                value={draft.priority}
                options={TASK_PRIORITY_OPTIONS.map((p) => ({ value: p.value, label: p.label }))}
                onChange={(v) => setDraft((d) => ({ ...d, priority: v as TaskPriority }))}
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <span className={WPSTD_FORM_FIELD_LABEL}>Ansvarlig (ansatt)</span>
              <SearchableSelect
                value={draft.assigneeEmployeeId}
                options={employeeOptions}
                onChange={(v) => setDraft((d) => ({ ...d, assigneeEmployeeId: v }))}
                placeholder="Velg ansvarlig"
              />
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="task-assignee-name">
                Eller fri tekst
              </label>
              <StandardInput
                id="task-assignee-name"
                value={draft.assigneeName}
                onChange={(e) => setDraft((d) => ({ ...d, assigneeName: e.target.value }))}
                placeholder="Navn — brukes hvis ansatt ikke er valgt"
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <span className={WPSTD_FORM_FIELD_LABEL}>Rolle</span>
              <SearchableSelect
                value={draft.ownerRole}
                options={TASK_OWNER_ROLE_OPTIONS.map((r) => ({ value: r, label: r }))}
                onChange={(v) => setDraft((d) => ({ ...d, ownerRole: v }))}
              />
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="task-due">
                Frist
              </label>
              <StandardInput
                id="task-due"
                type="date"
                value={draft.dueDate}
                onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <span className={WPSTD_FORM_FIELD_LABEL}>Leder (godkjenner)</span>
              <SearchableSelect
                value={draft.leaderEmployeeId}
                options={employeeOptions}
                onChange={(v) => setDraft((d) => ({ ...d, leaderEmployeeId: v }))}
                placeholder="Valgfritt — kreves ved medsignatur"
              />
            </div>
            <div>
              <span className={WPSTD_FORM_FIELD_LABEL}>Prosjekt</span>
              <SearchableSelect
                value={draft.projectId}
                options={[{ value: '', label: 'Uten prosjekt' }, ...ext.projects.map((p) => ({ value: p.id, label: p.name }))]}
                onChange={(v) => setDraft((d) => ({ ...d, projectId: v }))}
              />
            </div>
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Krever ledersignatur (AML § 4-1)</span>
            <p className="mb-2 text-xs text-neutral-500">
              Brukes når oppgaven gjelder risikoreduserende tiltak som må verifiseres av ledelsen.
            </p>
            <YesNoToggle
              value={draft.requiresMgmt}
              onChange={(v) => setDraft((d) => ({ ...d, requiresMgmt: v }))}
            />
          </div>
        </div>
      </SlidePanel>
    </>
  )
}

type DraftTask = {
  title: string
  description: string
  module: TaskModule
  priority: TaskPriority
  assigneeEmployeeId: string
  assigneeName: string
  ownerRole: string
  leaderEmployeeId: string
  dueDate: string
  projectId: string
  requiresMgmt: boolean
}

function emptyDraft(): DraftTask {
  return {
    title: '',
    description: '',
    module: 'general',
    priority: 'medium',
    assigneeEmployeeId: '',
    assigneeName: '',
    ownerRole: 'Ansvarlig',
    leaderEmployeeId: '',
    dueDate: '',
    projectId: '',
    requiresMgmt: false,
  }
}
