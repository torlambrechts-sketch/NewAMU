// PlanningPage — toppside for /planlegging.
//
// IA:
//   Strategi & OKR     — Ambisjon + OKR-tre + RACI
//   Kadens-planlegger  — 4-stegs veiviser som genererer rutiner i task_items
//   Oppgaver & prosjekter — Kanban / Liste / Tidslinje / Prosjekter
//
// Tab-state holdes i ?section=... slik at delte lenker lander rett i riktig
// fane. Hver seksjon har sin egen subkomponent (PlanningStrategiSection,
// PlanningKadensSection, PlanningOversiktSection).
//
// Bruker ModulePageShell for å arve standard chrome (header, breadcrumb,
// max-width).

import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Inbox,
  KanbanSquare,
  ListChecks,
  Plus,
  Share2,
  Target,
  Wand2,
} from 'lucide-react'
import { ModulePageShell } from '../../components/module/ModulePageShell'
import { Button } from '../../components/ui/Button'
import { usePlanningOkr } from '../../hooks/usePlanningOkr'
import { usePlanningTasks } from '../../hooks/usePlanningTasks'
import { useTaskProjects } from '../../../modules/tasks/useTaskProjects'
import { PlanningStrategiSection } from './PlanningStrategiSection'
import { PlanningKadensSection } from './PlanningKadensSection'
import { PlanningOversiktSection } from './PlanningOversiktSection'
import { PlanningCreateTaskModal } from './PlanningCreateTaskModal'
import { PlanningCreateProjectModal } from './PlanningCreateProjectModal'
import type { CadenceLibraryItem } from './cadenceLibrary'

const BREADCRUMB = [
  { label: 'Klarert', to: '/' },
  { label: 'Planlegging' },
]

type SectionId = 'strategi' | 'kadens' | 'oversikt'

const PLAN_NAV: Array<{
  id: SectionId
  label: string
  sub: string
  Icon: typeof Target
}> = [
  { id: 'strategi', label: 'Strategi & OKR', sub: 'Ambisjon, OKR-tre, RACI', Icon: Target },
  { id: 'kadens', label: 'Kadens-planlegger', sub: 'Velg krav-drevne oppgaver', Icon: Wand2 },
  { id: 'oversikt', label: 'Oppgaver & prosjekter', sub: 'Alt arbeid samlet', Icon: KanbanSquare },
]

const VALID_SECTIONS = new Set<SectionId>(PLAN_NAV.map((n) => n.id))

export function PlanningPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sectionParam = searchParams.get('section')
  const section: SectionId =
    sectionParam && VALID_SECTIONS.has(sectionParam as SectionId)
      ? (sectionParam as SectionId)
      : 'strategi'

  const setSection = useCallback(
    (id: SectionId) => {
      const sp = new URLSearchParams(searchParams)
      sp.set('section', id)
      setSearchParams(sp, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const okrCtrl = usePlanningOkr()
  const tasksCtrl = usePlanningTasks()
  const { projects, createProject } = useTaskProjects()

  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [taskPrefill, setTaskPrefill] = useState<{ objectiveId?: string; keyResultId?: string }>(
    {},
  )
  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [kadensBanner, setKadensBanner] = useState<string | null>(null)
  const [committingKadens, setCommittingKadens] = useState(false)

  // Stats for the tab strip badges.
  const stats = useMemo(() => {
    const objs = okrCtrl.plan?.objectives ?? []
    const onTrack = objs.filter((o) => o.health === 'on_track').length
    const openTasks = tasksCtrl.tasks.filter(
      (t) => t.status !== 'closed' && t.status !== 'cancelled',
    ).length
    const overdue = tasksCtrl.tasks.filter((t) => {
      if (!t.dueDate || t.status === 'closed' || t.status === 'cancelled') return false
      try {
        return new Date(t.dueDate).getTime() < Date.now()
      } catch {
        return false
      }
    }).length
    const recurring = tasksCtrl.tasks.filter((t) => t.recurrenceActive).length
    return {
      onTrack,
      totalObj: objs.length,
      openTasks,
      overdue,
      recurring,
    }
  }, [okrCtrl.plan?.objectives, tasksCtrl.tasks])

  const handleCreateTaskForKr = useCallback(
    (objectiveId: string, keyResultId: string) => {
      setTaskPrefill({ objectiveId, keyResultId })
      setTaskModalOpen(true)
    },
    [],
  )

  const handleCreateTaskNew = useCallback(() => {
    setTaskPrefill({})
    setTaskModalOpen(true)
  }, [])

  const handleKadensCommit = useCallback(
    async (items: CadenceLibraryItem[]) => {
      setCommittingKadens(true)
      try {
        // Spread the first due date over the next quarter so cadence items don't all
        // collide at the same time.
        const today = new Date()
        let count = 0
        for (let i = 0; i < items.length; i += 1) {
          const item = items[i]
          const due = new Date(today)
          // Stagger by 3 days per item to avoid all-the-same-due-date.
          due.setDate(due.getDate() + 14 + i * 3)
          const dueStr = due.toISOString().slice(0, 10)
          const id = await tasksCtrl.createTask({
            title: item.title,
            description: `${item.ref}\n${item.lawRefs.join(', ')}\n\nFrekvens: ${item.freq} · Eier: ${item.owner}`,
            priority: 'medium',
            dueDate: dueStr,
            ownerName: item.owner,
            recurrenceActive: true,
            recurrenceIntervalDays: item.intervalDays,
          })
          if (id) count += 1
        }
        setKadensBanner(`${count} oppgave${count === 1 ? '' : 'r'} lagt til som vedvarende rutiner i planen.`)
      } finally {
        setCommittingKadens(false)
      }
    },
    [tasksCtrl],
  )

  const headerActions = (
    <>
      <Button variant="secondary" icon={<Share2 className="h-4 w-4" />}>
        Del med AMU
      </Button>
      <Button
        variant="primary"
        onClick={handleCreateTaskNew}
        icon={<Plus className="h-4 w-4" />}
      >
        Ny oppgave
      </Button>
    </>
  )

  const tabBar = (
    <nav className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex flex-col md:flex-row">
        {PLAN_NAV.map((n, i) => {
          const active = n.id === section
          const NIcon = n.Icon
          return (
            <Button
              key={n.id}
              variant="ghost"
              onClick={() => setSection(n.id)}
              className={[
                'group relative flex flex-1 items-center justify-start gap-3 rounded-none px-5 py-3.5 text-left font-normal normal-case transition-colors',
                active ? 'bg-[#e7efe9]/50 hover:bg-[#e7efe9]/60' : 'bg-white hover:bg-neutral-50',
                i < PLAN_NAV.length - 1 ? 'border-b border-neutral-200/80 md:border-b-0 md:border-r' : '',
              ].join(' ')}
              aria-current={active ? 'page' : undefined}
            >
              <span
                className={[
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors',
                  active
                    ? 'bg-[#1a3d32] text-white'
                    : 'bg-neutral-100 text-neutral-500 group-hover:bg-neutral-200',
                ].join(' ')}
              >
                <NIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-[10px] font-bold tabular-nums text-neutral-400">
                    0{i + 1}
                  </span>
                  <span
                    className={[
                      'text-[13.5px]',
                      active ? 'font-bold text-neutral-900' : 'font-semibold text-neutral-800',
                    ].join(' ')}
                  >
                    {n.label}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-neutral-500">{n.sub}</p>
              </div>
              {n.id === 'strategi' && stats.totalObj > 0 && (
                <span className="hidden items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-700 lg:inline-flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#2f7757]" />
                  {stats.onTrack}/{stats.totalObj} på spor
                </span>
              )}
              {n.id === 'kadens' && (
                <span className="hidden items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-700 lg:inline-flex">
                  <ListChecks className="h-2.5 w-2.5" />
                  {stats.recurring} aktive rutiner
                </span>
              )}
              {n.id === 'oversikt' && (
                <span className="hidden items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-700 lg:inline-flex">
                  <Inbox className="h-2.5 w-2.5" />
                  {stats.openTasks} åpne
                  {stats.overdue > 0 && (
                    <span className="ml-1 rounded-full bg-red-100 px-1 text-red-800">
                      {stats.overdue}!
                    </span>
                  )}
                </span>
              )}
              {active && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1a3d32]" />
              )}
            </Button>
          )
        })}
      </div>
    </nav>
  )

  if (okrCtrl.loading && !okrCtrl.plan) {
    return (
      <ModulePageShell
        breadcrumb={BREADCRUMB}
        title="Planlegging"
        description="Sett ambisjonen, bygg kadensen, og hold oversikt — fra Arbeidsmiljølovens krav til hver enkelt oppgave."
        loading
        loadingLabel="Laster strategi…"
        width="full"
      >
        <div />
      </ModulePageShell>
    )
  }

  return (
    <ModulePageShell
      breadcrumb={BREADCRUMB}
      title="Planlegging"
      description="Sett ambisjonen, bygg kadensen, og hold oversikt — fra Arbeidsmiljølovens krav til hver enkelt oppgave."
      headerActions={headerActions}
      width="full"
    >
      <div className="space-y-5">
        {tabBar}

        {okrCtrl.error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-[12.5px] text-red-900">
            {okrCtrl.error}
          </div>
        )}
        {tasksCtrl.error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-[12.5px] text-red-900">
            {tasksCtrl.error}
          </div>
        )}

        <section className="min-w-0">
          {section === 'strategi' && okrCtrl.plan && (
            <PlanningStrategiSection
              plan={okrCtrl.plan}
              ctrl={okrCtrl}
              tasks={tasksCtrl.tasks}
              onCreateTaskForKr={handleCreateTaskForKr}
            />
          )}
          {section === 'kadens' && (
            <PlanningKadensSection
              onCommit={handleKadensCommit}
              committing={committingKadens}
              banner={kadensBanner}
              onDismissBanner={() => setKadensBanner(null)}
            />
          )}
          {section === 'oversikt' && (
            <PlanningOversiktSection
              plan={okrCtrl.plan}
              tasks={tasksCtrl.tasks}
              projects={projects}
              tasksCtrl={tasksCtrl}
              onCreateTask={handleCreateTaskNew}
              onCreateProject={() => setProjectModalOpen(true)}
            />
          )}
        </section>
      </div>

      <PlanningCreateTaskModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        onCreate={async (input) => {
          await tasksCtrl.createTask(input)
        }}
        plan={okrCtrl.plan}
        projects={projects}
        prefill={taskPrefill}
      />
      <PlanningCreateProjectModal
        open={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        onCreate={async (input) => {
          await createProject(input)
        }}
      />
    </ModulePageShell>
  )
}
