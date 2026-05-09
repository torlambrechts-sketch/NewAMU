// TasksManagementPage — three-mode routing for the Oppgaver module.
//
//   hub        no ?template=, no ?project=  — tile grid + projects list
//   template   ?template=<slug>             — filtered task list + create button
//   project    ?project=<id>               — kanban/PDCA board
//
// URL is the source of truth for mode. No silent defaulting.

import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BarChart3, ChevronRight, KanbanSquare, Plus, Settings } from 'lucide-react'
import { ModulePageShell } from '../../src/components/module/ModulePageShell'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../src/components/layout/layoutTable1PostingsKit'
import { Button } from '../../src/components/ui/Button'
import { WarningBox } from '../../src/components/ui/AlertBox'
import { TasksHubLanding } from './TasksHubLanding'
import { TaskCreateForm } from './TaskCreateForm'
import { TaskDetailPanel } from './TaskDetailPanel'
import { TaskProjectBoard } from './TaskProjectBoard'
import { TaskProjectCreateForm } from './TaskProjectCreateForm'
import { TaskStatusBadge } from './components/TaskStatusBadge'
import { TaskPriorityBadge } from './components/TaskPriorityBadge'
import { TaskKindIcon } from './components/TaskKindIcon'
import { useTaskTemplates } from './useTaskTemplates'
import { useTaskItemsData } from './useTaskItemsData'
import { useTaskProjects } from './useTaskProjects'
import type { TaskItemRow } from './useTaskItemsData'
import type { TaskItemStatus, TaskPdcaPhase } from '../../src/types/task'

function fmtDate(s: string | null) {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleDateString('nb-NO', { dateStyle: 'short' })
  } catch {
    return s
  }
}

function isOverdue(dueDate: string | null, status: TaskItemStatus) {
  if (!dueDate || status === 'closed' || status === 'cancelled') return false
  return new Date(dueDate) < new Date()
}

export function TasksManagementPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const templateSlug = searchParams.get('template')
  const projectId = searchParams.get('project')

  const tplData = useTaskTemplates()
  const projectsData = useTaskProjects()
  const itemData = useTaskItemsData(
    projectId
      ? { projectId }
      : templateSlug
      ? { templateSlug }
      : { templateSlug: null },
  )

  const [createOpen, setCreateOpen] = useState(false)
  const [projectCreateOpen, setProjectCreateOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<TaskItemRow | null>(null)

  const focusedTemplate = useMemo(() => {
    if (!templateSlug) return null
    return tplData.templates.find((t) => t.slug === templateSlug) ?? null
  }, [tplData.templates, templateSlug])

  const focusedProject = useMemo(() => {
    if (!projectId) return null
    return projectsData.projects.find((p) => p.id === projectId) ?? null
  }, [projectsData.projects, projectId])

  const mode: 'hub' | 'template' | 'project' =
    focusedProject ? 'project' : focusedTemplate ? 'template' : 'hub'

  // ── Project board mode ────────────────────────────────────────────────────
  if (mode === 'project' && focusedProject) {
    const proj = focusedProject
    const methodologyLabel = proj.methodology === 'pdca' ? 'PDCA' : 'Kanban'

    const handleMoveCard = async (
      itemId: string,
      newPhase: TaskPdcaPhase | null,
      newStatus: TaskItemStatus | null,
    ) => {
      if (newPhase) await itemData.updatePdcaPhase(itemId, newPhase)
      else if (newStatus) await itemData.updateStatus(itemId, newStatus)
    }

    const handleQuickCreate = async (colKey: string, title: string) => {
      await itemData.createItem({
        title,
        priority: 'medium',
        projectId: proj.id,
        pdcaPhase: (proj.methodology === 'pdca' ? (colKey as TaskPdcaPhase) : 'do'),
        ...(proj.methodology === 'kanban' && {
          // map column key to initial status
          ...(colKey === 'backlog' && {}),
          ...(colKey === 'progress' && {}),
        }),
      })
    }

    return (
      <>
        <ModulePageShell
          breadcrumb={[
            { label: 'Oppgaver', to: '/tasks/management' },
            { label: proj.title },
          ]}
          title={
            <span className="flex items-center gap-2">
              <KanbanSquare className="h-5 w-5 text-[#c2410c]/70" />
              {proj.title}
            </span>
          }
          description={proj.description || undefined}
          headerActions={
            <div className="flex items-center gap-2">
              <span className="hidden rounded border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-600 sm:inline">
                {methodologyLabel}
              </span>
              {proj.status === 'active' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void projectsData.updateProject(proj.id, { status: 'closed' })}
                >
                  Lukk prosjekt
                </Button>
              )}
            </div>
          }
        >
          <div className="space-y-4">
            {proj.lawRefs.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {proj.lawRefs.map((ref) => (
                  <span
                    key={ref}
                    className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600"
                  >
                    {ref}
                  </span>
                ))}
              </div>
            )}
            {itemData.error && <WarningBox>{itemData.error}</WarningBox>}
            <TaskProjectBoard
              project={proj}
              items={itemData.items}
              onCardClick={setSelectedItem}
              onMoveCard={handleMoveCard}
              onQuickCreate={handleQuickCreate}
            />
          </div>
        </ModulePageShell>

        <TaskDetailPanel
          open={selectedItem !== null}
          onClose={() => setSelectedItem(null)}
          item={selectedItem}
          onStatusChange={async (id, status) => {
            await itemData.updateStatus(id, status)
            setSelectedItem((prev) => (prev?.id === id ? { ...prev, status } : prev))
          }}
        />
      </>
    )
  }

  // ── Hub mode ─────────────────────────────────────────────────────────────
  if (mode === 'hub') {
    return (
      <>
        <ModulePageShell
          breadcrumb={[{ label: 'Oppgaver' }]}
          title="Oppgaver"
          description="Velg en mal for å opprette og følge opp oppgaver, avvik, risiko og forslag."
          headerActions={
            <div className="flex items-center gap-2">
              <Link
                to="/tasks/management/analyse"
                className="inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                <BarChart3 className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Analyse</span>
              </Link>
              <Link
                to="/tasks/management/admin"
                className="inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                <Settings className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Innstillinger</span>
              </Link>
            </div>
          }
        >
          <div className="space-y-6">
            {tplData.error && <WarningBox>{tplData.error}</WarningBox>}
            <TasksHubLanding
              templates={tplData.templates}
              categories={tplData.categories}
              loading={tplData.loading}
              canManage={true}
              projects={projectsData.projects}
              onCreateProject={() => setProjectCreateOpen(true)}
              onOpenProject={(id) => navigate(`/tasks/management?project=${id}`)}
            />
          </div>
        </ModulePageShell>

        <TaskProjectCreateForm
          open={projectCreateOpen}
          onClose={() => setProjectCreateOpen(false)}
          onCreate={async (input) => {
            const id = await projectsData.createProject(input)
            if (id) navigate(`/tasks/management?project=${id}`)
            return id
          }}
        />
      </>
    )
  }

  // Template mode
  const tpl = focusedTemplate!
  const ctaLabel = `Ny ${tpl.name.toLowerCase()}`

  return (
    <>
      <ModulePageShell
        breadcrumb={[
          { label: 'Oppgaver', to: '/tasks/management' },
          { label: tpl.name },
        ]}
        title={
          <span className="flex items-center gap-2">
            <TaskKindIcon kind={tpl.templateKind} className="h-5 w-5 text-[#c2410c]/70" />
            {tpl.name}
          </span>
        }
        description={tpl.description || undefined}
        headerActions={
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setCreateOpen(true)}
            >
              {ctaLabel}
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {itemData.error && <WarningBox>{itemData.error}</WarningBox>}

          {/* Law refs */}
          {tpl.lawRefs.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tpl.lawRefs.map((ref) => (
                <span
                  key={ref}
                  className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600"
                >
                  {ref}
                </span>
              ))}
            </div>
          )}

          <LayoutTable1PostingsShell
            wrap
            title={tpl.name}
            description={`Alle ${tpl.name.toLowerCase()} — sortert etter opprettelsesdato.`}
            toolbar={null}
            footer={
              <span className="text-neutral-500">
                {itemData.loading ? 'Laster…' : `${itemData.items.length} poster`}
              </span>
            }
          >
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Prioritet</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Ansvarlig</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Frist</th>
                    <th className={`w-8 ${LAYOUT_TABLE1_POSTINGS_TH}`} />
                  </tr>
                </thead>
                <tbody>
                  {itemData.loading && itemData.items.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="py-12 text-center">
                          <p className="text-sm text-neutral-500">Laster oppgaver…</p>
                        </div>
                      </td>
                    </tr>
                  ) : itemData.items.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="py-12 text-center">
                          <p className="text-sm text-neutral-500">
                            Ingen {tpl.name.toLowerCase()} ennå.
                          </p>
                          <div className="mt-3 inline-flex">
                            <Button
                              variant="primary"
                              icon={<Plus className="h-4 w-4" />}
                              onClick={() => setCreateOpen(true)}
                            >
                              {ctaLabel}
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    itemData.items.map((row) => (
                      <tr
                        key={row.id}
                        className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} cursor-pointer hover:bg-neutral-50`}
                        onClick={() => setSelectedItem(row)}
                      >
                        <td className="px-5 py-3 font-medium text-neutral-900">{row.title}</td>
                        <td className="px-5 py-3">
                          <TaskStatusBadge status={row.status} />
                        </td>
                        <td className="px-5 py-3">
                          <TaskPriorityBadge priority={row.priority} />
                        </td>
                        <td className="px-5 py-3 text-neutral-600">
                          {row.ownerName ?? row.assigneeName ?? '—'}
                        </td>
                        <td
                          className={`px-5 py-3 text-sm ${
                            isOverdue(row.dueDate, row.status)
                              ? 'font-medium text-red-600'
                              : 'text-neutral-600'
                          }`}
                        >
                          {fmtDate(row.dueDate)}
                        </td>
                        <td className="w-8 px-3 py-3 text-neutral-300">
                          <ChevronRight className="h-4 w-4" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </LayoutTable1PostingsShell>
        </div>
      </ModulePageShell>

      {/* Create form */}
      <TaskCreateForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        template={tpl}
        onCreate={async (input) => {
          const id = await itemData.createItem(input)
          if (id) setCreateOpen(false)
          return id
        }}
      />

      {/* Detail panel */}
      <TaskDetailPanel
        open={selectedItem !== null}
        onClose={() => setSelectedItem(null)}
        item={selectedItem}
        onStatusChange={async (id, status) => {
          await itemData.updateStatus(id, status)
          // Reflect status change in the selected item
          setSelectedItem((prev) => (prev?.id === id ? { ...prev, status } : prev))
        }}
      />
    </>
  )
}
