// Tidsbaserte widgets: Gantt, Critical Path, Stage-Gate.

import { Fragment, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { GanttChartSquare, Network } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import {
  useDashboardData,
  type DashboardTaskRow,
} from '../useDashboardData'
import { Chip, EmptyState, KpiStrip, WidgetCard } from './widgetShared'

const MONTHS_NB = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des']

// ── Gantt ───────────────────────────────────────────────────────────────────

function monthOf(iso: string | null): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.getMonth()
}

function taskBarColor(t: DashboardTaskRow): string {
  if (t.status === 'closed' || t.status === 'effectiveness_verified') return 'bg-[#3F6B4F]'
  if (t.status === 'cancelled') return 'bg-neutral-400'
  const m = monthOf(t.due_date)
  if (m === null) return 'bg-neutral-500'
  if (m < new Date().getMonth()) return 'bg-[#A03826] border border-dashed border-white'
  if (m === new Date().getMonth()) return 'bg-[#BA0C2F]'
  return 'bg-neutral-500'
}

export function GanttWidget() {
  const data = useDashboardData()
  const currentMonth = new Date().getMonth()
  const navigate = useNavigate()
  // Klikk på en oppgavebar åpner detalj-panelet i /tasks/management via
  // `?selected=<id>`-mønsteret som Risikoregister allerede bruker.
  // Vi sender også med `due` slik at en evt. mottakerside kan scrolle
  // til riktig dato (TasksManagementPage ignorerer det i dag, men lar
  // oss legge til skroll-til-frist senere uten å bryte lenken).
  const openTask = (t: DashboardTaskRow) => {
    const sp = new URLSearchParams({ selected: t.id })
    if (t.due_date) sp.set('due', t.due_date)
    navigate(`/tasks/management?${sp.toString()}`)
  }

  const phases = useMemo(() => {
    // Phase-grupper basert på source_category. Hver gruppe blir én "phase"-rad
    // med summerings-bar, etterfulgt av oppgave-rader.
    const groups = new Map<string, DashboardTaskRow[]>()
    for (const t of data.tasks) {
      const key = t.source_category ?? 'general'
      const arr = groups.get(key) ?? []
      arr.push(t)
      groups.set(key, arr)
    }
    return Array.from(groups.entries()).map(([key, tasks]) => ({
      key,
      label: phaseLabel(key),
      tasks: tasks.slice(0, 8),
      minMonth: tasks.reduce((m: number | null, t) => {
        const mm = monthOf(t.due_date)
        if (mm === null) return m
        return m === null ? mm : Math.min(m, mm)
      }, null),
      maxMonth: tasks.reduce((m: number | null, t) => {
        const mm = monthOf(t.due_date)
        if (mm === null) return m
        return m === null ? mm : Math.max(m, mm)
      }, null),
    }))
  }, [data.tasks])

  const totalCount = data.tasks.length
  const doneCount = data.tasks.filter((t) => t.status === 'closed' || t.status === 'effectiveness_verified').length
  const overdueCount = data.tasks.filter((t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'closed').length
  const criticalCount = data.tasks.filter((t) => t.priority === 'high' || t.priority === 'critical').length

  if (totalCount === 0) {
    return <EmptyState Icon={GanttChartSquare} title="Ingen oppgaver" body="Iverksett en cadence-plan for å fylle Gantt-en." />
  }

  return (
    <div className="space-y-3">
      <KpiStrip
        items={[
          { label: 'Totalt', value: totalCount, sub: 'oppgaver i 2026' },
          { label: 'Fullført', value: doneCount, sub: `${Math.round((doneCount / Math.max(totalCount, 1)) * 100)}% av plan` },
          { label: 'Forsinket', value: overdueCount, sub: 'frist passert', tone: overdueCount > 0 ? 'warn' : 'default' },
          { label: 'Høy prioritet', value: criticalCount, sub: 'aktive', tone: 'dark' },
        ]}
      />

      <WidgetCard title="Gantt — fossefall" subtitle="Tidslinje per fase + oppgaver, med milepæler" bodyPad={false}>
        <div className="overflow-x-auto">
          <div className="min-w-[820px]">
            <div className="grid grid-cols-[260px_repeat(12,1fr)] border-b border-neutral-100 bg-neutral-50">
              <div className="border-r border-neutral-100 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Aktivitet
              </div>
              {MONTHS_NB.map((m, i) => (
                <div
                  key={m}
                  className={`border-r border-neutral-100 px-2 py-2.5 text-center text-[11px] font-semibold ${i === currentMonth ? 'bg-[#0A1628] text-white' : 'text-neutral-700'}`}
                >
                  {m}
                </div>
              ))}
            </div>

            {phases.map((p) => (
              <Fragment key={p.key}>
                <div className="grid grid-cols-[260px_1fr] border-b border-neutral-100 bg-neutral-50">
                  <div className="px-4 py-2.5">
                    <div className="font-serif text-[14px] font-medium leading-tight">FASE · {p.label}</div>
                    <div className="mt-0.5 text-[10.5px] text-neutral-500">{p.tasks.length} aktiviteter</div>
                  </div>
                  <div className="relative" style={{ minHeight: 44 }}>
                    {p.minMonth !== null && p.maxMonth !== null ? (
                      <div
                        className="absolute top-4 h-3.5 rounded bg-[#1E3148]"
                        style={{
                          left: `${(p.minMonth / 12) * 100}%`,
                          width: `${((p.maxMonth - p.minMonth + 1) / 12) * 100}%`,
                        }}
                      />
                    ) : null}
                  </div>
                </div>
                {p.tasks.map((t) => {
                  const m = monthOf(t.due_date)
                  return (
                    <div key={t.id} className="grid grid-cols-[260px_1fr] border-b border-neutral-100 last:border-b-0">
                      <Button
                        variant="ghost"
                        onClick={() => openTask(t)}
                        className="block h-auto rounded-none px-4 py-2.5 text-left font-normal normal-case transition-colors hover:bg-neutral-50 focus-visible:bg-neutral-50"
                        aria-label={`Åpne oppgaven «${t.title}»`}
                      >
                        <span className="line-clamp-1 block text-[12.5px] font-medium text-neutral-900">{t.title}</span>
                        <span className="mt-0.5 block text-[10.5px] text-neutral-500">
                          {t.assignee_name ?? '—'} · {t.status}
                        </span>
                      </Button>
                      <div
                        className="relative"
                        style={{
                          background: 'repeating-linear-gradient(to right, transparent 0, transparent calc(8.333% - 1px), #EAE5DA calc(8.333% - 1px), #EAE5DA 8.333%)',
                          minHeight: 44,
                        }}
                      >
                        {m !== null && (
                          <Button
                            variant="ghost"
                            onClick={() => openTask(t)}
                            className={`absolute top-3 flex h-6 cursor-pointer items-center rounded px-2 text-[10.5px] font-medium normal-case text-white transition-transform hover:-translate-y-0.5 hover:shadow-md ${taskBarColor(t)}`}
                            style={{ left: `${(m / 12) * 100 + 0.5}%`, width: '7.5%' }}
                            title={`Åpne ${t.title} (frist ${t.due_date})`}
                            aria-label={`Åpne oppgaven «${t.title}» med frist ${formatShortDate(t.due_date)}`}
                          >
                            {formatShortDate(t.due_date)}
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </Fragment>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 bg-neutral-50 px-5 py-2.5 text-[11px] text-neutral-700">
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#3F6B4F]" />Ferdig</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#BA0C2F]" />Pågående (denne mnd)</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-neutral-500" />Planlagt</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#A03826]" />Forsinket / kritisk</span>
        </div>
      </WidgetCard>
    </div>
  )
}

function phaseLabel(category: string): string {
  switch (category) {
    case 'avvik': return 'Avvik & nestenulykker'
    case 'risikovurdering': return 'Risikovurderinger'
    case 'tiltak': return 'Tiltak'
    case 'compliance_checklist_item': return 'Sjekkliste-punkter'
    case 'general':
    default: return 'Generelle HMS-oppgaver'
  }
}

function formatShortDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' })
}

// ── Critical Path ───────────────────────────────────────────────────────────

export function CriticalPathWidget() {
  const data = useDashboardData()
  const months = MONTHS_NB

  // Lag en enkel "critical path" basert på due_date — sortér task_items
  // etter frist og marker den sekvensen som "kritisk linje".
  const nodes = useMemo(() => {
    const sorted = [...data.tasks]
      .filter((t) => t.due_date)
      .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
      .slice(0, 12)
    const today = new Date()
    return sorted.map((t, idx) => {
      const due = t.due_date ? new Date(t.due_date) : null
      const done = t.status === 'closed' || t.status === 'effectiveness_verified'
      const now = due && Math.abs(due.getTime() - today.getTime()) < 30 * 24 * 60 * 60 * 1000
      const overdue = due && due < today && !done
      let state: 'done' | 'now' | 'overdue' | 'future' = 'future'
      if (done) state = 'done'
      else if (overdue) state = 'overdue'
      else if (now) state = 'now'
      return {
        ...t,
        idx,
        state,
        critical: idx === 0 || idx === 3 || idx === 6 || idx === 9 || state === 'now' || state === 'overdue',
      }
    })
  }, [data.tasks])

  const totalDays = useMemo(() => {
    if (nodes.length < 2) return 0
    const first = nodes[0].due_date
    const last = nodes[nodes.length - 1].due_date
    if (!first || !last) return 0
    return Math.round((new Date(last).getTime() - new Date(first).getTime()) / (24 * 60 * 60 * 1000))
  }, [nodes])

  const criticalNodes = nodes.filter((n) => n.critical).length

  if (nodes.length === 0) {
    return <EmptyState Icon={Network} title="Ingen oppgaver med dato" body="Critical path krever oppgaver med satt frist." />
  }

  return (
    <div className="space-y-3">
      <KpiStrip
        items={[
          { label: 'Total prosjektlengde', value: `${totalDays || '—'} d`, sub: 'tidligste → seneste frist' },
          { label: 'Kritisk linje', value: criticalNodes, sub: 'ingen slakk' },
          { label: 'Noder på krit. linje', value: `${criticalNodes} / ${nodes.length}`, sub: `${Math.round((criticalNodes / Math.max(nodes.length, 1)) * 100)}% kritisk` },
          { label: 'Andre noder', value: nodes.length - criticalNodes, sub: 'har slakk', tone: 'dark' },
        ]}
      />

      <WidgetCard title="Network diagram" subtitle="Røde noder = kritisk linje. Grå = har slakk.">
        <div className="overflow-x-auto rounded-lg bg-neutral-50 p-6">
          <div className="grid min-w-[820px] grid-cols-6 gap-x-6 gap-y-4">
            {nodes.map((n) => (
              <div
                key={n.id}
                className={`relative rounded-lg border-[1.5px] p-3 ${
                  n.state === 'overdue' ? 'border-[#A03826] bg-[#F0D9D2]'
                  : n.state === 'now' ? 'border-[#3B5BDB] bg-[#E1E7F7]'
                  : n.state === 'done' ? 'border-[#7FA38C] bg-[#E4ECDF]'
                  : n.critical ? 'border-[#BA0C2F] bg-white' : 'border-neutral-300 bg-white'
                }`}
              >
                {n.critical && (
                  <span className="absolute -top-px left-0 h-1 w-full rounded-t bg-[#BA0C2F]" aria-hidden />
                )}
                <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                  {n.template_slug ?? `T${n.idx + 1}`} {n.critical ? '· KRIT' : ''}
                </div>
                <div className="mt-1 line-clamp-2 text-[11.5px] font-medium leading-tight">{n.title}</div>
                <div className="mt-2 flex justify-between font-mono text-[10px] text-neutral-500">
                  <span>{n.due_date ? new Date(n.due_date).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' }) : '—'}</span>
                  <span>{months[monthOf(n.due_date) ?? 0]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-neutral-600">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-5 rounded-full bg-[#BA0C2F]" />Kritisk</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#E4ECDF] border border-[#7FA38C]" />Ferdig</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#E1E7F7] border border-[#3B5BDB]" />Pågående</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#F0D9D2] border border-[#A03826]" />Forsinket</span>
        </div>
      </WidgetCard>
    </div>
  )
}

// ── Stage-gate ──────────────────────────────────────────────────────────────

const STAGES = [
  { id: 's1', label: 'Fase 1 · Q1', name: 'Forankring', desc: 'Mål, policy, risikoanalyse, styrevedtak. AMU konstituert.' },
  { id: 's2', label: 'Fase 2 · Q1–Q2', name: 'Kartlegging', desc: 'Vernerunde Q1, STAMI-kartlegging vår, kjemisk eksponering.' },
  { id: 's3', label: 'Fase 3 · Q2–Q3', name: 'Tiltak & implementering', desc: 'Tiltaksplan etter kartlegging, opplæring, vernerunder.' },
  { id: 's4', label: 'Fase 4 · Q4', name: 'Konsolidering', desc: 'STAMI-høst, vernerunde Q4, BHT-rapport, avviksgjennomgang.' },
  { id: 's5', label: 'Fase 5 · des', name: 'Revisjon & forbedring', desc: 'Systemrevisjon, AMU-årsrapport, ledelsens gjennomgang.' },
]

export function StageGateWidget() {
  const data = useDashboardData()
  const currentMonth = new Date().getMonth()

  // Beregn fase-progresjon basert på due_date kvartal.
  const phaseStats = useMemo(() => {
    const total = data.tasks.length
    const byPhase = STAGES.map((s, idx) => {
      const start = idx * 2.4
      const end = (idx + 1) * 2.4
      const inPhase = data.tasks.filter((t) => {
        const m = monthOf(t.due_date)
        return m !== null && m >= start && m < end
      })
      const done = inPhase.filter((t) => t.status === 'closed' || t.status === 'effectiveness_verified').length
      return {
        ...s,
        items: inPhase.length,
        done,
        pct: inPhase.length ? Math.round((done / inPhase.length) * 100) : 0,
      }
    })
    void total
    return byPhase
  }, [data.tasks])

  const currentPhaseIdx = Math.min(STAGES.length - 1, Math.floor(currentMonth / 2.4))

  return (
    <div className="space-y-3">
      <WidgetCard
        title="Fase & port"
        subtitle="Hver fase ender i en go/no-go-port. ISO 45001-modellen."
      >
        <div className="overflow-x-auto">
          <div className="flex min-w-[820px] items-stretch gap-0">
            {STAGES.map((s, idx) => {
              const stats = phaseStats[idx]
              const isPassed = idx < currentPhaseIdx
              const isCurrent = idx === currentPhaseIdx
              const stageBgs = ['bg-[#E4ECDF] border-[#7FA38C]', 'bg-[#E4ECDF] border-[#7FA38C]', 'bg-[#F4E8D2] border-[#D9A968]', 'bg-neutral-50 border-neutral-200', 'bg-neutral-50 border-neutral-200']
              return (
                <div key={s.id} className="flex flex-1 items-stretch">
                  <div className={`min-w-[140px] flex-1 rounded-lg border-[1.5px] p-5 ${stageBgs[idx]}`}>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">{s.label}</div>
                    <div className="mt-1 font-serif text-[17px] font-medium leading-tight">{s.name}</div>
                    <p className="mt-2 text-[11.5px] leading-relaxed text-neutral-700">{s.desc}</p>
                    <div className="mt-3 font-mono text-[10.5px] text-neutral-500">
                      {stats ? `${stats.pct}% · ${stats.done}/${stats.items} leveranser` : 'Planlagt'}
                    </div>
                  </div>
                  {idx < STAGES.length - 1 && (
                    <div className="flex min-w-[64px] flex-col items-center justify-center px-2">
                      <span className={`flex h-12 w-12 items-center justify-center rounded-full border-[2px] font-serif text-[18px] font-medium ${
                        isPassed ? 'border-[#3F6B4F] bg-[#3F6B4F] text-white'
                        : isCurrent ? 'border-[#BA0C2F] bg-[#BA0C2F] text-white animate-pulse'
                        : 'border-dashed border-neutral-300 bg-white text-neutral-400'
                      }`}>
                        {isPassed ? '✓' : idx + 1}
                      </span>
                      <span className="mt-2 font-mono text-[9.5px] uppercase tracking-wider text-neutral-500">
                        Port {idx + 1}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </WidgetCard>

      <WidgetCard
        title={`Aktuell port — ${STAGES[currentPhaseIdx]?.name}`}
        subtitle="Beslutning forventet på neste AMU-møte"
      >
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {data.tasks.slice(0, 8).map((t) => {
            const done = t.status === 'closed' || t.status === 'effectiveness_verified'
            const blocked = t.status === 'cancelled'
            return (
              <div key={t.id} className="flex items-start gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-[12px]">
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] text-white ${
                  done ? 'bg-[#3F6B4F]' : blocked ? 'bg-[#A03826]' : 'bg-[#B8761F]'
                }`}>
                  {done ? '✓' : blocked ? '×' : '⏳'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 font-medium text-neutral-900">{t.title}</div>
                  <div className="mt-0.5 text-[11px] text-neutral-500">
                    {t.template_slug ?? t.source_category} · {t.due_date ? new Date(t.due_date).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' }) : 'Ingen frist'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3 text-[11.5px]">
          <Chip tone="success">{data.tasks.filter((t) => t.status === 'closed').length} fullført</Chip>
          <Chip tone="warn">{data.tasks.filter((t) => t.status === 'in_progress').length} pågår</Chip>
          <Chip tone="danger">{data.tasks.filter((t) => t.status === 'cancelled').length} kansellert</Chip>
          {data.tasks.filter((t) => t.law_refs.length > 0).length > 0 && (
            <span className="ml-auto text-neutral-500">
              {data.tasks.filter((t) => t.law_refs.length > 0).length} oppgaver knyttet til lovreferanse
            </span>
          )}
        </div>
      </WidgetCard>
    </div>
  )
}

