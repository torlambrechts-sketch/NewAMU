import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Briefcase,
  BookMarked,
  BookOpen,
  Building2,
  Calendar,
  CalendarRange,
  CalendarCheck,
  ChevronDown,
  Database,
  ChevronRight,
  ClipboardList,
  ClipboardCheck,
  FileText,
  FolderTree,
  GraduationCap,
  HardHat,
  History,
  HeartPulse,
  Home,
  Kanban,
  LayoutGrid,
  LayoutTemplate,
  ListTodo,
  Megaphone,
  PanelLeft,
  PanelRight,
  Boxes,
  Layers,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Settings,
  Users,
  Workflow,
  CalendarDays,
} from 'lucide-react'
import { NotificationTray } from '../notifications/NotificationTray'
import { SurveyPendingInvitesBanner } from '../../../modules/survey/SurveyPendingInvitesBanner'
import { useI18n } from '../../hooks/useI18n'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { PermissionKey } from '../../lib/permissionKeys'
import { WORKPLACE_REPORTING_NAV, workplaceReportingNavMatch } from '../../data/workplaceReportingNav'
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

// ─── Sub-item lists (all paths/labels unchanged) ──────────────────────────────


const internkontrollSubs: SubItem[] = [
  {
    label: 'Oversikt',
    path: '/internkontroll',
    match: ({ pathname }) => pathname === '/internkontroll',
  },
  {
    label: 'Lovregister',
    path: '/internkontroll/lovregister',
    match: ({ pathname }) => pathname === '/internkontroll/lovregister',
  },
  {
    label: 'Kompetanse',
    path: '/internkontroll/kompetanse',
    match: ({ pathname }) => pathname === '/internkontroll/kompetanse',
  },
  {
    label: 'Medvirkning & roller',
    path: '/internkontroll/medvirkning',
    match: ({ pathname }) => pathname === '/internkontroll/medvirkning',
  },
  {
    label: 'HMS-mål & KPI',
    path: '/internkontroll/mal',
    match: ({ pathname }) => pathname === '/internkontroll/mal',
  },
  {
    label: 'Tiltaksplan',
    path: '/internkontroll/tiltaksplan',
    match: ({ pathname }) => pathname === '/internkontroll/tiltaksplan',
  },
  {
    label: 'ROS-analyse',
    path: '/internal-control?tab=ros',
    match: ({ pathname, search }) => pathname === '/internal-control' && new URLSearchParams(search).get('tab') === 'ros',
  },
]

const internalControlSubs: SubItem[] = [
  {
    label: 'Samsvar — oversikt',
    path: '/compliance',
    match: ({ pathname }) => pathname === '/compliance',
  },
  {
    label: 'Oversikt',
    path: '/internal-control?tab=overview',
    match: ({ pathname, search }) =>
      pathname === '/internal-control' &&
      (!new URLSearchParams(search).get('tab') || new URLSearchParams(search).get('tab') === 'overview'),
  },
  { label: 'ROS', path: '/internal-control?tab=ros', match: ({ pathname, search }) => pathname === '/internal-control' && new URLSearchParams(search).get('tab') === 'ros' },
  { label: 'Årsgjennomgang', path: '/internal-control?tab=annual', match: ({ pathname, search }) => pathname === '/internal-control' && new URLSearchParams(search).get('tab') === 'annual' },
]

const hseSubs: SubItem[] = [
  {
    label: 'Samsvar — oversikt',
    path: '/compliance',
    match: ({ pathname }) => pathname === '/compliance',
  },
  {
    label: 'Oversikt',
    path: '/hse?tab=overview',
    match: ({ pathname, search }) =>
      pathname === '/hse' &&
      (!new URLSearchParams(search).get('tab') || new URLSearchParams(search).get('tab') === 'overview'),
  },
  { label: 'Inspeksjoner', path: '/hse?tab=inspections', match: ({ pathname, search }) => pathname === '/hse' && new URLSearchParams(search).get('tab') === 'inspections' },
  {
    label: 'Inspeksjonsmodul',
    path: '/inspection-module/admin',
    match: ({ pathname }) =>
      pathname === '/inspection-module/admin' || pathname === '/hse/inspection-settings',
  },
  { label: 'SJA', path: '/hse?tab=sja', match: ({ pathname, search }) => pathname === '/hse' && new URLSearchParams(search).get('tab') === 'sja' },
  { label: 'Opplæring', path: '/hse?tab=training', match: ({ pathname, search }) => pathname === '/hse' && new URLSearchParams(search).get('tab') === 'training' },
  { label: 'Sykefravær', path: '/hse?tab=sickness', match: ({ pathname, search }) => pathname === '/hse' && new URLSearchParams(search).get('tab') === 'sickness' },
]

const orgHealthSubs: SubItem[] = [
  {
    label: 'Samsvar — oversikt',
    path: '/compliance',
    match: ({ pathname }) => pathname === '/compliance',
  },
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
  { label: 'Veikart', path: '/org-health/settings', match: ({ pathname }) => pathname === '/org-health/settings' },
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

// Permission gate for the umbrella Admin menu. Strict — only org
// administrators / role managers see it. Sub-pages enforce their own
// page-level perms.
const ADMIN_NAV_PERMS: PermissionKey[] = [
  'module.view.admin',
  'users.manage',
  'roles.manage',
]

const organisationAdminSubs: SubItem[] = [
  {
    label: 'Brukere & invitasjoner',
    path: '/organisation/admin?tab=users',
    match: ({ pathname, search }) =>
      pathname === '/organisation/admin' &&
      (!new URLSearchParams(search).get('tab') || new URLSearchParams(search).get('tab') === 'users'),
  },
  {
    label: 'Roller & rettigheter',
    path: '/organisation/admin?tab=roles',
    match: ({ pathname, search }) =>
      pathname === '/organisation/admin' && new URLSearchParams(search).get('tab') === 'roles',
  },
  {
    label: 'Delegering',
    path: '/organisation/admin?tab=delegation',
    match: ({ pathname, search }) =>
      pathname === '/organisation/admin' && new URLSearchParams(search).get('tab') === 'delegation',
  },
  {
    label: 'Funksjonelle roller',
    path: '/organisation/admin?tab=functional_roles',
    match: ({ pathname, search }) =>
      pathname === '/organisation/admin' && new URLSearchParams(search).get('tab') === 'functional_roles',
  },
  {
    label: 'Rolle-compliance',
    path: '/organisation/admin?tab=role_compliance',
    match: ({ pathname, search }) =>
      pathname === '/organisation/admin' && new URLSearchParams(search).get('tab') === 'role_compliance',
  },
  {
    label: 'Regelverk-dekning',
    path: '/organisation/admin?tab=regelverk_coverage',
    match: ({ pathname, search }) =>
      pathname === '/organisation/admin' && new URLSearchParams(search).get('tab') === 'regelverk_coverage',
  },
  {
    label: 'GDPR brudd',
    path: '/organisation/admin?tab=gdpr_breach',
    match: ({ pathname, search }) =>
      pathname === '/organisation/admin' && new URLSearchParams(search).get('tab') === 'gdpr_breach',
  },
  {
    label: 'GDPR individrettigheter',
    path: '/organisation/admin?tab=gdpr_subject_requests',
    match: ({ pathname, search }) =>
      pathname === '/organisation/admin' && new URLSearchParams(search).get('tab') === 'gdpr_subject_requests',
  },
  {
    label: 'Integrasjoner',
    path: '/organisation/admin?tab=integrations',
    match: ({ pathname, search }) =>
      pathname === '/organisation/admin' && new URLSearchParams(search).get('tab') === 'integrations',
  },
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
// Canonical 7-group information architecture (+ Gamle moduler staging group).
// Each group maps to a legal basis:
//
//   1. Risiko & Sikkerhet         — IK-forskriften § 5 nr. 6
//   2. Hendelser & Varsling       — AML § 5 og kap. 2A
//   3. Internkontroll             — IK-forskriften § 5
//   4. Arbeidsmiljø & AMU         — AML § 4 og § 7
//   5. Dokumentasjon              — IK-forskriften § 5 nr. 3
//   6. Opplæring & Kompetanse     — AML § 3-2
//   7. Organisasjon & HR          — støttefunksjoner
//
// Anything that does not cleanly map to one of these seven groups is parked in
// "Gamle moduler" so it stays reachable but is visibly quarantined. Move items
// out of Gamle moduler by cutting the object and pasting it into the correct
// group below.
// ─────────────────────────────────────────────────────────────────────────────

// Permission gate for the synthetic Sjekklister menu — matches the /compliance
// route gate in ROUTE_PERMISSION_ANY so anyone who can reach the page also
// sees the menu entry.
const COMPLIANCE_NAV_PERMS: PermissionKey[] = [
  'module.view.hse',
  'module.view.internal_control',
  'module.view.org_health',
  'module.view.hr_compliance',
  'module.view.dashboard',
  'checklist.manage',
]

// Permission gate for the synthetic Undersøkelser menu — anyone who can
// view a survey-relevant module sees it. Mirrors the broad permAny pattern
// used for Sjekklister so view-only roles aren't excluded.
const SURVEY_NAV_PERMS: PermissionKey[] = [
  'module.view.survey',
  'module.view.org_health',
  'module.view.hse',
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

// Permission gate for the Register menu — broad pattern: anyone who can
// view any HMS module surface gets the menu. The page-level RLS ensures
// per-record reads stay org-scoped.
const REGISTERS_NAV_PERMS: PermissionKey[] = [
  'module.view.dashboard',
  'module.view.hse',
  'module.view.org_health',
  'module.view.internal_control',
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


// ─────────────────────────────────────────────────────────────────────────────
// Menu cleanup pass — preview layout with only Sjekklister + Undersøkelser at
// the top. Every other module is parked in "Gamle moduler" so it stays
// reachable while we evaluate the new IA. The two synthetic top-level groups
// (Sjekklister, Undersøkelser) are injected just before "gamle-moduler" inside
// `mergedNavGroups` further down. Restoring the previous IA is a single revert
// of this commit.
// ─────────────────────────────────────────────────────────────────────────────

// oppgaverManagementSubs removed — tasks nav is now dynamic via useTaskNav
// (same pattern as complianceNav / surveyNav). Built inside mergedNavGroups below.

// Every module previously surfaced as a top-level entry, now flattened into a
// single "Gamle moduler" group while we audit the IA. Order preserved from the
// previous group structure so muscle memory still works.
const gamleModulerModules: NavModule[] = [
  // ── Risiko & Sikkerhet ───────────────────────────────────────────────────
  { to: '/risiko-sikkerhet', label: 'Risiko & Sikkerhet — oversikt', end: true, icon: LayoutGrid, subs: [] },
  { to: '/sja', label: 'Sikker Jobbanalyse', end: false, icon: ShieldAlert, subs: [] },
  { to: '/ros', label: 'ROS-analyser', end: false, icon: ShieldAlert, subs: [], perm: 'module.view.hse', moduleSlug: 'ros' },
  { to: '/vernerunder', label: 'Vernerunder', end: false, icon: ClipboardCheck, perm: 'module.view.hse', moduleSlug: 'vernerunder', subs: [] },
  { to: '/inspection-module', label: 'Inspeksjonsrunder', end: false, icon: ClipboardList, moduleSlug: 'inspection', subs: [] },

  // ── Hendelser & Varsling ─────────────────────────────────────────────────
  { to: '/avvik', label: 'Avvik', end: false, icon: AlertTriangle, subs: [] },
  {
    to: '/workplace-reporting',
    label: 'Varsling & hendelser',
    end: true,
    icon: Megaphone,
    subs: workplaceReportingSubs,
    perm: 'module.view.workplace_reporting',
    moduleSlug: 'workplace_reporting',
  },

  // ── Internkontroll ───────────────────────────────────────────────────────
  { to: '/internkontroll', label: 'IK Hub', end: false, icon: BookMarked, subs: internkontrollSubs, perm: 'module.view.internal_control' },
  {
    to: '/internal-control',
    label: 'Internkontroll (legacy hub)',
    end: false,
    icon: ClipboardList,
    subs: internalControlSubs,
    perm: 'module.view.internal_control',
    moduleSlug: 'internal-control',
  },
  { to: '/tiltak', label: 'Tiltaksplan', end: false, icon: ListTodo, perm: 'module.view.hse', subs: [] },
  { to: '/aarshjul', label: 'Årshjul', end: false, icon: CalendarRange, subs: [], perm: 'module.view.dashboard' },

  { to: '/members', label: 'Representanter', end: false, icon: Users, subs: [], perm: 'module.view.members', moduleSlug: 'members' },
  {
    to: '/org-health',
    label: 'Organisasjonshelse',
    end: false,
    icon: HeartPulse,
    subs: orgHealthSubs,
    perm: 'module.view.org_health',
    moduleSlug: 'org-health',
  },

  {
    to: '/internkontroll/arsgjenomgang',
    label: 'Årsgjennomgang',
    end: false,
    icon: Calendar,
    subs: [
      { label: 'Dokument', path: '/internkontroll/arsgjenomgang', match: ({ pathname }) => pathname === '/internkontroll/arsgjenomgang' },
      { label: 'Innstillinger', path: '/internkontroll/admin', match: ({ pathname }) => pathname === '/internkontroll/admin' },
    ],
    perm: 'module.view.internal_control',
    moduleSlug: 'ik-annual-review',
  },
  { to: '/modules/aarskontroll', label: 'Årskontroll', end: true, icon: CalendarCheck, subs: [], perm: 'module.view.internal_control' },
  { to: '/compliance', label: 'Compliance-dashboard', end: true, icon: ShieldCheck, subs: [] },

  // ── Organisasjon & HR ────────────────────────────────────────────────────
  { to: '/organisation/admin', label: 'Roller & administrasjon', end: true, icon: Shield, subs: organisationAdminSubs, perm: 'module.view.admin' },
  {
    to: '/hr',
    label: 'HR & rettssikkerhet',
    end: false,
    icon: Briefcase,
    subs: [
      { label: 'Samsvar — oversikt', path: '/compliance', match: ({ pathname }) => pathname === '/compliance' },
    ],
    perm: 'module.view.hr_compliance',
    moduleSlug: 'hr',
  },

  // ── Administrasjon ───────────────────────────────────────────────────────
  { to: '/organisation', label: 'Organisasjon', end: false, icon: Building2, subs: [], perm: 'module.view.dashboard' },
  // Automatisering/Arbeidsflyt moved to organisationAdminSubs
  { to: '/reports', label: 'Rapporter', end: false, icon: BarChart3, subs: [], perm: 'module.view.reports' },

  // ── Eksisterende "Gamle moduler" innhold ─────────────────────────────────
  { to: '/', label: 'Dashboards', end: true, icon: Home, subs: [], perm: 'module.view.dashboard' },
  { to: '/workspace/revisjonslogg', label: 'Revisjonslogg', end: true, icon: History, subs: [], perm: 'module.view.dashboard' },
  // Tasks + Learning have their own top-level NavGroups (Oppgaver / Læring) —
  // legacy duplicates removed per category-architecture §T6.
  { to: '/action-board', label: 'Action Board', end: false, icon: Kanban, subs: [], perm: 'module.view.dashboard' },
  { to: '/hse', label: 'HSE / HMS (legacy)', end: false, icon: HardHat, subs: hseSubs, perm: 'module.view.hse', moduleSlug: 'hse' },
  { to: '/admin/modules', label: 'Moduloversikt', end: false, icon: Boxes, subs: [] },
]

const navGroups: NavGroup[] = [
  {
    id: 'gamle-moduler',
    label: 'Gamle moduler',
    icon: Layers,
    modules: gamleModulerModules,
  },
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
  if (pathname === '/workspace/revisjonslogg') {
    const w = modules.find((m) => m.to === '/workspace/revisjonslogg')
    if (w) return w
  }
  if (pathname === '/compliance') {
    const c = modules.find((m) => m.to === '/compliance')
    if (c) return c
  }
  const hub = modules.find((m) => m.to === '/workplace-reporting')
  if (hub) {
    const sp = new URLSearchParams(search)
    if (pathname === '/workplace-reporting/incidents') return hub
    if (pathname === '/workplace-reporting/dashboard') return hub
    if (pathname === '/org-health' && sp.get('tab') === 'reporting') return hub
    if (pathname === '/tasks/management' && sp.get('tab') === 'varsling') return hub
  }
  if (pathname === '/organisation/admin' || pathname.startsWith('/organisation/admin/')) {
    const adminMod = modules.find((m) => m.to === '/organisation/admin')
    if (adminMod) return adminMod
  }
  if (pathname === '/meetings' || pathname.startsWith('/meetings/')) {
    const mtg = modules.find((m) => m.to === '/meetings')
    if (mtg) return mtg
  }
  if (pathname === '/vernerunder' || pathname.startsWith('/vernerunder/')) {
    const vern = modules.find((m) => m.to === '/vernerunder')
    if (vern) return vern
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

function workspaceRevisjonsloggSubs(): SubItem[] {
  const srcMatch =
    (source: string) =>
    ({ pathname, search }: { pathname: string; search: string }) =>
      pathname === '/workspace/revisjonslogg' && new URLSearchParams(search).get('source') === source
  const allMatch = ({ pathname, search }: { pathname: string; search: string }) =>
    pathname === '/workspace/revisjonslogg' && !new URLSearchParams(search).get('source')
  return [
    { label: 'Alle kilder', path: '/workspace/revisjonslogg', match: allMatch },
    {
      label: 'Oppgaver',
      path: '/workspace/revisjonslogg?source=tasks',
      match: srcMatch('tasks'),
      requirePerm: 'module.view.tasks',
    },
    {
      label: 'Internkontroll',
      path: '/workspace/revisjonslogg?source=internal_control',
      match: srcMatch('internal_control'),
      requirePerm: 'module.view.internal_control',
    },
    {
      label: 'HSE / HMS',
      path: '/workspace/revisjonslogg?source=hse',
      match: srcMatch('hse'),
      requirePerm: 'module.view.hse',
    },
    {
      label: 'Org. helse',
      path: '/workspace/revisjonslogg?source=org_health',
      match: srcMatch('org_health'),
      requirePerm: 'module.view.org_health',
    },
    {
      label: 'Møter',
      path: '/workspace/revisjonslogg?source=meetings',
      match: srcMatch('meetings'),
      requirePerm: 'module.view.meetings',
    },
    {
      label: 'Representanter',
      path: '/workspace/revisjonslogg?source=representatives',
      match: srcMatch('representatives'),
      requirePerm: 'module.view.members',
    },
  ]
}

function subNavForPath(modules: NavModule[], pathname: string, search: string): SubItem[] {
  const mod = activeModuleForPath(modules, pathname, search)
  if (mod.to === '/workspace/revisjonslogg') {
    return workspaceRevisjonsloggSubs()
  }
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
  const { t } = useI18n()
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
        label: 'Alle sjekklister',
        path: '/compliance/checklists/alle',
        match: ({ pathname }) => pathname === '/compliance/checklists/alle',
        requirePermAny: COMPLIANCE_NAV_PERMS,
      },
      {
        label: 'Innstillinger',
        path: '/compliance/checklists/admin',
        Icon: Settings,
        match: ({ pathname }) => pathname.startsWith('/compliance/checklists/admin'),
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
        path: '/survey/admin',
        Icon: Settings,
        match: ({ pathname }) => pathname.startsWith('/survey/admin'),
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
        path: '/learning/innstillinger',
        Icon: Settings,
        match: ({ pathname }) => pathname.startsWith('/learning/innstillinger'),
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
        path: '/documents/admin',
        Icon: Settings,
        match: ({ pathname }) => pathname.startsWith('/documents/admin'),
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
        path: '/registers/admin',
        Icon: Settings,
        match: ({ pathname }) => pathname.startsWith('/registers/admin'),
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

    // Admin group — umbrella for company configuration, user
    // management, access rights, and the cross-module template
    // browser. Most sub-entries deep-link to existing surfaces
    // (OrganisationPage tabs, AdminPage); only Maler is a new page.
    const adminFixedSubs: SubItem[] = [
      {
        label: 'Selskap',
        path: '/organisation',
        Icon: Building2,
        match: ({ pathname, search }) =>
          pathname === '/organisation' &&
          (() => {
            const tab = new URLSearchParams(search).get('tab')
            return !tab || tab === 'insights' || tab === 'settings'
          })(),
        requirePermAny: ADMIN_NAV_PERMS,
      },
      {
        label: 'Ansatte & enheter',
        path: '/organisation?tab=employees',
        match: ({ pathname, search }) => {
          if (pathname !== '/organisation') return false
          const tab = new URLSearchParams(search).get('tab')
          return tab === 'employees' || tab === 'units'
        },
        requirePermAny: ADMIN_NAV_PERMS,
      },
      {
        label: 'Brukere & roller',
        path: '/organisation/admin',
        Icon: Users,
        match: ({ pathname }) => pathname.startsWith('/organisation/admin'),
        requirePermAny: ADMIN_NAV_PERMS,
      },
      {
        label: 'Tilgang & verv',
        path: '/organisation?tab=mandates',
        match: ({ pathname, search }) => {
          if (pathname !== '/organisation') return false
          const tab = new URLSearchParams(search).get('tab')
          return tab === 'mandates' || tab === 'groups'
        },
        requirePermAny: ADMIN_NAV_PERMS,
      },
      {
        label: 'Maler',
        path: '/admin/templates',
        Icon: LayoutTemplate,
        match: ({ pathname }) => pathname === '/admin/templates',
        requirePermAny: ADMIN_NAV_PERMS,
      },
      {
        label: 'Automatisering',
        path: '/workflow',
        Icon: Workflow,
        match: ({ pathname }) => pathname.startsWith('/workflow'),
        requirePermAny: ADMIN_NAV_PERMS,
      },
    ]
    const adminGroup: NavGroup = {
      id: 'admin',
      label: 'Admin',
      icon: Shield,
      modules: [
        {
          to: '/organisation',
          label: 'Admin',
          end: false,
          icon: Shield,
          subs: adminFixedSubs,
          permAny: ADMIN_NAV_PERMS,
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
        path: '/tasks/management/admin',
        Icon: Settings,
        match: ({ pathname }) => pathname.startsWith('/tasks/management/admin'),
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
        label: 'Innstillinger',
        path: '/meetings/admin',
        Icon: Settings,
        match: ({ pathname }) => pathname.startsWith('/meetings/admin'),
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

    // Composite "HMS Overview" group — sits at the top of the merged nav
    // since it's the org-wide entry point that pulls in widgets from
    // every other module group below it.
    const hmsOverviewGroup: NavGroup = {
      id: 'hms-oversikt',
      label: 'HMS-oversikt',
      icon: Activity,
      modules: [
        {
          to: '/overview/hms',
          label: 'HMS-oversikt',
          end: true,
          icon: Activity,
          subs: [],
          permAny: [
            ...COMPLIANCE_NAV_PERMS,
            ...SURVEY_NAV_PERMS,
            ...LEARNING_NAV_PERMS,
            'module.view.tasks',
          ],
        },
      ],
    }

    const idx = navGroups.findIndex((g) => g.id === 'gamle-moduler')
    const head = idx === -1 ? navGroups : navGroups.slice(0, idx)
    const tail = idx === -1 ? [] : navGroups.slice(idx)
    return [...head, hmsOverviewGroup, complianceGroup, surveyGroup, documentsGroup, meetingsGroup, registersGroup, tasksGroup, learningGroup, adminGroup, ...tail]
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
    isRegulationActive,
    activeRegulationIds,
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

    return (
      <div className="flex h-[100dvh] max-h-[100dvh] overflow-hidden">

        {/* ── Rail 1: Group icons ──────────────────────────────────────────── */}
        <aside className="flex w-[3.75rem] shrink-0 flex-col bg-[var(--ui-nav-rail)]">
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
              onClick={toggleSubNavCollapsed}
              className={`flex w-full items-center justify-center rounded-lg p-3 transition-colors ${
                subNavCollapsed ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
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
            </button>
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

                    {/* Sub-items — expanded inline when this module is active.
                        flatSubs modules (e.g. Sjekklister) render their sub-items
                        at module-level size and zero extra indent so the templates
                        read as co-equal first-class entries. */}
                    {isActiveMod && hasModSubs && (
                      <div
                        className={
                          mod.flatSubs
                            ? 'mb-1 mt-0.5'
                            : 'mb-1 ml-4 mt-0.5 border-l border-white/10 pl-3'
                        }
                      >
                        {(() => {
                          // Pre-compute auto-expand: a header is auto-open
                          // when any item beneath it (before the next
                          // header) matches the current location.
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
                                <button
                                  key={`hdr:${key}`}
                                  type="button"
                                  onClick={() => toggleHeader(key, auto)}
                                  aria-expanded={expanded}
                                  className="mt-3 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white/55 transition-colors hover:bg-white/5 hover:text-white/80 first:mt-0"
                                >
                                  <HeaderIcon className="size-3.5 shrink-0 opacity-80" aria-hidden />
                                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                  {expanded ? (
                                    <ChevronDown className="size-3.5 shrink-0 opacity-70" aria-hidden />
                                  ) : (
                                    <ChevronRight className="size-3.5 shrink-0 opacity-70" aria-hidden />
                                  )}
                                </button>
                              )
                            }
                            // Items belonging to a header: render only if
                            // that header is currently expanded. Items
                            // without a headerKey always render.
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
                                  mod.flatSubs
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
                                {!iconOnly && active && !mod.flatSubs && (
                                  <span className="h-3 w-0.5 shrink-0 rounded-full bg-[#c9a227]" aria-hidden />
                                )}
                                {!iconOnly && !active && !mod.flatSubs && (
                                  <span className="h-3 w-0.5 shrink-0" aria-hidden />
                                )}
                                {iconOnly ? (
                                  <SubIcon className="size-4 shrink-0 opacity-90" aria-hidden />
                                ) : (
                                  item.label
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
      <header className="shrink-0 bg-[var(--ui-nav-rail)] text-white">
        {/* Row 1: mobile — logo + section toggle | utilities (profile/menu always visible without scrolling) */}
        <div className="mx-auto max-w-[1400px] px-4 py-2 md:px-8 md:py-3">
          <div className="flex items-center justify-between gap-2 md:hidden">
            <div className="flex min-w-0 shrink-0 items-center gap-2">
              <NavLink to="/app" className="flex shrink-0 items-center gap-2" aria-label={t('shell.homeAria')}>
                <KlarertLogo size={28} variant="onDark" />
              </NavLink>
              <button
                type="button"
                onClick={toggleSubNavCollapsed}
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
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
              </button>
            </div>
            {topBarUtilities}
          </div>

          {/* md+: single row — logo · groups · utilities */}
          <div className="hidden items-center justify-between gap-4 md:flex">
            <div className="flex shrink-0 items-center gap-2">
              <NavLink to="/app" className="flex items-center gap-2" aria-label={t('shell.homeAria')}>
                <KlarertLogo size={28} variant="onDark" />
              </NavLink>
              <button
                type="button"
                onClick={toggleSubNavCollapsed}
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
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
              </button>
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
                        item.label
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
