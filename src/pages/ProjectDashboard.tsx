import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Calendar,
  CalendarRange,
  ClipboardList,
  FileText,
  GraduationCap,
  HardHat,
  HeartPulse,
  Kanban,
  Scale,
  ShieldAlert,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useCouncil } from '../hooks/useCouncil'
import { useHse } from '../hooks/useHse'
import { useInternalControl } from '../hooks/useInternalControl'
import { useLearning } from '../hooks/useLearning'
import { useOrgHealth } from '../hooks/useOrgHealth'
import { useOrganisation } from '../hooks/useOrganisation'
import { useRepresentatives } from '../hooks/useRepresentatives'
import { useTasks } from '../hooks/useTasks'
import { useUiTheme } from '../hooks/useUiTheme'
import { mergeLayoutPayload } from '../lib/layoutLabTokens'

// ─── Layout tokens — matches WorkplaceDashboardPage / OrganisationPage ────────

const PAGE = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'
const CARD = 'rounded-none border border-neutral-200/90 bg-white p-5 shadow-sm'
const CARD_URGENT = 'rounded-none border border-red-200 bg-red-50/40 p-5 shadow-sm'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('no-NO', { dateStyle: 'medium' }) }
  catch { return iso }
}
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' }) }
  catch { return '' }
}
function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
}

const today = new Date()
const todayStr = today.toISOString().slice(0, 10)

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, to }: { title: string; to?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between border-b border-neutral-100 pb-2">
      <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-500">{title}</h2>
      {to && (
        <Link to={to} className="text-xs font-medium text-[#1a3d32] hover:underline">
          Se alle →
        </Link>
      )}
    </div>
  )
}

function StatTile({
  value, label, urgent, to,
}: { value: number | string; label: string; urgent?: boolean; to?: string }) {
  const inner = (
    <div className={`group flex flex-col gap-1 rounded-none border p-4 transition hover:border-neutral-300 ${urgent ? 'border-red-200 bg-red-50/40' : 'border-neutral-200/90 bg-white'}`}>
      <span className={`text-3xl font-bold tabular-nums leading-none ${urgent ? 'text-red-700' : 'text-neutral-900'}`}>{value}</span>
      <span className="text-xs text-neutral-500 leading-tight">{label}</span>
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ProjectDashboard() {
  const council  = useCouncil()
  const hse      = useHse()
  const ic       = useInternalControl()
  const learning = useLearning()
  const oh       = useOrgHealth()
  const org      = useOrganisation()
  const rep      = useRepresentatives()
  const ts       = useTasks()
  const { payload: layoutPayload } = useUiTheme()
  const layout = mergeLayoutPayload(layoutPayload)
  const accent = layout.accent

  // ── Derived ─────────────────────────────────────────────────────────────────

  const openTasks = useMemo(
    () => ts.tasks.filter((t) => t.status !== 'done').sort((a, b) => (a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : 1),
    [ts.tasks],
  )
  const overdueTasks = useMemo(() => openTasks.filter((t) => t.dueDate && t.dueDate < todayStr), [openTasks])

  const upcomingMeetings = useMemo(
    () => council.meetings.filter((m) => m.status === 'planned' && m.startsAt > today.toISOString())
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 5),
    [council.meetings],
  )
  const nextMeeting = upcomingMeetings[0]

  const activeSickLeave = useMemo(() => hse.sickLeaveCases.filter((c) => c.status === 'active' || c.status === 'partial'), [hse.sickLeaveCases])

  const overdueMilestones = useMemo(
    () => activeSickLeave.flatMap((c) =>
      c.milestones.filter((m) => !m.completedAt && m.dueAt < todayStr)
        .map((m) => ({ ...m, employeeName: c.employeeName, caseId: c.id })),
    ).slice(0, 4),
    [activeSickLeave],
  )

  const openHighRisks = useMemo(
    () => ic.rosAssessments
      .flatMap((r) => r.rows.filter((row) => !row.done && (row.status ?? 'open') !== 'closed' && row.riskScore >= 12)
        .map((row) => ({ ...row, assessmentTitle: r.title })))
      .sort((a, b) => b.riskScore - a.riskScore).slice(0, 4),
    [ic.rosAssessments],
  )

  const annualEvents = useMemo(() => {
    const evts: { label: string; date: string; kind: string; to: string }[] = []
    council.meetings.filter((m) => m.status === 'planned' && m.startsAt > today.toISOString())
      .forEach((m) => evts.push({ label: m.title, date: m.startsAt, kind: 'AMU-møte', to: '/council?tab=meetings' }))
    activeSickLeave.forEach((c) =>
      c.milestones.filter((m) => !m.completedAt && m.dueAt >= todayStr)
        .forEach((m) => evts.push({ label: `${c.employeeName}: ${m.label}`, date: m.dueAt, kind: 'Sykefravær', to: '/hse?tab=sickness' })),
    )
    hse.trainingRecords.filter((r) => r.expiresAt && r.expiresAt >= todayStr)
      .forEach((r) => evts.push({ label: `${r.employeeName}: ${r.trainingKind}`, date: r.expiresAt!, kind: 'Opplæring', to: '/hse?tab=training' }))
    oh.surveys.filter((s) => s.schedule?.enabled && s.schedule.nextRunAt && s.schedule.nextRunAt >= todayStr)
      .forEach((s) => evts.push({ label: s.title, date: s.schedule!.nextRunAt!, kind: 'Undersøkelse', to: '/org-health?tab=surveys' }))
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
      return { iso, dayName: d.toLocaleDateString('no-NO', { weekday: 'short' }), dayNum: d.getDate(), meetings, milestones, isToday: iso === todayStr }
    })
  }, [council.meetings, activeSickLeave])

  const KIND_DOT: Record<string, string> = {
    'AMU-møte': '#1a3d32', 'Sykefravær': '#f59e0b', 'Opplæring': '#ef4444', 'Undersøkelse': '#0d9488',
  }

  return (
    <div className={PAGE}>

      {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
      <nav className="mb-6 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
        <span>
          <span className="text-neutral-500">Workspace</span>
          <span className="mx-2 text-neutral-400">→</span>
          <span className="font-medium text-neutral-800">Dashbord</span>
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Link to="/action-board"
            className="inline-flex h-8 items-center gap-1.5 rounded-none border border-neutral-300 bg-white px-3 text-xs font-medium text-neutral-800 hover:bg-neutral-50">
            <Kanban className="size-3.5" />Action Board
          </Link>
          <Link to="/aarshjul"
            className="inline-flex h-8 items-center gap-1.5 rounded-none border border-neutral-300 bg-white px-3 text-xs font-medium text-neutral-800 hover:bg-neutral-50">
            <CalendarRange className="size-3.5" />Årshjul
          </Link>
        </div>
      </nav>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 border-b border-neutral-200/80 pb-7 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 md:text-3xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
            Velkommen tilbake
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {today.toLocaleDateString('no-NO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {nextMeeting && (
              <span className="ml-3 inline-flex items-center gap-1.5 rounded-none border border-neutral-200 bg-white px-2.5 py-0.5 text-xs text-neutral-700">
                <Calendar className="size-3" style={{ color: accent }} />
                Neste AMU: {fmtDate(nextMeeting.startsAt)} kl. {fmtTime(nextMeeting.startsAt)}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-500">{org.settings.orgName}</span>
          <span className="inline-flex h-7 items-center gap-1.5 rounded-none border border-neutral-200 bg-white px-2.5 text-xs text-neutral-600">
            <span className="size-2 rounded-full" style={{ background: accent }} />
            {org.totalEmployeeCount} ansatte
          </span>
        </div>
      </div>

      {/* ── KPI strip ───────────────────────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-2 gap-px bg-neutral-200/90 border border-neutral-200/90 sm:grid-cols-4">
        <StatTile
          value={openTasks.length}
          label={overdueTasks.length > 0 ? `Åpne oppgaver · ${overdueTasks.length} forfalt` : 'Åpne oppgaver'}
          urgent={overdueTasks.length > 0}
          to="/tasks"
        />
        <StatTile
          value={hse.stats.activeSickLeave}
          label={hse.stats.overdueMilestones > 0 ? `Aktive sykefravær · ${hse.stats.overdueMilestones} frister forfalt` : 'Aktive sykefravær'}
          urgent={hse.stats.overdueMilestones > 0}
          to="/hse?tab=sickness"
        />
        <StatTile
          value={hse.incidents.filter((i) => i.status !== 'closed').length}
          label={hse.stats.violence > 0 ? `HMS-hendelser åpne · ${hse.stats.violence} vold/trusler` : 'HMS-hendelser åpne'}
          urgent={hse.stats.violence > 0}
          to="/hse?tab=incidents"
        />
        <StatTile
          value={`${council.compliance.filter((c) => c.done).length}/${council.compliance.length}`}
          label="Compliance fullført"
          to="/council?tab=compliance"
        />
      </div>

      {/* ── Two-column layout ────────────────────────────────────────────── */}
      <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_320px]">

        {/* LEFT */}
        <div className="space-y-6">

          {/* Weekly calendar */}
          <div className={CARD}>
            <SectionHeader title="Denne uken" />
            <div className="grid grid-cols-7 gap-px bg-neutral-100 border border-neutral-100">
              {weekDays.map(({ iso, dayName, dayNum, meetings, milestones, isToday }) => (
                <div key={iso}
                  className={`flex flex-col items-center gap-1 p-2 text-center ${isToday ? 'bg-neutral-900 text-white' : 'bg-white'}`}>
                  <div className={`text-[9px] font-semibold uppercase ${isToday ? 'text-white/60' : 'text-neutral-400'}`}>{dayName}</div>
                  <div className={`text-base font-bold tabular-nums ${isToday ? 'text-white' : 'text-neutral-800'}`}>{dayNum}</div>
                  <div className="flex flex-wrap justify-center gap-0.5 min-h-[10px]">
                    {meetings.slice(0, 3).map((m) => (
                      <span key={m.id} className="size-1.5 rounded-full block" style={{ background: isToday ? 'rgba(255,255,255,0.7)' : accent }} title={m.title} />
                    ))}
                    {milestones.slice(0, 2).map((_, i) => (
                      <span key={i} className="size-1.5 rounded-full block" style={{ background: isToday ? 'rgba(255,180,0,0.8)' : '#f59e0b' }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming AMU meetings */}
          <div className={CARD}>
            <SectionHeader title="Kommende AMU-møter" to="/council?tab=meetings" />
            {upcomingMeetings.length === 0 ? (
              <p className="py-4 text-center text-sm text-neutral-400">Ingen planlagte møter.</p>
            ) : (
              <div className="divide-y divide-neutral-100">
                {upcomingMeetings.map((m) => {
                  const d = daysUntil(m.startsAt)
                  return (
                    <Link key={m.id} to="/council?tab=meetings"
                      className="flex items-center gap-4 py-3 hover:bg-neutral-50 transition-colors -mx-5 px-5">
                      <div className="flex size-10 shrink-0 flex-col items-center justify-center border border-neutral-200 bg-neutral-50 text-neutral-800">
                        <span className="text-[9px] font-semibold uppercase leading-none text-neutral-400">
                          {new Date(m.startsAt).toLocaleDateString('no-NO', { month: 'short' })}
                        </span>
                        <span className="text-base font-bold leading-tight tabular-nums">
                          {new Date(m.startsAt).getDate()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-neutral-900 truncate">{m.title}</div>
                        <div className="text-xs text-neutral-400">
                          kl. {fmtTime(m.startsAt)} · {m.location}
                          {m.quarterSlot ? ` · Q${m.quarterSlot}` : ''}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-none px-2 py-0.5 text-xs font-semibold ${d <= 3 ? 'bg-red-100 text-red-700' : d <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-neutral-100 text-neutral-600'}`}>
                        {d === 0 ? 'I dag' : d === 1 ? 'I morgen' : `${d}d`}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Open tasks */}
          <div className={CARD}>
            <SectionHeader title="Åpne oppgaver" to="/tasks" />
            {openTasks.length === 0 ? (
              <p className="py-4 text-center text-sm text-neutral-400">Ingen åpne oppgaver.</p>
            ) : (
              <div className="divide-y divide-neutral-100">
                {openTasks.slice(0, 7).map((task) => {
                  const overdue = task.dueDate && task.dueDate < todayStr
                  const d = task.dueDate ? daysUntil(task.dueDate) : null
                  return (
                    <Link key={task.id} to="/tasks"
                      className={`flex items-center gap-3 py-2.5 -mx-5 px-5 hover:bg-neutral-50 transition-colors ${overdue ? 'bg-red-50/30' : ''}`}>
                      <span className={`size-2 shrink-0 rounded-full ${task.status === 'in_progress' ? 'bg-sky-500' : 'bg-neutral-300'}`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-neutral-900 truncate">{task.title}</span>
                        {task.ownerRole && <span className="ml-2 text-xs text-neutral-400">{task.ownerRole}</span>}
                      </div>
                      {d !== null && (
                        <span className={`shrink-0 text-xs font-medium ${overdue ? 'text-red-600' : d <= 3 ? 'text-amber-600' : 'text-neutral-400'}`}>
                          {overdue ? `${Math.abs(d)}d forfalt` : d === 0 ? 'I dag' : `${d}d`}
                        </span>
                      )}
                    </Link>
                  )
                })}
                {openTasks.length > 7 && (
                  <Link to="/tasks" className="block py-2.5 text-center text-xs font-medium text-[#1a3d32] hover:underline -mx-5 px-5">
                    + {openTasks.length - 7} til
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* High risks */}
          {openHighRisks.length > 0 && (
            <div className={CARD}>
              <SectionHeader title="Høyrisikoer (ROS ≥ 12)" to="/internal-control?tab=ros" />
              <div className="divide-y divide-neutral-100">
                {openHighRisks.map((row) => (
                  <Link key={row.id} to="/internal-control?tab=ros"
                    className="flex items-center gap-3 py-2.5 -mx-5 px-5 hover:bg-neutral-50 transition-colors">
                    <span className={`shrink-0 rounded-none border px-2 py-0.5 text-xs font-bold tabular-nums ${row.riskScore >= 15 ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{row.riskScore}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-neutral-900 truncate">{row.hazard}</span>
                      <span className="ml-2 text-xs text-neutral-400">{row.assessmentTitle}</span>
                    </div>
                    <ArrowRight className="size-3.5 text-neutral-300 shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Overdue milestones */}
          {overdueMilestones.length > 0 && (
            <div className={CARD_URGENT}>
              <SectionHeader title="Forfalte sykefravær-frister" to="/hse?tab=sickness" />
              <div className="divide-y divide-red-100">
                {overdueMilestones.map((m) => (
                  <Link key={`${m.caseId}-${m.kind}`} to="/hse?tab=sickness"
                    className="flex items-center gap-3 py-2.5 -mx-5 px-5 hover:bg-red-50/60 transition-colors">
                    <AlertTriangle className="size-4 shrink-0 text-red-500" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-neutral-900 truncate">{m.label}</span>
                      <span className="ml-2 text-xs text-neutral-500">{m.employeeName}</span>
                    </div>
                    <span className="shrink-0 rounded-none bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                      {Math.abs(daysUntil(m.dueAt))}d forfalt
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT SIDEBAR */}
        <div className="space-y-5">

          {/* Org snapshot */}
          <div className={CARD}>
            <SectionHeader title="Virksomhet" />
            <div className="flex items-center gap-3 mb-4">
              <Scale className="size-5 shrink-0" style={{ color: accent }} />
              <div>
                <div className="text-sm font-semibold text-neutral-900">{org.settings.orgName}</div>
                <div className="text-xs text-neutral-400">{org.totalEmployeeCount} ansatte · {rep.members.length} repr.</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-px bg-neutral-100 border border-neutral-100">
              {[
                { label: 'AMU-møter i år', value: council.meetings.filter((m) => m.governanceYear === today.getFullYear()).length, to: '/council?tab=meetings' },
                { label: 'Vernerunder', value: hse.stats.rounds, to: '/hse?tab=rounds' },
                { label: 'Inspeksjoner åpne', value: hse.stats.openInspections, to: '/hse?tab=inspections' },
                { label: 'ROS-vurderinger', value: ic.stats.rosCount, to: '/internal-control?tab=ros' },
              ].map(({ label, value, to }) => (
                <Link key={label} to={to} className="group bg-white px-3 py-2.5 hover:bg-neutral-50 transition-colors">
                  <div className="text-xl font-bold tabular-nums text-neutral-900">{value}</div>
                  <div className="text-[10px] text-neutral-500 leading-tight">{label}</div>
                </Link>
              ))}
            </div>
          </div>

          {/* E-learning */}
          <div className={CARD}>
            <SectionHeader title="E-læring" to="/learning" />
            <div className="grid grid-cols-2 gap-px bg-neutral-100 border border-neutral-100 mb-4">
              <div className="bg-white px-3 py-2.5">
                <div className="text-xl font-bold tabular-nums text-neutral-900">{learning.courses.filter((c) => c.status === 'published').length}</div>
                <div className="text-[10px] text-neutral-500">Kurs publisert</div>
              </div>
              <div className="bg-white px-3 py-2.5">
                <div className="text-xl font-bold tabular-nums text-neutral-900">{learning.certificates.length}</div>
                <div className="text-[10px] text-neutral-500">Sertifikater</div>
              </div>
            </div>
            {learning.courses.filter((c) => c.status === 'published').slice(0, 3).map((c) => (
              <Link key={c.id} to={`/learning/play/${c.id}`}
                className="flex items-center gap-2 py-1.5 text-xs text-neutral-700 hover:text-[#1a3d32] transition-colors">
                <GraduationCap className="size-3.5 shrink-0 text-neutral-400" />
                <span className="flex-1 truncate">{c.title}</span>
                <ArrowRight className="size-3 text-neutral-300 shrink-0" />
              </Link>
            ))}
          </div>

          {/* Org health */}
          <div className={CARD}>
            <SectionHeader title="Organisasjonshelse" to="/org-health" />
            <div className="space-y-3">
              {[
                { label: 'Sykefravær siste', value: oh.navSummary.latestPercent != null ? `${oh.navSummary.latestPercent}%` : '—', icon: HeartPulse },
                { label: 'Anon. meldinger', value: String(oh.amlReportStats.total), icon: BarChart3 },
                { label: 'Undersøkelser', value: String(oh.surveys.length), icon: ClipboardList },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-neutral-600"><Icon className="size-3.5 text-neutral-400" />{label}</span>
                  <span className="font-semibold text-neutral-900 tabular-nums">{value}</span>
                </div>
              ))}
              {oh.surveys.filter((s) => s.status === 'open').length > 0 && (
                <Link to="/org-health?tab=surveys"
                  className="mt-1 block rounded-none border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-800 hover:bg-neutral-100 transition-colors">
                  {oh.surveys.filter((s) => s.status === 'open').length} åpen undersøkelse pågår →
                </Link>
              )}
            </div>
          </div>

          {/* Årshjul upcoming */}
          <div className={CARD}>
            <SectionHeader title="Kommende i årshjulet" to="/aarshjul" />
            {annualEvents.length === 0 ? (
              <p className="py-3 text-center text-xs text-neutral-400">Ingen kommende hendelser.</p>
            ) : (
              <div className="space-y-0 divide-y divide-neutral-100">
                {annualEvents.map((evt, i) => {
                  const d = daysUntil(evt.date)
                  const dot = KIND_DOT[evt.kind] ?? '#9ca3af'
                  return (
                    <Link key={i} to={evt.to}
                      className="flex items-center gap-2.5 py-2 hover:bg-neutral-50 -mx-5 px-5 transition-colors">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: dot }} />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-neutral-800 truncate block">{evt.label}</span>
                        <span className="text-[10px] text-neutral-400">{evt.kind} · {fmtDate(evt.date)}</span>
                      </div>
                      <span className={`shrink-0 text-[10px] font-semibold tabular-nums ${d <= 7 ? 'text-red-500' : d <= 30 ? 'text-amber-500' : 'text-neutral-400'}`}>
                        {d === 0 ? 'i dag' : `${d}d`}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className={CARD}>
            <SectionHeader title="Snarveier" />
            <div className="grid grid-cols-2 gap-1">
              {[
                { label: 'Meld hendelse', to: '/hse?tab=incidents', icon: ShieldAlert },
                { label: 'Ny ROS', to: '/internal-control?tab=ros', icon: AlertTriangle },
                { label: 'Council', to: '/council', icon: Scale },
                { label: 'Internkontroll', to: '/internal-control', icon: ClipboardList },
                { label: 'Documents', to: '/documents', icon: FileText },
                { label: 'Organisasjon', to: '/organisation', icon: Users },
              ].map(({ label, to, icon: Icon }) => (
                <Link key={to} to={to}
                  className="flex items-center gap-2 rounded-none border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors">
                  <Icon className="size-3.5 shrink-0 text-neutral-400" />
                  {label}
                </Link>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Bottom metric bar ────────────────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-2 gap-px bg-neutral-200/90 border border-neutral-200/90 sm:grid-cols-4">
        {[
          { value: hse.stats.expiredTraining, label: 'Utløpt opplæring', urgent: hse.stats.expiredTraining > 0, to: '/hse?tab=training', icon: GraduationCap },
          { value: ic.stats.rosCount, label: 'ROS-vurderinger', to: '/internal-control?tab=ros', icon: TrendingUp },
          { value: hse.stats.rounds, label: 'Vernerunder totalt', to: '/hse?tab=rounds', icon: HardHat },
          { value: oh.surveys.filter((s) => s.status === 'open').length, label: 'Aktive undersøkelser', to: '/org-health?tab=surveys', icon: BookOpen },
        ].map(({ value, label, urgent, to, icon: Icon }) => (
          <Link key={label} to={to}
            className={`group flex items-center gap-3 bg-white px-4 py-3 hover:bg-neutral-50 transition-colors ${urgent ? 'bg-red-50/40' : ''}`}>
            <Icon className={`size-4 shrink-0 ${urgent ? 'text-red-500' : 'text-neutral-400'}`} />
            <div>
              <div className={`text-xl font-bold tabular-nums ${urgent ? 'text-red-700' : 'text-neutral-900'}`}>{value}</div>
              <div className="text-[10px] text-neutral-500 leading-tight">{label}</div>
            </div>
          </Link>
        ))}
      </div>

    </div>
  )
}
