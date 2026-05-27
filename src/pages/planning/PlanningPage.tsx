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
import { KanbanSquare, Plus, Share2, Target, Wand2 } from 'lucide-react'
import { ModulePageShell } from '../../components/module/ModulePageShell'
import { Button } from '../../components/ui/Button'
import { Tabs, type TabItem } from '../../components/ui/Tabs'
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
        // Stagger due dates so cadence items don't all collide on the same day.
        // toLocaleDateString('sv-SE') gives YYYY-MM-DD in local TZ — avoids
        // the UTC drift of toISOString().slice(0,10) for Norway timezone.
        const today = new Date()
        const results = await Promise.all(
          items.map(async (item, i) => {
            const due = new Date(today)
            due.setDate(due.getDate() + 14 + i * 3)
            const dueStr = due.toLocaleDateString('sv-SE')
            return tasksCtrl.createTask({
              title: item.title,
              description: `${item.ref}\n${item.lawRefs.join(', ')}\n\nFrekvens: ${item.freq} · Eier: ${item.owner}`,
              priority: 'medium',
              dueDate: dueStr,
              ownerName: item.owner,
              recurrenceActive: true,
              recurrenceIntervalDays: item.intervalDays,
            })
          }),
        )
        const ok = results.filter((r) => r.id != null).length
        const failed = results.length - ok
        if (failed === 0) {
          setKadensBanner(
            `${ok} oppgave${ok === 1 ? '' : 'r'} lagt til som vedvarende rutiner i planen.`,
          )
        } else if (ok === 0) {
          const firstErr = results.find((r) => r.error)?.error ?? 'Ukjent feil'
          setKadensBanner(`Kunne ikke legge til oppgavene. (${firstErr})`)
        } else {
          const firstErr = results.find((r) => r.error)?.error ?? 'Ukjent feil'
          setKadensBanner(
            `${ok} oppgave${ok === 1 ? '' : 'r'} lagt til. ${failed} feilet: ${firstErr}`,
          )
        }
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

  const tabItems: TabItem[] = PLAN_NAV.map((n) => {
    let badgeCount: number | undefined
    let badgeVariant: 'default' | 'danger' | undefined
    if (n.id === 'strategi' && stats.totalObj > 0) {
      badgeCount = stats.onTrack
    } else if (n.id === 'kadens' && stats.recurring > 0) {
      badgeCount = stats.recurring
    } else if (n.id === 'oversikt') {
      if (stats.overdue > 0) {
        badgeCount = stats.overdue
        badgeVariant = 'danger'
      } else if (stats.openTasks > 0) {
        badgeCount = stats.openTasks
      }
    }
    return {
      id: n.id,
      label: n.label,
      icon: n.Icon,
      badgeCount,
      badgeVariant,
    }
  })

  const tabBar = (
    <div className="rounded-xl border border-neutral-200/80 bg-white p-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <Tabs
        items={tabItems}
        activeId={section}
        onChange={(id) => setSection(id as SectionId)}
        overflow="scroll"
      />
    </div>
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
