import { AlertTriangle, Info, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { WORKPLACE_LAYOUT_BOX_CARD, WORKPLACE_LAYOUT_BOX_SHADOW } from './workplaceLayoutKit'

export type WorkplaceNoticeItem = {
  id: string
  /** Primary line */
  title: string
  /** Secondary line (e.g. timestamp) */
  subtitle?: string
  /** Optional trailing action */
  action?: ReactNode
}

export type WorkplaceNoticePanelProps = {
  variant: 'info' | 'warning'
  title: string
  /** Optional count badge in the header (same role as unread count on notifications). */
  badge?: string | number
  items: WorkplaceNoticeItem[]
  className?: string
}

const VARIANT_META: Record<
  WorkplaceNoticePanelProps['variant'],
  { Icon: LucideIcon; iconWrap: string; badgeClass: string }
> = {
  info: {
    Icon: Info,
    iconWrap: 'bg-sky-100 text-sky-700',
    badgeClass: 'bg-sky-600 text-white',
  },
  warning: {
    Icon: AlertTriangle,
    iconWrap: 'bg-amber-100 text-amber-800',
    badgeClass: 'bg-amber-600 text-white',
  },
}

/**
 * Information / warning list panel — same shell as the layout-reference notification card
 * (white card, uppercase header, optional badge, rows with round icon + text).
 */
export function WorkplaceNoticePanel({ variant, title, badge, items, className = '' }: WorkplaceNoticePanelProps) {
  const { Icon, iconWrap, badgeClass } = VARIANT_META[variant]

  return (
    <div className={`${WORKPLACE_LAYOUT_BOX_CARD} ${className}`} style={WORKPLACE_LAYOUT_BOX_SHADOW}>
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{title}</p>
        {badge != null && badge !== '' ? (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeClass}`}>{badge}</span>
        ) : null}
      </div>
      <ul className="divide-y divide-neutral-100">
        {items.map((it) => (
          <li key={it.id} className="flex gap-3 px-4 py-3">
            <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${iconWrap}`}>
              <Icon className="size-4 shrink-0" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-neutral-800">{it.title}</p>
              {it.subtitle ? <p className="mt-1 text-xs text-neutral-400">{it.subtitle}</p> : null}
            </div>
            {it.action ? <div className="shrink-0">{it.action}</div> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
