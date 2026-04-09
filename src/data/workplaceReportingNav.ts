import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  BarChart3,
  ClipboardList,
  FileText,
  HardHat,
  HeartPulse,
  LayoutDashboard,
  LayoutList,
  ShieldAlert,
} from 'lucide-react'
import type { PermissionKey } from '../lib/permissionKeys'

export type WorkplaceReportingNavItem = {
  to: string
  label: string
  end: boolean
  desc: string
  icon: LucideIcon
  requirePerm?: PermissionKey
  requirePermAny?: PermissionKey[]
}

/** Shell subnav, hub pages, and card grid share this list (same order as HSE-style full menu). */
export const WORKPLACE_REPORTING_NAV: readonly WorkplaceReportingNavItem[] = [
  {
    to: '/workplace-reporting',
    label: 'Oversikt',
    end: true,
    desc: 'Samlet inngang til arbeidsplassrapportering og snarveier.',
    icon: LayoutList,
  },
  {
    to: '/workplace-reporting/dashboard',
    label: 'Dashbord',
    end: false,
    desc: 'Tilpassbare faner og rutenett med rapport-widgets (samme som Rapporter).',
    icon: LayoutDashboard,
    requirePerm: 'module.view.workplace_reporting',
  },
  {
    to: '/workplace-reporting/incidents',
    label: 'Hendelser',
    end: false,
    desc: 'Ulykker, nestenulykker og avvik (tidligere under HSE).',
    icon: HardHat,
    requirePermAny: ['module.view.workplace_reporting', 'module.view.hse'],
  },
  {
    to: '/org-health?tab=reporting',
    label: 'Anonym rapportering',
    end: false,
    desc: 'AML-kategorier uten lagring av fritekst.',
    icon: ShieldAlert,
    requirePerm: 'module.view.org_health',
  },
  {
    to: '/tasks?view=whistle',
    label: 'Varslingssaker',
    end: false,
    desc: 'Oppfølging i oppgaver (komité / admin).',
    icon: AlertTriangle,
    requirePerm: 'module.view.tasks',
  },
  {
    to: '/reports',
    label: 'Rapporter',
    end: false,
    desc: 'Standardrapporter, egendefinerte rapporter og verktøy (AMU, IK, ARP).',
    icon: BarChart3,
    requirePerm: 'module.view.dashboard',
  },
  {
    to: '/hse?tab=inspections',
    label: 'Inspeksjoner (HSE)',
    end: false,
    desc: 'Interne og eksterne inspeksjoner med sporbar dokumentasjon.',
    icon: ClipboardList,
    requirePerm: 'module.view.hse',
  },
  {
    to: '/org-health?tab=metrics',
    label: 'AML-indikatorer',
    end: false,
    desc: 'Indikatorer knyttet til arbeidsmiljøloven og internkontroll.',
    icon: HeartPulse,
    requirePerm: 'module.view.org_health',
  },
  {
    to: '/documents/compliance',
    label: 'Samsvar (dokumenter)',
    end: false,
    desc: 'Oversikt over dokumenter, revisjoner og «lest og forstått».',
    icon: FileText,
    requirePerm: 'module.view.dashboard',
  },
]

/** Match NavLink / subnav active state for a hub item. */
export function canAccessWorkplaceReportingItem(
  item: WorkplaceReportingNavItem,
  can: (k: PermissionKey) => boolean,
): boolean {
  if (item.requirePermAny?.length) return item.requirePermAny.some((k) => can(k))
  if (item.requirePerm) return can(item.requirePerm)
  return true
}

export function workplaceReportingNavMatch(
  to: string,
  end: boolean,
  pathname: string,
  search: string,
): boolean {
  if (!to.includes('?')) {
    if (end) return pathname === to
    if (to === '/reports') return pathname === '/reports' || pathname.startsWith('/reports/')
    if (to === '/workplace-reporting/dashboard') return pathname === to
    return pathname === to
  }
  const [path, qs] = to.split('?')
  if (pathname !== path) return false
  const want = new URLSearchParams(qs)
  const have = new URLSearchParams(search)
  for (const key of want.keys()) {
    if (have.get(key) !== want.get(key)) return false
  }
  return true
}

export function workplaceReportingMenuLinkClass(active: boolean) {
  return `inline-flex items-center gap-2 rounded-none border px-4 py-2.5 text-sm font-medium transition ${
    active
      ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
      : 'border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400'
  }`
}
