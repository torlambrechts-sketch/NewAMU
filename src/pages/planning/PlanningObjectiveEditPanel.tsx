// PlanningObjectiveEditPanel — slide-over to edit one objective + its
// key results + see linked tasks (read-only here; full task edit happens
// in the task module). Add KR / open new task creation are wired through
// the ctrl callbacks.

import { useEffect, useMemo, useState } from 'react'
import { Plus, Target, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import { SlidePanel } from '../../components/layout/SlidePanel'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_ROW_GRID,
} from '../../components/layout/WorkplaceStandardFormPanel'
import { Initials } from '../../components/ui/elearningPrimitives'
import type { OkrHealth, OkrKeyResult, OkrObjectiveWithKrs, OkrPlanFull } from '../../types/planning'
import type { PlanningTaskRow } from '../../hooks/usePlanningTasks'
import type { UsePlanningOkrReturn } from '../../hooks/usePlanningOkr'
import { HEALTH_META, OWNER_OPTIONS, fmtNum, statusMetaFor } from './planningConstants'

type Props = {
  open: boolean
  onClose: () => void
  /** Live data — the panel reads the current objective from this prop
   *  on every render so KR add/remove via ctrl reflects immediately. */
  plan: OkrPlanFull
  objectiveId: string | null
  ctrl: UsePlanningOkrReturn
  tasks: PlanningTaskRow[]
  onCreateTaskForKr: (objectiveId: string, keyResultId: string) => void
}

export function PlanningObjectiveEditPanel({
  open,
  onClose,
  plan,
  objectiveId,
  ctrl,
  tasks,
  onCreateTaskForKr,
}: Props) {
  const obj = objectiveId ? plan.objectives.find((o) => o.id === objectiveId) ?? null : null

  // Local draft for the objective-level fields so the user can revise
  // without each keystroke firing a network request. Save on blur or
  // when Lagre is clicked.
  const [draft, setDraft] = useState<Partial<OkrObjectiveWithKrs> | null>(null)

  useEffect(() => {
    if (open && obj) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset form when panel opens for a different objective
      setDraft({
        ordLabel: obj.ordLabel,
        objective: obj.objective,
        why: obj.why,
        lawRef: obj.lawRef,
        ownerName: obj.ownerName,
        health: obj.health,
        progress: obj.progress,
      })
    } else if (!open) {
      setDraft(null)
    }
  }, [open, obj])

  const linkedTasks = useMemo(() => {
    if (!obj) return []
    return tasks.filter(
      (t) => t.okrKeyResultId && obj.keyResults.some((k) => k.id === t.okrKeyResultId),
    )
  }, [tasks, obj])

  if (!obj || !draft) {
    return (
      <SlidePanel
        open={open}
        onClose={onClose}
        titleId="planning-objective-edit-title"
        title="Mål"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>
              Lukk
            </Button>
          </div>
        }
      >
        <p className="text-sm text-neutral-500">Velg et mål for å redigere det.</p>
      </SlidePanel>
    )
  }

  const handleSave = async () => {
    await ctrl.updateObjective(obj.id, {
      ordLabel: draft.ordLabel,
      objective: draft.objective,
      why: draft.why,
      lawRef: draft.lawRef ?? undefined,
      ownerName: draft.ownerName ?? undefined,
      health: draft.health,
      progress: draft.progress,
    })
    onClose()
  }

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="planning-objective-edit-title"
      title={`Rediger ${obj.ordLabel}`}
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            onClick={async () => {
              if (window.confirm(`Slett mål ${obj.ordLabel}? Alle KR-er og koblinger fjernes også.`)) {
                await ctrl.removeObjective(obj.id)
                onClose()
              }
            }}
            className="text-red-700 hover:bg-red-50"
            icon={<Trash2 className="h-3.5 w-3.5" />}
          >
            Slett mål
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              Avbryt
            </Button>
            <Button variant="primary" onClick={handleSave}>
              Lagre
            </Button>
          </div>
        </div>
      }
    >
      <div className="-mx-6 -mt-8 sm:-mx-8">
        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Hva er målet?</p>
          <div className="space-y-3">
            <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-2">
              <div>
                <p className={WPSTD_FORM_FIELD_LABEL}>Kortform</p>
                <StandardInput
                  value={draft.ordLabel ?? ''}
                  onChange={(e) => setDraft({ ...draft, ordLabel: e.target.value })}
                  placeholder="O1"
                  className="mt-1.5 text-center font-mono"
                />
              </div>
              <div>
                <p className={WPSTD_FORM_FIELD_LABEL}>Status</p>
                {/* eslint-disable-next-line no-restricted-syntax */}
                <select
                  value={draft.health ?? 'on_track'}
                  onChange={(e) => setDraft({ ...draft, health: e.target.value as OkrHealth })}
                  className="mt-1.5 w-full rounded border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1a3d32]"
                >
                  {(Object.keys(HEALTH_META) as OkrHealth[]).map((k) => (
                    <option key={k} value={k}>
                      {HEALTH_META[k].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Målsetting</p>
              <StandardTextarea
                value={draft.objective ?? ''}
                onChange={(e) => setDraft({ ...draft, objective: e.target.value })}
                rows={2}
                className="mt-1.5"
              />
            </div>
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Hvorfor</p>
              <StandardTextarea
                value={draft.why ?? ''}
                onChange={(e) => setDraft({ ...draft, why: e.target.value })}
                rows={3}
                placeholder="Hvorfor er målet viktig? Hvilket problem løser det?"
                className="mt-1.5 italic"
              />
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Hvilket lovgrunnlag forankrer målet?</p>
          <div className="space-y-3">
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Lovreferanse</p>
              <StandardInput
                value={draft.lawRef ?? ''}
                onChange={(e) => setDraft({ ...draft, lawRef: e.target.value })}
                placeholder="AML § 3-1 — Systematisk HMS"
                className="mt-1.5 font-mono text-xs"
              />
            </div>
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Eier (rolle eller person)</p>
              {/* eslint-disable-next-line no-restricted-syntax */}
              <select
                value={draft.ownerName ?? ''}
                onChange={(e) => setDraft({ ...draft, ownerName: e.target.value })}
                className="mt-1.5 w-full rounded border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1a3d32]"
              >
                <option value="">—</option>
                {OWNER_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Framdrift (0–100 %)</p>
              <StandardInput
                type="number"
                min={0}
                max={100}
                value={Math.round((draft.progress ?? 0) * 100)}
                onChange={(e) => {
                  const n = Math.max(0, Math.min(100, Number(e.target.value) || 0))
                  setDraft({ ...draft, progress: n / 100 })
                }}
                className="mt-1.5 tabular-nums"
              />
            </div>
          </div>
        </div>

        {/* KR list — uses ctrl directly so changes persist immediately */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>
            Hvilke nøkkelresultater måler målet?
            <br />
            <span className="text-xs text-neutral-500">
              Endringer på KR-er lagres direkte. Lagre-knappen lagrer kun mål-feltene.
            </span>
          </p>
          <div className="space-y-2">
            {obj.keyResults.map((k, i) => (
              <KrEditRow
                key={k.id}
                k={k}
                index={i}
                onUpdate={(patch) => ctrl.updateKeyResult(k.id, patch)}
                onRemove={() => ctrl.removeKeyResult(k.id)}
                onCreateTask={() => onCreateTaskForKr(obj.id, k.id)}
              />
            ))}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => ctrl.addKeyResult(obj.id)}
              icon={<Plus className="h-3 w-3" />}
            >
              Nytt nøkkelresultat
            </Button>
          </div>
        </div>

        {/* Linked tasks — read-only summary */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>
            Hvilke oppgaver bidrar til målet?
            <br />
            <span className="text-xs text-neutral-500">
              Oppgaver knyttes ved opprettelse fra KR-radens «+»-knapp.
            </span>
          </p>
          <div className="space-y-1">
            {linkedTasks.length === 0 ? (
              <p className="text-[12.5px] italic text-neutral-500">
                Ingen oppgaver knyttet til {obj.ordLabel} ennå.
              </p>
            ) : (
              linkedTasks.map((t) => {
                const meta = statusMetaFor(t.status)
                return (
                  <div
                    key={t.id}
                    className="rounded border border-neutral-200 bg-white p-2 text-[12px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-neutral-900">{t.title}</span>
                      <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold ${meta.bg} ${meta.text}`}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-neutral-500">
                      <Initials name={t.ownerName ?? '—'} size={14} />
                      <span>{t.ownerName ?? '—'}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </SlidePanel>
  )
}

function KrEditRow({
  k,
  index,
  onUpdate,
  onRemove,
  onCreateTask,
}: {
  k: OkrKeyResult
  index: number
  onUpdate: (patch: Partial<OkrKeyResult>) => void
  onRemove: () => void
  onCreateTask: () => void
}) {
  const [local, setLocal] = useState(k)
  useEffect(() => {
    setLocal(k)
  }, [k])

  // Debounce text updates so the user can finish typing.
  useEffect(() => {
    if (local === k) return
    const same =
      local.kr === k.kr
      && local.unit === k.unit
      && local.target === k.target
      && local.currentValue === k.currentValue
      && local.confidence === k.confidence
      && local.invert === k.invert
      && local.ownerName === k.ownerName
    if (same) return
    const t = setTimeout(() => {
      onUpdate({
        kr: local.kr,
        unit: local.unit,
        target: local.target,
        currentValue: local.currentValue,
        confidence: local.confidence,
        invert: local.invert,
        ownerName: local.ownerName,
      })
    }, 350)
    return () => clearTimeout(t)
  }, [local, k, onUpdate])

  return (
    <div className="rounded border border-neutral-200 bg-white p-3">
      <div className="flex items-start gap-2">
        <span className="mt-1 shrink-0 font-mono text-[10px] font-bold tabular-nums text-neutral-500">
          KR{index + 1}
        </span>
        <StandardTextarea
          value={local.kr}
          onChange={(e) => setLocal({ ...local, kr: e.target.value })}
          rows={2}
          placeholder="Beskriv målbart utfall"
          className="flex-1 text-[12.5px]"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onCreateTask}
          title="Opprett oppgave for KR"
          aria-label="Opprett oppgave"
          className="text-[#1a3d32] hover:bg-[#e7efe9]"
        >
          <Target className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          title="Slett KR"
          aria-label="Slett KR"
          className="text-neutral-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">
        <div>
          <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">Nå</label>
          <StandardInput
            type="number"
            value={local.currentValue}
            onChange={(e) => setLocal({ ...local, currentValue: parseFloat(e.target.value) || 0 })}
            className="mt-0.5 px-2 py-1 text-[12px] tabular-nums"
          />
        </div>
        <div>
          <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">Mål</label>
          <StandardInput
            type="number"
            value={local.target}
            onChange={(e) => setLocal({ ...local, target: parseFloat(e.target.value) || 0 })}
            className="mt-0.5 px-2 py-1 text-[12px] tabular-nums"
          />
        </div>
        <div>
          <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">Enhet</label>
          <StandardInput
            value={local.unit}
            onChange={(e) => setLocal({ ...local, unit: e.target.value })}
            placeholder="%"
            className="mt-0.5 px-2 py-1 text-[12px]"
          />
        </div>
        <div>
          <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">Eier</label>
          {/* eslint-disable-next-line no-restricted-syntax */}
          <select
            value={local.ownerName ?? ''}
            onChange={(e) => setLocal({ ...local, ownerName: e.target.value })}
            className="mt-0.5 w-full rounded border border-neutral-200 bg-white px-2 py-1 text-[12px] outline-none focus:border-[#1a3d32]"
          >
            <option value="">—</option>
            {OWNER_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">Conf.</label>
          {/* eslint-disable-next-line no-restricted-syntax */}
          <select
            value={String(local.confidence)}
            onChange={(e) => setLocal({ ...local, confidence: parseFloat(e.target.value) })}
            className="mt-0.5 w-full rounded border border-neutral-200 bg-white px-2 py-1 text-[12px] outline-none focus:border-[#1a3d32]"
          >
            {[0.3, 0.5, 0.7, 0.85, 1.0].map((v) => (
              <option key={v} value={v}>
                {Math.round(v * 100)} %
              </option>
            ))}
          </select>
        </div>
      </div>
      <label className="mt-2 inline-flex items-center gap-1.5 text-[10px] text-neutral-600">
        <StandardInput
          type="checkbox"
          checked={local.invert}
          onChange={(e) => setLocal({ ...local, invert: e.target.checked })}
          className="h-3 w-3"
        />
        Lavere = bedre (f.eks. sykefravær)
      </label>
      {/* Progress preview */}
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full bg-[#1a3d32]"
            style={{
              width: `${
                Math.max(
                  0,
                  Math.min(
                    1,
                    local.invert
                      ? local.target / Math.max(local.currentValue, 0.01)
                      : local.currentValue / Math.max(local.target, 0.01),
                  ),
                ) * 100
              }%`,
            }}
          />
        </div>
        <span className="text-[10px] tabular-nums text-neutral-500">
          {fmtNum(local.currentValue)} / {fmtNum(local.target)} {local.unit}
        </span>
      </div>
    </div>
  )
}
