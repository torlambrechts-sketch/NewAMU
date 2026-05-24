// Reusable UI primitives for the new e-learning surfaces. Same look-and-feel
// across hub / detail / builder / viewer so the design feels cohesive without
// each page duplicating chip / pill / rail markup.
import type { ReactNode } from 'react'
import { type LucideIcon } from 'lucide-react'
import {
  AlignLeft,
  AlertTriangle,
  BadgeCheck,
  Briefcase,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  FileDown,
  Flame,
  GitBranch,
  GraduationCap,
  HeartHandshake,
  HelpCircle,
  Info,
  Lock,
  MousePointer2,
  Play,
  ShieldCheck,
  Scale,
  Truck,
  Upload,
  UserPlus,
  Users,
  Video,
  ListChecks,
  Square,
} from 'lucide-react'
import { Badge } from '../ui/Badge'
import {
  ELEARNING_FRAMEWORKS,
  type ElearningFramework,
  type LessonBlockKind,
} from '../../lib/learning/elearningDesignKit'

/** Lookup map for icon strings used in the design kit. Kept small + explicit
 *  so we avoid pulling the entire lucide-react surface lazily. */
const ICON_MAP: Record<string, LucideIcon> = {
  AlignLeft,
  AlertTriangle,
  BadgeCheck,
  Briefcase,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  FileDown,
  Flame,
  GitBranch,
  GraduationCap,
  HeartHandshake,
  HelpCircle,
  Info,
  Lock,
  MousePointer2,
  Play,
  ShieldCheck,
  Scale,
  Truck,
  Upload,
  UserPlus,
  Users,
  Video,
  ListChecks,
  Square,
}

export function DesignIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? BookOpen
  return <Icon className={className} aria-hidden="true" />
}

/** Small pill that shows a framework with its accent colour. */
export function FrameworkPill({ id, className = '' }: { id: string | null | undefined; className?: string }) {
  const framework = ELEARNING_FRAMEWORKS.find((f) => f.id === id)
  if (!framework) return null
  return (
    <span
      className={['inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold', className].join(' ').trim()}
      style={{
        borderColor: framework.color + '40',
        background: framework.color + '12',
        color: framework.color,
      }}
    >
      <DesignIcon name={framework.icon} className="h-2.5 w-2.5" />
      {framework.short}
    </span>
  )
}

/** Cohort status pill ("Aktiv", "Planlagt"…). */
export function CohortStatusPill({ status }: { status: 'planlagt' | 'aktiv' | 'avsluttet' | 'utkast' }) {
  const map = {
    planlagt: { label: 'Planlagt', variant: 'info' as const },
    aktiv: { label: 'Aktiv', variant: 'success' as const },
    avsluttet: { label: 'Avsluttet', variant: 'signed' as const },
    utkast: { label: 'Utkast', variant: 'neutral' as const },
  }
  const s = map[status]
  return <Badge variant={s.variant}>{s.label}</Badge>
}

/** Slim progress bar with optional tone override. */
export function ProgressBar({
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
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className="w-full overflow-hidden rounded-full bg-neutral-200/70"
      style={{ height }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: colors[tone],
          transition: 'width .35s ease',
        }}
      />
    </div>
  )
}

/** Two-letter initials avatar — same palette as the design canvas. */
export function Initials({ name, size = 24, tone = 'forest' }: { name: string; size?: number; tone?: 'forest' | 'cream' | 'sand' }) {
  const parts = String(name || '?').split(' ').filter(Boolean)
  const initials = (parts[0]?.[0] || '?') + (parts[parts.length - 1]?.[0] || '')
  const palette: Record<'forest' | 'cream' | 'sand', { bg: string; fg: string }> = {
    forest: { bg: '#e7efe9', fg: '#1a3d32' },
    cream: { bg: '#f1ecdf', fg: '#5a4a2a' },
    sand: { bg: '#efe9d8', fg: '#6b5a2b' },
  }
  const c = palette[tone]
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
    >
      {initials.toUpperCase()}
    </span>
  )
}

/** "Mode" toggle — Enkel vs Avansert. Persists via local state in caller. */
export type LearningMode = 'easy' | 'advanced'

export function ModeToggle({
  mode,
  onChange,
  compact = false,
}: {
  mode: LearningMode
  onChange: (m: LearningMode) => void
  compact?: boolean
}) {
  const items: { id: LearningMode; label: string; sub: string; icon: 'CircleDot' | 'SlidersHorizontal' }[] = [
    { id: 'easy', label: 'Enkel', sub: 'For alle i felt', icon: 'CircleDot' },
    { id: 'advanced', label: 'Avansert', sub: 'HMS-ansvarlig', icon: 'SlidersHorizontal' },
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
            <ModeIcon name={it.icon} />
            <span>{it.label}</span>
            {!compact ? (
              <span className={['hidden md:inline text-[10px] font-medium', active ? 'text-white/70' : 'text-neutral-400'].join(' ')}>
                · {it.sub}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

function ModeIcon({ name }: { name: 'CircleDot' | 'SlidersHorizontal' }) {
  if (name === 'CircleDot') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="21" y1="4" x2="14" y2="4" />
      <line x1="10" y1="4" x2="3" y2="4" />
      <line x1="21" y1="12" x2="12" y2="12" />
      <line x1="8" y1="12" x2="3" y2="12" />
      <line x1="21" y1="20" x2="16" y2="20" />
      <line x1="12" y1="20" x2="3" y2="20" />
      <line x1="14" y1="2" x2="14" y2="6" />
      <line x1="8" y1="10" x2="8" y2="14" />
      <line x1="16" y1="18" x2="16" y2="22" />
    </svg>
  )
}

/** Sidebar rail entry — used by the Rammeverk filter rail. */
export function RailItem({
  active,
  iconName,
  iconColor,
  label,
  count,
  onClick,
}: {
  active: boolean
  iconName: string
  iconColor?: string
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={[
          'flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors',
          active ? 'bg-[#e7efe9] text-neutral-900' : 'text-neutral-700 hover:bg-neutral-50',
        ].join(' ')}
        style={active ? { boxShadow: 'inset 3px 0 0 #1a3d32' } : undefined}
      >
        <DesignIcon
          name={iconName}
          className={['h-3.5 w-3.5 shrink-0', active ? 'text-[#1a3d32]' : 'text-neutral-500'].join(' ')}
        />
        {iconColor && active ? (
          <span
            aria-hidden="true"
            className="-ml-2.5 inline-block h-3.5 w-3.5"
            style={{ color: iconColor }}
          />
        ) : null}
        <span className={['min-w-0 flex-1 truncate', active ? 'font-semibold' : 'font-medium'].join(' ')}>{label}</span>
        <span
          className={[
            'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
            active ? 'bg-white text-[#14312a]' : 'bg-neutral-100 text-neutral-500',
          ].join(' ')}
        >
          {count}
        </span>
      </button>
    </li>
  )
}

/** Display the colored framework + mandatory + sertifikat row used on cards. */
export function CourseCardOverlay({
  framework,
  mandatory,
  hasCertificate,
  hours,
}: {
  framework: ElearningFramework | null
  mandatory: boolean
  hasCertificate: boolean
  hours: number
}) {
  return (
    <div className="absolute left-2.5 right-2.5 top-1.5 flex items-center justify-between">
      {framework ? <FrameworkPill id={framework.id} /> : <span />}
      <div className="flex items-center gap-1">
        {mandatory ? (
          <span className="inline-flex items-center gap-0.5 rounded bg-white/90 px-1 py-0.5 text-[9px] font-bold text-[#14312a]">
            <ShieldCheck className="h-2 w-2" /> Lovpålagt
          </span>
        ) : null}
        {hasCertificate ? (
          <span className="inline-flex items-center gap-0.5 rounded bg-amber-100/95 px-1 py-0.5 text-[9px] font-bold text-amber-900">
            <BadgeCheck className="h-2 w-2" /> Sertifikat
          </span>
        ) : null}
        <span className="inline-flex items-center gap-0.5 rounded bg-black/30 px-1 py-0.5 text-[9px] font-bold text-white">
          <Clock className="h-2 w-2" /> {hours}t
        </span>
      </div>
    </div>
  )
}

/** Chip used in the design's lesson-block list. */
export function BlockChip({
  type,
  title,
  durationMin,
  questions,
}: {
  type: LessonBlockKind
  title?: string
  durationMin?: number
  questions?: number
}) {
  const map: Record<LessonBlockKind, { icon: string; label: string; tone: string }> = {
    video: { icon: 'Video', label: 'Video', tone: 'bg-purple-100 text-purple-800' },
    text: { icon: 'AlignLeft', label: 'Tekst', tone: 'bg-neutral-100 text-neutral-700' },
    quiz: { icon: 'HelpCircle', label: 'Quiz', tone: 'bg-blue-100 text-blue-800' },
    checklist: { icon: 'ListChecks', label: 'Sjekkliste', tone: 'bg-green-100 text-green-800' },
    interactive: { icon: 'MousePointer2', label: 'Interaktiv', tone: 'bg-pink-100 text-pink-800' },
    scenario: { icon: 'GitBranch', label: 'Scenario', tone: 'bg-amber-100 text-amber-900' },
    callout: { icon: 'Info', label: 'Callout', tone: 'bg-blue-100 text-blue-800' },
    download: { icon: 'Download', label: 'Nedlasting', tone: 'bg-neutral-100 text-neutral-700' },
    practical: { icon: 'Briefcase', label: 'Praktisk', tone: 'bg-orange-100 text-orange-800' },
  }
  const m = map[type]
  return (
    <span className={['inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold', m.tone].join(' ')}>
      <DesignIcon name={m.icon} className="h-2.5 w-2.5" />
      {m.label}
      {title ? <span className="font-normal opacity-80">· {title.length > 22 ? title.slice(0, 20) + '…' : title}</span> : null}
      {durationMin ? <span className="font-normal opacity-70">· {durationMin}min</span> : null}
      {questions ? <span className="font-normal opacity-70">· {questions}q</span> : null}
    </span>
  )
}

/** Card-shadow utility — matches the design canvas k-card-shadow rule. */
export const CARD_SHADOW = '0 1px 2px rgba(0,0,0,0.04)'

/** Wrap content with a thin card border + paper background. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={['rounded-xl border border-neutral-200/80 bg-white', className].join(' ').trim()}
      style={{ boxShadow: CARD_SHADOW }}
    >
      {children}
    </div>
  )
}

/** Aside section used for the right column. */
export function AsideCard({
  title,
  children,
  className = '',
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={['p-4', className].join(' ')}>
      <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
      {children}
    </Card>
  )
}

/** Statistikk-cards background tint. */
export const PAPER_BG = '#fbf9f3'

/** "Forest soft" mint tile used by the rail and selection chips. */
export const MINT_BG = '#e7efe9'

/** Standard table header class. */
export const ELEARNING_TABLE_TH = 'px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-600'
export const ELEARNING_TABLE_TR = 'border-t border-neutral-100 hover:bg-neutral-50/60 transition-colors'
