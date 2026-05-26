// Årshjul — annual cadence with three views: Hjul (wheel SVG),
// Måneder (12-month grid) and Tidslinje (per-owner gantt-style).

import { useMemo, useState } from 'react'
import {
  CalendarClock,
  CalendarDays,
  Check,
  CircleDashed,
  Clock,
  Download,
  GanttChart,
  Plus,
  User,
} from 'lucide-react'
import { Button } from '../../../../components/ui/Button'
import { SearchableSelect } from '../../../../components/ui/SearchableSelect'
import {
  FwChip,
  Initials,
  SectionBanner,
} from './internkontrollShared'
import type { IkCategoryId } from './internkontrollTokens'
import type { FrameworkId } from '../frameworkParagraphs'
import type { IkAarshjulEvent, IkData } from '../useInternkontrollPageData'

type View = 'wheel' | 'grid' | 'timeline'

export function AarshjulSection({
  data,
  frameworks,
  categories,
}: {
  data: IkData
  /** Empty = no filter on framework. Multiple = OR semantics. */
  frameworks: FrameworkId[]
  /** Empty = no filter on category. Multiple = OR semantics. */
  categories: IkCategoryId[]
}) {
  const [view, setView] = useState<View>('wheel')
  const [openMonth, setOpenMonth] = useState<number | null>(null)
  // Year selector — defaults to the current calendar year. Year is
  // captured once per render via `useMemo` so a tab left open across
  // midnight on Dec 31 doesn't shift the wheel mid-session.
  const currentYear = useMemo(() => new Date().getFullYear(), [])
  const [year, setYear] = useState<number>(currentYear)

  // Resolve a kontroll → its set of categories via the page's data
  // pre-computation. The aarshjul event itself doesn't carry category;
  // we look it up from the underlying kontroll so the same filter
  // applies consistently (same data the sidebar count uses).
  const categoriesByControl = useMemo(() => {
    const m = new Map<string, ReadonlySet<string>>()
    for (const k of data.kontroller) {
      m.set(k.id, new Set(k.categories))
    }
    return m
  }, [data.kontroller])

  const events = useMemo(() => {
    const fwSet = frameworks.length ? new Set(frameworks) : null
    const catSet = categories.length ? new Set(categories) : null
    let scoped = !fwSet
      ? data.aarshjul
      : data.aarshjul.filter((a) => a.fw.some((id) => fwSet.has(id)))
    if (catSet) {
      scoped = scoped.filter((a) => {
        const cats = categoriesByControl.get(a.controlId)
        if (!cats) return false
        for (const id of catSet) if (cats.has(id)) return true
        return false
      })
    }
    return scoped.filter((a) => a.year === year)
  }, [data.aarshjul, frameworks, categories, categoriesByControl, year])

  // Years present in the underlying data — used to populate the year
  // picker so the user can scrub through historic / planned years that
  // the data actually contains.
  const yearOptions = useMemo(() => {
    const ys = new Set<number>([currentYear])
    for (const a of data.aarshjul) ys.add(a.year)
    return [...ys].sort((a, b) => a - b)
  }, [data.aarshjul, currentYear])

  return (
    <div className="space-y-4">
      <SectionBanner
        icon={<CalendarClock className="h-4 w-4" />}
        title={`Årshjul ${year}`}
      >
        Når i året hver kontroll skal kjøres. Bygges automatisk fra kontrollenes frekvens og
        koblede krav — kan justeres her.
      </SectionBanner>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5">
          {(
            [
              { id: 'wheel', label: 'Hjul', Icon: CircleDashed },
              { id: 'grid', label: 'Måneder', Icon: CalendarDays },
              { id: 'timeline', label: 'Tidslinje', Icon: GanttChart },
            ] as const
          ).map((v) => (
            <Button
              key={v.id}
              variant="ghost"
              onClick={() => setView(v.id)}
              className={[
                'inline-flex items-center gap-1.5 rounded border-0 px-3 py-1.5 text-xs font-semibold',
                view === v.id
                  ? 'bg-[#1a3d32] text-white hover:bg-[#14312a] hover:text-white'
                  : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900',
              ].join(' ')}
            >
              <v.Icon className="h-3.5 w-3.5" />
              {v.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <SearchableSelect
            value={String(year)}
            onChange={(v) => setYear(Number(v))}
            triggerClassName="py-1.5 text-xs"
            options={yearOptions.map((y) => ({
              value: String(y),
              label: String(y) + (y === currentYear ? ' (i år)' : ''),
            }))}
          />
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="h-3 w-3" />}
            onClick={() => downloadIcs(events, year)}
          >
            Eksporter ICS
          </Button>
          <Button variant="primary" size="sm" icon={<Plus className="h-3 w-3" />}>
            Ny aktivitet
          </Button>
        </div>
      </div>

      {view === 'wheel' && (
        <YearWheel
          data={data}
          events={events}
          year={year}
          currentYear={currentYear}
          openMonth={openMonth}
          onSelectMonth={setOpenMonth}
        />
      )}
      {view === 'grid' && <YearGrid data={data} events={events} />}
      {view === 'timeline' && <YearTimeline data={data} events={events} year={year} />}
    </div>
  )
}

function YearWheel({
  data,
  events,
  year,
  currentYear,
  onSelectMonth,
  openMonth,
}: {
  data: IkData
  events: IkAarshjulEvent[]
  year: number
  currentYear: number
  onSelectMonth: (m: number | null) => void
  openMonth: number | null
}) {
  const size = 540
  const cx = size / 2
  const cy = size / 2
  const outerR = 250
  const innerR = 110
  const months = data.monthNames
  // Highlight "today" inside the current year only — when the user is
  // viewing 2025 from 2026 the marker should be hidden.
  const isViewingCurrentYear = year === currentYear
  const currentMonth = isViewingCurrentYear ? new Date().getMonth() : -1

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-xl border border-neutral-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-center">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="max-w-full overflow-visible"
            role="img"
            aria-label={`Årshjul for ${year} med ${events.length} planlagte aktiviteter`}
          >
            <circle cx={cx} cy={cy} r={outerR} fill="#fbf9f3" stroke="#e3ddcc" />
            {months.map((m, i) => {
              const a0 = (i / 12) * Math.PI * 2 - Math.PI / 2
              const a1 = ((i + 1) / 12) * Math.PI * 2 - Math.PI / 2
              const x0 = cx + outerR * Math.cos(a0)
              const y0 = cy + outerR * Math.sin(a0)
              const x1 = cx + outerR * Math.cos(a1)
              const y1 = cy + outerR * Math.sin(a1)
              const xi0 = cx + innerR * Math.cos(a0)
              const yi0 = cy + innerR * Math.sin(a0)
              const xi1 = cx + innerR * Math.cos(a1)
              const yi1 = cy + innerR * Math.sin(a1)
              const isCur = i === currentMonth
              const isOpen = openMonth === i + 1
              const monthEvents = events.filter((e) => e.month === i + 1)
              const fill = isOpen
                ? '#1a3d32'
                : isCur
                ? '#e7efe9'
                : i % 2 === 0
                ? '#fdfaf3'
                : '#fbf9f3'
              const path = `M ${x0} ${y0} A ${outerR} ${outerR} 0 0 1 ${x1} ${y1} L ${xi1} ${yi1} A ${innerR} ${innerR} 0 0 0 ${xi0} ${yi0} Z`
              const ma = (a0 + a1) / 2
              const labelR = outerR - 22
              const lx = cx + labelR * Math.cos(ma)
              const ly = cy + labelR * Math.sin(ma)
              return (
                <g
                  key={i}
                  onClick={() => onSelectMonth(isOpen ? null : i + 1)}
                  style={{ cursor: 'pointer' }}
                >
                  <path d={path} fill={fill} stroke="#e3ddcc" strokeWidth={1} />
                  <text
                    x={lx}
                    y={ly - 4}
                    textAnchor="middle"
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      fill: isOpen ? '#fff' : '#1d1f1c',
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                    }}
                  >
                    {m}
                  </text>
                  <text
                    x={lx}
                    y={ly + 10}
                    textAnchor="middle"
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      fill: isOpen ? '#e7efe9' : '#6b6f68',
                    }}
                  >
                    {monthEvents.length}
                  </text>
                  {monthEvents.slice(0, 8).map((e, idx) => {
                    const t = idx / Math.max(1, monthEvents.length - 1)
                    const a = a0 + (a1 - a0) * (0.15 + t * 0.7)
                    const dotR = innerR + 22 + (idx % 3) * 22
                    const dx = cx + dotR * Math.cos(a)
                    const dy = cy + dotR * Math.sin(a)
                    const fw0 = data.frameworks.find((f) => f.id === e.fw[0])
                    const color =
                      e.status === 'done' ? '#2f7757' : fw0 ? fw0.color : '#6b6f68'
                    return (
                      <circle
                        key={e.id}
                        cx={dx}
                        cy={dy}
                        r={4.5}
                        fill={color}
                        stroke={isOpen ? '#fff' : '#fbf9f3'}
                        strokeWidth={1.5}
                      />
                    )
                  })}
                </g>
              )
            })}
            <circle cx={cx} cy={cy} r={innerR} fill="#fff" stroke="#e3ddcc" />
            {[0, 3, 6, 9].map((qi) => {
              const a = (qi / 12) * Math.PI * 2 - Math.PI / 2
              return (
                <line
                  key={qi}
                  x1={cx + innerR * Math.cos(a)}
                  y1={cy + innerR * Math.sin(a)}
                  x2={cx + outerR * Math.cos(a)}
                  y2={cy + outerR * Math.sin(a)}
                  stroke="#1a3d32"
                  strokeWidth={1.5}
                  opacity={0.25}
                />
              )
            })}
            {['Q1', 'Q2', 'Q3', 'Q4'].map((q, qi) => {
              const a = ((qi * 3 + 1.5) / 12) * Math.PI * 2 - Math.PI / 2
              const r = outerR + 18
              return (
                <text
                  key={q}
                  x={cx + r * Math.cos(a)}
                  y={cy + r * Math.sin(a) + 4}
                  textAnchor="middle"
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    fill: '#1a3d32',
                    letterSpacing: 1,
                  }}
                >
                  {q}
                </text>
              )
            })}
            <text
              x={cx}
              y={cy - 18}
              textAnchor="middle"
              style={{
                fontFamily: "'Libre Baskerville', serif",
                fontSize: 24,
                fontWeight: 700,
                fill: '#1d1f1c',
              }}
            >
              {year}
            </text>
            <text
              x={cx}
              y={cy + 4}
              textAnchor="middle"
              style={{
                fontSize: 11,
                fontWeight: 700,
                fill: '#6b6f68',
                textTransform: 'uppercase',
                letterSpacing: 1.5,
              }}
            >
              Internkontroll-årshjul
            </text>
            <text
              x={cx}
              y={cy + 26}
              textAnchor="middle"
              style={{ fontSize: 28, fontWeight: 700, fill: '#1a3d32' }}
            >
              {events.length}
            </text>
            <text
              x={cx}
              y={cy + 42}
              textAnchor="middle"
              style={{ fontSize: 10, fontWeight: 600, fill: '#6b6f68' }}
            >
              planlagte aktiviteter
            </text>
            {isViewingCurrentYear &&
              (() => {
                const a = ((currentMonth + 0.5) / 12) * Math.PI * 2 - Math.PI / 2
                const r = outerR + 6
                const tx = cx + r * Math.cos(a)
                const ty = cy + r * Math.sin(a)
                return (
                  <g>
                    <circle cx={tx} cy={ty} r={9} fill="#1a3d32" />
                    <text
                      x={tx}
                      y={ty + 3.5}
                      textAnchor="middle"
                      style={{ fontSize: 10, fontWeight: 700, fill: '#fff' }}
                    >
                      I dag
                    </text>
                  </g>
                )
              })()}
          </svg>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[10px]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#2f7757]" />
            <span className="text-neutral-700">Gjennomført</span>
          </span>
          {data.frameworks.map((f) => (
            <span key={f.id} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: f.color }} />
              <span className="text-neutral-700">{f.short}</span>
            </span>
          ))}
        </div>
      </div>

      <aside className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="border-b border-neutral-100 px-4 py-3">
          <h4 className="text-sm font-semibold text-neutral-900">
            {openMonth ? `${data.monthNames[openMonth - 1]} ${year}` : 'Velg en måned'}
          </h4>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            {openMonth
              ? `${events.filter((e) => e.month === openMonth).length} aktiviteter planlagt.`
              : 'Klikk en sektor i hjulet for å se aktiviteter.'}
          </p>
        </div>
        {openMonth ? (
          <ul className="divide-y divide-neutral-100">
            {events
              .filter((e) => e.month === openMonth)
              .map((e) => (
                <li key={e.id} className="px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <div
                      className={[
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                        e.status === 'done'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-[#fbf9f3] text-[#1a3d32]',
                      ].join(' ')}
                    >
                      {e.status === 'done' ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Clock className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-medium text-neutral-900">{e.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {e.fw.map((fw) => (
                          <FwChip key={fw} fw={fw} frameworks={data.frameworks} />
                        ))}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-neutral-500">
                        <User className="h-2.5 w-2.5" />
                        {e.owner}
                        <span>·</span>
                        <span className="tabular-nums">{e.date}</span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        ) : (
          <div className="space-y-2 p-4">
            <SummaryLine
              icon={<Check className="h-3.5 w-3.5" />}
              tone="green"
              label="Gjennomført"
              count={events.filter((e) => e.status === 'done').length}
            />
            <SummaryLine
              icon={<Clock className="h-3.5 w-3.5" />}
              tone="amber"
              label="Planlagt"
              count={events.filter((e) => e.status === 'planned').length}
            />
            <div className="my-3 h-px bg-neutral-100" />
            <h5 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Største måneder
            </h5>
            <ul className="space-y-1">
              {data.monthNames.map((m, i) => {
                const cnt = events.filter((e) => e.month === i + 1).length
                if (cnt === 0) return null
                return (
                  <li
                    key={i}
                    className="flex cursor-pointer items-center justify-between rounded px-2 py-1 hover:bg-neutral-50"
                    onClick={() => onSelectMonth(i + 1)}
                  >
                    <span className="text-[11px] text-neutral-700">{m}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-100">
                        <div
                          className="h-full bg-[#1a3d32]"
                          style={{ width: `${Math.min(100, (cnt / 5) * 100)}%` }}
                        />
                      </div>
                      <span className="w-6 text-right text-[10px] font-semibold tabular-nums text-neutral-700">
                        {cnt}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </aside>
    </div>
  )
}

function SummaryLine({
  icon,
  tone,
  label,
  count,
}: {
  icon: React.ReactNode
  tone: 'green' | 'amber'
  label: string
  count: number
}) {
  const toneClass = {
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
  }[tone]
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-neutral-200/80 px-2.5 py-2">
      <span className={`flex h-7 w-7 items-center justify-center rounded ${toneClass}`}>
        {icon}
      </span>
      <span className="flex-1 text-[12px] text-neutral-700">{label}</span>
      <span className="text-base font-bold tabular-nums text-neutral-900">{count}</span>
    </div>
  )
}

function YearGrid({ data, events }: { data: IkData; events: IkAarshjulEvent[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.monthNames.map((m, i) => {
        const monthEvents = events.filter((e) => e.month === i + 1)
        return (
          <div
            key={i}
            className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  {Math.floor(i / 3) + 1}. kvartal
                </span>
                <span
                  className="text-sm font-bold text-neutral-900"
                  style={{ fontFamily: "'Libre Baskerville', serif" }}
                >
                  {m}
                </span>
              </div>
              <span className="rounded bg-[#e7efe9] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[#14312a]">
                {monthEvents.length}
              </span>
            </div>
            <ul className="min-h-[120px] space-y-1.5 p-2">
              {monthEvents.map((e) => (
                <li
                  key={e.id}
                  className={[
                    'rounded border px-2 py-1.5',
                    e.status === 'done'
                      ? 'border-green-200 bg-green-50/40'
                      : 'border-neutral-200 bg-neutral-50/40',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-1.5">
                    {e.status === 'done' && (
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-green-700" />
                    )}
                    <span className="flex-1 text-[11px] font-medium leading-snug text-neutral-900">
                      {e.title}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-[9px]">
                    {e.fw.slice(0, 2).map((fw) => (
                      <FwChip key={fw} fw={fw} frameworks={data.frameworks} />
                    ))}
                    <span className="ml-auto tabular-nums text-neutral-500">{e.date}</span>
                  </div>
                </li>
              ))}
              {monthEvents.length === 0 && (
                <li className="py-4 text-center text-[10px] italic text-neutral-400">
                  Ingen aktiviteter
                </li>
              )}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

function YearTimeline({
  data,
  events,
  year,
}: {
  data: IkData
  events: IkAarshjulEvent[]
  year: number
}) {
  const ownersByEvents = useMemo(() => {
    const owners = Array.from(new Set(events.map((e) => e.owner)))
    return owners.map((o) => ({
      name: o,
      events: events.filter((e) => e.owner === o).sort((a, b) => a.month - b.month),
    }))
  }, [events])

  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="border-b border-neutral-100 px-5 py-3">
        <h3 className="text-sm font-semibold text-neutral-900">
          Per ansvarlig — {year}
        </h3>
        <p className="text-[11px] text-neutral-500">
          Hver rad er en eier; hver markør er en planlagt aktivitet.
        </p>
      </div>
      <div className="overflow-x-auto p-5">
        <div className="min-w-[860px]">
          <div className="ml-[160px] grid grid-cols-12 border-b border-neutral-200 pb-1">
            {data.monthNames.map((m, i) => (
              <div
                key={i}
                className="text-center text-[10px] font-bold uppercase tracking-wider text-neutral-500"
              >
                {m}
              </div>
            ))}
          </div>
          {ownersByEvents.length === 0 ? (
            <p className="py-6 text-center text-[12px] italic text-neutral-500">
              Ingen aktiviteter å vise.
            </p>
          ) : (
            ownersByEvents.map((row) => (
              <div
                key={row.name}
                className="relative grid grid-cols-[160px_minmax(0,1fr)] items-center border-b border-neutral-100 py-2"
              >
                <div className="flex items-center gap-2">
                  <Initials name={row.name} size={22} />
                  <span className="text-[12px] font-medium text-neutral-900">{row.name}</span>
                </div>
                <div className="relative grid grid-cols-12">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-7 ${
                        i % 3 === 0
                          ? 'border-l-2 border-[#1a3d32]/15'
                          : 'border-l border-neutral-100'
                      }`}
                    />
                  ))}
                  {row.events.map((e) => {
                    const fw0 = data.frameworks.find((f) => f.id === e.fw[0])
                    const day = parseInt(e.date.split('.')[0] || '1', 10) / 30
                    const left = ((e.month - 1) / 12 + day / 12) * 100
                    return (
                      <span
                        key={e.id}
                        title={`${e.title} (${e.date})`}
                        className="absolute top-1 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-semibold shadow-sm"
                        style={{
                          left: `${left}%`,
                          transform: 'translateX(-50%)',
                          background: fw0 ? fw0.color + '14' : '#fff',
                          borderColor: fw0 ? fw0.color + '60' : '#e5e5e5',
                          color: fw0 ? fw0.color : '#525252',
                        }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{
                            background: e.status === 'done' ? '#2f7757' : fw0?.color || '#737373',
                          }}
                        />
                        <span className="max-w-[120px] truncate">{e.title}</span>
                      </span>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function downloadIcs(events: IkAarshjulEvent[], year: number) {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Klarert//Internkontroll//NB',
  ]
  for (const e of events) {
    const day = parseInt(e.date.split('.')[0] || '1', 10) || 1
    const month = String(e.month).padStart(2, '0')
    const dt = `${year}${month}${String(day).padStart(2, '0')}`
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${e.id}@internkontroll`)
    lines.push(`DTSTAMP:${dt}T080000Z`)
    lines.push(`DTSTART;VALUE=DATE:${dt}`)
    lines.push(`SUMMARY:${escapeIcs(e.title)}`)
    lines.push(`DESCRIPTION:${escapeIcs(`Eier: ${e.owner} · Rammeverk: ${e.fw.join(', ')}`)}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `internkontroll-arshjul-${year}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

// Per RFC 5545 §3.3.11 — escape backslash, comma, semicolon, newline.
// We also strip CR so a malicious "summary" that contains "\r\n..." can't
// inject a new vCalendar field into a downstream parser.
function escapeIcs(s: string): string {
  return s
    .replace(/[\\]/g, '\\\\')
    .replace(/[,;]/g, '\\$&')
    .replace(/\r/g, '')
    .replace(/\n/g, '\\n')
}

