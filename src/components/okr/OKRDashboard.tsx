/**
 * <OKRDashboard /> — Objectives + key-results overview with two view modes.
 *
 * - "Kort" (Cards): grid of cards, each with an objective header (title +
 *   owner avatar + roll-up progress) and a body listing KR rows with a
 *   progress bar and confidence badge.
 * - "Matrise" (Matrix): TanStack-style expandable table where each objective
 *   row expands to show its KR rows inline.
 *
 * Confidence colours follow the user's semantic mapping:
 *   on_track  → bg-emerald-500
 *   at_risk   → bg-amber-500
 *   off_track → bg-rose-500
 *
 * Roll-up progress on each objective = average of its KR progress percentages.
 *
 * shadcn/ui + TanStack aren't installed in this project, so the Card / Avatar /
 * Progress shapes are local minimal primitives that match the workplace shell
 * (cream header band, forest accent, rounded-xl cards). Lift them into
 * `src/components/ui/` if multiple consumers appear.
 */
import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, LayoutGrid, Table2, Target } from 'lucide-react'
import { Tabs, type TabItem } from '../ui/Tabs'
import { Button } from '../ui/Button'

/* ── Types ────────────────────────────────────────────────────────────────── */

export type Confidence = 'on_track' | 'at_risk' | 'off_track'

export type OKROwner = {
  name: string
  /** Two-letter initials override; auto-derived from `name` if omitted. */
  initials?: string
  /** Optional avatar image URL. */
  avatarUrl?: string
}

export type KeyResult = {
  id: string
  title: string
  /** 0–100 */
  progress: number
  confidence: Confidence
  /** Optional human-readable target ("Q2 NPS ≥ 60"). */
  target?: string
  /** Optional current value ("54"). */
  current?: string
}

export type Objective = {
  id: string
  title: string
  description?: string
  owner: OKROwner
  keyResults: KeyResult[]
}

export type OKRDashboardProps = {
  objectives: Objective[]
  /** Initial view; uncontrolled. */
  defaultView?: 'cards' | 'matrix'
  className?: string
}

/* ── Confidence tokens ────────────────────────────────────────────────────── */

const CONFIDENCE_BG: Record<Confidence, string> = {
  on_track: 'bg-emerald-500',
  at_risk: 'bg-amber-500',
  off_track: 'bg-rose-500',
}

const CONFIDENCE_RING: Record<Confidence, string> = {
  on_track: 'ring-emerald-200',
  at_risk: 'ring-amber-200',
  off_track: 'ring-rose-200',
}

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  on_track: 'På sporet',
  at_risk: 'Risiko',
  off_track: 'Bak skjema',
}

/* ── Local primitives (Card / Avatar / Progress / ConfidenceBadge) ────────── */

function Card({
  className = '',
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={`rounded-xl border border-neutral-200/80 bg-white shadow-sm ${className}`.trim()}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      {children}
    </div>
  )
}

function deriveInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Stable colour per name — used as the avatar background fallback. */
function avatarHue(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return Math.abs(h) % 360
}

function Avatar({ owner, size = 36 }: { owner: OKROwner; size?: number }) {
  const initials = owner.initials ?? deriveInitials(owner.name)
  const hue = avatarHue(owner.name)
  const style = {
    width: size,
    height: size,
    fontSize: Math.round(size * 0.36),
    backgroundColor: owner.avatarUrl ? undefined : `hsl(${hue} 32% 88%)`,
    color: owner.avatarUrl ? undefined : `hsl(${hue} 38% 26%)`,
  } as const
  return (
    <span
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold ring-1 ring-black/5"
      style={style}
      aria-label={owner.name}
      title={owner.name}
    >
      {owner.avatarUrl ? (
        <img
          src={owner.avatarUrl}
          alt=""
          className="size-full rounded-full object-cover"
        />
      ) : (
        initials
      )}
    </span>
  )
}

function Progress({
  value,
  confidence,
  size = 'md',
}: {
  value: number
  confidence?: Confidence
  size?: 'sm' | 'md'
}) {
  const pct = Math.max(0, Math.min(100, value))
  const trackClass = size === 'sm' ? 'h-1.5' : 'h-2'
  const fillBg = confidence ? CONFIDENCE_BG[confidence] : 'bg-[#1a3d32]'
  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-neutral-200 ${trackClass}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${fillBg}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm ring-1 ${CONFIDENCE_BG[confidence]} ${CONFIDENCE_RING[confidence]}`}
    >
      <span className="inline-block size-1.5 rounded-full bg-white/85" aria-hidden />
      {CONFIDENCE_LABEL[confidence]}
    </span>
  )
}

/* ── Roll-up helper ───────────────────────────────────────────────────────── */

function rollUpProgress(obj: Objective): number {
  if (obj.keyResults.length === 0) return 0
  const sum = obj.keyResults.reduce((s, kr) => s + kr.progress, 0)
  return Math.round(sum / obj.keyResults.length)
}

/** Roll-up confidence = worst confidence across the objective's KRs. */
function rollUpConfidence(obj: Objective): Confidence {
  if (obj.keyResults.some((kr) => kr.confidence === 'off_track')) return 'off_track'
  if (obj.keyResults.some((kr) => kr.confidence === 'at_risk')) return 'at_risk'
  return 'on_track'
}

/* ── OKRDashboard (the actual export) ─────────────────────────────────────── */

export function OKRDashboard({
  objectives,
  defaultView = 'cards',
  className = '',
}: OKRDashboardProps) {
  const [view, setView] = useState<'cards' | 'matrix'>(defaultView)

  const tabs: TabItem[] = useMemo(
    () => [
      { id: 'cards', label: 'Kort', icon: LayoutGrid },
      { id: 'matrix', label: 'Matrise', icon: Table2 },
    ],
    [],
  )

  const summary = useMemo(() => {
    const totalKRs = objectives.reduce((s, o) => s + o.keyResults.length, 0)
    const avg =
      objectives.length === 0
        ? 0
        : Math.round(
            objectives.reduce((s, o) => s + rollUpProgress(o), 0) / objectives.length,
          )
    const atRisk = objectives.filter((o) => rollUpConfidence(o) === 'at_risk').length
    const offTrack = objectives.filter((o) => rollUpConfidence(o) === 'off_track').length
    return { totalKRs, avg, atRisk, offTrack }
  }, [objectives])

  return (
    <div className={className}>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600">
          <span className="inline-flex items-center gap-1.5">
            <Target className="size-4 text-neutral-400" aria-hidden />
            <span>
              <span className="font-semibold text-neutral-900">{objectives.length}</span> mål ·{' '}
              <span className="font-semibold text-neutral-900">{summary.totalKRs}</span> KR
            </span>
          </span>
          <span aria-hidden className="h-3 w-px bg-neutral-300" />
          <span>
            Snittfremdrift{' '}
            <span className="font-mono font-semibold tabular-nums text-neutral-900">
              {summary.avg}%
            </span>
          </span>
          {summary.atRisk > 0 ? (
            <ConfidenceBadgeInline confidence="at_risk" count={summary.atRisk} />
          ) : null}
          {summary.offTrack > 0 ? (
            <ConfidenceBadgeInline confidence="off_track" count={summary.offTrack} />
          ) : null}
        </div>
        <Tabs
          items={tabs}
          activeId={view}
          onChange={(id) => setView(id as 'cards' | 'matrix')}
        />
      </div>

      {objectives.length === 0 ? (
        <Card className="px-6 py-12 text-center text-sm text-neutral-500">
          Ingen mål definert ennå.
        </Card>
      ) : view === 'cards' ? (
        <CardsView objectives={objectives} />
      ) : (
        <MatrixView objectives={objectives} />
      )}
    </div>
  )
}

function ConfidenceBadgeInline({
  confidence,
  count,
}: {
  confidence: Confidence
  count: number
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${CONFIDENCE_BG[confidence]}`}
    >
      <span className="inline-block size-1.5 rounded-full bg-white/85" aria-hidden />
      {count} {CONFIDENCE_LABEL[confidence].toLowerCase()}
    </span>
  )
}

/* ── Cards view ───────────────────────────────────────────────────────────── */

function CardsView({ objectives }: { objectives: Objective[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {objectives.map((o) => (
        <ObjectiveCard key={o.id} objective={o} />
      ))}
    </div>
  )
}

function ObjectiveCard({ objective }: { objective: Objective }) {
  const rollup = rollUpProgress(objective)
  const conf = rollUpConfidence(objective)
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-neutral-100 bg-[#FBF8F1] px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              className="truncate text-base font-semibold tracking-tight text-neutral-900"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
              title={objective.title}
            >
              {objective.title}
            </h3>
            {objective.description ? (
              <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">
                {objective.description}
              </p>
            ) : null}
          </div>
          <Avatar owner={objective.owner} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <ConfidenceBadge confidence={conf} />
          <span className="font-mono text-sm font-semibold tabular-nums text-neutral-900">
            {rollup}%
          </span>
        </div>
        <div className="mt-2">
          <Progress value={rollup} confidence={conf} />
        </div>
      </header>

      <ul className="flex-1 divide-y divide-neutral-100">
        {objective.keyResults.map((kr) => (
          <li key={kr.id} className="px-5 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900" title={kr.title}>
                  {kr.title}
                </p>
                {kr.target || kr.current ? (
                  <p className="mt-0.5 text-[11px] text-neutral-500">
                    {kr.current ? <span className="font-mono">{kr.current}</span> : null}
                    {kr.current && kr.target ? ' / ' : null}
                    {kr.target ? <span className="font-mono">{kr.target}</span> : null}
                  </p>
                ) : null}
              </div>
              <ConfidenceBadge confidence={kr.confidence} />
            </div>
            <div className="mt-2 flex items-center gap-3">
              <Progress value={kr.progress} confidence={kr.confidence} size="sm" />
              <span className="font-mono text-xs font-semibold tabular-nums text-neutral-700">
                {Math.round(kr.progress)}%
              </span>
            </div>
          </li>
        ))}
      </ul>

      <footer className="border-t border-neutral-100 bg-white px-5 py-2.5 text-[11px] text-neutral-500">
        Eier · <span className="font-medium text-neutral-700">{objective.owner.name}</span>
      </footer>
    </Card>
  )
}

/* ── Matrix view (TanStack-style expandable table) ────────────────────────── */

const TH =
  'border-b border-neutral-200 bg-[#EFE8DC] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-600'
const TD = 'border-b border-neutral-100 px-4 py-3 text-sm text-neutral-800 align-middle'

function MatrixView({ objectives }: { objectives: Objective[] }) {
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(objectives.slice(0, 2).map((o) => o.id)),
  )

  const toggle = (id: string) =>
    setOpenIds((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${TH} w-10 pl-5`} aria-label="Utvid" />
              <th className={TH}>Mål / Key result</th>
              <th className={TH}>Eier</th>
              <th className={`${TH} w-28 text-right`}>KR</th>
              <th className={`${TH} w-32`}>Tillit</th>
              <th className={`${TH} pr-5`}>Fremdrift</th>
            </tr>
          </thead>
          <tbody>
            {objectives.map((o) => {
              const isOpen = openIds.has(o.id)
              const rollup = rollUpProgress(o)
              const conf = rollUpConfidence(o)
              return (
                <FragmentRow
                  key={o.id}
                  objective={o}
                  isOpen={isOpen}
                  rollup={rollup}
                  conf={conf}
                  onToggle={() => toggle(o.id)}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function FragmentRow({
  objective,
  isOpen,
  rollup,
  conf,
  onToggle,
}: {
  objective: Objective
  isOpen: boolean
  rollup: number
  conf: Confidence
  onToggle: () => void
}) {
  return (
    <>
      <tr
        className={`cursor-pointer transition ${isOpen ? 'bg-[#F7F4EE]' : 'hover:bg-neutral-50'}`}
        onClick={onToggle}
      >
        <td className={`${TD} pl-5`}>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Skjul KR' : 'Vis KR'}
          >
            {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
        </td>
        <td className={TD}>
          <div className="min-w-0">
            <p className="font-semibold text-neutral-900">{objective.title}</p>
            {objective.description ? (
              <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500">
                {objective.description}
              </p>
            ) : null}
          </div>
        </td>
        <td className={TD}>
          <div className="flex items-center gap-2">
            <Avatar owner={objective.owner} size={28} />
            <span className="truncate text-sm text-neutral-700">{objective.owner.name}</span>
          </div>
        </td>
        <td className={`${TD} text-right font-mono tabular-nums text-neutral-700`}>
          {objective.keyResults.length}
        </td>
        <td className={TD}>
          <ConfidenceBadge confidence={conf} />
        </td>
        <td className={`${TD} pr-5`}>
          <div className="flex items-center gap-2.5">
            <Progress value={rollup} confidence={conf} />
            <span className="w-10 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-neutral-700">
              {rollup}%
            </span>
          </div>
        </td>
      </tr>

      {isOpen
        ? objective.keyResults.map((kr) => (
            <tr key={kr.id} className="bg-[#FBF8F1]/60">
              <td className={`${TD} pl-5`} />
              <td className={TD}>
                <div className="flex items-start gap-2 pl-4">
                  <span
                    className="mt-1 inline-block h-3 w-3 shrink-0 border-l border-b border-neutral-300"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-800">{kr.title}</p>
                    {kr.target || kr.current ? (
                      <p className="mt-0.5 text-[11px] text-neutral-500">
                        {kr.current ? <span className="font-mono">{kr.current}</span> : null}
                        {kr.current && kr.target ? ' / ' : null}
                        {kr.target ? <span className="font-mono">{kr.target}</span> : null}
                      </p>
                    ) : null}
                  </div>
                </div>
              </td>
              <td className={`${TD} text-neutral-400`} aria-hidden />
              <td className={`${TD} text-right text-neutral-400`} aria-hidden>
                —
              </td>
              <td className={TD}>
                <ConfidenceBadge confidence={kr.confidence} />
              </td>
              <td className={`${TD} pr-5`}>
                <div className="flex items-center gap-2.5">
                  <Progress value={kr.progress} confidence={kr.confidence} size="sm" />
                  <span className="w-10 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-neutral-700">
                    {Math.round(kr.progress)}%
                  </span>
                </div>
              </td>
            </tr>
          ))
        : null}
    </>
  )
}
