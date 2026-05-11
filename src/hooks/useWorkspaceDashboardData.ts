import { useMemo } from 'react'
import { useHse } from './useHse'
import { useInternalControl } from './useInternalControl'
import { useLearning } from './useLearning'
import { useOrgHealth } from './useOrgHealth'
import { useTaskItemsData } from '../../modules/tasks/useTaskItemsData'
import { useMeetings } from '../../modules/meetings'
import type { MeetingRow } from '../../modules/meetings'

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

/** Calendar-shaped meeting view exposed to the project dashboard. Aliases
 *  the meetings module's row so consumers stay decoupled from the row
 *  shape. */
export type DashboardMeetingEntry = {
  id: string
  title: string
  startsAt: string
  status: MeetingRow['status']
  year: number
}

function toEntry(m: MeetingRow): DashboardMeetingEntry | null {
  if (!m.scheduled_at) return null
  return {
    id: m.id,
    title: m.title,
    startsAt: m.scheduled_at,
    status: m.status,
    year: new Date(m.scheduled_at).getFullYear(),
  }
}

export function useWorkspaceDashboardData() {
  const meetings = useMeetings()
  const hse = useHse()
  const ic = useInternalControl()
  const learning = useLearning()
  const oh = useOrgHealth()
  const ts = useTaskItemsData()

  const meetingEntries = useMemo<DashboardMeetingEntry[]>(
    () =>
      meetings.meetings
        .map(toEntry)
        .filter((m): m is DashboardMeetingEntry => m !== null),
    [meetings.meetings],
  )

  const openTasks = useMemo(
    () =>
      ts.items
        .filter((t) => t.status !== 'closed' && t.status !== 'cancelled')
        .sort((a, b) => ((a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : 1)),
    [ts.items],
  )

  const overdueTasks = useMemo(
    () => openTasks.filter((t) => t.dueDate && t.dueDate < DASHBOARD_TODAY_STR),
    [openTasks],
  )

  const upcomingMeetings = useMemo(
    () =>
      meetingEntries
        .filter((m) => m.status === 'planned' && m.startsAt > today.toISOString())
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .slice(0, 5),
    [meetingEntries],
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
    meetingEntries
      .filter((m) => m.status === 'planned' && m.startsAt > today.toISOString())
      .forEach((m) =>
        evts.push({
          label: m.title,
          date: m.startsAt,
          kind: 'Møte',
          colour: '#0891b2',
          to: `/meetings/${m.id}`,
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
  }, [meetingEntries, activeSickLeave, hse.trainingRecords, oh.surveys])

  const weekDays = useMemo(() => {
    const start = new Date(today)
    start.setDate(today.getDate() - today.getDay() + 1)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const iso = d.toISOString().slice(0, 10)
      const dayMeetings = meetingEntries.filter(
        (m) => m.startsAt.startsWith(iso) && m.status !== 'cancelled',
      )
      const milestones = activeSickLeave.flatMap((c) =>
        c.milestones.filter((m) => !m.completedAt && m.dueAt === iso),
      )
      return {
        iso,
        dayName: d.toLocaleDateString('no-NO', { weekday: 'short' }),
        dayNum: d.getDate(),
        meetings: dayMeetings,
        milestones,
        isToday: iso === DASHBOARD_TODAY_STR,
      }
    })
  }, [meetingEntries, activeSickLeave])

  // Compliance KPI on the project dashboard now reads "signed meetings vs
  // completed meetings" — i.e. how much of what's done has been protocol-
  // signed. Closes the council-compliance card without losing the slot.
  const completedMeetings = meetingEntries.filter((m) => m.status === 'completed').length
  const signedMeetings = meetings.meetings.filter(
    (m) => m.status === 'completed' && !!m.protocol_signed_at,
  ).length

  const openIncidents = useMemo(
    () => hse.incidents.filter((i) => i.status !== 'closed').length,
    [hse.incidents],
  )

  return {
    today,
    todayStr: DASHBOARD_TODAY_STR,
    meetings: meetingEntries,
    meetingsLoading: meetings.loading,
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
    /** Number of completed meetings that have a signed protocol. */
    signedMeetings,
    /** Number of completed meetings (signed + unsigned). */
    completedMeetings,
    openIncidents,
  }
}
