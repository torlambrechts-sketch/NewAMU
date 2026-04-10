import { useMemo, useState, type ComponentType } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3,
  Briefcase,
  BookOpen,
  Building2,
  CalendarRange,
  ClipboardList,
  Clock,
  FileText,
  GraduationCap,
  HardHat,
  History,
  HeartPulse,
  Home,
  Kanban,
  LayoutGrid,
  Library,
  Megaphone,
  PanelLeft,
  PanelRight,
  PanelsTopLeft,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Users,
  UsersRound,
  Workflow,
} from 'lucide-react'
import { NotificationTray } from '../notifications/NotificationTray'
import { LanguageSwitcher } from '../LanguageSwitcher'
import { useI18n } from '../../hooks/useI18n'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { PermissionKey } from '../../lib/permissionKeys'
import { WORKPLACE_REPORTING_NAV, workplaceReportingNavMatch } from '../../data/workplaceReportingNav'
import { KlarertLogo } from '../brand/KlarertLogo'

// ─── Sub-item type ────────────────────────────────────────────────────────────

type SubItem = {
  label: string
  path: string
  match: (loc: { pathname: string; search: string }) => boolean
  /** When RBAC is active, hide this sub-link unless the user has the permission. */
  requirePerm?: PermissionKey
  /** If set, user needs at least one of these (overrides requirePerm when both would apply — use one or the other). */
  requirePermAny?: PermissionKey[]
  /** Save horizontal space: show only `Icon` in the nav row; `label` is used for tooltip and accessibility. */
  iconOnly?: boolean
  Icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
}

function visibleSubs(
  subs: SubItem[],
  gateNav: boolean,
  can: (k: PermissionKey) => boolean,
): SubItem[] {
  if (!gateNav) return subs
  return subs.filter((s) => {
    if (s.requirePermAny?.length) return s.requirePermAny.some((k) => can(k))
    if (s.requirePerm) return can(s.requirePerm)
    return true
  })
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
  {
    label: 'Revisjonslogg',
    path: '/tasks?view=audit',
    match: ({ pathname, search }) => pathname === '/tasks' && new URLSearchParams(search).get('view') === 'audit',
    iconOnly: true,
    Icon: History,
  },
]

const internalControlSubs: SubItem[] = [
  {
    label: 'Oversikt',
    path: '/internal-control?tab=overview',
    match: ({ pathname, search }) =>
      pathname === '/internal-control' &&
      (!new URLSearchParams(search).get('tab') || new URLSearchParams(search).get('tab') === 'overview'),
  },
  { label: 'ROS', path: '/internal-control?tab=ros', match: ({ pathname, search }) => pathname === '/internal-control' && new URLSearchParams(search).get('tab') === 'ros' },
  { label: 'Årsgjennomgang', path: '/internal-control?tab=annual', match: ({ pathname, search }) => pathname === '/internal-control' && new URLSearchParams(search).get('tab') === 'annual' },
  {
    label: 'Revisjonslogg',
    path: '/internal-control?tab=audit',
    match: ({ pathname, search }) => pathname === '/internal-control' && new URLSearchParams(search).get('tab') === 'audit',
    iconOnly: true,
    Icon: History,
  },
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
  { label: 'SJA', path: '/hse?tab=sja', match: ({ pathname, search }) => pathname === '/hse' && new URLSearchParams(search).get('tab') === 'sja' },
  { label: 'Opplæring', path: '/hse?tab=training', match: ({ pathname, search }) => pathname === '/hse' && new URLSearchParams(search).get('tab') === 'training' },
  { label: 'Sykefravær', path: '/hse?tab=sickness', match: ({ pathname, search }) => pathname === '/hse' && new URLSearchParams(search).get('tab') === 'sickness' },
  {
    label: 'Revisjonslogg',
    path: '/hse?tab=audit',
    match: ({ pathname, search }) => pathname === '/hse' && new URLSearchParams(search).get('tab') === 'audit',
    iconOnly: true,
    Icon: History,
  },
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
  {
    label: 'Revisjonslogg',
    path: '/org-health?tab=audit',
    match: ({ pathname, search }) => pathname === '/org-health' && new URLSearchParams(search).get('tab') === 'audit',
    iconOnly: true,
    Icon: History,
  },
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
  {
    label: 'Styre og Valg',
    path: '/council?tab=board',
    match: ({ pathname, search }) =>
      pathname === '/council' &&
      (new URLSearchParams(search).get('tab') === 'board' || new URLSearchParams(search).get('tab') === 'election'),
  },
  { label: 'Møter', path: '/council?tab=meetings', match: ({ pathname, search }) => pathname === '/council' && new URLSearchParams(search).get('tab') === 'meetings' },
  {
    label: 'Krav og vedtak',
    path: '/council?tab=requirements',
    match: ({ pathname, search }) => {
      const t = new URLSearchParams(search).get('tab')
      return (
        pathname === '/council' &&
        (t === 'requirements' || t === 'compliance' || t === 'decisions')
      )
    },
  },
  {
    label: 'Revisjonslogg',
    path: '/council?tab=audit',
    match: ({ pathname, search }) => pathname === '/council' && new URLSearchParams(search).get('tab') === 'audit',
    iconOnly: true,
    Icon: History,
  },
]

const learningSubs: SubItem[] = [
  { label: 'Dashboard', path: '/learning', match: ({ pathname }) => pathname === '/learning' },
  { label: 'Courses', path: '/learning/courses', match: ({ pathname }) => pathname === '/learning/courses' || pathname.startsWith('/learning/courses/') },
  { label: 'Certifications', path: '/learning/certifications', match: ({ pathname }) => pathname === '/learning/certifications' },
  { label: 'Insights', path: '/learning/insights', match: ({ pathname }) => pathname === '/learning/insights' },
  { label: 'Participants', path: '/learning/participants', match: ({ pathname }) => pathname === '/learning/participants' },
  { label: 'Team heatmap', path: '/learning/compliance', match: ({ pathname }) => pathname === '/learning/compliance' },
  { label: 'Paths', path: '/learning/paths', match: ({ pathname }) => pathname === '/learning/paths' },
  { label: 'External training', path: '/learning/external', match: ({ pathname }) => pathname === '/learning/external' },
  { label: 'Settings', path: '/learning/settings', match: ({ pathname }) => pathname === '/learning/settings' },
]

const documentsSubs: SubItem[] = [
  {
    label: 'Hjem',
    path: '/documents',
    match: ({ pathname }) => pathname === '/documents',
  },
  {
    label: 'Samsvarsstatus',
    path: '/documents/compliance',
    match: ({ pathname }) => pathname === '/documents/compliance',
  },
  {
    label: 'Malinnstillinger',
    path: '/documents/templates',
    match: ({ pathname }) => pathname === '/documents/templates',
    requirePerm: 'documents.manage',
  },
]

const workplaceReportingSubs: SubItem[] = WORKPLACE_REPORTING_NAV.map((item) => {
  const base: SubItem = {
    label: item.label,
    path: item.to,
    match: ({ pathname, search }) => workplaceReportingNavMatch(item.to, item.end, pathname, search),
  }
  if (item.requirePermAny?.length) return { ...base, requirePermAny: item.requirePermAny }
  if (item.requirePerm) return { ...base, requirePerm: item.requirePerm }
  return base
})

// ─── Navigation groups ────────────────────────────────────────────────────────
//
// The four groups from the spec. Each module carries its icon, route, sub-items,
// and the group it belongs to. The group label is shown as a section divider in
// the sidebar sub-nav panel and as a header row in the top-bar secondary nav.

type NavGroup = {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
  modules: NavModule[]
}

type NavModule = {
  to: string
  label: string
  end: boolean
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
  subs: SubItem[]
  /** When set and RBAC is active, module is hidden if user lacks this permission. */
  perm?: PermissionKey
}

const navGroups: NavGroup[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    icon: Home,
    modules: [
      { to: '/', label: 'Dashboards', end: true, icon: Home, subs: [], perm: 'module.view.dashboard' },
      { to: '/tasks', label: 'Tasks', end: false, icon: LayoutGrid, subs: tasksSubs, perm: 'module.view.tasks' },
      { to: '/action-board', label: 'Action Board', end: false, icon: Kanban, subs: [], perm: 'module.view.dashboard' },
      { to: '/aarshjul', label: 'Årshjul', end: false, icon: CalendarRange, subs: [], perm: 'module.view.dashboard' },
      { to: '/organisation', label: 'Organisasjon', end: false, icon: Building2, subs: [], perm: 'module.view.dashboard' },
      { to: '/reports', label: 'Rapporter', end: false, icon: BarChart3, subs: [], perm: 'module.view.dashboard' },
      { to: '/workflow', label: 'Arbeidsflyt', end: false, icon: Workflow, subs: [], perm: 'module.view.workflow' },
      { to: '/admin', label: 'Admin', end: true, icon: Shield, subs: [], perm: 'module.view.admin' },
    ],
  },
  {
    id: 'workplace_reporting',
    label: 'Arbeidsplassrapportering',
    icon: Megaphone,
    modules: [
      {
        to: '/workplace-reporting',
        label: 'Oversikt',
        end: true,
        icon: Megaphone,
        subs: workplaceReportingSubs,
        perm: 'module.view.workplace_reporting',
      },
    ],
  },
  {
    id: 'compliance',
    label: 'Compliance',
    icon: ShieldCheck,
    modules: [
      {
        to: '/internal-control',
        label: 'Internkontroll',
        end: false,
        icon: ClipboardList,
        subs: internalControlSubs,
        perm: 'module.view.internal_control',
      },
      { to: '/hse', label: 'HSE / HMS', end: false, icon: HardHat, subs: hseSubs, perm: 'module.view.hse' },
      { to: '/org-health', label: 'Org Health', end: false, icon: HeartPulse, subs: orgHealthSubs, perm: 'module.view.org_health' },
      { to: '/hr', label: 'HR & rettssikkerhet', end: false, icon: Briefcase, subs: [], perm: 'module.view.hr_compliance' },
    ],
  },
  {
    id: 'council',
    label: 'Worker Council',
    icon: UsersRound,
    modules: [
      { to: '/council', label: 'Council Room', end: false, icon: UsersRound, subs: councilSubs, perm: 'module.view.council' },
      { to: '/council?tab=board', label: 'Members', end: false, icon: Users, subs: [], perm: 'module.view.members' },
    ],
  },
  {
    id: 'library',
    label: 'Library',
    icon: Library,
    modules: [
      { to: '/documents', label: 'Documents', end: false, icon: FileText, subs: documentsSubs, perm: 'module.view.dashboard' },
      { to: '/learning', label: 'E-learning', end: true, icon: GraduationCap, subs: learningSubs, perm: 'module.view.learning' },
    ],
  },
]

function filterNavGroups(
  groups: NavGroup[],
  gateNav: boolean,
  can: (k: PermissionKey) => boolean,
): NavGroup[] {
  if (!gateNav) return groups
  return groups
    .map((g) => ({
      ...g,
      modules: g.modules.filter((m) => !m.perm || can(m.perm)),
    }))
    .filter((g) => g.modules.length > 0)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function allModulesFrom(groups: NavGroup[]): NavModule[] {
  return groups.flatMap((g) => g.modules)
}

function activeModuleForPath(modules: NavModule[], pathname: string, search: string): NavModule {
  if (modules.length === 0) {
    return { to: '/', label: 'Dashboards', end: true, icon: Home, subs: [] }
  }
  const hub = modules.find((m) => m.to === '/workplace-reporting')
  if (hub) {
    const sp = new URLSearchParams(search)
    if (pathname === '/workplace-reporting/incidents') return hub
    if (pathname === '/workplace-reporting/dashboard') return hub
    if (pathname === '/org-health' && sp.get('tab') === 'reporting') return hub
    if (pathname === '/tasks' && sp.get('view') === 'whistle') return hub
  }
  // Exact-match first (handles /council?tab=board vs /council)
  for (const mod of modules) {
    if (mod.to.includes('?')) {
      const [p, q] = mod.to.split('?')
      const params = new URLSearchParams(q)
      const searchParams = new URLSearchParams(search)
      if (pathname === p && searchParams.get('tab') === params.get('tab')) return mod
    }
  }
  // Then prefix match
  for (const mod of modules) {
    if (mod.to === '/') continue
    const base = mod.to.split('?')[0]
    if (pathname === base || pathname.startsWith(base + '/') || pathname.startsWith(base + '?')) return mod
  }
  return modules[0]
}

function subNavForPath(modules: NavModule[], pathname: string, search: string): SubItem[] {
  const mod = activeModuleForPath(modules, pathname, search)
  // For Members shortcut, show council subs
  if (mod.to === '/council?tab=board') return councilSubs
  return mod.subs
}

// ─── Nav mode persistence ─────────────────────────────────────────────────────

type NavMode = 'topbar' | 'sidebar'

function loadNavMode(): NavMode {
  try {
    const v = localStorage.getItem('atics-nav-mode')
    if (v === 'sidebar' || v === 'topbar') return v
  } catch { /* ignore */ }
  return 'sidebar'
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
                ? 'border-[color:var(--ui-accent)] bg-[color-mix(in_srgb,var(--ui-accent)_10%,transparent)] text-[color:var(--ui-accent)]'
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
                ? 'border-[color:var(--ui-accent)] bg-[color-mix(in_srgb,var(--ui-accent)_10%,transparent)] text-[color:var(--ui-accent)]'
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
  const { supabaseConfigured, can, permissionKeys, user, profile, signOut } = useOrgSetupContext()
  const { t } = useI18n()
  const gateNav = supabaseConfigured && permissionKeys.size > 0
  const visibleGroups = useMemo(
    () => filterNavGroups(navGroups, gateNav, can),
    [gateNav, can],
  )
  const visibleModules = useMemo(() => allModulesFrom(visibleGroups), [visibleGroups])

  const [navMode, setNavMode] = useState<NavMode>(loadNavMode)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [subNavCollapsed, setSubNavCollapsed] = useState(false)

  function handleNavModeChange(mode: NavMode) {
    setNavMode(mode)
    saveNavMode(mode)
    setSettingsOpen(false)
    if (mode === 'sidebar') setSubNavCollapsed(false)
  }

  // ── Sidebar layout ──────────────────────────────────────────────────────────
  if (navMode === 'sidebar') {
    const activeModule = activeModuleForPath(visibleModules, location.pathname, location.search)
    const activeGroup = visibleGroups.find((g) => g.modules.some((m) => m.to === activeModule.to))

    return (
      <div className="flex h-screen overflow-hidden">

        {/* ── Rail 1: Group icons ──────────────────────────────────────────── */}
        <aside className="flex w-[3.75rem] shrink-0 flex-col bg-[var(--ui-nav-rail)]">
          {/* Logo */}
          <div className="flex h-14 shrink-0 items-center justify-center border-b border-white/10">
            <NavLink
              to="/"
              aria-label={t('shell.homeAria')}
              className="flex items-center justify-center rounded-lg p-1.5 hover:bg-white/10"
            >
              <KlarertLogo size={22} markOnly variant="onDark" />
            </NavLink>
          </div>

          {/* One icon per group */}
          <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-2 py-4" aria-label="Primary">
            {visibleGroups.map((group) => {
              const GroupIcon = group.icon
              const isActive = activeGroup?.id === group.id
              return (
                <NavLink
                  key={group.id}
                  to={group.modules[0].to}
                  end={false}
                  title={group.label}
                  className={`flex items-center justify-center rounded-lg p-3 transition-colors ${
                    isActive
                      ? 'bg-white/15 text-white ring-1 ring-[#c9a227]/60'
                      : 'text-white/55 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <GroupIcon className="size-[1.125rem] shrink-0" aria-hidden />
                </NavLink>
              )
            })}
          </nav>

          {/* Section rail toggle — always on this column (mid rail can be absent before activeGroup resolves) */}
          <div className="border-t border-white/10 px-2 py-2">
            <button
              type="button"
              onClick={() => setSubNavCollapsed((c) => !c)}
              className={`flex w-full items-center justify-center rounded-lg p-3 transition-colors ${
                subNavCollapsed ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
              aria-label={subNavCollapsed ? t('shell.expandSectionNav') : t('shell.collapseSectionNav')}
              title={subNavCollapsed ? t('shell.expandSectionNav') : t('shell.collapseSectionNav')}
            >
              {subNavCollapsed ? (
                <PanelRight className="size-[1.125rem] shrink-0" aria-hidden />
              ) : (
                <PanelLeft className="size-[1.125rem] shrink-0" aria-hidden />
              )}
            </button>
          </div>

          {/* Bottom: layout switcher */}
          <div className="flex flex-col gap-1.5 border-t border-white/10 px-2 py-4">
            <div className="relative">
              <button
                type="button"
                onClick={() => setSettingsOpen((o) => !o)}
                title="Layout"
                className={`flex w-full items-center justify-center rounded-lg p-3 transition-colors ${
                  settingsOpen ? 'bg-white/15 text-white' : 'text-white/55 hover:bg-white/10 hover:text-white'
                }`}
                aria-label="Navigation layout"
              >
                <PanelsTopLeft className="size-[1.125rem]" />
              </button>
              {settingsOpen && (
                <div className="absolute bottom-full left-full mb-2 ml-2">
                  <NavModePanel navMode={navMode} onChange={handleNavModeChange} onClose={() => setSettingsOpen(false)} />
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ── Rail 2: Modules + sub-items for active group ─────────────────── */}
        {!subNavCollapsed && activeGroup && (
          <aside className="flex w-52 shrink-0 flex-col overflow-hidden bg-[var(--ui-nav-rail-mid)]">
            {/* Group name header — collapse/expand lives on left icon rail only */}
            <div className="flex h-14 shrink-0 items-center border-b border-white/10 px-4">
              <span
                className="min-w-0 truncate text-sm font-semibold text-white"
                style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
              >
                {activeGroup.label}
              </span>
            </div>

            {/* Module list — each module can expand to show its sub-items */}
            <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Section">
              {activeGroup.modules.map((mod) => {
                const ModIcon = mod.icon
                const isActiveMod = activeModule.to === mod.to
                const modSubs = visibleSubs(mod.subs, gateNav, can)
                const hasModSubs = modSubs.length > 0

                return (
                  <div key={mod.to}>
                    {/* Module row */}
                    <NavLink
                      to={mod.to}
                      end={mod.end}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                        isActiveMod
                          ? 'bg-white/10 text-white'
                          : 'text-white/65 hover:bg-white/5 hover:text-white/90'
                      }`}
                    >
                      <ModIcon className="size-4 shrink-0 opacity-80" aria-hidden />
                      <span className="flex-1">{mod.label}</span>
                      {isActiveMod && hasModSubs && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#c9a227]" aria-hidden />
                      )}
                    </NavLink>

                    {/* Sub-items — expanded inline when this module is active */}
                    {isActiveMod && hasModSubs && (
                      <div className="mb-1 ml-4 mt-0.5 border-l border-white/10 pl-3">
                        {modSubs.map((item) => {
                          const active = item.match({ pathname: location.pathname, search: location.search })
                          const SubIcon = item.Icon
                          const iconOnly = item.iconOnly && SubIcon
                          return (
                            <NavLink
                              key={item.path + item.label}
                              to={item.path}
                              title={item.label}
                              aria-label={iconOnly ? item.label : undefined}
                              className={`flex items-center gap-2 rounded-md text-xs transition-colors ${
                                active
                                  ? 'font-semibold text-white'
                                  : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                              } ${
                                iconOnly
                                  ? 'size-8 shrink-0 justify-center p-0'
                                  : 'px-2 py-1.5'
                              }`}
                            >
                              {!iconOnly && active && (
                                <span className="h-3 w-0.5 shrink-0 rounded-full bg-[#c9a227]" aria-hidden />
                              )}
                              {!iconOnly && !active && <span className="h-3 w-0.5 shrink-0" aria-hidden />}
                              {iconOnly ? (
                                <SubIcon className="size-4 shrink-0 opacity-90" aria-hidden />
                              ) : (
                                item.label
                              )}
                            </NavLink>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>
          </aside>
        )}

        {/* ── Content area ─────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Utility bar — page background colour */}
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-neutral-300/40 bg-[var(--ui-surface)] px-4 md:px-5">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                placeholder="Find anything"
                className="w-full rounded-full border border-neutral-300/70 bg-white/70 py-1.5 pl-9 pr-4 text-sm placeholder:text-neutral-400 focus:border-[color:var(--ui-accent)] focus:outline-none focus:ring-1 focus:ring-[color:var(--ui-accent)]"
              />
            </div>
            <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
              <LanguageSwitcher className="[&_span]:text-neutral-600 [&_select]:max-w-[7rem] [&_select]:border-neutral-300 [&_select]:bg-white [&_select]:text-neutral-900" />
              {supabaseConfigured ? (
                <>
                  {user ? (
                    <span
                      className="hidden max-w-[100px] truncate text-xs text-neutral-600 sm:inline"
                      title={profile?.email ?? ''}
                    >
                      {profile?.display_name ?? profile?.email ?? 'Bruker'}
                    </span>
                  ) : null}
                  {user ? (
                    <button
                      type="button"
                      onClick={() => void signOut()}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-black/5"
                    >
                      {t('shell.logOut')}
                    </button>
                  ) : (
                    <a href="/login" className="rounded-lg px-2 py-1 text-xs font-medium text-[color:var(--ui-accent)] hover:underline">
                      {t('shell.logIn')}
                    </a>
                  )}
                  <NotificationTray variant="sidebar" />
                  <NavLink
                    to="/profile"
                    className={({ isActive }) =>
                      `rounded-lg p-1.5 text-neutral-500 hover:bg-black/5 ${isActive ? 'bg-black/5 ring-1 ring-[#c9a227]/40' : ''}`
                    }
                    aria-label={t('shell.settingsAria')}
                  >
                    <Settings className="size-4" />
                  </NavLink>
                </>
              ) : null}
            </div>
          </header>

          <main className="flex-1 overflow-y-auto bg-[var(--ui-surface)]">
            <Outlet />
          </main>
        </div>
      </div>
    )
  }

  // ── Top-bar layout ──────────────────────────────────────────────────────────
  const activeModule = activeModuleForPath(visibleModules, location.pathname, location.search)
  const activeGroup = visibleGroups.find((g) => g.modules.some((m) => m.to === activeModule.to))
  const subItems = visibleSubs(
    subNavForPath(visibleModules, location.pathname, location.search),
    gateNav,
    can,
  )

  return (
    <div className="min-h-screen bg-[var(--ui-surface)]">
      <header className="bg-[var(--ui-nav-rail)] text-white">

        {/* ── Row 1: logo · group tabs · utilities ───────────────────────── */}
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 md:px-8">
          {/* Logo */}
          <NavLink to="/" className="flex shrink-0 items-center gap-2" aria-label={t('shell.homeAria')}>
            <KlarertLogo size={28} variant="onDark" />
          </NavLink>

          {/* Group tabs — one per group, navigates to first module in group */}
          <nav className="flex flex-1 items-center justify-center gap-1 overflow-x-auto" aria-label="Primary">
            {visibleGroups.map((group) => {
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
            <button type="button" className="hidden items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[color:var(--ui-accent)] sm:flex">
              <Clock className="size-3.5" />
              {t('shell.upgrade')}
            </button>
            <LanguageSwitcher />
            <div className="relative">
              <button
                type="button"
                onClick={() => setSettingsOpen((o) => !o)}
                className={`rounded-lg p-2 transition-colors ${settingsOpen ? 'bg-white/15' : 'hover:bg-white/10'}`}
                aria-label="Navigation layout"
                title="Layout"
              >
                <PanelsTopLeft className="size-5" />
              </button>
              {settingsOpen && (
                <div className="absolute right-0 top-full mt-1">
                  <NavModePanel navMode={navMode} onChange={handleNavModeChange} onClose={() => setSettingsOpen(false)} />
                </div>
              )}
            </div>
            {supabaseConfigured && user ? (
              <>
                <span className="hidden max-w-[120px] truncate text-xs text-white/80 lg:inline" title={profile?.email ?? ''}>
                  {profile?.display_name ?? profile?.email ?? 'Bruker'}
                </span>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-white/90 hover:bg-white/10"
                >
                  {t('shell.logOut')}
                </button>
              </>
            ) : supabaseConfigured ? (
              <a href="/login" className="rounded-lg px-2 py-1 text-xs font-medium text-[#c9a227] hover:underline">
                {t('shell.logIn')}
              </a>
            ) : null}
            <NotificationTray variant="topbar" />
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `rounded-lg p-2 hover:bg-white/10 ${isActive ? 'bg-white/10 ring-1 ring-[#c9a227]/50' : ''}`
              }
              aria-label={t('shell.settingsAria')}
            >
              <Settings className="size-5" />
            </NavLink>
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
          <div className="border-t border-white/[0.07] bg-[var(--ui-nav-sub)]">
            <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-2 md:px-8">
              <nav className="flex min-w-0 flex-1 flex-wrap gap-x-1 gap-y-1" aria-label="Section">
                {subItems.map((item) => {
                  const active = item.match({ pathname: location.pathname, search: location.search })
                  const SubIcon = item.Icon
                  const iconOnly = item.iconOnly && SubIcon
                  return (
                    <NavLink
                      key={item.path + item.label}
                      to={item.path}
                      title={item.label}
                      aria-label={iconOnly ? item.label : undefined}
                      className={`whitespace-nowrap rounded-md text-sm transition-colors ${
                        active
                          ? 'bg-white/10 font-medium text-white'
                          : 'text-white/55 hover:bg-white/5 hover:text-white/90'
                      } ${
                        iconOnly
                          ? 'inline-flex size-8 shrink-0 items-center justify-center p-0'
                          : 'px-3 py-1'
                      }`}
                    >
                      {iconOnly ? (
                        <SubIcon className="size-[1.125rem] shrink-0 opacity-90" aria-hidden />
                      ) : (
                        item.label
                      )}
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
          <div className="border-t border-white/[0.07] bg-[var(--ui-nav-sub)]">
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
