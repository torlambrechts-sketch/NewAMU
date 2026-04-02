import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Clock,
  ExternalLink,
  GraduationCap,
  HardHat,
  HeartPulse,
  LayoutGrid,
  Search,
  Settings,
  Star,
  Users,
  UsersRound,
} from 'lucide-react'

type SubItem =
  | { label: string; path: string; match: (loc: { pathname: string; search: string }) => boolean }

const councilSubs: SubItem[] = [
  {
    label: 'Oversikt',
    path: '/council?tab=overview',
    match: ({ pathname, search }) =>
      pathname === '/council' &&
      (!new URLSearchParams(search).get('tab') ||
        new URLSearchParams(search).get('tab') === 'overview'),
  },
  { label: 'Styre og valg', path: '/council?tab=board', match: ({ pathname, search }) => pathname === '/council' && new URLSearchParams(search).get('tab') === 'board' },
  { label: 'Møter og årshjul', path: '/council?tab=meetings', match: ({ pathname, search }) => pathname === '/council' && new URLSearchParams(search).get('tab') === 'meetings' },
  { label: 'Møteforberedelse', path: '/council?tab=preparation', match: ({ pathname, search }) => pathname === '/council' && new URLSearchParams(search).get('tab') === 'preparation' },
  { label: 'Arbeidsrett og sjekkliste', path: '/council?tab=compliance', match: ({ pathname, search }) => pathname === '/council' && new URLSearchParams(search).get('tab') === 'compliance' },
]

const membersSubs: SubItem[] = [
  {
    label: 'Oversikt',
    path: '/members?tab=overview',
    match: ({ pathname, search }) =>
      pathname === '/members' &&
      (!new URLSearchParams(search).get('tab') || new URLSearchParams(search).get('tab') === 'overview'),
  },
  { label: 'Valg', path: '/members?tab=election', match: ({ pathname, search }) => pathname === '/members' && new URLSearchParams(search).get('tab') === 'election' },
  { label: 'AMU og sammensetting', path: '/members?tab=board', match: ({ pathname, search }) => pathname === '/members' && new URLSearchParams(search).get('tab') === 'board' },
  { label: 'Krav og opplæring', path: '/members?tab=requirements', match: ({ pathname, search }) => pathname === '/members' && new URLSearchParams(search).get('tab') === 'requirements' },
  { label: 'Perioder', path: '/members?tab=periods', match: ({ pathname, search }) => pathname === '/members' && new URLSearchParams(search).get('tab') === 'periods' },
  { label: 'Revisjonslogg', path: '/members?tab=audit', match: ({ pathname, search }) => pathname === '/members' && new URLSearchParams(search).get('tab') === 'audit' },
]

const orgHealthSubs: SubItem[] = [
  {
    label: 'Oversikt',
    path: '/org-health?tab=overview',
    match: ({ pathname, search }) =>
      pathname === '/org-health' &&
      (!new URLSearchParams(search).get('tab') || new URLSearchParams(search).get('tab') === 'overview'),
  },
  { label: 'Undersøkelser', path: '/org-health?tab=surveys', match: ({ pathname, search }) => pathname === '/org-health' && new URLSearchParams(search).get('tab') === 'surveys' },
  { label: 'Sykefravær (NAV)', path: '/org-health?tab=nav', match: ({ pathname, search }) => pathname === '/org-health' && new URLSearchParams(search).get('tab') === 'nav' },
  { label: 'AML-indikatorer', path: '/org-health?tab=metrics', match: ({ pathname, search }) => pathname === '/org-health' && new URLSearchParams(search).get('tab') === 'metrics' },
  { label: 'Logg', path: '/org-health?tab=audit', match: ({ pathname, search }) => pathname === '/org-health' && new URLSearchParams(search).get('tab') === 'audit' },
]

const hseSubs: SubItem[] = [
  {
    label: 'Oversikt',
    path: '/hse?tab=overview',
    match: ({ pathname, search }) =>
      pathname === '/hse' &&
      (!new URLSearchParams(search).get('tab') || new URLSearchParams(search).get('tab') === 'overview'),
  },
  { label: 'Vernerunder', path: '/hse?tab=rounds', match: ({ pathname, search }) => pathname === '/hse' && new URLSearchParams(search).get('tab') === 'rounds' },
  { label: 'Inspeksjoner', path: '/hse?tab=inspections', match: ({ pathname, search }) => pathname === '/hse' && new URLSearchParams(search).get('tab') === 'inspections' },
  { label: 'Hendelser', path: '/hse?tab=incidents', match: ({ pathname, search }) => pathname === '/hse' && new URLSearchParams(search).get('tab') === 'incidents' },
  { label: 'AML & verneombud', path: '/hse?tab=aml', match: ({ pathname, search }) => pathname === '/hse' && new URLSearchParams(search).get('tab') === 'aml' },
  { label: 'Revisjonslogg', path: '/hse?tab=audit', match: ({ pathname, search }) => pathname === '/hse' && new URLSearchParams(search).get('tab') === 'audit' },
]

const tasksSubs: SubItem[] = [
  {
    label: 'Oppgaveliste',
    path: '/tasks?view=list',
    match: ({ pathname, search }) =>
      pathname === '/tasks' &&
      (!new URLSearchParams(search).get('view') || new URLSearchParams(search).get('view') === 'list'),
  },
  { label: 'Oppgavelogg', path: '/tasks?view=audit', match: ({ pathname, search }) => pathname === '/tasks' && new URLSearchParams(search).get('view') === 'audit' },
]

const learningSubs: SubItem[] = [
  {
    label: 'Dashboard',
    path: '/learning',
    match: ({ pathname }) => pathname === '/learning',
  },
  {
    label: 'Courses',
    path: '/learning/courses',
    match: ({ pathname }) => pathname === '/learning/courses' || pathname.startsWith('/learning/courses/'),
  },
  {
    label: 'Certifications',
    path: '/learning/certifications',
    match: ({ pathname }) => pathname === '/learning/certifications',
  },
  {
    label: 'Insights',
    path: '/learning/insights',
    match: ({ pathname }) => pathname === '/learning/insights',
  },
  {
    label: 'Participants',
    path: '/learning/participants',
    match: ({ pathname }) => pathname === '/learning/participants',
  },
  {
    label: 'Settings',
    path: '/learning/settings',
    match: ({ pathname }) => pathname === '/learning/settings',
  },
]

/** Council is its own primary group (left); other modules follow after a divider. */
const navMainCouncil = [{ to: '/council', label: 'Council', end: false, icon: UsersRound }] as const

const navMainRest = [
  { to: '/members', label: 'Members', end: false, icon: Users },
  { to: '/org-health', label: 'Org health', end: false, icon: HeartPulse },
  { to: '/hse', label: 'HSE', end: false, icon: HardHat },
  { to: '/tasks', label: 'Tasks', end: false, icon: LayoutGrid },
  { to: '/learning', label: 'E-learning', end: true, icon: GraduationCap },
] as const

function subNavForPath(pathname: string): SubItem[] {
  if (pathname.startsWith('/learning')) return learningSubs
  if (pathname === '/council') return councilSubs
  if (pathname === '/members') return membersSubs
  if (pathname === '/org-health') return orgHealthSubs
  if (pathname === '/hse') return hseSubs
  if (pathname === '/tasks') return tasksSubs
  return []
}

export function AticsShell() {
  const location = useLocation()
  const subItems = subNavForPath(location.pathname)

  return (
    <div className="min-h-screen bg-[#f5f0e8]">
      <header className="bg-[#1a3d32] text-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 md:px-8">
          <NavLink to="/" className="flex items-center gap-2" aria-label="Home">
            <Star className="size-7 shrink-0 fill-white text-white" strokeWidth={1.2} />
            <span
              className="font-serif text-xl tracking-wide text-[#c9a227] md:text-2xl"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
            >
              atics
            </span>
          </NavLink>
          <nav
            className="flex max-w-[min(100%,56rem)] flex-1 flex-wrap items-center justify-center gap-x-2 gap-y-1 overflow-x-auto py-1 md:gap-x-4 lg:max-w-none"
            aria-label="Primary"
          >
            <div className="flex items-center gap-2 md:gap-3" role="group" aria-label="Arbeidsmiljøråd">
              {navMainCouncil.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to + item.label}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold transition-colors md:px-3 ${
                        isActive
                          ? 'bg-white/15 text-white ring-1 ring-[#c9a227]/80'
                          : 'text-white/85 hover:bg-white/10 hover:text-white'
                      }`
                    }
                  >
                    <Icon className="size-4 shrink-0 opacity-95" aria-hidden />
                    {item.label}
                  </NavLink>
                )
              })}
            </div>
            <span
              className="hidden h-6 w-px shrink-0 bg-white/25 sm:block"
              aria-hidden
            />
            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4" role="group" aria-label="Andre moduler">
              {navMainRest.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to + item.label}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
                        isActive
                          ? 'border-b-2 border-[#c9a227] pb-0.5 text-white'
                          : 'text-white/80 hover:text-white'
                      }`
                    }
                  >
                    <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
                    {item.label}
                  </NavLink>
                )
              })}
            </div>
          </nav>
          <div className="flex items-center gap-2 md:gap-3">
            <button
              type="button"
              className="hidden items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#1a3d32] sm:flex"
            >
              <Clock className="size-3.5" />
              Upgrade
            </button>
            <button type="button" className="rounded-lg p-2 hover:bg-white/10" aria-label="Settings">
              <Settings className="size-5" />
            </button>
            <button type="button" className="rounded-lg p-2 hover:bg-white/10" aria-label="Open external">
              <ExternalLink className="size-5" />
            </button>
            <div
              className="size-9 shrink-0 rounded-full bg-gradient-to-br from-amber-200 to-amber-700 ring-2 ring-white/30"
              role="img"
              aria-label="User profile"
            />
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 md:px-8">
            <nav className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-2" aria-label="Section">
              {subItems.length > 0 ? (
                subItems.map((item) => {
                  const active = item.match({
                    pathname: location.pathname,
                    search: location.search,
                  })
                  return (
                    <NavLink
                      key={item.path + item.label}
                      to={item.path}
                      className={`whitespace-nowrap text-sm font-medium transition-colors ${
                        active
                          ? 'border-b-2 border-[#c9a227] pb-0.5 text-white'
                          : 'text-white/75 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </NavLink>
                  )
                })
              ) : (
                <span className="text-sm text-white/45">Velg en hovedmodul over (Council, Org health, …)</span>
              )}
            </nav>
            <div className="relative min-w-[200px] flex-1 md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/50" />
              <input
                type="search"
                placeholder="Find anything"
                className="w-full rounded-full border border-white/20 bg-white/10 py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/45 focus:border-[#c9a227] focus:outline-none focus:ring-1 focus:ring-[#c9a227]"
              />
            </div>
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  )
}
