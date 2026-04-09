import type { ReactNode } from 'react'
import type { ReportModule } from '../../types/reportBuilder'
import { getAtPath, numberAtPath } from '../../lib/reportDatasets'

const R = 'rounded-none'

function DonutMini({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1
  let startPct = 0
  const stops: string[] = []
  for (const s of segments) {
    const pct = (s.value / total) * 100
    const end = startPct + pct
    stops.push(`${s.color} ${startPct}% ${end}%`)
    startPct = end
  }
  const bg = stops.length ? `conic-gradient(${stops.join(', ')})` : '#e5e7eb'

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative size-24 shrink-0 rounded-full border border-neutral-200"
        style={{ background: bg }}
      >
        <div className="absolute inset-[18%] flex items-center justify-center rounded-full bg-white text-[11px] font-bold text-neutral-800">
          {Math.round(total)}
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1 text-xs">
        {segments.map((s) => (
          <li key={s.label} className="flex justify-between gap-2">
            <span className="flex items-center gap-1.5 truncate text-neutral-600">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
            <span className="shrink-0 font-medium tabular-nums text-neutral-900">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function segmentsFromObject(o: Record<string, unknown>, colors: string[]) {
  return Object.entries(o)
    .filter(([, v]) => typeof v === 'number' && !Number.isNaN(v as number))
    .map(([label, value], i) => ({
      label,
      value: value as number,
      color: colors[i % colors.length],
    }))
}

export type ReportModuleLayoutMode = 'grid2' | 'fluid'

export function ReportModuleWidget({
  module: m,
  datasets,
  accent,
  layoutMode = 'grid2',
  emptyLabel,
}: {
  module: ReportModule
  datasets: Record<string, unknown>
  accent: string
  layoutMode?: ReportModuleLayoutMode
  /** When dataset is missing, show this instead of hiding */
  emptyLabel?: string
}) {
  const colors = ['#15803d', '#ca8a04', '#2563eb', '#c2410c', '#7c3aed']
  const ds = datasets[m.datasetKey]
  const wide = layoutMode === 'grid2' && (m.kind === 'table' || m.kind === 'bar' || m.kind === 'donut')

  const wrap = (inner: ReactNode) => (
    <div
      className={`${R} h-full min-h-[120px] border border-neutral-200/90 bg-white p-5 shadow-sm ${wide ? 'lg:col-span-2' : ''}`}
      style={m.kind === 'kpi' ? { boxShadow: `inset 0 3px 0 0 ${accent}` } : undefined}
    >
      {inner}
    </div>
  )

  if (m.kind === 'kpi') {
    const n = numberAtPath(ds, m.valuePath)
    return wrap(
      <>
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{m.title}</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums text-neutral-900">{n ?? '—'}</p>
        {m.subtitle ? <p className="mt-1 text-xs text-neutral-500">{m.subtitle}</p> : null}
      </>,
    )
  }
  if (m.kind === 'table') {
    const rows = Array.isArray(ds) ? (ds as Record<string, unknown>[]) : []
    const cols = m.rowKeys.length ? m.rowKeys : Object.keys(rows[0] ?? {})
    return wrap(
      <>
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{m.title}</p>
        <div className="mt-3 overflow-x-auto border border-neutral-200">
          <table className="w-full min-w-[480px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                {cols.map((c) => (
                  <th key={c} className="px-3 py-2 font-semibold text-neutral-700">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 8).map((row, ri) => (
                <tr key={ri} className="border-b border-neutral-100">
                  {cols.map((c) => (
                    <td key={c} className="px-3 py-2 text-neutral-800">
                      {String(row[c] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && emptyLabel ? <p className="mt-2 text-xs text-neutral-500">{emptyLabel}</p> : null}
      </>,
    )
  }
  if (m.kind === 'bar') {
    const obj = ds && typeof ds === 'object' && !Array.isArray(ds) ? (ds as Record<string, unknown>) : {}
    const keys = m.seriesKeys.filter((k) => k in obj)
    const nums = keys.map((k) => Number(obj[k]) || 0)
    const max = Math.max(1, ...nums)
    return wrap(
      <>
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{m.title}</p>
        <div className="mt-4 space-y-2">
          {keys.map((k, i) => {
            const v = nums[i] ?? 0
            const pct = Math.round((v / max) * 100)
            return (
              <div key={k}>
                <div className="flex justify-between text-xs text-neutral-600">
                  <span>{k}</span>
                  <span className="tabular-nums font-medium">{v}</span>
                </div>
                <div className="mt-1 h-2 w-full bg-neutral-100">
                  <div
                    className="h-2 transition-all"
                    style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }}
                  />
                </div>
              </div>
            )
          })}
        </div>
        {keys.length === 0 && emptyLabel ? <p className="mt-2 text-xs text-neutral-500">{emptyLabel}</p> : null}
      </>,
    )
  }
  if (m.kind === 'donut') {
    const raw = m.segmentsPath ? getAtPath(ds, m.segmentsPath) : ds
    let segments: { label: string; value: number; color: string }[] = []
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      segments = segmentsFromObject(raw as Record<string, unknown>, colors)
    } else if (ds && typeof ds === 'object' && !Array.isArray(ds)) {
      segments = segmentsFromObject(ds as Record<string, unknown>, colors)
    }
    return wrap(
      <>
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{m.title}</p>
        {segments.length ? (
          <div className="mt-4">
            <DonutMini segments={segments} />
          </div>
        ) : (
          <p className="mt-4 text-xs text-neutral-500">{emptyLabel ?? 'Ingen numeriske felt i datasettet for diagram.'}</p>
        )}
      </>,
    )
  }
  return null
}

export function ReportModulesGrid({
  modules,
  datasets,
  accent,
  layoutMode = 'grid2',
  emptyLabel,
}: {
  modules: ReportModule[]
  datasets: Record<string, unknown>
  accent: string
  layoutMode?: ReportModuleLayoutMode
  emptyLabel?: string
}) {
  return (
    <div className={`grid grid-cols-1 gap-4 ${layoutMode === 'grid2' ? 'lg:grid-cols-2' : ''}`}>
      {modules.map((m) => (
        <ReportModuleWidget
          key={m.id}
          module={m}
          datasets={datasets}
          accent={accent}
          layoutMode={layoutMode}
          emptyLabel={emptyLabel}
        />
      ))}
      {modules.length === 0 ? (
        <p className={`text-sm text-neutral-500 ${layoutMode === 'grid2' ? 'lg:col-span-2' : ''}`}>
          Legg til moduler i redigeringspanelet.
        </p>
      ) : null}
    </div>
  )
}
