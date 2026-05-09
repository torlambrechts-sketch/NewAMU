// useAmlComplianceData — Aggregates the data the Arbeidsmiljøloven
// dashboard reads (`/compliance/arbeidsmiljoloven`).
// Task data comes from useTaskItemsData (all non-closed items mapped by templateKind).
// Other surfaces fall through to the seed in src/data/amlComplianceSeed.ts.

import { useMemo } from 'react'
import { useTaskItemsData, type TaskItemRow } from '../../modules/tasks/useTaskItemsData'
import {
  AML_KLARERT_FEED,
  AML_MODULES,
  AML_RING_LEGEND,
  AML_SCORE,
  AML_TASKS,
  AML_TODAY,
  AML_WHEEL,
  type AmlComplianceScore,
  type AmlFeedItem,
  type AmlModuleSummary,
  type AmlRingLegendEntry,
  type AmlTask,
  type AmlTaskSeverity,
  type AmlToday,
  type AmlWheelItem,
} from '../data/amlComplianceSeed'
import type { TaskTemplateKind } from '../types/task'

export type UseAmlComplianceDataReturn = {
  today: AmlToday
  score: AmlComplianceScore
  modules: AmlModuleSummary[]
  tasks: AmlTask[]
  wheel: AmlWheelItem[]
  ringLegend: AmlRingLegendEntry[]
  feed: AmlFeedItem[]
  /** True when the seed is being shown for at least one surface — the
   *  page can use this to render a "Demo data" callout if needed. */
  isUsingSeed: {
    score: boolean
    modules: boolean
    tasks: boolean
    wheel: boolean
    feed: boolean
  }
}

// Template kind → AML module label mapping.
const KIND_TO_MODULE_LABEL: Partial<Record<TaskTemplateKind, string>> = {
  avvik: 'Avvik',
  nestenulykke: 'Avvik',
  risiko: 'ROS-analyser',
  tiltak: 'Internkontroll',
  'sykefravær': 'Sykefravær',
  forslag: 'Forslag',
  oppgave: 'Generelle oppgaver',
}

// Template kind → AML § mapping.
const KIND_TO_LAW: Partial<Record<TaskTemplateKind, string>> = {
  avvik: '§ 3-1 (2) e',
  nestenulykke: '§ 3-1 (2) e',
  risiko: '§ 3-1',
  tiltak: 'IK § 5',
  'sykefravær': '§ 4-6 (3)',
}

export function useAmlComplianceData(): UseAmlComplianceDataReturn {
  const { items: allTasks } = useTaskItemsData()

  const realAmlTasks = useMemo<AmlTask[]>(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return allTasks
      .filter((t) => t.status !== 'closed' && t.status !== 'cancelled')
      .map((t) => mapTaskToAmlTask(t, today))
  }, [allTasks])

  // The visible task list. When the org has 0 AML-relevant tasks we
  // show the seed so the table doesn't render empty during demo;
  // production deploys with real activity will override this.
  const usingTaskSeed = realAmlTasks.length === 0
  const tasks = usingTaskSeed ? AML_TASKS : realAmlTasks

  // Task counts grouped by AML module label (matches AML_MODULES.title
  // so the overlay below can match exactly). Drives the per-card
  // "Open: N · M forfalt" footer + the score's 14-day window.
  const taskAggregate = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueSoonCutoff = new Date(today)
    dueSoonCutoff.setDate(dueSoonCutoff.getDate() + 14)

    const perModule = new Map<string, { open: number; overdue: number }>()
    let openTotal = 0
    let overdueTotal = 0
    let dueSoonTotal = 0
    for (const t of allTasks) {
      if (t.status === 'closed' || t.status === 'cancelled') continue
      const moduleLabel =
        (t.templateKind ? KIND_TO_MODULE_LABEL[t.templateKind] : undefined) ?? 'Generelle oppgaver'
      const due = new Date(t.dueDate ?? '')
      const isOverdue = !Number.isNaN(due.getTime()) && due < today
      const isDueSoon =
        !Number.isNaN(due.getTime()) &&
        due >= today &&
        due <= dueSoonCutoff
      const bucket = perModule.get(moduleLabel) ?? { open: 0, overdue: 0 }
      bucket.open += 1
      if (isOverdue) bucket.overdue += 1
      perModule.set(moduleLabel, bucket)
      openTotal += 1
      if (isOverdue) overdueTotal += 1
      if (isDueSoon) dueSoonTotal += 1
    }
    return { perModule, openTotal, overdueTotal, dueSoonTotal }
  }, [allTasks])

  // Overlay real task counts onto the seed modules. We keep the seed's
  // progress + metric + status because those need per-module hooks
  // (AMU meeting count, vernerunde rounds, læring completion %) that
  // don't all exist yet. Open + overdue counts are the easy
  // task-derived overlay that's true for every module.
  const modules = useMemo<AmlModuleSummary[]>(() => {
    if (usingTaskSeed) return AML_MODULES
    return AML_MODULES.map((m) => {
      const real = taskAggregate.perModule.get(m.title)
      if (!real) return m
      return { ...m, open: real.open, overdue: real.overdue }
    })
  }, [usingTaskSeed, taskAggregate])

  // Overlay real task-derived KPIs onto the seed score. Pct + module
  // counts stay seed because those depend on the per-module status
  // computation that lands later.
  const score = useMemo<AmlComplianceScore>(() => {
    if (usingTaskSeed) return AML_SCORE
    return {
      ...AML_SCORE,
      tasksOpen: taskAggregate.openTotal,
      tasksOverdue: taskAggregate.overdueTotal,
      tasksDueSoon: taskAggregate.dueSoonTotal,
    }
  }, [usingTaskSeed, taskAggregate])

  return {
    today: AML_TODAY,
    score,
    modules,
    tasks,
    wheel: AML_WHEEL,
    ringLegend: AML_RING_LEGEND,
    feed: AML_KLARERT_FEED,
    isUsingSeed: {
      // Score's pct + module-counts still seed; only the task-derived
      // KPIs (open / overdue / due-soon) use real data.
      score: usingTaskSeed,
      // Modules' progress + metric + status still seed; open + overdue
      // overlaid from real tasks when available.
      modules: usingTaskSeed,
      tasks: usingTaskSeed,
      wheel: true,
      feed: true,
    },
  }
}

function mapTaskToAmlTask(t: TaskItemRow, todayStart: Date): AmlTask {
  const due = new Date(t.dueDate ?? '')
  const overdue = !Number.isNaN(due.getTime()) && due < todayStart
  const daysLate = overdue
    ? Math.max(1, Math.floor((todayStart.getTime() - due.getTime()) / 86_400_000))
    : undefined
  return {
    id: t.id,
    title: t.title,
    module: (t.templateKind ? KIND_TO_MODULE_LABEL[t.templateKind] : undefined) ?? 'Generelle oppgaver',
    law: (t.templateKind ? KIND_TO_LAW[t.templateKind] : undefined) ?? '—',
    severity: deriveSeverity(t, overdue),
    owner: t.assigneeName || t.ownerName || '—',
    due: formatNorwegianShort(due),
    overdue,
    daysLate,
  }
}

function deriveSeverity(t: TaskItemRow, overdue: boolean): AmlTaskSeverity {
  if (t.priority === 'critical') return 'critical'
  if (overdue && (t.templateKind === 'sykefravær' || t.templateKind === 'avvik')) return 'critical'
  if (overdue || t.priority === 'high') return 'high'
  if (t.templateKind === 'risiko' || t.templateKind === 'avvik') return 'high'
  if (t.priority === 'medium') return 'medium'
  return 'low'
}

function formatNorwegianShort(d: Date): string {
  if (Number.isNaN(d.getTime())) return ''
  const months = [
    'jan', 'feb', 'mar', 'apr', 'mai', 'jun',
    'jul', 'aug', 'sep', 'okt', 'nov', 'des',
  ]
  return `${String(d.getDate()).padStart(2, '0')}. ${months[d.getMonth()]}`
}
