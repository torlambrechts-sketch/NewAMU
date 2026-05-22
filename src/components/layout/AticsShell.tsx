import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Boxes,
  Briefcase,
  Building2,
  ChevronDown,
  Database,
  ChevronRight,
  ClipboardList,
  FileText,
  FolderTree,
  GraduationCap,
  History,
  Home,
  Inbox,
  Kanban,
  KeyRound,
  LayoutTemplate,
  Megaphone,
  PanelLeft,
  PanelRight,
  Plug,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Settings,
  Star,
  UserCheck,
  UserSearch,
  Users,
  Wand2,
  Workflow,
  CalendarDays,
  LayoutDashboard,
} from 'lucide-react'
import { NotificationTray } from '../notifications/NotificationTray'
import { SurveyPendingInvitesBanner } from '../../../modules/survey/SurveyPendingInvitesBanner'
import { useT } from '../../hooks/useT'
import { LanguageDropdown } from '../LanguageDropdown'
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
  /**
   * 'header' renders the row as a clickable section heading (no NavLink)
   * that toggles expand/collapse for its child items. Items below a
   * header are linked to it via `headerKey`; the header carries the
   * same value. Defaults to 'item' (the existing link behaviour).
   * path/match are still required but ignored for headers.
   */
  kind?: 'item' | 'header'
  /**
   * Stable identifier shared between a header row and the items that
   * belong to it. Items without `headerKey` (e.g. fixed subs like
   * Analyse / Innstillinger) always render; items with `headerKey`
   * render only when the parent header is expanded.
   */
  headerKey?: string
  /**
   * Render a numeric counter pill on the row when > 0. Used by the
   * gov-outbox manual-triage sub-link so admins see at a glance how
   * many rows are awaiting human action.
   */
  badgeCount?: number
  /**
   * Optional colour override for `badgeCount`. Defaults to amber
   * (`#c9a227`) for queue-style badges; cert-rotation uses `'danger'`
   * to signal time-critical action (NSM Grunnprinsipp 2.4).
   */
  badgeTone?: 'amber' | 'danger'
}

function visibleSubs(
  subs: SubItem[],
  gateNav: boolean,
  can: (k: PermissionKey) => boolean,
): SubItem[] {
  const passes = (s: SubItem) => {
    if (!gateNav) return true
    if (s.requirePermAny?.length) return s.requirePermAny.some((k) => can(k))
    if (s.requirePerm) return can(s.requirePerm)
    return true
  }
  const filtered = subs.filter(passes)
  // Drop dangling headers — a header followed by no items (or by another
  // header) would render as an empty category label. Walk once: keep a
  // header only if at least one non-header item follows it before the
  // next header.
  const out: SubItem[] = []
  for (let i = 0; i < filtered.length; i++) {
    const s = filtered[i]!
    if (s.kind === 'header') {
      let hasItem = false
      for (let j = i + 1; j < filtered.length; j++) {
        const next = filtered[j]!
        if (next.kind === 'header') break
        hasItem = true
        break
      }
      if (!hasItem) continue
    }
    out.push(s)
  }
  return out
}

// Permission gates for the umbrella Administrasjon menu and its 5
// modules. The umbrella gate (`ADMINISTRASJON_NAV_PERMS`) hides the
// whole group from non-admins; the per-module gates filter which of
// the 5 modules a specialist role (DPO, integrasjonsansvarlig,
// workflow-eier) sees. Sub-pages enforce their own page-level perms.
const ADMINISTRASJON_NAV_PERMS: PermissionKey[] = [
  'module.view.admin',
  'users.manage',
  'users.invite',
  'roles.manage',
  'employee.manage',
  'workflows.manage',
  'module.view.workflow',
]
const ORG_NAV_PERMS: PermissionKey[] = [
  'module.view.admin',
  'users.manage',
  'employee.manage',
]
const USERS_ROLES_NAV_PERMS: PermissionKey[] = [
  'users.manage',
  'users.invite',
  'roles.manage',
  'delegation.manage',
]
const INTEGRATIONS_NAV_PERMS: PermissionKey[] = [
  'module.view.admin',
  'workflows.manage',
]
const WORKFLOWS_NAV_PERMS: PermissionKey[] = [
  'workflows.manage',
  'workflows.compose',
  'module.view.workflow',
  'module.view.admin',
]
const SETTINGS_NAV_PERMS: PermissionKey[] = [
  'module.view.admin',
  'roles.manage',
]

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
  /** When set, user needs any of these permissions (overrides `perm` for the gate). */
  permAny?: PermissionKey[]
  /** Maps to the slug in the modules table; item is hidden when the module is disabled. */
  moduleSlug?: string
  /**
   * When true, this module's sub-items render at module-level size and
   * indent instead of the default compact sub-item styling. Used when the
   * sub-items represent first-class destinations equal in importance to
   * the parent (e.g. pinned templates under "Sjekklister").
   */
  flatSubs?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Canonical information architecture. Each top-level group is a kept module
// (compliance/checklist, survey, documents, meetings, registers, tasks,
// learning) plus the cross-module HMS-oversikt + Organisasjon admin group.
// ─────────────────────────────────────────────────────────────────────────────

// Permission gate for the synthetic Sjekklister menu — matches the /compliance
// route gate in ROUTE_PERMISSION_ANY so anyone who can reach the page also
// sees the menu entry.
const COMPLIANCE_NAV_PERMS: PermissionKey[] = [
  'module.view.dashboard',
  'checklist.manage',
]

const ISO_IMS_NAV_PERMS: PermissionKey[] = [
  'module.view.dashboard',
  'checklist.manage',
]

// Permission gate for the synthetic Undersøkelser menu — anyone who can
// view a survey-relevant module sees it. Mirrors the broad permAny pattern
// used for Sjekklister so view-only roles aren't excluded.
const SURVEY_NAV_PERMS: PermissionKey[] = [
  'module.view.survey',
  'module.view.dashboard',
  'survey.manage',
  'survey.results.view',
]

// Permission gate for the synthetic Læring menu — same broad pattern as
// the two siblings so view-only/dashboard roles can still navigate.
const LEARNING_NAV_PERMS: PermissionKey[] = [
  'module.view.learning',
  'module.view.dashboard',
]

// Permission gate for the synthetic Oppgaver menu — same broad pattern.
const TASKS_NAV_PERMS: PermissionKey[] = [
  'module.view.tasks',
  'module.view.dashboard',
]

// Permission gate for the synthetic Dokumenter menu — same broad pattern.
const DOCUMENTS_NAV_PERMS: PermissionKey[] = [
  'documents.view',
  'documents.edit',
  'documents.manage',
  'module.view.dashboard',
]

// Permission gate for the Register menu — broad pattern. The page-level RLS
// ensures per-record reads stay org-scoped.
const REGISTERS_NAV_PERMS: PermissionKey[] = [
  'module.view.dashboard',
  'documents.view',
]

// Møter nav permission gate — anyone with the meetings-view permission
// (or the broader dashboard / HMS roles) gets the menu. Page-level RLS
// ensures restricted/confidential rows stay hidden from non-participants.
const MEETINGS_NAV_PERMS: PermissionKey[] = [
  'module.view.meetings',
  'meetings.manage',
  'module.view.dashboard',
]

const ALERTS_NAV_PERMS: PermissionKey[] = [
  'module.view.alerts',
  'alerts.committee',
  'alerts.committee_confidential',
  'alerts.committee_escalated',
  'alerts.dpo',
  'alerts.manage',
  'module.view.dashboard',
]

// Permission gate for the Risiko menu — aggregate dashboard reads from
// compliance findings, tasks (avvik/nestenulykke/risiko/tiltak),
// deviations and alerts. Any role that can already see those modules
// gets the risk view; admins use module-level `is_active` to disable.
const RISK_NAV_PERMS: PermissionKey[] = [
  'module.view.dashboard',
  'checklist.manage',
  'incident.view',
  'incident.manage',
  'module.view.tasks',
]


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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function allModulesFrom(groups: NavGroup[]): NavModule[] {
  return groups.flatMap((g) => g.modules)
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

function subNavForPath(modules: NavModule[], pathname: string, search: string): SubItem[] {
  const mod = activeModuleForPath(modules, pathname, search)
  return mod.subs
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

const SUB_NAV_COLLAPSED_KEY = 'atics-sub-nav-collapsed'

function loadSubNavCollapsed(): boolean {
  try {
    return localStorage.getItem(SUB_NAV_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function saveSubNavCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(SUB_NAV_COLLAPSED_KEY, collapsed ? '1' : '0')
  } catch {
    /* ignore */
  }
}

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
  const mergedNavGroups = useMemo<NavGroup[]>(() => {
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
        label: 'Bibliotek',
        path: '/compliance/checklists/bibliotek',
        match: ({ pathname }) =>
          pathname === '/compliance/checklists/bibliotek' ||
          pathname === '/compliance/checklists/maler' ||
          pathname === '/compliance/checklists/aktivitet',
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
          subs: [],
          permAny: COMPLIANCE_NAV_PERMS,
          flatSubs: true,
        },
      ],
    }

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
    // Per-module nav perm constants (declared near the top of this
    // file) make sure a specialist role — e.g. integrasjons­ansvarlig
    // with only `workflows.manage` — sees the Integrasjoner/Arbeidsflyt
    // modules but not the rest.
    const isAdminSettings = (scope: string, section?: string) =>
      ({ pathname }: { pathname: string; search: string }) => {
        if (!pathname.startsWith(`/admin/settings/${scope}`)) return false
        if (!section) return true
        return pathname === `/admin/settings/${scope}/${section}` ||
          pathname.startsWith(`/admin/settings/${scope}/${section}/`)
      }
    // Organisasjon subs deep-link to the existing OrganisationPage tabs
    // (insights / settings / units / employees / mandates). The earlier
    // /admin/settings/organisation/* registry scope was just a row of
    // placeholder cards pointing here — collapsed it into direct links
    // so admins land on the real surface in one click.
    const matchOrgTab = (tab: string) =>
      ({ pathname, search }: { pathname: string; search: string }) => {
        if (pathname !== '/organisation') return false
        return new URLSearchParams(search).get('tab') === tab
      }
    const organisationSubs: SubItem[] = [
      {
        label: 'Analyse',
        path: '/organisation?tab=insights',
        Icon: BarChart3,
        match: ({ pathname, search }) => {
          if (pathname !== '/organisation') return false
          const t = new URLSearchParams(search).get('tab')
          return !t || t === 'insights' || t === 'orgchart'
        },
        requirePermAny: ORG_NAV_PERMS,
      },
      {
        label: 'Selskap',
        path: '/organisation?tab=settings',
        Icon: Building2,
        match: matchOrgTab('settings'),
        requirePermAny: ORG_NAV_PERMS,
      },
      {
        label: 'Avdelinger & enheter',
        path: '/organisation?tab=units',
        Icon: FolderTree,
        match: matchOrgTab('units'),
        requirePermAny: ORG_NAV_PERMS,
      },
      {
        label: 'Ansatte',
        path: '/organisation?tab=employees',
        Icon: Users,
        match: matchOrgTab('employees'),
        requirePermAny: ORG_NAV_PERMS,
      },
      {
        label: 'Mandater & verv',
        path: '/organisation?tab=mandates',
        Icon: UserCheck,
        match: matchOrgTab('mandates'),
        requirePermAny: ORG_NAV_PERMS,
      },
    ]
    const usersRolesSubs: SubItem[] = [
      {
        label: 'Interne brukere',
        path: '/admin/settings/users-roles/internal',
        Icon: Users,
        match: isAdminSettings('users-roles', 'internal'),
        requirePermAny: ['users.manage', 'users.invite'],
      },
      {
        label: 'Eksterne brukere',
        path: '/admin/settings/users-roles/external',
        Icon: UserSearch,
        match: isAdminSettings('users-roles', 'external'),
        requirePermAny: ['users.manage'],
      },
      {
        label: 'Roller & tilganger',
        path: '/admin/settings/users-roles/roles',
        Icon: ShieldCheck,
        match: isAdminSettings('users-roles', 'roles'),
        requirePerm: 'roles.manage',
      },
      {
        label: 'Funksjonelle roller',
        path: '/admin/settings/users-roles/functional-roles',
        Icon: UserCheck,
        match: isAdminSettings('users-roles', 'functional-roles'),
        requirePermAny: USERS_ROLES_NAV_PERMS,
      },
      {
        label: 'Delegering',
        path: '/admin/settings/users-roles/delegation',
        Icon: Users,
        match: isAdminSettings('users-roles', 'delegation'),
        requirePermAny: ['roles.manage', 'delegation.manage'],
      },
    ]
    // Per-provider gov-integration wizards live under
    // `/admin/integrations/<provider>`. The old combined
    // `/admin/settings/integrations/gov` route is kept here as a
    // deprecation-marked entry that opens the hub at `/admin/integrations`.
    const matchAdminIntegrations = (suffix: string) =>
      ({ pathname }: { pathname: string }) =>
        pathname === `/admin/integrations${suffix ? `/${suffix}` : ''}`
    const integrationsSubs: SubItem[] = [
      {
        label: 'Tilkoblede tjenester',
        path: '/admin/settings/integrations/providers',
        Icon: Plug,
        match: isAdminSettings('integrations', 'providers'),
        requirePermAny: INTEGRATIONS_NAV_PERMS,
      },
      {
        label: 'Statlige integrasjoner (oversikt)',
        path: '/admin/integrations',
        Icon: ShieldCheck,
        match: matchAdminIntegrations(''),
        requirePermAny: INTEGRATIONS_NAV_PERMS,
      },
      {
        label: 'Altinn / Maskinporten',
        path: '/admin/integrations/altinn',
        Icon: ShieldCheck,
        match: matchAdminIntegrations('altinn'),
        requirePermAny: INTEGRATIONS_NAV_PERMS,
      },
      {
        label: 'Arbeidstilsynet (RegInc)',
        path: '/admin/integrations/arbeidstilsynet',
        Icon: ShieldCheck,
        match: matchAdminIntegrations('arbeidstilsynet'),
        requirePermAny: INTEGRATIONS_NAV_PERMS,
      },
      {
        label: 'Datatilsynet',
        path: '/admin/integrations/datatilsynet',
        Icon: ShieldCheck,
        match: matchAdminIntegrations('datatilsynet'),
        requirePermAny: INTEGRATIONS_NAV_PERMS,
      },
      {
        label: 'NAV (DSOP)',
        path: '/admin/integrations/nav',
        Icon: ShieldCheck,
        match: matchAdminIntegrations('nav'),
        requirePermAny: INTEGRATIONS_NAV_PERMS,
      },
      {
        // Helsesektor: spes.helsetjl. § 3-3 + hol. § 12-3 a. Ingen regulator-
        // API — wizard'en lagrer kontakt-info + melding-mal i org_integrations
        // og helsetilsynet-build-melding edge-fn dispatcher som manuell
        // outbox-rad. Triage skjer i `/admin/integrations/utboks`.
        label: 'Helsetilsynet (helsesektor)',
        path: '/admin/integrations/helsetilsynet',
        Icon: ShieldCheck,
        match: matchAdminIntegrations('helsetilsynet'),
        requirePermAny: INTEGRATIONS_NAV_PERMS,
      },
      {
        // NSM Grunnprinsipp 2.4 — planlagt rotasjon av virksomhetssertifikat.
        // Red pip when ≥1 cert is within 30 days of expiry, driven by
        // useCertExpiryWarningCount (signing_cert_expires_at column from _123700).
        label: 'Sertifikat-rotasjon',
        path: '/admin/integrations/sertifikat-rotasjon',
        Icon: KeyRound,
        match: matchAdminIntegrations('sertifikat-rotasjon'),
        requirePermAny: ['integrations.cert_rotate', ...INTEGRATIONS_NAV_PERMS],
        badgeCount: certExpiryWarningCount,
        badgeTone: 'danger',
      },
      {
        label: 'Manuell utboks (statlige meldinger)',
        path: '/admin/integrations/utboks',
        Icon: ScrollText,
        match: matchAdminIntegrations('utboks'),
        requirePermAny: ['gov.outbox_triage', ...INTEGRATIONS_NAV_PERMS],
        badgeCount: govOutboxPendingCount,
      },
      {
        label: 'Webhooks & API',
        path: '/admin/settings/integrations/webhooks',
        Icon: Plug,
        match: isAdminSettings('integrations', 'webhooks'),
        requirePermAny: ['roles.manage', 'workflows.manage'],
      },
    ]
    // Arbeidsflyt subs deep-link to the real WorkflowBuilderPage tabs at
    // /workflow?tab=… . The earlier /admin/settings/workflows/* registry
    // scope was 5 placeholder cards sitting in front of the working
    // builder — same anti-pattern we removed for Organisasjon. The old
    // /workflow/admin sub was retired together with WorkflowModulePage.
    // Match the builder's own tab IDs: rules / library / runs /
    // approvals / evidence.
    const matchWorkflowTab = (tab: string) =>
      ({ pathname, search }: { pathname: string; search: string }) => {
        if (pathname !== '/workflow') return false
        return new URLSearchParams(search).get('tab') === tab
      }
    // Maler module — cross-module template browser. Subs deep-link to
    // /admin/templates with a source-filter query so admins land on
    // pre-filtered views (Sjekklister, Undersøkelser, Dokumenter,
    // Kurs, Register). AdminTemplatesPage reads ?source= on mount.
    const matchTemplateSource = (source: string | null) =>
      ({ pathname, search }: { pathname: string; search: string }) => {
        if (pathname !== '/admin/templates') return false
        const s = new URLSearchParams(search).get('source')
        return source === null ? !s : s === source
      }
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
    const malerSubs: SubItem[] = [
      {
        label: 'Alle maler',
        path: '/admin/templates',
        Icon: LayoutTemplate,
        match: matchTemplateSource(null),
        requirePermAny: SETTINGS_NAV_PERMS,
      },
      {
        label: 'Sjekklister',
        path: '/admin/templates?source=compliance',
        Icon: ClipboardList,
        match: matchTemplateSource('compliance'),
        requirePermAny: SETTINGS_NAV_PERMS,
      },
      {
        label: 'Undersøkelser',
        path: '/admin/templates?source=survey',
        Icon: Megaphone,
        match: matchTemplateSource('survey'),
        requirePermAny: SETTINGS_NAV_PERMS,
      },
      {
        label: 'Dokumenter',
        path: '/admin/templates?source=documents',
        Icon: FileText,
        match: matchTemplateSource('documents'),
        requirePermAny: SETTINGS_NAV_PERMS,
      },
      {
        label: 'Kurs',
        path: '/admin/templates?source=learning',
        Icon: GraduationCap,
        match: matchTemplateSource('learning'),
        requirePermAny: SETTINGS_NAV_PERMS,
      },
      {
        label: 'Register',
        path: '/admin/templates?source=registers',
        Icon: Database,
        match: matchTemplateSource('registers'),
        requirePermAny: SETTINGS_NAV_PERMS,
      },
    ]
    const workflowsSubs: SubItem[] = [
      {
        label: 'Mine arbeidsflyter',
        path: '/workflow?tab=rules',
        Icon: Workflow,
        match: ({ pathname, search }) => {
          if (pathname !== '/workflow') return false
          const t = new URLSearchParams(search).get('tab')
          return !t || t === 'rules'
        },
        requirePermAny: WORKFLOWS_NAV_PERMS,
      },
      {
        label: 'Mal-bibliotek',
        path: '/workflow?tab=library',
        Icon: LayoutTemplate,
        match: matchWorkflowTab('library'),
        requirePermAny: WORKFLOWS_NAV_PERMS,
      },
      {
        label: 'Kjøringer',
        path: '/workflow?tab=runs',
        Icon: History,
        match: matchWorkflowTab('runs'),
        requirePermAny: ['workflows.manage', 'module.view.workflow'],
      },
      {
        label: 'Godkjenninger',
        path: '/workflow?tab=approvals',
        Icon: UserCheck,
        match: matchWorkflowTab('approvals'),
        requirePermAny: ['workflows.manage', 'workflows.compose'],
      },
      {
        label: 'Bevispakke',
        path: '/workflow?tab=evidence',
        Icon: ShieldCheck,
        match: matchWorkflowTab('evidence'),
        requirePermAny: WORKFLOWS_NAV_PERMS,
      },
    ]
    const settingsSubs: SubItem[] = [
      {
        label: 'Generelt',
        path: '/admin/settings/settings/general',
        Icon: Settings,
        match: isAdminSettings('settings', 'general'),
        requirePermAny: SETTINGS_NAV_PERMS,
      },
      {
        label: 'Sikkerhet',
        path: '/admin/settings/settings/security',
        Icon: ScrollText,
        match: isAdminSettings('settings', 'security'),
        requirePermAny: SETTINGS_NAV_PERMS,
      },
      {
        label: 'Personvern & GDPR',
        path: '/admin/settings/settings/privacy',
        Icon: ShieldAlert,
        match: isAdminSettings('settings', 'privacy'),
        requirePermAny: SETTINGS_NAV_PERMS,
      },
      {
        label: 'Modul-konfigurasjon',
        path: '/admin/modules',
        Icon: Boxes,
        match: ({ pathname }) => pathname.startsWith('/admin/modules'),
        requirePermAny: SETTINGS_NAV_PERMS,
      },
      {
        label: 'Plan & abonnement',
        path: '/admin/settings/settings/plan',
        Icon: BookOpen,
        match: isAdminSettings('settings', 'plan'),
        requirePermAny: SETTINGS_NAV_PERMS,
      },
    ]
    const adminGroup: NavGroup = {
      id: 'administrasjon',
      label: 'Administrasjon',
      icon: Settings,
      modules: [
        {
          to: '/organisation',
          label: 'Organisasjon',
          end: false,
          icon: Building2,
          subs: organisationSubs,
          permAny: ORG_NAV_PERMS,
          flatSubs: true,
        },
        {
          to: '/admin/settings/users-roles',
          label: 'Brukere & roller',
          end: false,
          icon: Users,
          subs: usersRolesSubs,
          permAny: USERS_ROLES_NAV_PERMS,
          flatSubs: true,
        },
        {
          to: '/admin/settings/integrations',
          label: 'Integrasjoner',
          end: false,
          icon: Plug,
          subs: integrationsSubs,
          permAny: INTEGRATIONS_NAV_PERMS,
          flatSubs: true,
        },
        {
          to: '/admin/templates',
          label: 'Maler',
          end: false,
          icon: LayoutTemplate,
          subs: malerSubs,
          permAny: SETTINGS_NAV_PERMS,
          flatSubs: true,
        },
        {
          to: '/admin/tilsynsbrev',
          label: 'Tilsynssaker',
          end: false,
          icon: ScrollText,
          subs: tilsynsbrevSubs,
          permAny: ['tilsynsbrev.upload', 'tilsynsbrev.view_confidential', 'module.view.admin'],
          flatSubs: true,
        },
        {
          to: '/workflow',
          label: 'Arbeidsflyt',
          end: false,
          icon: Workflow,
          subs: workflowsSubs,
          permAny: WORKFLOWS_NAV_PERMS,
          flatSubs: true,
        },
        {
          to: '/admin/settings/settings',
          label: 'Innstillinger',
          end: false,
          icon: Settings,
          subs: settingsSubs,
          permAny: SETTINGS_NAV_PERMS,
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
        match: ({ pathname }) =>
          pathname === '/overview/internkontroll' ||
          (pathname.startsWith('/overview/internkontroll') && !pathname.startsWith('/overview/internkontroll/gaps')),
        requirePermAny: overviewNavPerms,
      },
      {
        label: 'Gap-analyse',
        path: '/overview/internkontroll/gaps',
        Icon: ShieldAlert,
        match: ({ pathname }) => pathname.startsWith('/overview/internkontroll/gaps'),
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

    const isoImsGroup: NavGroup = {
      id: 'iso-ims',
      label: 'ISO IMS',
      icon: LayoutDashboard,
      modules: [
        {
          to: '/iso/analyse',
          label: 'ISO IMS',
          end: false,
          icon: LayoutDashboard,
          permAny: ISO_IMS_NAV_PERMS,
          flatSubs: true,
          subs: [
            {
              label: 'Analyse',
              path: '/iso/analyse',
              Icon: LayoutDashboard,
              match: ({ pathname }) => pathname.startsWith('/iso/analyse'),
              requirePermAny: ISO_IMS_NAV_PERMS,
            },
            {
              label: 'Gap-analyse',
              path: '/iso/gap',
              Icon: LayoutDashboard,
              match: ({ pathname }) => pathname.startsWith('/iso/gap'),
              requirePermAny: ISO_IMS_NAV_PERMS,
            },
            {
              label: 'SoA (ISO 27001)',
              path: '/iso/soa',
              Icon: LayoutDashboard,
              match: ({ pathname }) => pathname.startsWith('/iso/soa'),
              requirePermAny: ISO_IMS_NAV_PERMS,
            },
            {
              label: 'Innstillinger',
              path: '/iso/innstillinger',
              Icon: Settings,
              match: ({ pathname }) => pathname.startsWith('/iso/innstillinger'),
              requirePermAny: ISO_IMS_NAV_PERMS,
            },
          ],
        },
      ],
    }

    const base: NavGroup[] = [hmsOverviewGroup, isoImsGroup, complianceGroup, surveyGroup, documentsGroup, meetingsGroup, alertsGroup, registersGroup, tasksGroup, learningGroup, adminGroup]
    return partnerGroup ? [partnerGroup, ...base] : base
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

  const visibleGroups = useMemo(
    () => filterNavGroups(mergedNavGroups, gateNav, can, disabledModules, hiddenForUser),
    [mergedNavGroups, gateNav, can, disabledModules, hiddenForUser],
  )
  const visibleModules = useMemo(() => allModulesFrom(visibleGroups), [visibleGroups])

  const [navMode, setNavMode] = useState<NavMode>(loadNavMode)
  const [subNavCollapsed, setSubNavCollapsed] = useState(loadSubNavCollapsed)
  // User-explicit expand state for category headers in flatSubs lists.
  // Keyed by headerKey. When a key is absent, we fall back to the auto rule
  // (expand if the header contains the currently active item). The map is
  // intentionally not persisted — sidebar groups feel right when the page
  // you're on is opened by default after navigation.
  const [expandedHeaders, setExpandedHeaders] = useState<Map<string, boolean>>(new Map())
  const toggleHeader = useCallback((headerKey: string, autoOpen: boolean) => {
    setExpandedHeaders((prev) => {
      const next = new Map(prev)
      const current = next.has(headerKey) ? next.get(headerKey)! : autoOpen
      next.set(headerKey, !current)
      return next
    })
  }, [])

  const toggleSubNavCollapsed = useCallback(() => {
    setSubNavCollapsed((c) => {
      const next = !c
      saveSubNavCollapsed(next)
      return next
    })
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

    // Single combined sidebar — replaces the old two-rail (icon strip + module panel) layout.
    // Width reduced from ~268px (60 + 208) to 200px; groups + sub-items live in one panel.
    return (
      <div className="flex h-[100dvh] max-h-[100dvh] overflow-hidden">

        {/* ── Combined sidebar ─────────────────────────────────────────────── */}
        {!subNavCollapsed && (
          <aside className="flex w-[200px] shrink-0 flex-col overflow-hidden bg-[var(--ui-nav-rail)]">
            {/* Logo + wordmark */}
            <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-white/10 px-4">
              <NavLink
                to="/app"
                aria-label={t('shell.homeAria')}
                className="flex items-center gap-2.5 rounded-lg hover:opacity-80"
              >
                <KlarertLogo size={22} markOnly variant="onDark" />
                <span
                  className="text-[17px] font-bold tracking-tight text-white"
                  style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
                >
                  klarert
                </span>
              </NavLink>
            </div>

            {/* Group + module list */}
            <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Primary">
              <div className="mb-1 px-2.5 pt-1 text-[10px] font-bold uppercase tracking-widest text-white/35">
                Moduler
              </div>
              {visibleGroups.map((group) => {
                const GroupIcon = group.icon
                const isActiveGroup = activeGroup?.id === group.id
                // For single-module groups, the group row IS the module link.
                // For multi-module groups (Administrasjon), it links to the first module.
                const firstMod = group.modules[0]

                // Active module's sub-items (shown inline below the active group)
                const activeModInGroup = isActiveGroup
                  ? group.modules.find((m) => m.to === activeModule.to) ?? firstMod
                  : null
                const modSubs = activeModInGroup
                  ? visibleSubs(activeModInGroup.subs, gateNav, can)
                  : []

                return (
                  <div key={group.id}>
                    {/* Group / module row */}
                    <NavLink
                      to={firstMod.to}
                      end={false}
                      title={group.label}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-[9px] text-[13px] font-medium transition-colors ${
                        isActiveGroup
                          ? 'bg-white/10 text-white'
                          : 'text-white/65 hover:bg-white/5 hover:text-white/90'
                      }`}
                    >
                      <GroupIcon className="size-4 shrink-0 opacity-80" aria-hidden />
                      <span className="flex-1">{group.label}</span>
                    </NavLink>

                    {/* Sub-items — shown inline below the active group */}
                    {isActiveGroup && modSubs.length > 0 && (
                      <div
                        className={
                          activeModInGroup?.flatSubs
                            ? 'mb-1 mt-0.5'
                            : 'mb-1 ml-4 mt-0.5 border-l border-white/10 pl-3'
                        }
                      >
                        {(() => {
                          const loc = { pathname: location.pathname, search: location.search }
                          const autoOpenByKey = new Map<string, boolean>()
                          for (let i = 0; i < modSubs.length; i++) {
                            const s = modSubs[i]!
                            if (s.kind !== 'header' || !s.headerKey) continue
                            let hasActive = false
                            for (let j = i + 1; j < modSubs.length; j++) {
                              const next = modSubs[j]!
                              if (next.kind === 'header') break
                              if (next.match(loc)) { hasActive = true; break }
                            }
                            autoOpenByKey.set(s.headerKey, hasActive)
                          }

                          return modSubs.map((item) => {
                            if (item.kind === 'header') {
                              const HeaderIcon = item.Icon ?? FolderTree
                              const key = item.headerKey ?? `${item.path}:${item.label}`
                              const auto = autoOpenByKey.get(key) ?? false
                              const expanded = expandedHeaders.has(key)
                                ? expandedHeaders.get(key)!
                                : auto
                              return (
                                <Button
                                  key={`hdr:${key}`}
                                  variant="ghost"
                                  onClick={() => toggleHeader(key, auto)}
                                  aria-expanded={expanded}
                                  className="mt-3 flex w-full items-center justify-start gap-2 rounded-lg px-2.5 py-1.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/40 transition-colors hover:bg-white/5 hover:text-white/70 first:mt-0"
                                >
                                  <HeaderIcon className="size-3 shrink-0 opacity-70" aria-hidden />
                                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                  {expanded ? (
                                    <ChevronDown className="size-3 shrink-0 opacity-60" aria-hidden />
                                  ) : (
                                    <ChevronRight className="size-3 shrink-0 opacity-60" aria-hidden />
                                  )}
                                </Button>
                              )
                            }
                            if (item.headerKey) {
                              const auto = autoOpenByKey.get(item.headerKey) ?? false
                              const expanded = expandedHeaders.has(item.headerKey)
                                ? expandedHeaders.get(item.headerKey)!
                                : auto
                              if (!expanded) return null
                            }
                            const active = item.match(loc)
                            const SubIcon = item.Icon
                            const iconOnly = item.iconOnly && SubIcon
                            const indented = Boolean(item.headerKey)
                            return (
                              <NavLink
                                key={item.path + item.label}
                                to={item.path}
                                title={item.label}
                                aria-label={iconOnly ? item.label : undefined}
                                className={
                                  activeModInGroup?.flatSubs
                                    ? `flex items-center gap-2.5 rounded-lg ${indented ? 'pl-7 pr-2.5' : 'px-2.5'} py-2 text-sm font-medium transition-colors ${
                                        active
                                          ? 'bg-white/10 text-white'
                                          : 'text-white/65 hover:bg-white/5 hover:text-white/90'
                                      }`
                                    : `flex items-center gap-2 rounded-md text-xs transition-colors ${
                                        active
                                          ? 'font-semibold text-white'
                                          : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                                      } ${
                                        iconOnly
                                          ? 'size-8 shrink-0 justify-center p-0'
                                          : 'px-2 py-1.5'
                                      }`
                                }
                              >
                                {!iconOnly && active && !activeModInGroup?.flatSubs && (
                                  <span className="h-3 w-0.5 shrink-0 rounded-full bg-[#c9a227]" aria-hidden />
                                )}
                                {!iconOnly && !active && !activeModInGroup?.flatSubs && (
                                  <span className="h-3 w-0.5 shrink-0" aria-hidden />
                                )}
                                {iconOnly ? (
                                  <SubIcon className="size-4 shrink-0 opacity-90" aria-hidden />
                                ) : (
                                  <>
                                    <span className="flex-1">{item.label}</span>
                                    {typeof item.badgeCount === 'number' && item.badgeCount > 0 ? (
                                      <span
                                        className={`ml-1.5 inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                                          item.badgeTone === 'danger'
                                            ? 'bg-rose-600 text-white'
                                            : 'bg-[#c9a227] text-[#1a1a1a]'
                                        }`}
                                        aria-label={`${item.badgeCount} ${item.badgeTone === 'danger' ? 'krever oppmerksomhet' : 'venter på behandling'}`}
                                      >
                                        {item.badgeCount > 99 ? '99+' : item.badgeCount}
                                      </span>
                                    ) : null}
                                  </>
                                )}
                              </NavLink>
                            )
                          })
                        })()}
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>

            {/* User footer + collapse toggle */}
            <div className="shrink-0 border-t border-white/10 px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#c9a227] text-[11px] font-bold text-[#1a1a1a]">
                  {(profileDisplay || profileEmail).slice(0, 2).toUpperCase() || 'TL'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-semibold text-white">{profileDisplay || profileEmail}</div>
                </div>
                <Button
                  variant="ghost"
                  onClick={toggleSubNavCollapsed}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label={t('shell.collapseSectionNav')}
                  title={t('shell.collapseSectionNav')}
                >
                  <PanelLeft className="size-4 shrink-0" aria-hidden />
                </Button>
              </div>
            </div>
          </aside>
        )}

        {/* Collapsed state: show just a thin toggle strip */}
        {subNavCollapsed && (
          <div className="flex w-10 shrink-0 flex-col items-center bg-[var(--ui-nav-rail)] py-3">
            <NavLink
              to="/app"
              aria-label={t('shell.homeAria')}
              className="mb-4 flex items-center justify-center rounded-lg p-1 hover:bg-white/10"
            >
              <KlarertLogo size={20} markOnly variant="onDark" />
            </NavLink>
            <Button
              variant="ghost"
              onClick={toggleSubNavCollapsed}
              className="flex h-8 w-8 items-center justify-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
              aria-label={t('shell.expandSectionNav')}
              title={t('shell.expandSectionNav')}
            >
              <PanelRight className="size-4 shrink-0" aria-hidden />
            </Button>
          </div>
        )}

        {/* ── Content area ─────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top utility bar */}
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-neutral-300/40 bg-[var(--ui-surface)] px-4 md:px-5">
            <div className="min-w-0 flex-1" />
            <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
              {supabaseConfigured ? (
                <>
                  <OrgSwitcher variant="sidebar" />
                  <ShellCompanyBlock name={orgDisplayName} variant="sidebar" />
                  <ShellQuickCreateMenu variant="sidebar" />
                  <ShellComplianceIndicator variant="sidebar" />
                  <RegulationFilterMenu variant="sidebar" />
                  <NotificationTray variant="sidebar" />
                  <LanguageDropdown variant="sidebar" />
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

          <main className="flex-1 overflow-y-auto bg-transparent">
            <SurveyPendingInvitesBanner />
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

  const topBarGroupNav = (
    <nav className="flex min-h-0 items-center gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] md:flex-1 md:justify-center md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden" aria-label="Primary">
      {visibleGroups.map((group) => {
        const isActiveGroup = activeGroup?.id === group.id
        return (
          <NavLink
            key={group.id}
            to={group.modules[0].to}
            end={false}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors md:px-3.5 md:py-1.5 ${
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
          <LanguageDropdown variant="topbar" />
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
                onClick={toggleSubNavCollapsed}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  subNavCollapsed ? 'bg-white/15 text-white ring-1 ring-[#c9a227]/50' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
                aria-expanded={!subNavCollapsed}
                aria-label={subNavCollapsed ? t('shell.expandSectionNav') : t('shell.collapseSectionNav')}
                title={subNavCollapsed ? t('shell.expandSectionNav') : t('shell.collapseSectionNav')}
              >
                {subNavCollapsed ? (
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
                onClick={toggleSubNavCollapsed}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  subNavCollapsed ? 'bg-white/15 text-white ring-1 ring-[#c9a227]/50' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
                aria-expanded={!subNavCollapsed}
                aria-label={subNavCollapsed ? t('shell.expandSectionNav') : t('shell.collapseSectionNav')}
                title={subNavCollapsed ? t('shell.expandSectionNav') : t('shell.collapseSectionNav')}
              >
                {subNavCollapsed ? (
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
        {!subNavCollapsed && subItems.length > 0 && (
          <div className="border-t border-white/[0.07] bg-[var(--ui-nav-sub)]">
            <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-2 md:px-8">
              <nav className="flex min-w-0 flex-1 flex-wrap gap-x-1 gap-y-1" aria-label="Section">
                {subItems.filter((it) => it.kind !== 'header').map((item) => {
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
                        <span className="inline-flex items-center gap-1.5">
                          <span>{item.label}</span>
                          {typeof item.badgeCount === 'number' && item.badgeCount > 0 ? (
                            <span
                              className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                                item.badgeTone === 'danger'
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-[#c9a227] text-[#1a1a1a]'
                              }`}
                              aria-label={`${item.badgeCount} ${item.badgeTone === 'danger' ? 'krever oppmerksomhet' : 'venter på behandling'}`}
                            >
                              {item.badgeCount > 99 ? '99+' : item.badgeCount}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </NavLink>
                  )
                })}
              </nav>
            </div>
          </div>
        )}

      </header>

      <main className="min-h-0 flex-1 overflow-y-auto bg-[var(--ui-surface)]">
        <Outlet />
      </main>
    </div>
  )
}

export { BookOpen, PanelLeft }
