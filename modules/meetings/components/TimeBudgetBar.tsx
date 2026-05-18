// Visualises summed agenda-item durations against the meeting's
// scheduled window. Renders nothing when the data isn't usable.

import { useMemo } from 'react'

type Item = { duration_minutes: number | null; title: string; status?: string | null }

export function TimeBudgetBar({
  items,
  scheduledAt,
  endsAt,
  fallbackMinutes,
}: {
  items: Item[]
  scheduledAt: string | null
  endsAt: string | null
  fallbackMinutes?: number
}) {
  const { totalMin, windowMin, overrun } = useMemo(() => {
    const total = items.reduce((s, i) => s + (i.duration_minutes ?? 0), 0)
    let win = fallbackMinutes ?? 0
    if (scheduledAt && endsAt) {
      const ms = new Date(endsAt).getTime() - new Date(scheduledAt).getTime()
      if (ms > 0) win = Math.round(ms / 60000)
    }
    return { totalMin: total, windowMin: win, overrun: win > 0 && total > win }
  }, [items, scheduledAt, endsAt, fallbackMinutes])

  if (totalMin === 0 || windowMin === 0) return null

  return (
    <div className="rounded-lg border border-neutral-200/80 bg-neutral-50/60 p-3">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-semibold text-neutral-700">Tidsbudsjett</span>
        <span className="tabular-nums">
          <span className={overrun ? 'font-bold text-red-700' : 'font-semibold text-neutral-900'}>
            {totalMin} min
          </span>
          <span className="text-neutral-400"> / {windowMin} min</span>
        </span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-neutral-200">
        {items.map((it, idx) => {
          const dur = it.duration_minutes ?? 0
          if (dur === 0) return null
          const w = Math.min(100, (dur / Math.max(windowMin, totalMin)) * 100)
          const color =
            it.status === 'done'
              ? '#0e7490'
              : it.status === 'active'
                ? '#0891b2'
                : '#a8a29e'
          return (
            <span
              key={`${idx}-${it.title}`}
              title={`${it.title} · ${dur} min`}
              style={{ width: `${w}%`, background: color, borderRight: '1px solid white' }}
            />
          )
        })}
      </div>
      {overrun ? (
        <p className="mt-1.5 text-[11px] text-red-700">
          Over tidsbudsjettet med {totalMin - windowMin} min — vurder å forkorte saker.
        </p>
      ) : null}
    </div>
  )
}
