import { useMemo } from 'react'
import { useCouncil } from './useCouncil'
import { useHse } from './useHse'
import { useInternalControl } from './useInternalControl'
import { useLearning } from './useLearning'
import { useOrgHealth } from './useOrgHealth'
import { useTasks } from './useTasks'

const today = new Date()
export const DASHBOARD_TODAY_STR = today.toISOString().slice(0, 10)

export function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('no-NO', { dateStyle: 'medium' })
  } catch {
    return iso
  }
}

export function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
}

export function useWorkspaceDashboardData() {
  const council = useCouncil()
  const hse = useHse()
  const ic = useInternalControl()
  const learning = useLearning()
  const oh = useOrgHealth()
  const ts = useTasks()

  const openTasks = useMemo(
    () =>
      ts.tasks
        .filter((t) => t.status !== 'done')
        .sort((a, b) => ((a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : 1)),
    [ts.tasks],
  )

  const overdueTasks = useMemo(
    () => openTasks.filter((t) => t.dueDate && t.dueDate < DASHBOARD_TODAY_STR),
    [openTasks],
  )

  const upcomingMeetings = useMemo(
    () =>
      council.meetings
        .filter((m) => m.status === 'planned' && m.startsAt > today.toISOString())
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .slice(0, 5),
    [council.meetings],
  )

  const nextMeeting = upcomingMeetings[0]

  const activeSickLeave = useMemo(
    () => hse.sickLeaveCases.filter((c) => c.status === 'active' || c.status === 'partial'),
    [hse.sickLeaveCases],
  )

  const overdueMilestones = useMemo(
    () =>
      activeSickLeave
        .flatMap((c) =>
          c.milestones
            .filter((m) => !m.completedAt && m.dueAt < DASHBOARD_TODAY_STR)
            .map((m) => ({ ...m, employeeName: c.employeeName, caseId: c.id })),
        )
        .slice(0, 4),
    [activeSickLeave],
  )

  const openHighRisks = useMemo(
    () =>
      ic.rosAssessments
        .flatMap((r) =>
          r.rows
            .filter((row) => {
              if (row.done) return false
              const s = row.status ?? 'draft'
              const done = s === 'finished' || s === 'closed' || s === 'cancelled'
              return !done && row.riskScore >= 12
            })
            .map((row) => ({ ...row, assessmentTitle: r.title })),
        )
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 4),
    [ic.rosAssessments],
  )

  const annualEvents = useMemo(() => {
    const evts: { label: string; date: string; kind: string; colour: string; to: string }[] = []
    council.meetings
      .filter((m) => m.status === 'planned' && m.startsAt > today.toISOString())
      .forEach((m) =>
        evts.push({
          label: m.title,
          date: m.startsAt,
          kind: 'AMU-møte',
          colour: '#1a3d32',
          to: '/council?tab=meetings',
        }),
      )
    activeSickLeave.forEach((c) =>
      c.milestones
        .filter((m) => !m.completedAt && m.dueAt >= DASHBOARD_TODAY_STR)
        .forEach((m) =>
          evts.push({
            label: `${c.employeeName}: ${m.label}`,
            date: m.dueAt,
            kind: 'Sykefravær',
            colour: '#f59e0b',
            to: '/hse?tab=sickness',
          }),
        ),
    )
    hse.trainingRecords
      .filter((r) => r.expiresAt && r.expiresAt >= DASHBOARD_TODAY_STR)
      .forEach((r) =>
        evts.push({
          label: `${r.employeeName}: ${r.trainingKind}`,
          date: r.expiresAt!,
          kind: 'Opplæring',
          colour: '#e11d48',
          to: '/hse?tab=training',
        }),
      )
    oh.surveys
      .filter((s) => s.schedule?.enabled && s.schedule.nextRunAt && s.schedule.nextRunAt >= DASHBOARD_TODAY_STR)
      .forEach((s) =>
        evts.push({
          label: s.title,
          date: s.schedule!.nextRunAt!,
          kind: 'Undersøkelse',
          colour: '#0d9488',
          to: '/org-health?tab=surveys',
        }),
      )
    return evts.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8)
  }, [council.meetings, activeSickLeave, hse.trainingRecords, oh.surveys])

  const weekDays = useMemo(() => {
    const start = new Date(today)
    start.setDate(today.getDate() - today.getDay() + 1)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const iso = d.toISOString().slice(0, 10)
      const meetings = council.meetings.filter((m) => m.startsAt.startsWith(iso) && m.status !== 'cancelled')
      const milestones = activeSickLeave.flatMap((c) => c.milestones.filter((m) => !m.completedAt && m.dueAt === iso))
      return {
        iso,
        dayName: d.toLocaleDateString('no-NO', { weekday: 'short' }),
        dayNum: d.getDate(),
        meetings,
        milestones,
        isToday: iso === DASHBOARD_TODAY_STR,
      }
    })
  }, [council.meetings, activeSickLeave])

  const openComplianceDone = council.compliance.filter((c) => c.done).length
  const openComplianceTotal = council.compliance.length

  const openIncidents = useMemo(() => hse.incidents.filter((i) => i.status !== 'closed').length, [hse.incidents])

  return {
    today,
    todayStr: DASHBOARD_TODAY_STR,
    council,
    hse,
    ic,
    learning,
    oh,
    ts,
    openTasks,
    overdueTasks,
    upcomingMeetings,
    nextMeeting,
    activeSickLeave,
    overdueMilestones,
    openHighRisks,
    annualEvents,
    weekDays,
    openComplianceDone,
    openComplianceTotal,
    openIncidents,
  }
}
