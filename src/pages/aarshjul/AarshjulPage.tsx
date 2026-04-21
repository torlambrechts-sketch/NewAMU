import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react'
import { useCouncil } from '../../hooks/useCouncil'
import { useHse } from '../../hooks/useHse'
import { isSafetyRoundUpcoming, safetyRoundCalendarDateIso } from '../../lib/safetyRoundCalendar'
import { useInternalControl } from '../../hooks/useInternalControl'
import { useOrgHealth } from '../../hooks/useOrgHealth'
import { useLearning } from '../../hooks/useLearning'

// ─── Event types ──────────────────────────────────────────────────────────────

type EventKind =
  | 'amu_meeting'
  | 'safety_round'
  | 'inspection'
  | 'incident'
  | 'ros_review'
  | 'annual_review'
  | 'survey'
  | 'sick_leave_milestone'
  | 'training_expiry'
  | 'certification_expiry'
  | 'sja'

type WheelEvent = {
  id: string
  kind: EventKind
  label: string
  /** 1–12 */
  month: number
  year: number
  status: 'done' | 'pending' | 'overdue'
  link?: string
  detail?: string
}

const KIND_COLOUR: Record<EventKind, { bg: string; text: string; dot: string }> = {
  amu_meeting:            { bg: 'bg-[#1a3d32]/10', text: 'text-[#1a3d32]',  dot: '#1a3d32' },
  safety_round:           { bg: 'bg-emerald-100',   text: 'text-emerald-800', dot: '#059669' },
  inspection:             { bg: 'bg-sky-100',        text: 'text-sky-800',     dot: '#0284c7' },
  incident:               { bg: 'bg-red-100',        text: 'text-red-800',     dot: '#dc2626' },
  ros_review:             { bg: 'bg-amber-100',      text: 'text-amber-800',   dot: '#d97706' },
  annual_review:          { bg: 'bg-purple-100',     text: 'text-purple-800',  dot: '#7c3aed' },
  survey:                 { bg: 'bg-teal-100',       text: 'text-teal-800',    dot: '#0d9488' },
  sick_leave_milestone:   { bg: 'bg-orange-100',     text: 'text-orange-800',  dot: '#ea580c' },
  training_expiry:        { bg: 'bg-rose-100',       text: 'text-rose-800',    dot: '#e11d48' },
  certification_expiry:   { bg: 'bg-pink-100',       text: 'text-pink-800',    dot: '#db2777' },
  sja:                    { bg: 'bg-neutral-100',    text: 'text-neutral-700', dot: '#6b7280' },
}

const KIND_LABELS: Record<EventKind, string> = {
  amu_meeting:          'AMU-møte',
  safety_round:         'Vernerunde',
  inspection:           'Inspeksjon',
  incident:             'Hendelse',
  ros_review:           'ROS-vurdering',
  annual_review:        'Årsgjennomgang',
  survey:               'Undersøkelse',
  sick_leave_milestone: 'Sykefravær-frist',
  training_expiry:      'Opplæring utløper',
  certification_expiry: 'Sertifikat utløper',
  sja:                  'SJA',
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des']

function isoToMonthYear(iso: string): { month: number; year: number } {
  const d = new Date(iso)
  return { month: d.getMonth() + 1, year: d.getFullYear() }
}

function statusFor(dateIso: string, done?: boolean): WheelEvent['status'] {
  if (done) return 'done'
  const now = new Date()
  const d = new Date(dateIso)
  if (d < now) return 'overdue'
  return 'pending'
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AarshjulPage() {
  const council = useCouncil()
  const hse = useHse()
  const ic = useInternalControl()
  const oh = useOrgHealth()
  const learning = useLearning()

  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [filterKind, setFilterKind] = useState<EventKind | 'all'>('all')
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)

  // ── Collect events from all modules ────────────────────────────────────────

  const events = useMemo<WheelEvent[]>(() => {
    const all: WheelEvent[] = []

    // AMU meetings
    council.meetings
      .filter((m) => m.governanceYear === year)
      .forEach((m) => {
        const { month } = isoToMonthYear(m.startsAt)
        all.push({
          id: m.id,
          kind: 'amu_meeting',
          label: m.title,
          month,
          year,
          status: m.status === 'completed' ? 'done' : m.status === 'cancelled' ? 'done' : statusFor(m.startsAt),
          link: '/council?tab=meetings',
          detail: `${m.location} · Q${m.quarterSlot ?? '?'}`,
        })
      })

    // Safety rounds (planlagt = kalenderdato fra plannedAt; ellers gjennomført)
    hse.safetyRounds.forEach((r) => {
      const calIso = safetyRoundCalendarDateIso(r)
      if (new Date(calIso).getFullYear() !== year) return
      const { month } = isoToMonthYear(calIso)
      const planned = r.scheduleKind === 'planned'
      const st = planned
        ? isSafetyRoundUpcoming(r)
          ? 'pending'
          : 'overdue'
        : 'done'
      all.push({
        id: r.id,
        kind: 'safety_round',
        label: r.title,
        month,
        year,
        status: st,
        link: '/vernerunder',
        detail: planned ? `Planlagt · ${r.location}` : r.location,
      })
    })

    // Inspections
    hse.inspections
      .filter((i) => new Date(i.conductedAt).getFullYear() === year)
      .forEach((i) => {
        const { month } = isoToMonthYear(i.conductedAt)
        all.push({ id: i.id, kind: 'inspection', label: i.title, month, year, status: i.status === 'closed' ? 'done' : statusFor(i.conductedAt), link: '/hse?tab=inspections' })
      })

    // Incidents (high/critical only for the wheel)
    hse.incidents
      .filter((i) => new Date(i.occurredAt).getFullYear() === year && (i.severity === 'high' || i.severity === 'critical'))
      .forEach((i) => {
        const { month } = isoToMonthYear(i.occurredAt)
        all.push({ id: i.id, kind: 'incident', label: `${i.kind === 'violence' ? 'Vold: ' : i.kind === 'threat' ? 'Trussel: ' : ''}${i.location}`, month, year, status: i.status === 'closed' ? 'done' : 'overdue', link: '/workplace-reporting/incidents' })
      })

    // SJA
    hse.sjaAnalyses
      .filter((s) => new Date(s.plannedAt).getFullYear() === year)
      .forEach((s) => {
        const { month } = isoToMonthYear(s.plannedAt)
        all.push({ id: s.id, kind: 'sja', label: s.title, month, year, status: s.status === 'approved' ? 'done' : statusFor(s.plannedAt), link: '/hse?tab=sja' })
      })

    // Sick leave milestones
    hse.sickLeaveCases
      .filter((c) => c.status === 'active' || c.status === 'partial')
      .forEach((c) => {
        c.milestones
          .filter((m) => new Date(m.dueAt).getFullYear() === year)
          .forEach((m) => {
            const { month } = isoToMonthYear(m.dueAt)
            all.push({ id: `${c.id}-${m.kind}`, kind: 'sick_leave_milestone', label: `${c.employeeName}: ${m.label}`, month, year, status: m.completedAt ? 'done' : statusFor(m.dueAt), link: '/hse?tab=sickness' })
          })
      })

    // Training expiry
    hse.trainingRecords
      .filter((r) => r.expiresAt && new Date(r.expiresAt).getFullYear() === year)
      .forEach((r) => {
        const { month } = isoToMonthYear(r.expiresAt!)
        all.push({ id: r.id, kind: 'training_expiry', label: `${r.employeeName}: ${r.trainingKind}`, month, year, status: statusFor(r.expiresAt!), link: '/hse?tab=training' })
      })

    // ROS assessments
    ic.rosAssessments
      .filter((r) => new Date(r.assessedAt).getFullYear() === year)
      .forEach((r) => {
        const { month } = isoToMonthYear(r.assessedAt)
        all.push({ id: r.id, kind: 'ros_review', label: r.title, month, year, status: 'done', link: '/internal-control?tab=ros', detail: r.department })
      })

    // Annual reviews
    ic.annualReviews
      .filter((r) => r.year === year)
      .forEach((r) => {
        const { month } = isoToMonthYear(r.reviewedAt)
        all.push({ id: r.id, kind: 'annual_review', label: `Årsgjennomgang ${r.year}`, month, year, status: 'done', link: '/internal-control?tab=annual' })
      })

    // Surveys opened this year
    oh.surveys
      .filter((s) => s.openedAt && new Date(s.openedAt).getFullYear() === year)
      .forEach((s) => {
        const { month } = isoToMonthYear(s.openedAt!)
        all.push({ id: s.id, kind: 'survey', label: s.title, month, year, status: s.status === 'closed' ? 'done' : 'pending', link: '/org-health?tab=surveys', detail: s.targetGroupLabel })
      })

    // Certification expiry
    learning.certificates
      .filter((c) => {
        // Certificates don't have expiry natively — use issuedAt + 1 year as proxy
        const expiry = new Date(c.issuedAt)
        expiry.setFullYear(expiry.getFullYear() + 1)
        return expiry.getFullYear() === year
      })
      .forEach((c) => {
        const expiry = new Date(c.issuedAt)
        expiry.setFullYear(expiry.getFullYear() + 1)
        const { month } = isoToMonthYear(expiry.toISOString())
        all.push({ id: c.id, kind: 'certification_expiry', label: `${c.learnerName}: ${c.courseTitle}`, month, year, status: statusFor(expiry.toISOString()), link: '/learning/certifications' })
      })

    return all
  }, [year, council, hse, ic, oh, learning])

  const filtered = useMemo(
    () => events.filter((e) => filterKind === 'all' || e.kind === filterKind),
    [events, filterKind],
  )

  const byMonth = useMemo(() => {
    const map: Record<number, WheelEvent[]> = {}
    for (let m = 1; m <= 12; m++) map[m] = []
    filtered.forEach((e) => { if (e.month >= 1 && e.month <= 12) map[e.month].push(e) })
    return map
  }, [filtered])

  const overdueCount = filtered.filter((e) => e.status === 'overdue').length

  // ── SVG wheel ──────────────────────────────────────────────────────────────

  const SIZE = 260
  const CX = SIZE / 2
  const CY = SIZE / 2
  const OUTER_R = 110
  const INNER_R = 40

  function slicePath(monthIdx: number): string {
    const total = 12
    const startAngle = ((monthIdx * 360) / total - 90) * (Math.PI / 180)
    const endAngle = (((monthIdx + 1) * 360) / total - 90) * (Math.PI / 180)
    const x1 = CX + OUTER_R * Math.cos(startAngle)
    const y1 = CY + OUTER_R * Math.sin(startAngle)
    const x2 = CX + OUTER_R * Math.cos(endAngle)
    const y2 = CY + OUTER_R * Math.sin(endAngle)
    const ix1 = CX + INNER_R * Math.cos(startAngle)
    const iy1 = CY + INNER_R * Math.sin(startAngle)
    const ix2 = CX + INNER_R * Math.cos(endAngle)
    const iy2 = CY + INNER_R * Math.sin(endAngle)
    return `M ${ix1} ${iy1} L ${x1} ${y1} A ${OUTER_R} ${OUTER_R} 0 0 1 ${x2} ${y2} L ${ix2} ${iy2} A ${INNER_R} ${INNER_R} 0 0 0 ${ix1} ${iy1} Z`
  }

  function labelPos(monthIdx: number): { x: number; y: number } {
    const angle = (((monthIdx + 0.5) * 360) / 12 - 90) * (Math.PI / 180)
    const r = (OUTER_R + INNER_R) / 2
    return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) }
  }

  function dotPos(monthIdx: number, dotIdx: number, total: number): { x: number; y: number } {
    const midAngle = (((monthIdx + 0.5) * 360) / 12 - 90) * (Math.PI / 180)
    const spread = 0.3
    const angle = midAngle + (dotIdx - (total - 1) / 2) * spread
    const r = OUTER_R + 14
    return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) }
  }

  const selectedEvents = selectedMonth ? byMonth[selectedMonth] ?? [] : []

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1 text-sm text-neutral-500">
        <Link to="/" className="hover:text-[#1a3d32]">Prosjekter</Link>
        <ChevronRight className="size-3.5" />
        <span className="font-medium text-neutral-800">Årshjul</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 md:text-3xl" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
            Årshjul
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Dynamisk årskalender — AMU-møter, vernerunder, ROS-vurderinger, undersøkelser, sykefravær-frister og opplæringsutløp samlet i ett bilde.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1.5 text-sm font-medium text-red-800">
              <AlertTriangle className="size-4" />
              {overdueCount} forfalt
            </span>
          )}
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setYear((y) => y - 1)} className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm hover:bg-neutral-50">←</button>
            <span className="w-14 text-center font-semibold tabular-nums">{year}</span>
            <button type="button" onClick={() => setYear((y) => y + 1)} className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm hover:bg-neutral-50">→</button>
          </div>
        </div>
      </div>

      {/* Kind filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button type="button" onClick={() => setFilterKind('all')}
          className={`rounded-full px-3 py-1 text-xs font-medium ${filterKind === 'all' ? 'bg-[#1a3d32] text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}>
          Alle ({events.length})
        </button>
        {(Object.keys(KIND_LABELS) as EventKind[]).map((k) => {
          const count = events.filter((e) => e.kind === k).length
          if (count === 0) return null
          const c = KIND_COLOUR[k]
          return (
            <button key={k} type="button" onClick={() => setFilterKind(k === filterKind ? 'all' : k)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${filterKind === k ? `${c.bg} ${c.text} ring-1 ring-current` : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}>
              {KIND_LABELS[k]} ({count})
            </button>
          )
        })}
      </div>

      <div className="grid gap-8 lg:grid-cols-[auto_1fr]">
        {/* SVG wheel */}
        <div className="flex flex-col items-center gap-4">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} className="shrink-0 drop-shadow-sm">
            {/* Slice segments */}
            {Array.from({ length: 12 }, (_, i) => {
              const monthNum = i + 1
              const monthEvents = byMonth[monthNum] ?? []
              const hasOverdue = monthEvents.some((e) => e.status === 'overdue')
              const hasDone = monthEvents.some((e) => e.status === 'done')
              const isSelected = selectedMonth === monthNum
              const fill = hasOverdue ? '#fee2e2' : hasDone && monthEvents.length > 0 ? '#d1fae5' : monthEvents.length > 0 ? '#e0f2fe' : '#f5f0e8'
              return (
                <path
                  key={i}
                  d={slicePath(i)}
                  fill={isSelected ? '#1a3d32' : fill}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                  className="cursor-pointer transition-opacity hover:opacity-80"
                  onClick={() => setSelectedMonth(selectedMonth === monthNum ? null : monthNum)}
                />
              )
            })}
            {/* Month labels */}
            {Array.from({ length: 12 }, (_, i) => {
              const { x, y } = labelPos(i)
              const isSelected = selectedMonth === i + 1
              return (
                <text key={i} x={x} y={y + 4} textAnchor="middle"
                  className={`text-[8px] font-semibold pointer-events-none select-none ${isSelected ? 'fill-white' : 'fill-neutral-600'}`}
                  style={{ fontSize: 8 }}>
                  {MONTH_NAMES[i]}
                </text>
              )
            })}
            {/* Event dots outside the wheel */}
            {Array.from({ length: 12 }, (_, i) => {
              const monthNum = i + 1
              const monthEvents = filtered.filter((e) => e.month === monthNum)
              return monthEvents.slice(0, 5).map((evt, di) => {
                const { x, y } = dotPos(i, di, Math.min(monthEvents.length, 5))
                const colour = evt.status === 'overdue' ? '#ef4444' : evt.status === 'done' ? '#10b981' : KIND_COLOUR[evt.kind].dot
                return (
                  <circle key={evt.id} cx={x} cy={y} r={4} fill={colour} stroke="white" strokeWidth="1"
                    className="cursor-pointer"
                    onClick={() => setSelectedMonth(monthNum)}>
                    <title>{evt.label}</title>
                  </circle>
                )
              })
            })}
            {/* Centre hub */}
            <circle cx={CX} cy={CY} r={INNER_R - 2} fill="white" stroke="#c9a227" strokeWidth="1.5" />
            <text x={CX} y={CY + 5} textAnchor="middle" style={{ fontSize: 14, fontWeight: 700, fill: '#1a3d32' }}>{year}</text>
          </svg>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <LegendItem colour="#d1fae5" label="Gjennomført" />
            <LegendItem colour="#fee2e2" label="Forfalt" />
            <LegendItem colour="#e0f2fe" label="Planlagt" />
            <LegendItem colour="#f5f0e8" label="Ingen hendelser" />
          </div>
        </div>

        {/* Right: month detail / list */}
        <div>
          {selectedMonth ? (
            <div>
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-xl font-semibold text-neutral-900">{MONTH_NAMES[selectedMonth - 1]} {year}</h2>
                <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-sm text-neutral-600">{selectedEvents.length} hendelser</span>
                <button type="button" onClick={() => setSelectedMonth(null)} className="ml-auto text-xs text-neutral-400 hover:text-neutral-700">Lukk ×</button>
              </div>
              {selectedEvents.length === 0 ? (
                <p className="text-sm text-neutral-500">Ingen hendelser i {MONTH_NAMES[selectedMonth - 1]}.</p>
              ) : (
                <div className="space-y-2">
                  {selectedEvents.map((evt) => {
                    const c = KIND_COLOUR[evt.kind]
                    return (
                      <div key={evt.id} className={`flex flex-wrap items-start gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm`}>
                        <div className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>{KIND_LABELS[evt.kind]}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-neutral-900 text-sm">{evt.label}</div>
                          {evt.detail && <div className="text-xs text-neutral-500">{evt.detail}</div>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {evt.status === 'done' && <CheckCircle2 className="size-4 text-emerald-600" />}
                          {evt.status === 'overdue' && <AlertTriangle className="size-4 text-red-500" />}
                          {evt.link && (
                            <Link to={evt.link} className="text-xs text-[#1a3d32] hover:underline">Åpne →</Link>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Full year list when no month selected */
            <div>
              <h2 className="mb-4 text-base font-semibold text-neutral-800">Alle hendelser — {year}</h2>
              <div className="space-y-6">
                {Array.from({ length: 12 }, (_, i) => {
                  const monthNum = i + 1
                  const monthEvts = byMonth[monthNum] ?? []
                  if (monthEvts.length === 0) return null
                  return (
                    <div key={monthNum}>
                      <button type="button" onClick={() => setSelectedMonth(monthNum)}
                        className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-700 hover:text-[#1a3d32]">
                        {MONTH_NAMES[monthNum - 1]}
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-normal text-neutral-500">{monthEvts.length}</span>
                        {monthEvts.some((e) => e.status === 'overdue') && <AlertTriangle className="size-3.5 text-red-500" />}
                      </button>
                      <div className="space-y-1.5 pl-3 border-l-2 border-neutral-100">
                        {monthEvts.map((evt) => {
                          const c = KIND_COLOUR[evt.kind]
                          return (
                            <div key={evt.id} className="flex items-center gap-2 text-sm">
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${c.bg} ${c.text}`}>{KIND_LABELS[evt.kind]}</span>
                              <span className="text-neutral-800 truncate">{evt.label}</span>
                              {evt.status === 'overdue' && <AlertTriangle className="size-3.5 shrink-0 text-red-400" />}
                              {evt.status === 'done' && <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function LegendItem({ colour, label }: { colour: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="size-3 rounded-sm shrink-0" style={{ background: colour, border: '1px solid #e5e7eb' }} />
      <span className="text-neutral-600">{label}</span>
    </div>
  )
}
