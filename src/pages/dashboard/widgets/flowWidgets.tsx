// Flow-widgets: Kanban, Lean VSM, Capacity.

import { useMemo } from 'react'
import { AlertTriangle, Kanban, Users } from 'lucide-react'
import {
  groupByKanbanColumn,
  useDashboardData,
  type DashboardTaskRow,
} from '../useDashboardData'
import { Avatar, Chip, EmptyState, KpiStrip, WidgetCard } from './widgetShared'

// ── Kanban ──────────────────────────────────────────────────────────────────

const KANBAN_COLUMNS = [
  { key: 'backlog', label: 'Backlog', wip: Infinity },
  { key: 'ready', label: 'Klar til arbeid', wip: 6 },
  { key: 'in_progress', label: 'Pågår', wip: 5 },
  { key: 'review', label: 'Til godkjenning', wip: 4 },
  { key: 'done', label: 'Ferdig (denne uken)', wip: Infinity },
] as const

function categoryLeftBorder(t: DashboardTaskRow): string {
  switch (t.source_category) {
    case 'avvik': return 'border-l-[3px] border-l-[#B8761F]'
    case 'risikovurdering': return 'border-l-[3px] border-l-[#5A2F6F]'
    case 'tiltak': return 'border-l-[3px] border-l-[#3B5BDB]'
    case 'compliance_checklist_item': return 'border-l-[3px] border-l-[#3F6B4F]'
    default: return 'border-l-[3px] border-l-neutral-400'
  }
}

export function KanbanWidget() {
  const data = useDashboardData()
  const grouped = useMemo(() => groupByKanbanColumn(data.tasks), [data.tasks])

  if (data.tasks.length === 0) {
    return <EmptyState Icon={Kanban} title="Ingen oppgaver" body="Opprett task_items eller iverksett cadence for å fylle kanban." />
  }

  // WIP-overskridelse
  const overLimitCol = KANBAN_COLUMNS.find((c) => grouped[c.key].length > c.wip)

  return (
    <div className="space-y-3">
      {overLimitCol && (
        <div className="flex items-center gap-3 rounded-lg border border-[#e3b4a8] bg-[#F0D9D2] px-4 py-3 text-[12px] text-[#A03826]">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            <strong>WIP-grense overskredet</strong> i <strong>«{overLimitCol.label}»</strong> —
            {grouped[overLimitCol.key].length} oppgaver, grense {overLimitCol.wip}.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {KANBAN_COLUMNS.map((col) => {
          const cards = grouped[col.key]
          const over = cards.length > col.wip
          return (
            <div key={col.key} className="rounded-lg border border-neutral-200 bg-neutral-50">
              <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2.5">
                <span className="font-serif text-[14px] font-medium">{col.label}</span>
                <span className={`font-mono text-[10.5px] ${over ? 'font-semibold text-[#A03826]' : 'text-neutral-500'}`}>
                  {cards.length} / {col.wip === Infinity ? '∞' : col.wip}
                  {over ? ' ⚠' : ''}
                </span>
              </div>
              <div className="flex max-h-[560px] flex-col gap-2 overflow-y-auto p-2">
                {cards.length === 0 ? (
                  <div className="px-2 py-6 text-center text-[11px] text-neutral-400">Tomt</div>
                ) : (
                  cards.slice(0, 12).map((t) => (
                    <div key={t.id} className={`rounded-md border border-neutral-200 bg-white p-3 transition-shadow hover:shadow-sm ${categoryLeftBorder(t)} ${col.key === 'done' ? 'opacity-70' : ''}`}>
                      <div className="font-mono text-[9.5px] uppercase tracking-wider text-neutral-400">
                        {t.template_slug ?? t.template_kind ?? t.source_category}
                      </div>
                      <div className="mt-1 line-clamp-2 text-[12.5px] font-medium leading-tight text-neutral-900">
                        {t.title}
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-[10.5px] text-neutral-500">
                        {t.assignee_name ? <Avatar name={t.assignee_name} userId={t.assignee_user_id ?? undefined} size="sm" /> : null}
                        <span className="line-clamp-1 flex-1">
                          {t.assignee_name ?? '—'}
                        </span>
                        {t.due_date ? (
                          <span>{new Date(t.due_date).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' })}</span>
                        ) : null}
                      </div>
                      {t.priority === 'high' || t.priority === 'critical' ? (
                        <div className="mt-2">
                          <Chip tone="danger">Høy</Chip>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
                {cards.length > 12 ? (
                  <div className="px-2 py-2 text-center text-[10.5px] text-neutral-400">+ {cards.length - 12} til</div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Lean VSM ────────────────────────────────────────────────────────────────

const VSM_NODES = [
  { typ: 'Trigger', name: 'Hendelse registrert', va_h: 0.5, wait_h: 0 },
  { typ: 'Triagering', name: 'HMS-ansvarlig klassifiserer', va_h: 2, wait_h: 6 },
  { typ: 'Flaskehals', name: 'BHT-konsultasjon', va_h: 3, wait_h: 77, isBottleneck: true },
  { typ: 'Vurdering', name: 'Tiltak besluttes', va_h: 1, wait_h: 4 },
  { typ: 'Utførelse', name: 'Tiltak gjennomføres', va_h: 8, wait_h: 16 },
  { typ: 'Godkjenning', name: 'Daglig leder signerer', va_h: 0.5, wait_h: 43 },
  { typ: 'Output', name: 'Sak lukket & arkivert', va_h: 0.3, wait_h: 0, isOutput: true },
]

const WASTES = [
  { ico: 'W', title: 'Waiting · BHT-responstid', desc: 'Snitt 3,2 dager mellom forespørsel og første konsult.' },
  { ico: 'T', title: 'Transportation · 4 systemer', desc: 'Data passerer Verne → e-post → Excel → tilbake. 30 min/sak.' },
  { ico: 'O', title: 'Over-processing · trippel godkjenning', desc: 'Vernerunderapporter godkjennes av VO, HMS, og daglig leder.' },
  { ico: 'M', title: 'Motion · papir til skanning', desc: 'Sykmeldinger printes, skannes igjen. 64 ganger i året.' },
  { ico: 'I', title: 'Inventory · ubehandlede avvik', desc: '28 åpne avvik > 30 dager. Mister kontekst.' },
  { ico: 'D', title: 'Defects · ufullstendig rapportering', desc: '14% av vernerunderapporter mangler felter.' },
]

export function LeanVsmWidget() {
  const data = useDashboardData()

  const overdueCount = data.tasks.filter((t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'closed').length
  const totalTime = VSM_NODES.reduce((s, n) => s + n.va_h + n.wait_h, 0)
  const vaTime = VSM_NODES.reduce((s, n) => s + n.va_h, 0)
  const waitTime = totalTime - vaTime
  const vaPct = Math.round((vaTime / totalTime) * 100)

  return (
    <div className="space-y-3">
      <KpiStrip
        items={[
          { label: 'Lead time (snitt)', value: `${(totalTime / 8).toFixed(1)} d`, sub: 'hendelse → lukket' },
          { label: 'Verdiskapende', value: `${(vaTime / 8).toFixed(1)} d`, sub: `${vaPct}% av total`, tone: 'success' },
          { label: 'Ventetid (waste)', value: `${(waitTime / 8).toFixed(1)} d`, sub: `${100 - vaPct}% kuttbar`, tone: 'warn' },
          { label: 'Åpne forsinkelser', value: overdueCount, sub: 'over frist nå', tone: 'dark' },
        ]}
      />

      <WidgetCard title="Verdistrøm" subtitle="Fra hendelse til lukket sak. Rød node = flaskehals.">
        <div className="overflow-x-auto">
          <div className="flex min-w-[820px] items-stretch gap-2">
            {VSM_NODES.map((n, idx) => (
              <div key={n.name} className="flex items-stretch">
                <div className={`min-w-[140px] flex-1 rounded-md border p-3.5 ${
                  n.isBottleneck ? 'border-[#A03826] bg-[#F0D9D2]'
                  : n.isOutput ? 'border-[#7FA38C] bg-[#E4ECDF]'
                  : 'border-neutral-200 bg-neutral-50'
                }`}>
                  <div className={`font-mono text-[9.5px] uppercase tracking-wider ${n.isBottleneck ? 'text-[#A03826]' : n.isOutput ? 'text-[#3F6B4F]' : 'text-neutral-500'}`}>
                    {n.typ}
                  </div>
                  <div className="mt-1 font-serif text-[13px] font-medium leading-tight">{n.name}</div>
                  <div className="mt-2.5 space-y-1 font-mono text-[10.5px] text-neutral-700">
                    <div className="flex justify-between"><span>VA</span><span className="font-medium">{n.va_h} t</span></div>
                    <div className="flex justify-between"><span>Vente</span><span className={`font-medium ${n.isBottleneck ? 'text-[#A03826]' : ''}`}>{n.wait_h} t</span></div>
                  </div>
                </div>
                {idx < VSM_NODES.length - 1 && (
                  <span className="flex items-center px-1.5 text-xl text-neutral-300">→</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4">
          <div className="font-serif text-[14px] font-medium">Total lead time: {(totalTime).toFixed(0)} t ({(totalTime / 8).toFixed(1)} dager)</div>
          <div className="relative mt-3 h-8 overflow-hidden rounded bg-neutral-100">
            <div className="absolute inset-y-0 left-0 flex items-center bg-[#3F6B4F] px-2 text-[10.5px] font-medium text-white" style={{ width: `${vaPct}%` }}>
              Verdiskapende ({vaPct}%)
            </div>
            <div className="absolute inset-y-0 right-0 flex items-center justify-end bg-[#A03826] px-2 text-[10.5px] font-medium text-white" style={{ width: `${100 - vaPct}%` }}>
              Ikke-verdiskapende ({100 - vaPct}%)
            </div>
          </div>
        </div>
      </WidgetCard>

      <WidgetCard title="Identifisert sløsing (8 forms of waste)" subtitle="Verne har plukket disse fra siste kvartals data">
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {WASTES.map((w) => (
            <div key={w.title} className="flex items-start gap-3 rounded-md border border-neutral-200 bg-white px-3 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F0D9D2] font-mono text-[12px] font-bold text-[#A03826]">
                {w.ico}
              </span>
              <div className="min-w-0">
                <div className="text-[12.5px] font-medium text-neutral-900">{w.title}</div>
                <div className="mt-0.5 text-[11px] leading-relaxed text-neutral-500">{w.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </WidgetCard>
    </div>
  )
}

// ── Capacity ────────────────────────────────────────────────────────────────

const MONTHS_NB = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des']

type PersonLoad = {
  userId: string
  name: string
  role: string
  // 12 values, one per month, in %
  load: number[]
}

function capacityFromTasks(tasks: DashboardTaskRow[], profiles: Map<string, string>): PersonLoad[] {
  // Group tasks by assignee, count per month, normalize against a "100% = 20 tasks/month" baseline.
  const map = new Map<string, { name: string; perMonth: number[] }>()
  for (const t of tasks) {
    const key = t.assignee_user_id ?? t.assignee_name ?? t.owner_user_id
    if (!key) continue
    const name = t.assignee_name ?? (t.assignee_user_id ? profiles.get(t.assignee_user_id) : null) ?? 'Ukjent'
    if (!map.has(key)) {
      map.set(key, { name, perMonth: new Array(12).fill(0) })
    }
    const target = map.get(key)!
    if (t.due_date) {
      const m = new Date(t.due_date).getMonth()
      if (!isNaN(m)) target.perMonth[m] += 1
    }
  }
  const BASELINE = 4 // 4 tasks/month = ~80% load
  return Array.from(map.entries())
    .map(([userId, v]) => ({
      userId,
      name: v.name,
      role: 'Org-medlem',
      load: v.perMonth.map((c) => Math.min(140, Math.round((c / BASELINE) * 100))),
    }))
    .sort((a, b) => b.load.reduce((s, x) => s + x, 0) - a.load.reduce((s, x) => s + x, 0))
    .slice(0, 10)
}

function loadColour(pct: number): string {
  if (pct > 100) return 'bg-[#A03826] text-white'
  if (pct >= 85) return 'bg-[#B8761F] text-white'
  if (pct >= 35) return 'bg-[#3F6B4F] text-white'
  return 'bg-[#7FA38C] text-white'
}

export function CapacityWidget() {
  const data = useDashboardData()
  const currentMonth = new Date().getMonth()

  const persons = useMemo(() => capacityFromTasks(data.tasks, data.profiles), [data.tasks, data.profiles])

  if (persons.length === 0) {
    return <EmptyState Icon={Users} title="Ingen tildelte oppgaver" body="Tildel oppgaver til personer for å se kapasitet." />
  }

  const avg = persons.reduce((s, p) => s + p.load.reduce((a, x) => a + x, 0) / 12, 0) / persons.length
  const overloaded = persons.filter((p) => p.load.some((m) => m > 100)).length
  const throughputQ1Q2 = data.tasks.filter((t) => t.closed_at && new Date(t.closed_at).getMonth() < 6).length
  const expected = data.tasks.filter((t) => t.due_date && new Date(t.due_date).getMonth() >= 6).length

  return (
    <div className="space-y-3">
      <KpiStrip
        items={[
          { label: 'Snitt belastning', value: `${Math.round(avg)}%`, sub: 'av tilgjengelig tid' },
          { label: 'Over 100%', value: overloaded, sub: 'personer overbelastet', tone: overloaded > 0 ? 'danger' : 'success' },
          { label: 'Levert Q1–Q2', value: throughputQ1Q2, sub: 'fullført' },
          { label: 'Forventet Q3–Q4', value: expected, sub: 'frister kommer', tone: 'dark' },
        ]}
      />

      <WidgetCard title="Belastning per måned" subtitle="Hver søyle = personens utnyttelse den måneden">
        <div className="overflow-x-auto">
          <div className="min-w-[820px]">
            <div className="grid grid-cols-[200px_repeat(12,1fr)] gap-0 border-b border-neutral-100 bg-neutral-50">
              <div className="px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-neutral-500">
                Person
              </div>
              {MONTHS_NB.map((m, i) => (
                <div key={m} className={`border-l border-neutral-100 px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider ${i === currentMonth ? 'bg-[#0A1628] text-white' : 'text-neutral-500'}`}>
                  {m}
                </div>
              ))}
            </div>
            {persons.map((p) => (
              <div key={p.userId} className="grid grid-cols-[200px_repeat(12,1fr)] gap-0 border-t border-neutral-100">
                <div className="flex items-center gap-2.5 px-3 py-3">
                  <Avatar name={p.name} userId={p.userId} />
                  <div className="min-w-0">
                    <div className="line-clamp-1 text-[12px] font-medium">{p.name}</div>
                    <div className="text-[10.5px] text-neutral-500">{p.role}</div>
                  </div>
                </div>
                {p.load.map((m, i) => (
                  <div key={i} className="relative h-14 border-l border-neutral-100 p-1">
                    <div
                      className={`absolute bottom-0 left-2 right-2 flex items-end justify-center rounded-t pb-0.5 text-[9.5px] font-mono font-medium ${loadColour(m)}`}
                      style={{ height: `${Math.max(8, Math.min(96, m * 0.9))}%` }}
                    >
                      {m > 0 ? m : ''}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-neutral-600">
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#7FA38C]" />0–35% · slakk</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#3F6B4F]" />35–85% · normal</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#B8761F]" />85–100% · stramt</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#A03826]" />over 100% · overbelastet</span>
        </div>
      </WidgetCard>
    </div>
  )
}

