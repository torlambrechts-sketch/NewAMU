import { useEffect, useMemo, useState } from 'react'
import { AlertOctagon, AlertTriangle, CheckCircle, Clock, Shield, ShieldAlert, ShieldCheck } from 'lucide-react'
import { LayoutScoreStatRow } from '../../../src/components/layout/LayoutScoreStatRow'
import { ModuleSectionCard } from '../../../src/components/module'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import type { Task } from '../../../src/types/task'
import type { AvvikRow } from '../../avvik/types'
import type { WhistleblowingCaseRow } from '../../../src/types/whistleblowing'
import type { AnonymousAmlReport } from '../../../src/types/orgHealth'
import { MODULE_LABELS } from '../../../src/lib/taskNavigation'
import {
  TASK_STATUS_LABELS,
  formatDueDate,
  isOverdue,
  priorityBadgeVariant,
  statusBadgeVariant,
  TASK_PRIORITY_LABELS,
} from '../taskUiHelpers'
import type { UseTaskExtensions } from '../useTaskExtensions'

type Props = {
  tasks: Task[]
  ext: UseTaskExtensions
  avvik: AvvikRow[]
  varslingCases: WhistleblowingCaseRow[]
  anonymReports: AnonymousAmlReport[]
  onOpenTask: (taskId: string) => void
  onJumpToBoard: () => void
  onJumpTo: (tab: 'avvik' | 'varsling' | 'anonym') => void
}

/**
 * Module landing tab — KPIs, compliance status row, attention list.
 * Mirrors the structure used by SurveyOversiktModuleTab so the look-and-feel
 * stays identical across modules.
 */
export function TasksOverviewTab({
  tasks,
  ext,
  avvik,
  varslingCases,
  anonymReports,
  onOpenTask,
  onJumpToBoard,
  onJumpTo,
}: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now())
  // Refresh "overdue" badges on the minute without re-rendering the rest of
  // the module — cheap (just a number), but ensures KPIs stay accurate while
  // a user has the overview tab open during a workday.
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const kpis = useMemo(() => {
    const open = tasks.filter((t) => t.status !== 'done')
    const overdue = open.filter((t) => isOverdue(t, nowMs))
    const awaitingMgmt = open.filter(
      (t) => t.requiresManagementSignOff && t.assigneeSignature && !t.managementSignature,
    )
    const critical = open.filter((t) => ext.taskExtensionMap.get(t.id)?.priority === 'critical')

    return [
      { big: String(open.length), title: 'Åpne oppgaver', sub: `${tasks.length} totalt registrert` },
      { big: String(overdue.length), title: 'Forfalt', sub: 'Krever umiddelbar oppfølging' },
      { big: String(critical.length), title: 'Kritisk prioritet', sub: 'AML §4-1 høyrisikotiltak' },
      {
        big: String(awaitingMgmt.length),
        title: 'Venter ledersignatur',
        sub: 'IK-forskriften § 5.7',
      },
    ]
  }, [tasks, ext.taskExtensionMap, nowMs])

  const attention = useMemo(() => {
    return tasks
      .filter((t) => t.status !== 'done')
      .map((t) => ({ task: t, ext: ext.taskExtensionMap.get(t.id) }))
      .filter(({ task, ext: e }) => isOverdue(task, nowMs) || e?.priority === 'critical')
      .sort((a, b) => {
        const ad = new Date(a.task.dueDate).getTime()
        const bd = new Date(b.task.dueDate).getTime()
        if (Number.isNaN(ad) && Number.isNaN(bd)) return 0
        if (Number.isNaN(ad)) return 1
        if (Number.isNaN(bd)) return -1
        return ad - bd
      })
      .slice(0, 8)
  }, [tasks, ext.taskExtensionMap, nowMs])

  const complianceRows: ComplianceItem[] = useMemo(() => {
    const open = tasks.filter((t) => t.status !== 'done')
    const allHaveAssignee = open.every((t) => t.assignee && t.assignee !== 'Unassigned')
    const allHaveDueDate = open.every((t) => t.dueDate && t.dueDate !== '—')
    const mgmtTasks = open.filter((t) => t.requiresManagementSignOff)
    const mgmtTracked = mgmtTasks.length === 0 || mgmtTasks.every((t) => t.leaderEmployeeId || t.managementSignerEmployeeId)

    return [
      {
        ok: allHaveAssignee,
        title: 'Ansvarlig på alle åpne oppgaver',
        desc: 'IK-forskriften § 5 nr. 6 krever utpekt ansvarlig per tiltak.',
      },
      {
        ok: allHaveDueDate,
        title: 'Frist satt på alle åpne oppgaver',
        desc: 'AML § 3-1 — planlegging og oppfølging skal være tidsbestemt.',
      },
      {
        ok: mgmtTracked,
        title: 'Ledergodkjenner registrert på medsignaturoppgaver',
        desc: 'AML § 4-1 — ledelsen skal verifisere risikoreduserende tiltak.',
      },
    ]
  }, [tasks])

  const openAvvik = useMemo(
    () => avvik.filter((a) => a.status !== 'closed' && a.status !== 'lukket'),
    [avvik],
  )
  const criticalAvvik = useMemo(() => openAvvik.filter((a) => a.severity === 'critical'), [openAvvik])
  const openVarsling = useMemo(() => varslingCases.filter((c) => c.status !== 'closed'), [varslingCases])
  const last24hAnonym = useMemo(
    () => anonymReports.filter((r) => nowMs - new Date(r.submittedAt).getTime() < 24 * 60 * 60 * 1000).length,
    [anonymReports, nowMs],
  )

  return (
    <div className="space-y-6">
      <LayoutScoreStatRow items={kpis} columns={4} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <CategoryCard
          icon={<AlertOctagon className="h-5 w-5 text-amber-700" aria-hidden />}
          title="Avvik"
          summary={`${openAvvik.length} åpne · ${criticalAvvik.length} kritiske`}
          description="IK-forskriften § 5 nr. 7 — avvik håndteres systematisk."
          onOpen={() => onJumpTo('avvik')}
        />
        <CategoryCard
          icon={<ShieldAlert className="h-5 w-5 text-emerald-700" aria-hidden />}
          title="Varsling"
          summary={`${openVarsling.length} åpne saker`}
          description="AML § 2 A — bekreftelse til varsler innen rimelig tid."
          onOpen={() => onJumpTo('varsling')}
        />
        <CategoryCard
          icon={<Shield className="h-5 w-5 text-emerald-700" aria-hidden />}
          title="Anonym AML"
          summary={`${anonymReports.length} totalt · ${last24hAnonym} siste 24t`}
          description="AML § 4-3 — psykososial varsling uten identifisering."
          onOpen={() => onJumpTo('anonym')}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <ModuleSectionCard className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-neutral-800">
              Oppmerksomhet — forfalt og kritiske
            </h3>
            <Button type="button" variant="secondary" size="sm" onClick={onJumpToBoard}>
              Åpne tavle
            </Button>
          </div>
          {attention.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <CheckCircle className="h-4 w-4" aria-hidden />
              Ingen forfalte eller kritiske oppgaver — godt arbeid.
            </div>
          ) : (
            <ul className="space-y-2">
              {attention.map(({ task, ext: e }) => (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => onOpenTask(task.id)}
                    className="flex w-full items-start gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-left transition-colors hover:bg-neutral-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium text-neutral-900">{task.title}</span>
                        {e ? (
                          <Badge variant={priorityBadgeVariant(e.priority)}>
                            {TASK_PRIORITY_LABELS[e.priority]}
                          </Badge>
                        ) : null}
                        <Badge variant={statusBadgeVariant(task.status)}>
                          {TASK_STATUS_LABELS[task.status]}
                        </Badge>
                        {isOverdue(task, nowMs) ? (
                          <Badge variant="critical" className="inline-flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Forfalt
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-neutral-500">
                        <span>Ansvarlig: {task.assignee}</span>
                        <span>Frist: {formatDueDate(task.dueDate)}</span>
                        <span>Kilde: {MODULE_LABELS[task.module]}</span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ModuleSectionCard>

        <ModuleSectionCard className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-800">
            <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden />
            Lovkrav — status
          </h3>
          <div className="space-y-3">
            {complianceRows.map((row) => (
              <ComplianceRow key={row.title} {...row} />
            ))}
          </div>
        </ModuleSectionCard>
      </div>
    </div>
  )
}

function CategoryCard({
  icon,
  title,
  summary,
  description,
  onOpen,
}: {
  icon: React.ReactNode
  title: string
  summary: string
  description: string
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col items-start gap-2 rounded-lg border border-neutral-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-[#1a3d32]/40 hover:bg-emerald-50/40"
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-semibold text-neutral-900">{title}</span>
      </div>
      <p className="text-base font-semibold text-neutral-900">{summary}</p>
      <p className="text-xs text-neutral-500">{description}</p>
      <span className="mt-1 inline-flex items-center text-xs font-medium text-[#1a3d32] group-hover:underline">
        Åpne →
      </span>
    </button>
  )
}

type ComplianceItem = { ok: boolean; title: string; desc: string }

function ComplianceRow({ ok, title, desc }: ComplianceItem) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
        }`}
        aria-hidden
      >
        {ok ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-neutral-900">{title}</p>
        <p className="mt-0.5 text-xs text-neutral-500">{desc}</p>
      </div>
    </div>
  )
}
