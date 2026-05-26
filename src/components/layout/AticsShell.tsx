import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, Home, PanelLeft, PanelRight, Search } from 'lucide-react'
import { NotificationTray } from '../notifications/NotificationTray'
import { SurveyPendingInvitesBanner } from '../../../modules/survey/SurveyPendingInvitesBanner'
import { useT } from '../../hooks/useT'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { PermissionKey } from '../../lib/permissionKeys'
import { Button } from '../ui/Button'
import { KlarertLogo } from '../brand/KlarertLogo'
import {
  ShellComplianceIndicator,
  ShellProfileMenuButton,
  ShellQuickCreateMenu,
} from './ShellHeaderWidgets'
import { RegulationFilterMenu } from './RegulationFilterMenu'
import { useRegulationFilter } from '../../context/RegulationFilterContext'
import { useComplianceNav } from '../../../modules/compliance/useComplianceNav'
import { useSurveyNav } from '../../../modules/survey/useSurveyNav'
import { useLearningNav } from '../../hooks/useLearningNav'
import { useDocumentNav } from '../../hooks/useDocumentNav'
import { useRegistersNav } from '../../hooks/useRegistersNav'
import { useTaskNav } from '../../../modules/tasks/useTaskNav'
import { useMeetingsNav } from '../../../modules/meetings/useMeetingsNav'
import { useAlertsNav } from '../../../modules/alerts/useAlertsNav'
import { useGovOutboxPendingCount } from '../../hooks/useGovOutboxPendingCount'
import { useAmuAgendaBacklogCount } from '../../hooks/useAmuAgendaBacklogCount'
import { useCertExpiryWarningCount } from '../../hooks/useCertExpiryWarningCount'
import { usePartnerMembership } from '../../hooks/usePartnerMembership'
import { useConsultantClock } from '../../hooks/useConsultantClock'
import { usePlatformAdmin } from '../../hooks/usePlatformAdmin'
import { OrgSwitcher } from './OrgSwitcher'
import type { NavMode } from './aticsNavMode'
import {
  autoRail2State,
  cycleRail2State,
  loadRail2Pref,
  rail2StateLabel,
  saveRail2Pref,
  type Rail2Preference,
  type Rail2State,
} from './aticsRailState'
import type { NavGroup, NavModule, NavSection } from './aticsNavTypes'
import { buildNavSections } from './aticsNavBuilder'
import { CommandPalette } from './CommandPalette'
import { flattenNavToEntries } from './commandPaletteEntries'
import { loadRecentPaths, pushRecentPath } from './recentPaths'

// Nav builder lives in `aticsNavBuilder.ts`; types in `aticsNavTypes.ts`;
// permission gates in `aticsNavPerms.ts`. Anything below is shell
// composition + render only.

function filterNavGroups(
  groups: NavGroup[],
  gateNav: boolean,
  can: (k: PermissionKey) => boolean,
  disabledModules: Set<string>,
  hiddenForUser: Set<string>,
): NavGroup[] {
  return groups
    .map((g) => ({
      ...g,
      modules: g.modules.filter((m) => {
        if (m.moduleSlug && disabledModules.has(m.moduleSlug)) return false
        if (m.moduleSlug && hiddenForUser.has(m.moduleSlug)) return false
        if (gateNav && m.permAny?.length && !m.permAny.some((k) => can(k))) return false
        if (gateNav && m.perm && !m.permAny?.length && !can(m.perm)) return false
        return true
      }),
    }))
    .filter((g) => g.modules.length > 0)
}

function filterNavSections(
  sections: NavSection[],
  gateNav: boolean,
  can: (k: PermissionKey) => boolean,
  disabledModules: Set<string>,
  hiddenForUser: Set<string>,
): NavSection[] {
  return sections
    .map((s) => ({
      ...s,
      groups: filterNavGroups(s.groups, gateNav, can, disabledModules, hiddenForUser),
    }))
    .filter((s) => s.groups.length > 0)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function allModulesFrom(groups: NavGroup[]): NavModule[] {
  return groups.flatMap((g) => g.modules)
}

function allGroupsFromSections(sections: NavSection[]): NavGroup[] {
  return sections.flatMap((s) => s.groups)
}

function activeModuleForPath(modules: NavModule[], pathname: string, search: string): NavModule {
  if (modules.length === 0) {
    return { to: '/', label: 'Dashboards', end: true, icon: Home, subs: [] }
  }
  if (pathname === '/compliance') {
    const c = modules.find((m) => m.to === '/compliance')
    if (c) return c
  }
  if (pathname === '/organisation/admin' || pathname.startsWith('/organisation/admin/')) {
    const adminMod = modules.find((m) => m.to === '/organisation/admin')
    if (adminMod) return adminMod
  }
  // Admin-group sub-paths whose URL prefix doesn't line up with the
  // synthetic Admin module's `.to`. Without this, the prefix loop below
  // falls through to `modules[0]` (Oversikt) and the wrong group lights
  // up in the sidebar when the user is on `/admin/settings/*`,
  // `/workflow/*`, etc.
  if (
    pathname === '/admin/settings' ||
    pathname.startsWith('/admin/settings/') ||
    pathname === '/admin/templates' ||
    pathname.startsWith('/admin/templates/') ||
    pathname === '/admin/integrasjoner-staten' ||
    pathname.startsWith('/admin/integrasjoner-staten/') ||
    pathname === '/admin/integrations' ||
    pathname.startsWith('/admin/integrations/') ||
    pathname === '/workflow' ||
    pathname.startsWith('/workflow/')
  ) {
    const adminMod =
      modules.find((m) => m.to === '/organisation') ??
      modules.find((m) => m.to === '/organisation/admin')
    if (adminMod) return adminMod
  }
  if (pathname === '/meetings' || pathname.startsWith('/meetings/')) {
    const mtg = modules.find((m) => m.to === '/meetings')
    if (mtg) return mtg
  }
  // /iso/*, /overview/regelverk and /controls/* are deep-dive surfaces
  // for framework and Tier-2 control work. With Rammeverk & gap and the
  // /controls hub folded into Internkontroll, highlight the
  // Internkontroll entry when the user is on one of these so the
  // section context stays coherent.
  if (
    pathname.startsWith('/iso/') ||
    pathname === '/iso' ||
    pathname.startsWith('/overview/regelverk') ||
    pathname === '/controls' ||
    pathname.startsWith('/controls/')
  ) {
    const ik = modules.find((m) => m.to === '/internkontroll')
    if (ik) return ik
  }
  // Tilsynssaker promoted out of admin — keep the group light up when
  // the user is on /admin/tilsynsbrev/*.
  if (pathname === '/admin/tilsynsbrev' || pathname.startsWith('/admin/tilsynsbrev/')) {
    const ts = modules.find((m) => m.to === '/admin/tilsynsbrev')
    if (ts) return ts
  }
  // Internkontroll umbrella — /internkontroll + /overview/internkontroll/*
  // all light up the same Styringssystem group entry.
  if (
    pathname === '/internkontroll' ||
    pathname.startsWith('/internkontroll/') ||
    pathname === '/overview/internkontroll' ||
    pathname.startsWith('/overview/internkontroll/')
  ) {
    const ik = modules.find((m) => m.to === '/internkontroll')
    if (ik) return ik
  }
  // Admin umbrella — every /admin/settings/* tab maps to the single
  // Administrasjon nav entry; the page itself handles in-page tabs.
  if (pathname === '/admin/settings/org' || pathname.startsWith('/admin/settings/')) {
    const adm = modules.find((m) => m.to === '/admin/settings/org')
    if (adm) return adm
  }
  // Mitt arbeid surfaces: /innboks + /mitt-arbeid/* all belong to the
  // Mitt arbeid group.
  if (
    pathname === '/innboks' ||
    pathname === '/mitt-arbeid' ||
    pathname.startsWith('/mitt-arbeid/')
  ) {
    const inb = modules.find((m) => m.to === '/innboks')
    if (inb) return inb
  }
  // Exact-match with query (handles /council?tab=board vs /council)
  for (const mod of modules) {
    if (mod.to.includes('?')) {
      const [p, q] = mod.to.split('?')
      const params = new URLSearchParams(q)
      const searchParams = new URLSearchParams(search)
      if (pathname === p && searchParams.get('tab') === params.get('tab')) return mod
    }
  }
  // Exact pathname match — picks /compliance/checklists over /compliance even
  // when /compliance appears earlier in the modules list (without this pass,
  // a prefix match against a parent path wins by iteration order and the user
  // lands on the wrong group's sub-menu).
  for (const mod of modules) {
    if (mod.to === '/') continue
    const base = mod.to.split('?')[0]
    if (pathname === base) return mod
  }
  // Then prefix match (fallback for nested routes like /compliance/checklists/:id)
  for (const mod of modules) {
    if (mod.to === '/') continue
    const base = mod.to.split('?')[0]
    if (pathname.startsWith(base + '/') || pathname.startsWith(base + '?')) return mod
  }
  return modules[0]
}

// ─── Nav mode persistence ─────────────────────────────────────────────────────

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

// Rail-2 state moved to aticsRailState.ts. Two new state slots replace
// the boolean `subNavCollapsed`:
//   rail2Pref  — what the user picked (or 'auto' to follow viewport)
//   autoState  — the breakpoint-resolved state (only used when pref==='auto')
// The render path reads `resolveRail2State(rail2Pref, autoState)` which
// returns one of 'expanded' | 'hidden'.

// ─── Shell ────────────────────────────────────────────────────────────────────

export function AticsShell() {
  const location = useLocation()
  const { supabase, supabaseConfigured, can, permissionKeys, user, profile, signOut } = useOrgSetupContext()
  const { t } = useT()
  const gateNav = supabaseConfigured && permissionKeys.size > 0

  // Disabled at org level (modules.is_active = false)
  const [disabledModules, setDisabledModules] = useState<Set<string>>(new Set())
  // Hidden for this user (module_user_access.access_level = 'none')
  const [hiddenForUser, setHiddenForUser] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!supabase || !user) return
    void (async () => {
      const [modsRes, accessRes] = await Promise.all([
        supabase.from('modules').select('slug, is_active'),
        supabase.from('module_user_access').select('module_slug, access_level').eq('user_id', user.id),
      ])
      if (!modsRes.error && modsRes.data) {
        setDisabledModules(
          new Set(
            (modsRes.data as { slug: string; is_active: boolean }[])
              .filter((r) => !r.is_active)
              .map((r) => r.slug),
          ),
        )
      }
      if (!accessRes.error && accessRes.data) {
        setHiddenForUser(
          new Set(
            (accessRes.data as { module_slug: string; access_level: string }[])
              .filter((r) => r.access_level === 'none')
              .map((r) => r.module_slug),
          ),
        )
      }
    })()
  }, [supabase, user])

  // Compliance "Sjekklister" — high-level menu item with /compliance/checklists
  // as the click target. Pinned templates appear as expandable sub-items when
  // the entry is active. Single-module group (the structure requires a group)
  // so the entry surfaces as a flat top-level item rather than a folder.
  //
  // Permission gate matches the /compliance route gate (ROUTE_PERMISSION_ANY)
  // so anyone who can reach the page also sees the menu entry. Using the
  // narrower 'checklist.manage' would hide the menu from view-only users who
  // can still see the page itself — a confusing inconsistency.
  //
  // The group renders even when the org has no licensed compliance_packs;
  // the page itself shows a clear "no packs licensed" warning, which is
  // better UX than silently hiding the menu (the customer would have no
  // path to discover the feature).
  const complianceNav = useComplianceNav()
  const surveyNav = useSurveyNav()
  const learningNav = useLearningNav()
  const documentNav = useDocumentNav()
  const registersNav = useRegistersNav()
  const tasksNav = useTaskNav()
  const meetingsNav = useMeetingsNav()
  const alertsNav = useAlertsNav()
  // Platform-admin scope — gates the cross-org dedup-grupper sub-link
  // under Varslinger. The RPC itself enforces platform_is_admin so the
  // gate is purely UX (hide a link the user can't act on).
  const { isAdmin: isPlatformAdmin } = usePlatformAdmin()
  // Partner-konsoll: only the membership flag is needed for nav visibility;
  // the consultant clock side effect runs unconditionally and self-gates.
  const { isPartnerMember } = usePartnerMembership()
  useConsultantClock()
  // AMU agenda-backlog counter — drives the badge on "Agenda-restanser"
  // under Møter. 60s poll cadence. The other two count hooks
  // (gov-outbox, cert-expiry) keep running as side effects in
  // `useGovOutboxPendingCount` / `useCertExpiryWarningCount`; their
  // badges live elsewhere in the IA and the values were never read
  // here — calling the hooks unconditionally preserves the polling
  // schedule.
  useGovOutboxPendingCount()
  useCertExpiryWarningCount()
  const { count: amuBacklogPendingCount } = useAmuAgendaBacklogCount()
  const { isActive: isRegulationActive } = useRegulationFilter()
  const mergedNavSections = useMemo<NavSection[]>(
    () =>
      buildNavSections({
        complianceNav,
        surveyNav,
        learningNav,
        documentNav,
        registersNav,
        tasksNav,
        meetingsNav,
        alertsNav,
        isRegulationActive,
        isPartnerMember,
        isPlatformAdmin: isPlatformAdmin === true,
        amuBacklogPendingCount,
      }),
    [
      complianceNav,
      surveyNav,
      learningNav,
      documentNav,
      registersNav,
      tasksNav,
      meetingsNav,
      alertsNav,
      isRegulationActive,
      isPartnerMember,
      isPlatformAdmin,
      amuBacklogPendingCount,
    ],
  )

  const visibleSections = useMemo(
    () => filterNavSections(mergedNavSections, gateNav, can, disabledModules, hiddenForUser),
    [mergedNavSections, gateNav, can, disabledModules, hiddenForUser],
  )
  const visibleGroups = useMemo(() => allGroupsFromSections(visibleSections), [visibleSections])
  const visibleModules = useMemo(() => allModulesFrom(visibleGroups), [visibleGroups])
  const paletteEntries = useMemo(
    () => flattenNavToEntries(visibleSections),
    [visibleSections],
  )

  const [navMode, setNavMode] = useState<NavMode>(loadNavMode)
  const [rail2Pref, setRail2Pref] = useState<Rail2Preference>(loadRail2Pref)
  // Auto-resolved rail2 state, recomputed when viewport crosses a
  // breakpoint. Initialised with a window-aware guess so SSR/first-paint
  // doesn't flash the wrong state.
  const [autoState, setAutoState] = useState<Rail2State>(() => {
    if (typeof window === 'undefined') return 'expanded'
    return autoRail2State(window.innerWidth)
  })

  // Track viewport via matchMedia so we only re-render when crossing
  // the md breakpoint (768px), not on every resize pixel.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mqHidden = window.matchMedia('(max-width: 767px)')
    const update = () => {
      setAutoState(mqHidden.matches ? 'hidden' : 'expanded')
    }
    update()
    mqHidden.addEventListener('change', update)
    return () => {
      mqHidden.removeEventListener('change', update)
    }
  }, [])

  const rail2State: Rail2State = rail2Pref === 'auto' ? autoState : rail2Pref

  const cycleRail2 = useCallback(() => {
    // Cycling makes the choice explicit; once the user clicks, the
    // 'auto' default no longer applies for this device.
    const next = cycleRail2State(rail2State)
    setRail2Pref(next)
    saveRail2Pref(next)
  }, [rail2State])

  // Keyboard shortcut: `[` cycles rail 2 forward (expanded → mini →
  // hidden → expanded). Skipped when focus is in a text-entry field
  // so users editing content can type `[` normally.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '[') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      )
        return
      e.preventDefault()
      cycleRail2()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cycleRail2])

  // ── Command palette (Cmd/Ctrl+K) ──────────────────────────────────────────
  const navigate = useNavigate()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [recentPaths, setRecentPaths] = useState<string[]>(() => loadRecentPaths())

  // Persist + refresh the recent-paths cache every time the route changes.
  // Once-per-navigation setState is the intended cadence; the
  // localStorage round-trip is the source of truth and can't be lifted
  // to props.
  useEffect(() => {
    pushRecentPath(location.pathname)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecentPaths(loadRecentPaths())
  }, [location.pathname])

  // Strip the path the user is currently on from the recent list — no
  // value showing "where I am" as a suggestion.
  const paletteRecents = useMemo(
    () => recentPaths.filter((p) => p !== location.pathname),
    [recentPaths, location.pathname],
  )

  // Cmd/Ctrl+K opens the palette. Same input-field guard as the [ shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isOpen = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')
      if (!isOpen) return
      const t = e.target as HTMLElement | null
      // The palette's own input is fine; only block when typing somewhere
      // else inside a text field would lose work.
      if (
        t &&
        t.tagName !== 'INPUT' &&
        t.tagName !== 'TEXTAREA' &&
        !t.isContentEditable
      ) {
        e.preventDefault()
        setPaletteOpen(true)
        return
      }
      // Even inside a text field, Cmd+K opens — but only if it's not
      // contentEditable rich text where Cmd+K might be a hyperlink.
      if (t && t.tagName === 'INPUT') {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function handleNavModeChange(mode: NavMode) {
    setNavMode(mode)
    saveNavMode(mode)
  }

  const profileDisplay = profile?.display_name?.trim() ?? ''
  const profileEmail = profile?.email?.trim() ?? ''

  // ── Sidebar layout ──────────────────────────────────────────────────────────
  if (navMode === 'sidebar') {
    const activeModule = activeModuleForPath(visibleModules, location.pathname, location.search)
    const activeGroup = visibleGroups.find((g) => g.modules.some((m) => m.to === activeModule.to))
    const activeSection = visibleSections.find((s) =>
      s.groups.some((g) => g.id === activeGroup?.id),
    )

    const nextStateLabel = rail2StateLabel(cycleRail2State(rail2State))
    const toggleTitle = `Navigasjon: ${rail2StateLabel(rail2State)} → ${nextStateLabel} ([)`

    return (
      <div
        className="flex h-[100dvh] max-h-[100dvh] overflow-hidden"
        data-rail2={rail2State}
      >
        <SkipToContent />

        {/* ── Rail 1: Section icons (one per section) ──────────────────────── */}
        <aside className="flex w-[var(--shell-rail1-w)] shrink-0 flex-col bg-[var(--ui-nav-rail)]">
          {/* Logo */}
          <div className="flex h-14 shrink-0 items-center justify-center border-b border-white/10">
            <NavLink
              to="/app"
              aria-label={t('shell.homeAria')}
              className="flex items-center justify-center rounded-lg p-1.5 hover:bg-white/10"
            >
              <KlarertLogo size={22} markOnly variant="onDark" />
            </NavLink>
          </div>

          {/* Section icons — one per NavSection (4 total + partner).
              Clicking navigates to the section's first group's primary
              route; the rail 2 column shows every section's content
              regardless, so this is a scroll-anchor / landing
              shortcut. */}
          <nav
            className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-2 py-4"
            aria-label={t('shell.homeAria')}
          >
            {visibleSections.map((section) => {
              const SectionIcon = section.icon
              const isActive = activeSection?.id === section.id
              const firstTarget = section.groups[0]?.modules[0]?.to ?? '/app'
              return (
                <NavLink
                  key={section.id}
                  to={firstTarget}
                  end={false}
                  title={section.label}
                  aria-label={section.label}
                  className={`relative flex items-center justify-center rounded-lg p-3 transition-colors ${
                    isActive
                      ? 'bg-white/15 text-white before:absolute before:left-0 before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-[var(--color-atics-gold)]'
                      : 'text-white/55 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <SectionIcon className="size-[1.25rem] shrink-0" aria-hidden />
                </NavLink>
              )
            })}
          </nav>

          {/* Quick-search trigger — same as Cmd/Ctrl+K, but discoverable
              by mouse + touch users. Sits with the rail toggle so all
              chrome controls cluster at the bottom of rail 1. */}
          <div className="border-t border-white/10 px-2 py-2">
            <Button
              variant="ghost"
              onClick={() => setPaletteOpen(true)}
              className="flex w-full items-center justify-center rounded-lg p-3 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              aria-label={t('shell.commandPalette.openHint')}
              title={t('shell.commandPalette.openHint')}
            >
              <Search className="size-[1.125rem] shrink-0" aria-hidden />
            </Button>
          </div>

          {/* Rail 2 cycle toggle: expanded → mini → hidden → expanded.
              Also driven by the [ keyboard shortcut. */}
          <div className="border-t border-white/10 px-2 py-2">
            <Button
              variant="ghost"
              onClick={cycleRail2}
              className={`flex w-full items-center justify-center rounded-lg p-3 transition-colors ${
                rail2State === 'hidden'
                  ? 'bg-white/15 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
              aria-expanded={rail2State !== 'hidden'}
              aria-label={toggleTitle}
              title={toggleTitle}
            >
              {rail2State === 'hidden' ? (
                <PanelRight className="size-[1.125rem] shrink-0" aria-hidden />
              ) : (
                <PanelLeft className="size-[1.125rem] shrink-0" aria-hidden />
              )}
            </Button>
          </div>

        </aside>

        {/* ── Rail 2: single aside with three internal states. Always
            mounted so the width transition animates smoothly between
            states; the inner panel switches discretely. The motion-
            reduced query honours users who've opted out. ── */}
        <aside
          className="flex shrink-0 flex-col overflow-hidden bg-[var(--ui-nav-rail-mid)] transition-[width] duration-200 ease-out motion-reduce:transition-none"
          style={{ width: 'var(--shell-rail2-w)' }}
          aria-hidden={rail2State === 'hidden'}
          aria-label={rail2State !== 'hidden' ? 'Section navigation' : undefined}
        >
          {rail2State === 'expanded' ? (
            <nav className="flex-1 overflow-y-auto px-2 py-4">
              {visibleSections.map((section, sectionIdx) => {
                const showLabel = section.id !== 'partner'
                return (
                  <div key={section.id} className={sectionIdx > 0 ? 'mt-4' : ''}>
                    {showLabel ? (
                      <div className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/70">
                        {section.label}
                      </div>
                    ) : (
                      <h2 className="sr-only">{section.label}</h2>
                    )}
                    {section.groups.flatMap((group) =>
                      group.modules.map((mod) => {
                        const ModIcon = mod.icon
                        const isActiveMod = activeModule.to === mod.to
                        const badge =
                          mod.badgeCount && mod.badgeCount > 0 ? mod.badgeCount : null
                        const badgeTone = mod.badgeTone ?? 'danger'
                        return (
                          <NavLink
                            key={`${group.id}:${mod.to}`}
                            to={mod.to}
                            end={mod.end}
                            className={`relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                              isActiveMod
                                ? 'bg-white/10 text-white before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-[var(--color-atics-gold)]'
                                : 'text-white/70 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <ModIcon className="size-4 shrink-0 opacity-80" aria-hidden />
                            <span className="flex-1 truncate">{mod.label}</span>
                            {badge !== null ? (
                              <span
                                className={`ml-1 inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white ${
                                  badgeTone === 'amber' ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                aria-label={`${badge} ventende oppgaver i ${mod.label}`}
                              >
                                {badge > 99 ? '99+' : badge}
                              </span>
                            ) : null}
                          </NavLink>
                        )
                      }),
                    )}
                  </div>
                )
              })}
            </nav>
          ) : null}
        </aside>

        {/* ── Content area ─────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Utility bar — page background colour */}
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-neutral-300/40 bg-[var(--ui-surface)] px-4 md:px-5">
            <div className="min-w-0 flex-1" />
            <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
              {supabaseConfigured ? (
                <>
                  <OrgSwitcher variant="sidebar" />
                  <ShellQuickCreateMenu variant="sidebar" />
                  <ShellComplianceIndicator variant="sidebar" />
                  {/* Cross-module Cat 1 filter (regulations) — replaces the
                      single-pack switchers as the dominant control. The
                      compliance + survey pack switchers stay for module-
                      internal pack focus where the URL ?pack= param matters
                      (e.g. compliance accent flip). */}
                  <RegulationFilterMenu variant="sidebar" />
                  <NotificationTray variant="sidebar" />
                  <ShellProfileMenuButton
                    variant="sidebar"
                    displayName={profileDisplay}
                    email={profileEmail}
                    profileTo="/profile"
                    navMode={navMode}
                    onNavModeChange={handleNavModeChange}
                    onSignOut={signOut}
                    logInHref="/login"
                    logInLabel={t('shell.logIn')}
                    logOutLabel={t('shell.logOut')}
                    settingsAria={t('shell.settingsAria')}
                    showAuth
                    isLoggedIn={Boolean(user)}
                  />
                </>
              ) : null}
            </div>
          </header>

          <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto bg-transparent">
            <SurveyPendingInvitesBanner />
            <Outlet />
          </main>
        </div>
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onSelect={(path) => navigate(path)}
          entries={paletteEntries}
          recentPaths={paletteRecents}
        />
      </div>
    )
  }

  // ── Top-bar layout ──────────────────────────────────────────────────────────
  const activeModule = activeModuleForPath(visibleModules, location.pathname, location.search)
  const activeGroup = visibleGroups.find((g) => g.modules.some((m) => m.to === activeModule.to))
  const activeSection = visibleSections.find((s) =>
    s.groups.some((g) => g.id === activeGroup?.id),
  )
  // Topbar row 1: one tab per NavSection (4 + partner). Mirrors the
  // sidebar Rail 1 (icons-per-section); row 2 below shows modules in
  // the active section.
  const topBarGroupNav = (
    <nav className="flex min-h-0 items-center gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] md:flex-1 md:justify-center md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden" aria-label="Primary">
      {visibleSections.map((section) => {
        const isActiveSection = activeSection?.id === section.id
        const firstTarget = section.groups[0]?.modules[0]?.to ?? '/app'
        return (
          <NavLink
            key={section.id}
            to={firstTarget}
            end={false}
            title={section.label}
            aria-label={section.label}
            className={`relative shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors md:px-3.5 md:py-1.5 ${
              isActiveSection
                ? 'bg-white/15 text-white after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[var(--color-atics-gold)]'
                : 'text-white/75 hover:bg-white/10 hover:text-white'
            }`}
          >
            {section.label}
          </NavLink>
        )
      })}
    </nav>
  )

  const topBarUtilities = (
    <div className="flex shrink-0 flex-nowrap items-center justify-end gap-1.5 sm:gap-2 md:gap-3">
      {supabaseConfigured ? (
        <>
          <OrgSwitcher variant="topbar" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPaletteOpen(true)}
            className="h-9 w-9 rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={t('shell.commandPalette.openHint')}
            title={t('shell.commandPalette.openHint')}
          >
            <Search className="size-4 shrink-0" aria-hidden />
          </Button>
          <ShellQuickCreateMenu variant="topbar" />
          <ShellComplianceIndicator variant="topbar" />
          {/* Regulation filter is the single cross-module top-bar
              dropdown. The legacy per-module pack switchers
              (ShellCompliancePackSwitcher, ShellSurveyPackSwitcher)
              were removed — having both made the top bar render two
              dropdowns on /compliance/* and /survey/*. The URL
              `?pack=` mechanism still works for direct links; the
              dashboards just fall back to the scope's default accent
              when the param is absent. */}
          <RegulationFilterMenu variant="topbar" />
          <NotificationTray variant="topbar" />
          <ShellProfileMenuButton
            variant="topbar"
            displayName={profileDisplay}
            email={profileEmail}
            profileTo="/profile"
            navMode={navMode}
            onNavModeChange={handleNavModeChange}
            onSignOut={signOut}
            logInHref="/login"
            logInLabel={t('shell.logIn')}
            logOutLabel={t('shell.logOut')}
            settingsAria={t('shell.settingsAria')}
            showAuth
            isLoggedIn={Boolean(user)}
          />
        </>
      ) : null}
    </div>
  )

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[var(--ui-surface)]">
      <SkipToContent />
      <header className="shrink-0 bg-[var(--ui-nav-rail)] text-white">
        {/* Row 1: mobile — logo + section toggle | utilities (profile/menu always visible without scrolling) */}
        <div className="mx-auto max-w-[1400px] px-4 py-2 md:px-8 md:py-3">
          <div className="flex items-center justify-between gap-2 md:hidden">
            <NavLink to="/app" className="flex shrink-0 items-center gap-2" aria-label={t('shell.homeAria')}>
              <KlarertLogo size={28} variant="onDark" />
            </NavLink>
            {topBarUtilities}
          </div>

          {/* md+: single row — logo · groups · utilities. No rail-toggle
              button here — in topbar mode the rails aren't rendered, so
              the toggle has no visible effect (the user has to switch
              nav modes via the profile menu to see the change). */}
          <div className="hidden items-center justify-between gap-4 md:flex">
            <NavLink to="/app" className="flex shrink-0 items-center gap-2" aria-label={t('shell.homeAria')}>
              <KlarertLogo size={28} variant="onDark" />
            </NavLink>
            {topBarGroupNav}
            {topBarUtilities}
          </div>

          {/* Mobile: group tabs on own row (horizontal scroll, does not push profile off-screen) */}
          <div className="mt-2 border-t border-white/10 pt-2 md:hidden">{topBarGroupNav}</div>
        </div>

        {/* ── Row 2: module tabs for the active section ───────────────────── */}
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-[1400px] items-center gap-1 overflow-x-auto px-4 py-2 md:px-8">
            {activeSection ? (
              activeSection.groups.flatMap((group) =>
                group.modules.map((mod) => {
                  const Icon = mod.icon
                  const isActiveMod = activeModule.to === mod.to
                  const badge =
                    mod.badgeCount && mod.badgeCount > 0 ? mod.badgeCount : null
                  const badgeTone = mod.badgeTone ?? 'danger'
                  return (
                    <NavLink
                      key={`${group.id}:${mod.to}`}
                      to={mod.to}
                      end={mod.end}
                      className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        isActiveMod
                          ? 'bg-white/15 text-white after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[var(--color-atics-gold)]'
                          : 'text-white/65 hover:bg-white/5 hover:text-white/90'
                      }`}
                    >
                      <Icon className="size-4 shrink-0 opacity-85" aria-hidden />
                      {mod.label}
                      {badge !== null ? (
                        <span
                          className={`ml-0.5 inline-flex min-w-[1.125rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white ${
                            badgeTone === 'amber' ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          aria-label={`${badge} ventende`}
                        >
                          {badge > 99 ? '99+' : badge}
                        </span>
                      ) : null}
                    </NavLink>
                  )
                }),
              )
            ) : (
              <span className="text-sm text-white/40">Velg en seksjon over</span>
            )}
          </div>
        </div>

      </header>

      <main id="main-content" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto bg-[var(--ui-surface)]">
        <Outlet />
      </main>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={(path) => navigate(path)}
        entries={paletteEntries}
        recentPaths={paletteRecents}
      />
    </div>
  )
}

// Keyboard-only escape hatch past the 30+ tab stops in the rails. The
// link is visually hidden until focused (Tab from page load), then
// jumps focus to <main id="main-content"> when activated. WCAG 2.4.1.
function SkipToContent() {
  const { t } = useT()
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-[var(--ui-nav-rail)] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-atics-gold)]"
    >
      {t('shell.skipToContent')}
    </a>
  )
}

export { BookOpen, PanelLeft }
