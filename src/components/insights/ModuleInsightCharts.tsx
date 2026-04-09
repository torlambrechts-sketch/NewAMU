/**
 * Donut / list insight cards — same visual language as HSE «HMS-innsikt».
 */
const R_FLAT = 'rounded-none'

export const INSIGHT_CARD =
  `${R_FLAT} flex flex-col border border-neutral-200/90 bg-white p-5 text-left shadow-sm transition hover:border-neutral-300 hover:shadow`

export const INSIGHT_CARD_TOP_RULE = 'mb-4 h-0.5 w-full shrink-0 bg-[#1a3d32]'

export type InsightSeg = { label: string; value: number; color: string }

function conicGradient(segments: InsightSeg[], total: number): string {
  if (total <= 0 || segments.length === 0) {
    return 'conic-gradient(#e5e7eb 0deg 360deg)'
  }
  const parts: string[] = []
  let from = 0
  for (const s of segments) {
    if (s.value <= 0) continue
    const deg = (s.value / total) * 360
    const to = from + deg
    parts.push(`${s.color} ${from}deg ${to}deg`)
    from = to
  }
  if (parts.length === 0) return 'conic-gradient(#e5e7eb 0deg 360deg)'
  return `conic-gradient(${parts.join(', ')})`
}

function DonutChart({ segments, total }: { segments: InsightSeg[]; total: number }) {
  const bg = conicGradient(segments, total)
  return (
    <div
      className="relative mx-auto size-36 shrink-0 rounded-full"
      style={{ background: bg }}
      aria-hidden
    >
      <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-white shadow-inner">
        <span className="text-2xl font-bold tabular-nums text-neutral-900">{total}</span>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-neutral-400">Totalt</span>
      </div>
    </div>
  )
}

export function ModuleDonutCard({
  title,
  subtitle,
  segments,
  total,
  emptyHint,
}: {
  title: string
  subtitle: string
  segments: InsightSeg[]
  total: number
  emptyHint: string
}) {
  return (
    <div className={INSIGHT_CARD}>
      <div className={INSIGHT_CARD_TOP_RULE} />
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-neutral-600">{subtitle}</p>
        </div>
      </div>
      {total === 0 ? (
        <p className="mt-6 text-center text-sm text-neutral-400">{emptyHint}</p>
      ) : (
        <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
          <DonutChart segments={segments} total={total} />
          <ul className="min-w-0 flex-1 space-y-2 text-sm">
            {segments.map((s) => {
              const pct = total > 0 ? Math.round((s.value / total) * 1000) / 10 : 0
              return (
                <li
                  key={s.label}
                  className="flex items-center justify-between gap-2 border-b border-neutral-100 py-1.5 last:border-0"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="truncate text-neutral-700">{s.label}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-neutral-500">
                    {s.value} <span className="text-neutral-400">({pct}%)</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

export function ModuleFilledListCard({
  title,
  subtitle,
  rows,
  emptyHint,
  valueSuffix,
}: {
  title: string
  subtitle: string
  rows: InsightSeg[]
  emptyHint: string
  /** Appended after each numeric value (e.g. "%" for sykefravær). */
  valueSuffix?: string
}) {
  return (
    <div className={INSIGHT_CARD}>
      <div className={INSIGHT_CARD_TOP_RULE} />
      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-neutral-600">{subtitle}</p>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-400">{emptyHint}</p>
      ) : (
        <ul className="mt-4 max-h-52 space-y-0 overflow-y-auto">
          {rows.map((r) => (
            <li
              key={r.label}
              className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2.5 text-sm last:border-0"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                <span className="truncate font-medium text-neutral-800">{r.label}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-neutral-900">
                {r.value}
                {valueSuffix ?? ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
