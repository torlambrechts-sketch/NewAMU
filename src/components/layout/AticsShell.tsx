import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BookOpen,
  ClipboardList,
  Clock,
  ExternalLink,
  FileText,
  GraduationCap,
  HardHat,
  HeartPulse,
  Home,
  LayoutGrid,
  PanelLeft,
  Search,
  Settings,
  Star,
  Users,
  UsersRound,
  Workflow,
} from 'lucide-react'

// ─── Sub-item type ────────────────────────────────────────────────────────────

type SubItem = {
  label: string
  path: string
  match: (loc: { pathname: string; search: string }) => boolean
}

// ─── Sub-item lists (all paths/labels unchanged) ──────────────────────────────

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

const councilSubs: SubItem[] = [
  {
    label: 'Oversikt',
    path: '/council?tab=overview',
    match: ({ pathname, search }) =>
      pathname === '/council' &&
      (!new URLSearchParams(search).get('tab') || new URLSearchParams(search).get('tab') === 'overview'),
  },
  { label: 'Styre og valg', path: '/council?tab=board', match: ({ pathname, search }) => pathname === '/council' && new URLSearchParams(search).get('tab') === 'board' },
  { label: 'Valg representanter', path: '/council?tab=election', match: ({ pathname, search }) => pathname === '/council' && new URLSearchParams(search).get('tab') === 'election' },
  { label: 'Krav og opplæring', path: '/council?tab=requirements', match: ({ pathname, search }) => pathname === '/council' && new URLSearchParams(search).get('tab') === 'requirements' },
  { label: 'Møter og årshjul', path: '/council?tab=meetings', match: ({ pathname, search }) => pathname === '/council' && new URLSearchParams(search).get('tab') === 'meetings' },
  { label: 'Møteforberedelse', path: '/council?tab=preparation', match: ({ pathname, search }) => pathname === '/council' && new URLSearchParams(search).get('tab') === 'preparation' },
  { label: 'Arbeidsrett og sjekkliste', path: '/council?tab=compliance', match: ({ pathname, search }) => pathname === '/council' && new URLSearchParams(search).get('tab') === 'compliance' },
]

const learningSubs: SubItem[] = [
  { label: 'Dashboard', path: '/learning', match: ({ pathname }) => pathname === '/learning' },
  { label: 'Courses', path: '/learning/courses', match: ({ pathname }) => pathname === '/learning/courses' || pathname.startsWith('/learning/courses/') },
  { label: 'Certifications', path: '/learning/certifications', match: ({ pathname }) => pathname === '/learning/certifications' },
  { label: 'Insights', path: '/learning/insights', match: ({ pathname }) => pathname === '/learning/insights' },
  { label: 'Participants', path: '/learning/participants', match: ({ pathname }) => pathname === '/learning/participants' },
  { label: 'Settings', path: '/learning/settings', match: ({ pathname }) => pathname === '/learning/settings' },
]

// ─── Navigation groups ────────────────────────────────────────────────────────
//
// The four groups from the spec. Each module carries its icon, route, sub-items,
// and the group it belongs to. The group label is shown as a section divider in
// the sidebar sub-nav panel and as a header row in the top-bar secondary nav.

type NavGroup = {
  id: string
  label: string
  modules: NavModule[]
}

type NavModule = {
  to: string
  label: string
  end: boolean
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
  subs: SubItem[]
}

const navGroups: NavGroup[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    modules: [
      { to: '/', label: 'Dashboards', end: true, icon: Home, subs: [] },
      { to: '/tasks', label: 'Tasks', end: false, icon: LayoutGrid, subs: tasksSubs },
    ],
  },
  {
    id: 'compliance',
    label: 'Compliance',
    modules: [
      { to: '/internal-control', label: 'Internkontroll', end: false, icon: ClipboardList, subs: internalControlSubs },
      { to: '/hse', label: 'HSE / HMS', end: false, icon: HardHat, subs: hseSubs },
      { to: '/org-health', label: 'Org Health', end: false, icon: HeartPulse, subs: orgHealthSubs },
      { to: '/prosesser', label: 'Prosesser', end: false, icon: Workflow, subs: [] },
    ],
  },
  {
    id: 'council',
    label: 'Worker Council',
    modules: [
      { to: '/council', label: 'Council Room', end: false, icon: UsersRound, subs: councilSubs },
      { to: '/council?tab=election', label: 'Members', end: false, icon: Users, subs: [] },
    ],
  },
  {
    id: 'library',
    label: 'Library',
    modules: [
      { to: '/documents', label: 'Documents', end: false, icon: FileText, subs: [] },
      { to: '/learning', label: 'E-learning', end: true, icon: GraduationCap, subs: learningSubs },
    ],
  },
]

// Flat list for helpers that need to iterate all modules
const allModules: NavModule[] = navGroups.flatMap((g) => g.modules)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function activeModuleForPath(pathname: string, search: string): NavModule {
  // Exact-match first (handles /council?tab=election vs /council)
  for (const mod of allModules) {
    if (mod.to.includes('?')) {
      const [p, q] = mod.to.split('?')
      const params = new URLSearchParams(q)
      const searchParams = new URLSearchParams(search)
      if (pathname === p && searchParams.get('tab') === params.get('tab')) return mod
    }
  }
  // Then prefix match
  for (const mod of allModules) {
    if (mod.to === '/') continue
    const base = mod.to.split('?')[0]
    if (pathname === base || pathname.startsWith(base + '/')) return mod
  }
  return allModules[0]
}

function subNavForPath(pathname: string, search: string): SubItem[] {
  const mod = activeModuleForPath(pathname, search)
  // For Members shortcut, show council subs
  if (mod.to === '/council?tab=election') return councilSubs
  return mod.subs
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

// ─── Settings / layout-switcher panel ────────────────────────────────────────

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
  const [subNavCollapsed, setSubNavCollapsed] = useState(false)

  function handleNavModeChange(mode: NavMode) {
    setNavMode(mode)
    saveNavMode(mode)
    setSettingsOpen(false)
  }

  // ── Sidebar layout ──────────────────────────────────────────────────────────
  if (navMode === 'sidebar') {
    const activeModule = activeModuleForPath(location.pathname, location.search)
    const activeGroup = navGroups.find((g) => g.modules.some((m) => m.to === activeModule.to))
    const subItems = subNavForPath(location.pathname, location.search)
    const hasSubs = subItems.length > 0

    return (
      <div className="flex h-screen overflow-hidden">
        {/* ── Icon rail — always visible ───────────────────────────────────── */}
        <aside className="flex w-[4.5rem] shrink-0 flex-col bg-[#1a3d32]">
          {/* Logo */}
          <div className="flex h-14 shrink-0 items-center justify-center border-b border-white/10">
            <NavLink to="/" aria-label="Home" className="flex items-center justify-center rounded-lg p-1.5 hover:bg-white/10">
              <Star className="size-5 fill-white text-white" strokeWidth={1.2} />
            </NavLink>
          </div>

          {/* Grouped module icons with subtle dividers between groups */}
          <nav className="flex flex-1 flex-col overflow-y-auto px-2 py-3" aria-label="Primary">
            {navGroups.map((group, gi) => (
              <div key={group.id}>
                {gi > 0 && (
                  <div className="mx-auto my-2 h-px w-8 bg-white/10" aria-hidden />
                )}
                <div className="flex flex-col gap-1.5">
                  {group.modules.map((mod) => {
                    const Icon = mod.icon
                    const isActive = activeModule.to === mod.to
                    return (
                      <NavLink
                        key={mod.to}
                        to={mod.to}
                        end={mod.end}
                        title={`${group.label} — ${mod.label}`}
                        className={`flex items-center justify-center rounded-lg p-3 transition-colors ${
                          isActive
                            ? 'bg-white/15 text-white ring-1 ring-[#c9a227]/60'
                            : 'text-white/60 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <Icon className="size-[1.125rem] shrink-0" aria-hidden />
                      </NavLink>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Bottom: settings + avatar */}
          <div className="flex flex-col gap-1.5 border-t border-white/10 px-2 py-4">
            <div className="relative">
              <button
                type="button"
                onClick={() => setSettingsOpen((o) => !o)}
                title="Settings"
                className={`flex w-full items-center justify-center rounded-lg p-3 transition-colors ${
                  settingsOpen ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
                aria-label="Settings"
              >
                <Settings className="size-[1.125rem]" />
              </button>
              {settingsOpen && (
                <div className="absolute bottom-full left-full mb-2 ml-2">
                  <NavModePanel navMode={navMode} onChange={handleNavModeChange} onClose={() => setSettingsOpen(false)} />
                </div>
              )}
            </div>
            <div className="flex justify-center">
              <div className="size-8 shrink-0 rounded-full bg-gradient-to-br from-amber-200 to-amber-700 ring-2 ring-white/30" role="img" aria-label="User profile" />
            </div>
          </div>
        </aside>

        {/* ── Sub-nav panel ────────────────────────────────────────────────── */}
        {hasSubs && !subNavCollapsed && (
          <aside className="flex w-52 shrink-0 flex-col overflow-hidden border-r border-white/5 bg-[#15302a]">
            {/* Group + module header */}
            <div className="flex h-14 shrink-0 flex-col justify-center border-b border-white/10 px-4">
              {activeGroup && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  {activeGroup.label}
                </span>
              )}
              <span
                className="text-sm font-semibold leading-tight text-white"
                style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
              >
                {activeModule.label}
              </span>
            </div>

            {/* Sub-items */}
            <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Section">
              {subItems.map((item) => {
                const active = item.match({ pathname: location.pathname, search: location.search })
                return (
                  <NavLink
                    key={item.path + item.label}
                    to={item.path}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      active
                        ? 'bg-white/10 font-medium text-white'
                        : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                    }`}
                  >
                    <span
                      className={`h-3.5 w-0.5 shrink-0 rounded-full transition-colors ${
                        active ? 'bg-[#c9a227]' : 'bg-transparent'
                      }`}
                      aria-hidden
                    />
                    {item.label}
                  </NavLink>
                )
              })}
            </nav>
          </aside>
        )}

        {/* ── Content area ─────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Utility bar — same colour as page */}
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-neutral-300/40 bg-[#f5f0e8] px-4 md:px-5">
            <button
              type="button"
              onClick={() => setSubNavCollapsed((c) => !c)}
              className="rounded-lg p-1.5 text-neutral-500 hover:bg-black/5 hover:text-neutral-800"
              aria-label={subNavCollapsed ? 'Expand sub-navigation' : 'Collapse sub-navigation'}
              title={subNavCollapsed ? 'Expand sub-navigation' : 'Collapse sub-navigation'}
            >
              <PanelLeft className="size-4" />
            </button>
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                placeholder="Find anything"
                className="w-full rounded-full border border-neutral-300/70 bg-white/70 py-1.5 pl-9 pr-4 text-sm placeholder:text-neutral-400 focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" className="hidden items-center gap-1.5 rounded-full bg-[#1a3d32] px-3 py-1.5 text-xs font-medium text-white sm:flex">
                <Clock className="size-3.5" />
                Upgrade
              </button>
              <button type="button" className="rounded-lg p-1.5 text-neutral-500 hover:bg-black/5" aria-label="Open external">
                <ExternalLink className="size-4" />
              </button>
              <div className="size-8 shrink-0 rounded-full bg-gradient-to-br from-amber-200 to-amber-700 ring-2 ring-neutral-300/50" role="img" aria-label="User profile" />
            </div>
          </header>

          <main className="flex-1 overflow-y-auto bg-[#f5f0e8]">
            <Outlet />
          </main>
        </div>
      </div>
    )
  }

  // ── Top-bar layout ──────────────────────────────────────────────────────────
  const activeModule = activeModuleForPath(location.pathname, location.search)
  const activeGroup  = navGroups.find((g) => g.modules.some((m) => m.to === activeModule.to))
  const subItems     = subNavForPath(location.pathname, location.search)

  return (
    <div className="min-h-screen bg-[#f5f0e8]">
      <header className="bg-[#1a3d32] text-white">

        {/* ── Row 1: logo · group tabs · utilities ───────────────────────── */}
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 md:px-8">
          {/* Logo */}
          <NavLink to="/" className="flex shrink-0 items-center gap-2" aria-label="Home">
            <Star className="size-7 shrink-0 fill-white text-white" strokeWidth={1.2} />
            <span
              className="font-serif text-xl tracking-wide text-[#c9a227] md:text-2xl"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
            >
              atics
            </span>
          </NavLink>

          {/* Group tabs — one per group, navigates to first module in group */}
          <nav className="flex flex-1 items-center justify-center gap-1 overflow-x-auto" aria-label="Primary">
            {navGroups.map((group) => {
              const isActiveGroup = activeGroup?.id === group.id
              return (
                <NavLink
                  key={group.id}
                  to={group.modules[0].to}
                  end={false}
                  className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                    isActiveGroup
                      ? 'bg-white/15 text-white ring-1 ring-[#c9a227]/70'
                      : 'text-white/75 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {group.label}
                </NavLink>
              )
            })}
          </nav>

          {/* Utilities */}
          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            <button type="button" className="hidden items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#1a3d32] sm:flex">
              <Clock className="size-3.5" />
              Upgrade
            </button>
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
                  <NavModePanel navMode={navMode} onChange={handleNavModeChange} onClose={() => setSettingsOpen(false)} />
                </div>
              )}
            </div>
            <button type="button" className="rounded-lg p-2 hover:bg-white/10" aria-label="Open external">
              <ExternalLink className="size-5" />
            </button>
            <div className="size-9 shrink-0 rounded-full bg-gradient-to-br from-amber-200 to-amber-700 ring-2 ring-white/30" role="img" aria-label="User profile" />
          </div>
        </div>

        {/* ── Row 2: module tabs for the active group ─────────────────────── */}
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-[1400px] items-center gap-1 overflow-x-auto px-4 py-2 md:px-8">
            {activeGroup ? (
              activeGroup.modules.map((mod) => {
                const Icon = mod.icon
                const isActiveMod = activeModule.to === mod.to
                return (
                  <NavLink
                    key={mod.to}
                    to={mod.to}
                    end={mod.end}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActiveMod
                        ? 'bg-white/10 text-white'
                        : 'text-white/65 hover:bg-white/5 hover:text-white/90'
                    }`}
                  >
                    <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden />
                    {mod.label}
                  </NavLink>
                )
              })
            ) : (
              <span className="text-sm text-white/40">Velg en gruppe over</span>
            )}
          </div>
        </div>

        {/* ── Row 3: sub-item tabs for the active module + search ─────────── */}
        {subItems.length > 0 && (
          <div className="border-t border-white/[0.07] bg-[#132e25]">
            <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-2 md:px-8">
              <nav className="flex min-w-0 flex-1 flex-wrap gap-x-1 gap-y-1" aria-label="Section">
                {subItems.map((item) => {
                  const active = item.match({ pathname: location.pathname, search: location.search })
                  return (
                    <NavLink
                      key={item.path + item.label}
                      to={item.path}
                      className={`whitespace-nowrap rounded-md px-3 py-1 text-sm transition-colors ${
                        active
                          ? 'bg-white/10 font-medium text-white'
                          : 'text-white/55 hover:bg-white/5 hover:text-white/90'
                      }`}
                    >
                      {item.label}
                    </NavLink>
                  )
                })}
              </nav>
              <div className="relative min-w-[180px] max-w-xs flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-white/40" />
                <input
                  type="search"
                  placeholder="Find anything"
                  className="w-full rounded-full border border-white/15 bg-white/8 py-1.5 pl-9 pr-4 text-sm text-white placeholder:text-white/35 focus:border-[#c9a227] focus:outline-none focus:ring-1 focus:ring-[#c9a227]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Search bar on row 2 when there are no sub-items */}
        {subItems.length === 0 && (
          <div className="border-t border-white/[0.07] bg-[#132e25]">
            <div className="mx-auto flex max-w-[1400px] items-center justify-end px-4 py-2 md:px-8">
              <div className="relative min-w-[180px] max-w-xs flex-1 sm:flex-none">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-white/40" />
                <input
                  type="search"
                  placeholder="Find anything"
                  className="w-full rounded-full border border-white/15 bg-white/8 py-1.5 pl-9 pr-4 text-sm text-white placeholder:text-white/35 focus:border-[#c9a227] focus:outline-none focus:ring-1 focus:ring-[#c9a227]"
                />
              </div>
            </div>
          </div>
        )}

      </header>

      <main>
        <Outlet />
      </main>
    </div>
  )
}

export { BookOpen, PanelLeft }
