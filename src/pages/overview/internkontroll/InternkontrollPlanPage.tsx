// /overview/internkontroll/plan — ROADMAP §5.2 Plan & Timeline (Gantt-ish).
//
// Renders `compliance_plan_items` for the active framework as a
// chapter-grouped lane view. Each plan item is a horizontal bar
// positioned from `start_at` → `due_at`, coloured by status. Bars
// without `start_at` use `created_at` as the visible left edge; bars
// without `due_at` show as open-ended markers anchored to today.
//
// The page is intentionally focused: the gap-matrix inspector is the
// place to *create* items per paragraph (covers the §-context); this
// page is the place to *manage* them across the whole regelverk —
// re-prioritise, flip status (which auto-spawns the bridging task via
// `useCompliancePlanItems`), and read the lukke-tiltak landscape per
// kapittel.

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarClock, ListChecks } from 'lucide-react'
import { ModulePageShell } from '../../../components/module/ModulePageShell'
import { Button } from '../../../components/ui/Button'
import {
  FRAMEWORKS,
  FRAMEWORK_IDS,
  type FrameworkId,
} from './frameworkParagraphs'
import {
  useCompliancePlanItems,
  type CompliancePlanItem,
} from './useCompliancePlanItems'

const BREADCRUMB = [
  { label: 'Arbeidsflate', to: '/' },
  { label: 'Oversikt', to: '/overview/hms' },
  { label: 'Internkontroll', to: '/overview/internkontroll' },
  { label: 'Plan & tidslinje' },
]

const STATUS_LABEL: Record<CompliancePlanItem['status'], string> = {
  planned: 'Planlagt',
  in_progress: 'Pågår',
  blocked: 'Blokkert',
  done: 'Fullført',
}

// Tailwind tokens, matching the inspector's PlanItemsSection.
const STATUS_BAR: Record<CompliancePlanItem['status'], string> = {
  planned: 'bg-neutral-300 ring-neutral-400',
  in_progress: 'bg-blue-500 ring-blue-700',
  blocked: 'bg-amber-500 ring-amber-700',
  done: 'bg-emerald-500 ring-emerald-700',
}

const STATUS_CHIP: Record<CompliancePlanItem['status'], string> = {
  planned: 'bg-neutral-100 text-neutral-800 ring-neutral-200',
  in_progress: 'bg-blue-50 text-blue-900 ring-blue-200',
  blocked: 'bg-amber-50 text-amber-900 ring-amber-200',
  done: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
}

const STATUSES: CompliancePlanItem['status'][] = [
  'planned',
  'in_progress',
  'blocked',
  'done',
]

const MS_PER_DAY = 86_400_000

/**
 * Window the timeline covers: today − 14 days → today + 90 days. Bars
 * that fall outside are clamped at the edges with a visual marker.
 */
function timelineWindow(): { startMs: number; endMs: number } {
  const now = Date.now()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const startMs = today.getTime() - 14 * MS_PER_DAY
  const endMs = today.getTime() + 90 * MS_PER_DAY
  return { startMs, endMs }
}

function parseIsoDate(s: string | null | undefined): number | null {
  if (!s) return null
  const t = Date.parse(s)
  return Number.isFinite(t) ? t : null
}

function clamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo
  if (v > hi) return hi
  return v
}

function fmt(ms: number): string {
  return new Date(ms).toLocaleDateString('nb-NO', {
    day: '2-digit',
    month: 'short',
  })
}

function daysBetween(aMs: number, bMs: number): number {
  return Math.floor((bMs - aMs) / MS_PER_DAY)
}

/** Maps a (start, end) date pair to (leftPct, widthPct) inside the timeline window. */
function barGeometry(
  startMs: number,
  endMs: number,
  windowStart: number,
  windowEnd: number,
): { leftPct: number; widthPct: number; clippedLeft: boolean; clippedRight: boolean } {
  const totalMs = windowEnd - windowStart
  const clippedLeft = startMs < windowStart
  const clippedRight = endMs > windowEnd
  const s = clamp(startMs, windowStart, windowEnd)
  const e = clamp(Math.max(endMs, startMs + MS_PER_DAY), windowStart, windowEnd)
  return {
    leftPct: ((s - windowStart) / totalMs) * 100,
    widthPct: Math.max(0.5, ((e - s) / totalMs) * 100),
    clippedLeft,
    clippedRight,
  }
}

type ResolvedItem = {
  item: CompliancePlanItem
  startMs: number
  endMs: number
  hasStart: boolean
  hasDue: boolean
}

function resolveItem(item: CompliancePlanItem): ResolvedItem {
  const startRaw = parseIsoDate(item.start_at)
  const dueRaw = parseIsoDate(item.due_at)
  const createdRaw = parseIsoDate(item.created_at) ?? Date.now()
  const startMs = startRaw ?? createdRaw
  const endMs = dueRaw ?? startMs + 30 * MS_PER_DAY
  return {
    item,
    startMs,
    endMs,
    hasStart: startRaw !== null,
    hasDue: dueRaw !== null,
  }
}

export function InternkontrollPlanPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialFramework = (() => {
    const raw = searchParams.get('framework')
    if (raw && (FRAMEWORK_IDS as readonly string[]).includes(raw)) {
      return raw as FrameworkId
    }
    return 'aml' as FrameworkId
  })()
  const [framework, setFramework] = useState<FrameworkId>(initialFramework)

  const { items, loading, error, updateItem } = useCompliancePlanItems(framework)

  // Resolve chapter membership by joining law_ref against
  // FRAMEWORKS[framework].paragraphs. Items whose law_ref doesn't map
  // to a known paragraph fall into "(ukjent kapittel)".
  const chapterByLawRef = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of FRAMEWORKS[framework].paragraphs) {
      m.set(p.code, p.chapter ?? '(uten kapittel)')
    }
    return m
  }, [framework])

  const window_ = useMemo(timelineWindow, [])

  const grouped = useMemo(() => {
    const lanes = new Map<string, ResolvedItem[]>()
    for (const it of items) {
      const chapter = chapterByLawRef.get(it.law_ref) ?? '(ukjent kapittel)'
      const arr = lanes.get(chapter) ?? []
      arr.push(resolveItem(it))
      lanes.set(chapter, arr)
    }
    // Stable chapter order: by appearance in FRAMEWORKS[framework].paragraphs,
    // unknowns last.
    const knownChapters: string[] = []
    const seen = new Set<string>()
    for (const p of FRAMEWORKS[framework].paragraphs) {
      const c = p.chapter ?? '(uten kapittel)'
      if (!seen.has(c)) {
        seen.add(c)
        knownChapters.push(c)
      }
    }
    const ordered: Array<{ chapter: string; items: ResolvedItem[] }> = []
    for (const c of knownChapters) {
      const arr = lanes.get(c)
      if (arr && arr.length > 0) {
        arr.sort((a, b) => a.endMs - b.endMs)
        ordered.push({ chapter: c, items: arr })
      }
    }
    const unknown = lanes.get('(ukjent kapittel)')
    if (unknown && unknown.length > 0) {
      unknown.sort((a, b) => a.endMs - b.endMs)
      ordered.push({ chapter: '(ukjent kapittel)', items: unknown })
    }
    return ordered
  }, [items, chapterByLawRef, framework])

  const totals = useMemo(() => {
    const t = { total: items.length, planned: 0, in_progress: 0, blocked: 0, done: 0, overdue: 0 }
    const now = Date.now()
    for (const it of items) {
      t[it.status] += 1
      if (it.status !== 'done') {
        const due = parseIsoDate(it.due_at)
        if (due !== null && due < now) t.overdue += 1
      }
    }
    return t
  }, [items])

  const cycleStatus = async (it: CompliancePlanItem) => {
    const idx = STATUSES.indexOf(it.status)
    const next = STATUSES[(idx + 1) % STATUSES.length]
    await updateItem(it.id, { status: next })
  }

  // Week-grid tick positions for the timeline header.
  const ticks = useMemo(() => {
    const { startMs, endMs } = window_
    const total = endMs - startMs
    const out: Array<{ leftPct: number; label: string; isToday: boolean }> = []
    const now = Date.now()
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    const todayMs = today.getTime()
    // First Monday on/after startMs.
    const first = new Date(startMs)
    const dayOfWeek = first.getDay() // 0=Sun, 1=Mon
    const daysToMon = (8 - dayOfWeek) % 7
    let cursor = first.getTime() + daysToMon * MS_PER_DAY
    while (cursor <= endMs) {
      const leftPct = ((cursor - startMs) / total) * 100
      out.push({
        leftPct,
        label: fmt(cursor),
        isToday: Math.abs(cursor - todayMs) < MS_PER_DAY,
      })
      cursor += 7 * MS_PER_DAY
    }
    return out
  }, [window_])

  const todayLeftPct = useMemo(() => {
    const { startMs, endMs } = window_
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return ((today.getTime() - startMs) / (endMs - startMs)) * 100
  }, [window_])

  return (
    <ModulePageShell
      breadcrumb={BREADCRUMB}
      title="Plan & tidslinje"
      description="Lukke-tiltak gruppert per kapittel — flytt status og se hvor flaskehalsene ligger."
      headerActions={
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Regelverk
          </label>
          <select
            value={framework}
            onChange={(e) => {
              const next = e.target.value as FrameworkId
              setFramework(next)
              const sp = new URLSearchParams(searchParams)
              sp.set('framework', next)
              setSearchParams(sp, { replace: true })
            }}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm font-semibold text-neutral-800"
          >
            {FRAMEWORK_IDS.map((id) => (
              <option key={id} value={id}>
                {FRAMEWORKS[id].shortLabel}
              </option>
            ))}
          </select>
        </div>
      }
    >
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <KpiCard label="Tiltak totalt" value={totals.total} icon={<ListChecks className="h-4 w-4" />} />
        <KpiCard label="Pågår" value={totals.in_progress} tone="blue" />
        <KpiCard label="Planlagt" value={totals.planned} tone="neutral" />
        <KpiCard label="Blokkert" value={totals.blocked} tone="amber" />
        <KpiCard
          label="Overskredet"
          value={totals.overdue}
          tone={totals.overdue > 0 ? 'red' : 'neutral'}
          icon={<CalendarClock className="h-4 w-4" />}
        />
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {/* Timeline header */}
      <section className="rounded-lg border border-neutral-200 bg-white">
        <div className="grid grid-cols-[220px_1fr] border-b border-neutral-200">
          <div className="border-r border-neutral-200 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
            Kapittel
          </div>
          <div className="relative h-10">
            {ticks.map((t, i) => (
              <div
                key={i}
                className="absolute top-0 flex h-full -translate-x-1/2 flex-col items-center justify-center"
                style={{ left: `${t.leftPct}%` }}
              >
                <span
                  className={`text-[10px] font-semibold ${
                    t.isToday ? 'text-[#1a3d32]' : 'text-neutral-500'
                  }`}
                >
                  {t.label}
                </span>
              </div>
            ))}
            {/* Today marker */}
            <div
              className="pointer-events-none absolute top-0 h-full w-px bg-[#1a3d32]/40"
              style={{ left: `${todayLeftPct}%` }}
              aria-hidden
            />
          </div>
        </div>

        {/* Lanes */}
        {loading ? (
          <div className="px-4 py-10 text-center text-sm text-neutral-500">Laster tiltak…</div>
        ) : grouped.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-neutral-500">
            Ingen tiltak registrert for {FRAMEWORKS[framework].shortLabel} ennå. Åpne
            gap-matrisen og opprett tiltak per paragraf.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {grouped.map((g) => (
              <ChapterLane
                key={g.chapter}
                chapter={g.chapter}
                items={g.items}
                windowStartMs={window_.startMs}
                windowEndMs={window_.endMs}
                todayLeftPct={todayLeftPct}
                onCycleStatus={cycleStatus}
              />
            ))}
          </ul>
        )}
      </section>

      {grouped.length > 0 ? (
        <p className="text-xs italic text-neutral-500">
          Klikk på status-pillen for å rotere mellom Planlagt → Pågår → Blokkert → Fullført.
          Et tiltak som settes til «Pågår» oppretter automatisk en oppgave i Oppgaver-modulen.
        </p>
      ) : null}
    </ModulePageShell>
  )
}

function ChapterLane({
  chapter,
  items,
  windowStartMs,
  windowEndMs,
  todayLeftPct,
  onCycleStatus,
}: {
  chapter: string
  items: ResolvedItem[]
  windowStartMs: number
  windowEndMs: number
  todayLeftPct: number
  onCycleStatus: (item: CompliancePlanItem) => Promise<void>
}) {
  return (
    <li className="grid grid-cols-[220px_1fr]">
      <div className="border-r border-neutral-200 bg-neutral-50 px-4 py-3">
        <p className="text-xs font-semibold text-neutral-800">{chapter}</p>
        <p className="mt-1 text-[10px] uppercase tracking-wide text-neutral-500">
          {items.length} tiltak
        </p>
      </div>
      <div className="relative">
        {/* Today line — repeated per lane so it's continuous across the grid. */}
        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-[#1a3d32]/30"
          style={{ left: `${todayLeftPct}%` }}
          aria-hidden
        />
        <ul className="space-y-2 px-2 py-3">
          {items.map((r) => (
            <PlanBar
              key={r.item.id}
              resolved={r}
              windowStartMs={windowStartMs}
              windowEndMs={windowEndMs}
              onCycleStatus={onCycleStatus}
            />
          ))}
        </ul>
      </div>
    </li>
  )
}

function PlanBar({
  resolved,
  windowStartMs,
  windowEndMs,
  onCycleStatus,
}: {
  resolved: ResolvedItem
  windowStartMs: number
  windowEndMs: number
  onCycleStatus: (item: CompliancePlanItem) => Promise<void>
}) {
  const { item, startMs, endMs, hasDue } = resolved
  const geom = barGeometry(startMs, endMs, windowStartMs, windowEndMs)
  const now = Date.now()
  const dueMs = parseIsoDate(item.due_at)
  const overdueDays =
    item.status !== 'done' && dueMs !== null && dueMs < now ? daysBetween(dueMs, now) : 0
  const dueInDays =
    dueMs !== null && dueMs > now ? daysBetween(now, dueMs) : null

  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-3">
      {/* Bar track */}
      <div className="relative h-7">
        <div
          className={`absolute inset-y-0 flex items-center rounded ring-1 ring-inset ${STATUS_BAR[item.status]}`}
          style={{ left: `${geom.leftPct}%`, width: `${geom.widthPct}%` }}
          title={`${item.title} — ${fmt(startMs)} → ${hasDue ? fmt(endMs) : 'åpen'}`}
        >
          <span className="truncate px-2 text-[11px] font-semibold text-white">
            {item.title}
          </span>
        </div>
        {!hasDue ? (
          <span
            className="absolute top-1/2 -translate-y-1/2 rounded-full bg-neutral-200 px-1.5 py-0.5 text-[9px] font-semibold text-neutral-700"
            style={{ left: `calc(${geom.leftPct + geom.widthPct}% + 4px)` }}
          >
            åpen
          </span>
        ) : null}
      </div>

      {/* Right-side meta + status pill */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-[10px] text-neutral-500">{item.law_ref}</span>
        {overdueDays > 0 ? (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-800 ring-1 ring-inset ring-red-200">
            {overdueDays} d over
          </span>
        ) : dueInDays !== null && dueInDays <= 14 && item.status !== 'done' ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
            {dueInDays} d igjen
          </span>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void onCycleStatus(item)}
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${STATUS_CHIP[item.status]}`}
        >
          {STATUS_LABEL[item.status]}
        </Button>
      </div>
    </li>
  )
}

function KpiCard({
  label,
  value,
  tone = 'neutral',
  icon,
}: {
  label: string
  value: number
  tone?: 'neutral' | 'blue' | 'amber' | 'red'
  icon?: React.ReactNode
}) {
  const ring: Record<'neutral' | 'blue' | 'amber' | 'red', string> = {
    neutral: 'ring-neutral-200',
    blue: 'ring-blue-200',
    amber: 'ring-amber-200',
    red: 'ring-red-200',
  }
  return (
    <div className={`rounded-lg bg-white p-3 ring-1 ring-inset ${ring[tone]}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-xl font-bold text-neutral-900">{value}</p>
    </div>
  )
}
