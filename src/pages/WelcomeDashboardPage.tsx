import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  Calendar,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  ListChecks,
  Settings,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { useNotifications } from '../hooks/useNotifications'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { useOrganisation } from '../hooks/useOrganisation'
import {
  daysUntil,
  fmtDate,
  fmtTime,
  useWorkspaceDashboardData,
} from '../hooks/useWorkspaceDashboardData'

const CREAM = '#F9F7F2'
const CREAM_DEEP = '#EFE8DC'
const FOREST = '#1a3d32'
const SERIF = "'Libre Baskerville', Georgia, serif"

export function WelcomeDashboardPage() {
  const { profile, user } = useOrgSetupContext()
  const org = useOrganisation()
  const {
    today,
    todayStr,
    hse,
    openTasks,
    overdueTasks,
    upcomingMeetings,
    nextMeeting,
    weekDays,
    openIncidents,
  } = useWorkspaceDashboardData()

  const { unreadList, unreadCount } = useNotifications()

  const displayName = useMemo(() => {
    const n = profile?.display_name?.trim()
    if (n) return n
    const e = user?.email?.split('@')[0]
    return e || 'deg'
  }, [profile?.display_name, user?.email])

  const donutStops = useMemo(() => {
    const total = openTasks.length
    if (total === 0) return [{ pct: 100, color: '#d4d4d4', label: 'Ingen åpne' }]
    const overdue = overdueTasks.length
    const overdueSet = new Set(overdueTasks.map((t) => t.id))
    const notOverdue = openTasks.filter((t) => !overdueSet.has(t.id))
    const todoOk = notOverdue.filter((t) => t.status === 'todo').length
    const progOk = notOverdue.filter((t) => t.status === 'in_progress').length
    const segs: { pct: number; color: string; label: string }[] = []
    if (todoOk > 0) segs.push({ pct: (todoOk / total) * 100, color: FOREST, label: 'Todo' })
    if (progOk > 0) segs.push({ pct: (progOk / total) * 100, color: '#60a5fa', label: 'Pågår' })
    if (overdue > 0) segs.push({ pct: (overdue / total) * 100, color: '#dc2626', label: 'Forfalt' })
    const sum = segs.reduce((a, s) => a + s.pct, 0)
    if (segs.length && sum < 99.9) segs[segs.length - 1]!.pct += 100 - sum
    return segs.length ? segs : [{ pct: 100, color: '#d4d4d4', label: '—' }]
  }, [openTasks, overdueTasks])

  const donutGradient = useMemo(() => {
    let acc = 0
    return donutStops
      .map((s) => {
        const start = acc
        const end = acc + s.pct
        acc = end
        return `${s.color} ${start}% ${end}%`
      })
      .join(', ')
  }, [donutStops])

  return (
    <div className="min-h-full" style={{ backgroundColor: CREAM, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          <span>Workspace</span>
          <span className="text-neutral-300">›</span>
          <span className="font-medium text-neutral-700">Hjem</span>
          <Link
            to="/dashboard/classic"
            className="ml-auto text-xs font-medium text-[#1a3d32] underline-offset-2 hover:underline"
          >
            Klassisk dashbord
          </Link>
        </nav>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(260px,3fr)] lg:items-start">
          {/* Main 70% */}
          <div className="min-w-0 space-y-6">
            <div>
              <p className="text-xs text-neutral-500">
                {today.toLocaleDateString('no-NO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
                <h1
                  className="text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl"
                  style={{ fontFamily: SERIF }}
                >
                  Velkommen tilbake, {displayName}
                </h1>
                <div className="flex items-center gap-1 text-neutral-500">
                  <Link
                    to="/profile"
                    className="rounded-md p-2 hover:bg-white/80"
                    aria-label="Profil og innstillinger"
                  >
                    <Settings className="size-5" />
                  </Link>
                  <span className="relative rounded-md p-2" title="Varsler (generert)">
                    <Bell className="size-5" />
                    {unreadCount > 0 ?
                      <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    : null}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-sm text-neutral-600">
                {org.settings.orgName} · oversikt fra oppgaver, HMS, råd og årshjul — samme data som i det klassiske dashbordet.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div
                className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200/60 px-5 py-4"
                style={{ backgroundColor: CREAM_DEEP }}
              >
                <div>
                  <p className="text-3xl font-bold tabular-nums text-neutral-900">{openTasks.length}</p>
                  <p className="mt-1 text-sm font-medium text-neutral-800">Åpne oppgaver</p>
                  <p className="text-xs text-neutral-600">
                    {overdueTasks.length > 0 ? `${overdueTasks.length} forfalt` : 'Ingen forfalte'}
                  </p>
                </div>
                <Link
                  to="/tasks"
                  className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-neutral-700 hover:text-neutral-900"
                >
                  Se oppgaver <ChevronRight className="size-3.5" />
                </Link>
              </div>
              <div
                className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200/60 px-5 py-4"
                style={{ backgroundColor: CREAM_DEEP }}
              >
                <div>
                  <p className="text-3xl font-bold tabular-nums text-neutral-900">{openIncidents}</p>
                  <p className="mt-1 text-sm font-medium text-neutral-800">HMS-hendelser åpne</p>
                  <p className="text-xs text-neutral-600">
                    {hse.stats.violence > 0 ? `${hse.stats.violence} vold/trusler` : 'Ingen vold/trusler'}
                  </p>
                </div>
                <Link
                  to="/hse?tab=incidents"
                  className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-neutral-700 hover:text-neutral-900"
                >
                  HMS <ChevronRight className="size-3.5" />
                </Link>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-neutral-200/80 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
                <p className="text-sm font-semibold text-neutral-900">Neste på listen</p>
                <Link
                  to="/tasks"
                  className="text-xs font-semibold uppercase tracking-wide text-neutral-600 hover:text-neutral-900"
                >
                  Alle oppgaver
                </Link>
              </div>
              <div className="divide-y divide-neutral-100">
                {openTasks.length === 0 ?
                  <p className="px-4 py-8 text-center text-sm text-neutral-500">Ingen åpne oppgaver.</p>
                : openTasks.slice(0, 6).map((task) => {
                    const overdue = task.dueDate && task.dueDate < todayStr
                    const d = task.dueDate ? daysUntil(task.dueDate) : null
                    return (
                      <Link
                        key={task.id}
                        to={`/tasks?view=list&openTask=${encodeURIComponent(task.id)}`}
                        className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-neutral-50/80"
                      >
                        <ListChecks className="size-4 shrink-0 text-neutral-400" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-neutral-900">{task.title}</p>
                          {task.ownerRole ?
                            <p className="text-xs text-neutral-500">{task.ownerRole}</p>
                          : null}
                        </div>
                        {task.status === 'in_progress' ?
                          <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                            Pågår
                          </span>
                        : null}
                        {d !== null ?
                          <span
                            className={`shrink-0 text-xs font-semibold tabular-nums ${
                              overdue ? 'text-red-600' : d <= 3 ? 'text-amber-600' : 'text-neutral-400'
                            }`}
                          >
                            {overdue ? 'Forfalt' : d === 0 ? 'I dag' : `${d}d`}
                          </span>
                        : null}
                      </Link>
                    )
                  })
                }
                {openTasks.length > 6 ?
                  <Link
                    to="/tasks"
                    className="block px-4 py-2.5 text-center text-xs font-semibold text-[#1a3d32] hover:bg-neutral-50"
                  >
                    + {openTasks.length - 6} flere <ChevronDown className="inline size-3" />
                  </Link>
                : null}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-neutral-200/80 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
                <p className="text-sm font-semibold text-neutral-900">Oppgaver etter status</p>
                <Link to="/action-board" className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-600 hover:text-neutral-900">
                  <LayoutGrid className="size-3.5" /> Board
                </Link>
              </div>
              <div className="p-5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Fordeling</p>
                <p className="mt-1 text-sm text-neutral-600">Todo, pågående og forfalte åpne oppgaver.</p>
                <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-10">
                  <ul className="min-w-[180px] space-y-2 text-sm">
                    {donutStops.map((s, i) => (
                      <li key={i} className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-2 text-neutral-600">
                          <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.label}
                        </span>
                        <span className="tabular-nums font-medium text-neutral-900">{Math.round(s.pct)}%</span>
                      </li>
                    ))}
                  </ul>
                  <div
                    className="grid size-44 shrink-0 place-items-center rounded-full"
                    style={{ background: `conic-gradient(${donutGradient})` }}
                  >
                    <div className="flex size-24 flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
                      <p className="text-[10px] font-semibold uppercase text-neutral-500">Totalt</p>
                      <p className="text-lg font-bold text-neutral-900">{openTasks.length}</p>
                      <p className="text-[10px] text-neutral-500">åpne</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar 30% */}
          <aside className="min-w-0 space-y-6">
            {nextMeeting ?
              <div className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
                <span className="font-medium">Neste AMU-møte:</span>{' '}
                {fmtDate(nextMeeting.startsAt)} kl. {fmtTime(nextMeeting.startsAt)}
                <Link to="/council?tab=meetings" className="ml-1 font-semibold text-[#1a3d32] underline">
                  Åpne
                </Link>
              </div>
            : null}

            <div className="overflow-hidden rounded-lg border border-neutral-200/80 bg-white shadow-sm">
              <div className="border-b border-neutral-100 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Denne uken</p>
              </div>
              <div className="p-3">
                <p className="text-center text-xs font-medium text-neutral-500">
                  Uke med {today.toLocaleDateString('no-NO', { month: 'long', year: 'numeric' })}
                </p>
                <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] text-neutral-500">
                  {weekDays.map((wd) => (
                    <span key={wd.iso} className="font-semibold">
                      {wd.dayName}
                    </span>
                  ))}
                  {weekDays.map((wd) => (
                    <span
                      key={`n-${wd.iso}`}
                      className={`py-1 ${wd.isToday ? 'rounded-full bg-orange-500 font-bold text-white' : 'text-neutral-700'}`}
                    >
                      {wd.dayNum}
                    </span>
                  ))}
                </div>
                <div className="mt-3 border-t border-neutral-100 pt-3">
                  {upcomingMeetings[0] ?
                    <>
                      <p className="text-sm font-semibold text-neutral-900">{upcomingMeetings[0]!.title}</p>
                      <p className="text-xs text-neutral-500">
                        {fmtDate(upcomingMeetings[0]!.startsAt)} · {fmtTime(upcomingMeetings[0]!.startsAt)}
                      </p>
                      <Link
                        to="/council?tab=meetings"
                        className="mt-1 inline-block text-sm font-semibold text-orange-600 hover:underline"
                      >
                        Gå til møter →
                      </Link>
                    </>
                  :
                    <p className="text-sm text-neutral-500">Ingen planlagte møter i umiddelbar horisont.</p>
                  }
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-neutral-200/80 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Varsler</p>
                {unreadCount > 0 ?
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">{unreadCount}</span>
                : null}
              </div>
              <ul className="divide-y divide-neutral-100">
                {unreadList.length === 0 ?
                  <li className="px-4 py-6 text-center text-xs text-neutral-500">Ingen uleste varsler.</li>
                : unreadList.slice(0, 6).map((n) => (
                    <li key={n.id} className="flex gap-3 px-4 py-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                        <Bell className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link to={n.href} className="text-sm text-neutral-800 hover:text-[#1a3d32]">
                          <span className="font-medium">{n.title}</span>
                          {n.body ? <span className="mt-0.5 block text-xs text-neutral-500">{n.body}</span> : null}
                        </Link>
                      </div>
                    </li>
                  ))}
              </ul>
              {unreadList.length > 6 ?
                <Link to="/tasks" className="block border-t border-neutral-100 px-4 py-2 text-center text-xs font-medium text-[#1a3d32]">
                  Se flere i oppgaver →
                </Link>
              : null}
            </div>

            <div className="overflow-hidden rounded-lg border border-neutral-200/80 bg-white shadow-sm">
              <div className="border-b border-neutral-100 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Snarveier</p>
              </div>
              <div className="grid grid-cols-1 divide-y divide-neutral-100">
                <Link
                  to="/organisation"
                  className="flex items-center gap-3 px-4 py-3 text-sm text-neutral-800 hover:bg-neutral-50"
                >
                  <Users className="size-4 text-emerald-700" />
                  Organisasjon
                </Link>
                <Link
                  to="/hse?tab=incidents"
                  className="flex items-center gap-3 px-4 py-3 text-sm text-neutral-800 hover:bg-neutral-50"
                >
                  <ShieldAlert className="size-4 text-red-500" />
                  Hendelser
                </Link>
                <Link
                  to="/council?tab=meetings"
                  className="flex items-center gap-3 px-4 py-3 text-sm text-neutral-800 hover:bg-neutral-50"
                >
                  <Calendar className="size-4 text-[#1a3d32]" />
                  AMU-møter
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
