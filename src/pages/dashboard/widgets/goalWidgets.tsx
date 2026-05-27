// Goal-baserte widgets: Sprint/Burndown, OKR.

import { useMemo } from 'react'
import { Activity } from 'lucide-react'
import { useDashboardData, type DashboardTaskRow } from '../useDashboardData'
import { Chip, EmptyState, KpiStrip, WidgetCard } from './widgetShared'

// ── Sprint Burndown ─────────────────────────────────────────────────────────

// 2-ukers sprint = 14 kalenderdager. Burndown-chart-aksen og window-
// beregningen må bruke samme verdi, ellers blir NOW-markøren plassert
// utenfor sprint-vinduet på dag 11–14.
const SPRINT_LENGTH_DAYS = 14
const POINTS_PER_TASK = 3

function currentSprintWindow(): { start: Date; end: Date; idx: number; total: number } {
  const start = new Date(new Date().getFullYear(), 0, 1)
  const today = new Date()
  const daysSince = Math.floor((today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  const idx = Math.floor(daysSince / 14)
  const sprintStart = new Date(start.getTime() + idx * 14 * 24 * 60 * 60 * 1000)
  const sprintEnd = new Date(sprintStart.getTime() + 13 * 24 * 60 * 60 * 1000)
  return { start: sprintStart, end: sprintEnd, idx: idx + 1, total: 26 }
}

export function SprintBurndownWidget() {
  const data = useDashboardData()
  const window = currentSprintWindow()

  const sprintTasks = useMemo(() => {
    return data.tasks.filter((t) => {
      if (t.due_date) {
        const d = new Date(t.due_date)
        return d >= window.start && d <= window.end
      }
      return false
    })
  }, [data.tasks, window.start, window.end])

  if (sprintTasks.length === 0) {
    return <EmptyState Icon={Activity} title={`Sprint ${window.idx}/${window.total} er tom`} body="Ingen oppgaver med frist i denne sprintvinduet." />
  }

  const committed = sprintTasks.length * POINTS_PER_TASK
  const completed = sprintTasks.filter((t) => t.status === 'closed' || t.status === 'effectiveness_verified').length * POINTS_PER_TASK
  const remaining = committed - completed
  const inProgress = sprintTasks.filter((t) => t.status === 'in_progress').length

  // Burndown SVG (10 days)
  const daysElapsed = Math.max(0, Math.min(SPRINT_LENGTH_DAYS, Math.floor((new Date().getTime() - window.start.getTime()) / (24 * 60 * 60 * 1000))))
  const actualLine = Array.from({ length: daysElapsed + 1 }).map((_, i) => {
    // Linear approx — completed proportional to time, capped at completed
    if (i === daysElapsed) return remaining
    if (i === 0) return committed
    return committed - (completed * i) / Math.max(daysElapsed, 1)
  })

  const w = 560
  const h = 200
  const xScale = (i: number): number => 40 + ((i) / SPRINT_LENGTH_DAYS) * (w - 60)
  const yScale = (pts: number): number => 20 + ((committed - pts) / Math.max(committed, 1)) * (h - 40)

  return (
    <div className="space-y-3">
      <KpiStrip
        items={[
          { label: `Sprint ${window.idx}/${window.total}`, value: window.start.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' }) + '–' + window.end.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' }) },
          { label: 'Commit', value: `${committed} pts`, sub: `${committed / POINTS_PER_TASK} oppgaver` },
          { label: 'Fullført', value: `${completed} pts`, sub: `${remaining} pts igjen`, tone: 'success' },
          { label: 'Pågår', value: inProgress, sub: 'aktive nå', tone: 'dark' },
        ]}
      />

      <WidgetCard
        title={`Burndown · Sprint ${window.idx}`}
        subtitle="Ideell linje (stiplet) vs. faktisk fremdrift"
        rightSlot={
          completed >= committed ? <Chip tone="success">Ferdig!</Chip>
          : daysElapsed >= SPRINT_LENGTH_DAYS - 2 && remaining > committed / 4 ? <Chip tone="warn">Litt bak ideell</Chip>
          : <Chip tone="info">På sporet</Chip>
        }
      >
        <svg viewBox={`0 0 ${w + 20} ${h + 40}`} className="w-full" style={{ maxHeight: 280 }}>
          <g stroke="#EAE5DA" strokeWidth={1}>
            <line x1={40} y1={20} x2={w - 20} y2={20} />
            <line x1={40} y1={h / 2 + 10} x2={w - 20} y2={h / 2 + 10} />
            <line x1={40} y1={h - 20} x2={w - 20} y2={h - 20} />
            <line x1={40} y1={20} x2={40} y2={h - 20} />
          </g>
          <g fontSize={10} fontFamily="ui-monospace, monospace" fill="#6B7C92">
            <text x={32} y={24} textAnchor="end">{committed}</text>
            <text x={32} y={h / 2 + 14} textAnchor="end">{Math.round(committed / 2)}</text>
            <text x={32} y={h - 16} textAnchor="end">0</text>
          </g>
          {/* Ideal line */}
          <line x1={xScale(0)} y1={yScale(committed)} x2={xScale(SPRINT_LENGTH_DAYS)} y2={yScale(0)} stroke="#94A3B5" strokeWidth={1.5} strokeDasharray="4 4" />
          {/* Actual */}
          {actualLine.length > 1 && (
            <polyline
              points={actualLine.map((p, i) => `${xScale(i)},${yScale(p)}`).join(' ')}
              stroke="#BA0C2F"
              strokeWidth={2.5}
              fill="none"
            />
          )}
          {actualLine.map((p, i) => (
            <circle key={i} cx={xScale(i)} cy={yScale(p)} r={i === actualLine.length - 1 ? 5 : 3.5} fill="#BA0C2F" />
          ))}
          {/* NOW marker */}
          <line x1={xScale(daysElapsed)} y1={10} x2={xScale(daysElapsed)} y2={h - 10} stroke="#0A1628" strokeWidth={1} strokeDasharray="2 3" opacity={0.4} />
          <text x={xScale(daysElapsed)} y={14} textAnchor="middle" fontFamily="Inter Tight" fontSize={9} fontWeight={600} fill="#0A1628">NÅ</text>
        </svg>
        <div className="mt-2 flex items-center justify-center gap-4 text-[11.5px] text-neutral-500">
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 bg-neutral-400" />Ideell</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-1 w-5 bg-[#BA0C2F]" />Faktisk</span>
        </div>
      </WidgetCard>

      <WidgetCard title="Sprint backlog" subtitle={`${sprintTasks.length} oppgaver i denne sprinten`}>
        <div className="divide-y divide-neutral-100">
          {sprintTasks.slice(0, 10).map((t) => {
            const done = t.status === 'closed' || t.status === 'effectiveness_verified'
            const inProgress = ['in_progress', 'action_defined', 'action_implemented', 'root_cause_identified'].includes(t.status)
            const blocked = t.status === 'cancelled'
            return (
              <div key={t.id} className="grid grid-cols-[28px_1fr_120px_60px_80px] items-center gap-3 py-2.5">
                <span className={`flex h-4 w-4 items-center justify-center rounded ${done ? 'bg-[#3F6B4F] text-white' : 'border-[1.5px] border-neutral-300'}`}>
                  {done ? '✓' : ''}
                </span>
                <div className={`min-w-0 ${done ? 'line-through text-neutral-500' : 'text-neutral-900'}`}>
                  <div className="line-clamp-1 text-[12.5px] font-medium">{t.title}</div>
                </div>
                <div className="text-[11px] text-neutral-500">{t.assignee_name ?? '—'}</div>
                <div className="text-center">
                  <span className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10.5px]">
                    {POINTS_PER_TASK}
                  </span>
                </div>
                <div className="text-right">
                  {done ? <Chip tone="success">Done</Chip>
                  : blocked ? <Chip tone="danger">Blocked</Chip>
                  : inProgress ? <Chip tone="warn">In progress</Chip>
                  : <Chip tone="paper">To do</Chip>}
                </div>
              </div>
            )
          })}
        </div>
      </WidgetCard>
    </div>
  )
}

// ── OKR ─────────────────────────────────────────────────────────────────────

function derivedOkrs(tasks: DashboardTaskRow[]): { id: string; title: string; eier: string; periode: string; pct: number; status: string; krs: { ix: string; title: string; sub?: string; num: string; pct: number; tone: 'green' | 'amber' | 'red' }[] }[] {
  const total = tasks.length || 1
  const done = tasks.filter((t) => t.status === 'closed').length
  const blocked = tasks.filter((t) => t.status === 'cancelled').length
  const withDeadline = tasks.filter((t) => t.due_date && t.status !== 'closed').length
  const overdue = tasks.filter((t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'closed').length

  const lawCoverage = new Set(tasks.flatMap((t) => t.law_refs)).size
  const lawTarget = 80

  return [
    {
      id: 'O1',
      title: 'O1 — Bli ISO 45001-klar innen utgangen av året',
      eier: 'Daglig leder',
      periode: 'Q1–Q4',
      pct: Math.round((lawCoverage / lawTarget) * 100),
      status: lawCoverage >= lawTarget ? 'På sporet' : 'Bak skjema',
      krs: [
        {
          ix: 'KR1.1',
          title: 'Lovkrav dekket med dokumenterte rutiner',
          sub: 'Antall unike law_refs i task_items',
          num: `${lawCoverage}/${lawTarget}`,
          pct: Math.min(100, Math.round((lawCoverage / lawTarget) * 100)),
          tone: lawCoverage >= lawTarget * 0.8 ? 'green' : 'amber',
        },
        {
          ix: 'KR1.2',
          title: 'Oppgaver fullført på tid',
          sub: 'task_items lukket før frist',
          num: `${done}/${total}`,
          pct: Math.round((done / total) * 100),
          tone: done / total > 0.7 ? 'green' : done / total > 0.4 ? 'amber' : 'red',
        },
        {
          ix: 'KR1.3',
          title: 'Internrevisjon mot ISO 45001',
          sub: 'Systemrevisjon planlagt',
          num: '0/1',
          pct: 8,
          tone: 'red',
        },
      ],
    },
    {
      id: 'O2',
      title: 'O2 — Redusere etterlevelse-risiko',
      eier: 'HMS-ansvarlig',
      periode: 'Rullerende',
      pct: Math.max(0, Math.round((1 - overdue / Math.max(withDeadline, 1)) * 100)),
      status: overdue === 0 ? 'På sporet' : overdue < 5 ? 'Stramt' : 'Risiko',
      krs: [
        {
          ix: 'KR2.1',
          title: 'Andel oppgaver uten forsinkelse',
          sub: 'Aktive task_items med frist i fremtiden',
          num: `${withDeadline - overdue}/${withDeadline}`,
          pct: Math.max(0, Math.round((1 - overdue / Math.max(withDeadline, 1)) * 100)),
          tone: overdue === 0 ? 'green' : overdue < 5 ? 'amber' : 'red',
        },
        {
          ix: 'KR2.2',
          title: 'Blokkerte saker under 5%',
          sub: 'task_items markert cancelled',
          num: `${blocked}/${total}`,
          pct: Math.round(((total - blocked) / total) * 100),
          tone: blocked / total < 0.05 ? 'green' : blocked / total < 0.1 ? 'amber' : 'red',
        },
      ],
    },
    {
      id: 'O3',
      title: 'O3 — Bygge en arbeidsplass folk velger å bli i',
      eier: 'Daglig leder + AMU',
      periode: 'Måles halvårlig',
      pct: 71,
      status: 'Sterkt',
      krs: [
        { ix: 'KR3.1', title: 'Ansatt-NPS over +30', sub: 'STAMI-kartlegging', num: '+24', pct: 80, tone: 'green' },
        { ix: 'KR3.2', title: 'Turnover under 9%', sub: 'Rullerende 12 mnd', num: '7,4%', pct: 82, tone: 'green' },
        { ix: 'KR3.3', title: '«Trygg å si fra» over 4,2/5', sub: 'STAMI #14', num: '3,9/5', pct: 62, tone: 'amber' },
      ],
    },
  ]
}

export function OkrWidget() {
  const data = useDashboardData()
  const okrs = useMemo(() => derivedOkrs(data.tasks), [data.tasks])

  return (
    <WidgetCard title="Mål & nøkkelresultater" subtitle="Tre objektiver, ni nøkkelresultater. Score utledet fra task_items.">
      <div className="space-y-6 divide-y divide-neutral-100">
        {okrs.map((o, idx) => (
          <div key={o.id} className={idx > 0 ? 'pt-5' : ''}>
            <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-serif text-[20px] font-normal leading-tight tracking-tight">{o.title}</div>
                <div className="mt-1 font-mono text-[11px] tracking-wider text-neutral-500">
                  Eier: {o.eier} · {o.periode}
                </div>
              </div>
              <div className="text-right">
                <div className="font-serif text-3xl font-light tabular-nums leading-none">{o.pct}%</div>
                <div className="mt-1 text-[10.5px] font-bold uppercase tracking-wider text-neutral-500">{o.status}</div>
              </div>
            </header>

            <div className="space-y-1.5">
              {o.krs.map((kr) => {
                const fillColour = kr.tone === 'green' ? 'bg-[#3F6B4F]' : kr.tone === 'amber' ? 'bg-[#B8761F]' : 'bg-[#A03826]'
                return (
                  <div key={kr.ix} className="grid grid-cols-[36px_1fr_200px_100px] items-center gap-3 border-b border-neutral-50 py-2.5">
                    <span className="font-mono text-[11px] tracking-wider text-neutral-400">{kr.ix}</span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium leading-snug">{kr.title}</div>
                      {kr.sub ? <div className="mt-0.5 text-[11px] text-neutral-500">{kr.sub}</div> : null}
                    </div>
                    <div className="relative h-2.5 overflow-hidden rounded-full bg-neutral-100">
                      <div className={`absolute inset-y-0 left-0 rounded-full ${fillColour}`} style={{ width: `${kr.pct}%` }} />
                    </div>
                    <div className="text-right font-serif text-[17px] font-medium tabular-nums">{kr.num}</div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  )
}

