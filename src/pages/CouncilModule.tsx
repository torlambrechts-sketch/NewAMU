import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Gavel,
  ListOrdered,
  Mail,
  MoreHorizontal,
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
import { avatarUrlFromSeed } from '../lib/avatarUrl'
import type {
  AgendaItem,
  AuditEntryKind,
  BoardMember,
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
/** Same task / inspeksjon sidepanel — møter */
const SETTINGS_LEAD = 'text-sm leading-relaxed text-neutral-600'
const SETTINGS_FIELD_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-800'
const SETTINGS_INPUT =
  'mt-1.5 w-full rounded-none border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 shadow-none placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900'
const TASK_PANEL_ROW_GRID =
  'grid grid-cols-1 gap-4 border-b border-neutral-200 px-4 py-4 last:border-b-0 md:grid-cols-[minmax(0,40%)_minmax(0,60%)] md:items-start md:gap-10 md:px-5 md:py-5'
const TASK_PANEL_INSET = 'rounded-none border border-neutral-200/90 bg-[#f4f1ea] p-5 sm:p-6'
const TASK_PANEL_SELECT = `${SETTINGS_INPUT} bg-white`
const MEETING_PANEL_SURFACE = 'bg-[#f7f6f2]'
const MENU1_ICON_ONLY_TAB =
  '!h-8 !w-8 !min-h-0 !min-w-0 !max-h-8 !max-w-8 !flex-none shrink-0 !justify-center !gap-0 !p-0'

/** Arbeidsmiljøråd: én typografisk skala (sans-serif), 3:2 hoved / sidekolonne */
const COUNCIL_MAIN_SIDE_GRID = 'grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]'
/** Layout-reference «Dashboard 70/30»: kremflate, 7/3 kolonner */
const COUNCIL_DASH7030_CREAM = '#F9F7F2'
const COUNCIL_DASH7030_CREAM_DEEP = '#EFE8DC'
const COUNCIL_DASH7030_SERIF = "'Libre Baskerville', Georgia, serif"
const COUNCIL_DASH7030_GRID =
  'grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(260px,3fr)] lg:items-start'
const COUNCIL_DASH7030_WHITECARD =
  'rounded-lg border border-neutral-200/80 bg-white shadow-sm'
const COUNCIL_DASH7030_WHITECARD_SHADOW = { boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } as const
const COUNCIL_PAGE_TITLE = 'text-2xl font-semibold text-neutral-900 md:text-3xl'
/** Hovedtittel for større innholdsblokker (f.eks. Styre og Valg) */
const COUNCIL_MAIN_HEADING = 'text-xl font-semibold text-neutral-900 md:text-2xl'
const COUNCIL_SECTION_HEADING = 'text-base font-semibold text-neutral-900'
const COUNCIL_SUBHEADING = 'text-sm font-semibold text-neutral-900'
const COUNCIL_OVERLINE = 'text-[10px] font-bold uppercase tracking-wider text-neutral-500'
const COUNCIL_BODY = 'text-sm leading-relaxed text-neutral-600'
const COUNCIL_BODY_MUTED = 'text-sm text-neutral-500'
const COUNCIL_SMALL = 'text-xs text-neutral-500'

function CouncilOverviewBreadcrumb({ items }: { items: string[] }) {
  return (
    <p className="text-xs text-neutral-500">
      {items.map((t, i) => (
        <span key={`${i}-${t}`}>
          {i > 0 ? <span className="mx-1.5 text-neutral-300">›</span> : null}
          {t}
        </span>
      ))}
    </p>
  )
}

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

/** Valg sidekolonne: samme overskriftsstil som «Nytt valg (…)», med chevron og ekspander/kollaps */
function CouncilValgCollapsibleSection({
  sectionKey,
  title,
  count,
  expanded,
  onToggle,
  children,
}: {
  sectionKey: string
  title: string
  count: number
  expanded: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className="border-t border-neutral-200/80 pt-5">
      <button
        type="button"
        id={`valg-section-${sectionKey}`}
        aria-expanded={expanded}
        onClick={onToggle}
        className={`${R_FLAT} flex w-full items-start justify-between gap-2 text-left transition-colors hover:bg-neutral-100/80`}
      >
        <span className={COUNCIL_OVERLINE}>{title}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className={`${COUNCIL_OVERLINE} text-neutral-400 tabular-nums`}>{count}</span>
          {expanded ? (
            <ChevronDown className="size-4 shrink-0 text-neutral-500" aria-hidden />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-neutral-500" aria-hidden />
          )}
        </span>
      </button>
      {expanded ? <div className="mt-3">{children}</div> : null}
    </section>
  )
}

const tabs = [
  { id: 'overview' as const, label: 'Oversikt', icon: ClipboardList },
  { id: 'board' as const, label: 'Styre og Valg', icon: Users },
  { id: 'meetings' as const, label: 'Møter', icon: Calendar },
  { id: 'requirements' as const, label: 'Krav og vedtak', icon: Gavel },
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
  requirements: {
    kicker: 'Krav og vedtak',
    description:
      'Samsvarssjekk med lovhenvisninger og vedtaksregister på tvers av møter — søkbart og koblet til oppfølging.',
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

function normalizePersonName(n: string) {
  return n.trim().toLowerCase().replace(/\s+/g, ' ')
}

function boardMemberMatchingRep(m: RepresentativeMember, board: BoardMember[]) {
  const key = normalizePersonName(m.name)
  if (!key) return undefined
  return board.find((b) => normalizePersonName(b.name) === key)
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

function meetingGovernanceYear(m: CouncilMeeting): number {
  if (m.governanceYear != null) return m.governanceYear
  try {
    return new Date(m.startsAt).getFullYear()
  } catch {
    return new Date().getFullYear()
  }
}

function partitionRepresentativeElections(elections: RepElection[]) {
  const supplementary = elections.filter(
    (e) => /supplerings|suppleringsvalg/i.test(e.title) || /2026/.test(e.title),
  )
  const suppIds = new Set(supplementary.map((e) => e.id))
  const at2024 = elections.filter((e) => /2024/.test(e.title) && !suppIds.has(e.id))
  const at24Ids = new Set(at2024.map((e) => e.id))
  const at2027 = elections.filter((e) => /2027/.test(e.title) && !suppIds.has(e.id) && !at24Ids.has(e.id))
  const at27Ids = new Set(at2027.map((e) => e.id))
  const other = elections.filter(
    (e) => !suppIds.has(e.id) && !at24Ids.has(e.id) && !at27Ids.has(e.id),
  )
  return { supplementary, at2024, at2027, other }
}

export function CouncilModule() {
  const council = useCouncil()
  const { supabaseConfigured } = useOrgSetupContext()
  const rep = useRepresentatives()
  const navigate = useNavigate()
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
    if (tabParam === 'audit') {
      queueMicrotask(() => navigate('/workspace/revisjonslogg?source=council', { replace: true }))
    }
  }, [tabParam, navigate])

  useEffect(() => {
    if (tabParam === 'election') {
      queueMicrotask(() => setSearchParams({ tab: 'board' }, { replace: true }))
    }
    if (tabParam === 'compliance' || tabParam === 'decisions') {
      queueMicrotask(() => setSearchParams({ tab: 'requirements' }, { replace: true }))
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
  const [meetingsListYearFilter, setMeetingsListYearFilter] = useState<'current_and_prior' | number>('current_and_prior')
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
    (tab === 'requirements' && Boolean(decisionPanelId))
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
      if (tab !== 'requirements') setDecisionPanelId(null)
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

  const repElectionSections = useMemo(
    () => partitionRepresentativeElections(rep.elections),
    [rep.elections],
  )

  /** Alle valg i en liste er avsluttet (tom liste gir false — vis tomt hint uten å skjule). */
  const repListAllClosed = useCallback((list: RepElection[]) => {
    return list.length > 0 && list.every((e) => e.status === 'closed')
  }, [])

  const councilAmuElectionsAllClosed = useMemo(
    () => council.elections.length > 0 && council.elections.every((e) => e.status === 'closed'),
    [council.elections],
  )

  type ValgSectionKey = 'new' | 'supp' | 'at2027' | 'at2024' | 'other' | 'periods' | 'amu'
  const [valgSectionOverrides, setValgSectionOverrides] = useState<
    Partial<Record<ValgSectionKey, boolean>>
  >({})

  const valgSectionDefaultExpanded = useMemo(
    () =>
      ({
        new: true,
        supp: !repListAllClosed(repElectionSections.supplementary),
        at2027: !repListAllClosed(repElectionSections.at2027),
        at2024: !repListAllClosed(repElectionSections.at2024),
        other: !repListAllClosed(repElectionSections.other),
        periods: false,
        amu: !councilAmuElectionsAllClosed,
      }) satisfies Record<ValgSectionKey, boolean>,
    [
      councilAmuElectionsAllClosed,
      repElectionSections.at2024,
      repElectionSections.at2027,
      repElectionSections.other,
      repElectionSections.supplementary,
      repListAllClosed,
    ],
  )

  const valgSectionExpanded = useCallback(
    (key: ValgSectionKey) => valgSectionOverrides[key] ?? valgSectionDefaultExpanded[key],
    [valgSectionDefaultExpanded, valgSectionOverrides],
  )

  const toggleValgSection = useCallback((key: ValgSectionKey) => {
    setValgSectionOverrides((prev) => {
      const def = valgSectionDefaultExpanded[key]
      const cur = prev[key] !== undefined ? prev[key]! : def
      return { ...prev, [key]: !cur }
    })
  }, [valgSectionDefaultExpanded])

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

  const boardMembersWithoutRepMatch = useMemo((): BoardMember[] => {
    const keys = new Set(rep.members.map((m) => normalizePersonName(m.name)).filter(Boolean))
    return council.board.filter((b) => !keys.has(normalizePersonName(b.name)))
  }, [council.board, rep.members])

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

  const meetingListYearOptions = useMemo(() => {
    const ys = new Set<number>()
    for (const m of council.meetings) ys.add(meetingGovernanceYear(m))
    return [...ys].sort((a, b) => b - a)
  }, [council.meetings])

  const meetingsFilteredForTable = useMemo(() => {
    const curY = new Date().getFullYear()
    const list = [...council.meetings].sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    if (meetingsListYearFilter === 'current_and_prior') {
      return list.filter((m) => {
        const y = meetingGovernanceYear(m)
        return y === curY || y === curY - 1
      })
    }
    return list.filter((m) => meetingGovernanceYear(m) === meetingsListYearFilter)
  }, [council.meetings, meetingsListYearFilter])

  const councilOverviewKpis = useMemo(
    () =>
      [
        {
          title: 'Styre',
          sub: 'Registrerte medlemmer',
          value: String(council.board.length),
          tab: 'board' as const,
        },
        {
          title: 'Valg',
          sub: 'Åpne nå',
          value: String(electionsOpenCount),
          tab: 'board' as const,
        },
        {
          title: 'Samsvar',
          sub: 'Sjekkliste fullført',
          value: `${complianceProgress.pct}%`,
          tab: 'requirements' as const,
        },
        {
          title: 'Møter',
          sub: `Planlagt i ${wheelYear}`,
          value: `${meetingsPlannedThisYear} / ${MEETINGS_PER_YEAR}`,
          tab: 'meetings' as const,
        },
      ] as const,
    [
      council.board.length,
      complianceProgress.pct,
      electionsOpenCount,
      meetingsPlannedThisYear,
      wheelYear,
    ],
  )

  const overviewRecentAudit = useMemo(() => {
    const tail = sortedRepAudit.slice(-5).reverse()
    return tail.map((e) => ({
      id: e.id,
      text: e.message,
      when: formatWhen(e.at),
    }))
  }, [sortedRepAudit])

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

  const councilDecisionSegments = useMemo(() => {
    const n = council.allDecisions.length
    const palette = ['#0f766e', '#94a3b8']
    const entries: InsightSeg[] =
      n > 0
        ? [{ label: 'Registrerte vedtak', value: n, color: palette[0] }]
        : []
    const total = entries.reduce((s, x) => s + x.value, 0)
    return { entries, total }
  }, [council.allDecisions.length])

  const requirementsOverviewKpis = useMemo(
    () => [
      {
        title: 'Sjekkliste',
        sub: 'Punkter totalt',
        value: String(complianceProgress.total),
      },
      {
        title: 'Oppfylt',
        sub: 'Andel fullført',
        value: `${complianceProgress.pct}%`,
      },
      {
        title: 'Gjenstår',
        sub: 'Ikke markert OK',
        value: String(Math.max(0, complianceProgress.total - complianceProgress.done)),
      },
      {
        title: 'Vedtak',
        sub: 'I registeret',
        value: String(council.allDecisions.length),
      },
    ],
    [
      complianceProgress.done,
      complianceProgress.pct,
      complianceProgress.total,
      council.allDecisions.length,
    ],
  )

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
          <h1 className={COUNCIL_PAGE_TITLE}>Arbeidsmiljøråd</h1>
          <p className="mt-1 text-sm font-medium text-[#1a3d32]/90">{tabBlurbs[tab].kicker}</p>
          <p className={`mt-3 max-w-2xl ${COUNCIL_BODY}`}>
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
        <div
          className="mt-6 rounded-xl border border-neutral-200/80 p-4 shadow-sm md:p-6"
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            backgroundColor: COUNCIL_DASH7030_CREAM,
            color: '#171717',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <section className="space-y-6">
            <div>
              <CouncilOverviewBreadcrumb items={['Arbeidsmiljøråd', 'Oversikt']} />
              <h2
                className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl"
                style={{ fontFamily: COUNCIL_DASH7030_SERIF }}
              >
                Rådsinnsikt
              </h2>
              <p className={`mt-2 max-w-2xl ${COUNCIL_BODY}`}>{tabBlurbs.overview.description}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {councilOverviewKpis.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => setTab(item.tab)}
                  className="flex w-full items-center justify-between gap-4 rounded-lg border border-neutral-200/60 px-5 py-4 text-left transition hover:border-neutral-300"
                  style={{ backgroundColor: COUNCIL_DASH7030_CREAM_DEEP }}
                >
                  <div>
                    <p className="text-3xl font-bold tabular-nums text-neutral-900">{item.value}</p>
                    <p className="mt-1 text-sm font-medium text-neutral-800">{item.title}</p>
                    <p className="text-xs text-neutral-600">{item.sub}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold uppercase tracking-wide text-neutral-700">
                    Åpne <ChevronRight className="size-3.5" aria-hidden />
                  </span>
                </button>
              ))}
            </div>

            <div className={COUNCIL_DASH7030_GRID}>
              <div className="min-w-0 space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <ModuleDonutCard
                    className="!rounded-lg"
                    title="Valg"
                    subtitle="Åpne og avsluttede"
                    segments={councilElectionSegments.entries}
                    total={councilElectionSegments.total}
                    emptyHint="Ingen valg registrert."
                  />
                  <ModuleDonutCard
                    className="!rounded-lg"
                    title={`Møter ${wheelYear}`}
                    subtitle="Planlagt, gjennomført og avlyst"
                    segments={councilMeetingYearSegments.entries}
                    total={councilMeetingYearSegments.total}
                    emptyHint="Ingen møter i året."
                  />
                  <ModuleDonutCard
                    className="!rounded-lg"
                    title="Samsvarssjekk"
                    subtitle="Oppfylt vs. gjenstående"
                    segments={councilComplianceSegments.entries}
                    total={councilComplianceSegments.total}
                    emptyHint="Ingen sjekklistepunkter."
                  />
                  <ModuleDonutCard
                    className="!rounded-lg"
                    title="Signaler siden siste møte"
                    subtitle="Hendelser, sykefravær, ROS"
                    segments={councilLiveSignalsSegments.entries}
                    total={councilLiveSignalsSegments.total}
                    emptyHint="Ingen signaler å vise."
                  />
                </div>

                <p className={COUNCIL_BODY}>
                  Registrerte ordinære møter i {wheelYear}: <strong>{meetingsThisYear}</strong> / {MEETINGS_PER_YEAR}{' '}
                  (justér år under «Møter»).
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
                  <div
                    className="h-full rounded-full bg-[#c9a227] transition-all"
                    style={{ width: `${complianceProgress.pct}%` }}
                  />
                </div>
                <p className={COUNCIL_SMALL}>
                  {complianceProgress.done} av {complianceProgress.total} punkter i samsvarssjekken er markert som
                  oppfylt.
                </p>

                <div className={`${COUNCIL_DASH7030_WHITECARD} p-5`} style={COUNCIL_DASH7030_WHITECARD_SHADOW}>
                  <p className={COUNCIL_OVERLINE}>Lovpålagte terskler (AML 2024)</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-md bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">
                      {ct.totalEmployeeCount} ansatte
                    </span>
                    {ct.requiresVerneombud ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                        <CheckCircle2 className="size-3" />
                        Verneombud lovpålagt
                      </span>
                    ) : (
                      <span className="rounded-md bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">
                        Verneombud: &lt;5 ansatte
                      </span>
                    )}
                    {ct.requiresAmu ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                        <CheckCircle2 className="size-3" />
                        AMU lovpålagt (≥30)
                      </span>
                    ) : ct.mayRequestAmu ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                        <AlertTriangle className="size-3" />
                        AMU kan kreves (10–29)
                      </span>
                    ) : (
                      <span className="rounded-md bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">
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

                <div className={`${COUNCIL_DASH7030_WHITECARD} p-5`} style={COUNCIL_DASH7030_WHITECARD_SHADOW}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`${COUNCIL_SUBHEADING} text-neutral-800`}>AMU-sammensetting</span>
                    {rep.validation.ok ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-900">
                        <CheckCircle2 className="size-3.5" />
                        Krav oppfylt
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-950">
                        <AlertTriangle className="size-3.5" />
                        {rep.validation.issues.length} avvik
                      </span>
                    )}
                  </div>
                  <p className={`mt-2 ${COUNCIL_SMALL}`}>
                    {rep.validation.empCount} AT · {rep.validation.leadCount} AG · Mål: {rep.validation.seatsPerSide}{' '}
                    per side
                  </p>
                </div>
              </div>

              <div className="min-w-0 space-y-6">
                <div className={`${COUNCIL_DASH7030_WHITECARD} p-5`} style={COUNCIL_DASH7030_WHITECARD_SHADOW}>
                  <p className={COUNCIL_OVERLINE}>Møter</p>
                  {meetingsThisWeekCount > 0 ? (
                    <div className="mt-3 rounded-md border border-orange-200/90 bg-orange-50/90 px-3 py-2.5 text-sm text-orange-950">
                      <span className="font-semibold text-orange-900">{meetingsThisWeekCount}</span>{' '}
                      {meetingsThisWeekCount === 1 ? 'møte planlagt' : 'møter planlagt'} de neste 7 dagene.
                    </div>
                  ) : (
                    <div className="mt-3 rounded-md border border-neutral-200/80 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-600">
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
                        className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
                        aria-label="Forrige måned"
                      >
                        <ChevronLeft className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setInterviewCalMonth((m) => addCalendarMonths(m, 1))}
                        className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
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
                              className={`relative flex size-8 items-center justify-center rounded-full tabular-nums ${
                                isNext ? 'bg-[#c9a227] font-semibold text-white' : 'text-neutral-700'
                              }`}
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

                <div className={`${COUNCIL_DASH7030_WHITECARD} overflow-hidden p-0`} style={COUNCIL_DASH7030_WHITECARD_SHADOW}>
                  <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Siste hendelser</p>
                    <button
                      type="button"
                      onClick={() => setTab('audit')}
                      className="text-xs font-semibold uppercase tracking-wide text-neutral-600 hover:text-neutral-900"
                    >
                      Revisjonslogg
                    </button>
                  </div>
                  {overviewRecentAudit.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-neutral-500">Ingen hendelser i loggen ennå.</p>
                  ) : (
                    <ul className="divide-y divide-neutral-100">
                      {overviewRecentAudit.map((it) => (
                        <li key={it.id} className="flex gap-3 px-4 py-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                            <Mail className="size-4" aria-hidden />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-neutral-800">{it.text}</p>
                            <p className="mt-1 text-xs text-neutral-400">{it.when}</p>
                          </div>
                          <span className="shrink-0 text-neutral-400" aria-hidden>
                            <MoreHorizontal className="size-4" />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {tab === 'board' && (
        <div className="mt-8 space-y-10">
          <header className="max-w-none">
            <h2 className={COUNCIL_MAIN_HEADING}>AMU og sammensetting</h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
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
          </header>

          <div className={`${COUNCIL_MAIN_SIDE_GRID} lg:items-stretch`}>
            <div className="flex min-h-0 flex-col">
              <section
                className={`${R_FLAT} flex min-h-0 flex-1 flex-col overflow-hidden border border-neutral-200/90 bg-white shadow-sm`}
              >
                <div className="shrink-0 border-b border-neutral-200/80 bg-white px-4 py-3">
                  <p className={COUNCIL_OVERLINE}>Sammensetting og styre</p>
                </div>
                <div className="min-h-0 flex-1 space-y-8 overflow-y-auto p-5">
                <div>
                  <h3 className={COUNCIL_OVERLINE}>Innstillinger for sammensetting</h3>
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
                        className={`${R_FLAT} size-4 border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]`}
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
                </div>

                {ct.requiresVerneombud && !rep.members.some((m) => m.isVerneombud) && (
                  <div className={`${R_FLAT} flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-3`}>
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
                    <div className={`${R_FLAT} flex items-start gap-3 border border-sky-200 bg-sky-50 px-4 py-3`}>
                      <Bell className="mt-0.5 size-4 shrink-0 text-sky-600" />
                      <p className="text-sm text-sky-900">
                        <strong>{soon.length} verv utløper innen 60 dager:</strong>{' '}
                        {soon.map((m) => `${m.name} (${m.termUntil})`).join(', ')}. Planlegg nyvalg.
                      </p>
                    </div>
                  )
                })()}

                <div className="border-t border-neutral-200 pt-8">
                  <div className="grid gap-x-6 gap-y-3 lg:grid-cols-2">
                    <div className="flex flex-wrap items-end justify-between gap-2 lg:col-span-2">
                      <h3 className={COUNCIL_OVERLINE}>Styre</h3>
                      <span className={`${COUNCIL_OVERLINE} text-neutral-400`}>
                        Koblet til AMU-linje · rediger nedenfor
                      </span>
                    </div>
                    <p className={`${COUNCIL_BODY} lg:col-span-2`}>
                      Styregister (etter AMU-valg) vises øverst i hvert medlemskort når navnet samsvarer med en
                      representant. Juster funksjon, periode og verneombud i samme kort.
                    </p>
                    <div className="flex min-h-[2.75rem] items-center justify-between gap-2 border-b border-neutral-200 pb-2">
                      <h4 className={COUNCIL_OVERLINE}>Arbeidstakere (valgt)</h4>
                      <button
                        type="button"
                        onClick={() => rep.addEmployeePlaceholder()}
                        className="shrink-0 text-sm font-medium text-[#1a3d32] hover:underline"
                      >
                        + Legg til
                      </button>
                    </div>
                    <div className="flex min-h-[2.75rem] items-center justify-between gap-2 border-b border-neutral-200 pb-2">
                      <h4 className={COUNCIL_OVERLINE}>Arbeidsgiver (oppnevnt)</h4>
                      <button
                        type="button"
                        onClick={() => rep.addLeadershipPlaceholder()}
                        className="shrink-0 text-sm font-medium text-[#1a3d32] hover:underline"
                      >
                        + Legg til
                      </button>
                    </div>
                    <MemberColumn
                      members={rep.members.filter((m) => m.side === 'employee')}
                      onUpdate={rep.updateMember}
                      board={council.board}
                      termNowMs={uiNowAnchor}
                      headerless
                      representativeSide="employee"
                      learning={learning}
                    />
                    <MemberColumn
                      members={rep.members.filter((m) => m.side === 'leadership')}
                      onUpdate={rep.updateMember}
                      board={council.board}
                      termNowMs={uiNowAnchor}
                      headerless
                      representativeSide="leadership"
                      learning={learning}
                    />
                  </div>
                  {boardMembersWithoutRepMatch.length > 0 ? (
                    <div className="mt-6 border-t border-neutral-100 pt-6">
                      <h4 className={COUNCIL_OVERLINE}>Kun i styre-register</h4>
                      <p className="mt-1 text-xs text-neutral-500">
                        Disse er registrert etter AMU-valg, men matcher ingen representantlinje (navn må samsvare for
                        kobling).
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {boardMembersWithoutRepMatch.map((bm) => (
                          <div
                            key={bm.id}
                            className={`${R_FLAT} flex gap-3 border border-neutral-200/90 bg-[#faf8f4] p-3 text-sm`}
                          >
                            <img
                              src={avatarUrlFromSeed(bm.id + bm.name, 56)}
                              alt=""
                              className={`${R_FLAT} size-10 shrink-0 object-cover ring-1 ring-neutral-200/80`}
                            />
                            <div className="min-w-0">
                              <p className="font-semibold text-neutral-900">{bm.name}</p>
                              <p className="mt-0.5 text-xs text-neutral-600">{roleLabel(bm.role)}</p>
                              <p className="mt-2 text-xs text-neutral-500">
                                Periode slutt:{' '}
                                <span className="font-medium tabular-nums text-neutral-800">
                                  {bm.termUntil ?? '—'}
                                </span>
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="border-t border-neutral-200 pt-6">
                  <AddTaskLink
                    title="Oppfølging representasjon / AMU"
                    module="members"
                    sourceType="representatives"
                    ownerRole="Tillitsvalgt"
                    requiresManagementSignOff
                  />
                </div>
                </div>
              </section>
            </div>

            <aside
              className={`${R_FLAT} flex min-h-0 flex-col overflow-hidden border border-neutral-200/90 bg-[#faf8f4]/80`}
            >
              <div className="shrink-0 border-b border-neutral-200/80 bg-white px-4 py-3">
                <p className={COUNCIL_OVERLINE}>Valg arbeidstakerrepresentanter og AMU-valg</p>
              </div>
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5">
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

                <CouncilValgCollapsibleSection
                  sectionKey="new"
                  title="Nytt valg (arbeidstakerrepresentanter)"
                  count={0}
                  expanded={valgSectionExpanded('new')}
                  onToggle={() => toggleValgSection('new')}
                >
                  <form
                    className="space-y-3"
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
                </CouncilValgCollapsibleSection>

                <CouncilValgCollapsibleSection
                  sectionKey="supp"
                  title="Suppleringsvalg arbeidstakerrepresentant 2026"
                  count={repElectionSections.supplementary.length}
                  expanded={valgSectionExpanded('supp')}
                  onToggle={() => toggleValgSection('supp')}
                >
                  <div className="space-y-3">
                    {repElectionSections.supplementary.map((el) => (
                      <RepElectionCard
                        key={`${el.id}-${el.status}`}
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
                      />
                    ))}
                    {repElectionSections.supplementary.length === 0 ? (
                      <p className={COUNCIL_SMALL}>
                        Ingen suppleringsvalg (matcher tittel «suppleringsvalg» eller «2026»).
                      </p>
                    ) : null}
                  </div>
                </CouncilValgCollapsibleSection>

                <CouncilValgCollapsibleSection
                  sectionKey="at2027"
                  title="Valg arbeidstakerrepresentanter 2027"
                  count={repElectionSections.at2027.length}
                  expanded={valgSectionExpanded('at2027')}
                  onToggle={() => toggleValgSection('at2027')}
                >
                  <div className="space-y-3">
                    {repElectionSections.at2027.map((el) => (
                      <RepElectionCard
                        key={`${el.id}-${el.status}`}
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
                      />
                    ))}
                    {repElectionSections.at2027.length === 0 ? (
                      <p className={COUNCIL_SMALL}>Ingen valg med «2027» i tittelen.</p>
                    ) : null}
                  </div>
                </CouncilValgCollapsibleSection>

                <CouncilValgCollapsibleSection
                  sectionKey="at2024"
                  title="Valg 2024 (avsluttet)"
                  count={repElectionSections.at2024.length}
                  expanded={valgSectionExpanded('at2024')}
                  onToggle={() => toggleValgSection('at2024')}
                >
                  <div className="space-y-3">
                    {repElectionSections.at2024.map((el) => (
                      <RepElectionCard
                        key={`${el.id}-${el.status}`}
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
                      />
                    ))}
                    {repElectionSections.at2024.length === 0 ? (
                      <p className={COUNCIL_SMALL}>Ingen valg med «2024» i tittelen.</p>
                    ) : null}
                  </div>
                </CouncilValgCollapsibleSection>

                {repElectionSections.other.length > 0 ? (
                  <CouncilValgCollapsibleSection
                    sectionKey="other"
                    title="Øvrige valg"
                    count={repElectionSections.other.length}
                    expanded={valgSectionExpanded('other')}
                    onToggle={() => toggleValgSection('other')}
                  >
                    <div className="space-y-3">
                      {repElectionSections.other.map((el) => (
                        <RepElectionCard
                          key={`${el.id}-${el.status}`}
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
                        />
                      ))}
                    </div>
                  </CouncilValgCollapsibleSection>
                ) : null}

                <CouncilValgCollapsibleSection
                  sectionKey="periods"
                  title="Valgperioder"
                  count={rep.periods.length}
                  expanded={valgSectionExpanded('periods')}
                  onToggle={() => toggleValgSection('periods')}
                >
                  <form
                    className="flex flex-col gap-2"
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
                </CouncilValgCollapsibleSection>

                <CouncilValgCollapsibleSection
                  sectionKey="amu"
                  title="AMU-valg (modul)"
                  count={council.elections.length}
                  expanded={valgSectionExpanded('amu')}
                  onToggle={() => toggleValgSection('amu')}
                >
                  <form onSubmit={handleNewElection} className="flex flex-col gap-2">
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
                        key={`${el.id}-${el.status}`}
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
                </CouncilValgCollapsibleSection>
              </div>
            </aside>
          </div>
        </div>
      )}

      {tab === 'meetings' && (
        <div className="mt-6 space-y-6">
          {meetingsNeedingDistribution.length > 0 && (
            <div className={`${R_FLAT} flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-3`}>
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-900">
                  Frist for utsending av saksliste — {meetingsNeedingDistribution.length} møte
                  {meetingsNeedingDistribution.length > 1 ? 'r' : ''}
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  Innkalling og agenda skal sendes til AMU-medlemmene minst 7 dager før møtet (Forskrift om organisering,
                  ledelse og medvirkning §3-2).
                </p>
                <ul className="mt-2 space-y-1">
                  {meetingsNeedingDistribution.map((m) => {
                    const days = Math.ceil((new Date(m.startsAt).getTime() - uiNowAnchor) / 86400000)
                    return (
                      <li key={m.id} className="flex flex-wrap items-center gap-2 text-xs text-amber-800">
                        <span className="font-medium">{m.title}</span>
                        <span>— om {days} dag{days !== 1 ? 'er' : ''}</span>
                        <button
                          type="button"
                          onClick={() => council.sendInvitation(m.id, ['AMU-medlemmer'])}
                          className={`${R_FLAT} bg-amber-600 px-2 py-0.5 text-white hover:bg-amber-700`}
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

          <div className={`${COUNCIL_MAIN_SIDE_GRID} lg:items-start`}>
            <div className="min-w-0 space-y-6">
              <div className={`${R_FLAT} border border-neutral-200/90 bg-white p-5 shadow-sm`}>
                <p className={COUNCIL_OVERLINE}>
                  Auto-injisert agendagrunnlag — siden siste møte
                  {lastMeetingDate ? (
                    <span className="ml-1 font-normal text-neutral-400">
                      ({new Date(lastMeetingDate).toLocaleDateString('no-NO')})
                    </span>
                  ) : null}
                </p>
                {incidentsSinceLastMeeting.length > 0 || latestSickLeavePct > 0 || openHighRisks.length > 0 ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {incidentsSinceLastMeeting.length > 0 && (
                      <Link
                        to="/workplace-reporting/incidents"
                        className={`${R_FLAT} group block border border-neutral-200 bg-white p-3 transition-colors hover:border-red-200 hover:bg-red-50/30`}
                      >
                        <div
                          className={`text-2xl font-bold ${highSeverityIncidents.length > 0 ? 'text-red-700' : 'text-neutral-800'}`}
                        >
                          {incidentsSinceLastMeeting.length}
                        </div>
                        <div className="text-xs text-neutral-600">Hendelser siden siste møte</div>
                        {highSeverityIncidents.length > 0 && (
                          <div className="mt-1 text-xs font-semibold text-red-600">
                            {highSeverityIncidents.length} høy/kritisk — gjennomgå
                          </div>
                        )}
                      </Link>
                    )}
                    {latestSickLeavePct > 0 && (
                      <Link
                        to="/hse?tab=sickness"
                        className={`${R_FLAT} block border border-neutral-200 bg-white p-3 hover:border-amber-200 hover:bg-amber-50/30`}
                      >
                        <div className="text-2xl font-bold text-amber-700">{latestSickLeavePct}</div>
                        <div className="text-xs text-neutral-600">Aktive sykefravær</div>
                      </Link>
                    )}
                    {openHighRisks.length > 0 && (
                      <Link
                        to="/internal-control?tab=ros"
                        className={`${R_FLAT} block border border-neutral-200 bg-white p-3 hover:border-orange-200 hover:bg-orange-50/30`}
                      >
                        <div className="text-2xl font-bold text-orange-700">{openHighRisks.length}</div>
                        <div className="text-xs text-neutral-600">ROS høyrisikoer (≥12) til gjennomgang</div>
                      </Link>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-neutral-500">
                    Ingen nye signaler (hendelser, sykefravær eller åpne ROS-høyrisikoer) siden siste møte — eller ingen
                    tidligere møtedato registrert.
                  </p>
                )}
              </div>

              <div className={`${R_FLAT} border border-neutral-200/90 bg-white p-5 shadow-sm`}>
                <div className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-100 pb-4">
                  <div>
                    <p className={COUNCIL_OVERLINE}>Årshjul</p>
                    <label className={`mt-2 block ${COUNCIL_BODY}`}>
                      År for årshjul
                      <input
                        type="number"
                        value={wheelYear}
                        onChange={(e) => setWheelYear(Number(e.target.value) || new Date().getFullYear())}
                        className={`${R_FLAT} ml-2 w-24 border border-neutral-200 px-2 py-1 text-sm`}
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewMeetingOpen(true)}
                    className={`${HERO_ACTION_CLASS} gap-2 bg-[#1a3d32] text-white hover:bg-[#142e26]`}
                  >
                    <Plus className="size-4 shrink-0" aria-hidden />
                    Nytt møte
                  </button>
                </div>
                <div className="pt-5">
                  <GovernanceWheel
                    year={wheelYear}
                    meetings={council.meetings}
                    onQuarterClick={(q) => {
                      setMeetingForm((s) => ({ ...s, quarterSlot: q }))
                      setNewMeetingOpen(true)
                    }}
                  />
                </div>
              </div>
            </div>

            <aside className={`${R_FLAT} border border-neutral-200/90 bg-[#faf8f4]/80`}>
              <div className="border-b border-neutral-200/80 bg-white px-4 py-3">
                <h2 className={COUNCIL_SUBHEADING}>Alle møter</h2>
                <p className={`mt-1 ${COUNCIL_SMALL}`}>Klikk en rad for å åpne i sidevinduet.</p>
                <label className={`${SETTINGS_FIELD_LABEL} mt-3 block`} htmlFor="meetings-year-filter">
                  År
                </label>
                <select
                  id="meetings-year-filter"
                  value={
                    meetingsListYearFilter === 'current_and_prior'
                      ? 'current_and_prior'
                      : String(meetingsListYearFilter)
                  }
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === 'current_and_prior') setMeetingsListYearFilter('current_and_prior')
                    else setMeetingsListYearFilter(Number(v))
                  }}
                  className={`${TASK_PANEL_SELECT} mt-1.5 text-sm`}
                >
                  <option value="current_and_prior">
                    {new Date().getFullYear()} og {new Date().getFullYear() - 1} (standard)
                  </option>
                  {meetingListYearOptions.map((y) => (
                    <option key={y} value={String(y)}>
                      Kun {y}
                    </option>
                  ))}
                </select>
              </div>
              <div className="max-h-[min(75vh,720px)] overflow-y-auto overflow-x-auto">
                {council.meetings.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-neutral-500">Ingen møter ennå.</p>
                ) : meetingsFilteredForTable.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-neutral-500">
                    Ingen møter for valgt årsfilter.
                  </p>
                ) : (
                  <table className="w-full min-w-[280px] border-collapse text-left text-sm">
                    <thead>
                      <tr className={`border-b border-neutral-200 bg-white ${COUNCIL_OVERLINE}`}>
                        <th className="px-3 py-2">Møte</th>
                        <th className="px-3 py-2">Tid</th>
                        <th className="px-3 py-2">År</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meetingsFilteredForTable.map((m) => {
                        const statusStyle =
                          m.status === 'completed'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                            : m.status === 'cancelled'
                              ? 'border-neutral-200 bg-neutral-100 text-neutral-700'
                              : 'border-sky-200 bg-sky-50 text-sky-900'
                        return (
                          <tr
                            key={m.id}
                            className="cursor-pointer border-b border-neutral-100 bg-white/60 transition-colors hover:bg-white"
                            onClick={() => {
                              setSelectedMeetingId(m.id)
                              setMeetingDetailOpen(true)
                            }}
                          >
                            <td className="px-3 py-2 align-top text-xs font-medium text-[#1a3d32]">{m.title}</td>
                            <td className={`px-3 py-2 align-top ${COUNCIL_SMALL}`}>
                              {formatWhen(m.startsAt)}
                            </td>
                            <td className="px-3 py-2 align-top text-xs text-neutral-600 tabular-nums">
                              {meetingGovernanceYear(m)}
                              {m.quarterSlot ? ` · Q${m.quarterSlot}` : ''}
                            </td>
                            <td className="px-3 py-2 align-top">
                              <span
                                className={`inline-flex ${R_FLAT} border px-1.5 py-0.5 text-[10px] font-semibold ${statusStyle}`}
                              >
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
            </aside>
          </div>

          {(newMeetingOpen || meetingDetailOpen) && (
            <div
              className="fixed inset-0 z-[70] flex justify-end bg-black/45 backdrop-blur-[2px]"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                  setNewMeetingOpen(false)
                  setMeetingDetailOpen(false)
                }
              }}
            >
              <div
                className={`flex h-full w-full max-w-[min(100vw,920px)] flex-col border-l border-neutral-200/90 shadow-[-12px_0_40px_rgba(0,0,0,0.12)] ${MEETING_PANEL_SURFACE}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="council-meeting-panel-title"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <header className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-200/90 px-6 py-5 sm:px-8 sm:py-6">
                  <h2
                    id="council-meeting-panel-title"
                    className="max-w-[min(100%,28rem)] text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl"
                  >
                    {newMeetingOpen ? 'Nytt møte' : selectedMeeting?.title ?? 'Møte'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setNewMeetingOpen(false)
                      setMeetingDetailOpen(false)
                    }}
                    className={`${R_FLAT} p-2 text-neutral-500 transition hover:bg-neutral-200/60 hover:text-neutral-800`}
                    aria-label="Lukk"
                  >
                    <X className="size-6" />
                  </button>
                </header>

                {newMeetingOpen ? (
                  <form
                    className="flex min-h-0 flex-1 flex-col"
                    onSubmit={(e) => void handleAddMeeting(e)}
                  >
                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 sm:px-8">
                      <div className={TASK_PANEL_ROW_GRID}>
                        <div>
                          <h3 className={COUNCIL_SUBHEADING}>Grunnlag</h3>
                          <p className={`${SETTINGS_LEAD} mt-2`}>
                            Knytt møtet til kvartal i årshjulet. Du kan laste inn foreslått agenda automatisk eller lime
                            inn egen tekst.
                          </p>
                        </div>
                        <div className={TASK_PANEL_INSET}>
                          <label className={SETTINGS_FIELD_LABEL} htmlFor="meet-new-title">
                            Tittel
                          </label>
                          <input
                            id="meet-new-title"
                            value={meetingForm.title}
                            onChange={(e) => setMeetingForm((s) => ({ ...s, title: e.target.value }))}
                            className={TASK_PANEL_SELECT}
                            required
                          />
                          <label className={`${SETTINGS_FIELD_LABEL} mt-4`} htmlFor="meet-new-start">
                            Starttid
                          </label>
                          <input
                            id="meet-new-start"
                            type="datetime-local"
                            value={meetingForm.startsAt}
                            onChange={(e) => setMeetingForm((s) => ({ ...s, startsAt: e.target.value }))}
                            className={TASK_PANEL_SELECT}
                            required
                          />
                          <label className={`${SETTINGS_FIELD_LABEL} mt-4`} htmlFor="meet-new-loc">
                            Sted / lenke
                          </label>
                          <input
                            id="meet-new-loc"
                            value={meetingForm.location}
                            onChange={(e) => setMeetingForm((s) => ({ ...s, location: e.target.value }))}
                            className={TASK_PANEL_SELECT}
                          />
                        </div>
                      </div>
                      <div className="my-8 border-t border-neutral-200/90" />
                      <div className={TASK_PANEL_ROW_GRID}>
                        <div>
                          <h3 className={COUNCIL_SUBHEADING}>Årshjul og agenda</h3>
                          <p className={`${SETTINGS_LEAD} mt-2`}>
                            Kalenderår og kvartal styrer plassering i årshjulet. Valgfritt forslag til agendapunkter fra
                            modulene.
                          </p>
                        </div>
                        <div className={TASK_PANEL_INSET}>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <label className={SETTINGS_FIELD_LABEL} htmlFor="meet-new-gy">
                                Kalenderår
                              </label>
                              <input
                                id="meet-new-gy"
                                type="number"
                                value={meetingForm.governanceYear}
                                onChange={(e) =>
                                  setMeetingForm((s) => ({
                                    ...s,
                                    governanceYear: Number(e.target.value) || wheelYear,
                                  }))
                                }
                                className={TASK_PANEL_SELECT}
                              />
                            </div>
                            <div>
                              <label className={SETTINGS_FIELD_LABEL} htmlFor="meet-new-q">
                                Kvartal
                              </label>
                              <select
                                id="meet-new-q"
                                value={meetingForm.quarterSlot}
                                onChange={(e) =>
                                  setMeetingForm((s) => ({
                                    ...s,
                                    quarterSlot: Number(e.target.value) as QuarterSlot,
                                  }))
                                }
                                className={TASK_PANEL_SELECT}
                              >
                                <option value={1}>Q1</option>
                                <option value={2}>Q2</option>
                                <option value={3}>Q3</option>
                                <option value={4}>Q4</option>
                              </select>
                            </div>
                          </div>
                          <label className={`${SETTINGS_FIELD_LABEL} mt-4 flex items-center gap-2`}>
                            <input
                              type="checkbox"
                              checked={meetingForm.applySuggestedAgenda}
                              onChange={(e) =>
                                setMeetingForm((s) => ({ ...s, applySuggestedAgenda: e.target.checked }))
                              }
                              className="size-4 rounded border-neutral-300"
                            />
                            Bruk foreslått agenda (data fra HMS / internkontroll)
                          </label>
                          {!meetingForm.applySuggestedAgenda ? (
                            <>
                              <label className={`${SETTINGS_FIELD_LABEL} mt-4`} htmlFor="meet-new-agenda">
                                Agenda (tekst)
                              </label>
                              <textarea
                                id="meet-new-agenda"
                                value={meetingForm.agendaText}
                                onChange={(e) => setMeetingForm((s) => ({ ...s, agendaText: e.target.value }))}
                                rows={5}
                                className={TASK_PANEL_SELECT}
                                placeholder="Lim inn eller skriv agendapunkter …"
                              />
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-neutral-200/90 bg-[#f0efe9] px-6 py-4 sm:px-8">
                      <button
                        type="button"
                        onClick={() => setNewMeetingOpen(false)}
                        className={`${HERO_ACTION_CLASS} border border-neutral-300 bg-white text-neutral-800`}
                      >
                        Avbryt
                      </button>
                      <button
                        type="submit"
                        className={`${HERO_ACTION_CLASS} gap-2 bg-[#1a3d32] text-white hover:bg-[#142e26]`}
                      >
                        <Calendar className="size-4 shrink-0" />
                        Legg til møte
                      </button>
                    </footer>
                  </form>
                ) : (
                  <>
                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 sm:px-8">
                      {meetingDetailOpen && selectedMeeting ? (
                        <MeetingDetailPanel
                          meeting={selectedMeeting}
                          council={council}
                          auditDraft={auditDraft}
                          setAuditDraft={setAuditDraft}
                          inviteRecipientsDraft={inviteRecipients[selectedMeeting.id] ?? ''}
                          setInviteRecipientsDraft={(v) =>
                            setInviteRecipients((r) => ({ ...r, [selectedMeeting.id]: v }))
                          }
                          attendeesDraft={attendeesInput[selectedMeeting.id] ?? ''}
                          setAttendeesDraft={(v) => setAttendeesInput((r) => ({ ...r, [selectedMeeting.id]: v }))}
                          quorumDraft={quorumInput[selectedMeeting.id] ?? false}
                          setQuorumDraft={(v) => setQuorumInput((r) => ({ ...r, [selectedMeeting.id]: v }))}
                          itemMinutesDraft={itemMinutes}
                          setItemMinutesDraft={setItemMinutes}
                          onCreateTask={createTaskFromDecision}
                        />
                      ) : null}
                    </div>
                    <footer className="shrink-0 border-t border-neutral-200/90 bg-[#f0efe9] px-6 py-4 sm:px-8">
                      <button
                        type="button"
                        onClick={() => setMeetingDetailOpen(false)}
                        className={`${HERO_ACTION_CLASS} w-full border border-neutral-300 bg-white text-neutral-800`}
                      >
                        Lukk
                      </button>
                    </footer>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}


      {tab === 'requirements' && (
        <div className="mt-6 space-y-10">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {requirementsOverviewKpis.map((item) => (
              <div key={item.title} className={SETTINGS_THRESHOLD_BOX} style={menu1.barStyle}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/85">{item.title}</p>
                <p className="mt-1 text-xs text-white/70">{item.sub}</p>
                <p className="mt-2 text-lg font-semibold tabular-nums text-white">{item.value}</p>
              </div>
            ))}
          </div>

          <section>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className={COUNCIL_OVERLINE}>Rådsinnsikt</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ModuleDonutCard
                title="Samsvarssjekk"
                subtitle="Oppfylt vs. gjenstående"
                segments={councilComplianceSegments.entries}
                total={councilComplianceSegments.total}
                emptyHint="Ingen sjekklistepunkter."
              />
              <ModuleDonutCard
                title="Vedtak"
                subtitle="Registrerte formelle vedtak"
                segments={councilDecisionSegments.entries}
                total={councilDecisionSegments.total}
                emptyHint="Ingen vedtak registrert ennå."
              />
            </div>
          </section>

          <div className={`${R_FLAT} border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950`}>
            <strong>Merk:</strong> Sjekklisten er et strukturert utgangspunkt for typiske krav; den erstatter ikke
            juridisk bistand — kontroller mot{' '}
            <a
              href="https://lovdata.no"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[#1a3d32] underline"
            >
              lovdata.no
            </a>
            . Vedtaksregisteret henter tekst fra møtereferat og revisjonslogg; klikk en rad for full ordlyd.
          </div>

          {/* ── Del 1: Sjekkliste og krav ───────────────────────────────────── */}
          <section className="space-y-5">
            <div>
              <h2 className={COUNCIL_SECTION_HEADING}>Sjekkliste og krav</h2>
              <p className={`mt-2 max-w-2xl ${COUNCIL_BODY}`}>
                Strukturert samsvarssjekk med lovhenvisninger, notater og oppgavekobling. Legg til egne punkter etter
                behov.
              </p>
            </div>

            <div className={`${R_FLAT} border border-neutral-200/90 bg-white p-5 shadow-sm`}>
              <h3 className={COUNCIL_SUBHEADING}>Egne punkter</h3>
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
                  className={`${R_FLAT} border border-neutral-200 px-3 py-2 text-sm sm:col-span-2`}
                  required
                />
                <input
                  placeholder="Henvisning (lov / avtale)"
                  value={customItem.lawRef}
                  onChange={(e) => setCustomItem((s) => ({ ...s, lawRef: e.target.value }))}
                  className={`${R_FLAT} border border-neutral-200 px-3 py-2 text-sm sm:col-span-2`}
                />
                <textarea
                  placeholder="Beskrivelse"
                  value={customItem.description}
                  onChange={(e) => setCustomItem((s) => ({ ...s, description: e.target.value }))}
                  rows={2}
                  className={`${R_FLAT} resize-y border border-neutral-200 px-3 py-2 text-sm sm:col-span-2`}
                />
                <button
                  type="submit"
                  className={`${HERO_ACTION_CLASS} bg-[#1a3d32] text-white hover:bg-[#142e26] sm:col-span-2 sm:justify-self-start`}
                >
                  Legg til punkt
                </button>
              </form>
            </div>

            <div className={`${R_FLAT} overflow-hidden border border-neutral-200/90 bg-white shadow-sm`}>
              <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
                <h3 className={COUNCIL_SUBHEADING}>Krav og oppgaver</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-[#faf8f4] text-xs font-semibold uppercase tracking-wide text-neutral-600">
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
                        className={`border-b border-neutral-100 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-[#faf8f4]/60'} ${
                          c.done ? 'opacity-90' : ''
                        }`}
                      >
                        <td className="align-top px-3 py-3">
                          <input
                            type="checkbox"
                            checked={c.done}
                            onChange={() => council.toggleCompliance(c.id)}
                            className={`${R_FLAT} mt-1 size-4 border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]`}
                          />
                        </td>
                        <td className="align-top px-3 py-3">
                          <span className="font-medium text-neutral-900">{c.title}</span>
                          {c.isCustom ? (
                            <span className={`${R_FLAT} ml-2 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900`}>
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
                            className={`${R_FLAT} w-full min-w-[160px] border border-neutral-200 bg-white px-2 py-1.5 text-xs`}
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
            </div>
          </section>

          {/* ── Del 2: Vedtaksregister ──────────────────────────────────────── */}
          <section className="space-y-5 border-t border-neutral-200 pt-10">
            <div>
              <h2 className={COUNCIL_SECTION_HEADING}>Vedtaksregister</h2>
              <p className={`mt-2 max-w-2xl ${COUNCIL_BODY}`}>
                Alle formelle vedtak på tvers av AMU-møter. Søk og åpne en rad for full tekst.
              </p>
            </div>

            <div className="relative max-w-md">
              <input
                value={decisionSearch}
                onChange={(e) => setDecisionSearch(e.target.value)}
                placeholder="Søk i vedtak…"
                className={`${R_FLAT} w-full border border-neutral-200 bg-white py-2 pl-10 pr-4 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]`}
              />
              <ScrollText className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            </div>

            <div className={`${R_FLAT} overflow-hidden border border-neutral-200/90 bg-white shadow-sm`}>
              <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-3">
                <h3 className={COUNCIL_SUBHEADING}>Alle vedtak</h3>
                <span className={COUNCIL_SMALL}>{council.allDecisions.length} totalt</span>
              </div>
              {council.allDecisions.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-neutral-500">
                  Ingen vedtak ennå. Registrer vedtak under «Vedtak» i møterevisjonsloggen, eller legg til formelt vedtak
                  per agendapunkt under Møter.
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
                  <h2 className={COUNCIL_SUBHEADING}>Vedtak</h2>
                  <button
                    type="button"
                    onClick={() => setDecisionPanelId(null)}
                    className={`${R_FLAT} p-2 text-neutral-500 hover:bg-neutral-100`}
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
                  <div className={`${R_FLAT} border border-neutral-200 bg-neutral-50 p-3 text-neutral-900`}>
                    {decisionPanel.decision}
                  </div>
                </div>
              </div>
            </div>
          )}
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
}: {
  election: RepElection
  candDraft: string
  setCandDraft: (v: string) => void
  onAddCandidate: () => void
  onOpen: () => void
  onVote: (candidateId: string) => void
  onClose: () => void
}) {
  const closed = election.status === 'closed'
  const open = election.status === 'open'
  const draft = election.status === 'draft'
  const sorted = [...election.candidates].sort((a, b) => b.voteCount - a.voteCount)
  const [detailOpen, setDetailOpen] = useState(!closed)

  const summaryLine = `${election.anonymous ? 'Anonym' : 'Åpne navn'} · ${election.seatsToFill} seter · ${election.votesCastTotal} stemmer · ${sorted.length} kandidat${sorted.length === 1 ? '' : 'er'}`

  return (
    <div className={`${R_FLAT} border border-neutral-200/90 bg-white p-3 shadow-sm`}>
      {closed && !detailOpen ? (
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className={`${R_FLAT} flex w-full items-start justify-between gap-2 text-left hover:bg-neutral-50/80`}
        >
          <div className="min-w-0">
            <p className={COUNCIL_OVERLINE}>{election.title}</p>
            <p className={`mt-1 ${COUNCIL_SMALL}`}>{summaryLine}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className={`${R_FLAT} bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-700`}>
              Avsluttet
            </span>
            <ChevronRight className="size-4 text-neutral-500" aria-hidden />
          </div>
        </button>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              {closed ? (
                <button
                  type="button"
                  onClick={() => setDetailOpen(false)}
                  className={`${R_FLAT} -ml-1 flex items-center gap-1 text-left hover:bg-neutral-100/80`}
                >
                  <ChevronDown className="size-4 shrink-0 text-neutral-500" aria-hidden />
                  <span className={COUNCIL_OVERLINE}>{election.title}</span>
                </button>
              ) : (
                <h3 className={COUNCIL_SUBHEADING}>{election.title}</h3>
              )}
              {election.description ? (
                <p className="mt-1 line-clamp-2 text-xs text-neutral-600">{election.description}</p>
              ) : null}
              <p className={`mt-2 ${COUNCIL_SMALL}`}>
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
                  className={`${R_FLAT} bg-[#1a3d32] px-2.5 py-1 text-[10px] font-medium text-white disabled:opacity-40 sm:text-xs`}
                >
                  Åpne
                </button>
              ) : null}
              {open ? (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={election.candidates.length === 0}
                  className={`${R_FLAT} border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-medium disabled:opacity-40 sm:text-xs`}
                >
                  Avslutt
                </button>
              ) : null}
              {closed ? (
                <span className={`${R_FLAT} bg-neutral-100 px-2.5 py-1 text-[10px] font-medium text-neutral-700`}>
                  Avsluttet
                </span>
              ) : null}
            </div>
          </div>

          {(draft || open) && (
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                value={candDraft}
                onChange={(e) => setCandDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAddCandidate())}
                placeholder="Kandidatnavn"
                className={`${R_FLAT} min-w-0 flex-1 border border-neutral-200 px-2 py-1.5 text-xs sm:text-sm`}
              />
              <button
                type="button"
                onClick={onAddCandidate}
                className={`${R_FLAT} border border-neutral-200 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 sm:text-sm`}
              >
                Legg til
              </button>
            </div>
          )}

          <ul className="mt-2 space-y-1.5">
            {sorted.map((c) => {
              const letterIdx = repCandidateLetterIndex(election, c.id)
              const display = repCandidateDisplayName(election, letterIdx, c.name, closed)
              return (
                <li
                  key={c.id}
                  className={`${R_FLAT} flex flex-wrap items-center justify-between gap-2 bg-[#faf8f4] px-2 py-1.5 text-xs sm:text-sm`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <img
                      src={avatarUrlFromSeed(`${election.id}-${c.id}-${c.name}`, 40)}
                      alt=""
                      className={`${R_FLAT} size-8 shrink-0 object-cover`}
                    />
                    <span className="truncate font-medium text-neutral-900">{display}</span>
                  </span>
                  <span className="text-neutral-600">{c.voteCount}</span>
                  {open ? (
                    <button
                      type="button"
                      onClick={() => onVote(c.id)}
                      className={`${R_FLAT} bg-[#1a3d32] px-2 py-0.5 text-[10px] font-medium text-white hover:bg-[#142e26]`}
                    >
                      Stem
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ul>
          {election.anonymous && open ? (
            <p className={`mt-2 ${COUNCIL_SMALL}`}>Anonyme valg: kandidater som A, B, … til lukking.</p>
          ) : null}
        </>
      )}
    </div>
  )
}

// ─── AMU member column (from former MembersModule) ──────────────────────────

function MemberColumn({
  title,
  members,
  onUpdate,
  onAdd,
  board,
  termNowMs,
  embedded,
  headerless,
  representativeSide,
  learning,
}: {
  title?: string
  members: RepresentativeMember[]
  onUpdate: ReturnType<typeof useRepresentatives>['updateMember']
  onAdd?: () => void
  board?: BoardMember[]
  /** Stable "now" for term badges (required for «utløper snart»). */
  termNowMs: number
  embedded?: boolean
  /** Kolonne uten egen tittelrad (brukes når overskrifter ligger i foreldrerutenett). */
  headerless?: boolean
  /** Påkrevd når `headerless` — bestemmer hvilke verv som kan velges. */
  representativeSide?: 'employee' | 'leadership'
  learning?: ReturnType<typeof useLearning>
}) {
  const roles: RepresentativeOfficeRole[] =
    representativeSide === 'leadership' || (title && title.includes('Arbeidsgiver'))
      ? ['leadership_chair', 'leadership_deputy', 'leadership_member']
      : ['employee_chair', 'employee_deputy', 'employee_member']

  const today = new Date().toISOString().slice(0, 10)
  const outerClass = headerless
    ? 'min-w-0'
    : embedded
      ? 'border-t border-neutral-100 pt-6 first:border-t-0 first:pt-0'
      : `${R_FLAT} border border-neutral-200/90 bg-white p-5 shadow-sm`
  const cardClass = (termExpired: boolean, termExpiringSoon: boolean) =>
    `${R_FLAT} border p-3 ${
      termExpired ? 'border-red-200 bg-red-50/30' : termExpiringSoon ? 'border-amber-200 bg-amber-50/20' : 'border-[#c9a227]/40 bg-white'
    }`
  const pill = 'rounded-none px-2 py-0.5 text-[10px] font-semibold'
  const inputSm = `${R_FLAT} border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-900`
  const selectSm = `${R_FLAT} border border-neutral-200 bg-white px-2 py-1 text-xs`

  return (
    <section className={outerClass}>
      {!headerless && title ? (
        <div className="flex items-center justify-between gap-2">
          <h3 className={embedded ? COUNCIL_SUBHEADING : COUNCIL_SECTION_HEADING}>{title}</h3>
          {onAdd ? (
            <button type="button" onClick={onAdd} className="text-sm font-medium text-[#1a3d32] hover:underline">
              + Legg til
            </button>
          ) : null}
        </div>
      ) : null}
      <ul className={`space-y-4 ${headerless ? '' : 'mt-4'}`}>
        {members.map((m) => {
          const termExpired = m.termUntil && m.termUntil < today
          const termExpiringSoon =
            Boolean(m.termUntil && !termExpired) &&
            Math.ceil((new Date(m.termUntil as string).getTime() - termNowMs) / 86400000) <= 60
          const cert = learning?.certificates.find((c) => c.id === m.learningCertificateId)
          const boardMatch = board?.length ? boardMemberMatchingRep(m, board) : undefined
          return (
            <li key={m.id} className={cardClass(Boolean(termExpired), Boolean(termExpiringSoon))}>
              {boardMatch ? (
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-neutral-100 pb-2">
                  <div className="min-w-0">
                    <p className={`${COUNCIL_OVERLINE} text-neutral-400`}>Styre (AMU-valg)</p>
                    <p className="mt-0.5 text-xs font-medium text-neutral-800">{roleLabel(boardMatch.role)}</p>
                    <p className={`mt-1 ${COUNCIL_SMALL}`}>
                      Valgt / registrert:{' '}
                      <span className="tabular-nums text-neutral-700">{boardMatch.electedAt}</span>
                      {boardMatch.termUntil ? (
                        <>
                          {' '}
                          · styre periode til{' '}
                          <span className="tabular-nums text-neutral-700">{boardMatch.termUntil}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
                </div>
              ) : null}
              <div className="flex flex-wrap items-start gap-3">
                <img
                  src={avatarUrlFromSeed(m.id + m.name, 72)}
                  alt=""
                  className={`${R_FLAT} size-12 shrink-0 object-cover ring-1 ring-neutral-200/80`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={m.name}
                      onChange={(e) => onUpdate(m.id, { name: e.target.value })}
                      className={`${R_FLAT} min-w-0 flex-1 border border-transparent bg-transparent px-1 py-0.5 font-medium text-neutral-900 outline-none focus:border-neutral-300`}
                    />
                    {m.isVerneombud && (
                      <span className={`${pill} bg-emerald-100 text-emerald-800`}>Verneombud</span>
                    )}
                    {termExpired && <span className={`${pill} bg-red-100 text-red-700`}>Utløpt</span>}
                    {termExpiringSoon && !termExpired && (
                      <span className={`${pill} bg-amber-100 text-amber-700`}>Utløper snart</span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <select
                      value={m.officeRole}
                      onChange={(e) =>
                        onUpdate(m.id, { officeRole: e.target.value as RepresentativeOfficeRole })
                      }
                      className={selectSm}
                    >
                      {roles.map((r) => (
                        <option key={r} value={r}>
                          {officeLabel(r)}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs text-neutral-500">
                      {m.source === 'election' ? 'Valgt' : 'Oppnevnt'}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <div>
                      <label className="text-xs text-neutral-500">Periode slutt</label>
                      <input
                        type="date"
                        value={m.termUntil ?? ''}
                        onChange={(e) => onUpdate(m.id, { termUntil: e.target.value || undefined })}
                        className={`${inputSm} ml-0 mt-0.5 block`}
                      />
                    </div>
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-600">
                      <input
                        type="checkbox"
                        checked={m.isVerneombud ?? false}
                        onChange={(e) => onUpdate(m.id, { isVerneombud: e.target.checked })}
                        className={`${R_FLAT} size-3.5 border-neutral-300 text-[#1a3d32]`}
                      />
                      Verneombud
                    </label>
                  </div>
                  {m.isVerneombud ? (
                    <div className="mt-2 space-y-2 border-t border-neutral-100 pt-2">
                      <div>
                        <label className="text-xs text-neutral-500">Verneområde</label>
                        <input
                          value={m.verneombudArea ?? ''}
                          onChange={(e) => onUpdate(m.id, { verneombudArea: e.target.value || undefined })}
                          placeholder="f.eks. Produksjon, hall A"
                          className={`${inputSm} mt-0.5 w-full`}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-neutral-500">Oppslag bekreftet (AML §6-1)</label>
                        <input
                          type="date"
                          value={m.postingConfirmedAt ?? ''}
                          onChange={(e) => onUpdate(m.id, { postingConfirmedAt: e.target.value || undefined })}
                          className={`${inputSm} mt-0.5`}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-neutral-500">HMS-kurs sertifikat (40t)</label>
                        <select
                          value={m.learningCertificateId ?? ''}
                          onChange={(e) =>
                            onUpdate(m.id, { learningCertificateId: e.target.value || undefined })
                          }
                          className={`${selectSm} mt-0.5 w-full max-w-full`}
                        >
                          <option value="">— Velg sertifikat —</option>
                          {(learning?.certificates ?? []).map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.learnerName} — {c.courseTitle}
                            </option>
                          ))}
                        </select>
                        {cert ? (
                          <span className="mt-1 block text-[10px] text-emerald-700">
                            ✓ {new Date(cert.issuedAt).toLocaleDateString('no-NO')}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
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
            <h2 className={COUNCIL_SECTION_HEADING}>{meeting.title}</h2>
            <p className={COUNCIL_BODY}>{formatWhen(meeting.startsAt)}</p>
            <p className={COUNCIL_BODY_MUTED}>{meeting.location}</p>
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
            <h3 className={`flex items-center gap-2 ${COUNCIL_SUBHEADING}`}>
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
          <h3 className={COUNCIL_SUBHEADING}>Forberedelse</h3>
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
          <h3 className={`flex items-center gap-2 ${COUNCIL_SUBHEADING}`}>
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
            <h4 className={COUNCIL_SUBHEADING}>Forhåndsregistrering på protokoll</h4>
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
          <h3 className={COUNCIL_SUBHEADING}>Revisjonslogg (diskusjon, notater, vedtak)</h3>
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
  const closed = election.status === 'closed'
  const sorted = [...election.candidates].sort((a, b) => b.voteCount - a.voteCount)
  const [detailOpen, setDetailOpen] = useState(!closed)

  const summaryLine = `${open ? 'Åpent valg' : 'Avsluttet'}${election.closedAt ? ` · ${formatWhen(election.closedAt)}` : ''} · ${sorted.length} kandidat${sorted.length === 1 ? '' : 'er'}`

  return (
    <div className={`${R_FLAT} border border-neutral-200 bg-[#faf8f4] p-4`}>
      {closed && !detailOpen ? (
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className={`${R_FLAT} flex w-full items-start justify-between gap-2 text-left hover:bg-white/60`}
        >
          <div className="min-w-0">
            <p className={COUNCIL_OVERLINE}>{election.title}</p>
            <p className={`mt-1 ${COUNCIL_SMALL}`}>{summaryLine}</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-neutral-500" aria-hidden />
        </button>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              {closed ? (
                <button
                  type="button"
                  onClick={() => setDetailOpen(false)}
                  className={`${R_FLAT} -ml-1 flex items-center gap-1 text-left hover:bg-white/60`}
                >
                  <ChevronDown className="size-4 shrink-0 text-neutral-500" aria-hidden />
                  <span className={COUNCIL_OVERLINE}>{election.title}</span>
                </button>
              ) : (
                <h3 className={COUNCIL_SUBHEADING}>{election.title}</h3>
              )}
              <p className={COUNCIL_SMALL}>
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
            {sorted.length === 0 ? (
              <li className="text-sm text-neutral-500">Ingen kandidater ennå.</li>
            ) : (
              sorted.map((c, idx) => (
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
        </>
      )}
    </div>
  )
}
