import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Calendar,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  FileText,
  GraduationCap,
  HardHat,
  HeartPulse,
  Kanban,
  ListChecks,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('no-NO', { dateStyle: 'medium' })
  } catch { return iso }
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
}

const today = new Date()
const todayStr = today.toISOString().slice(0, 10)

// ─── Mini components ──────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, colour, to, urgent,
}: {
  label: string; value: number | string; sub?: string
  icon: React.ComponentType<{ className?: string }>
  colour: string; to?: string; urgent?: boolean
}) {
  const inner = (
    <div className={`group flex items-start gap-4 rounded-2xl border bg-white p-5 shadow-sm transition-all hover:shadow-md ${urgent ? 'border-red-200 bg-red-50/30' : 'border-neutral-200/80'}`}>
      <div className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${colour}`}>
        <Icon className="size-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-3xl font-bold tabular-nums leading-none ${urgent ? 'text-red-700' : 'text-neutral-900'}`}>{value}</div>
        <div className="mt-1 text-sm font-medium text-neutral-700">{label}</div>
        {sub && <div className="mt-0.5 text-xs text-neutral-400">{sub}</div>}
      </div>
      {to && <ArrowRight className="size-4 shrink-0 text-neutral-300 group-hover:text-neutral-500 mt-1 transition-colors" />}
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

function SectionHeader({ title, to }: { title: string; to?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-base font-semibold text-neutral-800">{title}</h2>
      {to && (
        <Link to={to} className="text-xs font-medium text-[#1a3d32] hover:underline">
          Se alle →
        </Link>
      )}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-200 bg-white px-4 py-5 text-center text-sm text-neutral-400">
      {label}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ProjectDashboard() {
  const council   = useCouncil()
  const hse       = useHse()
  const ic        = useInternalControl()
  const learning  = useLearning()
  const oh        = useOrgHealth()
  const org       = useOrganisation()
  const rep       = useRepresentatives()
  const taskStore = useTasks()

  const [_calView] = useState<'week' | 'month'>('week')

  // ── Derived data ─────────────────────────────────────────────────────────

  const openTasks = useMemo(
    () => taskStore.tasks.filter((t) => t.status !== 'done').sort((a, b) => (a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : 1),
    [taskStore.tasks],
  )
  const overdueTasks = useMemo(
    () => openTasks.filter((t) => t.dueDate && t.dueDate < todayStr),
    [openTasks],
  )

  const upcomingMeetings = useMemo(
    () => council.meetings
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
    () => activeSickLeave.flatMap((c) =>
      c.milestones.filter((m) => !m.completedAt && m.dueAt < todayStr).map((m) => ({ ...m, employeeName: c.employeeName, caseId: c.id })),
    ).slice(0, 4),
    [activeSickLeave],
  )

  const openHighRisks = useMemo(
    () => ic.rosAssessments
      .flatMap((r) => r.rows.filter((row) => !row.done && (row.status ?? 'open') !== 'closed' && row.riskScore >= 12)
        .map((row) => ({ ...row, assessmentTitle: r.title })))
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 4),
    [ic.rosAssessments],
  )

  const openIncidents = useMemo(
    () => hse.incidents.filter((i) => i.status !== 'closed').slice(0, 5),
    [hse.incidents],
  )

  const openComplianceItems = useMemo(
    () => council.compliance.filter((c) => !c.done).length,
    [council.compliance],
  )

  const { complianceThresholds: ct } = org

  const certCount = learning.certificates.length
  const activeCourses = learning.courses.filter((c) => c.status === 'published').length

  // Årshjul — next 3 upcoming events across all modules
  const annualEvents = useMemo(() => {
    const evts: { label: string; date: string; kind: string; to: string }[] = []
    council.meetings.filter((m) => m.status === 'planned' && m.startsAt > today.toISOString()).forEach((m) => {
      evts.push({ label: m.title, date: m.startsAt, kind: 'AMU-møte', to: '/council?tab=meetings' })
    })
    hse.sickLeaveCases.filter((c) => c.status === 'active' || c.status === 'partial').forEach((c) => {
      c.milestones.filter((m) => !m.completedAt && m.dueAt >= todayStr).forEach((m) => {
        evts.push({ label: `${c.employeeName}: ${m.label}`, date: m.dueAt, kind: 'Sykefravær', to: '/hse?tab=sickness' })
      })
    })
    hse.trainingRecords.filter((r) => r.expiresAt && r.expiresAt >= todayStr).forEach((r) => {
      evts.push({ label: `${r.employeeName}: ${r.trainingKind}`, date: r.expiresAt!, kind: 'Opplæring', to: '/hse?tab=training' })
    })
    oh.surveys.filter((s) => s.schedule?.enabled && s.schedule.nextRunAt && s.schedule.nextRunAt >= todayStr).forEach((s) => {
      evts.push({ label: s.title, date: s.schedule!.nextRunAt!, kind: 'Undersøkelse', to: '/org-health?tab=surveys' })
    })
    return evts.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8)
  }, [council.meetings, hse.sickLeaveCases, hse.trainingRecords, oh.surveys])

  // ── Calendar week strip ───────────────────────────────────────────────────
  const weekDays = useMemo(() => {
    const start = new Date(today)
    start.setDate(today.getDate() - today.getDay() + 1) // Monday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const iso = d.toISOString().slice(0, 10)
      const meetings = council.meetings.filter((m) => m.startsAt.startsWith(iso) && m.status !== 'cancelled')
      const milestones = activeSickLeave.flatMap((c) => c.milestones.filter((m) => !m.completedAt && m.dueAt === iso))
      return { d, iso, dayName: d.toLocaleDateString('no-NO', { weekday: 'short' }), dayNum: d.getDate(), meetings, milestones, isToday: iso === todayStr }
    })
  }, [council.meetings, activeSickLeave])

  const KIND_COLOUR: Record<string, string> = {
    'AMU-møte':     'bg-[#1a3d32] text-white',
    'Sykefravær':   'bg-amber-100 text-amber-800',
    'Opplæring':    'bg-rose-100 text-rose-800',
    'Undersøkelse': 'bg-teal-100 text-teal-800',
  }

  return (
    <div className="min-h-screen bg-[#f5f0e8]">
      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">

        {/* ── Greeting header ────────────────────────────────────────────── */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 md:text-4xl" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
              Velkommen tilbake
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {today.toLocaleDateString('no-NO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              {nextMeeting && (
                <span className="ml-3 inline-flex items-center gap-1.5 rounded-full bg-[#1a3d32]/10 px-2.5 py-0.5 text-xs font-medium text-[#1a3d32]">
                  <Calendar className="size-3" />
                  Neste møte: {fmtDate(nextMeeting.startsAt)} kl. {fmtTime(nextMeeting.startsAt)}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/action-board" className="inline-flex items-center gap-1.5 rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26]">
              <Kanban className="size-4" /> Action Board
            </Link>
            <Link to="/aarshjul" className="inline-flex items-center gap-1.5 rounded-full border border-[#1a3d32]/20 bg-white px-4 py-2 text-sm font-medium text-[#1a3d32] hover:bg-neutral-50">
              <CalendarRange className="size-4" /> Årshjul
            </Link>
          </div>
        </div>

        {/* ── KPI row ────────────────────────────────────────────────────── */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Åpne oppgaver"
            value={openTasks.length}
            sub={overdueTasks.length > 0 ? `${overdueTasks.length} forfalt` : 'Ingen forfalte'}
            icon={ListChecks}
            colour="bg-[#1a3d32]"
            to="/tasks"
            urgent={overdueTasks.length > 0}
          />
          <KpiCard
            label="Aktive sykefravær"
            value={hse.stats.activeSickLeave}
            sub={hse.stats.overdueMilestones > 0 ? `${hse.stats.overdueMilestones} forfalte frister` : 'Alle frister OK'}
            icon={Users}
            colour="bg-amber-500"
            to="/hse?tab=sickness"
            urgent={hse.stats.overdueMilestones > 0}
          />
          <KpiCard
            label="Åpne HMS-hendelser"
            value={openIncidents.length}
            sub={`${hse.stats.violence > 0 ? `${hse.stats.violence} vold/trusler` : 'Ingen vold/trusler'}`}
            icon={ShieldAlert}
            colour={hse.stats.violence > 0 ? 'bg-red-600' : 'bg-orange-500'}
            to="/hse?tab=incidents"
            urgent={hse.stats.violence > 0}
          />
          <KpiCard
            label="Compliance sjekkliste"
            value={`${council.compliance.filter((c) => c.done).length}/${council.compliance.length}`}
            sub={`${openComplianceItems} gjenstår`}
            icon={CheckCircle2}
            colour={openComplianceItems === 0 ? 'bg-emerald-600' : 'bg-sky-600'}
            to="/council?tab=compliance"
          />
        </div>

        {/* ── Main grid: left content + right sidebar ─────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">

          {/* LEFT COLUMN */}
          <div className="space-y-6">

            {/* Calendar week strip */}
            <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-neutral-800">Denne uken</h2>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map(({ iso, dayName, dayNum, meetings, milestones, isToday }) => (
                  <div key={iso} className={`rounded-xl p-2 text-center ${isToday ? 'bg-[#1a3d32] text-white' : 'bg-neutral-50 hover:bg-neutral-100'} transition-colors`}>
                    <div className={`text-[10px] font-semibold uppercase ${isToday ? 'text-white/70' : 'text-neutral-400'}`}>{dayName}</div>
                    <div className={`text-lg font-bold leading-tight ${isToday ? 'text-white' : 'text-neutral-800'}`}>{dayNum}</div>
                    <div className="mt-1 space-y-0.5">
                      {meetings.slice(0, 2).map((m) => (
                        <div key={m.id} className={`rounded px-1 py-0.5 text-[9px] font-medium truncate ${isToday ? 'bg-white/20 text-white' : 'bg-[#1a3d32]/10 text-[#1a3d32]'}`} title={m.title}>
                          {m.title.slice(0, 8)}
                        </div>
                      ))}
                      {milestones.slice(0, 1).map((_m, i) => (
                        <div key={i} className={`rounded px-1 py-0.5 text-[9px] font-medium ${isToday ? 'bg-amber-400/50 text-white' : 'bg-amber-100 text-amber-800'}`}>
                          Frist
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming meetings */}
            <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm">
              <SectionHeader title="Kommende AMU-møter" to="/council?tab=meetings" />
              {upcomingMeetings.length === 0 ? (
                <EmptyState label="Ingen planlagte møter. Gå til Council for å planlegge." />
              ) : (
                <div className="space-y-2">
                  {upcomingMeetings.map((m) => {
                    const d = daysUntil(m.startsAt)
                    return (
                      <Link key={m.id} to="/council?tab=meetings"
                        className="flex items-center gap-4 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 hover:border-neutral-200 hover:bg-white transition-all">
                        <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-[#1a3d32] text-white">
                          <div className="text-[10px] font-semibold uppercase leading-none opacity-70">
                            {new Date(m.startsAt).toLocaleDateString('no-NO', { month: 'short' })}
                          </div>
                          <div className="text-lg font-bold leading-tight">
                            {new Date(m.startsAt).getDate()}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-neutral-900 truncate">{m.title}</div>
                          <div className="text-xs text-neutral-500">
                            {fmtDate(m.startsAt)} kl. {fmtTime(m.startsAt)} · {m.location}
                          </div>
                          {m.quarterSlot && <div className="text-[10px] text-neutral-400">Q{m.quarterSlot} {m.governanceYear}</div>}
                        </div>
                        <div className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${d <= 3 ? 'bg-red-100 text-red-700' : d <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {d === 0 ? 'I dag' : d === 1 ? 'I morgen' : `${d}d`}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Open tasks */}
            <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm">
              <SectionHeader title="Åpne oppgaver" to="/tasks" />
              {openTasks.length === 0 ? (
                <EmptyState label="Ingen åpne oppgaver — bra jobba! 🎉" />
              ) : (
                <div className="space-y-2">
                  {openTasks.slice(0, 6).map((task) => {
                    const overdue = task.dueDate && task.dueDate < todayStr
                    const d = task.dueDate ? daysUntil(task.dueDate) : null
                    const statusColour = task.status === 'in_progress' ? 'bg-sky-100 text-sky-800' : 'bg-neutral-100 text-neutral-600'
                    const statusLabel = task.status === 'in_progress' ? 'Pågår' : 'Å gjøre'
                    return (
                      <Link key={task.id} to="/tasks"
                        className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all hover:shadow-sm ${overdue ? 'border-red-200 bg-red-50/40' : 'border-neutral-100 bg-neutral-50 hover:bg-white'}`}>
                        <div className={`size-2.5 shrink-0 rounded-full ${task.status === 'in_progress' ? 'bg-sky-500' : 'bg-neutral-300'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-neutral-900 truncate">{task.title}</div>
                          <div className="text-xs text-neutral-400">{task.ownerRole || task.assignee || '—'}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColour}`}>{statusLabel}</span>
                          {d !== null && (
                            <span className={`text-xs font-medium ${overdue ? 'text-red-600' : d <= 3 ? 'text-amber-600' : 'text-neutral-400'}`}>
                              {overdue ? `${Math.abs(d)}d forfalt` : d === 0 ? 'I dag' : `${d}d`}
                            </span>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                  {openTasks.length > 6 && (
                    <Link to="/tasks" className="block text-center text-xs font-medium text-[#1a3d32] hover:underline py-2">
                      + {openTasks.length - 6} flere oppgaver
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* High risks */}
            {openHighRisks.length > 0 && (
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-5 shadow-sm">
                <SectionHeader title="Høyrisikoer (ROS)" to="/internal-control?tab=ros" />
                <div className="space-y-2">
                  {openHighRisks.map((row) => {
                    const col = row.riskScore >= 15 ? 'bg-red-100 text-red-800 border-red-200' : 'bg-amber-100 text-amber-800 border-amber-200'
                    return (
                      <Link key={row.id} to="/internal-control?tab=ros"
                        className="flex items-center gap-3 rounded-xl border border-amber-200 bg-white px-4 py-3 hover:shadow-sm transition-all">
                        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-bold ${col}`}>{row.riskScore}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-neutral-900 truncate">{row.hazard}</div>
                          <div className="text-xs text-neutral-400 truncate">{row.assessmentTitle}</div>
                        </div>
                        <ArrowRight className="size-3.5 text-neutral-400 shrink-0" />
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Sickleave milestones */}
            {overdueMilestones.length > 0 && (
              <div className="rounded-2xl border border-red-200/80 bg-red-50/40 p-5 shadow-sm">
                <SectionHeader title="Forfalte sykefravær-frister" to="/hse?tab=sickness" />
                <div className="space-y-2">
                  {overdueMilestones.map((m) => (
                    <Link key={`${m.caseId}-${m.kind}`} to="/hse?tab=sickness"
                      className="flex items-center gap-3 rounded-xl border border-red-200 bg-white px-4 py-3 hover:shadow-sm transition-all">
                      <AlertTriangle className="size-4 shrink-0 text-red-500" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-neutral-900 truncate">{m.label}</div>
                        <div className="text-xs text-neutral-400">{m.employeeName} · frist {fmtDate(m.dueAt)}</div>
                      </div>
                      <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
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

            {/* Org stats */}
            <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex size-9 items-center justify-center rounded-xl bg-[#1a3d32]">
                  <Scale className="size-4 text-[#c9a227]" />
                </div>
                <div>
                  <div className="font-semibold text-neutral-900 text-sm">{org.settings.orgName}</div>
                  <div className="text-xs text-neutral-400">{ct.totalEmployeeCount} ansatte</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'AMU-møter i år', value: council.meetings.filter((m) => m.governanceYear === today.getFullYear()).length, to: '/council?tab=meetings' },
                  { label: 'Repr. valgt', value: rep.members.length, to: '/council?tab=election' },
                  { label: 'Vernerunder', value: hse.stats.rounds, to: '/hse?tab=rounds' },
                  { label: 'Inspeksjoner åpne', value: hse.stats.openInspections, to: '/hse?tab=inspections' },
                ].map(({ label, value, to }) => (
                  <Link key={label} to={to} className="group rounded-xl bg-neutral-50 p-3 hover:bg-neutral-100 transition-colors">
                    <div className="text-2xl font-bold tabular-nums text-neutral-900">{value}</div>
                    <div className="text-[10px] text-neutral-500 leading-tight">{label}</div>
                  </Link>
                ))}
              </div>
            </div>

            {/* E-learning */}
            <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm">
              <SectionHeader title="E-læring" to="/learning" />
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="rounded-xl bg-emerald-50 p-3">
                  <div className="text-2xl font-bold text-emerald-700">{activeCourses}</div>
                  <div className="text-[10px] text-emerald-600">Publiserte kurs</div>
                </div>
                <div className="rounded-xl bg-sky-50 p-3">
                  <div className="text-2xl font-bold text-sky-700">{certCount}</div>
                  <div className="text-[10px] text-sky-600">Sertifikater</div>
                </div>
              </div>
              {learning.courses.filter((c) => c.status === 'published').slice(0, 3).map((c) => (
                <Link key={c.id} to={`/learning/play/${c.id}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-neutral-50 transition-colors">
                  <GraduationCap className="size-3.5 shrink-0 text-[#1a3d32]" />
                  <span className="text-xs text-neutral-700 truncate flex-1">{c.title}</span>
                  <ArrowRight className="size-3 text-neutral-300 shrink-0" />
                </Link>
              ))}
            </div>

            {/* Org health pulse */}
            <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm">
              <SectionHeader title="Organisasjonshelse" to="/org-health" />
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600 flex items-center gap-1.5"><HeartPulse className="size-3.5 text-pink-500" />Sykefravær (siste)</span>
                  <span className="font-semibold text-neutral-900">
                    {oh.navSummary.latestPercent != null ? `${oh.navSummary.latestPercent}%` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600 flex items-center gap-1.5"><BarChart3 className="size-3.5 text-sky-500" />Anon. meldinger</span>
                  <span className="font-semibold text-neutral-900">{oh.amlReportStats.total}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600 flex items-center gap-1.5"><ClipboardList className="size-3.5 text-teal-500" />Undersøkelser</span>
                  <span className="font-semibold text-neutral-900">{oh.surveys.length}</span>
                </div>
                {oh.surveys.filter((s) => s.status === 'open').length > 0 && (
                  <Link to="/org-health?tab=surveys" className="block rounded-lg bg-teal-50 px-3 py-2 text-xs font-medium text-teal-800 hover:bg-teal-100 transition-colors">
                    {oh.surveys.filter((s) => s.status === 'open').length} åpen undersøkelse aktiv →
                  </Link>
                )}
              </div>
            </div>

            {/* Årshjul upcoming */}
            <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm">
              <SectionHeader title="Kommende i årshjulet" to="/aarshjul" />
              {annualEvents.length === 0 ? (
                <EmptyState label="Ingen kommende hendelser registrert." />
              ) : (
                <div className="space-y-2">
                  {annualEvents.map((evt, i) => {
                    const d = daysUntil(evt.date)
                    const cls = KIND_COLOUR[evt.kind] ?? 'bg-neutral-100 text-neutral-600'
                    return (
                      <Link key={i} to={evt.to}
                        className="flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-neutral-50 transition-colors">
                        <div className="mt-0.5 flex flex-col items-center">
                          <div className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${cls} whitespace-nowrap`}>{evt.kind}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-neutral-800 truncate">{evt.label}</div>
                          <div className="text-[10px] text-neutral-400">{fmtDate(evt.date)}</div>
                        </div>
                        <span className={`shrink-0 text-xs font-semibold ${d <= 7 ? 'text-red-500' : d <= 30 ? 'text-amber-500' : 'text-neutral-400'}`}>
                          {d === 0 ? 'I dag' : `${d}d`}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Quick links */}
            <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-neutral-700">Snarveier</h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Meld hendelse', to: '/hse?tab=incidents', icon: ShieldAlert, colour: 'text-red-600 bg-red-50 hover:bg-red-100' },
                  { label: 'Ny ROS', to: '/internal-control?tab=ros', icon: AlertTriangle, colour: 'text-amber-600 bg-amber-50 hover:bg-amber-100' },
                  { label: 'Council', to: '/council', icon: Scale, colour: 'text-[#1a3d32] bg-[#1a3d32]/5 hover:bg-[#1a3d32]/10' },
                  { label: 'Internkontroll', to: '/internal-control', icon: ClipboardList, colour: 'text-purple-600 bg-purple-50 hover:bg-purple-100' },
                  { label: 'Documents', to: '/documents', icon: FileText, colour: 'text-sky-600 bg-sky-50 hover:bg-sky-100' },
                  { label: 'Org.kart', to: '/organisation', icon: Users, colour: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' },
                ].map(({ label, to, icon: Icon, colour }) => (
                  <Link key={to} to={to}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors ${colour}`}>
                    <Icon className="size-4 shrink-0" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ── Bottom metrics bar ──────────────────────────────────────────── */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link to="/hse?tab=training" className="group rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-rose-100">
              <GraduationCap className="size-5 text-rose-600" />
            </div>
            <div>
              <div className={`text-2xl font-bold ${hse.stats.expiredTraining > 0 ? 'text-red-600' : 'text-neutral-800'}`}>{hse.stats.expiredTraining}</div>
              <div className="text-xs text-neutral-500">Utløpt opplæring</div>
            </div>
          </Link>
          <Link to="/documents/compliance" className="group rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100">
              <TrendingUp className="size-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-neutral-800">{ic.stats.rosCount}</div>
              <div className="text-xs text-neutral-500">ROS-vurderinger</div>
            </div>
          </Link>
          <Link to="/council?tab=compliance" className="group rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-sky-100">
              <HardHat className="size-5 text-sky-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-neutral-800">{hse.stats.rounds}</div>
              <div className="text-xs text-neutral-500">Vernerunder totalt</div>
            </div>
          </Link>
          <Link to="/org-health?tab=surveys" className="group rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-teal-100">
              <BookOpen className="size-5 text-teal-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-neutral-800">{oh.surveys.filter((s) => s.status === 'open').length}</div>
              <div className="text-xs text-neutral-500">Aktive undersøkelser</div>
            </div>
          </Link>
        </div>

      </div>
    </div>
  )
}
