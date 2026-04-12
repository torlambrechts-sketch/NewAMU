import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { WORKPLACE_LAYOUT_BOX_CARD, WORKPLACE_LAYOUT_BOX_SHADOW } from './workplaceLayoutKit'

const FOREST = '#1a3d32'

export type WorkplaceEventsDayItem = {
  id: string
  /** Small label above title, e.g. «Oppgave», «Samsvar», «Møte» */
  category: string
  title: string
  /** Time range start (e.g. «09:00» or «11:00») */
  startLabel: string
  endLabel?: string
  /** Left accent bar — Tailwind bg class */
  barClassName?: string
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
  /** Shown in header, e.g. «mandag 29. april 2024» */
  dateLabel: string
  onPrevDay?: () => void
  onNextDay?: () => void
  /** Optional date picker trigger (parent supplies input or popover). */
  datePickerSlot?: ReactNode
  tabs: WorkplaceEventsTab[]
  /** Controlled active tab id */
  activeTabId?: string
  defaultTabId?: string
  onTabChange?: (id: string) => void
  footer?: WorkplaceEventsFooter
  className?: string
}

const DEFAULT_BARS = ['bg-sky-500', 'bg-amber-500', 'bg-emerald-600', 'bg-violet-500', 'bg-orange-500']

function tabButtonClass(active: boolean) {
  return `relative pb-2.5 pt-1 text-sm font-medium transition ${
    active ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-800'
  }`
}

/**
 * Day schedule card (events / compliance deadlines) — same shell as workplace «boks».
 * Use for tasks, meetings, or dated compliance items on a selected day.
 */
export function WorkplaceEventsDayCard({
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

  return (
    <div className={`${WORKPLACE_LAYOUT_BOX_CARD} ${className}`} style={WORKPLACE_LAYOUT_BOX_SHADOW}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {datePickerSlot ?? (
            <button
              type="button"
              className="inline-flex max-w-full items-center gap-1.5 rounded-md text-left text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              <CalendarDays className="size-4 shrink-0 text-neutral-500" aria-hidden />
              <span className="truncate">{dateLabel}</span>
              <ChevronDown className="size-4 shrink-0 text-neutral-400" aria-hidden />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrevDay}
            className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
            aria-label="Forrige dag"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={onNextDay}
            className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
            aria-label="Neste dag"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {tabs.length > 1 ? (
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-neutral-100 px-4">
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
          <li className="px-4 py-8 text-center text-sm text-neutral-500">Ingen hendelser denne dagen.</li>
        ) : (
          items.map((ev, i) => {
            const bar = ev.barClassName ?? DEFAULT_BARS[i % DEFAULT_BARS.length]
            return (
              <li key={ev.id} className="flex gap-0">
                <div className="flex w-[4.25rem] shrink-0 flex-col justify-center border-r border-neutral-100 bg-neutral-50/50 px-3 py-3 text-right">
                  <p className="text-xs font-semibold tabular-nums text-neutral-900">{ev.startLabel}</p>
                  {ev.endLabel ? <p className="mt-0.5 text-[11px] tabular-nums text-neutral-400">{ev.endLabel}</p> : null}
                </div>
                <div className={`w-1 shrink-0 self-stretch ${bar}`} aria-hidden />
                <div className="min-w-0 flex-1 py-3 pr-4 pl-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{ev.category}</p>
                  <p className="mt-0.5 text-sm font-semibold text-neutral-900">{ev.title}</p>
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
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-neutral-700 transition hover:bg-neutral-50"
            >
              <FooterInner footer={footer} />
            </Link>
          ) : footer.href ? (
            <a
              href={footer.href}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-neutral-700 transition hover:bg-neutral-50"
            >
              <FooterInner footer={footer} />
            </a>
          ) : (
            <button
              type="button"
              onClick={footer.onMoreClick}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-neutral-700 transition hover:bg-neutral-50"
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
