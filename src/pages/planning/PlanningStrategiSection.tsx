// PlanningStrategiSection — Strategi & OKR tab (first section of /planlegging).
//
// Layout: hero with ambition + radial gauge, OKR-tile grid (4 columns),
// expanded objective panel with editable key results + linked tasks, and
// the RACI table.
//
// All edits flow through usePlanningOkr (optimistic UI + RLS-gated writes).

import { useMemo, useState } from 'react'
import {
  CalendarRange,
  Check,
  Clock,
  Crosshair,
  Pencil,
  Plus,
  Target,
  Trash2,
  UserCheck,
  UserCog,
  Wand2,
} from 'lucide-react'
import { Initials } from '../../components/ui/elearningPrimitives'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import type {
  OkrHealth,
  OkrKeyResult,
  OkrObjectiveWithKrs,
  OkrPlanFull,
} from '../../types/planning'
import type { PlanningTaskRow } from '../../hooks/usePlanningTasks'
import type { UsePlanningOkrReturn } from '../../hooks/usePlanningOkr'
import { HEALTH_META, OWNER_OPTIONS, PLANNING_ACCENT, fmtNum, statusMetaFor } from './planningConstants'

type Props = {
  plan: OkrPlanFull
  ctrl: UsePlanningOkrReturn
  tasks: PlanningTaskRow[]
  onCreateTaskForKr: (objectiveId: string, keyResultId: string) => void
}

export function PlanningStrategiSection({ plan, ctrl, tasks, onCreateTaskForKr }: Props) {
  const [openId, setOpenId] = useState<string | null>(plan.objectives[0]?.id ?? null)
  const [editing, setEditing] = useState(false)
  const [editPlanFields, setEditPlanFields] = useState(false)

  const overallProgress = useMemo(() => {
    const all = plan.objectives.flatMap((o) => o.keyResults)
    if (all.length === 0) return 0
    let sum = 0
    for (const k of all) {
      const ratio = k.invert
        ? Math.max(0, Math.min(1, k.target / Math.max(k.currentValue, 0.01)))
        : Math.min(1, k.currentValue / Math.max(k.target, 0.01))
      sum += ratio
    }
    return sum / all.length
  }, [plan.objectives])

  const totalKr = useMemo(
    () => plan.objectives.reduce((sum, o) => sum + o.keyResults.length, 0),
    [plan.objectives],
  )

  const taskCountTotal = tasks.length
  const openObjective = openId ? plan.objectives.find((o) => o.id === openId) : null

  return (
    <div className="space-y-5">
      {/* AMBISJON — hero */}
      <article className="overflow-hidden rounded-2xl border border-[#1a3d32]/15 bg-gradient-to-br from-[#fbf9f3] via-[#fbf9f3] to-[#e7efe9]/60 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="p-7">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#1a3d32]">
              <Target className="h-3 w-3" />
              <span>Ambisjon · forankret i</span>
              {editPlanFields ? (
                <StandardInput
                  value={plan.legalBasis ?? ''}
                  onChange={(e) => ctrl.updatePlan({ legalBasis: e.target.value })}
                  className="rounded border px-1.5 py-0.5 font-mono text-[10px]"
                />
              ) : (
                <span className="rounded bg-[#1a3d32]/10 px-1.5 py-0.5 font-mono">
                  {plan.legalBasis ?? '—'}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditPlanFields((v) => !v)}
                className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold text-[#1a3d32] hover:bg-[#1a3d32]/10"
              >
                {editPlanFields ? 'Ferdig' : 'Rediger ambisjon'}
              </Button>
            </div>
            {editPlanFields ? (
              <StandardInput
                value={plan.title}
                onChange={(e) => ctrl.updatePlan({ title: e.target.value })}
                className="mt-3 w-full rounded-md border-[#1a3d32]/30 bg-white/80 px-3 py-2 font-serif text-2xl font-bold leading-tight"
              />
            ) : (
              <h2 className="mt-3 font-serif text-2xl font-bold leading-tight text-neutral-900 md:text-[28px]">
                &laquo;{plan.title}&raquo;
              </h2>
            )}
            {editPlanFields ? (
              <StandardTextarea
                value={plan.description}
                onChange={(e) => ctrl.updatePlan({ description: e.target.value })}
                rows={3}
                className="mt-3 w-full max-w-2xl rounded-md bg-white/80 px-3 py-2 text-[14px] leading-relaxed text-neutral-700"
              />
            ) : (
              <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-neutral-700">
                {plan.description}
              </p>
            )}
            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-[12px] text-neutral-700 md:grid-cols-4">
              <div className="flex items-center gap-2">
                <UserCheck className="h-3.5 w-3.5 text-neutral-500" />
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500">Sponsor</div>
                  {editPlanFields ? (
                    <StandardInput
                      value={plan.sponsorName ?? ''}
                      onChange={(e) => ctrl.updatePlan({ sponsorName: e.target.value })}
                      placeholder="Navn"
                      className="border-0 bg-transparent p-0 font-semibold text-neutral-900 focus:ring-0"
                    />
                  ) : (
                    <div className="font-semibold text-neutral-900">{plan.sponsorName || '—'}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <UserCog className="h-3.5 w-3.5 text-neutral-500" />
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500">Fasilitator</div>
                  {editPlanFields ? (
                    <StandardInput
                      value={plan.facilitatorName ?? ''}
                      onChange={(e) => ctrl.updatePlan({ facilitatorName: e.target.value })}
                      placeholder="Navn"
                      className="border-0 bg-transparent p-0 font-semibold text-neutral-900 focus:ring-0"
                    />
                  ) : (
                    <div className="font-semibold text-neutral-900">{plan.facilitatorName || '—'}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CalendarRange className="h-3.5 w-3.5 text-neutral-500" />
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500">Horisont</div>
                  {editPlanFields ? (
                    <StandardInput
                      value={plan.horizon ?? ''}
                      onChange={(e) => ctrl.updatePlan({ horizon: e.target.value })}
                      placeholder="2026 → 2027"
                      className="border-0 bg-transparent p-0 font-semibold text-neutral-900 focus:ring-0"
                    />
                  ) : (
                    <div className="font-semibold text-neutral-900">{plan.horizon || '—'}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-neutral-500" />
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500">Sist oppdatert</div>
                  <div className="font-semibold tabular-nums text-neutral-900">
                    {new Date(plan.updatedAt).toLocaleDateString('nb-NO', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Gauge */}
          <div className="flex flex-col items-center justify-center border-t border-[#1a3d32]/10 bg-white/40 p-7 lg:border-l lg:border-t-0">
            <RadialGauge value={overallProgress} />
            <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Samlet OKR-framdrift
            </p>
            <div className="mt-2 grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-base font-bold tabular-nums text-neutral-900">
                  {plan.objectives.length}
                </div>
                <div className="text-[9px] uppercase tracking-wider text-neutral-500">Mål</div>
              </div>
              <div>
                <div className="text-base font-bold tabular-nums text-neutral-900">{totalKr}</div>
                <div className="text-[9px] uppercase tracking-wider text-neutral-500">KR</div>
              </div>
              <div>
                <div className="text-base font-bold tabular-nums text-neutral-900">
                  {taskCountTotal}
                </div>
                <div className="text-[9px] uppercase tracking-wider text-neutral-500">Oppgaver</div>
              </div>
            </div>
          </div>
        </div>
      </article>

      {/* OKR-tre */}
      <div className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-neutral-900">OKR-tre</h3>
            <p className="text-[11px] text-neutral-500">
              {plan.objectives.length} mål forankret i Arbeidsmiljøloven. Klikk et mål for å åpne key
              results og tilknyttede oppgaver.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[10px]">
            {(Object.entries(HEALTH_META) as Array<[OkrHealth, (typeof HEALTH_META)[OkrHealth]]>).map(
              ([k, v]) => (
                <span key={k} className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: v.dot }} />
                  {v.label}
                </span>
              ),
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing((v) => !v)}
              className={[
                'ml-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold',
                editing
                  ? 'bg-[#1a3d32] text-white hover:bg-[#14312a] hover:text-white'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200/70',
              ].join(' ')}
              icon={editing ? <Check className="h-2.5 w-2.5" /> : <Pencil className="h-2.5 w-2.5" />}
            >
              {editing ? 'Ferdig' : 'Rediger'}
            </Button>
            {editing && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => ctrl.addObjective()}
                icon={<Plus className="h-3 w-3" />}
              >
                Nytt mål
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
          {plan.objectives.map((o) => (
            <ObjectiveTile
              key={o.id}
              o={o}
              open={openId === o.id}
              editing={editing}
              onOpen={() => setOpenId(o.id)}
              onUpdate={(patch) => ctrl.updateObjective(o.id, patch)}
            />
          ))}
        </div>

        {openObjective && (
          <ObjectiveDetail
            o={openObjective}
            editing={editing}
            tasks={tasks}
            onUpdateObjective={(patch) => ctrl.updateObjective(openObjective.id, patch)}
            onRemoveObjective={() => ctrl.removeObjective(openObjective.id)}
            onAddKr={() => ctrl.addKeyResult(openObjective.id)}
            onUpdateKr={(kid, patch) => ctrl.updateKeyResult(kid, patch)}
            onRemoveKr={(kid) => ctrl.removeKeyResult(kid)}
            onCreateTaskForKr={(krId) => onCreateTaskForKr(openObjective.id, krId)}
          />
        )}
      </div>

      {/* RACI */}
      <RaciSection plan={plan} ctrl={ctrl} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ObjectiveTile({
  o,
  open,
  editing,
  onOpen,
  onUpdate,
}: {
  o: OkrObjectiveWithKrs
  open: boolean
  editing: boolean
  onOpen: () => void
  onUpdate: (patch: { health?: OkrHealth }) => void
}) {
  return (
    <Button
      variant="ghost"
      onClick={onOpen}
      className={[
        'block w-full rounded-lg border p-4 text-left font-normal normal-case transition-all',
        open
          ? 'border-[#1a3d32] bg-[#e7efe9]/40 shadow-md hover:bg-[#e7efe9]/50'
          : 'border-neutral-200/80 bg-white hover:border-[#1a3d32]/40 hover:bg-white',
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <span className="rounded bg-[#1a3d32] px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white">
          {o.ordLabel}
        </span>
        {editing ? (
          // eslint-disable-next-line no-restricted-syntax
          <select
            value={o.health}
            onChange={(e) => {
              onUpdate({ health: e.target.value as OkrHealth })
            }}
            onClick={(e) => e.stopPropagation()}
            className={[
              'rounded px-1 py-0.5 text-[9px] font-bold uppercase outline-none',
              HEALTH_META[o.health].bg,
              HEALTH_META[o.health].text,
            ].join(' ')}
          >
            {(Object.keys(HEALTH_META) as OkrHealth[]).map((k) => (
              <option key={k} value={k}>
                {HEALTH_META[k].label}
              </option>
            ))}
          </select>
        ) : (
          <span
            className={[
              'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase',
              HEALTH_META[o.health].bg,
              HEALTH_META[o.health].text,
            ].join(' ')}
          >
            {HEALTH_META[o.health].label}
          </span>
        )}
      </div>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-[#1a3d32]">
        {o.lawRef || '—'}
      </p>
      <h4 className="mt-1 text-[13.5px] font-semibold leading-snug text-neutral-900">
        {o.objective}
      </h4>
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-neutral-500">Framdrift</span>
          <span
            className="font-bold tabular-nums"
            style={{ color: HEALTH_META[o.health].dot }}
          >
            {Math.round(o.progress * 100)}%
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full"
            style={{ width: `${o.progress * 100}%`, background: HEALTH_META[o.health].dot }}
          />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 border-t border-neutral-100 pt-2 text-[10px] text-neutral-500">
        <Initials name={o.ownerName ?? '—'} size={16} />
        <span className="truncate">{o.ownerName ?? '—'}</span>
        <span className="ml-auto inline-flex items-center gap-0.5">
          <Crosshair className="h-2.5 w-2.5" />
          {o.keyResults.length} KR
        </span>
      </div>
    </Button>
  )
}

function ObjectiveDetail({
  o,
  editing,
  tasks,
  onUpdateObjective,
  onRemoveObjective,
  onAddKr,
  onUpdateKr,
  onRemoveKr,
  onCreateTaskForKr,
}: {
  o: OkrObjectiveWithKrs
  editing: boolean
  tasks: PlanningTaskRow[]
  onUpdateObjective: (patch: Parameters<UsePlanningOkrReturn['updateObjective']>[1]) => void
  onRemoveObjective: () => void
  onAddKr: () => void
  onUpdateKr: (kid: string, patch: Parameters<UsePlanningOkrReturn['updateKeyResult']>[1]) => void
  onRemoveKr: (kid: string) => void
  onCreateTaskForKr: (krId: string) => void
}) {
  const linkedTasks = useMemo(
    () => tasks.filter((t) => t.okrKeyResultId && o.keyResults.some((k) => k.id === t.okrKeyResultId)),
    [tasks, o.keyResults],
  )

  return (
    <div className="border-t border-neutral-100 bg-[#fbf9f3]/40 p-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="rounded bg-[#1a3d32] px-2 py-0.5 text-[11px] font-bold tracking-wider text-white">
              {o.ordLabel}
            </span>
            {editing ? (
              <StandardInput
                value={o.objective}
                onChange={(e) => onUpdateObjective({ objective: e.target.value })}
                className="flex-1 rounded border px-2 py-1 font-serif text-lg font-bold"
              />
            ) : (
              <h4 className="font-serif text-lg font-bold text-neutral-900">{o.objective}</h4>
            )}
            {editing && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onRemoveObjective}
                title="Slett mål"
                className="ml-auto text-neutral-400 hover:bg-red-50 hover:text-red-600"
                aria-label="Slett mål"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          {editing && (
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                  Lovgrunnlag
                </label>
                <StandardInput
                  value={o.lawRef ?? ''}
                  onChange={(e) => onUpdateObjective({ lawRef: e.target.value })}
                  className="mt-0.5 px-2 py-1 text-[11px]"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                  Eier
                </label>
                {/* eslint-disable-next-line no-restricted-syntax */}
                <select
                  value={o.ownerName ?? ''}
                  onChange={(e) => onUpdateObjective({ ownerName: e.target.value })}
                  className="mt-0.5 w-full rounded border border-neutral-200 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-900 outline-none focus:border-[#1a3d32]"
                >
                  <option value="">—</option>
                  {OWNER_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {editing ? (
            <StandardTextarea
              value={o.why}
              onChange={(e) => onUpdateObjective({ why: e.target.value })}
              rows={2}
              placeholder="Hvorfor er målet viktig?"
              className="mt-2 w-full rounded border px-2 py-1 text-[12.5px] italic text-neutral-700"
            />
          ) : (
            <p className="mt-1 max-w-3xl text-[12.5px] italic leading-relaxed text-neutral-700">
              {o.why ? `“${o.why}”` : null}
            </p>
          )}

          <div className="mt-5 flex items-center justify-between">
            <h5 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Key results ({o.keyResults.length})
            </h5>
            {editing && (
              <Button
                variant="primary"
                size="sm"
                onClick={onAddKr}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold"
                icon={<Plus className="h-2.5 w-2.5" />}
              >
                Legg til KR
              </Button>
            )}
          </div>
          <ul className="mt-2 space-y-2">
            {o.keyResults.map((k, i) => (
              <KrRow
                key={k.id}
                k={k}
                health={o.health}
                index={i}
                editing={editing}
                onUpdate={(patch) => onUpdateKr(k.id, patch)}
                onRemove={() => onRemoveKr(k.id)}
                onCreateTask={() => onCreateTaskForKr(k.id)}
              />
            ))}
            {o.keyResults.length === 0 && (
              <li className="rounded-md border border-dashed border-neutral-200 px-3 py-4 text-center text-[11px] italic text-neutral-500">
                Ingen nøkkelresultater ennå. {editing ? 'Klikk «Legg til KR» for å starte.' : ''}
              </li>
            )}
          </ul>
        </div>

        {/* Aside — linked tasks + next check-in */}
        <aside className="space-y-3">
          <div className="rounded-md border border-neutral-200/80 bg-white p-3">
            <div className="flex items-center justify-between">
              <h5 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Tilknyttede oppgaver ({linkedTasks.length})
              </h5>
            </div>
            {linkedTasks.length === 0 ? (
              <p className="mt-2 text-[11px] italic text-neutral-500">
                Ingen oppgaver knyttet til {o.ordLabel} ennå.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {linkedTasks.map((t) => {
                  const meta = statusMetaFor(t.status)
                  return (
                    <li
                      key={t.id}
                      className="rounded border border-neutral-200/80 p-2 text-[11px]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-neutral-900">{t.title}</span>
                        <span
                          className={[
                            'shrink-0 rounded px-1 py-0.5 text-[9px] font-bold',
                            meta.bg,
                            meta.text,
                          ].join(' ')}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-neutral-500">
                        <Initials name={t.ownerName ?? '—'} size={14} />
                        <span className="truncate">{t.ownerName ?? '—'}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div className="rounded-md border border-[#1a3d32]/30 bg-white p-3">
            <h5 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Neste check-in
            </h5>
            <div className="mt-2 flex items-center gap-2">
              <span className="flex h-9 w-9 flex-col items-center justify-center rounded-md bg-[#1a3d32] text-white">
                <span className="text-[8px] font-bold uppercase">
                  {new Date().toLocaleDateString('nb-NO', { month: 'short' }).toUpperCase()}
                </span>
                <span className="text-sm font-bold tabular-nums">
                  {new Date().getDate()}
                </span>
              </span>
              <div className="text-[11px]">
                <div className="font-semibold text-neutral-900">AMU + ledergruppe</div>
                <div className="text-neutral-500">14:00 · 60 min</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function KrRow({
  k,
  health,
  index,
  editing,
  onUpdate,
  onRemove,
  onCreateTask,
}: {
  k: OkrKeyResult
  health: OkrHealth
  index: number
  editing: boolean
  onUpdate: (patch: Parameters<UsePlanningOkrReturn['updateKeyResult']>[1]) => void
  onRemove: () => void
  onCreateTask: () => void
}) {
  const ratio = k.invert
    ? Math.max(0, Math.min(1, k.target / Math.max(k.currentValue, 0.01)))
    : Math.min(1, k.currentValue / Math.max(k.target, 0.01))
  const conf = k.confidence
  const confColor = conf >= 0.7 ? '#2f7757' : conf >= 0.5 ? '#c98a2b' : '#b3382a'

  return (
    <li className="rounded-md border border-neutral-200/80 bg-white p-3">
      {!editing ? (
        <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[40px_minmax(0,1fr)_140px_90px_32px]">
          <span className="text-center font-mono text-[10px] font-bold tabular-nums text-neutral-500">
            KR{index + 1}
          </span>
          <div className="min-w-0">
            <div className="text-[12.5px] font-medium text-neutral-900">{k.kr}</div>
            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-neutral-500">
              <Initials name={k.ownerName ?? '—'} size={14} />
              <span>{k.ownerName ?? '—'}</span>
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1 text-[12px]">
              <span className="font-bold tabular-nums text-neutral-900">
                {fmtNum(k.currentValue)}
              </span>
              <span className="tabular-nums text-neutral-400">/ {fmtNum(k.target)}</span>
              <span className="text-[10px] text-neutral-500">{k.unit}</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full"
                style={{ width: `${ratio * 100}%`, background: HEALTH_META[health].dot }}
              />
            </div>
          </div>
          <div className="text-center">
            <div
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold"
              style={{ background: confColor + '20', color: confColor }}
            >
              <span className="tabular-nums">{Math.round(conf * 100)}%</span>
              <span>conf.</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCreateTask}
            title="Opprett oppgave"
            className="text-neutral-400 hover:bg-[#e7efe9] hover:text-[#1a3d32]"
            aria-label="Opprett oppgave"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="mt-1 shrink-0 font-mono text-[10px] font-bold tabular-nums text-neutral-500">
              KR{index + 1}
            </span>
            <StandardTextarea
              value={k.kr}
              onChange={(e) => onUpdate({ kr: e.target.value })}
              rows={2}
              className="flex-1 rounded border px-2 py-1 text-[12.5px]"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemove}
              title="Slett KR"
              className="mt-1 shrink-0 text-neutral-400 hover:bg-red-50 hover:text-red-600"
              aria-label="Slett KR"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 pl-6 md:grid-cols-5">
            <NumField
              label="Nå"
              value={k.currentValue}
              onChange={(v) => onUpdate({ currentValue: v })}
            />
            <NumField label="Mål" value={k.target} onChange={(v) => onUpdate({ target: v })} />
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                Enhet
              </label>
              <StandardInput
                value={k.unit}
                onChange={(e) => onUpdate({ unit: e.target.value })}
                className="mt-0.5 px-1.5 py-0.5 text-[11px]"
              />
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                Eier
              </label>
              {/* eslint-disable-next-line no-restricted-syntax */}
              <select
                value={k.ownerName ?? ''}
                onChange={(e) => onUpdate({ ownerName: e.target.value })}
                className="mt-0.5 w-full rounded border border-neutral-200 bg-white px-1 py-0.5 text-[11px] outline-none focus:border-[#1a3d32]"
              >
                <option value="">—</option>
                {OWNER_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                Conf.
              </label>
              {/* eslint-disable-next-line no-restricted-syntax */}
              <select
                value={String(k.confidence)}
                onChange={(e) => onUpdate({ confidence: parseFloat(e.target.value) })}
                className="mt-0.5 w-full rounded border border-neutral-200 bg-white px-1 py-0.5 text-[11px] outline-none focus:border-[#1a3d32]"
              >
                {[0.3, 0.5, 0.7, 0.85, 1.0].map((v) => (
                  <option key={v} value={v}>
                    {Math.round(v * 100)}%
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="pl-6">
            <label className="inline-flex items-center gap-1.5 text-[10px] text-neutral-600">
              <StandardInput
                type="checkbox"
                checked={k.invert}
                onChange={(e) => onUpdate({ invert: e.target.checked })}
                className="h-3 w-3"
              />
              Lavere = bedre (f.eks. sykefravær)
            </label>
          </div>
        </div>
      )}
    </li>
  )
}

function RaciSection({ plan, ctrl }: { plan: OkrPlanFull; ctrl: UsePlanningOkrReturn }) {
  const [editing, setEditing] = useState(false)
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-100 px-5 py-4">
        <div>
          <h3 className="font-serif text-lg font-bold text-neutral-900">
            Hvem er involvert · RACI
          </h3>
          <p className="text-[11px] text-neutral-500">
            Roller og ansvar i strategi-arbeidet. Følger AML § 3-1 om medvirkning og linjeansvar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <RaciLegend k="R" label="Responsible — utfører" color="#1a3d32" />
          <RaciLegend k="A" label="Accountable — eier" color="#c98a2b" />
          <RaciLegend k="C" label="Consulted — konsultert" color="#6366F1" />
          <RaciLegend k="I" label="Informed — informert" color="#737373" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing((v) => !v)}
            className={[
              'ml-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold',
              editing
                ? 'bg-[#1a3d32] text-white hover:bg-[#14312a] hover:text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200/70',
            ].join(' ')}
            icon={editing ? <Check className="h-2.5 w-2.5" /> : <Pencil className="h-2.5 w-2.5" />}
          >
            {editing ? 'Ferdig' : 'Rediger'}
          </Button>
          {editing && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => ctrl.addRaci()}
              icon={<Plus className="h-3 w-3" />}
            >
              Ny rad
            </Button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50/60">
            <tr>
              <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Rolle
              </th>
              <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Person / antall
              </th>
              <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                R
              </th>
              <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                A
              </th>
              <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                C
              </th>
              <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                I
              </th>
              {editing && <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-neutral-500" />}
            </tr>
          </thead>
          <tbody>
            {plan.raci.map((r) => (
              <tr key={r.id} className="border-t border-neutral-100 hover:bg-neutral-50/40">
                <td className="px-5 py-2.5 font-medium text-neutral-900">
                  {editing ? (
                    <StandardInput
                      value={r.roleLabel}
                      onChange={(e) => ctrl.updateRaci(r.id, { roleLabel: e.target.value })}
                      className="w-full rounded border px-2 py-1 text-[12px]"
                    />
                  ) : (
                    r.roleLabel
                  )}
                </td>
                <td className="px-5 py-2.5 text-[12px] text-neutral-700">
                  {editing ? (
                    <StandardInput
                      value={r.personLabel ?? ''}
                      onChange={(e) => ctrl.updateRaci(r.id, { personLabel: e.target.value })}
                      placeholder="—"
                      className="w-full rounded border px-2 py-1 text-[11.5px]"
                    />
                  ) : (
                    r.personLabel || '—'
                  )}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <RaciCell
                    on={r.isResponsible}
                    k="R"
                    color="#1a3d32"
                    editing={editing}
                    onToggle={() => ctrl.updateRaci(r.id, { isResponsible: !r.isResponsible })}
                  />
                </td>
                <td className="px-3 py-2.5 text-center">
                  <RaciCell
                    on={r.isAccountable}
                    k="A"
                    color="#c98a2b"
                    editing={editing}
                    onToggle={() => ctrl.updateRaci(r.id, { isAccountable: !r.isAccountable })}
                  />
                </td>
                <td className="px-3 py-2.5 text-center">
                  <RaciCell
                    on={r.isConsulted}
                    k="C"
                    color="#6366F1"
                    editing={editing}
                    onToggle={() => ctrl.updateRaci(r.id, { isConsulted: !r.isConsulted })}
                  />
                </td>
                <td className="px-3 py-2.5 text-center">
                  <RaciCell
                    on={r.isInformed}
                    k="I"
                    color="#737373"
                    editing={editing}
                    onToggle={() => ctrl.updateRaci(r.id, { isInformed: !r.isInformed })}
                  />
                </td>
                {editing && (
                  <td className="px-3 py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => ctrl.removeRaci(r.id)}
                      title="Slett rad"
                      className="text-neutral-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Slett rad"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
            {plan.raci.length === 0 && (
              <tr>
                <td colSpan={editing ? 7 : 6} className="px-5 py-6 text-center text-[12px] italic text-neutral-500">
                  Ingen RACI-rader ennå.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RaciLegend({ k, label, color }: { k: string; label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
        style={{ background: color }}
      >
        {k}
      </span>
      <span className="text-neutral-600">{label}</span>
    </span>
  )
}

function RaciCell({
  on,
  k,
  color,
  editing,
  onToggle,
}: {
  on: boolean
  k: string
  color: string
  editing: boolean
  onToggle: () => void
}) {
  const cell = on ? (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ background: color }}
    >
      {k}
    </span>
  ) : (
    <span className="text-neutral-300">·</span>
  )
  if (!editing) return cell
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onToggle}
      title={`Toggle ${k}`}
      className="cursor-pointer hover:bg-neutral-100"
      aria-label={`Toggle ${k}`}
    >
      {cell}
    </Button>
  )
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">{label}</label>
      <StandardInput
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="mt-0.5 px-1.5 py-0.5 text-[11px] tabular-nums"
      />
    </div>
  )
}

function RadialGauge({ value }: { value: number }) {
  const r = 56
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, value))
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#e3ddcc" strokeWidth="10" />
      <circle
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke={PLANNING_ACCENT}
        strokeWidth="10"
        strokeDasharray={`${c * pct} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 70 70)"
      />
      <text
        x="70"
        y="74"
        textAnchor="middle"
        style={{ fontSize: 28, fontWeight: 700, fill: PLANNING_ACCENT }}
      >
        {Math.round(pct * 100)}%
      </text>
      <Wand2 className="hidden" />
    </svg>
  )
}
