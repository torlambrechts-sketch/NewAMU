import { useCallback, useMemo, useState } from 'react'
import { CalendarRange, Flag, Folder, Plus, Trash2 } from 'lucide-react'
import { ModuleSectionCard } from '../../../src/components/module'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { WPSTD_FORM_FIELD_LABEL } from '../../../src/components/layout/WorkplaceStandardFormPanel'
import { SlidePanel } from '../../../src/components/layout/SlidePanel'
import type { Task, TaskStatus } from '../../../src/types/task'
import {
  formatDueDate,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  isOverdue,
  TASK_PRIORITY_LABELS,
  priorityBadgeVariant,
  statusBadgeVariant,
} from '../taskUiHelpers'
import { TASK_METHODOLOGY_OPTIONS, type TaskMethodology, type TaskMilestone, type TaskProject } from '../types'
import type { UseTaskExtensions } from '../useTaskExtensions'

type Props = {
  tasks: Task[]
  ext: UseTaskExtensions
  onOpenTask: (taskId: string) => void
}

/**
 * Project planning tab — supports Kanban / Scrum / Waterfall methodologies.
 * Renders a milestone-aligned timeline (Gantt-light) per project, plus
 * per-status task counts so PMs can monitor flow without leaving Klarert.
 */
export function TasksPlanningTab({ tasks, ext, onOpenTask }: Props) {
  const [creatingProject, setCreatingProject] = useState(false)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>(emptyProjectDraft())
  const [milestoneDraft, setMilestoneDraft] = useState<MilestoneDraft>({ name: '', dueDate: '' })

  const projects = ext.projects
  const milestonesByProject = useMemo(() => {
    const map = new Map<string, TaskMilestone[]>()
    for (const m of ext.milestones) {
      const arr = map.get(m.projectId) ?? []
      arr.push(m)
      map.set(m.projectId, arr)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    }
    return map
  }, [ext.milestones])

  const tasksByProject = useMemo(() => {
    const out = new Map<string, Task[]>()
    for (const task of tasks) {
      const projectId = ext.taskExtensionMap.get(task.id)?.projectId
      if (!projectId) continue
      const arr = out.get(projectId) ?? []
      arr.push(task)
      out.set(projectId, arr)
    }
    return out
  }, [tasks, ext.taskExtensionMap])

  const startCreate = useCallback(() => {
    setProjectDraft(emptyProjectDraft())
    setCreatingProject(true)
  }, [])

  const handleCreateProject = useCallback(() => {
    if (!projectDraft.name.trim()) return
    ext.createProject({
      name: projectDraft.name.trim(),
      description: projectDraft.description.trim(),
      methodology: projectDraft.methodology,
      memberEmployeeIds: [],
      wipLimits: {
        in_progress: parseLimit(projectDraft.wipInProgress),
      },
      sprintLengthDays:
        projectDraft.methodology === 'scrum' && projectDraft.sprintLengthDays
          ? Number(projectDraft.sprintLengthDays)
          : undefined,
      startDate: projectDraft.startDate || undefined,
      endDate: projectDraft.endDate || undefined,
    })
    setCreatingProject(false)
  }, [projectDraft, ext])

  const handleAddMilestone = useCallback(
    (projectId: string) => {
      const name = milestoneDraft.name.trim()
      const dueDate = milestoneDraft.dueDate.trim()
      if (!name || !dueDate) return
      ext.createMilestone({ projectId, name, dueDate })
      setMilestoneDraft({ name: '', dueDate: '' })
    },
    [ext, milestoneDraft],
  )

  return (
    <div className="space-y-4">
      <ModuleSectionCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-neutral-800">Prosjekter og milepæler</h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Velg metodikk per prosjekt — tavlen og listene viser bare oppgaver knyttet til valgt prosjekt.
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={startCreate}
          >
            Nytt prosjekt
          </Button>
        </div>
      </ModuleSectionCard>

      {projects.length === 0 ? (
        <ModuleSectionCard className="p-8 text-center">
          <Folder className="mx-auto h-10 w-10 text-neutral-300" aria-hidden />
          <p className="mt-3 text-sm font-medium text-neutral-800">
            Ingen prosjekter er opprettet enda
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Et prosjekt grupperer relaterte oppgaver, milepæler og WIP-grenser. Bruk Kanban for løpende
            oppfølging, Scrum for sprintbasert leveranse, eller Faseplan (Waterfall) for større tiltak
            etter IK-forskriften § 5 nr. 7.
          </p>
        </ModuleSectionCard>
      ) : (
        <div className="space-y-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              milestones={milestonesByProject.get(project.id) ?? []}
              tasks={tasksByProject.get(project.id) ?? []}
              ext={ext}
              expanded={activeProjectId === project.id}
              onToggle={() => setActiveProjectId((cur) => (cur === project.id ? null : project.id))}
              onOpenTask={onOpenTask}
              onDelete={() => {
                if (window.confirm(`Slett prosjekt «${project.name}»?`)) ext.deleteProject(project.id)
              }}
              milestoneDraft={milestoneDraft}
              onMilestoneDraftChange={setMilestoneDraft}
              onAddMilestone={handleAddMilestone}
              onDeleteMilestone={(id) => ext.deleteMilestone(id)}
            />
          ))}
        </div>
      )}

      <SlidePanel
        open={creatingProject}
        onClose={() => setCreatingProject(false)}
        title="Nytt prosjekt"
        titleId="tasks-create-project"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreatingProject(false)}>
              Avbryt
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleCreateProject}
              disabled={!projectDraft.name.trim()}
              icon={<Plus className="h-4 w-4" />}
            >
              Opprett
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="proj-name">
              Prosjektnavn <span className="text-red-500">*</span>
            </label>
            <StandardInput
              id="proj-name"
              value={projectDraft.name}
              onChange={(e) => setProjectDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="F.eks. HMS-tiltak Q2 2026"
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="proj-desc">
              Beskrivelse
            </label>
            <StandardTextarea
              id="proj-desc"
              rows={3}
              value={projectDraft.description}
              onChange={(e) => setProjectDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="Mål og kontekst for prosjektet"
            />
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Metodikk</span>
            <div className="mt-1.5 grid gap-2 md:grid-cols-3">
              {TASK_METHODOLOGY_OPTIONS.map((opt) => {
                const active = projectDraft.methodology === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setProjectDraft((d) => ({ ...d, methodology: opt.value }))}
                    className={`rounded-md border p-3 text-left transition-colors ${
                      active
                        ? 'border-[#1a3d32] bg-emerald-50 text-emerald-900'
                        : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">{opt.sub}</p>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="proj-start">
                Startdato
              </label>
              <StandardInput
                id="proj-start"
                type="date"
                value={projectDraft.startDate}
                onChange={(e) => setProjectDraft((d) => ({ ...d, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="proj-end">
                Sluttdato
              </label>
              <StandardInput
                id="proj-end"
                type="date"
                value={projectDraft.endDate}
                onChange={(e) => setProjectDraft((d) => ({ ...d, endDate: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="proj-wip">
                WIP-grense (Pågår)
              </label>
              <StandardInput
                id="proj-wip"
                type="number"
                min={0}
                value={projectDraft.wipInProgress}
                onChange={(e) => setProjectDraft((d) => ({ ...d, wipInProgress: e.target.value }))}
                placeholder="F.eks. 5"
              />
            </div>
            {projectDraft.methodology === 'scrum' ? (
              <div>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="proj-sprint">
                  Sprintlengde (dager)
                </label>
                <StandardInput
                  id="proj-sprint"
                  type="number"
                  min={1}
                  value={projectDraft.sprintLengthDays}
                  onChange={(e) =>
                    setProjectDraft((d) => ({ ...d, sprintLengthDays: e.target.value }))
                  }
                  placeholder="14"
                />
              </div>
            ) : null}
          </div>
        </div>
      </SlidePanel>
    </div>
  )
}

type ProjectCardProps = {
  project: TaskProject
  milestones: TaskMilestone[]
  tasks: Task[]
  ext: UseTaskExtensions
  expanded: boolean
  onToggle: () => void
  onOpenTask: (taskId: string) => void
  onDelete: () => void
  milestoneDraft: MilestoneDraft
  onMilestoneDraftChange: (m: MilestoneDraft) => void
  onAddMilestone: (projectId: string) => void
  onDeleteMilestone: (milestoneId: string) => void
}

function ProjectCard({
  project,
  milestones,
  tasks,
  ext,
  expanded,
  onToggle,
  onOpenTask,
  onDelete,
  milestoneDraft,
  onMilestoneDraftChange,
  onAddMilestone,
  onDeleteMilestone,
}: ProjectCardProps) {
  const counts = useMemo(() => {
    const c: Record<TaskStatus, number> = { todo: 0, in_progress: 0, done: 0 }
    for (const t of tasks) c[t.status] += 1
    return c
  }, [tasks])

  const overdueCount = useMemo(() => tasks.filter((t) => isOverdue(t)).length, [tasks])
  const methodologyLabel = TASK_METHODOLOGY_OPTIONS.find((o) => o.value === project.methodology)?.label ?? project.methodology

  return (
    <ModuleSectionCard className="p-5">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-wrap items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-neutral-900">{project.name}</span>
            <Badge variant="info">{methodologyLabel}</Badge>
            {overdueCount > 0 ? <Badge variant="critical">{overdueCount} forfalt</Badge> : null}
          </div>
          {project.description ? (
            <p className="mt-1 max-w-3xl text-sm text-neutral-500">{project.description}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-neutral-500">
            {project.startDate ? <span>Start: {formatDueDate(project.startDate)}</span> : null}
            {project.endDate ? <span>Slutt: {formatDueDate(project.endDate)}</span> : null}
            <span>Oppgaver: {tasks.length}</span>
            <span>Milepæler: {milestones.length}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-neutral-600">
          {TASK_STATUS_ORDER.map((status) => (
            <div key={status} className="text-right">
              <span className="block text-[10px] uppercase tracking-wider text-neutral-500">
                {TASK_STATUS_LABELS[status]}
              </span>
              <span className="text-base font-semibold text-neutral-900">{counts[status]}</span>
            </div>
          ))}
        </div>
      </button>

      {expanded ? (
        <div className="mt-5 space-y-5 border-t border-neutral-200 pt-5">
          <section>
            <header className="mb-2 flex items-center justify-between gap-3">
              <h4 className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-700">
                <Flag className="h-3.5 w-3.5" aria-hidden /> Milepæler
              </h4>
              <Button
                type="button"
                variant="danger"
                size="sm"
                icon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={onDelete}
              >
                Slett prosjekt
              </Button>
            </header>
            {milestones.length === 0 ? (
              <p className="text-xs text-neutral-500">Ingen milepæler — bruk skjemaet under for å legge til.</p>
            ) : (
              <ul className="space-y-1.5">
                {milestones.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white p-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-900">{m.name}</p>
                      {m.description ? (
                        <p className="text-xs text-neutral-500">{m.description}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-neutral-600">
                      <span className="inline-flex items-center gap-1">
                        <CalendarRange className="h-3 w-3" aria-hidden /> {formatDueDate(m.dueDate)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeleteMilestone(m.id)}
                        className="text-neutral-400 hover:text-red-600"
                        aria-label="Slett milepæl"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[10rem]">
                <label className={WPSTD_FORM_FIELD_LABEL}>Milepælsnavn</label>
                <StandardInput
                  value={milestoneDraft.name}
                  onChange={(e) => onMilestoneDraftChange({ ...milestoneDraft, name: e.target.value })}
                  placeholder="F.eks. Risikovurdering ferdig"
                />
              </div>
              <div className="w-44">
                <label className={WPSTD_FORM_FIELD_LABEL}>Frist</label>
                <StandardInput
                  type="date"
                  value={milestoneDraft.dueDate}
                  onChange={(e) => onMilestoneDraftChange({ ...milestoneDraft, dueDate: e.target.value })}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => onAddMilestone(project.id)}
                disabled={!milestoneDraft.name.trim() || !milestoneDraft.dueDate.trim()}
              >
                Legg til milepæl
              </Button>
            </div>
          </section>

          {tasks.length > 0 ? (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-700">
                Oppgaver i prosjektet
              </h4>
              <ul className="space-y-1.5">
                {tasks.map((task) => {
                  const tExt = ext.taskExtensionMap.get(task.id)
                  return (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => onOpenTask(task.id)}
                        className="flex w-full flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-200 bg-white p-2.5 text-left hover:bg-neutral-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-neutral-900">{task.title}</p>
                          <p className="text-xs text-neutral-500">
                            Ansvarlig: {task.assignee} · Frist: {formatDueDate(task.dueDate)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {tExt ? (
                            <Badge variant={priorityBadgeVariant(tExt.priority)}>
                              {TASK_PRIORITY_LABELS[tExt.priority]}
                            </Badge>
                          ) : null}
                          <Badge variant={statusBadgeVariant(task.status)}>
                            {TASK_STATUS_LABELS[task.status]}
                          </Badge>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </ModuleSectionCard>
  )
}

type ProjectDraft = {
  name: string
  description: string
  methodology: TaskMethodology
  startDate: string
  endDate: string
  wipInProgress: string
  sprintLengthDays: string
}

type MilestoneDraft = { name: string; dueDate: string }

function emptyProjectDraft(): ProjectDraft {
  return {
    name: '',
    description: '',
    methodology: 'kanban',
    startDate: '',
    endDate: '',
    wipInProgress: '',
    sprintLengthDays: '14',
  }
}

function parseLimit(raw: string): number | undefined {
  if (!raw.trim()) return undefined
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return undefined
  return Math.floor(n)
}
