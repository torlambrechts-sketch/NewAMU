import { useCallback, useMemo, useState } from 'react'
import { GripVertical, Plus, Split, Trash2, Workflow } from 'lucide-react'
import type { WorkflowAction, WorkflowCondition } from '../../types/workflow'
import {
  defaultWorkflowFlowDocument,
  newBranchId,
  newFlowStepId,
  type WorkflowFlowDocument,
  type WorkflowFlowStep,
} from '../../lib/workflowFlowTypes'

const R = 'rounded-none'
const BTN =
  'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 border px-3 text-sm font-medium leading-none'
const CARD = `${R} border border-neutral-200 bg-white p-3 text-sm shadow-sm`

const INPUT_PRESETS: { label: string; module: string; condition: WorkflowCondition }[] = [
  { label: 'Alltid (alle lagringer)', module: '*', condition: { match: 'always' } },
  {
    label: 'HSE: kritisk hendelse i liste',
    module: 'hse',
    condition: { match: 'array_any', path: 'incidents', where: { severity: 'critical' } },
  },
  {
    label: 'HSE: høy alvor i liste',
    module: 'hse',
    condition: { match: 'array_any', path: 'incidents', where: { severity: 'high' } },
  },
  {
    label: 'Oppgaver: felt lik verdi',
    module: 'tasks',
    condition: { match: 'field_equals', path: 'tasks.0.status', value: 'done' },
  },
]

function defaultTaskAction(): WorkflowAction {
  return {
    type: 'create_task',
    title: 'Oppfølgingsoppgave',
    description: 'Automatisert fra arbeidsflyt',
    assignee: 'HMS',
    dueInDays: 7,
    module: 'hse',
    sourceType: 'manual',
    requiresManagementSignOff: false,
  }
}

type DragPayload =
  | { kind: 'palette_condition'; condition: WorkflowCondition; label: string }
  | { kind: 'palette_actions' }
  | { kind: 'reorder'; stepId: string; branchId?: string }

function readDrag(e: React.DragEvent): DragPayload | null {
  try {
    const raw = e.dataTransfer.getData('application/x-atics-workflow')
    if (!raw) return null
    return JSON.parse(raw) as DragPayload
  } catch {
    return null
  }
}

function StepCard({
  step,
  selected,
  onSelect,
  onDelete,
}: {
  step: WorkflowFlowStep
  selected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect()
      }}
      className={`${CARD} flex cursor-pointer items-start gap-2 ${selected ? 'ring-2 ring-[#1a3d32]' : ''}`}
    >
      <span className="mt-0.5 cursor-grab text-neutral-400 active:cursor-grabbing" title="Dra for å flytte">
        <GripVertical className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-neutral-900">
          {step.kind === 'condition' ? 'Betingelse' : 'Handlinger'}
          {step.label ? <span className="ml-2 text-xs font-normal text-neutral-500">({step.label})</span> : null}
        </div>
        <div className="mt-1 text-xs text-neutral-600">
          {step.kind === 'condition' ? (
            <code className="break-all">{JSON.stringify(step.condition)}</code>
          ) : (
            <span>{step.actions.length} handling(er)</span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className={`${R} p-1 text-neutral-400 hover:bg-red-50 hover:text-red-700`}
        aria-label="Slett"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  )
}

function ConditionEditor({
  value,
  onChange,
}: {
  value: WorkflowCondition
  onChange: (c: WorkflowCondition) => void
}) {
  const m = value.match
  return (
    <div className="space-y-3 text-sm">
      <label className="block">
        <span className="text-xs font-semibold text-neutral-600">Match-type</span>
        <select
          value={m}
          onChange={(e) => {
            const v = e.target.value
            if (v === 'always') onChange({ match: 'always' })
            if (v === 'field_equals') onChange({ match: 'field_equals', path: '', value: '' })
            if (v === 'array_any') onChange({ match: 'array_any', path: '', where: {} })
          }}
          className={`${R} mt-1 w-full border border-neutral-300 bg-white px-2 py-2`}
        >
          <option value="always">Alltid</option>
          <option value="field_equals">Felt lik verdi (JSON-sti)</option>
          <option value="array_any">Array: minst ett element matcher</option>
        </select>
      </label>
      {m === 'field_equals' && (
        <>
          <label className="block">
            <span className="text-xs text-neutral-600">Sti (punktum, f.eks. incidents.0.severity)</span>
            <input
              value={'path' in value ? value.path : ''}
              onChange={(e) => onChange({ ...value, path: e.target.value } as WorkflowCondition)}
              className={`${R} mt-1 w-full border border-neutral-300 px-2 py-2 font-mono text-xs`}
            />
          </label>
          <label className="block">
            <span className="text-xs text-neutral-600">Verdi (tekst)</span>
            <input
              value={'value' in value ? value.value : ''}
              onChange={(e) => onChange({ ...value, value: e.target.value } as WorkflowCondition)}
              className={`${R} mt-1 w-full border border-neutral-300 px-2 py-2`}
            />
          </label>
        </>
      )}
      {m === 'array_any' && (
        <>
          <label className="block">
            <span className="text-xs text-neutral-600">Sti til array</span>
            <input
              value={'path' in value ? value.path : ''}
              onChange={(e) => onChange({ ...value, path: e.target.value } as WorkflowCondition)}
              className={`${R} mt-1 w-full border border-neutral-300 px-2 py-2 font-mono text-xs`}
              placeholder="incidents"
            />
          </label>
          <label className="block">
            <span className="text-xs text-neutral-600">where (JSON-objekt)</span>
            <textarea
              value={JSON.stringify('where' in value ? value.where : {}, null, 0)}
              onChange={(e) => {
                try {
                  const w = JSON.parse(e.target.value) as Record<string, unknown>
                  onChange({ ...value, where: w } as WorkflowCondition)
                } catch {
                  /* ignore */
                }
              }}
              rows={3}
              className={`${R} mt-1 w-full border border-neutral-300 px-2 py-2 font-mono text-xs`}
            />
          </label>
        </>
      )}
    </div>
  )
}

type WorkflowActionCreateTask = Extract<WorkflowAction, { type: 'create_task' }>

function ActionsEditor({
  actions,
  onChange,
}: {
  actions: WorkflowAction[]
  onChange: (a: WorkflowAction[]) => void
}) {
  const first = actions[0]
  if (!first || first.type !== 'create_task') {
    return (
      <p className="text-xs text-neutral-500">
        Kun redigering av første «create_task»-handling i byggeren. Bruk JSON-fanen for avansert.
      </p>
    )
  }
  const t = first
  const patch = (p: Partial<WorkflowActionCreateTask>) => {
    onChange([{ ...t, ...p }, ...actions.slice(1)])
  }
  return (
    <div className="space-y-2 text-sm">
      <label className="block">
        <span className="text-xs text-neutral-600">Tittel</span>
        <input
          value={t.title}
          onChange={(e) => patch({ title: e.target.value })}
          className={`${R} mt-1 w-full border border-neutral-300 px-2 py-2`}
        />
      </label>
      <label className="block">
        <span className="text-xs text-neutral-600">Beskrivelse</span>
        <textarea
          value={t.description ?? ''}
          onChange={(e) => patch({ description: e.target.value })}
          rows={2}
          className={`${R} mt-1 w-full border border-neutral-300 px-2 py-2`}
        />
      </label>
      <label className="block">
        <span className="text-xs text-neutral-600">Ansvarlig (tekst)</span>
        <input
          value={t.assignee ?? ''}
          onChange={(e) => patch({ assignee: e.target.value })}
          className={`${R} mt-1 w-full border border-neutral-300 px-2 py-2`}
        />
      </label>
      <label className="block">
        <span className="text-xs text-neutral-600">Frist (dager)</span>
        <input
          type="number"
          min={0}
          value={t.dueInDays ?? 7}
          onChange={(e) => patch({ dueInDays: Number(e.target.value) || 0 })}
          className={`${R} mt-1 w-full border border-neutral-300 px-2 py-2`}
        />
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={Boolean(t.requiresManagementSignOff)}
          onChange={(e) => patch({ requiresManagementSignOff: e.target.checked })}
          className="size-4"
        />
        Krever ledelsessignatur
      </label>
    </div>
  )
}

type Props = {
  value: WorkflowFlowDocument
  onChange: (d: WorkflowFlowDocument) => void
  sourceModule: string
  compileError: string | null
}

export function WorkflowFlowBuilder({ value, onChange, sourceModule, compileError }: Props) {
  const [selectedPath, setSelectedPath] = useState<{ branchId?: string; stepId: string } | null>(null)

  const filteredPresets = useMemo(
    () =>
      INPUT_PRESETS.filter((p) => p.module === '*' || p.module === sourceModule || sourceModule === 'wiki_published'),
    [sourceModule],
  )

  const updateDoc = useCallback(
    (next: WorkflowFlowDocument) => {
      onChange(next)
    },
    [onChange],
  )

  const selectedStep = useMemo(() => {
    if (!selectedPath) return null
    if (value.mode === 'linear') {
      return value.linearSteps.find((s) => s.id === selectedPath.stepId) ?? null
    }
    const b = value.xorBranches.find((x) => x.id === selectedPath.branchId)
    return b?.steps.find((s) => s.id === selectedPath.stepId) ?? null
  }, [selectedPath, value])

  function removeStep(branchId: string | undefined, stepId: string) {
    if (value.mode === 'linear') {
      updateDoc({ ...value, linearSteps: value.linearSteps.filter((s) => s.id !== stepId) })
    } else {
      updateDoc({
        ...value,
        xorBranches: value.xorBranches.map((b) =>
          b.id === branchId ? { ...b, steps: b.steps.filter((s) => s.id !== stepId) } : b,
        ),
      })
    }
    setSelectedPath(null)
  }

  function insertStep(
    branchId: string | undefined,
    index: number,
    step: WorkflowFlowStep,
    replace = false,
  ) {
    if (value.mode === 'linear') {
      const next = [...value.linearSteps]
      if (replace && index < next.length) next.splice(index, 1, step)
      else next.splice(index, 0, step)
      updateDoc({ ...value, linearSteps: next })
    } else if (branchId) {
      updateDoc({
        ...value,
        xorBranches: value.xorBranches.map((b) => {
          if (b.id !== branchId) return b
          const next = [...b.steps]
          if (replace && index < next.length) next.splice(index, 1, step)
          else next.splice(index, 0, step)
          return { ...b, steps: next }
        }),
      })
    }
  }

  function moveStep(branchId: string | undefined, from: number, to: number) {
    if (from === to) return
    if (value.mode === 'linear') {
      const next = [...value.linearSteps]
      const [it] = next.splice(from, 1)
      next.splice(to, 0, it)
      updateDoc({ ...value, linearSteps: next })
    } else if (branchId) {
      updateDoc({
        ...value,
        xorBranches: value.xorBranches.map((b) => {
          if (b.id !== branchId) return b
          const next = [...b.steps]
          const [it] = next.splice(from, 1)
          next.splice(to, 0, it)
          return { ...b, steps: next }
        }),
      })
    }
  }

  const handleDropOnList = (
    e: React.DragEvent,
    branchId: string | undefined,
    dropIndex: number,
  ) => {
    e.preventDefault()
    const p = readDrag(e)
    if (!p) return
    if (p.kind === 'palette_condition') {
      insertStep(branchId, dropIndex, {
        id: newFlowStepId(),
        kind: 'condition',
        label: p.label,
        condition: p.condition,
      })
      return
    }
    if (p.kind === 'palette_actions') {
      insertStep(branchId, dropIndex, {
        id: newFlowStepId(),
        kind: 'actions',
        label: 'Oppgave',
        actions: [defaultTaskAction()],
      })
      return
    }
    if (p.kind === 'reorder') {
      const list =
        value.mode === 'linear'
          ? value.linearSteps
          : value.xorBranches.find((b) => b.id === branchId)?.steps ?? []
      const from = list.findIndex((s) => s.id === p.stepId)
      if (from < 0) return
      let to = dropIndex
      if (from < to) to -= 1
      moveStep(branchId, from, Math.max(0, to))
    }
  }

  function patchSelectedStep(next: WorkflowFlowStep) {
    if (!selectedPath) return
    if (value.mode === 'linear') {
      updateDoc({
        ...value,
        linearSteps: value.linearSteps.map((s) => (s.id === next.id ? next : s)),
      })
    } else {
      updateDoc({
        ...value,
        xorBranches: value.xorBranches.map((b) =>
          b.id === selectedPath.branchId
            ? { ...b, steps: b.steps.map((s) => (s.id === next.id ? next : s)) }
            : b,
        ),
      })
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr_280px]">
      <div className={`${R} space-y-3 border border-neutral-200 bg-neutral-50/80 p-4`}>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-neutral-600">
          <Workflow className="size-4" />
          Inndata (dra inn)
        </div>
        <p className="text-xs text-neutral-500">
          Systemhendelse er valgt modul + lagring. Betingelser filtrerer JSON-lasten (samme som database-motoren).
        </p>
        <div className="space-y-2">
          {filteredPresets.map((pr) => (
            <div
              key={pr.label}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  'application/x-atics-workflow',
                  JSON.stringify({
                    kind: 'palette_condition',
                    condition: pr.condition,
                    label: pr.label,
                  } satisfies DragPayload),
                )
                e.dataTransfer.effectAllowed = 'copy'
              }}
              className={`${R} cursor-grab border border-dashed border-neutral-300 bg-white px-2 py-2 text-xs active:cursor-grabbing`}
            >
              {pr.label}
            </div>
          ))}
        </div>
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(
              'application/x-atics-workflow',
              JSON.stringify({ kind: 'palette_actions' } satisfies DragPayload),
            )
            e.dataTransfer.effectAllowed = 'copy'
          }}
          className={`${R} cursor-grab border-2 border-dashed border-[#1a3d32] bg-[#1a3d32]/5 px-2 py-3 text-center text-xs font-medium text-[#1a3d32] active:cursor-grabbing`}
        >
          + Handlingsblokk (Kanban-oppgave)
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-neutral-600">Flyt-modus:</span>
          <button
            type="button"
            onClick={() => {
              const d = { ...value, mode: 'linear' as const }
              if (d.linearSteps.length === 0) d.linearSteps = defaultWorkflowFlowDocument().linearSteps
              updateDoc(d)
            }}
            className={`${BTN} ${value.mode === 'linear' ? 'border-[#1a3d32] bg-[#1a3d32] text-white' : 'border-neutral-200 bg-white'}`}
          >
            Lineær (AND av steg)
          </button>
          <button
            type="button"
            onClick={() => updateDoc({ ...value, mode: 'xor' })}
            className={`${BTN} ${value.mode === 'xor' ? 'border-[#1a3d32] bg-[#1a3d32] text-white' : 'border-neutral-200 bg-white'}`}
          >
            <Split className="size-4" />
            XOR (eksakt én gren)
          </button>
        </div>
        {value.mode === 'xor' ? (
          <p className="text-xs text-amber-900">
            <strong>XOR:</strong> Når regelen kjører, må <em>eksakt én</em> gren sin betingelse være sann — da kjøres
            bare den grenens handlinger. 0 eller 2+ treff = ingen handling (logges som hoppet over).
          </p>
        ) : (
          <p className="text-xs text-neutral-600">
            Lineær flyt: alle betingelsessteg kombineres med <strong>OG</strong>. Deretter kjøres handlingsblokken(e).
          </p>
        )}

        {value.mode === 'linear' ? (
          <div
            className={`${R} min-h-[200px] border-2 border-dashed border-neutral-200 bg-white p-4`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDropOnList(e, undefined, value.linearSteps.length)}
          >
            <p className="mb-3 text-xs font-semibold text-neutral-500">Flyt (dra for å omorganisere)</p>
            <div className="space-y-2">
              {value.linearSteps.map((step, i) => (
                <div
                  key={step.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      'application/x-atics-workflow',
                      JSON.stringify({ kind: 'reorder', stepId: step.id } satisfies DragPayload),
                    )
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.stopPropagation()
                    handleDropOnList(e, undefined, i)
                  }}
                >
                  <StepCard
                    step={step}
                    selected={selectedPath?.stepId === step.id && !selectedPath.branchId}
                    onSelect={() => setSelectedPath({ stepId: step.id })}
                    onDelete={() => removeStep(undefined, step.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() =>
                updateDoc({
                  ...value,
                  xorBranches: [
                    ...value.xorBranches,
                    { id: newBranchId(), label: `Gren ${value.xorBranches.length + 1}`, steps: [] },
                  ],
                })
              }
              className={`${BTN} border-neutral-200 bg-white text-neutral-800`}
            >
              <Plus className="size-4" />
              Ny XOR-gren
            </button>
            <div className="grid gap-4 md:grid-cols-2">
              {value.xorBranches.map((branch) => (
                <div key={branch.id} className={`${R} border border-neutral-200 bg-neutral-50/50 p-3`}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <input
                      value={branch.label}
                      onChange={(e) =>
                        updateDoc({
                          ...value,
                          xorBranches: value.xorBranches.map((b) =>
                            b.id === branch.id ? { ...b, label: e.target.value } : b,
                          ),
                        })
                      }
                      className={`${R} w-full border border-neutral-300 bg-white px-2 py-1 text-sm font-medium`}
                    />
                    {value.xorBranches.length > 2 ? (
                      <button
                        type="button"
                        onClick={() =>
                          updateDoc({
                            ...value,
                            xorBranches: value.xorBranches.filter((b) => b.id !== branch.id),
                          })
                        }
                        className={`${R} shrink-0 p-2 text-red-600 hover:bg-red-50`}
                        aria-label="Slett gren"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    ) : null}
                  </div>
                  <div
                    className={`${R} min-h-[120px] border border-dashed border-neutral-300 bg-white p-2`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDropOnList(e, branch.id, branch.steps.length)}
                  >
                    {branch.steps.map((step, i) => (
                      <div
                        key={step.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(
                            'application/x-atics-workflow',
                            JSON.stringify({
                              kind: 'reorder',
                              stepId: step.id,
                              branchId: branch.id,
                            } satisfies DragPayload),
                          )
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.stopPropagation()
                          handleDropOnList(e, branch.id, i)
                        }}
                        className="mb-2"
                      >
                        <StepCard
                          step={step}
                          selected={
                            selectedPath?.stepId === step.id && selectedPath.branchId === branch.id
                          }
                          onSelect={() => setSelectedPath({ branchId: branch.id, stepId: step.id })}
                          onDelete={() => removeStep(branch.id, step.id)}
                        />
                      </div>
                    ))}
                    <p className="py-4 text-center text-xs text-neutral-400">Slipp inndata eller handlinger her</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {compileError ? (
          <p className={`${R} border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800`}>{compileError}</p>
        ) : null}
      </div>

      <div className={`${R} border border-neutral-200 bg-white p-4`}>
        <h4 className="text-xs font-bold uppercase tracking-wide text-neutral-600">Rediger valgt steg</h4>
        {!selectedStep ? (
          <p className="mt-3 text-sm text-neutral-500">Velg et steg i flyten.</p>
        ) : selectedStep.kind === 'condition' ? (
          <div className="mt-3">
            <label className="block text-xs text-neutral-600">Etikett</label>
            <input
              value={selectedStep.label ?? ''}
              onChange={(e) =>
                patchSelectedStep({ ...selectedStep, label: e.target.value })
              }
              className={`${R} mt-1 w-full border border-neutral-300 px-2 py-2 text-sm`}
            />
            <div className="mt-3">
              <ConditionEditor
                value={selectedStep.condition}
                onChange={(c) => patchSelectedStep({ ...selectedStep, condition: c })}
              />
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <label className="block text-xs text-neutral-600">Etikett</label>
            <input
              value={selectedStep.label ?? ''}
              onChange={(e) =>
                patchSelectedStep({ ...selectedStep, label: e.target.value })
              }
              className={`${R} mt-1 w-full border border-neutral-300 px-2 py-2 text-sm`}
            />
            <div className="mt-3">
              <ActionsEditor
                actions={selectedStep.actions}
                onChange={(a) => patchSelectedStep({ ...selectedStep, actions: a })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
