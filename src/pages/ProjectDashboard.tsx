import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
  Home,
  Kanban,
  LayoutDashboard,
  ListChecks,
  Scale,
  ShieldAlert,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useOrganisation } from '../hooks/useOrganisation'
import { useWorkplaceReportingCases } from '../hooks/useWorkplaceReportingCases'
import { useRepresentatives } from '../hooks/useRepresentatives'
import {
  daysUntil,
  fmtDate,
  fmtTime,
  useWorkspaceDashboardData,
} from '../hooks/useWorkspaceDashboardData'
import { useUiTheme } from '../hooks/useUiTheme'
import { mergeLayoutPayload } from '../lib/layoutLabTokens'
import { HubMenu1Bar, type HubMenu1Item } from '../components/layout/HubMenu1Bar'
import { WorkplacePageHeading1 } from '../components/layout/WorkplacePageHeading1'

const PAGE = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'

function KpiCard({
  label, value, sub, icon: Icon, iconBg, iconFg = 'text-white', to, urgent,
}: {
  label: string
  value: number | string
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  iconFg?: string
  to?: string
  urgent?: boolean
}) {
  const inner = (
    <div className={`group flex items-start gap-4 border bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${urgent ? 'border-red-200' : 'border-neutral-200/90'}`}>
      <div className={`flex size-11 shrink-0 items-center justify-center ${iconBg}`}>
        <Icon className={`size-5 ${iconFg}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-3xl font-bold tabular-nums leading-none ${urgent ? 'text-red-700' : 'text-neutral-900'}`}>
          {value}
        </div>
        <div className="mt-1 text-sm font-medium text-neutral-700">{label}</div>
        {sub && <div className={`mt-0.5 text-xs ${urgent ? 'text-red-500 font-medium' : 'text-neutral-400'}`}>{sub}</div>}
      </div>
      {to && <ArrowRight className="mt-1 size-4 shrink-0 text-neutral-300 transition-colors group-hover:text-neutral-500" />}
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ProjectDashboard() {
  const navigate = useNavigate()
  const org = useOrganisation()
  const wr = useWorkplaceReportingCases()
  const rep = useRepresentatives()
  const { payload: layoutPayload } = useUiTheme()
  const layout = mergeLayoutPayload(layoutPayload)
  const accent = layout.accent

  const {
    today,
    todayStr,
    council,
    hse,
    ic,
    learning,
    oh,
    openTasks,
    overdueTasks,
    upcomingMeetings,
    nextMeeting,
    overdueMilestones,
    openHighRisks,
    annualEvents,
    weekDays,
    openComplianceDone,
    openComplianceTotal,
  } = useWorkspaceDashboardData()

  const classicHubItems: HubMenu1Item[] = useMemo(
    () => [
      {
        key: 'home',
        label: 'Nytt hjem',
        icon: Home,
        active: false,
        onClick: () => navigate('/'),
      },
      {
        key: 'classic',
        label: 'Klassisk dashbord',
        icon: LayoutDashboard,
        active: true,
        onClick: () => navigate('/dashboard/classic'),
      },
    ],
    [navigate],
  )

  return (
    <div className={PAGE}>
      <WorkplacePageHeading1
        breadcrumb={[{ label: 'Workspace', to: '/' }, { label: 'Dashbord' }, { label: 'Klassisk' }]}
        title="Velkommen tilbake"
        description={
          <p className="text-sm text-neutral-500">
            {today.toLocaleDateString('no-NO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        }
        headerActions={
          <>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/action-board"
                className="inline-flex h-8 items-center gap-1.5 border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-800 shadow-sm hover:bg-neutral-50"
              >
                <Kanban className="size-3.5 text-violet-600" />
                Action Board
              </Link>
              <Link
                to="/aarshjul"
                className="inline-flex h-8 items-center gap-1.5 border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-800 shadow-sm hover:bg-neutral-50"
              >
                <CalendarRange className="size-3.5 text-amber-500" />
                Årshjul
              </Link>
            </div>
            {nextMeeting ? (
              <Link
                to="/council?tab=meetings"
                className="inline-flex items-center gap-2 border border-[#1a3d32]/20 bg-[#1a3d32]/5 px-3 py-2 text-xs font-medium text-[#1a3d32] transition-colors hover:bg-[#1a3d32]/10"
              >
                <Calendar className="size-3.5" />
                Neste AMU: {fmtDate(nextMeeting.startsAt)} kl. {fmtTime(nextMeeting.startsAt)}
              </Link>
            ) : null}
          </>
        }
        menu={<HubMenu1Bar ariaLabel="Workspace — dashbord" items={classicHubItems} />}
      />

      {/* ── KPI row — 4 coloured tiles ───────────────────────────────────── */}
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Åpne oppgaver"
          value={openTasks.length}
          sub={overdueTasks.length > 0 ? `${overdueTasks.length} forfalt` : 'Ingen forfalte'}
          icon={ListChecks}
          iconBg="bg-[#1a3d32]"
          to="/tasks"
          urgent={overdueTasks.length > 0}
        />
        <KpiCard
          label="Aktive sykefravær"
          value={hse.stats.activeSickLeave}
          sub={hse.stats.overdueMilestones > 0 ? `${hse.stats.overdueMilestones} frister forfalt` : 'Alle frister OK'}
          icon={Users}
          iconBg="bg-amber-500"
          to="/hse?tab=sickness"
          urgent={hse.stats.overdueMilestones > 0}
        />
        <KpiCard
          label="HMS-hendelser åpne"
          value={hse.incidents.filter((i) => i.status !== 'closed').length}
          sub={hse.stats.violence > 0 ? `${hse.stats.violence} vold/trusler` : 'Ingen vold/trusler'}
          icon={ShieldAlert}
          iconBg={hse.stats.violence > 0 ? 'bg-red-600' : 'bg-orange-500'}
          to="/hse?tab=incidents"
          urgent={hse.stats.violence > 0}
        />
        <KpiCard
          label="Compliance"
          value={`${openComplianceDone}/${openComplianceTotal}`}
          sub={`${openComplianceTotal - openComplianceDone} gjenstår`}
          icon={CheckCircle2}
          iconBg={openComplianceDone === openComplianceTotal ? 'bg-emerald-600' : 'bg-sky-600'}
          to="/council?tab=requirements"
        />
      </div>

      {/* ── Two-column layout ────────────────────────────────────────────── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">

        {/* LEFT COLUMN */}
        <div className="space-y-5">

          {/* Weekly calendar — coloured today, coloured dots */}
          <div className="border border-neutral-200/90 bg-white shadow-sm">
            <div className="border-b border-neutral-100 px-5 py-3 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-500">Denne uken</h2>
            </div>
            <div className="grid grid-cols-7 divide-x divide-neutral-100">
              {weekDays.map(({ iso, dayName, dayNum, meetings, milestones, isToday }) => (
                <div key={iso}
                  className={`flex flex-col items-center gap-1.5 px-1 py-3 text-center ${isToday ? 'bg-[#1a3d32]' : 'bg-white hover:bg-neutral-50'} transition-colors`}>
                  <span className={`text-[9px] font-semibold uppercase ${isToday ? 'text-white/60' : 'text-neutral-400'}`}>{dayName}</span>
                  <span className={`text-base font-bold tabular-nums ${isToday ? 'text-white' : 'text-neutral-800'}`}>{dayNum}</span>
                  <div className="flex flex-wrap justify-center gap-0.5 min-h-[8px]">
                    {meetings.slice(0, 3).map((m) => (
                      <span key={m.id} title={m.title}
                        className="size-1.5 block"
                        style={{ background: isToday ? 'rgba(201,162,39,0.9)' : accent }} />
                    ))}
                    {milestones.slice(0, 2).map((_, i) => (
                      <span key={i} className="size-1.5 block bg-amber-400" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming meetings — coloured date badges */}
          <div className="border border-neutral-200/90 bg-white shadow-sm">
            <div className="border-b border-neutral-100 px-5 py-3 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-500">Kommende AMU-møter</h2>
              <Link to="/council?tab=meetings" className="text-xs font-medium text-[#1a3d32] hover:underline">Se alle →</Link>
            </div>
            {upcomingMeetings.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-neutral-400">Ingen planlagte møter.</p>
            ) : (
              <div className="divide-y divide-neutral-100">
                {upcomingMeetings.map((m) => {
                  const d = daysUntil(m.startsAt)
                  return (
                    <Link key={m.id} to="/council?tab=meetings"
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-neutral-50 transition-colors">
                      {/* Coloured date box */}
                      <div className="flex size-11 shrink-0 flex-col items-center justify-center bg-[#1a3d32] text-white">
                        <span className="text-[9px] font-semibold uppercase leading-none text-[#c9a227]">
                          {new Date(m.startsAt).toLocaleDateString('no-NO', { month: 'short' })}
                        </span>
                        <span className="text-lg font-bold tabular-nums leading-tight">
                          {new Date(m.startsAt).getDate()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-neutral-900 truncate">{m.title}</div>
                        <div className="text-xs text-neutral-400">
                          kl. {fmtTime(m.startsAt)} · {m.location}
                          {m.quarterSlot ? ` · Q${m.quarterSlot}` : ''}
                        </div>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 text-xs font-bold ${d <= 3 ? 'bg-red-500 text-white' : d <= 7 ? 'bg-amber-400 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                        {d === 0 ? 'I dag' : d === 1 ? 'I morgen' : `${d}d`}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Open tasks — coloured status dots */}
          <div className="border border-neutral-200/90 bg-white shadow-sm">
            <div className="border-b border-neutral-100 px-5 py-3 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-500">Åpne oppgaver</h2>
              <Link to="/tasks" className="text-xs font-medium text-[#1a3d32] hover:underline">Se alle →</Link>
            </div>
            {openTasks.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-neutral-400">Ingen åpne oppgaver.</p>
            ) : (
              <div className="divide-y divide-neutral-100">
                {openTasks.slice(0, 7).map((task) => {
                  const overdue = task.dueDate && task.dueDate < todayStr
                  const d = task.dueDate ? daysUntil(task.dueDate) : null
                  return (
                    <Link key={task.id} to="/tasks"
                      className={`flex items-center gap-3 px-5 py-3 hover:bg-neutral-50 transition-colors ${overdue ? 'bg-red-50/40' : ''}`}>
                      <span className={`size-2.5 shrink-0 ${task.status === 'in_progress' ? 'bg-sky-500' : 'bg-neutral-300'}`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-neutral-900 truncate">{task.title}</span>
                        {task.ownerRole && <span className="ml-2 text-xs text-neutral-400">{task.ownerRole}</span>}
                      </div>
                      {task.status === 'in_progress' && (
                        <span className="shrink-0 bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">Pågår</span>
                      )}
                      {d !== null && (
                        <span className={`shrink-0 text-xs font-semibold ${overdue ? 'text-red-600' : d <= 3 ? 'text-amber-600' : 'text-neutral-400'}`}>
                          {overdue ? `${Math.abs(d)}d forfalt` : d === 0 ? 'I dag' : `${d}d`}
                        </span>
                      )}
                    </Link>
                  )
                })}
                {openTasks.length > 7 && (
                  <Link to="/tasks" className="block px-5 py-2.5 text-center text-xs font-medium text-[#1a3d32] hover:underline bg-neutral-50">
                    + {openTasks.length - 7} flere oppgaver
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* High risks — coloured score badges */}
          {openHighRisks.length > 0 && (
            <div className="border border-amber-200/80 bg-white shadow-sm">
              <div className="border-b border-amber-100 bg-amber-50/60 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-500" />
                  <h2 className="text-xs font-bold uppercase tracking-wide text-amber-700">Høyrisikoer (ROS ≥ 12)</h2>
                </div>
                <Link to="/internal-control?tab=ros" className="text-xs font-medium text-amber-700 hover:underline">Se alle →</Link>
              </div>
              <div className="divide-y divide-amber-100">
                {openHighRisks.map((row) => (
                  <Link key={row.id} to="/internal-control?tab=ros"
                    className="flex items-center gap-3 px-5 py-3 hover:bg-amber-50/40 transition-colors">
                    <span className={`shrink-0 w-10 px-2 py-0.5 text-center text-xs font-bold ${row.riskScore >= 15 ? 'bg-red-500 text-white' : 'bg-amber-400 text-white'}`}>
                      {row.riskScore}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-neutral-900 truncate">{row.hazard}</span>
                      <span className="ml-2 text-xs text-neutral-400">{row.assessmentTitle}</span>
                    </div>
                    <ArrowRight className="size-3.5 text-neutral-300 shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Overdue milestones — red */}
          {overdueMilestones.length > 0 && (
            <div className="border border-red-200 bg-red-50/30 shadow-sm">
              <div className="border-b border-red-200 bg-red-50/70 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-red-500" />
                  <h2 className="text-xs font-bold uppercase tracking-wide text-red-700">Forfalte sykefravær-frister</h2>
                </div>
                <Link to="/hse?tab=sickness" className="text-xs font-medium text-red-700 hover:underline">Åpne →</Link>
              </div>
              <div className="divide-y divide-red-100">
                {overdueMilestones.map((m) => (
                  <Link key={`${m.caseId}-${m.kind}`} to="/hse?tab=sickness"
                    className="flex items-center gap-3 px-5 py-3 hover:bg-red-50/60 transition-colors">
                    <AlertTriangle className="size-4 shrink-0 text-red-400" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-neutral-900 truncate">{m.label}</span>
                      <span className="ml-2 text-xs text-neutral-500">{m.employeeName}</span>
                    </div>
                    <span className="shrink-0 bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                      {Math.abs(daysUntil(m.dueAt))}d
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT SIDEBAR */}
        <div className="space-y-4">

          {/* Org snapshot — dark brand header */}
          <div className="border border-neutral-200/90 bg-white shadow-sm overflow-hidden">
            <div className="bg-[#1a3d32] px-5 py-4 flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center bg-[#c9a227]/20">
                <Scale className="size-5 text-[#c9a227]" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{org.settings.orgName}</div>
                <div className="text-xs text-white/50">{org.totalEmployeeCount} ansatte · {rep.members.length} repr.</div>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-neutral-100">
              {[
                { label: 'AMU-møter i år', value: council.meetings.filter((m) => m.governanceYear === today.getFullYear()).length, colour: 'text-[#1a3d32]', to: '/council?tab=meetings' },
                { label: 'Vernerunder', value: hse.stats.rounds, colour: 'text-emerald-700', to: '/hse?tab=rounds' },
                { label: 'Inspeksjoner åpne', value: hse.stats.openInspections, colour: hse.stats.openInspections > 0 ? 'text-amber-600' : 'text-neutral-700', to: '/hse?tab=inspections' },
                { label: 'ROS-vurderinger', value: ic.stats.rosCount, colour: 'text-sky-700', to: '/internal-control?tab=ros' },
              ].map(({ label, value, colour, to }) => (
                <Link key={label} to={to} className="px-4 py-3 hover:bg-neutral-50 transition-colors">
                  <div className={`text-2xl font-bold tabular-nums ${colour}`}>{value}</div>
                  <div className="text-[10px] text-neutral-500 leading-tight">{label}</div>
                </Link>
              ))}
            </div>
          </div>

          {/* E-learning — teal accent */}
          <div className="border border-neutral-200/90 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-teal-100 bg-teal-600 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="size-4 text-white" />
                <h2 className="text-xs font-bold uppercase tracking-wide text-white">E-læring</h2>
              </div>
              <Link to="/learning" className="text-xs font-medium text-teal-100 hover:underline">Se alle →</Link>
            </div>
            <div className="grid grid-cols-2 divide-x divide-neutral-100 border-b border-neutral-100">
              <div className="px-4 py-3 bg-teal-50/50">
                <div className="text-2xl font-bold tabular-nums text-teal-700">{learning.courses.filter((c) => c.status === 'published').length}</div>
                <div className="text-[10px] text-teal-600">Publiserte kurs</div>
              </div>
              <div className="px-4 py-3 bg-sky-50/50">
                <div className="text-2xl font-bold tabular-nums text-sky-700">{learning.certificates.length}</div>
                <div className="text-[10px] text-sky-600">Sertifikater</div>
              </div>
            </div>
            <div className="divide-y divide-neutral-100">
              {learning.courses.filter((c) => c.status === 'published').slice(0, 3).map((c) => (
                <Link key={c.id} to={`/learning/play/${c.id}`}
                  className="flex items-center gap-2 px-5 py-2.5 hover:bg-neutral-50 transition-colors">
                  <GraduationCap className="size-3.5 shrink-0 text-teal-500" />
                  <span className="flex-1 truncate text-xs text-neutral-700">{c.title}</span>
                  <ArrowRight className="size-3 text-neutral-300 shrink-0" />
                </Link>
              ))}
            </div>
          </div>

          {/* Org health — pink/rose accent */}
          <div className="border border-neutral-200/90 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-pink-100 bg-pink-600 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartPulse className="size-4 text-white" />
                <h2 className="text-xs font-bold uppercase tracking-wide text-white">Organisasjonshelse</h2>
              </div>
              <Link to="/org-health" className="text-xs font-medium text-pink-100 hover:underline">Se alt →</Link>
            </div>
            <div className="divide-y divide-neutral-100">
              {[
                { label: 'Sykefravær siste', value: oh.navSummary.latestPercent != null ? `${oh.navSummary.latestPercent}%` : '—', icon: HeartPulse, iconCls: 'text-pink-500' },
                { label: 'Anon. meldinger', value: String(wr.amlReportStats.total), icon: BarChart3, iconCls: 'text-sky-500' },
                { label: 'Undersøkelser', value: String(oh.surveys.length), icon: ClipboardList, iconCls: 'text-teal-500' },
              ].map(({ label, value, icon: Icon, iconCls }) => (
                <div key={label} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span className="flex items-center gap-2 text-neutral-600">
                    <Icon className={`size-3.5 ${iconCls}`} />
                    {label}
                  </span>
                  <span className="font-bold tabular-nums text-neutral-900">{value}</span>
                </div>
              ))}
              {oh.surveys.filter((s) => s.status === 'open').length > 0 && (
                <Link to="/org-health?tab=surveys"
                  className="flex items-center gap-2 bg-teal-50 px-5 py-2.5 text-xs font-medium text-teal-800 hover:bg-teal-100 transition-colors">
                  <span className="size-2 bg-teal-500" />
                  {oh.surveys.filter((s) => s.status === 'open').length} åpen undersøkelse pågår →
                </Link>
              )}
            </div>
          </div>

          {/* Årshjul — coloured kind dots */}
          <div className="border border-neutral-200/90 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-neutral-100 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarRange className="size-4 text-amber-500" />
                <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-500">Årshjulet — kommende</h2>
              </div>
              <Link to="/aarshjul" className="text-xs font-medium text-[#1a3d32] hover:underline">Åpne →</Link>
            </div>
            {annualEvents.length === 0 ? (
              <p className="px-5 py-5 text-center text-xs text-neutral-400">Ingen kommende hendelser.</p>
            ) : (
              <div className="divide-y divide-neutral-100">
                {annualEvents.map((evt, i) => {
                  const d = daysUntil(evt.date)
                  return (
                    <Link key={i} to={evt.to}
                      className="flex items-start gap-2.5 px-5 py-2.5 hover:bg-neutral-50 transition-colors">
                      <span className="mt-1.5 size-2 shrink-0" style={{ background: evt.colour }} />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-neutral-800 truncate block">{evt.label}</span>
                        <span className="text-[10px]" style={{ color: evt.colour }}>{evt.kind}</span>
                        <span className="text-[10px] text-neutral-400"> · {fmtDate(evt.date)}</span>
                      </div>
                      <span className={`shrink-0 text-[10px] font-bold tabular-nums ${d <= 7 ? 'text-red-600' : d <= 30 ? 'text-amber-500' : 'text-neutral-400'}`}>
                        {d === 0 ? 'i dag' : `${d}d`}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick links — coloured icons */}
          <div className="border border-neutral-200/90 bg-white shadow-sm">
            <div className="border-b border-neutral-100 px-5 py-3">
              <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-500">Snarveier</h2>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-neutral-100">
              {[
                { label: 'Meld hendelse', to: '/hse?tab=incidents', icon: ShieldAlert, iconCls: 'text-red-500', bg: 'bg-red-50' },
                { label: 'Ny ROS', to: '/internal-control?tab=ros', icon: AlertTriangle, iconCls: 'text-amber-500', bg: 'bg-amber-50' },
                { label: 'Council', to: '/council', icon: Scale, iconCls: 'text-[#1a3d32]', bg: 'bg-emerald-50' },
                { label: 'Internkontroll', to: '/internal-control', icon: ClipboardList, iconCls: 'text-violet-600', bg: 'bg-violet-50' },
                { label: 'Documents', to: '/documents', icon: FileText, iconCls: 'text-sky-600', bg: 'bg-sky-50' },
                { label: 'Organisasjon', to: '/organisation', icon: Users, iconCls: 'text-emerald-600', bg: 'bg-emerald-50' },
              ].map(({ label, to, icon: Icon, iconCls, bg }) => (
                <Link key={to} to={to}
                  className="flex items-center gap-2.5 px-4 py-3 hover:bg-neutral-50 transition-colors">
                  <span className={`flex size-7 shrink-0 items-center justify-center ${bg}`}>
                    <Icon className={`size-4 ${iconCls}`} />
                  </span>
                  <span className="text-xs font-medium text-neutral-700">{label}</span>
                </Link>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Bottom metrics — coloured icons ─────────────────────────────── */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { value: hse.stats.expiredTraining, label: 'Utløpt opplæring', iconBg: 'bg-rose-500', icon: GraduationCap, urgent: hse.stats.expiredTraining > 0, to: '/hse?tab=training' },
          { value: ic.stats.rosCount, label: 'ROS-vurderinger', iconBg: 'bg-amber-500', icon: TrendingUp, to: '/internal-control?tab=ros' },
          { value: hse.stats.rounds, label: 'Vernerunder totalt', iconBg: 'bg-emerald-600', icon: HardHat, to: '/hse?tab=rounds' },
          { value: oh.surveys.filter((s) => s.status === 'open').length, label: 'Aktive undersøkelser', iconBg: 'bg-teal-600', icon: BookOpen, to: '/org-health?tab=surveys' },
        ].map(({ value, label, iconBg, icon: Icon, urgent, to }) => (
          <Link key={label} to={to}
            className={`group flex items-center gap-3 border bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${urgent ? 'border-red-200' : 'border-neutral-200/90'}`}>
            <div className={`flex size-10 shrink-0 items-center justify-center ${iconBg}`}>
              <Icon className="size-5 text-white" />
            </div>
            <div>
              <div className={`text-2xl font-bold tabular-nums ${urgent ? 'text-red-700' : 'text-neutral-900'}`}>{value}</div>
              <div className="text-[10px] text-neutral-500 leading-tight">{label}</div>
            </div>
          </Link>
        ))}
      </div>

    </div>
  )
}
