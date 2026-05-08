// useAmlComplianceData — Phase B partial. Aggregates the data the
// Arbeidsmiljøloven dashboard reads (`/compliance/arbeidsmiljoloven`)
// from the existing per-module hooks. v1 wires real data for:
//   - Utestående oppgaver  ← useTasks() filtered to AML-relevant
//                            sourceType / module + mapped to AmlTask
// Other surfaces (modules grid, score, year wheel, Klarert feed) fall
// through to the seed shipped in src/data/amlComplianceSeed.ts. The
// per-topic `computeStatus` adapter table lands in a follow-up — the
// hook's interface stays stable so the page never has to change.

import { useMemo } from 'react'
import { useTasks } from './useTasks'
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
import type { Task, TaskSourceType } from '../types/task'

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

// AML-relevant task source types. Anything from these contributes to
// the Arbeidsmiljøloven outstanding-tasks table; manual / unrelated
// tasks do not.
const AML_TASK_SOURCE_TYPES = new Set<TaskSourceType>([
  'hse_safety_round',
  'hse_inspection',
  'hse_inspection_finding',
  'hse_incident',
  'hse_sja',
  'hse_sick_leave_milestone',
  'nav_report',
  'ros_measure',
  'annual_review_action',
  'council_meeting',
  'council_compliance',
  'representatives',
])

// Topic / module mapping driving the "Modul" column on the table.
// Same identifiers as the AML_MODULES seed so a future drill-through
// can reach the right card.
const SOURCE_TYPE_TO_MODULE_LABEL: Partial<Record<TaskSourceType, string>> = {
  hse_safety_round: 'Vernerunder',
  hse_inspection: 'Vernerunder',
  hse_inspection_finding: 'Avvik',
  hse_incident: 'Avvik',
  hse_sja: 'SJA',
  hse_sick_leave_milestone: 'Sykefravær',
  nav_report: 'Sykefravær',
  ros_measure: 'ROS-analyser',
  annual_review_action: 'Internkontroll',
  council_meeting: 'AMU',
  council_compliance: 'AMU',
  representatives: 'Verneombud',
}

// Best-effort mapping of source type → AML §. Mirrors AML_MODULES.law.
const SOURCE_TYPE_TO_LAW: Partial<Record<TaskSourceType, string>> = {
  hse_safety_round: '§ 3-1 (2) c',
  hse_inspection: '§ 3-1 (2) c',
  hse_inspection_finding: '§ 3-1 (2) e',
  hse_incident: '§ 3-1 (2) e',
  hse_sja: 'IK § 5 nr. 6',
  hse_sick_leave_milestone: '§ 4-6 (3)',
  nav_report: '§ 4-6 (3)',
  ros_measure: '§ 3-1',
  annual_review_action: 'IK § 5',
  council_meeting: '§ 7-2',
  council_compliance: '§ 7-2',
  representatives: '§ 6-2',
}

export function useAmlComplianceData(): UseAmlComplianceDataReturn {
  const { tasks: allTasks } = useTasks()

  const realAmlTasks = useMemo<AmlTask[]>(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return allTasks
      .filter((t) => t.status !== 'done' && AML_TASK_SOURCE_TYPES.has(t.sourceType))
      .map((t) => mapTaskToAmlTask(t, today))
  }, [allTasks])

  // The visible task list. When the org has 0 AML-relevant tasks we
  // show the seed so the table doesn't render empty during demo;
  // production deploys with real activity will override this.
  const tasks = realAmlTasks.length > 0 ? realAmlTasks : AML_TASKS

  return {
    today: AML_TODAY,
    score: AML_SCORE,
    modules: AML_MODULES,
    tasks,
    wheel: AML_WHEEL,
    ringLegend: AML_RING_LEGEND,
    feed: AML_KLARERT_FEED,
    isUsingSeed: {
      score: true,
      modules: true,
      tasks: realAmlTasks.length === 0,
      wheel: true,
      feed: true,
    },
  }
}

function mapTaskToAmlTask(t: Task, todayStart: Date): AmlTask {
  const due = new Date(t.dueDate)
  const overdue = !Number.isNaN(due.getTime()) && due < todayStart
  const daysLate = overdue
    ? Math.max(1, Math.floor((todayStart.getTime() - due.getTime()) / 86_400_000))
    : undefined
  return {
    id: t.id,
    title: t.title,
    module: SOURCE_TYPE_TO_MODULE_LABEL[t.sourceType] ?? labelFromSourceType(t.sourceType),
    law: SOURCE_TYPE_TO_LAW[t.sourceType] ?? '—',
    severity: deriveSeverity(t, overdue),
    owner: t.assignee || t.ownerRole || '—',
    due: formatNorwegianShort(due),
    overdue,
    daysLate,
  }
}

function deriveSeverity(t: Task, overdue: boolean): AmlTaskSeverity {
  // Heuristic: overdue + IA / sick-leave / incident → critical.
  // Overdue otherwise → high. Source-type heuristics for non-overdue.
  const sick =
    t.sourceType === 'hse_sick_leave_milestone' || t.sourceType === 'nav_report'
  const incident =
    t.sourceType === 'hse_incident' || t.sourceType === 'hse_inspection_finding'
  if (overdue && (sick || incident)) return 'critical'
  if (overdue) return 'high'
  if (sick || incident) return 'high'
  if (t.sourceType === 'ros_measure') return 'high'
  if (t.requiresManagementSignOff) return 'medium'
  if (t.sourceType === 'council_meeting' || t.sourceType === 'representatives') return 'medium'
  return 'low'
}

function labelFromSourceType(s: TaskSourceType): string {
  return s
    .replace(/^hse_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatNorwegianShort(d: Date): string {
  if (Number.isNaN(d.getTime())) return ''
  const months = [
    'jan', 'feb', 'mar', 'apr', 'mai', 'jun',
    'jul', 'aug', 'sep', 'okt', 'nov', 'des',
  ]
  return `${String(d.getDate()).padStart(2, '0')}. ${months[d.getMonth()]}`
}
