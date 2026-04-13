import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { WORKPLACE_LAYOUT_BOX_CARD, WORKPLACE_LAYOUT_BOX_SHADOW } from './workplaceLayoutKit'

const FOREST = '#1a3d32'

export type WorkplaceEventsDayItem = {
  id: string
  /** Small label (shown as undertekst som i agenda-liste), e.g. «Oppgave», «Samsvar» */
  category: string
  title: string
  /** Tidslinje, f.eks. «09:00» */
  startLabel: string
  endLabel?: string
}

export type WorkplaceEventsTab = {
  id: string
  label: string
  count?: number
  items: WorkplaceEventsDayItem[]
}

export type WorkplaceEventsFooter = {
  label: string
  avatars?: { id: string; initials: string }[]
  /** In-app route (SPA) */
  to?: string
  /** External URL */
  href?: string
  onMoreClick?: () => void
}

export type WorkplaceEventsDayCardProps = {
  /**
   * `card` — standard hvit boks (layout «boks»).
   * `flat` — ingen ytre hvit ramme/skygge; kun indre skiller (f.eks. Layout_vernerunder på kremflate).
   */
  surface?: 'card' | 'flat'
  /** Korttittel som «Liste agenda» — store bokstaver i header */
  cardTitle?: string
  /** Telling i badge (som agenda), standard = antall rader i aktiv fane */
  badge?: string | number
  dateLabel: string
  onPrevDay?: () => void
  onNextDay?: () => void
  datePickerSlot?: ReactNode
  tabs: WorkplaceEventsTab[]
  activeTabId?: string
  defaultTabId?: string
  onTabChange?: (id: string) => void
  footer?: WorkplaceEventsFooter
  className?: string
}

function tabButtonClass(active: boolean) {
  return `relative pb-2.5 pt-1 text-xs font-semibold transition ${
    active ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-800'
  }`
}

/**
 * Dagens hendelser — samme mønster som {@link WorkplaceEditableNoticeList}:
 * uppercase header + badge, verktøyrad på neutral-50/60, divide-y-rader med ikon-sirkel.
 */
export function WorkplaceEventsDayCard({
  surface = 'card',
  cardTitle = 'Dagens hendelser',
  badge: badgeProp,
  dateLabel,
  onPrevDay,
  onNextDay,
  datePickerSlot,
  tabs,
  activeTabId: controlledTabId,
  defaultTabId,
  onTabChange,
  footer,
  className = '',
}: WorkplaceEventsDayCardProps) {
  const initialTab = defaultTabId ?? tabs[0]?.id ?? 'tab'
  const [uncontrolledTab, setUncontrolledTab] = useState(initialTab)
  const activeId = controlledTabId ?? uncontrolledTab

  const setTab = (id: string) => {
    if (controlledTabId === undefined) setUncontrolledTab(id)
    onTabChange?.(id)
  }

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0]
  const items = activeTab?.items ?? []

  const badge = badgeProp ?? items.length

  const shellClass =
    surface === 'flat'
      ? `overflow-hidden rounded-none border-0 bg-transparent shadow-none ${className}`
      : `${WORKPLACE_LAYOUT_BOX_CARD} ${className}`
  const shellStyle = surface === 'flat' ? undefined : WORKPLACE_LAYOUT_BOX_SHADOW

  return (
    <div className={shellClass.trim()} style={shellStyle}>
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{cardTitle}</p>
        {badge != null && badge !== '' ? (
          <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-bold text-neutral-800">{badge}</span>
        ) : null}
      </div>

      <div className="border-b border-neutral-100 bg-neutral-50/60 px-4 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {datePickerSlot ?? (
              <button
                type="button"
                className="inline-flex max-w-full items-center gap-1.5 rounded-md text-left text-xs font-semibold text-neutral-800 hover:bg-white/80"
              >
                <CalendarDays className="size-3.5 shrink-0 text-neutral-500" aria-hidden />
                <span className="truncate">{dateLabel}</span>
                <ChevronDown className="size-3.5 shrink-0 text-neutral-400" aria-hidden />
              </button>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onPrevDay}
              className="rounded-md p-1.5 text-neutral-500 hover:bg-white hover:text-neutral-800"
              aria-label="Forrige dag"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={onNextDay}
              className="rounded-md p-1.5 text-neutral-500 hover:bg-white hover:text-neutral-800"
              aria-label="Neste dag"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {tabs.length > 1 ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-neutral-100 bg-neutral-50/60 px-4 pb-2 pt-0">
          {tabs.map((t) => {
            const active = t.id === activeId
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={tabButtonClass(active)}
                style={
                  active
                    ? {
                        boxShadow: `inset 0 -2px 0 0 ${FOREST}`,
                      }
                    : undefined
                }
              >
                {t.label}
                {t.count != null ? <span className="ml-1 tabular-nums text-neutral-500">({t.count})</span> : null}
              </button>
            )
          })}
        </div>
      ) : null}

      <ul className="divide-y divide-neutral-100">
        {items.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-neutral-500">Ingen hendelser denne dagen.</li>
        ) : (
          items.map((ev) => {
            const timeLine = [ev.startLabel, ev.endLabel].filter(Boolean).join(' – ')
            const subParts = [timeLine, ev.category].filter(Boolean)
            const subtitle = subParts.join(' · ')
            return (
              <li key={ev.id} className="flex gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                  <Clock className="size-4 shrink-0" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-neutral-800">{ev.title}</p>
                  {subtitle ? <p className="mt-1 text-xs text-neutral-400">{subtitle}</p> : null}
                </div>
              </li>
            )
          })
        )}
      </ul>

      {footer ? (
        <div className="border-t border-neutral-100">
          {footer.to ? (
            <Link
              to={footer.to}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-neutral-800 transition hover:bg-neutral-50"
            >
              <FooterInner footer={footer} />
            </Link>
          ) : footer.href ? (
            <a
              href={footer.href}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-neutral-800 transition hover:bg-neutral-50"
            >
              <FooterInner footer={footer} />
            </a>
          ) : (
            <button
              type="button"
              onClick={footer.onMoreClick}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-neutral-800 transition hover:bg-neutral-50"
            >
              <FooterInner footer={footer} />
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}

function FooterInner({ footer }: { footer: WorkplaceEventsFooter }) {
  return (
    <>
      <span className="min-w-0">{footer.label}</span>
      <span className="flex shrink-0 items-center gap-1">
        {(footer.avatars ?? []).slice(0, 5).map((a) => (
          <span
            key={a.id}
            className="flex size-7 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-[10px] font-semibold text-neutral-600"
          >
            {a.initials}
          </span>
        ))}
        <ChevronRight className="size-4 text-neutral-400" aria-hidden />
      </span>
    </>
  )
}
