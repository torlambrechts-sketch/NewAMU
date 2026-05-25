// Shared component primitives used by every Internkontroll section.
//
// Constants (palette, table classes, type aliases) live in
// `internkontrollTokens.ts` next door so this file is component-only
// and Vite Fast Refresh works without warnings.

import type { ReactNode } from 'react'
import {
  AlertCircle,
  BadgeCheck,
  BookOpen,
  Check,
  Circle,
  Eye,
  HardHat,
  LayoutGrid,
  Lock,
  Megaphone,
  PauseCircle,
  PenLine,
  Play,
  Power,
  PowerOff,
  Scale,
  ShieldCheck,
  Tag,
  TriangleAlert,
  Truck,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '../../../../components/ui/Button'
import type { FrameworkId } from '../frameworkParagraphs'
import type {
  IkFramework,
  IkKontroll,
  IkKravStatus,
} from '../useInternkontrollPageData'
import { STATUS_TONE } from './internkontrollTokens'

export { MODULE_TABLE_TH, MODULE_TABLE_TR_BODY, STATUS_TONE, PRIO_TONE, TYPE_TONE } from './internkontrollTokens'
export type { IkSectionId, IkFrameworkFilter } from './internkontrollTokens'

const FW_ICON_MAP: Record<string, LucideIcon> = {
  Scale,
  ShieldCheck,
  BookOpen,
  Lock,
  Eye,
  BadgeCheck,
}

export function FrameworkIcon({ name, className }: { name: string; className?: string }) {
  const I = FW_ICON_MAP[name] ?? Scale
  return <I className={className} />
}

// Icon name → component map for the KATEGORIER sidebar block. Kept
// separate from FW_ICON_MAP because category icons are a different
// palette (work-area metaphors instead of regelverk metaphors), and
// keeping them apart means the type-checker enforces only valid icon
// names per surface.
const KATEGORI_ICON_MAP: Record<string, LucideIcon> = {
  ShieldCheck,
  HardHat,
  Users,
  Megaphone,
  UserCheck,
  TriangleAlert,
  Lock,
  Truck,
  Tag,
  LayoutGrid,
}

export function KategoriIcon({ name, className }: { name: string; className?: string }) {
  const I = KATEGORI_ICON_MAP[name] ?? Tag
  return <I className={className} />
}

export function StatusDot({ status, size = 8 }: { status: IkKravStatus; size?: number }) {
  const c = STATUS_TONE[status]
  return (
    <span
      style={{
        width: size,
        height: size,
        background: c.dot,
        display: 'inline-block',
        borderRadius: '50%',
      }}
    />
  )
}

export function StatusPill({ status }: { status: IkKravStatus }) {
  const s = STATUS_TONE[status]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.bg} ${s.text} ${s.border}`}
    >
      <StatusDot status={status} size={6} />
      {s.label}
    </span>
  )
}

export function FwChip({
  fw,
  frameworks,
}: {
  fw: FrameworkId
  frameworks: IkFramework[]
}) {
  const f = frameworks.find((x) => x.id === fw)
  if (!f) return null
  return (
    <span
      className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold"
      style={{ background: f.color + '14', color: f.color, borderColor: f.color + '40' }}
    >
      <FrameworkIcon name={f.icon} className="h-2.5 w-2.5" />
      {f.short}
    </span>
  )
}

export function CoverageBar({
  covered,
  partial,
  gap,
  total,
  height = 6,
}: {
  covered: number
  partial: number
  gap: number
  total: number
  height?: number
}) {
  const denom = Math.max(total, covered + partial + gap, 1)
  return (
    <div
      className="flex w-full overflow-hidden rounded-full bg-neutral-100"
      style={{ height }}
    >
      <div style={{ width: `${(covered / denom) * 100}%`, background: '#2f7757' }} />
      <div style={{ width: `${(partial / denom) * 100}%`, background: '#c98a2b' }} />
      <div style={{ width: `${(gap / denom) * 100}%`, background: '#b3382a' }} />
    </div>
  )
}

export function CriticalityChip({ value }: { value: 'høy' | 'middels' | 'lav' }) {
  const map = {
    høy: { c: '#9A3412', bg: '#FFEDD5' },
    middels: { c: '#854D0E', bg: '#FEF9C3' },
    lav: { c: '#525252', bg: '#F5F5F5' },
  }
  const m = map[value]
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{ background: m.bg, color: m.c }}
    >
      {value}
    </span>
  )
}

export function FilterPills<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T
  onChange: (v: T) => void
  items: Array<{ id: T; label: string }>
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {items.map((it) => (
        <Button
          key={it.id}
          variant="ghost"
          onClick={() => onChange(it.id)}
          className={[
            'rounded-full border-0 px-2.5 py-1 text-[11px] font-semibold',
            value === it.id
              ? 'bg-[#1a3d32] text-white hover:bg-[#14312a] hover:text-white'
              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-700',
          ].join(' ')}
        >
          {it.label}
        </Button>
      ))}
    </div>
  )
}

export function KontrollStatusBadge({ status }: { status: IkKontroll['status'] }) {
  const map = {
    aktiv: { label: 'Aktiv', bg: 'bg-green-100', text: 'text-green-800', Icon: Power },
    utkast: { label: 'Utkast', bg: 'bg-neutral-100', text: 'text-neutral-600', Icon: PenLine },
    utgått: { label: 'Utgått', bg: 'bg-red-100', text: 'text-red-800', Icon: PowerOff },
  } as const
  const m = map[status]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${m.bg} ${m.text}`}
    >
      <m.Icon className="h-2.5 w-2.5" />
      {m.label}
    </span>
  )
}

export function TiltakStatusPill({
  status,
}: {
  status: 'planlagt' | 'pågår' | 'til-godkjenning' | 'fullført' | 'forsinket'
}) {
  const map = {
    planlagt: { bg: 'bg-neutral-100', text: 'text-neutral-700', Icon: Circle, label: 'Planlagt' },
    pågår: { bg: 'bg-blue-100', text: 'text-blue-800', Icon: Play, label: 'Pågår' },
    'til-godkjenning': {
      bg: 'bg-amber-100',
      text: 'text-amber-900',
      Icon: PauseCircle,
      label: 'Til godkjenning',
    },
    fullført: { bg: 'bg-green-100', text: 'text-green-800', Icon: Check, label: 'Fullført' },
    forsinket: { bg: 'bg-red-100', text: 'text-red-800', Icon: AlertCircle, label: 'Forsinket' },
  } as const
  const m = map[status]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${m.bg} ${m.text}`}
    >
      <m.Icon className="h-2.5 w-2.5" />
      {m.label}
    </span>
  )
}

// ── BridgeStatusBadge — surfaces the CAPA state of the task_items twin
// next to the plan-item's own status pill. Compresses the 9-state task
// lifecycle into 4 user-facing labels (CAPA columns: rapportert /
// pågår / verifikasjon / lukket) so the auditor view stays scannable.
// When the user wants the granular state, the deep-link in TiltakRow
// drops them into Oppgavestyring where the full picker lives.
const BRIDGE_BUCKETS = {
  reported: {
    statuses: ['open', 'todo'] as const,
    label: 'Rapportert',
    bg: 'bg-neutral-100',
    text: 'text-neutral-800',
  },
  progress: {
    statuses: ['in_progress', 'root_cause_identified', 'action_defined', 'action_implemented'] as const,
    label: 'Pågår',
    bg: 'bg-blue-50',
    text: 'text-blue-900',
  },
  verify: {
    statuses: ['effectiveness_pending', 'effectiveness_verified'] as const,
    label: 'Verifikasjon',
    bg: 'bg-violet-50',
    text: 'text-violet-900',
  },
  closed: {
    statuses: ['closed', 'done', 'cancelled'] as const,
    label: 'Lukket',
    bg: 'bg-green-50',
    text: 'text-green-900',
  },
} as const

export function BridgeStatusBadge({ status }: { status: string }) {
  const bucket =
    (Object.values(BRIDGE_BUCKETS).find((b) =>
      (b.statuses as readonly string[]).includes(status),
    ) as typeof BRIDGE_BUCKETS.reported | undefined) ?? BRIDGE_BUCKETS.reported
  return (
    <span
      title={`Oppgave-status: ${status}`}
      className={`inline-flex items-center gap-1 rounded border border-dashed border-current/20 px-1.5 py-0.5 text-[10px] font-semibold ${bucket.bg} ${bucket.text}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-50" />
      {bucket.label}
    </span>
  )
}

export function Stars({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={['h-2 w-2 rounded-sm', i < value ? 'bg-[#1a3d32]' : 'bg-neutral-200'].join(
            ' ',
          )}
        />
      ))}
      <span className="ml-1 text-[10px] tabular-nums text-neutral-500">
        {value}/{max}
      </span>
    </span>
  )
}

export function Initials({ name, size = 24 }: { name: string; size?: number }) {
  const parts = String(name || '?').split(' ').filter(Boolean)
  const initials =
    (parts[0]?.[0] ?? '?').toUpperCase() + (parts[parts.length - 1]?.[0] ?? '').toUpperCase()
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        background: '#e7efe9',
        color: '#1a3d32',
        fontSize: Math.max(9, Math.round(size * 0.42)),
      }}
    >
      {initials || '?'}
    </span>
  )
}

export function SectionBanner({
  icon,
  title,
  children,
  trailing,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
  trailing?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-[#1a3d32]/20 bg-[#e7efe9]/30 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 h-4 w-4 shrink-0 text-[#1a3d32]">{icon}</span>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
          <p className="mt-0.5 text-[12px] text-neutral-700">{children}</p>
        </div>
        {trailing}
      </div>
    </div>
  )
}

export function KpiTile({
  big,
  title,
  sub,
  tone,
}: {
  big: ReactNode
  title: string
  sub: string
  tone?: 'red' | undefined
}) {
  return (
    <div className="rounded-xl px-4 py-4 sm:px-5" style={{ backgroundColor: '#F1ECDF' }}>
      <p
        className={[
          'text-3xl font-bold tabular-nums',
          tone === 'red' && typeof big === 'number' && big > 0 ? 'text-red-800' : 'text-neutral-900',
        ].join(' ')}
      >
        {big}
      </p>
      <p className="mt-1 text-sm font-semibold text-neutral-900">{title}</p>
      <p className="mt-0.5 text-xs text-neutral-600">{sub}</p>
    </div>
  )
}
