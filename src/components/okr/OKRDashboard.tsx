/**
 * <OKRDashboard /> — Objectives + key-results overview with two view modes.
 *
 * - "Kort" (Cards): grid of cards, each with an objective header (title +
 *   owner avatar + roll-up progress) and a body listing KR rows with a
 *   progress bar and confidence badge.
 * - "Matrise" (Matrix): TanStack-style expandable table where each objective
 *   row expands to show its KR rows inline.
 *
 * Pass `editable` to switch the component into full CRUD mode — create / edit /
 * delete actions for both objectives and key results, plus a `+ Nytt mål`
 * button at the top. CRUD state is managed internally; an optional
 * `onObjectivesChange` callback fires after every mutation so callers can
 * persist or audit.
 *
 * Confidence colours follow the requested mapping:
 *   on_track  → bg-emerald-500
 *   at_risk   → bg-amber-500
 *   off_track → bg-rose-500
 *
 * Roll-up progress on each objective = average of its KR progress percentages;
 * roll-up confidence = worst of the children so "at_risk" surfaces upward.
 */
import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  Pencil,
  Plus,
  Table2,
  Target,
  Trash2,
} from 'lucide-react'
import { Tabs, type TabItem } from '../ui/Tabs'
import { Button } from '../ui/Button'
import { freshId } from '../../lib/dashboards/freshId'
import {
  CONFIDENCE_BG,
  CONFIDENCE_LABEL,
  CONFIDENCE_RING,
  type Confidence,
  type KeyResult,
  type Objective,
  type OKROwner,
} from './types'
import {
  ConfirmDeleteDialog,
  KeyResultDialog,
  ObjectiveDialog,
  type KeyResultDialogMode,
  type KeyResultFormPayload,
  type ObjectiveDialogMode,
  type ObjectiveFormPayload,
} from './OKREditDialogs'

export type { Confidence, KeyResult, Objective, OKROwner } from './types'
export type { ObjectiveFormPayload, KeyResultFormPayload } from './OKREditDialogs'

/** Controlled-mode CRUD callbacks — caller owns persistence (e.g. Supabase). */
export type OKRDashboardHandlers = {
  onCreateObjective: (payload: ObjectiveFormPayload) => void | Promise<void>
  onUpdateObjective: (
    id: string,
    payload: ObjectiveFormPayload,
  ) => void | Promise<void>
  onDeleteObjective: (id: string) => void | Promise<void>
  onCreateKR: (
    objectiveId: string,
    payload: KeyResultFormPayload,
  ) => void | Promise<void>
  onUpdateKR: (
    objectiveId: string,
    krId: string,
    payload: KeyResultFormPayload,
  ) => void | Promise<void>
  onDeleteKR: (objectiveId: string, krId: string) => void | Promise<void>
}

export type OKRDashboardProps = {
  /**
   * Read-mode: the source of truth.
   * Uncontrolled edit-mode (`editable` + no `handlers`): initial value only —
   *   internal state takes over.
   * Controlled edit-mode (`editable` + `handlers`): live source of truth —
   *   the component renders the prop verbatim and delegates CRUD.
   */
  objectives: Objective[]
  /** Initial view; uncontrolled. */
  defaultView?: 'cards' | 'matrix'
  /** When true, exposes create / edit / delete actions on objectives + KRs. */
  editable?: boolean
  /** Fired after every CRUD mutation in uncontrolled edit mode. */
  onObjectivesChange?: (next: Objective[]) => void
  /**
   * Optional CRUD callbacks. When present, the component runs in controlled
   * mode and never touches internal state — caller persists each mutation
   * (e.g. via Supabase) and re-renders with a fresh `objectives` prop.
   */
  handlers?: OKRDashboardHandlers
  /** When provided, every KR row gets a "Sjekk inn" action (H2.1). */
  onCheckinKR?: (objectiveId: string, krId: string) => void
  className?: string
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
        <img src={owner.avatarUrl} alt="" className="size-full rounded-full object-cover" />
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

/** Tiny inline SVG sparkline over confidence history (0..1, oldest→newest).
 *  Hand-rolled to match the existing chart style — no chart lib. */
function ConfidenceSparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const w = 56
  const h = 16
  const step = w / (values.length - 1)
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - 2 - Math.max(0, Math.min(1, v)) * (h - 4)).toFixed(1)}`)
    .join(' ')
  const last = values[values.length - 1]!
  const tone = last >= 0.7 ? '#10b981' : last >= 0.4 ? '#f59e0b' : '#f43f5e'
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0"
      role="img"
      aria-label={`Tillitstrend, siste ${values.length} innsjekk`}
    >
      <polyline points={points} fill="none" stroke={tone} strokeWidth="1.5" strokeLinejoin="round" />
      <circle
        cx={(values.length - 1) * step}
        cy={h - 2 - Math.max(0, Math.min(1, last)) * (h - 4)}
        r="2"
        fill={tone}
      />
    </svg>
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

/* ── Roll-up helpers ──────────────────────────────────────────────────────── */

function rollUpProgress(obj: Objective): number {
  if (obj.keyResults.length === 0) return 0
  const sum = obj.keyResults.reduce((s, kr) => s + kr.progress, 0)
  return Math.round(sum / obj.keyResults.length)
}

function rollUpConfidence(obj: Objective): Confidence {
  if (obj.keyResults.some((kr) => kr.confidence === 'off_track')) return 'off_track'
  if (obj.keyResults.some((kr) => kr.confidence === 'at_risk')) return 'at_risk'
  return 'on_track'
}

/* ── Edit handler bundle ──────────────────────────────────────────────────── */

type EditHandlers = {
  onCreateObjective: () => void
  onEditObjective: (objective: Objective) => void
  onDeleteObjective: (objective: Objective) => void
  onCreateKR: (objective: Objective) => void
  onEditKR: (objective: Objective, kr: KeyResult) => void
  onDeleteKR: (objective: Objective, kr: KeyResult) => void
}

/* ── OKRDashboard (the actual export) ─────────────────────────────────────── */

type DialogState =
  | { kind: 'none' }
  | { kind: 'objective'; mode: ObjectiveDialogMode }
  | { kind: 'kr'; mode: KeyResultDialogMode; objectiveId: string }
  | { kind: 'delete-objective'; objective: Objective }
  | { kind: 'delete-kr'; objective: Objective; kr: KeyResult }

export function OKRDashboard({
  objectives: incomingObjectives,
  defaultView = 'cards',
  editable = false,
  onObjectivesChange,
  handlers,
  onCheckinKR,
  className = '',
}: OKRDashboardProps) {
  const [view, setView] = useState<'cards' | 'matrix'>(defaultView)
  // Three modes:
  //   - read-only         (!editable)             → prop is source of truth
  //   - controlled edit   (editable + handlers)   → prop is source of truth,
  //                                                 caller persists mutations
  //   - uncontrolled edit (editable + !handlers)  → internal state takes over,
  //                                                 prop is initial value
  const controlled = editable && handlers !== undefined
  const [localObjectives, setLocalObjectives] = useState<Objective[]>(incomingObjectives)
  const objectives = editable && !controlled ? localObjectives : incomingObjectives
  const [dialog, setDialog] = useState<DialogState>({ kind: 'none' })

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

  const commit = (next: Objective[]) => {
    setLocalObjectives(next)
    onObjectivesChange?.(next)
  }

  /* CRUD ----------------------------------------------------------------- */

  const submitObjective = async (payload: ObjectiveFormPayload) => {
    if (dialog.kind !== 'objective') return
    if (controlled && handlers) {
      if (dialog.mode.kind === 'create') {
        await handlers.onCreateObjective(payload)
      } else {
        await handlers.onUpdateObjective(dialog.mode.objective.id, payload)
      }
    } else if (dialog.mode.kind === 'create') {
      commit([
        ...localObjectives,
        {
          id: freshId('okr-obj'),
          title: payload.title,
          description: payload.description || undefined,
          owner: payload.owner,
          keyResults: [],
        },
      ])
    } else {
      const editingId = dialog.mode.objective.id
      commit(
        localObjectives.map((o) =>
          o.id === editingId
            ? {
                ...o,
                title: payload.title,
                description: payload.description || undefined,
                owner: payload.owner,
              }
            : o,
        ),
      )
    }
    setDialog({ kind: 'none' })
  }

  const submitKR = async (payload: KeyResultFormPayload) => {
    if (dialog.kind !== 'kr') return
    const objectiveId = dialog.objectiveId
    if (controlled && handlers) {
      if (dialog.mode.kind === 'create') {
        await handlers.onCreateKR(objectiveId, payload)
      } else {
        await handlers.onUpdateKR(objectiveId, dialog.mode.kr.id, payload)
      }
    } else if (dialog.mode.kind === 'create') {
      commit(
        localObjectives.map((o) =>
          o.id === objectiveId
            ? {
                ...o,
                keyResults: [
                  ...o.keyResults,
                  { id: freshId('okr-kr'), ...payload },
                ],
              }
            : o,
        ),
      )
    } else {
      const editingKrId = dialog.mode.kr.id
      commit(
        localObjectives.map((o) =>
          o.id === objectiveId
            ? {
                ...o,
                keyResults: o.keyResults.map((kr) =>
                  kr.id === editingKrId ? { ...kr, ...payload } : kr,
                ),
              }
            : o,
        ),
      )
    }
    setDialog({ kind: 'none' })
  }

  const confirmDelete = async () => {
    if (dialog.kind === 'delete-objective') {
      if (controlled && handlers) {
        await handlers.onDeleteObjective(dialog.objective.id)
      } else {
        commit(localObjectives.filter((o) => o.id !== dialog.objective.id))
      }
    } else if (dialog.kind === 'delete-kr') {
      if (controlled && handlers) {
        await handlers.onDeleteKR(dialog.objective.id, dialog.kr.id)
      } else {
        commit(
          localObjectives.map((o) =>
            o.id === dialog.objective.id
              ? { ...o, keyResults: o.keyResults.filter((k) => k.id !== dialog.kr.id) }
              : o,
          ),
        )
      }
    }
    setDialog({ kind: 'none' })
  }

  const editHandlers: EditHandlers | undefined = editable
    ? {
        onCreateObjective: () =>
          setDialog({ kind: 'objective', mode: { kind: 'create' } }),
        onEditObjective: (objective) =>
          setDialog({ kind: 'objective', mode: { kind: 'edit', objective } }),
        onDeleteObjective: (objective) =>
          setDialog({ kind: 'delete-objective', objective }),
        onCreateKR: (objective) =>
          setDialog({
            kind: 'kr',
            mode: { kind: 'create', objectiveTitle: objective.title },
            objectiveId: objective.id,
          }),
        onEditKR: (objective, kr) =>
          setDialog({
            kind: 'kr',
            mode: { kind: 'edit', kr, objectiveTitle: objective.title },
            objectiveId: objective.id,
          }),
        onDeleteKR: (objective, kr) => setDialog({ kind: 'delete-kr', objective, kr }),
      }
    : undefined

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
        <div className="flex flex-wrap items-center gap-2">
          {editHandlers ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={<Plus className="size-3.5" />}
              onClick={editHandlers.onCreateObjective}
            >
              Nytt mål
            </Button>
          ) : null}
          <Tabs
            items={tabs}
            activeId={view}
            onChange={(id) => setView(id as 'cards' | 'matrix')}
          />
        </div>
      </div>

      {objectives.length === 0 ? (
        <Card className="px-6 py-12 text-center text-sm text-neutral-500">
          {editable ? (
            <>
              <p>Ingen mål definert ennå.</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Plus className="size-3.5" />}
                onClick={editHandlers?.onCreateObjective}
                className="mt-3"
              >
                Opprett ditt første mål
              </Button>
            </>
          ) : (
            'Ingen mål definert ennå.'
          )}
        </Card>
      ) : view === 'cards' ? (
        <CardsView objectives={objectives} handlers={editHandlers} onCheckin={onCheckinKR} />
      ) : (
        <MatrixView objectives={objectives} handlers={editHandlers} onCheckin={onCheckinKR} />
      )}

      {/* Dialogs */}
      <ObjectiveDialog
        open={dialog.kind === 'objective'}
        mode={dialog.kind === 'objective' ? dialog.mode : { kind: 'create' }}
        onClose={() => setDialog({ kind: 'none' })}
        onSubmit={submitObjective}
      />
      <KeyResultDialog
        open={dialog.kind === 'kr'}
        mode={
          dialog.kind === 'kr'
            ? dialog.mode
            : { kind: 'create', objectiveTitle: '' }
        }
        onClose={() => setDialog({ kind: 'none' })}
        onSubmit={submitKR}
      />
      <ConfirmDeleteDialog
        open={dialog.kind === 'delete-objective' || dialog.kind === 'delete-kr'}
        title={
          dialog.kind === 'delete-objective'
            ? 'Slett mål?'
            : dialog.kind === 'delete-kr'
              ? 'Slett key result?'
              : ''
        }
        body={
          dialog.kind === 'delete-objective' ? (
            <>
              Du sletter{' '}
              <span className="font-semibold text-neutral-900">
                «{dialog.objective.title}»
              </span>{' '}
              og alle {dialog.objective.keyResults.length} tilhørende KR. Handlingen
              kan ikke angres.
            </>
          ) : dialog.kind === 'delete-kr' ? (
            <>
              Du sletter{' '}
              <span className="font-semibold text-neutral-900">
                «{dialog.kr.title}»
              </span>{' '}
              fra «{dialog.objective.title}». Handlingen kan ikke angres.
            </>
          ) : null
        }
        confirmLabel={
          dialog.kind === 'delete-objective' ? 'Slett mål' : 'Slett KR'
        }
        onClose={() => setDialog({ kind: 'none' })}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

/* ── Cards view ───────────────────────────────────────────────────────────── */

function CardsView({
  objectives,
  handlers,
  onCheckin,
}: {
  objectives: Objective[]
  handlers?: EditHandlers
  onCheckin?: (objectiveId: string, krId: string) => void
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {objectives.map((o) => (
        <ObjectiveCard key={o.id} objective={o} handlers={handlers} onCheckin={onCheckin} />
      ))}
    </div>
  )
}

function ObjectiveCard({
  objective,
  handlers,
  onCheckin,
}: {
  objective: Objective
  handlers?: EditHandlers
  onCheckin?: (objectiveId: string, krId: string) => void
}) {
  const rollup = rollUpProgress(objective)
  const conf = rollUpConfidence(objective)
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-neutral-100 bg-[#FBF8F1] px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
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
          <div className="flex shrink-0 items-center gap-1">
            {handlers ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handlers.onEditObjective(objective)}
                  aria-label={`Rediger ${objective.title}`}
                  title="Rediger mål"
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handlers.onDeleteObjective(objective)}
                  aria-label={`Slett ${objective.title}`}
                  title="Slett mål"
                  className="hover:text-rose-600"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </>
            ) : null}
            <Avatar owner={objective.owner} />
          </div>
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
        {objective.keyResults.length === 0 ? (
          <li className="px-5 py-6 text-center text-xs text-neutral-500">
            Ingen key results enda.
          </li>
        ) : (
          objective.keyResults.map((kr) => (
            <li key={kr.id} className="group/kr px-5 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-medium text-neutral-900"
                    title={kr.title}
                  >
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
                <div className="flex shrink-0 items-center gap-1">
                  {kr.checkinSpark && kr.checkinSpark.length >= 2 ? (
                    <ConfidenceSparkline values={kr.checkinSpark} />
                  ) : null}
                  <ConfidenceBadge confidence={kr.confidence} />
                  {onCheckin ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onCheckin(objective.id, kr.id)}
                      aria-label={`Sjekk inn ${kr.title}`}
                      title="Sjekk inn"
                    >
                      <CheckCircle2 className="size-3.5" />
                    </Button>
                  ) : null}
                  {handlers ? (
                    <div className="opacity-0 transition-opacity group-hover/kr:opacity-100 focus-within:opacity-100">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handlers.onEditKR(objective, kr)}
                        aria-label={`Rediger ${kr.title}`}
                        title="Rediger KR"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handlers.onDeleteKR(objective, kr)}
                        aria-label={`Slett ${kr.title}`}
                        title="Slett KR"
                        className="hover:text-rose-600"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <Progress value={kr.progress} confidence={kr.confidence} size="sm" />
                <span className="font-mono text-xs font-semibold tabular-nums text-neutral-700">
                  {Math.round(kr.progress)}%
                </span>
              </div>
              {kr.progressNote ? (
                <p className="mt-1 text-[11px] text-neutral-500">{kr.progressNote}</p>
              ) : null}
              {kr.checkinHint ? (
                <p className="mt-1 text-[11px] font-medium text-amber-700">{kr.checkinHint}</p>
              ) : null}
            </li>
          ))
        )}
      </ul>

      <footer className="flex items-center justify-between gap-2 border-t border-neutral-100 bg-white px-5 py-2.5 text-[11px] text-neutral-500">
        <span>
          Eier · <span className="font-medium text-neutral-700">{objective.owner.name}</span>
        </span>
        {handlers ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<Plus className="size-3" />}
            onClick={() => handlers.onCreateKR(objective)}
          >
            Nytt KR
          </Button>
        ) : null}
      </footer>
    </Card>
  )
}

/* ── Matrix view (TanStack-style expandable table) ────────────────────────── */

const TH =
  'border-b border-neutral-200 bg-[#EFE8DC] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-600'
const TD = 'border-b border-neutral-100 px-4 py-3 text-sm text-neutral-800 align-middle'

function MatrixView({
  objectives,
  handlers,
  onCheckin,
}: {
  objectives: Objective[]
  handlers?: EditHandlers
  onCheckin?: (objectiveId: string, krId: string) => void
}) {
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
              <th className={`${TH} w-20 text-right`}>KR</th>
              <th className={`${TH} w-32`}>Tillit</th>
              <th className={TH}>Fremdrift</th>
              {handlers ? (
                <th className={`${TH} w-28 pr-5 text-right`} aria-label="Handlinger" />
              ) : null}
            </tr>
          </thead>
          <tbody>
            {objectives.map((o) => (
              <FragmentRow
                key={o.id}
                objective={o}
                isOpen={openIds.has(o.id)}
                onToggle={() => toggle(o.id)}
                handlers={handlers}
                onCheckin={onCheckin}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function FragmentRow({
  objective,
  isOpen,
  onToggle,
  handlers,
  onCheckin,
}: {
  objective: Objective
  isOpen: boolean
  onToggle: () => void
  handlers?: EditHandlers
  onCheckin?: (objectiveId: string, krId: string) => void
}) {
  const rollup = rollUpProgress(objective)
  const conf = rollUpConfidence(objective)
  const colSpan = handlers ? 7 : 6
  return (
    <>
      <tr
        className={`cursor-pointer transition ${isOpen ? 'bg-[#F7F4EE]' : 'hover:bg-neutral-50'}`}
        onClick={onToggle}
      >
        <td className={`${TD} pl-5`}>
          <Button
            type="button"
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
        <td className={TD}>
          <div className="flex items-center gap-2.5">
            <Progress value={rollup} confidence={conf} />
            <span className="w-10 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-neutral-700">
              {rollup}%
            </span>
          </div>
        </td>
        {handlers ? (
          <td className={`${TD} pr-5`}>
            <div
              className="flex items-center justify-end gap-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handlers.onCreateKR(objective)}
                aria-label="Legg til KR"
                title="Legg til KR"
              >
                <Plus className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handlers.onEditObjective(objective)}
                aria-label="Rediger mål"
                title="Rediger mål"
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handlers.onDeleteObjective(objective)}
                aria-label="Slett mål"
                title="Slett mål"
                className="hover:text-rose-600"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </td>
        ) : null}
      </tr>

      {isOpen ? (
        <>
          {objective.keyResults.map((kr) => (
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
                <div className="flex items-center gap-2">
                  <ConfidenceBadge confidence={kr.confidence} />
                  {kr.checkinSpark && kr.checkinSpark.length >= 2 ? (
                    <ConfidenceSparkline values={kr.checkinSpark} />
                  ) : null}
                </div>
              </td>
              <td className={TD}>
                <div className="flex items-center gap-2.5">
                  <Progress value={kr.progress} confidence={kr.confidence} size="sm" />
                  <span className="w-10 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-neutral-700">
                    {Math.round(kr.progress)}%
                  </span>
                </div>
                {kr.progressNote ? (
                  <p className="mt-1 text-[11px] text-neutral-500">{kr.progressNote}</p>
                ) : null}
                {kr.checkinHint ? (
                  <p className="mt-1 text-[11px] font-medium text-amber-700">{kr.checkinHint}</p>
                ) : null}
              </td>
              {handlers ? (
                <td className={`${TD} pr-5`}>
                  <div className="flex items-center justify-end gap-0.5">
                    {onCheckin ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onCheckin(objective.id, kr.id)}
                        aria-label="Sjekk inn"
                        title="Sjekk inn"
                      >
                        <CheckCircle2 className="size-3.5" />
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handlers.onEditKR(objective, kr)}
                      aria-label="Rediger KR"
                      title="Rediger KR"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handlers.onDeleteKR(objective, kr)}
                      aria-label="Slett KR"
                      title="Slett KR"
                      className="hover:text-rose-600"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
          {handlers ? (
            <tr className="bg-[#FBF8F1]/60">
              <td className={`${TD} pl-5`} />
              <td className={TD} colSpan={colSpan - 1}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<Plus className="size-3.5" />}
                  onClick={() => handlers.onCreateKR(objective)}
                >
                  Nytt KR
                </Button>
              </td>
            </tr>
          ) : null}
        </>
      ) : null}
    </>
  )
}
