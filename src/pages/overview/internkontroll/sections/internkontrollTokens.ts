// Non-component tokens shared across the Internkontroll section
// renderers. Lives in its own .ts file so the .tsx primitives file
// stays "components-only" (fast-refresh rule).

import type { IkKontroll, IkKravStatus } from '../useInternkontrollPageData'

export const MODULE_TABLE_TH =
  'border-b border-neutral-200 bg-neutral-50/60 px-5 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500'
export const MODULE_TABLE_TR_BODY =
  'border-b border-neutral-100 transition-colors hover:bg-neutral-50/60'

export const STATUS_TONE: Record<
  IkKravStatus,
  { bg: string; text: string; border: string; label: string; dot: string }
> = {
  covered: {
    bg: 'bg-green-100',
    text: 'text-green-900',
    border: 'border-green-200',
    label: 'Dekket',
    dot: '#2f7757',
  },
  partial: {
    bg: 'bg-amber-100',
    text: 'text-amber-900',
    border: 'border-amber-200',
    label: 'Delvis',
    dot: '#c98a2b',
  },
  gap: {
    bg: 'bg-red-100',
    text: 'text-red-900',
    border: 'border-red-200',
    label: 'Gap',
    dot: '#b3382a',
  },
  na: {
    bg: 'bg-neutral-100',
    text: 'text-neutral-700',
    border: 'border-neutral-200',
    label: 'Ikke aktuelt',
    dot: '#a3a3a3',
  },
}

export const PRIO_TONE: Record<
  'kritisk' | 'høy' | 'middels' | 'lav',
  { bg: string; text: string; border: string }
> = {
  kritisk: { bg: 'bg-red-100', text: 'text-red-900', border: 'border-red-200' },
  høy: { bg: 'bg-orange-100', text: 'text-orange-900', border: 'border-orange-200' },
  middels: { bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-200' },
  lav: { bg: 'bg-neutral-100', text: 'text-neutral-700', border: 'border-neutral-200' },
}

export const TYPE_TONE: Record<
  'forebyggende' | 'oppdagende' | 'korrigerende',
  { bg: string; text: string; label: string }
> = {
  forebyggende: { bg: '#e7efe9', text: '#1a3d32', label: 'Forebyggende' },
  oppdagende: { bg: '#DBEAFE', text: '#1E40AF', label: 'Oppdagende' },
  korrigerende: { bg: '#FFEDD5', text: '#9A3412', label: 'Korrigerende' },
}

export type IkSectionId =
  | 'oversikt'
  | 'krav'
  | 'kontroller'
  | 'gap'
  | 'aarshjul'
  | 'tiltak'
  | 'prosjekter'
  | 'revisjon'

import type { FrameworkId } from '../frameworkParagraphs'
export type IkFrameworkFilter = FrameworkId | 'all'

// Re-exported here so primitives can reference status type without
// needing to import the broader useInternkontrollPageData shape.
export type { IkKontroll }
