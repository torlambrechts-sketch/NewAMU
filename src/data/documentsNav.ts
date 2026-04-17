import type { LucideIcon } from 'lucide-react'
import { ClipboardCheck, LayoutList, Settings2, ShieldCheck } from 'lucide-react'

export type DocumentsNavItem = {
  id: 'home' | 'compliance' | 'templates' | 'annual_review'
  to: string
  label: string
  icon: LucideIcon
  /** If set, item is shown only when `can(permission)` is true */
  permission?: 'documents.manage'
}

export const DOCUMENTS_NAV: readonly DocumentsNavItem[] = [
  {
    id: 'home',
    to: '/documents',
    label: 'Oversikt',
    icon: LayoutList,
  },
  {
    id: 'compliance',
    to: '/documents/compliance',
    label: 'Samsvar',
    icon: ShieldCheck,
  },
  {
    id: 'templates',
    to: '/documents/templates',
    label: 'Maler',
    icon: Settings2,
  },
  {
    id: 'annual_review',
    to: '/documents/aarsgjennomgang',
    label: 'Årsgjennomgang',
    icon: ClipboardCheck,
    permission: 'documents.manage',
  },
] as const

/** Active tab: first matching rule wins (order in DOCUMENTS_NAV). */
export function documentsNavActiveId(pathname: string): DocumentsNavItem['id'] | null {
  if (pathname.startsWith('/documents/page/')) return null
  if (pathname.startsWith('/documents/space/')) return 'home'
  if (pathname.startsWith('/documents/compliance')) return 'compliance'
  if (pathname === '/documents/templates') return 'templates'
  if (pathname === '/documents/aarsgjennomgang') return 'annual_review'
  if (pathname === '/documents' || pathname === '') return 'home'
  return null
}

export function documentsMenuLinkClass(active: boolean): string {
  return `inline-flex items-center gap-2 rounded-none border px-4 py-2.5 text-sm font-medium transition ${
    active
      ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
      : 'border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400'
  }`
}

export const DOCUMENTS_MODULE_TITLE = 'Bibliotek & wiki'

export const DOCUMENTS_MODULE_DESC =
  'HMS-håndbok, policyer og prosedyrer — tilpasset internkontroll og dokumentasjonskrav.'
