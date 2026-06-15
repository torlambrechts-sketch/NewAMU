// Nav-section composition logic — moved out of AticsShell.tsx so the
// shell file stays focused on render concerns.
//
// `buildNavSections(ctx)` is a pure function: given the per-module
// nav hook outputs + a few session flags, it returns the four-section
// information architecture that the sidebar and topbar both render.
//
// The shell wraps this call in a useMemo with the same dep list it
// always had — the call itself is cheap, but the per-render rebuild
// of arrays would invalidate downstream memos.
//
// Future PR: split this single file into one-per-group builders under
// `navSections/<scope>.ts`. The types + perms are already separate
// (`aticsNavTypes.ts`, `aticsNavPerms.ts`), so the seams exist; this
// file is the next refactor target once the contract has stabilised.

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Briefcase,
  CalendarClock,
  CalendarDays,
  Compass,
  Target,
  ClipboardList,
  Database,
  FileText,
  FolderKanban,
  FolderTree,
  Gauge,
  GraduationCap,
  History,
  Inbox,
  Kanban,
  Layers,
  ListChecks,
  Lock,
  Megaphone,
  Scale,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Settings,
  Star,
  StickyNote,
  Wand2,
} from 'lucide-react'
import type { PermissionKey } from '../../lib/permissionKeys'
import type { useComplianceNav } from '../../../modules/compliance/useComplianceNav'
import type { useSurveyNav } from '../../../modules/survey/useSurveyNav'
import type { useLearningNav } from '../../hooks/useLearningNav'
import type { useDocumentNav } from '../../hooks/useDocumentNav'
import type { useRegistersNav } from '../../hooks/useRegistersNav'
import type { useTaskNav } from '../../../modules/tasks/useTaskNav'
import type { useMeetingsNav } from '../../../modules/meetings/useMeetingsNav'
import type { useAlertsNav } from '../../../modules/alerts/useAlertsNav'
import type { NavGroup, NavSection, SubItem } from './aticsNavTypes'
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

export interface NavBuilderContext {
  complianceNav: ReturnType<typeof useComplianceNav>
  surveyNav: ReturnType<typeof useSurveyNav>
  learningNav: ReturnType<typeof useLearningNav>
  documentNav: ReturnType<typeof useDocumentNav>
  registersNav: ReturnType<typeof useRegistersNav>
  tasksNav: ReturnType<typeof useTaskNav>
  meetingsNav: ReturnType<typeof useMeetingsNav>
  alertsNav: ReturnType<typeof useAlertsNav>
  isRegulationActive: (id: string | null | undefined) => boolean
  isPartnerMember: boolean
  isPlatformAdmin: boolean
  amuBacklogPendingCount: number
}

export function buildNavSections(ctx: NavBuilderContext): NavSection[] {
  const {
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
  } = ctx

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

  // Survey "Undersøkelser" group — same flatSubs treatment as Sjekklister.
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

  // Learning "Læring" group.
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

  // Dokumenter — flatSubs shape with Analyse + Alle dokumenter +
  // Innstillinger; pinned templates follow.
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

  // Register group.
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

  // Administrasjon umbrella — single entry pointing at the in-page tabs.
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

  // Tilsynssaker — Styringssystem group, sub-link to the inbox.
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

  // Oppgaver.
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

  // Møter — fixed subs + pinned templates.
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

  // Varslinger.
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
      label: 'Bulk-handlinger',
      path: '/alerts/bulk',
      Icon: ShieldCheck,
      match: ({ pathname }) => pathname.startsWith('/alerts/bulk'),
      requirePermAny: [
        'alerts.committee',
        'alerts.committee_confidential',
        'alerts.committee_escalated',
      ],
    },
    {
      label: 'DSAR-konsoll',
      path: '/alerts/dsar',
      Icon: ShieldCheck,
      match: ({ pathname }) => pathname.startsWith('/alerts/dsar'),
      requirePerm: 'alerts.dpo',
    },
    {
      label: 'Legal hold',
      path: '/alerts/admin/legal-hold',
      Icon: Lock,
      match: ({ pathname }) => pathname.startsWith('/alerts/admin/legal-hold'),
      requirePermAny: ['alerts.committee_confidential', 'alerts.dpo'],
    },
    {
      label: 'Break-the-glass',
      path: '/alerts/admin/break-glass',
      Icon: AlertTriangle,
      match: ({ pathname }) => pathname.startsWith('/alerts/admin/break-glass'),
      requirePerm: 'alerts.board_escalation',
    },
    {
      label: 'Innstillinger',
      path: '/alerts/admin',
      Icon: Settings,
      match: ({ pathname }) =>
        pathname.startsWith('/alerts/admin') &&
        !pathname.startsWith('/alerts/admin/legal-hold') &&
        !pathname.startsWith('/alerts/admin/break-glass'),
      requirePerm: 'alerts.manage',
    },
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

  // Risiko hazard-category pinned presets.
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

  // Partner-konsoll — only when the user has an active partner_memberships row.
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

  // Internkontroll — IK § 5 unified surface.
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

  // Dashboards — hub som hoster 19 dashboards basert på cadence-data +
  // task_items. Egen group så den er lett å finne fra sidebar.
  const dashboardsFixedSubs: SubItem[] = [
    {
      label: 'Tidslinje',
      path: '/dashboard?dashboard=timeline',
      Icon: CalendarClock,
      match: ({ pathname, search }) =>
        pathname === '/dashboard' && (new URLSearchParams(search).get('dashboard') ?? 'timeline') === 'timeline',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    {
      label: 'Gantt',
      path: '/dashboard?dashboard=gantt',
      Icon: BarChart3,
      match: ({ pathname, search }) =>
        pathname === '/dashboard' && new URLSearchParams(search).get('dashboard') === 'gantt',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    {
      label: 'Kanban',
      path: '/dashboard?dashboard=kanban',
      Icon: Kanban,
      match: ({ pathname, search }) =>
        pathname === '/dashboard' && new URLSearchParams(search).get('dashboard') === 'kanban',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    {
      label: 'OKR',
      path: '/dashboard?dashboard=okr',
      Icon: Activity,
      match: ({ pathname, search }) =>
        pathname === '/dashboard' && new URLSearchParams(search).get('dashboard') === 'okr',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    {
      label: 'RAID',
      path: '/dashboard?dashboard=raid',
      Icon: ShieldAlert,
      match: ({ pathname, search }) =>
        pathname === '/dashboard' && new URLSearchParams(search).get('dashboard') === 'raid',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
  ]
  const dashboardsGroup: NavGroup = {
    id: 'dashboards',
    label: 'Dashboards',
    icon: BarChart3,
    modules: [
      {
        to: '/dashboard',
        label: 'Dashboards',
        end: false,
        icon: BarChart3,
        subs: dashboardsFixedSubs,
        permAny: ADMINISTRASJON_NAV_PERMS,
        flatSubs: true,
      },
    ],
  }

  // Planlegging — strategi (OKR), kadens-planlegger, oppgaver/prosjekter.
  // En topp-level inngang under Styringssystem som binder strategilaget
  // til kadensen og det daglige oppgavearbeidet. /planlegging har sin
  // egen tab-stripe (strategi/kadens/oversikt).
  const planningFixedSubs: SubItem[] = [
    // Strategy v2 — Home.
    {
      label: 'My work',
      path: '/planlegging/mitt-arbeid',
      Icon: Star,
      match: ({ pathname }) => pathname === '/planlegging/mitt-arbeid',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    {
      label: 'Strategi & OKR',
      path: '/planlegging?section=strategi',
      Icon: Target,
      match: ({ pathname, search }) =>
        pathname === '/planlegging' &&
        (new URLSearchParams(search).get('section') ?? 'strategi') === 'strategi',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    {
      label: 'Kadens-planlegger',
      path: '/planlegging?section=kadens',
      Icon: Wand2,
      match: ({ pathname, search }) =>
        pathname === '/planlegging' &&
        new URLSearchParams(search).get('section') === 'kadens',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    {
      label: 'Oppgaver & prosjekter',
      path: '/planlegging?section=oversikt',
      Icon: Kanban,
      match: ({ pathname, search }) =>
        pathname === '/planlegging' &&
        new URLSearchParams(search).get('section') === 'oversikt',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    // Strategy v2 — Strategy group: Foundation, Objectives (OKR tree), Strategy map.
    {
      label: 'Foundation',
      path: '/planlegging/foundation',
      Icon: Layers,
      match: ({ pathname }) => pathname === '/planlegging/foundation',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    {
      label: 'Objectives',
      path: '/planlegging/maal?view=tree',
      Icon: Target,
      match: ({ pathname, search }) =>
        pathname === '/planlegging/maal' &&
        (new URLSearchParams(search).get('view') ?? 'tree') === 'tree',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    {
      label: 'Strategy map',
      path: '/planlegging/maal?view=map',
      Icon: Compass,
      match: ({ pathname, search }) =>
        pathname === '/planlegging/maal' &&
        new URLSearchParams(search).get('view') === 'map',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    {
      label: 'Dashboard',
      path: '/planlegging/strategi-dashbord',
      Icon: BarChart3,
      match: ({ pathname }) => pathname === '/planlegging/strategi-dashbord',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    {
      label: 'Alignment',
      path: '/planlegging/justering',
      Icon: FolderTree,
      match: ({ pathname }) => pathname === '/planlegging/justering',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    // Strategy Tools (design "Tools" group) — ported from Strategy v2.
    // Standalone, database-driven surfaces: analysis frameworks, a freeform
    // whiteboard, and interactive diagnostics. English labels match the design.
    {
      label: 'Frameworks',
      path: '/planlegging/frameworks',
      Icon: ClipboardList,
      match: ({ pathname }) => pathname === '/planlegging/frameworks',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    {
      label: 'Whiteboard',
      path: '/planlegging/whiteboard',
      Icon: StickyNote,
      match: ({ pathname }) => pathname === '/planlegging/whiteboard',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    {
      label: 'Assessments',
      path: '/planlegging/assessments',
      Icon: Gauge,
      match: ({ pathname }) => pathname === '/planlegging/assessments',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    // Strategy v2 — Execution group. One workspace at /planlegging/initiativer
    // with ?view= switching (initiatives · projects · timeline · roadmap ·
    // kanban · tasks), each surfaced as its own flat sub.
    {
      label: 'Initiatives',
      path: '/planlegging/initiativer?view=overview',
      Icon: FolderKanban,
      match: ({ pathname, search }) =>
        pathname === '/planlegging/initiativer' &&
        (new URLSearchParams(search).get('view') ?? 'overview') === 'overview',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    {
      label: 'Projects',
      path: '/planlegging/initiativer?view=projects',
      Icon: Briefcase,
      match: ({ pathname, search }) =>
        pathname === '/planlegging/initiativer' &&
        new URLSearchParams(search).get('view') === 'projects',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    {
      label: 'Timeline',
      path: '/planlegging/initiativer?view=gantt',
      Icon: CalendarClock,
      match: ({ pathname, search }) =>
        pathname === '/planlegging/initiativer' &&
        new URLSearchParams(search).get('view') === 'gantt',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    {
      label: 'Roadmap',
      path: '/planlegging/initiativer?view=roadmap',
      Icon: CalendarDays,
      match: ({ pathname, search }) =>
        pathname === '/planlegging/initiativer' &&
        new URLSearchParams(search).get('view') === 'roadmap',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    {
      label: 'Kanban',
      path: '/planlegging/initiativer?view=kanban',
      Icon: Kanban,
      match: ({ pathname, search }) =>
        pathname === '/planlegging/initiativer' &&
        new URLSearchParams(search).get('view') === 'kanban',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    {
      label: 'Tasks',
      path: '/planlegging/initiativer?view=tasks',
      Icon: ListChecks,
      match: ({ pathname, search }) =>
        pathname === '/planlegging/initiativer' &&
        new URLSearchParams(search).get('view') === 'tasks',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    // Strategy v2 — Insight group (same workspace; read views over the
    // initiatives portfolio): health & risk, dependency graph, RACI matrix.
    {
      label: 'Health & risk',
      path: '/planlegging/initiativer?view=health',
      Icon: ShieldAlert,
      match: ({ pathname, search }) =>
        pathname === '/planlegging/initiativer' &&
        new URLSearchParams(search).get('view') === 'health',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    {
      label: 'Dependencies',
      path: '/planlegging/initiativer?view=deps',
      Icon: FolderTree,
      match: ({ pathname, search }) =>
        pathname === '/planlegging/initiativer' &&
        new URLSearchParams(search).get('view') === 'deps',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    {
      label: 'RACI matrix',
      path: '/planlegging/initiativer?view=raci',
      Icon: Scale,
      match: ({ pathname, search }) =>
        pathname === '/planlegging/initiativer' &&
        new URLSearchParams(search).get('view') === 'raci',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    {
      label: 'Data sources',
      path: '/planlegging/datakilder',
      Icon: Database,
      match: ({ pathname }) => pathname === '/planlegging/datakilder',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    // Strategy v2 — Cadence: check-ins, reviews, decision log.
    {
      label: 'Check-ins',
      path: '/planlegging/kadens-strategi?view=checkins',
      Icon: Inbox,
      match: ({ pathname, search }) =>
        pathname === '/planlegging/kadens-strategi' &&
        (new URLSearchParams(search).get('view') ?? 'checkins') === 'checkins',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    {
      label: 'Reviews',
      path: '/planlegging/kadens-strategi?view=reviews',
      Icon: ScrollText,
      match: ({ pathname, search }) =>
        pathname === '/planlegging/kadens-strategi' &&
        new URLSearchParams(search).get('view') === 'reviews',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    {
      label: 'Decision log',
      path: '/planlegging/kadens-strategi?view=history',
      Icon: History,
      match: ({ pathname, search }) =>
        pathname === '/planlegging/kadens-strategi' &&
        new URLSearchParams(search).get('view') === 'history',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    // Strategy v2 — Admin: board-pack reports + workspace settings.
    {
      label: 'Reports',
      path: '/planlegging/rapporter',
      Icon: FileText,
      match: ({ pathname }) => pathname === '/planlegging/rapporter',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    {
      label: 'Accountability',
      path: '/planlegging/ansvarlighet',
      Icon: ShieldCheck,
      match: ({ pathname }) => pathname === '/planlegging/ansvarlighet',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    {
      label: 'Strategy settings',
      path: '/planlegging/strategi-innstillinger',
      Icon: Settings,
      match: ({ pathname }) => pathname === '/planlegging/strategi-innstillinger',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
  ]
  const planningGroup: NavGroup = {
    id: 'planning',
    label: 'Planlegging',
    icon: Compass,
    modules: [
      {
        to: '/planlegging',
        label: 'Planlegging',
        end: false,
        icon: Compass,
        subs: planningFixedSubs,
        permAny: ADMINISTRASJON_NAV_PERMS,
        flatSubs: true,
      },
    ],
  }

  // Cadence — Klarert Cadence-veiviser (HMS-årshjul). Egen group i
  // Styringssystem-seksjonen for å holde inngangen synlig — selve siden
  // /cadence har sin egen tab-stripe for veiviser, planer, årshjul.
  const cadenceFixedSubs: SubItem[] = [
    {
      label: 'Veiviser',
      path: '/cadence?section=veiviser',
      Icon: Wand2,
      match: ({ pathname, search }) =>
        pathname === '/cadence' &&
        (new URLSearchParams(search).get('section') ?? 'veiviser') === 'veiviser',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
    {
      label: 'Aktive planer',
      path: '/cadence?section=planer',
      Icon: ListChecks,
      match: ({ pathname, search }) =>
        pathname === '/cadence' && new URLSearchParams(search).get('section') === 'planer',
      requirePermAny: ADMINISTRASJON_NAV_PERMS,
    },
  ]
  const cadenceGroup: NavGroup = {
    id: 'cadence',
    label: 'Cadence',
    icon: CalendarDays,
    modules: [
      {
        to: '/cadence',
        label: 'Cadence',
        end: false,
        icon: CalendarDays,
        subs: cadenceFixedSubs,
        permAny: ADMINISTRASJON_NAV_PERMS,
        flatSubs: true,
      },
    ],
  }

  // Tilsynssaker — separate Styringssystem group with the tilsynsbrevSubs.
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

  // Avvik.
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

  // Mitt arbeid. "Mine oppgaver" som egen oppføring er fjernet — innboksen
  // viser allerede personlig oppgavekø under «Oppgaver tildelt meg», så et
  // dedikert nav-punkt dupliserer innboksens hovedformål. Plassen er gitt
  // til «Min innsikt» — bedriftens dashboard med faner per modul.
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
        to: '/min-innsikt',
        label: 'Min innsikt',
        end: false,
        icon: BarChart3,
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

  // Section composition.
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
      planningGroup,
      cadenceGroup,
      dashboardsGroup,
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
    return withDerivedModuleBadges([
      { id: 'partner', label: 'Partner', icon: Briefcase, groups: [partnerGroup] },
      ...sections,
    ])
  }
  return withDerivedModuleBadges(sections)
}

/**
 * Populates `NavModule.badgeCount` from the sum of any sub-item
 * `badgeCount` values that bubble up to the module. Modules that already
 * declare an explicit `badgeCount` are left untouched. Returns a fresh
 * tree — no mutation of the input. The shape of the returned tree is
 * identical to the input so consumers can stay oblivious.
 */
function withDerivedModuleBadges(sections: NavSection[]): NavSection[] {
  return sections.map((section) => ({
    ...section,
    groups: section.groups.map((group) => ({
      ...group,
      modules: group.modules.map((mod) => {
        if (mod.badgeCount !== undefined) return mod
        const aggregated = (mod.subs ?? []).reduce(
          (sum, sub) => sum + (sub.badgeCount ?? 0),
          0,
        )
        if (aggregated <= 0) return mod
        return { ...mod, badgeCount: aggregated }
      }),
    })),
  }))
}
