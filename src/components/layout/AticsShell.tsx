import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Briefcase,
  Database,
  ClipboardList,
  FileText,
  FolderKanban,
  FolderTree,
  GraduationCap,
  History,
  Home,
  Inbox,
  Kanban,
  ListChecks,
  Megaphone,
  PanelLeft,
  PanelRight,
  Scale,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Settings,
  Star,
  CalendarClock,
  Wand2,
  CalendarDays,
} from 'lucide-react'
import { NotificationTray } from '../notifications/NotificationTray'
import { SurveyPendingInvitesBanner } from '../../../modules/survey/SurveyPendingInvitesBanner'
import { useT } from '../../hooks/useT'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { PermissionKey } from '../../lib/permissionKeys'
import { Button } from '../ui/Button'
import { KlarertLogo } from '../brand/KlarertLogo'
import {
  ShellCompanyBlock,
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
import type { NavGroup, NavModule, NavSection, SubItem } from './aticsNavTypes'
import { CommandPalette } from './CommandPalette'
import { flattenNavToEntries } from './commandPaletteEntries'
import { loadRecentPaths, pushRecentPath } from './recentPaths'
import {
  ADMINISTRASJON_NAV_PERMS,
  ALERTS_NAV_PERMS,
  COMPLIANCE_NAV_PERMS,
  DOCUMENTS_NAV_PERMS,
  LEARNING_NAV_PERMS,
  MEETINGS_NAV_PERMS,
  REGISTERS_NAV_PERMS,
  RISK_NAV_PERMS,
  SURVEY_NAV_PERMS,
  TASKS_NAV_PERMS,
} from './aticsNavPerms'

// Nav types live in `aticsNavTypes.ts`; permission gates in `aticsNavPerms.ts`.
// They're imported above. Anything below is shell composition + render.

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
// returns one of 'expanded' | 'mini' | 'hidden'.

// ─── Shell ────────────────────────────────────────────────────────────────────

export function AticsShell() {
  const location = useLocation()
  const { supabase, supabaseConfigured, can, permissionKeys, user, profile, signOut, organization } = useOrgSetupContext()
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
  // Manual-triage queue counter used by the Integrasjoner submenu badge.
  // 60s polling, cheap RLS-scoped count, see hook for rationale.
  const { count: govOutboxPendingCount } = useGovOutboxPendingCount()
  // AMU agenda-backlog counter — drives the badge on "Agenda-restanser"
  // under Møter. Same 60s poll cadence as gov-outbox.
  const { count: amuBacklogPendingCount } = useAmuAgendaBacklogCount()
  // Cert-expiry counter — drives the red pip on the Sertifikat-rotasjon
  // sub-link when ≥1 cert is within 30 days of expiry. 5-min polling.
  const { count: certExpiryWarningCount } = useCertExpiryWarningCount()
  const { isActive: isRegulationActive, activeRegulationIds } = useRegulationFilter()
  const mergedNavSections = useMemo<NavSection[]>(() => {
    // Fixed sub-entries that always sit under "Sjekklister" — Analyse and
    // Innstillinger live here so the user has a clear path to org-level
    // dashboards and pack/template configuration without leaving the menu
    // group. Pinned templates follow.
    const complianceFixedSubs: SubItem[] = [
      {
        label: 'Analyse',
        path: '/compliance/checklists/analyse',
        Icon: BarChart3,
        match: ({ pathname }) => pathname === '/compliance/checklists/analyse',
        requirePermAny: COMPLIANCE_NAV_PERMS,
      },
      {
        label: 'Alle sjekklister',
        path: '/compliance/checklists/alle',
        match: ({ pathname }) => pathname === '/compliance/checklists/alle',
        requirePermAny: COMPLIANCE_NAV_PERMS,
      },
      {
        label: 'Innstillinger',
        path: '/admin/settings/compliance',
        Icon: Settings,
        match: ({ pathname }) =>
          pathname.startsWith('/admin/settings/compliance') ||
          pathname.startsWith('/compliance/checklists/admin'),
        requirePermAny: COMPLIANCE_NAV_PERMS,
      },
    ]

    // Group pinned templates by category. Categories with no pinned items
    // are skipped; uncategorised items collect under "Uten kategori".
    // Single-category mode (zero or one non-empty category) renders flat
    // — adding a single header would just be visual noise.
    //
    // Each item carries a `headerKey` matching its category header so the
    // renderer can fold/unfold a category by toggling that key.
    const compliancePinnedSubs: SubItem[] = (() => {
      const buckets = new Map<string, typeof complianceNav.items>()
      for (const it of complianceNav.items) {
        const key = it.headerKey
        const list = buckets.get(key) ?? []
        list.push(it)
        buckets.set(key, list)
      }
      const orderedCats = complianceNav.categories
        .filter((c) => buckets.has(c.id))
        .filter((c) => isRegulationActive(c.regulationId))
        .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'nb'))
      // Each pack with uncategorised templates gets its own bucket
      // keyed `${pack}:__uncat__`. When multiple packs are licensed
      // we'd render N "Uten kategori" headers stacked together
      // (indistinguishable). Label each with the pack's short name
      // so the user can tell them apart; fall back to the generic
      // label only when a single bucket exists.
      const uncategorisedEntries = [...buckets.entries()].filter(([key]) =>
        key.endsWith(':__uncat__'),
      )
      const uncategorised = uncategorisedEntries.map(([key]) => {
        const slug = key.slice(0, -':__uncat__'.length)
        const packLabel = complianceNav.packShortNameBySlug[slug]
        return {
          id: key,
          name:
            uncategorisedEntries.length > 1 && packLabel ? packLabel : 'Uten kategori',
        }
      })
      const orderedKeys: { id: string; name: string }[] = [
        ...orderedCats.map((c) => ({ id: c.id, name: c.name })),
        ...uncategorised,
      ]
      const showHeaders = orderedKeys.length > 1

      const subs: SubItem[] = []
      for (const cat of orderedKeys) {
        const list = buckets.get(cat.id) ?? []
        if (list.length === 0) continue
        if (showHeaders) {
          subs.push({
            kind: 'header',
            label: cat.name,
            path: `__cat:${cat.id}`,
            match: () => false,
            headerKey: cat.id,
            Icon: FolderTree,
            requirePermAny: COMPLIANCE_NAV_PERMS,
          })
        }
        for (const item of list) {
          subs.push({
            label: item.name,
            path: item.to,
            match: ({ pathname, search }) => {
              if (pathname !== '/compliance/checklists') return false
              return new URLSearchParams(search).get('template') === item.templateSlug
            },
            // When showHeaders is false there's only one group, so we
            // skip the header entirely and clear headerKey so the item
            // always renders.
            headerKey: showHeaders ? cat.id : undefined,
            requirePermAny: COMPLIANCE_NAV_PERMS,
          })
        }
      }
      return subs
    })()

    const complianceGroup: NavGroup = {
      id: 'sjekklister',
      label: 'Sjekklister',
      icon: ClipboardList,
      modules: [
        {
          to: '/compliance/checklists',
          label: 'Sjekklister',
          end: false,
          icon: ClipboardList,
          subs: [...complianceFixedSubs, ...compliancePinnedSubs],
          permAny: COMPLIANCE_NAV_PERMS,
          flatSubs: true,
        },
      ],
    }

    // Compliance Layer (Kontroller) folded into Internkontroll · Kontroller
    // (Nov 2026). The list view lives at /internkontroll?section=
    // kontroller; per-control detail, analyse, and admin still resolve
    // at /controls/:id, /controls/analyse, /controls/admin as deep-dives
    // that the Internkontroll section links into.

    // Survey "Undersøkelser" group — same flatSubs treatment as Sjekklister.
    // Fixed sub-entries that always sit under "Undersøkelser" — Analyse
    // and Innstillinger live here so the user has a clear path to org-
    // level dashboards and pack/template configuration without leaving
    // the menu group. Pinned templates follow.
    const surveyFixedSubs: SubItem[] = [
      {
        label: 'Analyse',
        path: '/survey/analyse',
        Icon: BarChart3,
        match: ({ pathname }) => pathname === '/survey/analyse',
        requirePermAny: SURVEY_NAV_PERMS,
      },
      {
        label: 'Alle undersøkelser',
        path: '/survey/alle',
        match: ({ pathname }) => pathname === '/survey/alle',
        requirePermAny: SURVEY_NAV_PERMS,
      },
      {
        label: 'Innstillinger',
        path: '/admin/settings/survey',
        Icon: Settings,
        match: ({ pathname }) =>
          pathname.startsWith('/admin/settings/survey') || pathname.startsWith('/survey/admin'),
        requirePermAny: SURVEY_NAV_PERMS,
      },
    ]

    // Pinned templates grouped by category, mirroring the compliance
    // version. Single-category mode skips headers (visual noise).
    const surveyPinnedSubs: SubItem[] = (() => {
      const buckets = new Map<string, typeof surveyNav.items>()
      for (const it of surveyNav.items) {
        const list = buckets.get(it.headerKey) ?? []
        list.push(it)
        buckets.set(it.headerKey, list)
      }
      const orderedCats = surveyNav.categories
        .filter((c) => buckets.has(c.id))
        .filter((c) => isRegulationActive(c.regulationId))
        .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'nb'))
      // Multi-pack uncategorised buckets — see compliance branch above
      // for the rationale. Label per-pack so the user can tell them
      // apart; fall back to the generic "Uten kategori" when a single
      // bucket exists.
      const uncategorisedEntries = [...buckets.entries()].filter(([key]) =>
        key.endsWith(':__uncat__'),
      )
      const uncategorised = uncategorisedEntries.map(([key]) => {
        const slug = key.slice(0, -':__uncat__'.length)
        const packLabel = surveyNav.packShortNameBySlug[slug]
        return {
          id: key,
          name:
            uncategorisedEntries.length > 1 && packLabel ? packLabel : 'Uten kategori',
        }
      })
      const orderedKeys: { id: string; name: string }[] = [
        ...orderedCats.map((c) => ({ id: c.id, name: c.name })),
        ...uncategorised,
      ]
      const showHeaders = orderedKeys.length > 1

      const subs: SubItem[] = []
      for (const cat of orderedKeys) {
        const list = buckets.get(cat.id) ?? []
        if (list.length === 0) continue
        if (showHeaders) {
          subs.push({
            kind: 'header',
            label: cat.name,
            path: `__cat:${cat.id}`,
            match: () => false,
            headerKey: cat.id,
            Icon: FolderTree,
            requirePermAny: SURVEY_NAV_PERMS,
          })
        }
        for (const item of list) {
          subs.push({
            label: item.templateName,
            path: item.to,
            match: ({ pathname, search }) => {
              if (pathname !== '/survey') return false
              return new URLSearchParams(search).get('template') === item.catalogId
            },
            headerKey: showHeaders ? cat.id : undefined,
            requirePermAny: SURVEY_NAV_PERMS,
          })
        }
      }
      return subs
    })()

    const surveyGroup: NavGroup = {
      id: 'undersokelser',
      label: 'Undersøkelser',
      icon: Megaphone,
      modules: [
        {
          to: '/survey',
          label: 'Undersøkelser',
          end: false,
          icon: Megaphone,
          subs: [...surveyFixedSubs, ...surveyPinnedSubs],
          permAny: SURVEY_NAV_PERMS,
          flatSubs: true,
        },
      ],
    }

    // Learning "Læring" group — matches Sjekklister + Undersøkelser:
    // fixed Analyse + Alle kurs + Innstillinger entries up top, then
    // published courses grouped by category with collapsible headers.
    const learningFixedSubs: SubItem[] = [
      {
        label: 'Analyse',
        path: '/learning/analyse',
        Icon: BarChart3,
        match: ({ pathname }) => pathname === '/learning/analyse',
        requirePermAny: LEARNING_NAV_PERMS,
      },
      {
        label: 'Alle kurs',
        path: '/learning/alle',
        match: ({ pathname }) => pathname === '/learning/alle',
        requirePermAny: LEARNING_NAV_PERMS,
      },
      {
        label: 'Innstillinger',
        path: '/admin/settings/learning',
        Icon: Settings,
        match: ({ pathname }) =>
          pathname.startsWith('/admin/settings/learning') ||
          pathname.startsWith('/learning/innstillinger'),
        requirePermAny: LEARNING_NAV_PERMS,
      },
    ]

    const learningCourseSubs: SubItem[] = (() => {
      const buckets = new Map<string, typeof learningNav.items>()
      for (const it of learningNav.items) {
        const list = buckets.get(it.headerKey) ?? []
        list.push(it)
        buckets.set(it.headerKey, list)
      }
      const orderedCats = learningNav.categories
        .filter((c) => buckets.has(c.id))
        .filter((c) => isRegulationActive(c.regulationId))
        .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'nb'))
      const uncategorised = buckets.has('__uncat__')
        ? [{ id: '__uncat__', name: 'Uten kategori' }]
        : []
      const orderedKeys: { id: string; name: string }[] = [
        ...orderedCats.map((c) => ({ id: c.id, name: c.name })),
        ...uncategorised,
      ]
      const showHeaders = orderedKeys.length > 1

      const subs: SubItem[] = []
      for (const cat of orderedKeys) {
        const list = buckets.get(cat.id) ?? []
        if (list.length === 0) continue
        if (showHeaders) {
          subs.push({
            kind: 'header',
            label: cat.name,
            path: `__cat:${cat.id}`,
            match: () => false,
            headerKey: cat.id,
            Icon: FolderTree,
            requirePermAny: LEARNING_NAV_PERMS,
          })
        }
        for (const item of list) {
          subs.push({
            label: item.title,
            path: item.to,
            match: ({ pathname }) => pathname === item.to,
            headerKey: showHeaders ? cat.id : undefined,
            requirePermAny: LEARNING_NAV_PERMS,
          })
        }
      }
      return subs
    })()

    const learningGroup: NavGroup = {
      id: 'laring',
      label: 'Læring',
      icon: GraduationCap,
      modules: [
        {
          to: '/learning',
          label: 'Læring',
          end: false,
          icon: GraduationCap,
          subs: [...learningFixedSubs, ...learningCourseSubs],
          permAny: LEARNING_NAV_PERMS,
          moduleSlug: 'learning',
          flatSubs: true,
        },
      ],
    }

    // Dokumenter group — promoted to top-level alongside Sjekklister /
    // Undersøkelser / Oppgaver / Læring per documents-parity §T1. Sub-list
    // is the existing DOCUMENTS_NAV plus fixed Analyse + Innstillinger
    // children at the top (T2 + T3 wire up the targets). Pinned templates
    // (T6) will land below this list when shipped.
    // Keep only the cross-module canon (Analyse / Alle / Innstillinger).
    // The legacy Oversikt / Samsvar / Dokumentmaler / Årsgjennomgang
    // entries are still routable via direct URL but no longer clutter
    // the sidebar — same shape as Sjekklister + Undersøkelser.
    const documentsFixedSubs: SubItem[] = [
      {
        label: 'Analyse',
        path: '/documents/analyse',
        Icon: BarChart3,
        match: ({ pathname }) => pathname === '/documents/analyse',
        requirePermAny: DOCUMENTS_NAV_PERMS,
      },
      {
        label: 'Alle dokumenter',
        path: '/documents/alle',
        match: ({ pathname }) => pathname === '/documents/alle',
        requirePermAny: DOCUMENTS_NAV_PERMS,
      },
      {
        label: 'Innstillinger',
        path: '/admin/settings/documents',
        Icon: Settings,
        match: ({ pathname }) =>
          pathname.startsWith('/admin/settings/documents') ||
          pathname.startsWith('/documents/admin') ||
          pathname.startsWith('/documents/templates'),
        requirePerm: 'documents.manage',
      },
    ]

    // Pinned templates grouped by category, mirroring surveyPinnedSubs.
    // Single-category mode skips the headers (visual cleanliness).
    const documentsPinnedSubs: SubItem[] = (() => {
      const buckets = new Map<string, typeof documentNav.items>()
      for (const it of documentNav.items) {
        const list = buckets.get(it.headerKey) ?? []
        list.push(it)
        buckets.set(it.headerKey, list)
      }
      const orderedCats = documentNav.categories
        .filter((c) => buckets.has(c.id))
        .filter((c) => isRegulationActive(c.regulationId))
      const showHeaders = orderedCats.length > 1

      const subs: SubItem[] = []
      for (const cat of orderedCats) {
        const list = buckets.get(cat.id) ?? []
        if (list.length === 0) continue
        if (showHeaders) {
          subs.push({
            kind: 'header',
            label: cat.name,
            path: `__cat:${cat.id}`,
            match: () => false,
            headerKey: cat.id,
            Icon: FolderTree,
            requirePermAny: DOCUMENTS_NAV_PERMS,
          })
        }
        for (const item of list) {
          subs.push({
            label: item.templateName,
            path: item.to,
            match: ({ pathname, search }) => {
              if (pathname !== '/documents/templates') return false
              return new URLSearchParams(search).get('template') === item.templateId
            },
            headerKey: showHeaders ? cat.id : undefined,
            requirePermAny: DOCUMENTS_NAV_PERMS,
          })
        }
      }
      return subs
    })()

    const documentsGroup: NavGroup = {
      id: 'dokumenter',
      label: 'Dokumenter',
      icon: FileText,
      modules: [
        {
          to: '/documents',
          label: 'Dokumenter',
          end: false,
          icon: FileText,
          subs: [...documentsFixedSubs, ...documentsPinnedSubs],
          permAny: DOCUMENTS_NAV_PERMS,
          moduleSlug: 'documents',
          flatSubs: true,
        },
      ],
    }

    // Register group — strukturerte registre på tvers av regelverk
    // (kjemikalier, leverandører, GDPR-behandlingsprotokoll, …). Same
    // flatSubs shape as Sjekklister / Undersøkelser / Dokumenter.
    const registersFixedSubs: SubItem[] = [
      {
        label: 'Analyse',
        path: '/registers/analyse',
        Icon: BarChart3,
        match: ({ pathname }) => pathname === '/registers/analyse',
        requirePermAny: REGISTERS_NAV_PERMS,
      },
      {
        label: 'Innstillinger',
        path: '/admin/settings/registers',
        Icon: Settings,
        match: ({ pathname }) =>
          pathname.startsWith('/admin/settings/registers') ||
          pathname.startsWith('/registers/admin'),
        requirePermAny: REGISTERS_NAV_PERMS,
      },
    ]

    const registerTypeSubs: SubItem[] = (() => {
      // Narrow by the top-bar regelverk filter: a type is visible when
      // it has no regulation tags (generic) OR at least one of its tags
      // is in the active regulation set. Mirrors the hub-page filter.
      const filteredNavItems = registersNav.items.filter(
        (it) =>
          it.regulationIds.length === 0 ||
          it.regulationIds.some((rid) => isRegulationActive(rid)),
      )
      const buckets = new Map<string, typeof registersNav.items>()
      for (const it of filteredNavItems) {
        const list = buckets.get(it.headerKey) ?? []
        list.push(it)
        buckets.set(it.headerKey, list)
      }
      const orderedCats = registersNav.categories
        .filter((c) => buckets.has(c.id))
        .filter((c) => isRegulationActive(c.regulationId))
        .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'nb'))
      const uncategorised = buckets.has('__uncat__')
        ? [{ id: '__uncat__', name: 'Uten kategori' }]
        : []
      const orderedKeys = [...orderedCats.map((c) => ({ id: c.id, name: c.name })), ...uncategorised]
      const showHeaders = orderedKeys.length > 1
      const subs: SubItem[] = []
      for (const cat of orderedKeys) {
        const list = buckets.get(cat.id) ?? []
        if (list.length === 0) continue
        if (showHeaders) {
          subs.push({
            kind: 'header',
            label: cat.name,
            path: `__cat:${cat.id}`,
            match: () => false,
            headerKey: cat.id,
            Icon: FolderTree,
            requirePermAny: REGISTERS_NAV_PERMS,
          })
        }
        for (const item of list) {
          subs.push({
            label: item.name,
            path: item.to,
            match: ({ pathname }) => pathname === item.to,
            headerKey: showHeaders ? cat.id : undefined,
            requirePermAny: REGISTERS_NAV_PERMS,
          })
        }
      }
      return subs
    })()

    const registersGroup: NavGroup = {
      id: 'register',
      label: 'Register',
      icon: Database,
      modules: [
        {
          to: '/registers',
          label: 'Register',
          end: false,
          icon: Database,
          subs: [...registersFixedSubs, ...registerTypeSubs],
          permAny: REGISTERS_NAV_PERMS,
          moduleSlug: 'registers',
          flatSubs: true,
        },
      ],
    }

    // Administrasjon group — single top-level umbrella for company
    // configuration, user / access management, integrations, workflow
    // automation, and system settings. Each of the five modules below
    // is a registered scope in `settingsRegistry`; the subs deep-link
    // to `/admin/settings/<scope>/<section>` so external bookmarks and
    // email links resolve to the same shell.
    //
    // Tilsynssaker keeps its sub-entry list since it's a standalone
    // Styringssystem group (not part of the Administrasjon umbrella).
    const tilsynsbrevSubs: SubItem[] = [
      {
        label: 'Tilsynsbrev',
        path: '/admin/tilsynsbrev',
        Icon: ScrollText,
        match: ({ pathname }) =>
          pathname === '/admin/tilsynsbrev' || pathname.startsWith('/admin/tilsynsbrev/'),
        requirePermAny: ['tilsynsbrev.upload', 'tilsynsbrev.view_confidential', 'module.view.admin'],
      },
    ]
    // Administrasjon umbrella — the AdminPage at /admin/settings/org
    // already contains every admin surface (Organisasjon · Brukere &
    // roller · Mal-pakker · Arbeidsflyt · Integrasjoner · Audit-logg)
    // as in-page tabs, so the sidebar collapses to a single entry.
    // Permission gating is the union of all subordinate scopes.
    const adminGroup: NavGroup = {
      id: 'administrasjon',
      label: 'Administrasjon',
      icon: Settings,
      modules: [
        {
          to: '/admin/settings/org',
          label: 'Administrasjon',
          end: false,
          icon: Settings,
          subs: [],
          permAny: ADMINISTRASJON_NAV_PERMS,
          flatSubs: true,
        },
      ],
    }

    // Oppgaver group — dynamic nav identical in shape to Sjekklister / Undersøkelser.
    // Fixed subs: Analyse, Alle oppgaver, Innstillinger.
    // Pinned templates follow, grouped by category with collapsible headers.
    const tasksFixedSubs: SubItem[] = [
      {
        label: 'Analyse',
        path: '/tasks/management/analyse',
        Icon: BarChart3,
        match: ({ pathname }) => pathname === '/tasks/management/analyse',
        requirePermAny: TASKS_NAV_PERMS,
      },
      {
        label: 'Alle oppgaver',
        path: '/tasks/management/alle',
        match: ({ pathname }) => pathname === '/tasks/management/alle',
        requirePermAny: TASKS_NAV_PERMS,
      },
      {
        label: 'Innstillinger',
        path: '/admin/settings/tasks',
        Icon: Settings,
        match: ({ pathname }) =>
          pathname.startsWith('/admin/settings/tasks') ||
          pathname.startsWith('/tasks/management/admin'),
        requirePermAny: TASKS_NAV_PERMS,
      },
    ]

    const tasksPinnedSubs: SubItem[] = (() => {
      const buckets = new Map<string, typeof tasksNav.items>()
      for (const it of tasksNav.items) {
        const list = buckets.get(it.headerKey) ?? []
        list.push(it)
        buckets.set(it.headerKey, list)
      }
      const orderedCats = tasksNav.categories
        .filter((c) => buckets.has(c.id))
        .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'nb'))
      const uncategorisedEntries = [...buckets.entries()].filter(([key]) => key === '__uncat__')
      const orderedKeys: { id: string; name: string }[] = [
        ...orderedCats.map((c) => ({ id: c.id, name: c.name })),
        ...(uncategorisedEntries.length > 0 ? [{ id: '__uncat__', name: 'Uten kategori' }] : []),
      ]
      const showHeaders = orderedKeys.length > 1
      const subs: SubItem[] = []
      for (const cat of orderedKeys) {
        const list = buckets.get(cat.id) ?? []
        if (list.length === 0) continue
        if (showHeaders) {
          subs.push({
            kind: 'header',
            label: cat.name,
            path: `__cat:${cat.id}`,
            match: () => false,
            headerKey: cat.id,
            Icon: FolderTree,
            requirePermAny: TASKS_NAV_PERMS,
          })
        }
        for (const item of list) {
          subs.push({
            label: item.name,
            path: item.to,
            match: ({ pathname, search }) => {
              if (pathname !== '/tasks/management') return false
              return new URLSearchParams(search).get('template') === item.templateSlug
            },
            headerKey: showHeaders ? cat.id : undefined,
            requirePermAny: TASKS_NAV_PERMS,
          })
        }
      }
      return subs
    })()

    const tasksGroup: NavGroup = {
      id: 'oppgaver',
      label: 'Oppgaver',
      icon: Kanban,
      modules: [
        {
          to: '/tasks/management',
          label: 'Oppgaver',
          end: false,
          icon: Kanban,
          subs: [...tasksFixedSubs, ...tasksPinnedSubs],
          permAny: TASKS_NAV_PERMS,
          moduleSlug: 'tasks',
          flatSubs: true,
        },
      ],
    }

    // Møter — fixed Analyse + Innstillinger + pinned templates grouped by
    // category, mirrors surveyGroup / documentsGroup.
    const meetingsFixedSubs: SubItem[] = [
      {
        label: 'Analyse',
        path: '/meetings/analyse',
        Icon: BarChart3,
        match: ({ pathname }) => pathname === '/meetings/analyse',
        requirePermAny: MEETINGS_NAV_PERMS,
      },
      {
        label: 'Agenda-restanser',
        path: '/meetings/agenda-backlog',
        Icon: Inbox,
        match: ({ pathname }) => pathname === '/meetings/agenda-backlog',
        requirePermAny: MEETINGS_NAV_PERMS,
        badgeCount: amuBacklogPendingCount,
      },
      {
        label: 'Innstillinger',
        path: '/admin/settings/meetings',
        Icon: Settings,
        match: ({ pathname }) =>
          pathname.startsWith('/admin/settings/meetings') ||
          pathname.startsWith('/meetings/admin'),
        requirePerm: 'meetings.manage',
      },
    ]
    const meetingsPinnedSubs: SubItem[] = (() => {
      const pinned = meetingsNav.items.filter((it) => it.navPinned)
      if (pinned.length === 0) return []
      const buckets = new Map<string, typeof pinned>()
      for (const it of pinned) {
        const list = buckets.get(it.headerKey) ?? []
        list.push(it)
        buckets.set(it.headerKey, list)
      }
      const orderedCats = meetingsNav.categories
        .filter((c) => buckets.has(c.id))
        .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'nb'))
      const uncategorised = buckets.has('__uncat__') ? [{ id: '__uncat__', name: 'Uten kategori' }] : []
      const orderedKeys = [...orderedCats.map((c) => ({ id: c.id, name: c.name })), ...uncategorised]
      const showHeaders = orderedKeys.length > 1
      const subs: SubItem[] = []
      for (const cat of orderedKeys) {
        const list = buckets.get(cat.id) ?? []
        if (list.length === 0) continue
        if (showHeaders) {
          subs.push({
            kind: 'header',
            label: cat.name,
            path: `__cat:${cat.id}`,
            match: () => false,
            headerKey: cat.id,
            Icon: FolderTree,
            requirePermAny: MEETINGS_NAV_PERMS,
          })
        }
        for (const item of list) {
          subs.push({
            label: item.templateName,
            path: item.to,
            match: ({ pathname, search }) => {
              if (pathname !== '/meetings') return false
              return new URLSearchParams(search).get('template') === item.templateId
            },
            headerKey: showHeaders ? cat.id : undefined,
            requirePermAny: MEETINGS_NAV_PERMS,
          })
        }
      }
      return subs
    })()

    const meetingsGroup: NavGroup = {
      id: 'moter',
      label: 'Møter',
      icon: CalendarDays,
      modules: [
        {
          to: '/meetings',
          label: 'Møter',
          end: false,
          icon: CalendarDays,
          subs: [...meetingsFixedSubs, ...meetingsPinnedSubs],
          permAny: MEETINGS_NAV_PERMS,
          moduleSlug: 'meetings',
          flatSubs: true,
        },
      ],
    }

    // Varslinger — top-level module, same shape as Sjekklister: fixed
    // Analyse / Alle / Innstillinger + pinned templates grouped by category.
    const alertsFixedSubs: SubItem[] = [
      {
        label: 'Analyse',
        path: '/alerts/analyse',
        Icon: BarChart3,
        match: ({ pathname }) => pathname === '/alerts/analyse',
        requirePermAny: ALERTS_NAV_PERMS,
      },
      {
        label: 'Alle saker',
        path: '/alerts/alle',
        match: ({ pathname }) => pathname === '/alerts/alle',
        requirePermAny: ALERTS_NAV_PERMS,
      },
      {
        label: 'Innstillinger',
        path: '/alerts/admin',
        Icon: Settings,
        match: ({ pathname }) => pathname.startsWith('/alerts/admin'),
        requirePerm: 'alerts.manage',
      },
      // Platform-admin-only: cross-org dedup-grupper. The substrate
      // (org_alert_dedup_groups, _126400/_126700) and the admin RPCs
      // (_127800) only accept calls from platform admins; hiding the
      // link here keeps non-admins from seeing a dead-end. AML § 2A-7 (5).
      ...(isPlatformAdmin
        ? [
            {
              label: 'Cross-org dedup-grupper',
              path: '/admin/varsling/dedup-grupper',
              Icon: ShieldCheck,
              match: ({ pathname }: { pathname: string }) =>
                pathname.startsWith('/admin/varsling/dedup-grupper'),
              requirePermAny: ALERTS_NAV_PERMS,
            } satisfies SubItem,
          ]
        : []),
    ]
    const alertsPinnedSubs: SubItem[] = (() => {
      const pinned = alertsNav.items.filter((it) => it.navPinned)
      if (pinned.length === 0) return []
      const buckets = new Map<string, typeof pinned>()
      for (const it of pinned) {
        const list = buckets.get(it.headerKey) ?? []
        list.push(it)
        buckets.set(it.headerKey, list)
      }
      const orderedCats = alertsNav.categories
        .filter((c) => buckets.has(c.id))
        .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'nb'))
      const uncategorised = buckets.has('__uncat__') ? [{ id: '__uncat__', name: 'Uten kategori' }] : []
      const orderedKeys = [...orderedCats.map((c) => ({ id: c.id, name: c.name })), ...uncategorised]
      const showHeaders = orderedKeys.length > 1
      const subs: SubItem[] = []
      for (const cat of orderedKeys) {
        const list = buckets.get(cat.id) ?? []
        if (list.length === 0) continue
        if (showHeaders) {
          subs.push({
            kind: 'header',
            label: cat.name,
            path: `__cat:${cat.id}`,
            match: () => false,
            headerKey: cat.id,
            Icon: FolderTree,
            requirePermAny: ALERTS_NAV_PERMS,
          })
        }
        for (const item of list) {
          subs.push({
            label: item.templateName,
            path: item.to,
            match: ({ pathname, search }) => {
              if (pathname !== '/alerts') return false
              return new URLSearchParams(search).get('template') === item.templateId
            },
            headerKey: showHeaders ? cat.id : undefined,
            requirePermAny: ALERTS_NAV_PERMS,
          })
        }
      }
      return subs
    })()
    const alertsGroup: NavGroup = {
      id: 'varslinger',
      label: 'Varslinger',
      icon: AlertTriangle,
      modules: [
        {
          to: '/alerts',
          label: 'Varslinger',
          end: false,
          icon: AlertTriangle,
          subs: [...alertsFixedSubs, ...alertsPinnedSubs],
          permAny: ALERTS_NAV_PERMS,
          moduleSlug: 'alerts',
          flatSubs: true,
        },
      ],
    }

    // Risiko hazard-category pinned presets — exposed as quick filters
    // under Oversikt → Risikoanalyse so any analyse session opens
    // pre-narrowed to the relevant fareklasse.
    const RISK_HAZARD_PRESETS: { id: string; label: string }[] = [
      { id: 'psychosocial', label: 'Psykososial (AML § 4-3)' },
      { id: 'physical', label: 'Fysisk' },
      { id: 'chemical', label: 'Kjemisk' },
      { id: 'ergonomic', label: 'Ergonomisk' },
      { id: 'fire', label: 'Brann/eksplosjon' },
      { id: 'electrical', label: 'Elektrisk' },
      { id: 'environmental', label: 'Ytre miljø' },
    ]
    const riskPinnedSubs: SubItem[] = RISK_HAZARD_PRESETS.map((c) => ({
      label: c.label,
      path: `/risk/analyse?hazardCategory=${c.id}`,
      match: ({ pathname, search }) => {
        if (pathname !== '/risk/analyse') return false
        return new URLSearchParams(search).get('hazardCategory') === c.id
      },
      requirePermAny: RISK_NAV_PERMS,
    }))

    // Composite "Oversikt" group — sits at the top of the merged nav
    // since it's the org-wide entry point that pulls in widgets from
    // every other module group below it. Risiko-modulen lives here as
    // sub-items rather than a separate top-level group so Oversikt
    // becomes the single "tverrgående bilde"-destinasjon.
    const overviewNavPerms: PermissionKey[] = [
      ...COMPLIANCE_NAV_PERMS,
      ...SURVEY_NAV_PERMS,
      ...LEARNING_NAV_PERMS,
      'module.view.tasks',
    ]
    const overviewFixedSubs: SubItem[] = [
      {
        label: 'Mine favoritter',
        path: '/favoritter',
        Icon: Star,
        match: ({ pathname }) => pathname.startsWith('/favoritter'),
        requirePermAny: overviewNavPerms,
      },
      {
        label: 'HMS-oversikt',
        path: '/overview/hms',
        Icon: Activity,
        match: ({ pathname }) => pathname === '/overview/hms',
        requirePermAny: overviewNavPerms,
      },
      {
        label: 'Risikoanalyse',
        path: '/risk/analyse',
        Icon: ShieldAlert,
        match: ({ pathname, search }) =>
          pathname === '/risk/analyse' && !new URLSearchParams(search).get('hazardCategory'),
        requirePermAny: RISK_NAV_PERMS,
      },
      {
        label: 'Risikoregister',
        path: '/risk/register',
        Icon: ClipboardList,
        match: ({ pathname }) => pathname.startsWith('/risk/register'),
        requirePermAny: RISK_NAV_PERMS,
      },
      {
        label: 'Regelverk-dekning',
        path: '/overview/regelverk',
        Icon: ScrollText,
        match: ({ pathname }) => pathname.startsWith('/overview/regelverk'),
        requirePermAny: ADMINISTRASJON_NAV_PERMS,
      },
      {
        label: 'Internkontroll',
        path: '/overview/internkontroll',
        Icon: ShieldCheck,
        match: ({ pathname, search }) => {
          if (
            !(
              pathname === '/internkontroll' ||
              pathname === '/overview/internkontroll' ||
              pathname.startsWith('/overview/internkontroll/dashboard')
            )
          ) {
            return false
          }
          // The new unified page exposes sections via ?section=…; this
          // top-level entry only highlights when no specific section is
          // active or when the user is on Oversikt.
          const sec = new URLSearchParams(search).get('section') ?? 'oversikt'
          return sec === 'oversikt'
        },
        requirePermAny: overviewNavPerms,
      },
      {
        label: 'Krav',
        path: '/overview/internkontroll?section=krav',
        Icon: Scale,
        match: ({ pathname, search }) =>
          (pathname === '/overview/internkontroll' || pathname === '/internkontroll') &&
          new URLSearchParams(search).get('section') === 'krav',
        requirePermAny: overviewNavPerms,
      },
      {
        label: 'Kontroller',
        path: '/overview/internkontroll?section=kontroller',
        Icon: ShieldCheck,
        match: ({ pathname, search }) =>
          (pathname === '/overview/internkontroll' || pathname === '/internkontroll') &&
          new URLSearchParams(search).get('section') === 'kontroller',
        requirePermAny: overviewNavPerms,
      },
      {
        label: 'Gap-analyse',
        path: '/overview/internkontroll?section=gap',
        Icon: ShieldAlert,
        match: ({ pathname, search }) =>
          pathname.startsWith('/overview/internkontroll/gaps') ||
          ((pathname === '/overview/internkontroll' || pathname === '/internkontroll') &&
            new URLSearchParams(search).get('section') === 'gap'),
        requirePermAny: overviewNavPerms,
      },
      {
        label: 'Årshjul',
        path: '/overview/internkontroll?section=aarshjul',
        Icon: CalendarClock,
        match: ({ pathname, search }) =>
          (pathname === '/overview/internkontroll' || pathname === '/internkontroll') &&
          new URLSearchParams(search).get('section') === 'aarshjul',
        requirePermAny: overviewNavPerms,
      },
      {
        label: 'Tiltak',
        path: '/overview/internkontroll?section=tiltak',
        Icon: ListChecks,
        match: ({ pathname, search }) =>
          pathname.startsWith('/overview/internkontroll/plan') ||
          ((pathname === '/overview/internkontroll' || pathname === '/internkontroll') &&
            new URLSearchParams(search).get('section') === 'tiltak'),
        requirePermAny: overviewNavPerms,
      },
      {
        label: 'Prosjekter',
        path: '/overview/internkontroll?section=prosjekter',
        Icon: FolderKanban,
        match: ({ pathname, search }) =>
          (pathname === '/overview/internkontroll' || pathname === '/internkontroll') &&
          new URLSearchParams(search).get('section') === 'prosjekter',
        requirePermAny: overviewNavPerms,
      },
      {
        label: 'Revisjon-logg',
        path: '/overview/internkontroll?section=revisjon',
        Icon: History,
        match: ({ pathname, search }) =>
          (pathname === '/overview/internkontroll' || pathname === '/internkontroll') &&
          new URLSearchParams(search).get('section') === 'revisjon',
        requirePermAny: overviewNavPerms,
      },
      {
        label: 'Benchmarking',
        path: '/benchmarking',
        Icon: BarChart3,
        match: ({ pathname }) => pathname.startsWith('/benchmarking'),
        requirePermAny: overviewNavPerms,
      },
      {
        label: 'Compliance Studio',
        path: '/compliance-studio',
        Icon: Wand2,
        match: ({ pathname }) => pathname.startsWith('/compliance-studio'),
        requirePermAny: ADMINISTRASJON_NAV_PERMS,
      },
    ]
    // Hazard-pinned subs are added under the same "Risikoanalyse" entry
    // — they share the /risk/analyse route and only differ in query
    // string. Rendered after the fixed subs so the layout reads as
    // "destinations" → "snarveier".
    const hmsOverviewGroup: NavGroup = {
      id: 'hms-oversikt',
      label: 'Oversikt',
      icon: Activity,
      modules: [
        {
          to: '/overview/hms',
          label: 'Oversikt',
          end: false,
          icon: Activity,
          subs: [...overviewFixedSubs, ...riskPinnedSubs],
          permAny: overviewNavPerms,
          flatSubs: true,
        },
      ],
    }

    // Partner-konsoll — only shown when the user has at least one
    // active partner_memberships row. The group sits at the very
    // beginning of the merged list so consultants land on it first
    // when they sign in (partner consoles are their primary
    // workspace, not HMS-oversikt for any single customer).
    const partnerGroup: NavGroup | null = isPartnerMember
      ? {
          id: 'partner-konsoll',
          label: 'Partner-konsoll',
          icon: Briefcase,
          modules: [
            {
              to: '/partner',
              label: 'Partner-konsoll',
              end: true,
              icon: Briefcase,
              subs: [],
              flatSubs: true,
            },
            {
              to: '/partner/branding',
              label: 'Branding',
              end: false,
              icon: Wand2,
              subs: [],
              flatSubs: true,
            },
          ],
        }
      : null

    // Internkontroll — IK § 5 unified surface (Krav · Kontroller · Gap
    // · Årshjul · Tiltak · Prosjekter · Revisjon). The page already
    // exposes all sections internally; nav points to the default
    // landing.
    const internkontrollGroup: NavGroup = {
      id: 'internkontroll',
      label: 'Internkontroll',
      icon: ShieldCheck,
      modules: [
        {
          to: '/internkontroll',
          label: 'Internkontroll',
          end: false,
          icon: ShieldCheck,
          subs: [],
          permAny: ADMINISTRASJON_NAV_PERMS,
          flatSubs: true,
        },
      ],
    }

    // Tilsynssaker promoted from Administrasjon — a tilsynssak triggers
    // pålegg that change the styringssystem; it's a governance event,
    // not an admin task. (Recommendation §3.1.)
    const tilsynssakerGroup: NavGroup = {
      id: 'tilsynssaker',
      label: 'Tilsynssaker',
      icon: ScrollText,
      modules: [
        {
          to: '/admin/tilsynsbrev',
          label: 'Tilsynssaker',
          end: false,
          icon: ScrollText,
          subs: tilsynsbrevSubs,
          permAny: ['tilsynsbrev.upload', 'tilsynsbrev.view_confidential', 'module.view.admin'],
          flatSubs: true,
        },
      ],
    }

    // Avvik — top-level Daglig drift entry. Avvik are tasks with
    // sourceType=avvik|nestenulykke; the existing /avvik redirect
    // routes into the tasks module with the right filter applied.
    const avvikGroup: NavGroup = {
      id: 'avvik',
      label: 'Avvik',
      icon: AlertTriangle,
      modules: [
        {
          to: '/avvik',
          label: 'Avvik',
          end: true,
          icon: AlertTriangle,
          subs: [],
          permAny: TASKS_NAV_PERMS,
          flatSubs: true,
        },
      ],
    }

    // Bevisjournal + Rammeverk & gap folded into Internkontroll
    // (Nov 2026 cleanup). The Revisjon section IS the evidence ledger;
    // the rammeverk filter chip handles framework selection. Old
    // /bevisjournal and /rammeverk URLs redirect into Internkontroll
    // so external links and bookmarks keep working. The /iso/* and
    // /overview/regelverk deep-dives are still routable directly.

    // Four-section information architecture (May 2026 restructure).
    // - Mitt arbeid: personal cross-module entry points (Innboks,
    //   Mine oppgaver, Mine signaturer).
    // - Daglig drift: operational modules the user touches every day.
    // - Styringssystem: the governance backbone — controls, evidence,
    //   frameworks, statutoriske fora, tilsyn.
    // - Administrasjon: configuration surfaces.
    // Partner-konsoll sits outside the section model since it's a
    // consultant-scoped workspace that pre-empts the customer view.
    const mittArbeidGroup: NavGroup = {
      id: 'mitt-arbeid',
      label: 'Mitt arbeid',
      icon: Inbox,
      modules: [
        {
          to: '/innboks',
          label: 'Innboks',
          end: true,
          icon: Inbox,
          subs: [],
          flatSubs: true,
        },
        {
          // Mine oppgaver — focused page that filters task_items by
          // display_name match (assignee or owner). A user_id link is
          // a follow-up; until then the page warns when display_name
          // isn't set and is transparent about the name-string match.
          to: '/mitt-arbeid/oppgaver',
          label: 'Mine oppgaver',
          end: false,
          icon: ListChecks,
          subs: [],
          flatSubs: true,
        },
        {
          to: '/mitt-arbeid/signaturer',
          label: 'Mine signaturer',
          end: false,
          icon: ScrollText,
          subs: [],
          flatSubs: true,
        },
      ],
    }
    const mittArbeidSection: NavSection = {
      id: 'mitt-arbeid',
      label: 'Mitt arbeid',
      icon: Inbox,
      groups: [mittArbeidGroup],
    }
    const dagligDriftSection: NavSection = {
      id: 'daglig-drift',
      label: 'Daglig drift',
      icon: ClipboardList,
      groups: [
        complianceGroup,
        avvikGroup,
        surveyGroup,
        documentsGroup,
        meetingsGroup,
        learningGroup,
        tasksGroup,
      ],
    }
    const styringssystemSection: NavSection = {
      id: 'styringssystem',
      label: 'Styringssystem',
      icon: ShieldCheck,
      groups: [
        hmsOverviewGroup,
        internkontrollGroup,
        alertsGroup,
        registersGroup,
        tilsynssakerGroup,
      ],
    }
    const administrasjonSection: NavSection = {
      id: 'administrasjon',
      label: 'Administrasjon',
      icon: Settings,
      groups: [adminGroup],
    }

    const sections: NavSection[] = [
      mittArbeidSection,
      dagligDriftSection,
      styringssystemSection,
      administrasjonSection,
    ]

    if (partnerGroup) {
      return [
        { id: 'partner', label: 'Partner', icon: Briefcase, groups: [partnerGroup] },
        ...sections,
      ]
    }
    return sections
  }, [
    complianceNav.items,
    complianceNav.categories,
    complianceNav.packShortNameBySlug,
    surveyNav.items,
    surveyNav.categories,
    surveyNav.packShortNameBySlug,
    documentNav.items,
    documentNav.categories,
    learningNav.items,
    learningNav.categories,
    registersNav.items,
    registersNav.categories,
    tasksNav.items,
    tasksNav.categories,
    meetingsNav.items,
    meetingsNav.categories,
    alertsNav.items,
    alertsNav.categories,
    isRegulationActive,
    activeRegulationIds,
    isPartnerMember,
    isPlatformAdmin,
    govOutboxPendingCount,
    amuBacklogPendingCount,
    certExpiryWarningCount,
  ])

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
  // a breakpoint (768 / 1280), not on every resize pixel.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mqHidden = window.matchMedia('(max-width: 767px)')
    const mqMini = window.matchMedia('(max-width: 1279px)')
    const update = () => {
      setAutoState(
        mqHidden.matches ? 'hidden' : mqMini.matches ? 'mini' : 'expanded',
      )
    }
    update()
    mqHidden.addEventListener('change', update)
    mqMini.addEventListener('change', update)
    return () => {
      mqHidden.removeEventListener('change', update)
      mqMini.removeEventListener('change', update)
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

  const orgDisplayName = organization?.name?.trim() ?? ''
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

        {/* ── Rail 2: 3-state — expanded (full labels) / mini (icon-only) / hidden ── */}
        {rail2State === 'expanded' && (
          <aside className="flex w-[var(--shell-rail2-w)] shrink-0 flex-col overflow-hidden bg-[var(--ui-nav-rail-mid)]">
            <nav className="flex-1 overflow-y-auto px-2 py-4" aria-label="Section navigation">
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
                        return (
                          <NavLink
                            key={`${group.id}:${mod.to}`}
                            to={mod.to}
                            end={mod.end}
                            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                              isActiveMod
                                ? 'bg-white/10 text-white'
                                : 'text-white/70 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <ModIcon className="size-4 shrink-0 opacity-80" aria-hidden />
                            <span className="flex-1 truncate">{mod.label}</span>
                          </NavLink>
                        )
                      }),
                    )}
                  </div>
                )
              })}
            </nav>
          </aside>
        )}

        {rail2State === 'mini' && (
          <aside
            className="flex w-[var(--shell-rail2-w)] shrink-0 flex-col overflow-hidden bg-[var(--ui-nav-rail-mid)]"
            aria-label="Section navigation"
          >
            <nav className="flex-1 overflow-y-auto px-1.5 py-3">
              {visibleSections.map((section, sectionIdx) => (
                <div
                  key={section.id}
                  className={
                    sectionIdx > 0
                      ? 'mt-3 border-t border-white/10 pt-3'
                      : undefined
                  }
                >
                  {section.groups.flatMap((group) =>
                    group.modules.map((mod) => {
                      const ModIcon = mod.icon
                      const isActiveMod = activeModule.to === mod.to
                      return (
                        <NavLink
                          key={`${group.id}:${mod.to}`}
                          to={mod.to}
                          end={mod.end}
                          title={`${section.label} · ${mod.label}`}
                          aria-label={mod.label}
                          className={`mx-auto flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                            isActiveMod
                              ? 'bg-white/15 text-white'
                              : 'text-white/65 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <ModIcon className="size-[1.125rem] shrink-0 opacity-85" aria-hidden />
                        </NavLink>
                      )
                    }),
                  )}
                </div>
              ))}
            </nav>
          </aside>
        )}

        {/* ── Content area ─────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Utility bar — page background colour */}
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-neutral-300/40 bg-[var(--ui-surface)] px-4 md:px-5">
            <div className="min-w-0 flex-1" />
            <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
              {supabaseConfigured ? (
                <>
                  <OrgSwitcher variant="sidebar" />
                  <ShellCompanyBlock name={orgDisplayName} variant="sidebar" />
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
          recentPaths={recentPaths}
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
  // Rail-2 toggle tooltip — same shape as the sidebar mode. The toggle
  // in topbar mode pre-configures the sidebar's rail2 state for the
  // next time the user switches modes.
  const toggleTitleTop = `Navigasjon: ${rail2StateLabel(rail2State)} → ${rail2StateLabel(cycleRail2State(rail2State))} ([)`
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
          <ShellCompanyBlock name={orgDisplayName} variant="topbar" />
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
            <div className="flex min-w-0 shrink-0 items-center gap-2">
              <NavLink to="/app" className="flex shrink-0 items-center gap-2" aria-label={t('shell.homeAria')}>
                <KlarertLogo size={28} variant="onDark" />
              </NavLink>
              <Button
                variant="ghost"
                size="icon"
                onClick={cycleRail2}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  rail2State === 'hidden' ? 'bg-white/15 text-white ring-1 ring-[color-mix(in_srgb,var(--color-atics-gold)_50%,transparent)]' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
                aria-expanded={rail2State !== 'hidden'}
                aria-label={toggleTitleTop}
                title={toggleTitleTop}
              >
                {rail2State === 'hidden' ? (
                  <PanelRight className="size-[1.125rem] shrink-0" aria-hidden />
                ) : (
                  <PanelLeft className="size-[1.125rem] shrink-0" aria-hidden />
                )}
              </Button>
            </div>
            {topBarUtilities}
          </div>

          {/* md+: single row — logo · groups · utilities */}
          <div className="hidden items-center justify-between gap-4 md:flex">
            <div className="flex shrink-0 items-center gap-2">
              <NavLink to="/app" className="flex items-center gap-2" aria-label={t('shell.homeAria')}>
                <KlarertLogo size={28} variant="onDark" />
              </NavLink>
              <Button
                variant="ghost"
                size="icon"
                onClick={cycleRail2}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  rail2State === 'hidden' ? 'bg-white/15 text-white ring-1 ring-[color-mix(in_srgb,var(--color-atics-gold)_50%,transparent)]' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
                aria-expanded={rail2State !== 'hidden'}
                aria-label={toggleTitleTop}
                title={toggleTitleTop}
              >
                {rail2State === 'hidden' ? (
                  <PanelRight className="size-[1.125rem] shrink-0" aria-hidden />
                ) : (
                  <PanelLeft className="size-[1.125rem] shrink-0" aria-hidden />
                )}
              </Button>
            </div>
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
                  return (
                    <NavLink
                      key={`${group.id}:${mod.to}`}
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
        recentPaths={recentPaths}
      />
    </div>
  )
}

// Keyboard-only escape hatch past the 30+ tab stops in the rails. The
// link is visually hidden until focused (Tab from page load), then
// jumps focus to <main id="main-content"> when activated. WCAG 2.4.1.
function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-[var(--ui-nav-rail)] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-atics-gold)]"
    >
      Hopp til innhold
    </a>
  )
}

export { BookOpen, PanelLeft }
