/* eslint-disable no-restricted-syntax -- segmented controls and small tonal
   pills are intentionally styled native buttons; the Button primitive's
   default chrome (border, padding, color) would visibly break the design.
   See DESIGN_SYSTEM.md §3 — bespoke chrome must wrap raw <button>. */
/* eslint-disable react-refresh/only-export-components -- co-located helpers
   (formatters, taxonomy maps, status taxonomy) live alongside the shared
   components they ship for. Moving them out triples the import surface for
   the three consumers (DocumentsHome, WikiPageView, DocumentEditPage)
   without any architectural benefit. */

// Shared primitives used by the redesigned Documents pages.
// Mirror the design-handover tokens so DocumentsHome, the detail view, and
// the editor stay in lock-step.

import type { ReactNode } from 'react'
import {
  AlertTriangle,
  BookOpen,
  CircleDot,
  FileText,
  IdCard,
  ListChecks,
  Scale,
  Siren,
  SlidersHorizontal,
  Users,
} from 'lucide-react'
import { Badge, type BadgeVariant } from '../ui/Badge'
import type { PageStatus, SpaceCategory } from '../../types/documents'

// ─── Mode toggle (Enkel / Avansert) ───────────────────────────────────────────
export type DocsMode = 'easy' | 'advanced'

export function ModeToggle({
  mode,
  onChange,
  compact = false,
}: {
  mode: DocsMode
  onChange: (m: DocsMode) => void
  compact?: boolean
}) {
  const items: { id: DocsMode; label: string; sub: string }[] = [
    { id: 'easy', label: 'Enkel', sub: 'For alle i felt' },
    { id: 'advanced', label: 'Avansert', sub: 'HMS-ansvarlig' },
  ]
  return (
    <div
      role="tablist"
      aria-label="Visningsmodus"
      className="inline-flex items-center gap-1 rounded-md border border-neutral-200/80 bg-white p-1"
      style={{ boxShadow: '0 1px 1px rgba(0,0,0,0.03)' }}
    >
      {items.map((it) => {
        const active = it.id === mode
        const Icon = it.id === 'easy' ? CircleDot : SlidersHorizontal
        return (
          <button
            key={it.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.id)}
            className={[
              'flex items-center gap-2 rounded-[5px] px-2.5 py-1.5 text-xs font-semibold transition-colors',
              active ? 'bg-[#1a3d32] text-white' : 'text-neutral-600 hover:text-neutral-900',
            ].join(' ')}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            <span>{it.label}</span>
            {!compact ? (
              <span
                className={[
                  'hidden md:inline text-[10px] font-medium',
                  active ? 'text-white/70' : 'text-neutral-400',
                ].join(' ')}
              >
                · {it.sub}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

// ─── Progress bar (mirrors design Shared.jsx ProgressBar) ─────────────────────
export function DocProgressBar({
  value,
  tone = 'forest',
  height = 4,
}: {
  value: number
  tone?: 'forest' | 'warn' | 'danger'
  height?: number
}) {
  const colors: Record<'forest' | 'warn' | 'danger', string> = {
    forest: '#1a3d32',
    warn: '#c98a2b',
    danger: '#b3382a',
  }
  const clamped = Math.max(0, Math.min(1, value))
  return (
    <div
      className="w-full overflow-hidden rounded-full bg-neutral-200/70"
      style={{ height }}
      aria-hidden
    >
      <div
        style={{
          width: `${Math.round(clamped * 100)}%`,
          height: '100%',
          background: colors[tone],
          transition: 'width .35s ease',
        }}
      />
    </div>
  )
}

// ─── Initials avatar ──────────────────────────────────────────────────────────
export function Initials({
  name,
  size = 24,
  tone = 'forest',
}: {
  name: string
  size?: number
  tone?: 'forest' | 'cream' | 'sand'
}) {
  const palette = {
    forest: { bg: '#e7efe9', fg: '#1a3d32' },
    cream: { bg: '#f1ecdf', fg: '#5a4a2a' },
    sand: { bg: '#efe9d8', fg: '#6b5a2b' },
  } as const
  const c = palette[tone]
  const parts = String(name).split(/\s+/).filter(Boolean)
  const initials = ((parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '')).toUpperCase() || '?'
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        background: c.bg,
        color: c.fg,
        fontSize: Math.max(9, Math.round(size * 0.42)),
        letterSpacing: 0.2,
      }}
      aria-hidden
    >
      {initials}
    </span>
  )
}

// ─── Doc kind taxonomy (maps SpaceCategory → design "kind") ───────────────────
export type DocKind = 'hms' | 'rutine' | 'risiko' | 'personal' | 'annet'

const SPACE_TO_KIND: Record<SpaceCategory, DocKind> = {
  hms_handbook: 'hms',
  policy: 'personal',
  procedure: 'rutine',
  guide: 'annet',
  template_library: 'annet',
  varsling: 'rutine',
  personal: 'personal',
  personvern: 'annet',
  likestilling: 'personal',
  protokoll: 'annet',
  register: 'annet',
  beredskap: 'hms',
  bransje: 'annet',
}

export function categoryToKind(c?: SpaceCategory | null): DocKind {
  if (!c) return 'annet'
  return SPACE_TO_KIND[c] ?? 'annet'
}

export const DOC_KIND_LABEL: Record<DocKind, string> = {
  hms: 'HMS-håndbok',
  rutine: 'Rutiner & prosedyrer',
  risiko: 'Risikovurdering',
  personal: 'Personalhåndbok',
  annet: 'Annet',
}

export function DocKindIcon({
  kind,
  className = 'h-4 w-4',
}: {
  kind: DocKind
  className?: string
}) {
  const map = {
    hms: BookOpen,
    rutine: ListChecks,
    risiko: AlertTriangle,
    personal: Users,
    annet: FileText,
  } as const
  const Icon = map[kind] ?? FileText
  return <Icon className={className} aria-hidden />
}

// ─── Status taxonomy ──────────────────────────────────────────────────────────
// The design enumerates: kladd · til godkjenning · publisert · til revisjon · utgått.
// We derive the right status from WikiPage + review request + revision due.
export type DocStatusKey =
  | 'kladd'
  | 'til godkjenning'
  | 'publisert'
  | 'til revisjon'
  | 'utgått'

export const DOC_STATUS: Record<DocStatusKey, { label: string; variant: BadgeVariant }> = {
  kladd: { label: 'Kladd', variant: 'neutral' },
  'til godkjenning': { label: 'Til godkjenning', variant: 'warning' },
  publisert: { label: 'Publisert', variant: 'success' },
  'til revisjon': { label: 'Til revisjon', variant: 'info' },
  utgått: { label: 'Utgått', variant: 'danger' },
}

export function DocStatusPill({ status }: { status: DocStatusKey }) {
  const s = DOC_STATUS[status] ?? DOC_STATUS.kladd
  return <Badge variant={s.variant}>{s.label}</Badge>
}

/**
 * Derive the design's status from server-side state. Order matters:
 *  - archived → utgått
 *  - pending review → til godkjenning
 *  - revision due within window → til revisjon
 *  - draft → kladd
 *  - default → publisert
 */
export function deriveDocStatus({
  status,
  archived,
  pendingReview,
  nextRevisionAtMs,
  now,
  reviewWindowDays = 60,
}: {
  status: PageStatus
  archived?: boolean
  pendingReview?: boolean
  nextRevisionAtMs?: number | null
  now?: number
  reviewWindowDays?: number
}): DocStatusKey {
  if (archived || status === 'archived') return 'utgått'
  if (pendingReview) return 'til godkjenning'
  if (
    nextRevisionAtMs != null &&
    Number.isFinite(nextRevisionAtMs) &&
    (nextRevisionAtMs - (now ?? Date.now())) / 86_400_000 <= reviewWindowDays
  ) {
    return 'til revisjon'
  }
  if (status === 'draft') return 'kladd'
  return 'publisert'
}

// ─── Lovpålagt badge (shield) ─────────────────────────────────────────────────
export function LovpaalagtChip() {
  return (
    <span
      title="Lovpålagt"
      className="inline-flex items-center gap-1 rounded border border-[#c5d3c8] bg-[#e7efe9] px-2 py-0.5 text-[11px] font-semibold text-[#14312a]"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-3 w-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
      Lovpålagt
    </span>
  )
}

// ─── Lov chip (small) ─────────────────────────────────────────────────────────
export function LovChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded bg-[#e7efe9] px-1.5 py-0.5 text-[10px] font-semibold text-[#14312a]">
      {children}
    </span>
  )
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
export function formatIsoDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatIsoDateTime(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function daysUntil(iso?: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (Number.isNaN(ms)) return null
  return Math.round(ms / 86_400_000)
}

// ─── Semantic version display ─────────────────────────────────────────────────
// Internally version is a positive integer. Display it as "v{n}.0" so the
// design's semantic versioning treatment stays consistent.
export function displayVersion(version: number, majorOverride?: number, minorOverride?: number): string {
  if (majorOverride != null && minorOverride != null) {
    return `${majorOverride}.${minorOverride}`
  }
  // Treat integer version as <n>.0
  return `${version}.0`
}

// Mapping the design's kind icons for additional uses (templates table)
export function templateKindIcon(name: string) {
  const map: Record<string, typeof BookOpen> = {
    hms: BookOpen,
    rutine: ListChecks,
    risiko: AlertTriangle,
    personal: IdCard,
    policy: Scale,
    beredskap: Siren,
  }
  return map[name] ?? FileText
}
