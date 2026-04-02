import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  ClipboardList,
  Clock,
  ExternalLink,
  GraduationCap,
  HardHat,
  HeartPulse,
  Home,
  LayoutGrid,
  PanelLeft,
  Search,
  Settings,
  Star,
  UsersRound,
} from 'lucide-react'

// ─── Sub-item type ───────────────────────────────────────────────────────────

type SubItem = {
  label: string
  path: string
  match: (loc: { pathname: string; search: string }) => boolean
}

// ─── Sub-item lists (unchanged) ──────────────────────────────────────────────

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
  { label: 'Valg representanter', path: '/council?tab=election', match: ({ pathname, search }) => pathname === '/council' && new URLSearchParams(search).get('tab') === 'election' },
  { label: 'Krav og opplæring', path: '/council?tab=requirements', match: ({ pathname, search }) => pathname === '/council' && new URLSearchParams(search).get('tab') === 'requirements' },
  { label: 'Møter og årshjul', path: '/council?tab=meetings', match: ({ pathname, search }) => pathname === '/council' && new URLSearchParams(search).get('tab') === 'meetings' },
  { label: 'Møteforberedelse', path: '/council?tab=preparation', match: ({ pathname, search }) => pathname === '/council' && new URLSearchParams(search).get('tab') === 'preparation' },
  { label: 'Arbeidsrett og sjekkliste', path: '/council?tab=compliance', match: ({ pathname, search }) => pathname === '/council' && new URLSearchParams(search).get('tab') === 'compliance' },
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
  { label: 'Anonym rapportering', path: '/org-health?tab=reporting', match: ({ pathname, search }) => pathname === '/org-health' && new URLSearchParams(search).get('tab') === 'reporting' },
  { label: 'Logg', path: '/org-health?tab=audit', match: ({ pathname, search }) => pathname === '/org-health' && new URLSearchParams(search).get('tab') === 'audit' },
  { label: 'Veikart', path: '/org-health/settings', match: ({ pathname }) => pathname === '/org-health/settings' },
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
  { label: 'Dashboard', path: '/learning', match: ({ pathname }) => pathname === '/learning' },
  { label: 'Courses', path: '/learning/courses', match: ({ pathname }) => pathname === '/learning/courses' || pathname.startsWith('/learning/courses/') },
  { label: 'Certifications', path: '/learning/certifications', match: ({ pathname }) => pathname === '/learning/certifications' },
  { label: 'Insights', path: '/learning/insights', match: ({ pathname }) => pathname === '/learning/insights' },
  { label: 'Participants', path: '/learning/participants', match: ({ pathname }) => pathname === '/learning/participants' },
  { label: 'Settings', path: '/learning/settings', match: ({ pathname }) => pathname === '/learning/settings' },
]

const internalControlSubs: SubItem[] = [
  {
    label: 'Oversikt',
    path: '/internal-control?tab=overview',
    match: ({ pathname, search }) =>
      pathname === '/internal-control' &&
      (!new URLSearchParams(search).get('tab') || new URLSearchParams(search).get('tab') === 'overview'),
  },
  { label: 'Varslingssaker', path: '/internal-control?tab=whistle', match: ({ pathname, search }) => pathname === '/internal-control' && new URLSearchParams(search).get('tab') === 'whistle' },
  { label: 'ROS', path: '/internal-control?tab=ros', match: ({ pathname, search }) => pathname === '/internal-control' && new URLSearchParams(search).get('tab') === 'ros' },
  { label: 'Årsgjennomgang', path: '/internal-control?tab=annual', match: ({ pathname, search }) => pathname === '/internal-control' && new URLSearchParams(search).get('tab') === 'annual' },
  { label: 'Logg', path: '/internal-control?tab=audit', match: ({ pathname, search }) => pathname === '/internal-control' && new URLSearchParams(search).get('tab') === 'audit' },
]

// ─── Unified module list (icon rail + sub-nav panel in sidebar mode) ─────────

const allModules = [
  { to: '/', label: 'Dashboard', end: true, icon: Home, subs: [] as SubItem[] },
  { to: '/council', label: 'Council', end: false, icon: UsersRound, subs: councilSubs },
  { to: '/org-health', label: 'Org health', end: false, icon: HeartPulse, subs: orgHealthSubs },
  { to: '/hse', label: 'HSE', end: false, icon: HardHat, subs: hseSubs },
  { to: '/internal-control', label: 'Internkontroll', end: false, icon: ClipboardList, subs: internalControlSubs },
  { to: '/tasks', label: 'Tasks', end: false, icon: LayoutGrid, subs: tasksSubs },
  { to: '/learning', label: 'E-learning', end: true, icon: GraduationCap, subs: learningSubs },
]

// ─── Top-bar mode data (original) ────────────────────────────────────────────

const navMainCouncil = [{ to: '/council', label: 'Council', end: false, icon: UsersRound }] as const

const navMainRest = [
  { to: '/org-health', label: 'Org health', end: false, icon: HeartPulse },
  { to: '/hse', label: 'HSE', end: false, icon: HardHat },
  { to: '/internal-control', label: 'Internkontroll', end: false, icon: ClipboardList },
  { to: '/tasks', label: 'Tasks', end: false, icon: LayoutGrid },
  { to: '/learning', label: 'E-learning', end: true, icon: GraduationCap },
] as const

function subNavForPath(pathname: string): SubItem[] {
  if (pathname.startsWith('/learning')) return learningSubs
  if (pathname === '/council') return councilSubs
  if (pathname.startsWith('/org-health')) return orgHealthSubs
  if (pathname === '/internal-control') return internalControlSubs
  if (pathname === '/hse') return hseSubs
  if (pathname === '/tasks') return tasksSubs
  return []
}

// ─── Sidebar helpers ──────────────────────────────────────────────────────────

function activeModuleForPath(pathname: string) {
  for (const mod of allModules) {
    if (mod.to === '/') continue
    if (pathname === mod.to || pathname.startsWith(mod.to + '/') || pathname.startsWith(mod.to + '?')) {
      return mod
    }
  }
  return allModules[0]
}

// ─── Nav mode persistence ─────────────────────────────────────────────────────

type NavMode = 'topbar' | 'sidebar'

function loadNavMode(): NavMode {
  try {
    const v = localStorage.getItem('atics-nav-mode')
    if (v === 'sidebar' || v === 'topbar') return v
  } catch { /* ignore */ }
  return 'topbar'
}

function saveNavMode(mode: NavMode) {
  try { localStorage.setItem('atics-nav-mode', mode) } catch { /* ignore */ }
}

// ─── Settings panel (shared between layouts) ──────────────────────────────────

function NavModePanel({
  navMode,
  onChange,
  onClose,
}: {
  navMode: NavMode
  onChange: (m: NavMode) => void
  onClose: () => void
}) {
  return (
    <>
      {/* Invisible backdrop to close on outside click */}
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div className="absolute z-50 w-56 rounded-xl border border-neutral-200 bg-white p-3 shadow-xl">
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Navigation layout
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange('topbar')}
            className={`flex flex-1 flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors ${
              navMode === 'topbar'
                ? 'border-[#1a3d32] bg-[#1a3d32]/5 text-[#1a3d32]'
                : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-800'
            }`}
          >
            {/* mini top-bar icon */}
            <span className="flex flex-col gap-0.5">
              <span className="block h-1.5 w-8 rounded-sm bg-current opacity-80" />
              <span className="block h-1 w-8 rounded-sm bg-current opacity-40" />
              <span className="block h-6 w-8 rounded-sm border border-current opacity-30" />
            </span>
            Top bar
          </button>
          <button
            type="button"
            onClick={() => onChange('sidebar')}
            className={`flex flex-1 flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors ${
              navMode === 'sidebar'
                ? 'border-[#1a3d32] bg-[#1a3d32]/5 text-[#1a3d32]'
                : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-800'
            }`}
          >
            {/* mini side-bar icon */}
            <span className="flex gap-0.5">
              <span className="block h-8 w-2 rounded-sm bg-current opacity-80" />
              <span className="block h-8 w-6 rounded-sm border border-current opacity-30" />
            </span>
            Side bar
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export function AticsShell() {
  const location = useLocation()
  const [navMode, setNavMode] = useState<NavMode>(loadNavMode)
  const [settingsOpen, setSettingsOpen] = useState(false)

  function handleNavModeChange(mode: NavMode) {
    setNavMode(mode)
    saveNavMode(mode)
    setSettingsOpen(false)
  }

  // ── Sidebar layout ──────────────────────────────────────────────────────────
  if (navMode === 'sidebar') {
    const activeModule = activeModuleForPath(location.pathname)
    const hasSubs = activeModule.subs.length > 0

    return (
      <div className="flex h-screen overflow-hidden">
        {/* ── Icon rail ───────────────────────────────────────────────────── */}
        <aside className="flex w-14 shrink-0 flex-col bg-[#1a3d32]">
          {/* Logo */}
          <div className="flex h-14 shrink-0 items-center justify-center border-b border-white/10">
            <NavLink to="/" aria-label="Home" className="flex items-center justify-center rounded-lg p-1.5 hover:bg-white/10">
              <Star className="size-5 fill-white text-white" strokeWidth={1.2} />
            </NavLink>
          </div>

          {/* Module icons */}
          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-1.5 py-3" aria-label="Primary">
            {allModules.map((mod) => {
              const Icon = mod.icon
              const isActive = activeModule.to === mod.to
              return (
                <NavLink
                  key={mod.to}
                  to={mod.to}
                  end={mod.end}
                  title={mod.label}
                  className={`flex items-center justify-center rounded-lg p-2.5 transition-colors ${
                    isActive
                      ? 'bg-white/15 text-white ring-1 ring-[#c9a227]/60'
                      : 'text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="size-[1.125rem] shrink-0" aria-hidden />
                </NavLink>
              )
            })}
          </nav>

          {/* Bottom: settings + avatar */}
          <div className="flex flex-col gap-0.5 border-t border-white/10 px-1.5 py-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setSettingsOpen((o) => !o)}
                title="Settings"
                className={`flex w-full items-center justify-center rounded-lg p-2.5 transition-colors ${
                  settingsOpen ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
                aria-label="Settings"
              >
                <Settings className="size-[1.125rem]" />
              </button>
              {settingsOpen && (
                <div className="bottom-full left-full absolute mb-2 ml-2">
                  <NavModePanel
                    navMode={navMode}
                    onChange={handleNavModeChange}
                    onClose={() => setSettingsOpen(false)}
                  />
                </div>
              )}
            </div>
            <div className="flex justify-center pt-1">
              <div
                className="size-8 shrink-0 rounded-full bg-gradient-to-br from-amber-200 to-amber-700 ring-2 ring-white/30"
                role="img"
                aria-label="User profile"
              />
            </div>
          </div>
        </aside>

        {/* ── Sub-nav panel ───────────────────────────────────────────────── */}
        {hasSubs && (
          <aside className="flex w-52 shrink-0 flex-col overflow-hidden border-r border-white/5 bg-[#15302a]">
            {/* Module name header */}
            <div className="flex h-14 shrink-0 items-center border-b border-white/10 px-4">
              <span
                className="text-sm font-semibold text-white"
                style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
              >
                {activeModule.label}
              </span>
            </div>

            {/* Sub-items */}
            <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Section">
              {activeModule.subs.map((item) => {
                const active = item.match({ pathname: location.pathname, search: location.search })
                return (
                  <NavLink
                    key={item.path + item.label}
                    to={item.path}
                    className={`group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      active
                        ? 'bg-white/10 font-medium text-white'
                        : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                    }`}
                  >
                    {active && (
                      <span className="h-3.5 w-0.5 shrink-0 rounded-full bg-[#c9a227]" aria-hidden />
                    )}
                    {!active && (
                      <span className="h-3.5 w-0.5 shrink-0" aria-hidden />
                    )}
                    {item.label}
                  </NavLink>
                )
              })}
            </nav>
          </aside>
        )}

        {/* ── Content area ────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Slim utility bar */}
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-neutral-200/80 bg-white px-4 md:px-6">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                placeholder="Find anything"
                className="w-full rounded-full border border-neutral-200 bg-neutral-50 py-1.5 pl-9 pr-4 text-sm placeholder:text-neutral-400 focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                className="hidden items-center gap-1.5 rounded-full bg-[#1a3d32] px-3 py-1.5 text-xs font-medium text-white sm:flex"
              >
                <Clock className="size-3.5" />
                Upgrade
              </button>
              <button
                type="button"
                className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100"
                aria-label="Open external"
              >
                <ExternalLink className="size-4" />
              </button>
              <div
                className="size-8 shrink-0 rounded-full bg-gradient-to-br from-amber-200 to-amber-700 ring-2 ring-neutral-200"
                role="img"
                aria-label="User profile"
              />
            </div>
          </header>

          <main className="flex-1 overflow-y-auto bg-[#f5f0e8]">
            <Outlet />
          </main>
        </div>
      </div>
    )
  }

  // ── Top-bar layout (original) ───────────────────────────────────────────────
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
            <span className="hidden h-6 w-px shrink-0 bg-white/25 sm:block" aria-hidden />
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
            {/* Settings gear with layout switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setSettingsOpen((o) => !o)}
                className={`rounded-lg p-2 transition-colors ${settingsOpen ? 'bg-white/15' : 'hover:bg-white/10'}`}
                aria-label="Settings"
              >
                <Settings className="size-5" />
              </button>
              {settingsOpen && (
                <div className="absolute right-0 top-full mt-1">
                  <NavModePanel
                    navMode={navMode}
                    onChange={handleNavModeChange}
                    onClose={() => setSettingsOpen(false)}
                  />
                </div>
              )}
            </div>
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

// Expose sidebar toggle icon for other components if needed
export { PanelLeft }
