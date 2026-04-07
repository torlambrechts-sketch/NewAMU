import type { StandardReportVisualModel } from '../../lib/standardReportVisualModel'

const R = 'rounded-none'

const DONUT_COLORS = ['#15803d', '#ca8a04', '#2563eb', '#c2410c', '#7c3aed', '#0d9488', '#9333ea']

function DonutCard({
  title,
  segments,
}: {
  title: string
  segments: { label: string; value: number }[]
}) {
  const total = segments.reduce((a, s) => a + Math.max(0, s.value), 0) || 1
  let startPct = 0
  const stops: string[] = []
  segments.forEach((s, i) => {
    const pct = (Math.max(0, s.value) / total) * 100
    const end = startPct + pct
    const c = DONUT_COLORS[i % DONUT_COLORS.length]
    stops.push(`${c} ${startPct}% ${end}%`)
    startPct = end
  })
  const bg = stops.length ? `conic-gradient(${stops.join(', ')})` : '#e5e7eb'

  return (
    <div className={`${R} border border-neutral-200/90 bg-white p-5 shadow-sm`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{title}</p>
      <div className="mt-4 flex flex-wrap items-center gap-6">
        <div
          className="relative size-28 shrink-0 rounded-full border border-neutral-200"
          style={{ background: bg }}
        >
          <div className="absolute inset-[20%] flex flex-col items-center justify-center rounded-full bg-white text-center">
            <span className="text-[9px] font-semibold uppercase text-neutral-500">Total</span>
            <span className="text-lg font-bold tabular-nums text-neutral-900">{Math.round(total)}</span>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
          {segments.map((s, i) => {
            const pct = total > 0 ? Math.round((Math.max(0, s.value) / total) * 1000) / 10 : 0
            return (
              <li key={s.label} className="flex justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                  />
                  <span className="truncate text-neutral-700">{s.label}</span>
                </span>
                <span className="shrink-0 tabular-nums font-medium text-neutral-900">
                  {s.value} <span className="text-neutral-400">({pct}%)</span>
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

export function StandardReportDashboard({
  subtitle,
  model,
  accent,
}: {
  subtitle: string
  model: StandardReportVisualModel
  accent: string
}) {
  return (
    <div className="space-y-6 bg-[#f7f6f2] p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            className="text-2xl font-semibold text-neutral-900 sm:text-3xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            Rapportoversikt
          </h2>
          <p className="mt-1 text-sm text-neutral-600">{subtitle}</p>
        </div>
      </div>

      {model.kpis.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {model.kpis.map((k) => (
            <div
              key={k.id}
              className={`${R} border border-neutral-200/90 bg-white p-5 shadow-sm`}
              style={{ boxShadow: `inset 0 3px 0 0 ${accent}` }}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{k.label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900">{k.value}</p>
              {k.hint ? <p className="mt-1 text-xs text-neutral-500">{k.hint}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      {model.bars.map((b) => {
        const max = Math.max(1, ...b.items.map((i) => i.value))
        return (
          <div key={b.id} className={`${R} border border-neutral-200/90 bg-white p-5 shadow-sm`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{b.title}</p>
            <div className="mt-4 space-y-2">
              {b.items.map((item, i) => {
                const pct = Math.round((item.value / max) * 100)
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs text-neutral-600">
                      <span>{item.label}</span>
                      <span className="tabular-nums font-medium">{item.value}</span>
                    </div>
                    <div className="mt-1 h-2.5 w-full bg-neutral-100">
                      <div
                        className="h-2.5"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {model.donuts.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {model.donuts.map((d) => (
            <DonutCard key={d.id} title={d.title} segments={d.segments} />
          ))}
        </div>
      ) : null}

      {model.tables.map((t) => (
        <div key={t.id} className={`${R} border border-neutral-200/90 bg-white p-5 shadow-sm`}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{t.title}</p>
          <div className="mt-3 max-h-[min(360px,50vh)] overflow-auto border border-neutral-200">
            <table className="w-full min-w-[520px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  {t.columns.map((c) => (
                    <th key={c} className="px-3 py-2 font-semibold text-neutral-700">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-neutral-100">
                    {t.columns.map((c) => (
                      <td key={c} className="px-3 py-2 text-neutral-800">
                        {row[c] != null && row[c] !== '' ? String(row[c]) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
