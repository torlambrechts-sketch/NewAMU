// planningConstants — shared design tokens, label maps, and lookup
// dictionaries for the /planlegging page. Keeping these out of the
// section components means the design language is updated in exactly
// one place when the brand evolves.

import type { LucideIcon } from 'lucide-react'
import {
  AlertCircle,
  Calendar,
  Check,
  Crown,
  Eye,
  GraduationCap,
  Inbox,
  LifeBuoy,
  ListChecks,
  MessageSquareQuote,
  Play,
  ShieldCheck,
  Stethoscope,
  TriangleAlert,
} from 'lucide-react'
import type { OkrHealth } from '../../types/planning'
import type { TaskItemStatus, TaskItemPriority } from '../../types/task'

export const PLANNING_ACCENT = '#1a3d32'
export const PLANNING_ACCENT_SOFT = '#e7efe9'
export const PLANNING_BG = '#fbf9f3'

export const HEALTH_META: Record<
  OkrHealth,
  { label: string; bg: string; text: string; dot: string }
> = {
  on_track: { label: 'På spor', bg: 'bg-green-100', text: 'text-green-800', dot: '#2f7757' },
  at_risk: { label: 'Risiko', bg: 'bg-amber-100', text: 'text-amber-900', dot: '#c98a2b' },
  off_track: { label: 'Ute av kurs', bg: 'bg-red-100', text: 'text-red-800', dot: '#b3382a' },
}

export type PlanningStatusId =
  | 'open'
  | 'in_progress'
  | 'root_cause_identified'
  | 'action_defined'
  | 'action_implemented'
  | 'effectiveness_pending'
  | 'effectiveness_verified'
  | 'closed'
  | 'cancelled'

export const STATUS_META: Record<
  PlanningStatusId,
  { label: string; bg: string; text: string; icon: LucideIcon; column: 'backlog' | 'planlagt' | 'pågår' | 'gjennomgang' | 'fullført' | 'forsinket' }
> = {
  open: { label: 'Backlog', bg: 'bg-neutral-100', text: 'text-neutral-700', icon: Inbox, column: 'backlog' },
  in_progress: { label: 'Pågår', bg: 'bg-indigo-100', text: 'text-indigo-800', icon: Play, column: 'pågår' },
  root_cause_identified: { label: 'Rotårsak', bg: 'bg-blue-100', text: 'text-blue-800', icon: Calendar, column: 'planlagt' },
  action_defined: { label: 'Tiltak definert', bg: 'bg-blue-100', text: 'text-blue-800', icon: Calendar, column: 'planlagt' },
  action_implemented: { label: 'Tiltak iverksatt', bg: 'bg-indigo-100', text: 'text-indigo-800', icon: Play, column: 'pågår' },
  effectiveness_pending: { label: 'Gjennomgang', bg: 'bg-amber-100', text: 'text-amber-900', icon: Eye, column: 'gjennomgang' },
  effectiveness_verified: { label: 'Verifisert', bg: 'bg-green-100', text: 'text-green-800', icon: Check, column: 'fullført' },
  closed: { label: 'Fullført', bg: 'bg-green-100', text: 'text-green-800', icon: Check, column: 'fullført' },
  cancelled: { label: 'Avlyst', bg: 'bg-red-100', text: 'text-red-800', icon: AlertCircle, column: 'forsinket' },
}

export const PRIORITY_META: Record<TaskItemPriority, { label: string; bg: string; text: string }> = {
  critical: { label: 'Kritisk', bg: 'bg-red-100', text: 'text-red-900' },
  high: { label: 'Høy', bg: 'bg-orange-100', text: 'text-orange-900' },
  medium: { label: 'Middels', bg: 'bg-amber-100', text: 'text-amber-900' },
  low: { label: 'Lav', bg: 'bg-neutral-100', text: 'text-neutral-600' },
}

export const KANBAN_COLUMNS: Array<{ id: 'backlog' | 'planlagt' | 'pågår' | 'gjennomgang' | 'fullført'; label: string; icon: LucideIcon }> = [
  { id: 'backlog', label: 'Backlog', icon: Inbox },
  { id: 'planlagt', label: 'Planlagt', icon: Calendar },
  { id: 'pågår', label: 'Pågår', icon: Play },
  { id: 'gjennomgang', label: 'Gjennomgang', icon: Eye },
  { id: 'fullført', label: 'Fullført', icon: Check },
]

// ── Kadens-planlegger — categories + frameworks ──────────────────────────

export type CadenceCategoryId =
  | 'governance'
  | 'hms'
  | 'risiko'
  | 'kompetanse'
  | 'medvirkning'
  | 'beredskap'
  | 'medarbeidere'

export const CADENCE_CATEGORY_META: Record<
  CadenceCategoryId,
  { label: string; icon: LucideIcon; color: string }
> = {
  governance: { label: 'Styring & ledelse', icon: Crown, color: '#1a3d32' },
  hms: { label: 'HMS-kontroller', icon: ShieldCheck, color: '#2f7757' },
  risiko: { label: 'Risiko', icon: TriangleAlert, color: '#c98a2b' },
  kompetanse: { label: 'Kompetanse & opplæring', icon: GraduationCap, color: '#6366F1' },
  medvirkning: { label: 'Medvirkning', icon: MessageSquareQuote, color: '#0EA5E9' },
  beredskap: { label: 'Beredskap', icon: LifeBuoy, color: '#b3382a' },
  medarbeidere: { label: 'Medarbeidere & BHT', icon: Stethoscope, color: '#16A34A' },
}

export type CadenceOriginId = 'aml' | 'iso45001' | 'ik' | 'gdpr' | 'iso27001' | 'nis2' | 'egen'

export const CADENCE_ORIGIN_META: Record<CadenceOriginId, { label: string; color: string; locked?: boolean }> = {
  aml: { label: 'AML', color: '#1a3d32', locked: true },
  iso45001: { label: 'ISO 45001', color: '#16A34A' },
  ik: { label: 'IK-forskrift', color: '#0F766E', locked: true },
  gdpr: { label: 'GDPR', color: '#6366F1' },
  iso27001: { label: 'ISO 27001', color: '#0EA5E9' },
  nis2: { label: 'NIS2', color: '#c98a2b' },
  egen: { label: 'Egen', color: '#737373' },
}

export const FREQ_OPTIONS = [
  { id: 'ukentlig', label: 'Ukentlig', n: 52, days: 7 },
  { id: 'månedlig', label: 'Månedlig', n: 12, days: 30 },
  { id: 'kvartalsvis', label: 'Kvartalsvis', n: 4, days: 90 },
  { id: 'halvårlig', label: 'Halvårlig', n: 2, days: 182 },
  { id: 'årlig', label: 'Årlig', n: 1, days: 365 },
  { id: 'toårig', label: 'Hvert 2. år', n: 0.5, days: 730 },
  { id: 'hendelse', label: 'Ved hendelse', n: 6, days: 60 },
] as const

export type FreqOptionId = (typeof FREQ_OPTIONS)[number]['id']

export const OWNER_OPTIONS = [
  'HMS-leder',
  'HR-leder',
  'Hovedverneombud',
  'Daglig leder',
  'IT-leder',
  'Linjeleder',
  'Verneombud',
  'BHT',
]

/** Status icon helper. */
export function statusIconFor(id: PlanningStatusId): LucideIcon {
  return STATUS_META[id]?.icon ?? ListChecks
}

export function statusColumnFor(id: TaskItemStatus): PlanningStatusId {
  const known = (STATUS_META as Record<string, unknown>)[id]
  return known ? (id as PlanningStatusId) : 'open'
}

/** Safe meta resolver — never returns undefined.icon. Used by views that
 *  render arbitrary task_items rows (incl. legacy/unknown status values
 *  not in STATUS_META). */
export function statusMetaFor(id: TaskItemStatus | string): (typeof STATUS_META)[PlanningStatusId] {
  return STATUS_META[id as PlanningStatusId] ?? STATUS_META.open
}

/** Compute the column to place a task in for the Kanban view.
 *  Unknown statuses fall through to 'backlog'. The 'cancelled' status
 *  maps to 'backlog' explicitly so it doesn't get conflated with
 *  successful closures in the 'fullført' column. */
export function kanbanColumnFor(
  status: TaskItemStatus,
): 'backlog' | 'planlagt' | 'pågår' | 'gjennomgang' | 'fullført' {
  if (status === 'cancelled') return 'backlog'
  const meta = STATUS_META[status as PlanningStatusId]
  if (!meta) return 'backlog'
  // 'forsinket' isn't a real column — coerce overdue tasks to fullført
  // would be wrong; coerce to gjennomgang where they're still actionable.
  if (meta.column === 'forsinket') return 'gjennomgang'
  return meta.column
}

/** Norwegian-style date formatting (dd.mm.åååå). Returns the em-dash
 *  for null/undefined/Invalid Date so callers don't render NaN or
 *  'Invalid Date' strings. */
export function fmtDateShort(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Convert numbers to a Norwegian-friendly representation (comma decimal). */
export function fmtNum(n: number | undefined | null): string {
  if (n == null || Number.isNaN(n)) return '0'
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(1).replace('.', ',')
}
