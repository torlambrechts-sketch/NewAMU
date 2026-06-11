// PlanningCreateTaskModal — creates a task_items row from the Planning page.
//
// Supports:
//   * Bind to an OKR key result (auto-creates an okr_task_links row)
//   * Optional recurrence (interval + stop date)
//   * Priority, due date, owner, project link

import { useEffect, useState } from 'react'
import { Plus, Repeat, X } from 'lucide-react'
import type { TaskItemPriority } from '../../types/task'
import type { OkrPlanFull } from '../../types/planning'
import { RECURRENCE_PRESETS, type RecurrencePresetId } from '../../types/planning'
import type { TaskProject } from '../../../modules/tasks/useTaskProjects'
import type { CreatePlanningTaskInput } from '../../hooks/usePlanningTasks'
import { useOrgMembers } from '../../hooks/useOrgMembers'
import { MemberPicker } from '../../components/people/MemberPicker'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'

type Props = {
  open: boolean
  onClose: () => void
  onCreate: (input: CreatePlanningTaskInput) => Promise<void>
  plan: OkrPlanFull | null
  projects: TaskProject[]
  /** Optional pre-fill: pin to specific OKR objective + KR. */
  prefill?: {
    objectiveId?: string
    keyResultId?: string
  }
}

export function PlanningCreateTaskModal({
  open,
  onClose,
  onCreate,
  plan,
  projects,
  prefill,
}: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskItemPriority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null)
  const [projectId, setProjectId] = useState('')
  const orgMembers = useOrgMembers()
  const [okrObjectiveId, setOkrObjectiveId] = useState<string>('')
  const [keyResultId, setKeyResultId] = useState<string>('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrencePreset, setRecurrencePreset] = useState<RecurrencePresetId>('quarterly')
  const [recurrenceIntervalDays, setRecurrenceIntervalDays] = useState<number>(90)
  const [recurrenceStopAt, setRecurrenceStopAt] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle('')
    setDescription('')
    setPriority('medium')
    setDueDate('')
    setOwnerName('')
    setOwnerUserId(null)
    setProjectId('')
    setOkrObjectiveId(prefill?.objectiveId ?? '')
    setKeyResultId(prefill?.keyResultId ?? '')
    setIsRecurring(false)
    setRecurrencePreset('quarterly')
    setRecurrenceIntervalDays(90)
    setRecurrenceStopAt('')
    setSubmitting(false)
  }, [open, prefill])

  useEffect(() => {
    if (!okrObjectiveId) {
      setKeyResultId('')
    } else if (plan) {
      const obj = plan.objectives.find((o) => o.id === okrObjectiveId)
      if (obj && !obj.keyResults.some((k) => k.id === keyResultId)) {
        setKeyResultId(obj.keyResults[0]?.id ?? '')
      }
    }
  }, [okrObjectiveId, plan, keyResultId])

  // Esc-to-close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const currentObjective = plan?.objectives.find((o) => o.id === okrObjectiveId)
  const okrKrs = currentObjective?.keyResults ?? []

  const canSubmit = title.trim().length > 0 && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim(),
        priority,
        dueDate: dueDate || undefined,
        ownerName: ownerName || undefined,
        ownerUserId: ownerUserId ?? undefined,
        projectId: projectId || undefined,
        keyResultId: keyResultId || undefined,
        recurrenceActive: isRecurring,
        recurrenceIntervalDays: isRecurring ? recurrenceIntervalDays : undefined,
        recurrenceStopAt: isRecurring && recurrenceStopAt ? recurrenceStopAt : undefined,
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Ny oppgave"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between border-b border-neutral-100 px-5 py-3">
          <div>
            <h3 className="font-serif text-lg font-bold text-neutral-900">Ny oppgave</h3>
            <p className="text-[11px] text-neutral-500">
              Opprett en oppgave i Planning. Knytt til OKR og sett opp som vedvarende rutine om
              ønskelig.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Lukk">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Tittel
            </span>
            <StandardInput
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Eks. Vernerunde Q3 — alle 6 lokasjoner"
              className="mt-1 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Beskrivelse
            </span>
            <StandardTextarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Hva skal gjøres?"
              className="mt-1 py-2 text-[12.5px]"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Prioritet
              </span>
              {/* eslint-disable-next-line no-restricted-syntax */}
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskItemPriority)}
                className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-[#1a3d32]"
              >
                <option value="critical">Kritisk</option>
                <option value="high">Høy</option>
                <option value="medium">Middels</option>
                <option value="low">Lav</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Frist
              </span>
              <StandardInput
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 py-1.5 text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Eier
              </span>
              <div className="mt-1">
                <MemberPicker
                  users={orgMembers}
                  value={{ userId: ownerUserId, name: ownerName }}
                  onChange={(v) => {
                    setOwnerUserId(v.userId)
                    setOwnerName(v.name)
                  }}
                  placeholder="Velg eier…"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Prosjekt (valgfri)
              </span>
              {/* eslint-disable-next-line no-restricted-syntax */}
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-[#1a3d32]"
              >
                <option value="">— Ingen —</option>
                {projects
                  .filter((p) => p.status === 'active')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          {plan && plan.objectives.length > 0 && (
            <div className="rounded-md border border-neutral-200 bg-[#fbf9f3]/40 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#1a3d32]">
                Knytt til OKR (valgfri)
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                    Mål
                  </span>
                  {/* eslint-disable-next-line no-restricted-syntax */}
                  <select
                    value={okrObjectiveId}
                    onChange={(e) => setOkrObjectiveId(e.target.value)}
                    className="mt-0.5 w-full rounded border border-neutral-200 bg-white px-2 py-1 text-[11.5px] outline-none focus:border-[#1a3d32]"
                  >
                    <option value="">— Ingen —</option>
                    {plan.objectives.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.ordLabel} — {o.objective.slice(0, 40)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                    Key result
                  </span>
                  {/* eslint-disable-next-line no-restricted-syntax */}
                  <select
                    value={keyResultId}
                    onChange={(e) => setKeyResultId(e.target.value)}
                    disabled={!okrObjectiveId || okrKrs.length === 0}
                    className="mt-0.5 w-full rounded border border-neutral-200 bg-white px-2 py-1 text-[11.5px] outline-none focus:border-[#1a3d32] disabled:bg-neutral-100"
                  >
                    <option value="">— Ingen —</option>
                    {okrKrs.map((k, i) => (
                      <option key={k.id} value={k.id}>
                        KR{i + 1} — {k.kr.slice(0, 40)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )}

          <div className="rounded-md border border-neutral-200 bg-white p-3">
            <label className="flex items-center gap-2">
              <StandardInput
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-neutral-900">
                <Repeat className="h-3 w-3 text-[#1a3d32]" />
                Gjør om til vedvarende rutine
              </span>
            </label>
            <p className="mt-1 ml-5 text-[11px] text-neutral-500">
              En ny oppgave opprettes automatisk hver gang denne fullføres — fortsetter til serien
              stoppes eller slutt-dato er passert.
            </p>
            {isRecurring && (
              <div className="mt-2 ml-5 grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                    Frekvens
                  </span>
                  {/* eslint-disable-next-line no-restricted-syntax */}
                  <select
                    value={recurrencePreset}
                    onChange={(e) => {
                      const v = e.target.value as RecurrencePresetId
                      setRecurrencePreset(v)
                      const def = RECURRENCE_PRESETS.find((p) => p.id === v)
                      if (def?.days != null) setRecurrenceIntervalDays(def.days)
                    }}
                    className="mt-0.5 w-full rounded border border-neutral-200 bg-white px-2 py-1 text-[11.5px] outline-none focus:border-[#1a3d32]"
                  >
                    {RECURRENCE_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                {recurrencePreset === 'custom' && (
                  <label className="block">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                      Dager mellom forekomster
                    </span>
                    <StandardInput
                      type="number"
                      min={1}
                      value={recurrenceIntervalDays}
                      onChange={(e) =>
                        setRecurrenceIntervalDays(Math.max(1, Number(e.target.value) || 1))
                      }
                      className="mt-0.5 py-1 text-[11.5px] tabular-nums"
                    />
                  </label>
                )}
                <label className="col-span-2 block">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                    Slutt-dato (valgfri — la stå blank for å kjøre inntil stoppet)
                  </span>
                  <StandardInput
                    type="date"
                    value={recurrenceStopAt}
                    onChange={(e) => setRecurrenceStopAt(e.target.value)}
                    className="mt-0.5 py-1 text-[11.5px] tabular-nums"
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-neutral-100 bg-neutral-50/40 px-5 py-3">
          <Button variant="ghost" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            onClick={() => {
              void handleSubmit()
            }}
            icon={<Plus className="h-3.5 w-3.5" />}
          >
            {submitting ? 'Oppretter…' : 'Opprett oppgave'}
          </Button>
        </footer>
      </div>
    </div>
  )
}
