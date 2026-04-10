import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Gavel,
  History,
  ListOrdered,
  Plus,
  Scale,
  ScrollText,
  Send,
  ShieldAlert,
  Users,
  Vote,
  X,
} from 'lucide-react'
import { AddTaskLink } from '../components/tasks/AddTaskLink'
import { GovernanceWheel } from '../components/council/GovernanceWheel'
import { MEETINGS_PER_YEAR } from '../data/meetingGovernance'
import { useCouncil } from '../hooks/useCouncil'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { useRepresentatives } from '../hooks/useRepresentatives'
import { useOrganisation } from '../hooks/useOrganisation'
import { useLearning } from '../hooks/useLearning'
import { useHse } from '../hooks/useHse'
import { useInternalControl } from '../hooks/useInternalControl'
import { useTasks } from '../hooks/useTasks'
import { formatLevel1AuditLine } from '../lib/level1Signature'
import type {
  AgendaItem,
  AuditEntryKind,
  BoardRole,
  CouncilMeeting,
  Election,
  QuarterSlot,
} from '../types/council'
import type { RepElection, RepresentativeMember, RepresentativeOfficeRole } from '../types/representatives'
import {
  ModuleDonutCard,
  type InsightSeg,
} from '../components/insights/ModuleInsightCharts'
import { useOrgMenu1Styles } from '../hooks/useOrgMenu1Styles'

const HERO_ACTION_CLASS =
  'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-none px-4 text-sm font-medium leading-none'
const R_FLAT = 'rounded-none'
const SETTINGS_THRESHOLD_BOX =
  'flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5'
const MENU1_ICON_ONLY_TAB =
  '!h-8 !w-8 !min-h-0 !min-w-0 !max-h-8 !max-w-8 !flex-none shrink-0 !justify-center !gap-0 !p-0'

const CAL_WEEKDAYS_NB = ['ma', 'ti', 'on', 'to', 'fr', 'lø', 'sø'] as const

function startOfCalendarMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addCalendarMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1)
}

function calendarGridForMonth(anchor: Date) {
  const y = anchor.getFullYear()
  const m = anchor.getMonth()
  const first = new Date(y, m, 1)
  const lastDay = new Date(y, m + 1, 0).getDate()
  const lead = (first.getDay() + 6) % 7
  const cells: ({ day: number } | null)[] = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= lastDay; d++) cells.push({ day: d })
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [active])
}

const tabs = [
  { id: 'overview' as const, label: 'Oversikt', icon: ClipboardList },
  { id: 'board' as const, label: 'Styre og Valg', icon: Users },
  { id: 'meetings' as const, label: 'Møter', icon: Calendar },
  { id: 'compliance' as const, label: 'Sjekkliste', icon: Gavel },
  { id: 'decisions' as const, label: 'Vedtaksregister', icon: ScrollText },
  { id: 'audit' as const, label: 'Revisjonslogg', icon: History, iconOnly: true as const },
] as const

const tabBlurbs: Record<(typeof tabs)[number]['id'], { kicker: string; description: string }> = {
  overview: {
    kicker: 'Status og fremdrift',
    description: 'Oversikt over styret, åpne valg og samsvar.',
  },
  board: {
    kicker: 'Styre og valg',
    description:
      'Valgt AMU-styre, 50/50-sammensetting, verneombud og digitale valg (AMU og arbeidstakerrepresentanter).',
  },
  meetings: {
    kicker: 'Møter og årshjul',
    description: 'Data-drevet møteplanlegger — auto-injisert agenda, distribusjonskontroll og oppgavegenerering.',
  },
  compliance: {
    kicker: 'Sjekkliste og samsvar',
    description: 'Strukturert sjekkliste med lovhenvisninger; legg til egne punkter.',
  },
  decisions: {
    kicker: 'Vedtaksregister',
    description: 'Alle formelle vedtak på tvers av møter — søkbart, filtrerbart og koblet til Kanban.',
  },
  audit: {
    kicker: 'Revisjonslogg',
    description: 'Hendelser i representasjons- og valgmodulen (append-only i demomodus).',
  },
}

function roleLabel(r: BoardRole) {
  switch (r) {
    case 'leader':
      return 'Leder'
    case 'deputy':
      return 'Nestleder'
    default:
      return 'Medlem'
  }
}

function officeLabel(role: RepresentativeOfficeRole): string {
  const map: Record<RepresentativeOfficeRole, string> = {
    employee_chair: 'Leder (AT)',
    employee_deputy: 'Nestleder (AT)',
    employee_member: 'Medlem (AT)',
    leadership_chair: 'Leder (AG)',
    leadership_deputy: 'Nestleder (AG)',
    leadership_member: 'Medlem (AG)',
  }
  return map[role]
}

function repCandidateDisplayName(
  election: RepElection,
  candidateIndex: number,
  realName: string,
  electionClosed: boolean,
): string {
  if (!election.anonymous || electionClosed) return realName
  return `Kandidat ${String.fromCharCode(65 + candidateIndex)}`
}

function repCandidateLetterIndex(election: RepElection, candidateId: string): number {
  return Math.max(0, election.candidates.findIndex((c) => c.id === candidateId))
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('no-NO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function partitionRepresentativeElections(elections: RepElection[]) {
  const supplementary = elections.filter(
    (e) => /supplerings|suppleringsvalg/i.test(e.title) || /2026/.test(e.title),
  )
  const suppIds = new Set(supplementary.map((e) => e.id))
  const at2024 = elections.filter((e) => /2024/.test(e.title) && !suppIds.has(e.id))
  const at24Ids = new Set(at2024.map((e) => e.id))
  const other = elections.filter((e) => !suppIds.has(e.id) && !at24Ids.has(e.id))
  return { supplementary, at2024, other }
}

export function CouncilModule() {
  const council = useCouncil()
  const { supabaseConfigured } = useOrgSetupContext()
  const rep = useRepresentatives()
  const org = useOrganisation()
  const learning = useLearning()
  const hse = useHse()
  const ic = useInternalControl()
  const { addTask } = useTasks()
  const { complianceThresholds: ct } = org

  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  type TabId = (typeof tabs)[number]['id']
  const tab: TabId =
    tabParam && tabs.some((x) => x.id === tabParam) ? (tabParam as TabId) : 'overview'

  useEffect(() => {
    if (tabParam === 'election') {
      queueMicrotask(() => setSearchParams({ tab: 'board' }, { replace: true }))
    }
  }, [tabParam, setSearchParams])

  const setTab = useCallback(
    (id: TabId) => {
      setSearchParams({ tab: id }, { replace: true })
    },
    [setSearchParams],
  )

  const menu1 = useOrgMenu1Styles()
  const openElectionsCount = useMemo(
    () => council.elections.filter((e) => e.status === 'open').length,
    [council.elections],
  )

  // Council state
  const [wheelYear, setWheelYear] = useState(() => new Date().getFullYear())
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null)
  /** Stable clock for pure render (dager til møte, leder-rotasjon). */
  const [uiNowAnchor] = useState(() => Date.now())
  const [newElectionTitle, setNewElectionTitle] = useState('')
  const [candidateInputs, setCandidateInputs] = useState<Record<string, string>>({})
  const [meetingForm, setMeetingForm] = useState({
    title: '',
    startsAt: '',
    location: '',
    governanceYear: new Date().getFullYear(),
    quarterSlot: 1 as QuarterSlot,
    applySuggestedAgenda: true,
    agendaText: '',
  })
  const [customItem, setCustomItem] = useState({ title: '', description: '', lawRef: '' })
  const [auditDraft, setAuditDraft] = useState({ kind: 'note' as AuditEntryKind, text: '', author: '' })

  // Invitation + attendance state
  const [inviteRecipients, setInviteRecipients] = useState<Record<string, string>>({})
  const [attendeesInput, setAttendeesInput] = useState<Record<string, string>>({})
  const [quorumInput, setQuorumInput] = useState<Record<string, boolean>>({})
  // Per-agenda-item minutes state
  const [itemMinutes, setItemMinutes] = useState<Record<string, { summary: string; decision: string }>>({})
  // Decisions search
  const [decisionSearch, setDecisionSearch] = useState('')
  const [newMeetingOpen, setNewMeetingOpen] = useState(false)
  const [meetingDetailOpen, setMeetingDetailOpen] = useState(false)
  const [decisionPanelId, setDecisionPanelId] = useState<string | null>(null)

  const councilOverlayOpen =
    (tab === 'meetings' && (newMeetingOpen || meetingDetailOpen)) ||
    (tab === 'decisions' && Boolean(decisionPanelId))
  useBodyScrollLock(councilOverlayOpen)

  useEffect(() => {
    if (!councilOverlayOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNewMeetingOpen(false)
        setMeetingDetailOpen(false)
        setDecisionPanelId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [councilOverlayOpen])

  useEffect(() => {
    queueMicrotask(() => {
      if (tab !== 'meetings') {
        setNewMeetingOpen(false)
        setMeetingDetailOpen(false)
      }
      if (tab !== 'decisions') setDecisionPanelId(null)
    })
  }, [tab])

  // Representative / Members state
  const [repElectionForm, setRepElectionForm] = useState({
    title: '',
    description: '',
    anonymous: true,
    seats: rep.settings.seatsPerSide,
    periodId: '' as string,
  })
  const [repCandInput, setRepCandInput] = useState<Record<string, string>>({})
  const [periodForm, setPeriodForm] = useState({ label: '', start: '', end: '' })
  const sortedRepAudit = useMemo(
    () => [...rep.auditTrail].sort((a, b) => a.at.localeCompare(b.at)),
    [rep.auditTrail],
  )

  const repElectionSections = useMemo(
    () => partitionRepresentativeElections(rep.elections),
    [rep.elections],
  )

  const complianceProgress = useMemo(() => {
    const total = council.compliance.length
    const done = council.compliance.filter((c) => c.done).length
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 }
  }, [council.compliance])

  const upcomingMeetings = useMemo(() => {
    return [...council.meetings]
      .filter((m) => m.status === 'planned')
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  }, [council.meetings])

  const meetingsThisYear = useMemo(() => {
    return council.meetings.filter(
      (m) => m.governanceYear === wheelYear && m.status !== 'cancelled',
    ).length
  }, [council.meetings, wheelYear])

  async function handleNewElection(e: FormEvent) {
    e.preventDefault()
    if (!newElectionTitle.trim()) return
    try {
      await council.addElection(newElectionTitle.trim())
      setNewElectionTitle('')
    } catch (err) {
      console.error(err)
    }
  }

  async function handleAddMeeting(e: FormEvent) {
    e.preventDefault()
    if (!meetingForm.title.trim() || !meetingForm.startsAt) return
    try {
      await council.addMeeting({
        title: meetingForm.title.trim(),
        startsAt: new Date(meetingForm.startsAt).toISOString(),
        location: meetingForm.location.trim() || 'TBD',
        governanceYear: meetingForm.governanceYear,
        quarterSlot: meetingForm.quarterSlot,
        applySuggestedAgenda: meetingForm.applySuggestedAgenda,
        agendaText: meetingForm.applySuggestedAgenda ? undefined : meetingForm.agendaText,
      })
      setMeetingForm((s) => ({
        ...s,
        title: '',
        startsAt: '',
        location: '',
        agendaText: '',
      }))
      setNewMeetingOpen(false)
    } catch (err) {
      console.error(err)
    }
  }

  const selectedMeeting = selectedMeetingId
    ? council.meetings.find((m) => m.id === selectedMeetingId)
    : null

  const decisionPanel = useMemo(
    () =>
      decisionPanelId ? council.allDecisions.find((d) => d.id === decisionPanelId) ?? null : null,
    [council.allDecisions, decisionPanelId],
  )

  // ── Live data for agenda injection ──────────────────────────────────────────

  // Last completed meeting date (for "since last meeting" context)
  const lastMeetingDate = useMemo(() => {
    const completed = council.meetings
      .filter((m) => m.status === 'completed')
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    return completed[0]?.startsAt ?? null
  }, [council.meetings])

  // Incidents since last meeting
  const incidentsSinceLastMeeting = useMemo(() => {
    if (!lastMeetingDate) return hse.incidents
    return hse.incidents.filter((i) => i.createdAt > lastMeetingDate)
  }, [hse.incidents, lastMeetingDate])

  const highSeverityIncidents = useMemo(
    () => incidentsSinceLastMeeting.filter((i) => i.severity === 'high' || i.severity === 'critical'),
    [incidentsSinceLastMeeting],
  )

  // Latest sick leave %
  const latestSickLeavePct = useMemo(() => {
    const active = hse.sickLeaveCases.filter((c) => c.status === 'active' || c.status === 'partial')
    return active.length
  }, [hse.sickLeaveCases])

  // Open high ROS risks
  const openHighRisks = useMemo(
    () => ic.rosAssessments
      .flatMap((r) => r.rows.filter((row) => !row.done && row.riskScore >= 12)
        .map((row) => ({ ...row, assessment: r.title }))),
    [ic.rosAssessments],
  )

  // 90-day term expiry warning for representatives
  const expiringReps = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + 90)
    return rep.members.filter((m) => {
      if (!m.termUntil) return false
      const expiry = new Date(m.termUntil)
      return expiry <= cutoff && expiry >= new Date()
    })
  }, [rep.members])

  // Chairman rotation check (12-month rule)
  const chairmanRotationNeeded = useMemo(() => {
    const chair = council.board.find((m) => m.role === 'leader')
    if (!chair?.electedAt) return false
    const elapsed = (uiNowAnchor - new Date(chair.electedAt).getTime()) / (1000 * 60 * 60 * 24 * 365)
    return elapsed >= 1
  }, [council.board, uiNowAnchor])

  // 7-day agenda distribution warning for upcoming meetings
  const meetingsNeedingDistribution = useMemo(() => {
    const now = new Date()
    const sevenDaysFromNow = new Date(now)
    sevenDaysFromNow.setDate(now.getDate() + 7)
    return council.meetings.filter((m) => {
      if (m.status !== 'planned') return false
      if (m.invitationSentAt) return false
      const meetingDate = new Date(m.startsAt)
      return meetingDate <= sevenDaysFromNow && meetingDate > now
    })
  }, [council.meetings])

  const nextMeeting = upcomingMeetings[0] ?? null

  const meetingsPlannedThisYear = useMemo(
    () =>
      council.meetings.filter((m) => m.governanceYear === wheelYear && m.status === 'planned').length,
    [council.meetings, wheelYear],
  )
  const meetingsCompletedThisYear = useMemo(
    () =>
      council.meetings.filter((m) => m.governanceYear === wheelYear && m.status === 'completed').length,
    [council.meetings, wheelYear],
  )

  const electionsOpenCount = useMemo(
    () => council.elections.filter((e) => e.status === 'open').length,
    [council.elections],
  )
  const electionsClosedCount = useMemo(
    () => council.elections.filter((e) => e.status === 'closed').length,
    [council.elections],
  )

  const meetingsThisWeekCount = useMemo(() => {
    const now = new Date()
    const end = new Date(now)
    end.setDate(end.getDate() + 7)
    return council.meetings.filter((m) => {
      if (m.status !== 'planned') return false
      const t = new Date(m.startsAt).getTime()
      return t >= now.getTime() && t <= end.getTime()
    }).length
  }, [council.meetings])

  const councilOverviewKpis = useMemo(
    () => [
      {
        title: 'Styre',
        sub: 'Registrerte medlemmer',
        value: String(council.board.length),
      },
      {
        title: 'Valg',
        sub: 'Åpne nå',
        value: String(electionsOpenCount),
      },
      {
        title: 'Samsvar',
        sub: 'Sjekkliste fullført',
        value: `${complianceProgress.pct}%`,
      },
      {
        title: 'Møter',
        sub: `Planlagt i ${wheelYear}`,
        value: `${meetingsPlannedThisYear} / ${MEETINGS_PER_YEAR}`,
      },
    ],
    [
      council.board.length,
      complianceProgress.pct,
      electionsOpenCount,
      meetingsPlannedThisYear,
      wheelYear,
    ],
  )

  const councilElectionSegments = useMemo(() => {
    const palette = ['#059669', '#94a3b8']
    const entries: InsightSeg[] = [
      { label: 'Åpne valg', value: electionsOpenCount, color: palette[0] },
      { label: 'Avsluttede', value: electionsClosedCount, color: palette[1] },
    ].filter((x) => x.value > 0)
    const total = entries.reduce((s, x) => s + x.value, 0)
    return { entries, total }
  }, [electionsClosedCount, electionsOpenCount])

  const councilMeetingYearSegments = useMemo(() => {
    const palette = ['#0284c7', '#059669', '#94a3b8']
    const cancelled = council.meetings.filter(
      (m) => m.governanceYear === wheelYear && m.status === 'cancelled',
    ).length
    const entries: InsightSeg[] = [
      { label: 'Planlagt', value: meetingsPlannedThisYear, color: palette[0] },
      { label: 'Gjennomført', value: meetingsCompletedThisYear, color: palette[1] },
      { label: 'Avlyst', value: cancelled, color: palette[2] },
    ].filter((x) => x.value > 0)
    const total = entries.reduce((s, x) => s + x.value, 0)
    return { entries, total }
  }, [council.meetings, meetingsCompletedThisYear, meetingsPlannedThisYear, wheelYear])

  const councilComplianceSegments = useMemo(() => {
    const done = complianceProgress.done
    const todo = Math.max(0, complianceProgress.total - done)
    const palette = ['#059669', '#e5e7eb']
    const entries: InsightSeg[] = [
      { label: 'Oppfylt', value: done, color: palette[0] },
      { label: 'Gjenstår', value: todo, color: palette[1] },
    ].filter((x) => x.value > 0)
    const total = entries.reduce((s, x) => s + x.value, 0)
    return { entries, total }
  }, [complianceProgress.done, complianceProgress.total])

  const councilLiveSignalsSegments = useMemo(() => {
    const palette = ['#dc2626', '#f59e0b', '#ea580c']
    const entries: InsightSeg[] = [
      { label: 'Hendelser (periode)', value: incidentsSinceLastMeeting.length, color: palette[0] },
      { label: 'Aktive sykefravær', value: latestSickLeavePct, color: palette[1] },
      { label: 'ROS høyrisiko (åpen)', value: openHighRisks.length, color: palette[2] },
    ].filter((x) => x.value > 0)
    const total = entries.reduce((s, x) => s + x.value, 0)
    return { entries, total }
  }, [incidentsSinceLastMeeting.length, latestSickLeavePct, openHighRisks.length])

  const [interviewCalMonth, setInterviewCalMonth] = useState(() => startOfCalendarMonth(new Date()))

  useEffect(() => {
    if (!nextMeeting) return
    try {
      const d = new Date(nextMeeting.startsAt)
      if (!Number.isNaN(d.getTime())) {
        queueMicrotask(() => setInterviewCalMonth(startOfCalendarMonth(d)))
      }
    } catch {
      /* ignore */
    }
  }, [nextMeeting])

  const nextMeetingCalendarMeta = useMemo(() => {
    if (!nextMeeting) return null
    try {
      const d = new Date(nextMeeting.startsAt)
      if (Number.isNaN(d.getTime())) return null
      return {
        day: d.getDate(),
        month: d.getMonth(),
        year: d.getFullYear(),
        weekdayLabel: d.toLocaleDateString('no-NO', { weekday: 'long' }),
        dayMonthLabel: d.toLocaleDateString('no-NO', { day: 'numeric', month: 'long' }),
        timeLabel: d.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' }),
      }
    } catch {
      return null
    }
  }, [nextMeeting])

  const interviewCalCells = useMemo(() => calendarGridForMonth(interviewCalMonth), [interviewCalMonth])
  const interviewCalTitle = useMemo(
    () =>
      interviewCalMonth.toLocaleDateString('no-NO', {
        month: 'long',
        year: 'numeric',
      }),
    [interviewCalMonth],
  )

  // ── Task generator from agenda decisions ─────────────────────────────────────

  function createTaskFromDecision(description: string, responsible: string, dueDate: string, meetingTitle: string) {
    addTask({
      title: description.slice(0, 120),
      description: `Vedtak fra AMU-møte: ${meetingTitle}`,
      status: 'todo',
      assignee: responsible,
      ownerRole: 'AMU-vedtak',
      dueDate,
      module: 'council',
      sourceType: 'council_meeting',
      requiresManagementSignOff: false,
    })
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <nav className="mb-4 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
        <span>
          <Link to="/" className="text-neutral-500 hover:text-[#1a3d32]">
            Workspace
          </Link>
          <span className="mx-2 text-neutral-400">→</span>
          <span className="font-medium text-neutral-800">Arbeidsmiljøråd</span>
        </span>
      </nav>

      {council.error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{council.error}</p>
      )}
      {council.loading && supabaseConfigured && (
        <p className="mb-4 text-sm text-neutral-500">Laster rådsdata…</p>
      )}
      {rep.error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{rep.error}</p>
      )}
      {rep.loading && supabaseConfigured && (
        <p className="mb-4 text-sm text-neutral-500">Laster representasjonsdata…</p>
      )}

      <div className="flex flex-col gap-6 border-b border-neutral-200/80 pb-8 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <div className="min-w-0 flex-1">
          <h1
            className="text-2xl font-semibold text-neutral-900 md:text-3xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            Arbeidsmiljøråd
          </h1>
          <p className="mt-1 text-sm font-medium text-[#1a3d32]/90">{tabBlurbs[tab].kicker}</p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600">
            Styre, valg, årshjul med {MEETINGS_PER_YEAR} ordinære møter per år, agenda, forberedelse og revisjonslogg.{' '}
            {tabBlurbs[tab].description} Verktøyet erstatter ikke juridisk rådgivning.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className={`${HERO_ACTION_CLASS} bg-neutral-200/80 text-neutral-800`}>
              {council.board.length} styremedlemmer
            </span>
            <span className={`${HERO_ACTION_CLASS} bg-neutral-200/80 text-neutral-800`}>
              {openElectionsCount} åpne valg
            </span>
            {meetingsThisWeekCount > 0 ? (
              <span className={`${HERO_ACTION_CLASS} bg-amber-100 text-amber-950`}>
                <Calendar className="size-4 shrink-0" />
                {meetingsThisWeekCount} møte{meetingsThisWeekCount > 1 ? 'r' : ''} denne uken
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setTab('meetings')}
              className={`${HERO_ACTION_CLASS} bg-[#1a3d32] text-white shadow-sm hover:bg-[#142e26]`}
            >
              <Plus className="size-4 shrink-0" />
              Planlegg møte
            </button>
          </div>
          {council.board.length > 0 ? (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Styre / team</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {council.board.map((m) => (
                  <span
                    key={m.id}
                    className={`${R_FLAT} border border-neutral-200/80 bg-neutral-50 px-2.5 py-1 text-sm font-medium text-neutral-800`}
                  >
                    {m.name}
                    <span className="ml-1.5 text-xs font-normal text-neutral-500">· {roleLabel(m.role)}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div
          className={`${R_FLAT} flex size-[7.5rem] shrink-0 items-center justify-center border border-neutral-200/80 bg-[#faf8f4] text-[#1a3d32] sm:mt-1`}
          aria-hidden
        >
          <Scale className="size-14 opacity-90" strokeWidth={1.25} />
        </div>
      </div>

      <div className={menu1.barOuterClass} style={menu1.barStyle}>
        <div className={menu1.innerRowClass}>
          {tabs.map((tabItem) => {
            const { id, label, icon: Icon } = tabItem
            const iconOnly = 'iconOnly' in tabItem && tabItem.iconOnly === true
            const active = tab === id
            const tb = menu1.tabButton(active)
            const badge = id === 'board' && openElectionsCount > 0 ? openElectionsCount : undefined
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`${tb.className} ${iconOnly ? MENU1_ICON_ONLY_TAB : ''}`}
                style={tb.style}
                title={iconOnly ? label : undefined}
                aria-label={iconOnly ? label : undefined}
              >
                <Icon className="size-4 shrink-0 opacity-90" aria-hidden={!!iconOnly} />
                {!iconOnly ? <span className="whitespace-nowrap">{label}</span> : null}
                {badge != null && !iconOnly ? (
                  <span className="rounded-none bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                    {badge}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      {tab === 'overview' && (
        <div className="mt-6 space-y-10">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {councilOverviewKpis.map((item) => (
              <div key={item.title} className={SETTINGS_THRESHOLD_BOX} style={menu1.barStyle}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/85">{item.title}</p>
                <p className="mt-1 text-xs text-white/70">{item.sub}</p>
                <p className="mt-2 text-lg font-semibold tabular-nums text-white">{item.value}</p>
              </div>
            ))}
          </div>

          <section>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Rådsinnsikt</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-9">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <ModuleDonutCard
                    title="Valg"
                    subtitle="Åpne og avsluttede"
                    segments={councilElectionSegments.entries}
                    total={councilElectionSegments.total}
                    emptyHint="Ingen valg registrert."
                  />
                  <ModuleDonutCard
                    title={`Møter ${wheelYear}`}
                    subtitle="Planlagt, gjennomført og avlyst"
                    segments={councilMeetingYearSegments.entries}
                    total={councilMeetingYearSegments.total}
                    emptyHint="Ingen møter i året."
                  />
                  <ModuleDonutCard
                    title="Samsvarssjekk"
                    subtitle="Oppfylt vs. gjenstående"
                    segments={councilComplianceSegments.entries}
                    total={councilComplianceSegments.total}
                    emptyHint="Ingen sjekklistepunkter."
                  />
                  <ModuleDonutCard
                    title="Signaler siden siste møte"
                    subtitle="Hendelser, sykefravær, ROS"
                    segments={councilLiveSignalsSegments.entries}
                    total={councilLiveSignalsSegments.total}
                    emptyHint="Ingen signaler å vise."
                  />
                </div>

                <p className="text-sm text-neutral-600">
                  Registrerte ordinære møter i {wheelYear}: <strong>{meetingsThisYear}</strong> / {MEETINGS_PER_YEAR}{' '}
                  (justér år under «Møter»).
                </p>
                <div className={`${R_FLAT} h-2 overflow-hidden bg-neutral-200`}>
                  <div
                    className="h-full bg-[#c9a227] transition-all"
                    style={{ width: `${complianceProgress.pct}%` }}
                  />
                </div>
                <p className="text-xs text-neutral-500">
                  {complianceProgress.done} av {complianceProgress.total} punkter i samsvarssjekken er markert som
                  oppfylt.
                </p>

                <div className={`${R_FLAT} border border-neutral-200/90 bg-white p-5 shadow-sm`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Lovpålagte terskler (AML 2024)
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`${R_FLAT} bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600`}>
                      {ct.totalEmployeeCount} ansatte
                    </span>
                    {ct.requiresVerneombud ? (
                      <span
                        className={`${R_FLAT} inline-flex items-center gap-1 bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800`}
                      >
                        <CheckCircle2 className="size-3" />
                        Verneombud lovpålagt
                      </span>
                    ) : (
                      <span className={`${R_FLAT} bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600`}>
                        Verneombud: &lt;5 ansatte
                      </span>
                    )}
                    {ct.requiresAmu ? (
                      <span
                        className={`${R_FLAT} inline-flex items-center gap-1 bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800`}
                      >
                        <CheckCircle2 className="size-3" />
                        AMU lovpålagt (≥30)
                      </span>
                    ) : ct.mayRequestAmu ? (
                      <span
                        className={`${R_FLAT} inline-flex items-center gap-1 bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800`}
                      >
                        <AlertTriangle className="size-3" />
                        AMU kan kreves (10–29)
                      </span>
                    ) : (
                      <span className={`${R_FLAT} bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600`}>
                        AMU: &lt;10 ansatte
                      </span>
                    )}
                  </div>
                  {ct.totalEmployeeCount === 0 && (
                    <p className="mt-2 text-xs text-amber-800">
                      Antall ansatte ikke konfigurert —{' '}
                      <Link to="/organisation" className="font-medium underline">
                        oppdater i Organisasjon
                      </Link>
                      .
                    </p>
                  )}
                </div>

                <div className={`${R_FLAT} border border-neutral-200/90 bg-white p-5 shadow-sm`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-neutral-800">AMU-sammensetting</span>
                    {rep.validation.ok ? (
                      <span
                        className={`${R_FLAT} inline-flex items-center gap-1.5 bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-900`}
                      >
                        <CheckCircle2 className="size-3.5" />
                        Krav oppfylt
                      </span>
                    ) : (
                      <span
                        className={`${R_FLAT} inline-flex items-center gap-1.5 bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-950`}
                      >
                        <AlertTriangle className="size-3.5" />
                        {rep.validation.issues.length} avvik
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-neutral-500">
                    {rep.validation.empCount} AT · {rep.validation.leadCount} AG · Mål: {rep.validation.seatsPerSide}{' '}
                    per side
                  </p>
                </div>
              </div>

              <div className="lg:col-span-3">
                <div
                  className={`${R_FLAT} border border-neutral-200/90 bg-white p-5 shadow-sm`}
                  style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.04)' }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Møter</p>
                  {meetingsThisWeekCount > 0 ? (
                    <div className="mt-3 border border-orange-200/90 bg-orange-50/90 px-3 py-2.5 text-sm text-orange-950">
                      <span className="font-semibold text-orange-900">{meetingsThisWeekCount}</span>{' '}
                      {meetingsThisWeekCount === 1 ? 'møte planlagt' : 'møter planlagt'} de neste 7 dagene.
                    </div>
                  ) : (
                    <div className="mt-3 border border-neutral-200/80 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-600">
                      Ingen planlagte møter de neste 7 dagene.
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                    <span className="min-w-0 truncate text-sm font-semibold capitalize text-neutral-900">
                      {interviewCalTitle}
                    </span>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => setInterviewCalMonth((m) => addCalendarMonths(m, -1))}
                        className={`${R_FLAT} p-1.5 text-neutral-500 hover:bg-neutral-100`}
                        aria-label="Forrige måned"
                      >
                        <ChevronLeft className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setInterviewCalMonth((m) => addCalendarMonths(m, 1))}
                        className={`${R_FLAT} p-1.5 text-neutral-500 hover:bg-neutral-100`}
                        aria-label="Neste måned"
                      >
                        <ChevronRight className="size-4" />
                      </button>
                    </div>
                  </div>

                  {nextMeeting && nextMeetingCalendarMeta ? (
                    <p className="mt-3 text-xs capitalize text-neutral-500">
                      {nextMeetingCalendarMeta.weekdayLabel}, {nextMeetingCalendarMeta.dayMonthLabel}
                    </p>
                  ) : null}

                  <div className="mt-2 grid grid-cols-7 gap-y-1 text-center text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                    {CAL_WEEKDAYS_NB.map((d) => (
                      <span key={d}>{d}</span>
                    ))}
                  </div>
                  <div className="mt-1 grid grid-cols-7 gap-y-1 text-center text-sm">
                    {interviewCalCells.map((cell, idx) => {
                      const isNext =
                        cell &&
                        nextMeetingCalendarMeta &&
                        interviewCalMonth.getFullYear() === nextMeetingCalendarMeta.year &&
                        interviewCalMonth.getMonth() === nextMeetingCalendarMeta.month &&
                        cell.day === nextMeetingCalendarMeta.day
                      return (
                        <div key={idx} className="flex h-9 items-center justify-center">
                          {cell ? (
                            <span
                              className={`relative flex size-8 items-center justify-center tabular-nums ${
                                isNext
                                  ? 'bg-[#c9a227] font-semibold text-white'
                                  : 'text-neutral-700'
                              } ${R_FLAT}`}
                            >
                              {cell.day}
                              {isNext ? (
                                <span className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-white" />
                              ) : null}
                            </span>
                          ) : (
                            <span />
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {nextMeeting && nextMeetingCalendarMeta ? (
                    <div className="mt-5 border-t border-neutral-100 pt-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-neutral-900">{nextMeeting.title}</p>
                          <p className="mt-1 text-sm text-neutral-600">{nextMeeting.location || 'Sted ikke satt'}</p>
                          {nextMeeting.agendaItems[0] ? (
                            <p className="mt-2 text-xs text-neutral-500">
                              Første punkt: {nextMeeting.agendaItems[0].title}
                            </p>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-[#c9a227]">
                          {nextMeetingCalendarMeta.timeLabel}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setTab('meetings')
                          setSelectedMeetingId(nextMeeting.id)
                        }}
                        className="mt-4 text-left text-[10px] font-bold uppercase tracking-wider text-[#1a3d32] hover:underline"
                      >
                        Åpne møte →
                      </button>
                    </div>
                  ) : (
                    <p className="mt-5 border-t border-neutral-100 pt-4 text-sm text-neutral-500">
                      Ingen planlagte møter.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {tab === 'board' && (
        <div className="mt-8 space-y-10">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
            {/* Styre — 3/4 */}
            <div className="space-y-8 lg:col-span-9">
              <div>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <h2
                    className="text-xl font-semibold text-neutral-900 md:text-2xl"
                    style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
                  >
                    Styre
                  </h2>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    AMU · valgt styre
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {council.board.map((m) => (
                    <div
                      key={m.id}
                      className={`${R_FLAT} flex flex-col border border-neutral-200/90 bg-white p-4 shadow-sm`}
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-neutral-100 pb-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-neutral-900">{m.name}</p>
                          <p className="mt-0.5 text-xs text-neutral-500">{roleLabel(m.role)}</p>
                        </div>
                        <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-hidden />
                      </div>
                      <div className="mt-3 space-y-2 text-xs text-neutral-600">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                            Periode
                          </span>
                          <span className="font-medium tabular-nums text-neutral-800">
                            {m.termUntil ?? '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                            Status
                          </span>
                          <span className="rounded-none bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                            Aktiv
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {council.board.length === 0 ? (
                    <p className="text-sm text-neutral-500 sm:col-span-2 xl:col-span-3">
                      Ingen styremedlemmer registrert — avslutt et AMU-valg for å fylle styret.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="border-t border-neutral-200 pt-8">
                <div className="mb-6 flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold text-neutral-900">AMU og sammensetting</h2>
                  {rep.validation.ok ? (
                    <span
                      className={`${R_FLAT} inline-flex items-center gap-2 bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-900`}
                    >
                      <CheckCircle2 className="size-4" />
                      Krav oppfylt
                    </span>
                  ) : (
                    <span
                      className={`${R_FLAT} inline-flex items-center gap-2 bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-950`}
                    >
                      <AlertTriangle className="size-4" />
                      {rep.validation.issues.length} avvik
                    </span>
                  )}
                </div>

                <section className={`${R_FLAT} border border-neutral-200/90 bg-white p-5 shadow-sm`}>
                  <h3 className="font-semibold text-neutral-900">Innstillinger for sammensetting</h3>
                  <div className="mt-4 flex flex-wrap gap-6">
                    <label className="text-sm">
                      Seter per side (50/50)
                      <input
                        type="number"
                        min={1}
                        max={9}
                        value={rep.settings.seatsPerSide}
                        onChange={(e) =>
                          rep.updateSettings({ seatsPerSide: Number(e.target.value) || 1 })
                        }
                        className={`${R_FLAT} ml-2 w-16 border border-neutral-200 px-2 py-1`}
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={rep.settings.requireChairAndDeputy}
                        onChange={(e) => rep.updateSettings({ requireChairAndDeputy: e.target.checked })}
                        className="size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]"
                      />
                      Krever leder og nestleder på begge sider
                    </label>
                  </div>
                  {!rep.validation.ok && (
                    <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-amber-900">
                      {rep.validation.issues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  )}
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                    <div className={`${R_FLAT} bg-[#faf8f4] p-3`}>
                      <dt className="text-neutral-500">Seter per side (mål)</dt>
                      <dd className="text-lg font-semibold text-[#1a3d32]">{rep.validation.seatsPerSide}</dd>
                    </div>
                    <div className={`${R_FLAT} bg-[#faf8f4] p-3`}>
                      <dt className="text-neutral-500">Registrerte perioder</dt>
                      <dd className="text-lg font-semibold text-[#1a3d32]">{rep.periodCount}</dd>
                    </div>
                    <div className={`${R_FLAT} bg-[#faf8f4] p-3`}>
                      <dt className="text-neutral-500">AT-representanter</dt>
                      <dd className="font-medium text-neutral-900">{rep.validation.empCount}</dd>
                    </div>
                    <div className={`${R_FLAT} bg-[#faf8f4] p-3`}>
                      <dt className="text-neutral-500">AG-representanter</dt>
                      <dd className="font-medium text-neutral-900">{rep.validation.leadCount}</dd>
                    </div>
                  </dl>
                </section>

                {ct.requiresVerneombud && !rep.members.some((m) => m.isVerneombud) && (
                  <div className={`${R_FLAT} mt-4 flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-3`}>
                    <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    <p className="text-sm text-amber-900">
                      <strong>Mangler verneombud.</strong> Virksomheten har {ct.totalEmployeeCount} ansatte — verneombud er
                      lovpålagt (AML §6-1). Merk en representant som verneombud i listen nedenfor.
                    </p>
                  </div>
                )}

                {(() => {
                  const soon = rep.members.filter((m) => {
                    if (!m.termUntil) return false
                    const days = Math.ceil((new Date(m.termUntil).getTime() - uiNowAnchor) / 86400000)
                    return days <= 60 && days >= 0
                  })
                  if (!soon.length) return null
                  return (
                    <div className={`${R_FLAT} mt-3 flex items-start gap-3 border border-sky-200 bg-sky-50 px-4 py-3`}>
                      <Bell className="mt-0.5 size-4 shrink-0 text-sky-600" />
                      <p className="text-sm text-sky-900">
                        <strong>{soon.length} verv utløper innen 60 dager:</strong>{' '}
                        {soon.map((m) => `${m.name} (${m.termUntil})`).join(', ')}. Planlegg nyvalg.
                      </p>
                    </div>
                  )
                })()}

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <MemberColumn
                    title="Arbeidstakere (valgt)"
                    members={rep.members.filter((m) => m.side === 'employee')}
                    onUpdate={rep.updateMember}
                    learning={learning}
                  />
                  <MemberColumn
                    title="Arbeidsgiver (oppnevnt)"
                    members={rep.members.filter((m) => m.side === 'leadership')}
                    onUpdate={rep.updateMember}
                    onAdd={rep.addLeadershipPlaceholder}
                    learning={learning}
                  />
                </div>

                <div className="mt-4 flex justify-start">
                  <AddTaskLink
                    title="Oppfølging representasjon / AMU"
                    module="members"
                    sourceType="representatives"
                    ownerRole="Tillitsvalgt"
                    requiresManagementSignOff
                  />
                </div>
              </div>
            </div>

            {/* Valg — ca. 1/3, sidebar-stil */}
            <aside className={`${R_FLAT} border border-neutral-200/90 bg-[#faf8f4]/80 lg:col-span-3`}>
              <div className="border-b border-neutral-200/80 bg-white px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Valg</p>
                <p className="mt-1 text-xs text-neutral-500">Arbeidstakerrepresentanter og AMU-valg</p>
              </div>
              <div className="space-y-6 px-4 py-5">
                {expiringReps.length > 0 && (
                  <div className={`${R_FLAT} border border-amber-200 bg-orange-50/90 px-3 py-2.5 text-xs text-orange-950`}>
                    <strong>Verv utløper snart:</strong>{' '}
                    {expiringReps.map((m) => `${m.name} (${m.termUntil})`).join(' · ')}
                  </div>
                )}

                {chairmanRotationNeeded && (
                  <div className={`${R_FLAT} border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-950`}>
                    <strong>Møteleder bør roteres</strong> (12 måneder). Vurder ny leder fra AG- eller AT-siden.
                  </div>
                )}

                <section>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Nytt valg (arbeidstakerrepresentanter)
                  </p>
                  <form
                    className="mt-3 space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (!repElectionForm.title.trim()) return
                      rep.createElection(
                        repElectionForm.title,
                        repElectionForm.description,
                        repElectionForm.anonymous,
                        repElectionForm.seats,
                        repElectionForm.periodId || undefined,
                      )
                      setRepElectionForm((s) => ({ ...s, title: '', description: '' }))
                    }}
                  >
                    <input
                      value={repElectionForm.title}
                      onChange={(e) => setRepElectionForm((s) => ({ ...s, title: e.target.value }))}
                      placeholder="Tittel"
                      className={`${R_FLAT} w-full border border-neutral-200 bg-white px-3 py-2 text-sm`}
                      required
                    />
                    <textarea
                      value={repElectionForm.description}
                      onChange={(e) => setRepElectionForm((s) => ({ ...s, description: e.target.value }))}
                      placeholder="Beskrivelse"
                      rows={2}
                      className={`${R_FLAT} w-full border border-neutral-200 bg-white px-3 py-2 text-sm`}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min={1}
                        max={9}
                        value={repElectionForm.seats}
                        onChange={(e) =>
                          setRepElectionForm((s) => ({ ...s, seats: Number(e.target.value) || 1 }))
                        }
                        className={`${R_FLAT} border border-neutral-200 bg-white px-2 py-2 text-sm`}
                      />
                      <select
                        value={repElectionForm.periodId}
                        onChange={(e) => setRepElectionForm((s) => ({ ...s, periodId: e.target.value }))}
                        className={`${R_FLAT} border border-neutral-200 bg-white px-2 py-2 text-sm`}
                      >
                        <option value="">Periode …</option>
                        {rep.periods.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-neutral-700">
                      <input
                        type="checkbox"
                        checked={repElectionForm.anonymous}
                        onChange={(e) => setRepElectionForm((s) => ({ ...s, anonymous: e.target.checked }))}
                        className="size-4 rounded border-neutral-300"
                      />
                      Anonym stemmegivning
                    </label>
                    <button
                      type="submit"
                      className={`${R_FLAT} w-full bg-[#1a3d32] py-2.5 text-sm font-medium text-white hover:bg-[#142e26]`}
                    >
                      Opprett valg
                    </button>
                  </form>
                </section>

                <section className="border-t border-neutral-200/80 pt-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                      Suppleringsvalg arbeidstakerrepresentant 2026
                    </p>
                    <span className="text-[10px] text-neutral-400">{repElectionSections.supplementary.length}</span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {repElectionSections.supplementary.map((el) => (
                      <RepElectionCard
                        key={el.id}
                        election={el}
                        candDraft={repCandInput[el.id] ?? ''}
                        setCandDraft={(v) => setRepCandInput((s) => ({ ...s, [el.id]: v }))}
                        onAddCandidate={() => {
                          const name = (repCandInput[el.id] ?? '').trim()
                          if (!name) return
                          rep.addCandidate(el.id, name)
                          setRepCandInput((s) => ({ ...s, [el.id]: '' }))
                        }}
                        onOpen={() => rep.openElection(el.id)}
                        onVote={(cid) => rep.vote(el.id, cid)}
                        onClose={() => rep.closeElectionAndSync(el.id)}
                        compact
                      />
                    ))}
                    {repElectionSections.supplementary.length === 0 ? (
                      <p className="text-xs text-neutral-500">Ingen suppleringsvalg (matcher tittel «suppleringsvalg» eller «2026»).</p>
                    ) : null}
                  </div>
                </section>

                <section className="border-t border-neutral-200/80 pt-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                      Valg arbeidstakerrepresentanter 2024
                    </p>
                    <span className="text-[10px] text-neutral-400">{repElectionSections.at2024.length}</span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {repElectionSections.at2024.map((el) => (
                      <RepElectionCard
                        key={el.id}
                        election={el}
                        candDraft={repCandInput[el.id] ?? ''}
                        setCandDraft={(v) => setRepCandInput((s) => ({ ...s, [el.id]: v }))}
                        onAddCandidate={() => {
                          const name = (repCandInput[el.id] ?? '').trim()
                          if (!name) return
                          rep.addCandidate(el.id, name)
                          setRepCandInput((s) => ({ ...s, [el.id]: '' }))
                        }}
                        onOpen={() => rep.openElection(el.id)}
                        onVote={(cid) => rep.vote(el.id, cid)}
                        onClose={() => rep.closeElectionAndSync(el.id)}
                        compact
                      />
                    ))}
                    {repElectionSections.at2024.length === 0 ? (
                      <p className="text-xs text-neutral-500">Ingen valg med «2024» i tittelen.</p>
                    ) : null}
                  </div>
                </section>

                {repElectionSections.other.length > 0 && (
                  <section className="border-t border-neutral-200/80 pt-5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Øvrige valg</p>
                    <div className="mt-3 space-y-3">
                      {repElectionSections.other.map((el) => (
                        <RepElectionCard
                          key={el.id}
                          election={el}
                          candDraft={repCandInput[el.id] ?? ''}
                          setCandDraft={(v) => setRepCandInput((s) => ({ ...s, [el.id]: v }))}
                          onAddCandidate={() => {
                            const name = (repCandInput[el.id] ?? '').trim()
                            if (!name) return
                            rep.addCandidate(el.id, name)
                            setRepCandInput((s) => ({ ...s, [el.id]: '' }))
                          }}
                          onOpen={() => rep.openElection(el.id)}
                          onVote={(cid) => rep.vote(el.id, cid)}
                          onClose={() => rep.closeElectionAndSync(el.id)}
                          compact
                        />
                      ))}
                    </div>
                  </section>
                )}

                <section className="border-t border-neutral-200/80 pt-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Valgperioder</p>
                  <form
                    className="mt-3 flex flex-col gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (!periodForm.label.trim() || !periodForm.start || !periodForm.end) return
                      rep.addPeriod(periodForm.label, periodForm.start, periodForm.end)
                      setPeriodForm({ label: '', start: '', end: '' })
                    }}
                  >
                    <input
                      placeholder="Navn (f.eks. 2026–2028)"
                      value={periodForm.label}
                      onChange={(e) => setPeriodForm((s) => ({ ...s, label: e.target.value }))}
                      className={`${R_FLAT} border border-neutral-200 bg-white px-3 py-2 text-sm`}
                      required
                    />
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="date"
                        value={periodForm.start}
                        onChange={(e) => setPeriodForm((s) => ({ ...s, start: e.target.value }))}
                        className={`${R_FLAT} min-w-0 flex-1 border border-neutral-200 bg-white px-2 py-2 text-sm`}
                        required
                      />
                      <input
                        type="date"
                        value={periodForm.end}
                        onChange={(e) => setPeriodForm((s) => ({ ...s, end: e.target.value }))}
                        className={`${R_FLAT} min-w-0 flex-1 border border-neutral-200 bg-white px-2 py-2 text-sm`}
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className={`${R_FLAT} bg-[#1a3d32] py-2 text-sm font-medium text-white hover:bg-[#142e26]`}
                    >
                      Legg til periode
                    </button>
                  </form>
                  <ul className="mt-3 space-y-2 border-t border-neutral-200/60 pt-3">
                    {rep.periods.map((p) => (
                      <li
                        key={p.id}
                        className={`${R_FLAT} bg-white/80 px-3 py-2 text-xs text-neutral-700 ring-1 ring-neutral-200/80`}
                      >
                        <span className="font-semibold text-neutral-900">{p.label}</span>
                        <span className="mt-1 block text-neutral-500">
                          {p.startDate} — {p.endDate}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="border-t border-neutral-200/80 pt-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">AMU-valg (modul)</p>
                  <form onSubmit={handleNewElection} className="mt-3 flex flex-col gap-2">
                    <input
                      value={newElectionTitle}
                      onChange={(e) => setNewElectionTitle(e.target.value)}
                      placeholder="Valg tittel"
                      className={`${R_FLAT} border border-neutral-200 bg-white px-3 py-2 text-sm`}
                    />
                    <button
                      type="submit"
                      className={`${R_FLAT} inline-flex items-center justify-center gap-2 border border-neutral-800 bg-white py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50`}
                    >
                      <Plus className="size-4" />
                      Opprett AMU-valg
                    </button>
                  </form>
                  <div className="mt-4 space-y-4">
                    {council.elections.map((el) => (
                      <ElectionCard
                        key={el.id}
                        election={el}
                        candidateDraft={candidateInputs[el.id] ?? ''}
                        setCandidateDraft={(v) => setCandidateInputs((s) => ({ ...s, [el.id]: v }))}
                        onAddCandidate={() => {
                          const name = (candidateInputs[el.id] ?? '').trim()
                          if (!name) return
                          council.addCandidate(el.id, name)
                          setCandidateInputs((s) => ({ ...s, [el.id]: '' }))
                        }}
                        onVote={(cid) => council.vote(el.id, cid)}
                        onClose={() => council.closeElection(el.id)}
                      />
                    ))}
                  </div>
                </section>
              </div>
            </aside>
          </div>
        </div>
      )}

      {tab === 'meetings' && (
        <div className="mt-8 space-y-8">

          {/* ── 7-day distribution warning ───────────────────────────────── */}
          {meetingsNeedingDistribution.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900">
                  Frist for utsending av saksliste — {meetingsNeedingDistribution.length} møte{meetingsNeedingDistribution.length > 1 ? 'r' : ''}
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  Innkalling og agenda skal sendes til AMU-medlemmene minst 7 dager før møtet
                  (Forskrift om organisering, ledelse og medvirkning §3-2).
                </p>
                <ul className="mt-2 space-y-1">
                  {meetingsNeedingDistribution.map((m) => {
                    const days = Math.ceil((new Date(m.startsAt).getTime() - uiNowAnchor) / 86400000)
                    return (
                      <li key={m.id} className="flex items-center gap-2 text-xs text-amber-800">
                        <span className="font-medium">{m.title}</span>
                        <span>— om {days} dag{days !== 1 ? 'er' : ''}</span>
                        <button
                          type="button"
                          onClick={() => council.sendInvitation(m.id, ['AMU-medlemmer'])}
                          className="ml-2 rounded-full bg-amber-600 px-2 py-0.5 text-white hover:bg-amber-700"
                        >
                          Send innkalling nå
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          )}

          {/* ── Data-driven agenda context panel ────────────────────────── */}
          {(incidentsSinceLastMeeting.length > 0 || latestSickLeavePct > 0 || openHighRisks.length > 0) && (
            <div className="rounded-xl border border-neutral-200 bg-[#faf8f4] p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">
                Auto-injisert agendagrunnlag — siden siste møte
                {lastMeetingDate && <span className="ml-1 font-normal text-neutral-400">({new Date(lastMeetingDate).toLocaleDateString('no-NO')})</span>}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {incidentsSinceLastMeeting.length > 0 && (
                  <Link to="/hse?tab=incidents" className="group block rounded-lg border border-neutral-200 bg-white p-3 hover:border-red-200 hover:bg-red-50/30 transition-colors">
                    <div className={`text-2xl font-bold ${highSeverityIncidents.length > 0 ? 'text-red-700' : 'text-neutral-800'}`}>{incidentsSinceLastMeeting.length}</div>
                    <div className="text-xs text-neutral-600">Hendelser siden siste møte</div>
                    {highSeverityIncidents.length > 0 && (
                      <div className="mt-1 text-xs font-semibold text-red-600">{highSeverityIncidents.length} høy/kritisk — gjennomgå</div>
                    )}
                  </Link>
                )}
                {latestSickLeavePct > 0 && (
                  <Link to="/hse?tab=sickness" className="block rounded-lg border border-neutral-200 bg-white p-3 hover:border-amber-200 hover:bg-amber-50/30 transition-colors">
                    <div className="text-2xl font-bold text-amber-700">{latestSickLeavePct}</div>
                    <div className="text-xs text-neutral-600">Aktive sykefravær</div>
                  </Link>
                )}
                {openHighRisks.length > 0 && (
                  <Link to="/internal-control?tab=ros" className="block rounded-lg border border-neutral-200 bg-white p-3 hover:border-orange-200 hover:bg-orange-50/30 transition-colors">
                    <div className="text-2xl font-bold text-orange-700">{openHighRisks.length}</div>
                    <div className="text-xs text-neutral-600">ROS høyrisikoer (≥12) til gjennomgang</div>
                  </Link>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-neutral-600">
                År for årshjul
                <input
                  type="number"
                  value={wheelYear}
                  onChange={(e) => setWheelYear(Number(e.target.value) || new Date().getFullYear())}
                  className="ml-2 w-24 rounded-none border border-neutral-200 px-2 py-1 text-sm"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => setNewMeetingOpen(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-none border border-[#1a3d32] bg-[#1a3d32] px-4 text-sm font-medium text-white hover:bg-[#142e26]"
            >
              <Plus className="size-4 shrink-0" aria-hidden />
              Nytt møte
            </button>
          </div>

          <GovernanceWheel
            year={wheelYear}
            meetings={council.meetings}
            onQuarterClick={(q) => {
              setMeetingForm((s) => ({ ...s, quarterSlot: q }))
              setNewMeetingOpen(true)
            }}
          />

          <div className="min-w-0 space-y-4">
            <div className="overflow-hidden rounded-none border border-neutral-200/90 bg-white shadow-sm">
              <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3">
                <h2 className="font-semibold text-neutral-900">Alle møter</h2>
                <p className="text-xs text-neutral-500">Klikk en rad for å åpne agenda og revisjonslogg.</p>
              </div>
              <div className="overflow-x-auto">
                {council.meetings.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-neutral-500">Ingen møter ennå.</p>
                ) : (
                  <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        <th className="px-4 py-2.5">Møte</th>
                        <th className="px-4 py-2.5">Tid</th>
                        <th className="px-4 py-2.5">År / kv.</th>
                        <th className="px-4 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {council.meetings.map((m) => {
                        const statusStyle =
                          m.status === 'completed'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                            : m.status === 'cancelled'
                              ? 'border-neutral-200 bg-neutral-100 text-neutral-700'
                              : 'border-sky-200 bg-sky-50 text-sky-900'
                        return (
                          <tr
                            key={m.id}
                            className="cursor-pointer border-b border-neutral-100 transition-colors hover:bg-neutral-50"
                            onClick={() => {
                              setSelectedMeetingId(m.id)
                              setMeetingDetailOpen(true)
                            }}
                          >
                            <td className="px-4 py-2 align-top font-medium text-[#1a3d32]">{m.title}</td>
                            <td className="px-4 py-2 align-top text-neutral-700">{formatWhen(m.startsAt)}</td>
                            <td className="px-4 py-2 align-top text-neutral-600">
                              {m.governanceYear ?? '—'} · {m.quarterSlot ? `Q${m.quarterSlot}` : '—'}
                            </td>
                            <td className="px-4 py-2 align-top">
                              <span className={`inline-flex rounded-none border px-2.5 py-0.5 text-xs font-medium ${statusStyle}`}>
                                {m.status === 'planned'
                                  ? 'Planlagt'
                                  : m.status === 'completed'
                                    ? 'Gjennomført'
                                    : 'Avlyst'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {tab === 'meetings' && (newMeetingOpen || meetingDetailOpen) && (
            <div className="fixed inset-0 z-[60] flex justify-end">
              <button
                type="button"
                aria-label="Lukk"
                className="absolute inset-0 bg-black/40"
                onClick={() => {
                  setNewMeetingOpen(false)
                  setMeetingDetailOpen(false)
                }}
              />
              <div
                className="relative flex h-full w-full max-w-xl flex-col border-l border-neutral-200 bg-white shadow-xl"
                role="dialog"
                aria-modal="true"
              >
                <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                  <h2 className="text-sm font-semibold text-neutral-900">
                    {newMeetingOpen ? 'Nytt møte' : selectedMeeting?.title ?? 'Møte'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setNewMeetingOpen(false)
                      setMeetingDetailOpen(false)
                    }}
                    className="rounded-none p-2 text-neutral-500 hover:bg-neutral-100"
                  >
                    <X className="size-5" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  {newMeetingOpen && (
                    <form onSubmit={(e) => void handleAddMeeting(e)} className="space-y-3">
                      <p className="text-sm text-neutral-600">
                        Knytt møtet til et kvartal i årshjulet og velg foreslått agenda (kan redigeres etterpå).
                      </p>
                      <div>
                        <label className="text-xs font-medium text-neutral-500">Tittel</label>
                        <input
                          value={meetingForm.title}
                          onChange={(e) => setMeetingForm((s) => ({ ...s, title: e.target.value }))}
                          className="mt-1 w-full rounded-none border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-neutral-500">Starttid</label>
                        <input
                          type="datetime-local"
                          value={meetingForm.startsAt}
                          onChange={(e) => setMeetingForm((s) => ({ ...s, startsAt: e.target.value }))}
                          className="mt-1 w-full rounded-none border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-neutral-500">Sted / lenke</label>
                        <input
                          value={meetingForm.location}
                          onChange={(e) => setMeetingForm((s) => ({ ...s, location: e.target.value }))}
                          className="mt-1 w-full rounded-none border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-neutral-500">Kalenderår</label>
                          <input
                            type="number"
                            value={meetingForm.governanceYear}
                            onChange={(e) =>
                              setMeetingForm((s) => ({
                                ...s,
                                governanceYear: Number(e.target.value) || wheelYear,
                              }))
                            }
                            className="mt-1 w-full rounded-none border border-neutral-200 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-neutral-500">Kvartal</label>
                          <select
                            value={meetingForm.quarterSlot}
                            onChange={(e) =>
                              setMeetingForm((s) => ({
                                ...s,
                                quarterSlot: Number(e.target.value) as QuarterSlot,
                              }))
                            }
                            className="mt-1 w-full rounded-none border border-neutral-200 px-3 py-2 text-sm"
                          >
                            <option value={1}>Q1</option>
                            <option value={2}>Q2</option>
                            <option value={3}>Q3</option>
                            <option value={4}>Q4</option>
                          </select>
                        </div>
                      </div>                      <button
                        type="submit"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-none border border-[#1a3d32] bg-[#1a3d32] py-2.5 text-sm font-medium text-white hover:bg-[#142e26]"
                      >
                        <Calendar className="size-4" />
                        Legg til møte
                      </button>
                    </form>
                  )}
                  {meetingDetailOpen && selectedMeeting && !newMeetingOpen && (
                    <MeetingDetailPanel
                      meeting={selectedMeeting}
                      council={council}
                      auditDraft={auditDraft}
                      setAuditDraft={setAuditDraft}
                      inviteRecipientsDraft={inviteRecipients[selectedMeeting.id] ?? ''}
                      setInviteRecipientsDraft={(v) => setInviteRecipients((r) => ({ ...r, [selectedMeeting.id]: v }))}
                      attendeesDraft={attendeesInput[selectedMeeting.id] ?? ''}
                      setAttendeesDraft={(v) => setAttendeesInput((r) => ({ ...r, [selectedMeeting.id]: v }))}
                      quorumDraft={quorumInput[selectedMeeting.id] ?? false}
                      setQuorumDraft={(v) => setQuorumInput((r) => ({ ...r, [selectedMeeting.id]: v }))}
                      itemMinutesDraft={itemMinutes}
                      setItemMinutesDraft={setItemMinutes}
                      onCreateTask={createTaskFromDecision}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}


      {tab === 'compliance' && (
        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
            <strong>Merk:</strong> Sjekklisten er et strukturert utgangspunkt knyttet til typiske krav i norsk
            arbeidsliv. Den erstatter ikke juridisk bistand — kontroller alltid mot{' '}
            <a
              href="https://lovdata.no"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[#1a3d32] underline"
            >
              lovdata.no
            </a>{' '}
            og gjeldende tariff- og bedriftsavtaler.
          </div>

          <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Egne punkter</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                council.addComplianceItem(customItem.title, customItem.description, customItem.lawRef)
                setCustomItem({ title: '', description: '', lawRef: '' })
              }}
              className="mt-4 grid gap-3 sm:grid-cols-2"
            >
              <input
                placeholder="Tittel"
                value={customItem.title}
                onChange={(e) => setCustomItem((s) => ({ ...s, title: e.target.value }))}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm sm:col-span-2"
                required
              />
              <input
                placeholder="Henvisning (lov / avtale)"
                value={customItem.lawRef}
                onChange={(e) => setCustomItem((s) => ({ ...s, lawRef: e.target.value }))}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm sm:col-span-2"
              />
              <textarea
                placeholder="Beskrivelse"
                value={customItem.description}
                onChange={(e) => setCustomItem((s) => ({ ...s, description: e.target.value }))}
                rows={2}
                className="resize-y rounded-xl border border-neutral-200 px-3 py-2 text-sm sm:col-span-2"
              />
              <button
                type="submit"
                className="rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26] sm:col-span-2 sm:justify-self-start"
              >
                Legg til punkt
              </button>
            </form>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#1a3d32]/15 bg-white shadow-sm">
            <div className="border-b border-[#1a3d32]/15 bg-gradient-to-r from-[#faf6ed] via-white to-emerald-50/50 px-4 py-3">
              <h2 className="font-semibold text-[#1a3d32]">Krav og oppgaver</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-emerald-200/70 bg-emerald-50/95 text-xs font-semibold uppercase tracking-wide text-[#1a3d32]/85">
                    <th className="w-10 px-3 py-2.5">OK</th>
                    <th className="min-w-[200px] px-3 py-2.5">Krav</th>
                    <th className="min-w-[180px] px-3 py-2.5">Notater</th>
                    <th className="px-3 py-2.5">Oppfølging</th>
                  </tr>
                </thead>
                <tbody>
                  {council.compliance.map((c, rowIdx) => (
                    <tr
                      key={c.id}
                      className={`border-b border-neutral-100 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-emerald-50/35'} ${
                        c.done ? 'opacity-90' : ''
                      }`}
                    >
                      <td className="align-top px-3 py-3">
                        <input
                          type="checkbox"
                          checked={c.done}
                          onChange={() => council.toggleCompliance(c.id)}
                          className="mt-1 size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]"
                        />
                      </td>
                      <td className="align-top px-3 py-3">
                        <span className="font-medium text-neutral-900">{c.title}</span>
                        {c.isCustom ? (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                            Egendefinert
                          </span>
                        ) : null}
                        <p className="mt-1 text-neutral-600">{c.description}</p>
                        <p className="mt-1 text-xs font-medium text-[#1a3d32]/90">{c.lawRef}</p>
                      </td>
                      <td className="align-top px-3 py-3">
                        <textarea
                          placeholder="Notater…"
                          value={c.notes ?? ''}
                          onChange={(e) => council.setComplianceNotes(c.id, e.target.value)}
                          rows={2}
                          className="w-full min-w-[160px] rounded-lg border border-neutral-200 bg-white/90 px-2 py-1.5 text-xs"
                        />
                      </td>
                      <td className="align-top px-3 py-3">
                        {!c.done ? (
                          <AddTaskLink
                            title={`Oppfølging: ${c.title.slice(0, 80)}`}
                            description={c.lawRef}
                            module="council"
                            sourceType="council_compliance"
                            sourceId={c.id}
                            sourceLabel={c.title}
                            ownerRole="HMS / råd"
                            requiresManagementSignOff={false}
                          />
                        ) : (
                          <span className="text-xs text-emerald-700">Fullført</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (confirm('Tilbakestill alle rådsdata til demo?')) council.resetToDemoData()
              }}
              className="text-sm text-neutral-500 underline-offset-2 hover:text-neutral-800 hover:underline"
            >
              Tilbakestill demodata
            </button>
          </div>
        </div>
      )}

      {/* ── Vedtaksregister ───────────────────────────────────────────────── */}
      {tab === 'decisions' && (
        <div className="mt-8 space-y-6">
          <div className="rounded-none border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
            Vedtaksregisteret samler alle formelle vedtak på tvers av AMU-møter (fra revisjonslogg og per-punkt-referater).
            Bruk søkefeltet og klikk en rad for full tekst.
          </div>

          <div className="relative max-w-md">
            <input
              value={decisionSearch}
              onChange={(e) => setDecisionSearch(e.target.value)}
              placeholder="Søk i vedtak…"
              className="w-full rounded-none border border-neutral-200 bg-white py-2 pl-10 pr-4 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
            />
            <ScrollText className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          </div>

          <div className="overflow-hidden rounded-none border border-neutral-200/90 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-4 py-3">
              <h2 className="font-semibold text-neutral-900">Alle vedtak</h2>
              <span className="text-xs text-neutral-500">{council.allDecisions.length} totalt</span>
            </div>
            {council.allDecisions.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-neutral-500">
                Ingen vedtak ennå. Registrer vedtak under «Vedtak»-typen i revisjonsloggen, eller legg til formelt vedtak per agendapunkt under Møter.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      <th className="px-4 py-3">Dato</th>
                      <th className="px-4 py-3">Møte</th>
                      <th className="px-4 py-3">Agendapunkt</th>
                      <th className="px-4 py-3">Vedtak</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {council.allDecisions
                      .filter(
                        (d) =>
                          !decisionSearch ||
                          d.decision.toLowerCase().includes(decisionSearch.toLowerCase()) ||
                          d.meetingTitle.toLowerCase().includes(decisionSearch.toLowerCase()),
                      )
                      .map((d) => (
                        <tr
                          key={d.id}
                          className="cursor-pointer transition-colors hover:bg-neutral-50"
                          onClick={() => setDecisionPanelId(d.id)}
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-neutral-500">
                            {new Date(d.meetingDate).toLocaleDateString('no-NO', { dateStyle: 'short' })}
                          </td>
                          <td className="px-4 py-3 font-medium text-neutral-800">{d.meetingTitle}</td>
                          <td className="px-4 py-3 text-xs text-neutral-500">{d.agendaItemTitle || '—'}</td>
                          <td className="max-w-[280px] truncate px-4 py-3 text-neutral-900">{d.decision}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {decisionPanel && (
            <div className="fixed inset-0 z-[60] flex justify-end">
              <button
                type="button"
                aria-label="Lukk"
                className="absolute inset-0 bg-black/40"
                onClick={() => setDecisionPanelId(null)}
              />
              <div
                className="relative flex h-full w-full max-w-lg flex-col border-l border-neutral-200 bg-white shadow-xl"
                role="dialog"
                aria-modal="true"
              >
                <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                  <h2 className="text-sm font-semibold text-neutral-900">Vedtak</h2>
                  <button
                    type="button"
                    onClick={() => setDecisionPanelId(null)}
                    className="rounded-none p-2 text-neutral-500 hover:bg-neutral-100"
                  >
                    <X className="size-5" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm">
                  <p className="text-xs text-neutral-500">
                    {new Date(decisionPanel.meetingDate).toLocaleDateString('no-NO', { dateStyle: 'medium' })}
                  </p>
                  <p className="font-medium text-neutral-900">{decisionPanel.meetingTitle}</p>
                  <p className="text-xs text-neutral-500">
                    Agendapunkt: <span className="text-neutral-800">{decisionPanel.agendaItemTitle || '—'}</span>
                  </p>
                  <div className="rounded-none border border-neutral-200 bg-neutral-50 p-3 text-neutral-900">
                    {decisionPanel.decision}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'audit' && (
        <div className="mt-8 space-y-6">
          <div className={`${R_FLAT} border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950`}>
            <strong>Revisjonslogg:</strong> Hendelser knyttet til representasjon og valg (demodata kan tilbakestilles).
          </div>
          <div className={`${R_FLAT} overflow-hidden border border-neutral-200/90 bg-white shadow-sm`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <h2 className="flex items-center gap-2 font-semibold text-neutral-900">
                <History className="size-4" />
                Representasjon og valg
              </h2>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Tilbakestill medlemsdemodata?')) rep.resetDemo()
                }}
                className="text-xs text-neutral-500 hover:text-neutral-800 hover:underline"
              >
                Tilbakestill demo
              </button>
            </div>
            <ul className="max-h-[min(70vh,640px)] divide-y divide-neutral-100 overflow-y-auto text-sm">
              {sortedRepAudit.map((a) => (
                <li key={a.id} className="px-4 py-3">
                  <div className="text-xs text-neutral-500">
                    {formatWhen(a.at)} · <span className="font-mono text-neutral-600">{a.action}</span>
                  </div>
                  <p className="mt-1 text-neutral-800">{a.message}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Representative election card (from former MembersModule) ───────────────

function RepElectionCard({
  election,
  candDraft,
  setCandDraft,
  onAddCandidate,
  onOpen,
  onVote,
  onClose,
  compact = false,
}: {
  election: RepElection
  candDraft: string
  setCandDraft: (v: string) => void
  onAddCandidate: () => void
  onOpen: () => void
  onVote: (candidateId: string) => void
  onClose: () => void
  compact?: boolean
}) {
  const closed = election.status === 'closed'
  const open = election.status === 'open'
  const draft = election.status === 'draft'
  const sorted = [...election.candidates].sort((a, b) => b.voteCount - a.voteCount)

  const wrap = compact
    ? `${R_FLAT} border border-neutral-200/90 bg-white p-3 shadow-sm`
    : 'rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm'
  const btnRound = compact ? R_FLAT : 'rounded-full'

  return (
    <div className={wrap}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className={`font-semibold text-neutral-900 ${compact ? 'text-sm' : ''}`}>{election.title}</h3>
          {election.description ? (
            <p className={`text-neutral-600 ${compact ? 'mt-1 line-clamp-2 text-xs' : 'mt-1 text-sm'}`}>
              {election.description}
            </p>
          ) : null}
          <p className={`mt-2 text-neutral-500 ${compact ? 'text-[10px]' : 'text-xs'}`}>
            {election.anonymous ? 'Anonym stemmegivning' : 'Åpne navn'} · {election.seatsToFill} seter ·{' '}
            {election.votesCastTotal} stemmer
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {draft ? (
            <button
              type="button"
              onClick={onOpen}
              disabled={election.candidates.length === 0}
              className={`${btnRound} bg-[#1a3d32] px-2.5 py-1 text-[10px] font-medium text-white disabled:opacity-40 sm:text-xs`}
            >
              Åpne
            </button>
          ) : null}
          {open ? (
            <button
              type="button"
              onClick={onClose}
              disabled={election.candidates.length === 0}
              className={`${btnRound} border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-medium disabled:opacity-40 sm:text-xs`}
            >
              Avslutt
            </button>
          ) : null}
          {closed ? (
            <span className={`${btnRound} bg-neutral-100 px-2.5 py-1 text-[10px] font-medium text-neutral-700`}>
              Avsluttet
            </span>
          ) : null}
        </div>
      </div>

      {(draft || open) && (
        <div className={`flex flex-wrap gap-2 ${compact ? 'mt-2' : 'mt-4'}`}>
          <input
            value={candDraft}
            onChange={(e) => setCandDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAddCandidate())}
            placeholder="Kandidatnavn"
            className={`min-w-0 flex-1 border border-neutral-200 px-2 py-1.5 text-xs sm:text-sm ${compact ? R_FLAT : 'rounded-xl'}`}
          />
          <button
            type="button"
            onClick={onAddCandidate}
            className={`border border-neutral-200 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 sm:text-sm ${compact ? R_FLAT : 'rounded-xl'}`}
          >
            Legg til
          </button>
        </div>
      )}

      <ul className={`space-y-1.5 ${compact ? 'mt-2' : 'mt-4'}`}>
        {sorted.map((c) => {
          const letterIdx = repCandidateLetterIndex(election, c.id)
          const display = repCandidateDisplayName(election, letterIdx, c.name, closed)
          return (
            <li
              key={c.id}
              className={`flex flex-wrap items-center justify-between gap-2 bg-[#faf8f4] px-2 py-1.5 text-xs sm:text-sm ${compact ? R_FLAT : 'rounded-xl'}`}
            >
              <span className="font-medium text-neutral-900">{display}</span>
              <span className="text-neutral-600">{c.voteCount}</span>
              {open ? (
                <button
                  type="button"
                  onClick={() => onVote(c.id)}
                  className={`${btnRound} bg-[#1a3d32] px-2 py-0.5 text-[10px] font-medium text-white hover:bg-[#142e26]`}
                >
                  Stem
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>
      {election.anonymous && open ? (
        <p className={`text-neutral-500 ${compact ? 'mt-2 text-[10px]' : 'mt-3 text-xs'}`}>
          Anonyme valg: kandidater som A, B, … til lukking.
        </p>
      ) : null}
    </div>
  )
}

// ─── AMU member column (from former MembersModule) ──────────────────────────

function MemberColumn({
  title, members, onUpdate, onAdd, learning,
}: {
  title: string
  members: RepresentativeMember[]
  onUpdate: ReturnType<typeof useRepresentatives>['updateMember']
  onAdd?: () => void
  learning?: ReturnType<typeof useLearning>
}) {
  const roles: RepresentativeOfficeRole[] =
    title.includes('Arbeidsgiver')
      ? ['leadership_chair', 'leadership_deputy', 'leadership_member']
      : ['employee_chair', 'employee_deputy', 'employee_member']

  const today = new Date().toISOString().slice(0, 10)

  return (
    <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
        {onAdd ? (
          <button type="button" onClick={onAdd} className="text-sm font-medium text-[#1a3d32] hover:underline">
            + Legg til
          </button>
        ) : null}
      </div>
      <ul className="mt-4 space-y-4">
        {members.map((m) => {
          const termExpired = m.termUntil && m.termUntil < today
          // eslint-disable-next-line react-hooks/purity -- relative "days until" for UI badge
          const termExpiringSoon = m.termUntil && !termExpired && Math.ceil((new Date(m.termUntil).getTime() - Date.now()) / 86400000) <= 60
          const cert = learning?.certificates.find((c) => c.id === m.learningCertificateId)
          return (
            <li key={m.id} className={`rounded-xl border p-3 ${termExpired ? 'border-red-200 bg-red-50/30' : termExpiringSoon ? 'border-amber-200 bg-amber-50/20' : 'border-neutral-100'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={m.name}
                  onChange={(e) => onUpdate(m.id, { name: e.target.value })}
                  className="flex-1 border-0 bg-transparent font-medium text-neutral-900 outline-none focus:ring-0"
                />
                {m.isVerneombud && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">Verneombud</span>
                )}
                {termExpired && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">Utløpt</span>}
                {termExpiringSoon && !termExpired && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Utløper snart</span>}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <select value={m.officeRole} onChange={(e) => onUpdate(m.id, { officeRole: e.target.value as RepresentativeOfficeRole })} className="rounded-lg border border-neutral-200 px-2 py-1 text-xs">
                  {roles.map((r) => <option key={r} value={r}>{officeLabel(r)}</option>)}
                </select>
                <span className="text-xs text-neutral-500">{m.source === 'election' ? 'Valgt' : 'Oppnevnt'}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <div>
                  <label className="text-xs text-neutral-500">Periode slutt</label>
                  <input type="date" value={m.termUntil ?? ''} onChange={(e) => onUpdate(m.id, { termUntil: e.target.value || undefined })} className="ml-2 rounded-lg border border-neutral-200 px-2 py-0.5 text-xs" />
                </div>
                <label className="flex items-center gap-1.5 text-xs text-neutral-600 cursor-pointer">
                  <input type="checkbox" checked={m.isVerneombud ?? false} onChange={(e) => onUpdate(m.id, { isVerneombud: e.target.checked })} className="size-3.5 rounded border-neutral-300 text-[#1a3d32]" />
                  Verneombud
                </label>
              </div>
              {m.isVerneombud && (
                <div className="mt-2 space-y-1">
                  <div>
                    <label className="text-xs text-neutral-500">Verneområde</label>
                    <input value={m.verneombudArea ?? ''} onChange={(e) => onUpdate(m.id, { verneombudArea: e.target.value || undefined })} placeholder="f.eks. Produksjon, hall A" className="mt-0.5 w-full rounded-lg border border-neutral-200 px-2 py-1 text-xs" />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-500">Oppslag bekreftet (AML §6-1)</label>
                    <input type="date" value={m.postingConfirmedAt ?? ''} onChange={(e) => onUpdate(m.id, { postingConfirmedAt: e.target.value || undefined })} className="ml-2 rounded-lg border border-neutral-200 px-2 py-0.5 text-xs" />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-500">HMS-kurs sertifikat (40t)</label>
                    <select value={m.learningCertificateId ?? ''} onChange={(e) => onUpdate(m.id, { learningCertificateId: e.target.value || undefined })} className="ml-2 rounded-lg border border-neutral-200 px-2 py-0.5 text-xs">
                      <option value="">— Velg sertifikat —</option>
                      {(learning?.certificates ?? []).map((c) => (
                        <option key={c.id} value={c.id}>{c.learnerName} — {c.courseTitle}</option>
                      ))}
                    </select>
                    {cert && <span className="ml-1 text-[10px] text-emerald-700">✓ {new Date(cert.issuedAt).toLocaleDateString('no-NO')}</span>}
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {members.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">Ingen — kjør valg eller legg til representanter.</p>
      ) : null}
    </section>
  )
}

function MeetingDetailPanel({
  meeting, council, auditDraft, setAuditDraft,
  inviteRecipientsDraft, setInviteRecipientsDraft,
  attendeesDraft, setAttendeesDraft,
  quorumDraft, setQuorumDraft,
  itemMinutesDraft, setItemMinutesDraft,
  onCreateTask,
}: {
  meeting: CouncilMeeting
  council: ReturnType<typeof useCouncil>
  auditDraft: { kind: AuditEntryKind; text: string; author: string }
  setAuditDraft: React.Dispatch<React.SetStateAction<{ kind: AuditEntryKind; text: string; author: string }>>
  inviteRecipientsDraft: string
  setInviteRecipientsDraft: (v: string) => void
  attendeesDraft: string
  setAttendeesDraft: (v: string) => void
  quorumDraft: boolean
  setQuorumDraft: (v: boolean) => void
  itemMinutesDraft: Record<string, { summary: string; decision: string }>
  setItemMinutesDraft: React.Dispatch<React.SetStateAction<Record<string, { summary: string; decision: string }>>>
  onCreateTask: (description: string, responsible: string, dueDate: string, meetingTitle: string) => void
}) {
  const [protoName, setProtoName] = useState('')
  const [protoRole, setProtoRole] = useState<'chair' | 'secretary' | 'management'>('chair')

  // Days until meeting
  // eslint-disable-next-line react-hooks/purity -- display-only relative offset
  const daysUntil = Math.ceil((new Date(meeting.startsAt).getTime() - Date.now()) / 86400000)
  function updateAgendaItem(itemId: string, patch: Partial<AgendaItem>) {
    const next = meeting.agendaItems.map((a) => (a.id === itemId ? { ...a, ...patch } : a))
    council.setAgendaItems(meeting.id, next)
  }

  function removeAgendaItem(itemId: string) {
    council.setAgendaItems(
      meeting.id,
      meeting.agendaItems.filter((a) => a.id !== itemId).map((a, i) => ({ ...a, order: i })),
    )
  }

  function addAgendaItem() {
    council.setAgendaItems(meeting.id, [
      ...meeting.agendaItems,
      {
        id: crypto.randomUUID(),
        title: 'Nytt punkt',
        notes: '',
        order: meeting.agendaItems.length,
      },
    ])
  }

  const sortedAudit = useMemo(
    () => [...meeting.auditTrail].sort((a, b) => a.at.localeCompare(b.at)),
    [meeting.auditTrail],
  )

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{meeting.title}</h2>
            <p className="text-sm text-neutral-600">{formatWhen(meeting.startsAt)}</p>
            <p className="text-sm text-neutral-500">{meeting.location}</p>
            {/* Invitation status */}
            {meeting.invitationSentAt ? (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                <Send className="size-3" />
                Innkalling sendt {new Date(meeting.invitationSentAt).toLocaleDateString('no-NO')}
                {daysUntil > 0 && ` (${daysUntil}d til møtet)`}
              </span>
            ) : (
              <button type="button"
                onClick={() => {
                  const recipients = inviteRecipientsDraft.split(',').map((s) => s.trim()).filter(Boolean)
                  council.sendInvitation(meeting.id, recipients.length ? recipients : ['AMU-medlemmer'])
                }}
                className="mt-1 inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-xs text-neutral-600 hover:bg-neutral-50">
                <Send className="size-3" />
                Send innkalling
              </button>
            )}
            {!meeting.invitationSentAt && (
              <input value={inviteRecipientsDraft} onChange={(e) => setInviteRecipientsDraft(e.target.value)}
                placeholder="Mottakere (komma-separert)"
                className="mt-1 block w-full rounded-lg border border-neutral-200 px-2 py-1 text-xs" />
            )}
          </div>
          <select
            value={meeting.status}
            onChange={(e) =>
              council.updateMeeting(meeting.id, {
                status: e.target.value as CouncilMeeting['status'],
              })
            }
            className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium"
          >
            <option value="planned">Planlagt</option>
            <option value="completed">Gjennomført</option>
            <option value="cancelled">Avlyst</option>
          </select>
        </div>

        {/* Quorum + attendees */}
        <div className="mt-5 border-t border-neutral-100 pt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-neutral-500">Tilstedeværende (komma-separert)</label>
            <input value={attendeesDraft} onChange={(e) => setAttendeesDraft(e.target.value)}
              placeholder="Ingrid Nilsen, Ole Hansen, …"
              className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]" />
          </div>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={quorumDraft} onChange={(e) => setQuorumDraft(e.target.checked)} className="size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]" />
              <span className="font-medium">Møtet er beslutningsdyktig (quorum)</span>
            </label>
            <button type="button" onClick={() => {
              const attendees = attendeesDraft.split(',').map((s) => s.trim()).filter(Boolean)
              council.setMeetingAttendance(meeting.id, attendees, quorumDraft)
            }} className="rounded-full bg-[#1a3d32] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#142e26]">
              Lagre fremmøte
            </button>
          </div>
          {meeting.attendees && meeting.attendees.length > 0 && (
            <div className="sm:col-span-2 text-xs text-neutral-500">
              Registrert fremmøte: {meeting.attendees.join(', ')} · {meeting.quorum ? '✓ Beslutningsdyktig' : '⚠ Ikke beslutningsdyktig'}
            </div>
          )}
        </div>

        <div className="mt-6 border-t border-neutral-100 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <ListOrdered className="size-4" />
              Agenda
            </h3>
            {meeting.quarterSlot ? (
              <button
                type="button"
                onClick={() => council.applySuggestedAgenda(meeting.id, meeting.quarterSlot!)}
                className="text-xs font-medium text-[#1a3d32] underline-offset-2 hover:underline"
              >
                Last inn forslag for Q{meeting.quarterSlot} på nytt
              </button>
            ) : null}
          </div>
          <ul className="mt-3 space-y-3">
            {meeting.agendaItems.length === 0 ? (
              <li className="text-sm text-neutral-500">Ingen agendapunkter.</li>
            ) : (
              meeting.agendaItems
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((item) => (
                  <li key={item.id} className="rounded-xl border border-neutral-100 bg-[#faf8f4] p-3 space-y-2">
                    <input
                      value={item.title}
                      onChange={(e) => updateAgendaItem(item.id, { title: e.target.value })}
                      className="w-full border-0 bg-transparent font-medium text-neutral-900 outline-none focus:ring-0"
                    />
                    <textarea
                      value={item.notes}
                      onChange={(e) => updateAgendaItem(item.id, { notes: e.target.value })}
                      rows={2}
                      className="w-full resize-y rounded-lg border border-neutral-200/80 bg-white px-2 py-1 text-xs text-neutral-600"
                      placeholder="Merknader / saksunderlag"
                    />
                    {/* Per-item minutes */}
                    <details className="group">
                      <summary className="cursor-pointer text-xs font-medium text-[#1a3d32] hover:underline list-none">
                        {item.minutesSummary || item.decision ? '✓ Referat/vedtak registrert' : '+ Legg til referat og vedtak'}
                      </summary>
                      <div className="mt-2 space-y-2 rounded-lg border border-[#1a3d32]/15 bg-white p-3">
                        <div>
                          <label className="text-xs font-medium text-neutral-500">Diskusjonsreferat</label>
                          <textarea
                            value={itemMinutesDraft[item.id]?.summary ?? item.minutesSummary ?? ''}
                            onChange={(e) => setItemMinutesDraft((d) => ({ ...d, [item.id]: { ...d[item.id], summary: e.target.value, decision: d[item.id]?.decision ?? item.decision ?? '' } }))}
                            rows={2} placeholder="Oppsummering av diskusjonen…"
                            className="mt-1 w-full resize-y rounded-lg border border-neutral-200 px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-neutral-500">Formelt vedtak</label>
                          <textarea
                            value={itemMinutesDraft[item.id]?.decision ?? item.decision ?? ''}
                            onChange={(e) => setItemMinutesDraft((d) => ({ ...d, [item.id]: { ...d[item.id], decision: e.target.value, summary: d[item.id]?.summary ?? item.minutesSummary ?? '' } }))}
                            rows={2} placeholder="Vedtakstekst (lagres i Vedtaksregisteret)…"
                            className="mt-1 w-full resize-y rounded-lg border border-neutral-200 px-2 py-1 text-xs"
                          />
                        </div>
                        <div className="flex gap-2 flex-wrap">
                        <button type="button" onClick={() => {
                          const draft = itemMinutesDraft[item.id]
                          if (draft) updateAgendaItem(item.id, { minutesSummary: draft.summary, decision: draft.decision || undefined })
                        }} className="rounded-full bg-[#1a3d32] px-3 py-1 text-xs font-medium text-white hover:bg-[#142e26]">
                          Lagre referat
                        </button>
                        {/* 1-click task from decision */}
                        {(itemMinutesDraft[item.id]?.decision || item.decision) && (
                          <button type="button" onClick={() => {
                            const decisionText = itemMinutesDraft[item.id]?.decision || item.decision || ''
                            onCreateTask(decisionText, '', '', meeting.title)
                          }}
                          className="rounded-full border border-emerald-600 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
                            + Opprett oppgave fra vedtak
                          </button>
                        )}
                        </div>
                      </div>
                    </details>
                    <button
                      type="button"
                      onClick={() => removeAgendaItem(item.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Fjern punkt
                    </button>
                  </li>
                ))
            )}
          </ul>
          <button
            type="button"
            onClick={addAgendaItem}
            className="mt-3 text-sm font-medium text-[#1a3d32] hover:underline"
          >
            + Legg til punkt
          </button>
        </div>

        <div className="mt-6 border-t border-neutral-100 pt-4">
          <h3 className="text-sm font-semibold text-neutral-900">Forberedelse</h3>
          <textarea
            value={meeting.preparationNotes}
            onChange={(e) => council.setPreparationNotes(meeting.id, e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            placeholder="Notater før møtet …"
          />
          <ul className="mt-3 space-y-2">
            {meeting.preparationChecklist.map((p) => (
              <li key={p.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={p.done}
                  onChange={() => council.togglePrepChecklist(meeting.id, p.id)}
                  className="mt-0.5 size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]"
                />
                <span className={p.done ? 'text-neutral-500 line-through' : ''}>{p.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 border-t border-neutral-100 pt-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <ScrollText className="size-4" />
            Protokoll (referat)
          </h3>
          <textarea
            value={meeting.minutes ?? ''}
            onChange={(e) => council.updateMeeting(meeting.id, { minutes: e.target.value })}
            rows={4}
            className="mt-2 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            placeholder="Hovedinnhold i protokoll …"
          />
          <div className="mt-4 rounded-xl border border-neutral-200 bg-[#faf8f4] p-4">
            <h4 className="text-sm font-semibold text-neutral-900">Forhåndsregistrering på protokoll</h4>
            <p className="mt-1 text-xs text-neutral-600">
              <strong>Nivå 1 systemsignatur</strong> (innlogget bruker + SHA-256 av protokollinnhold + revisjonslogg i databasen).
              <strong> Nivå 2</strong> (BankID / QES for høyrisiko HR) er planlagt i veikartet.
            </p>
            <ul className="mt-2 space-y-1 text-xs text-neutral-700">
              {(meeting.protocolSignatures ?? []).map((s, i) => {
                const l1 = formatLevel1AuditLine(s.level1)
                return (
                  <li key={`${s.signedAt}-${i}`} className="whitespace-pre-line">
                    {s.role === 'chair'
                      ? 'Møteleder'
                      : s.role === 'secretary'
                        ? 'Referent'
                        : 'Ledelse'}
                    : {s.signerName} — {formatWhen(s.signedAt)}
                    {l1 ? `\n${l1}` : ''}
                  </li>
                )
              })}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <select
                value={protoRole}
                onChange={(e) =>
                  setProtoRole(e.target.value as 'chair' | 'secretary' | 'management')
                }
                className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs"
              >
                <option value="chair">Møteleder</option>
                <option value="secretary">Referent</option>
                <option value="management">Ledelse</option>
              </select>
              <input
                value={protoName}
                onChange={(e) => setProtoName(e.target.value)}
                placeholder="Fullt navn"
                className="min-w-[160px] flex-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    const ok = await council.signMeetingProtocol(meeting.id, protoName, protoRole)
                    if (ok) setProtoName('')
                  })()
                }}
                className="rounded-lg bg-[#1a3d32] px-3 py-1.5 text-xs font-medium text-white"
              >
                Signer
              </button>
            </div>
          </div>
          <div className="mt-3">
            <AddTaskLink
              title={`Oppfølging etter møte: ${meeting.title.slice(0, 60)}`}
              description={meeting.minutes?.slice(0, 300)}
              module="council"
              sourceType="council_meeting"
              sourceId={meeting.id}
              sourceLabel={meeting.title}
              ownerRole="Saksbehandler"
            />
          </div>
        </div>

        <div className="mt-6 border-t border-neutral-100 pt-4">
          <h3 className="text-sm font-semibold text-neutral-900">Revisjonslogg (diskusjon, notater, vedtak)</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Kronologisk spor — nye oppføringer legges til nederst. Bruk vedtak for formelle beslutninger.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              council.appendAuditEntry(meeting.id, auditDraft.kind, auditDraft.text, auditDraft.author)
              setAuditDraft((s) => ({ ...s, text: '' }))
            }}
            className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap"
          >
            <select
              value={auditDraft.kind}
              onChange={(e) =>
                setAuditDraft((s) => ({ ...s, kind: e.target.value as AuditEntryKind }))
              }
              className="rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
            >
              <option value="discussion">Diskusjon</option>
              <option value="note">Notat</option>
              <option value="decision">Vedtak</option>
            </select>
            <input
              value={auditDraft.author}
              onChange={(e) => setAuditDraft((s) => ({ ...s, author: e.target.value }))}
              placeholder="Navn (valgfritt)"
              className="min-w-[120px] flex-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
            />
            <input
              value={auditDraft.text}
              onChange={(e) => setAuditDraft((s) => ({ ...s, text: e.target.value }))}
              placeholder="Tekst"
              className="min-w-[200px] flex-[2] rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
              required
            />
            <button
              type="submit"
              className="rounded-lg bg-[#1a3d32] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#142e26]"
            >
              Legg til
            </button>
          </form>
          <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto rounded-xl bg-neutral-50 p-3 text-sm">
            {sortedAudit.map((a) => (
              <li key={a.id} className="border-l-2 border-[#c9a227] pl-3">
                <div className="text-xs text-neutral-500">
                  {formatWhen(a.at)}
                  {a.author ? ` · ${a.author}` : ''} ·{' '}
                  <span className="font-medium text-neutral-700">
                    {a.kind === 'decision' ? 'Vedtak' : a.kind === 'discussion' ? 'Diskusjon' : 'Notat'}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-neutral-800">{a.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ─── Council board ElectionCard (original, unchanged) ───────────────────────

function ElectionCard({
  election,
  candidateDraft,
  setCandidateDraft,
  onAddCandidate,
  onVote,
  onClose,
}: {
  election: Election
  candidateDraft: string
  setCandidateDraft: (v: string) => void
  onAddCandidate: () => void
  onVote: (candidateId: string) => void
  onClose: () => void
}) {
  const open = election.status === 'open'
  return (
    <div className="rounded-xl border border-neutral-200 bg-[#faf8f4] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-neutral-900">{election.title}</h3>
          <p className="text-xs text-neutral-500">
            {open ? 'Åpent valg' : 'Avsluttet'}
            {election.closedAt ? ` · ${formatWhen(election.closedAt)}` : ''}
          </p>
        </div>
        {open ? (
          <button
            type="button"
            onClick={onClose}
            disabled={election.candidates.length === 0}
            className="inline-flex items-center gap-1 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-40"
          >
            <Vote className="size-3.5" />
            Avslutt og oppdater styre
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={candidateDraft}
            onChange={(e) => setCandidateDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAddCandidate())}
            placeholder="Ny kandidat"
            className="min-w-[160px] flex-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={onAddCandidate}
            className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium ring-1 ring-neutral-200 hover:bg-neutral-50"
          >
            Legg til
          </button>
        </div>
      ) : null}
      <ul className="mt-3 space-y-2">
        {election.candidates.length === 0 ? (
          <li className="text-sm text-neutral-500">Ingen kandidater ennå.</li>
        ) : (
          election.candidates
            .slice()
            .sort((a, b) => b.voteCount - a.voteCount)
            .map((c, idx) => (
              <li
                key={c.id}
                className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ring-1 ring-[#1a3d32]/10 ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-amber-50/50'
                }`}
              >
                <span className="min-w-0 font-medium text-neutral-900">{c.name}</span>
                <span className="shrink-0 text-neutral-600">{c.voteCount} stemmer</span>
                {open ? (
                  <button
                    type="button"
                    onClick={() => onVote(c.id)}
                    className="shrink-0 rounded-full bg-[#1a3d32] px-3 py-1 text-xs font-medium text-white hover:bg-[#142e26]"
                  >
                    Stem
                  </button>
                ) : election.winnerCandidateId === c.id ? (
                  <span className="shrink-0 text-xs font-medium text-emerald-700">Vinner</span>
                ) : null}
              </li>
            ))
        )}
      </ul>
    </div>
  )
}
