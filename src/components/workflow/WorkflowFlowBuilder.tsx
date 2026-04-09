import { useCallback, useMemo, useState } from 'react'
import { FileText, GripVertical, Mail, Pencil, Plus, Radio, Split, Trash2, Webhook, Workflow } from 'lucide-react'
import type { WorkflowAction, WorkflowCondition } from '../../types/workflow'
import {
  defaultWorkflowFlowDocument,
  newBranchId,
  newFlowStepId,
  type WorkflowFlowDocument,
  type WorkflowFlowStep,
} from '../../lib/workflowFlowTypes'
import { summarizeCondition } from '../../lib/workflowConditionSummary'
import { presetsForSourceModule } from '../../data/workflowInputPresets'
import { WorkflowActionsEditor } from './WorkflowActionsEditor'
import { WorkflowConditionForm } from './WorkflowConditionForm'
import {
  defaultWebhookAction,
  defaultLogOnlyAction,
  defaultNotificationAction,
  defaultSendEmailAction,
  defaultTaskAction,
  summarizeAction,
} from './workflowActionDefaults'

const R = 'rounded-none'
const BTN =
  'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 border px-3 text-sm font-medium leading-none'
const CARD = `${R} border border-neutral-200 bg-white p-3 text-sm shadow-sm`

type DragPayload =
  | { kind: 'palette_condition'; condition: WorkflowCondition; label: string }
  | { kind: 'palette_actions'; template: 'task' | 'email' | 'notification' | 'webhook' | 'log' }
  | { kind: 'reorder'; stepId: string; branchId?: string }

function actionsForPaletteTemplate(template: 'task' | 'email' | 'notification' | 'webhook' | 'log'): WorkflowAction[] {
  switch (template) {
    case 'task':
      return [defaultTaskAction()]
    case 'email':
      return [defaultSendEmailAction()]
    case 'notification':
      return [defaultNotificationAction()]
    case 'webhook':
      return [defaultWebhookAction()]
    case 'log':
      return [defaultLogOnlyAction()]
    default:
      return [defaultTaskAction()]
  }
}

function actionBlockLabel(template: 'task' | 'email' | 'notification' | 'webhook' | 'log'): string {
  const m: Record<string, string> = {
    task: 'Oppgave',
    email: 'E-post',
    notification: 'Varsling',
    webhook: 'Webhook',
    log: 'Logg',
  }
  return m[template] ?? 'Handlinger'
}

function readDrag(e: React.DragEvent): DragPayload | null {
  try {
    const raw = e.dataTransfer.getData('application/x-atics-workflow')
    if (!raw) return null
    return JSON.parse(raw) as DragPayload
  } catch {
    return null
  }
}

function stepSummaryLine(step: WorkflowFlowStep): string {
  if (step.kind === 'condition') return summarizeCondition(step.condition)
  if (step.actions.length === 0) return 'Ingen handlinger'
  return step.actions.map((a) => summarizeAction(a)).join(' · ')
}

function stepAccent(step: WorkflowFlowStep): string {
  if (step.kind === 'condition') return 'bg-sky-100 text-sky-800'
  return 'bg-emerald-100 text-emerald-900'
}

function FlowConnector() {
  return (
    <div className="flex justify-center py-1" aria-hidden>
      <div className="flex flex-col items-center gap-0.5 text-[#1a3d32]/70">
        <div className="h-4 w-px bg-current" />
        <div className="size-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-current" />
      </div>
    </div>
  )
}

function StepRow({
  step,
  selected,
  onSelect,
  onDelete,
  dragPayload,
}: {
  step: WorkflowFlowStep
  selected: boolean
  onSelect: () => void
  onDelete: () => void
  dragPayload: DragPayload
}) {
  const IconBox =
    step.kind === 'condition' ? (
      <Workflow className="size-5 shrink-0 text-sky-700" aria-hidden />
    ) : (
      <Plus className="size-5 shrink-0 text-emerald-800" aria-hidden />
    )

  return (
    <div
      className={`${CARD} flex items-stretch gap-2 pl-1 ${selected ? 'ring-2 ring-[#1a3d32] ring-offset-2' : ''}`}
    >
      <span
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-atics-workflow', JSON.stringify(dragPayload))
          e.dataTransfer.effectAllowed = 'move'
        }}
        className="flex w-8 shrink-0 cursor-grab items-center justify-center text-neutral-400 active:cursor-grabbing"
        title="Dra for å flytte"
        aria-hidden
      >
        <GripVertical className="size-5" />
      </span>
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-start gap-3 rounded-none py-0.5 text-left"
      >
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-none ${stepAccent(step)}`}>
          {IconBox}
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-semibold text-neutral-900">
            {step.kind === 'condition' ? 'Når (betingelse)' : 'Så (handlinger)'}
            {step.label ? <span className="ml-2 font-normal text-neutral-500">— {step.label}</span> : null}
          </span>
          <span className="mt-1 line-clamp-2 block text-xs text-neutral-600">{stepSummaryLine(step)}</span>
        </span>
      </button>
      <div className="flex shrink-0 flex-col gap-0.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSelect()
          }}
          className={`${R} p-2 text-neutral-500 hover:bg-neutral-100 hover:text-[#1a3d32]`}
          aria-label="Rediger"
        >
          <Pencil className="size-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className={`${R} p-2 text-neutral-400 hover:bg-red-50 hover:text-red-700`}
          aria-label="Slett"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
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

  const inputPresets = useMemo(() => presetsForSourceModule(sourceModule), [sourceModule])

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
    setSelectedPath((p) => (p?.stepId === stepId ? null : p))
  }

  function insertStep(branchId: string | undefined, index: number, step: WorkflowFlowStep) {
    if (value.mode === 'linear') {
      const next = [...value.linearSteps]
      next.splice(index, 0, step)
      updateDoc({ ...value, linearSteps: next })
    } else if (branchId) {
      updateDoc({
        ...value,
        xorBranches: value.xorBranches.map((b) => {
          if (b.id !== branchId) return b
          const ns = [...b.steps]
          ns.splice(index, 0, step)
          return { ...b, steps: ns }
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

  const handleDropOnList = (e: React.DragEvent, branchId: string | undefined, dropIndex: number) => {
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
      const tmpl = p.template
      insertStep(branchId, dropIndex, {
        id: newFlowStepId(),
        kind: 'actions',
        label: actionBlockLabel(tmpl),
        actions: actionsForPaletteTemplate(tmpl),
      })
      return
    }
    if (p.kind === 'reorder') {
      const list =
        value.mode === 'linear' ? value.linearSteps : value.xorBranches.find((b) => b.id === branchId)?.steps ?? []
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
          b.id === selectedPath.branchId ? { ...b, steps: b.steps.map((s) => (s.id === next.id ? next : s)) } : b,
        ),
      })
    }
  }

  const renderFlowColumn = (branchId: string | undefined, steps: WorkflowFlowStep[]) => (
    <div
      className={`${R} min-h-[220px] border-2 border-dashed border-neutral-200 bg-[#faf9f6] p-4`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => handleDropOnList(e, branchId, steps.length)}
    >
      <p className="mb-3 text-xs font-semibold text-neutral-600">Flyt — dra inn steg eller flytt med håndtaket</p>
      <div className="space-y-0">
        {steps.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-400">Slipp «Når» eller «Så» her</p>
        ) : null}
        {steps.map((step, i) => (
          <div key={step.id}>
            {i > 0 ? <FlowConnector /> : null}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.stopPropagation()
                handleDropOnList(e, branchId, i)
              }}
            >
              <StepRow
                step={step}
                selected={
                  selectedPath?.stepId === step.id &&
                  (branchId === undefined ? !selectedPath.branchId : selectedPath.branchId === branchId)
                }
                onSelect={() => setSelectedPath(branchId ? { branchId, stepId: step.id } : { stepId: step.id })}
                onDelete={() => removeStep(branchId, step.id)}
                dragPayload={{
                  kind: 'reorder',
                  stepId: step.id,
                  branchId: branchId ?? undefined,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(280px,380px)_1fr] lg:items-start">
      {/* Left: palette + sequence */}
      <div className="space-y-5">
        <div className={`${R} border border-neutral-200 bg-white p-4 shadow-sm`}>
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-600">Dra nytt steg inn i flyten</p>
          <p className="mt-1 text-xs text-neutral-500">
            Velg <strong>Når</strong> (hva som utløser) og <strong>Så</strong> (hva som skjer). Kilden er valgt over —
            «Når» filtrerer data i den modulen.
          </p>
          <div className="mt-3 space-y-2">
            <p className="text-[10px] font-bold uppercase text-neutral-500">Når — inndata</p>
            <div className="flex flex-wrap gap-2">
              {inputPresets.map((pr) => {
                const Icon = pr.icon
                return (
                  <div
                    key={pr.id}
                    draggable
                    title={pr.description}
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
                    className={`${R} flex size-[4.5rem] cursor-grab flex-col items-center justify-center gap-1 border border-dashed border-neutral-300 bg-neutral-50 text-center text-[10px] font-medium leading-tight text-neutral-700 active:cursor-grabbing`}
                  >
                    <Icon className="size-5 shrink-0 text-[#1a3d32]" aria-hidden />
                    <span className="line-clamp-2 px-0.5">{pr.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="mt-4 space-y-2 border-t border-neutral-100 pt-4">
            <p className="text-[10px] font-bold uppercase text-neutral-500">Så — handlinger</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { t: 'task' as const, icon: Plus, label: 'Oppgave' },
                  { t: 'email' as const, icon: Mail, label: 'E-post' },
                  { t: 'notification' as const, icon: Radio, label: 'Varsling' },
                  { t: 'webhook' as const, icon: Webhook, label: 'Webhook' },
                  { t: 'log' as const, icon: FileText, label: 'Logg' },
                ] as const
              ).map(({ t, icon: Icon, label }) => (
                <div
                  key={t}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      'application/x-atics-workflow',
                      JSON.stringify({ kind: 'palette_actions', template: t } satisfies DragPayload),
                    )
                    e.dataTransfer.effectAllowed = 'copy'
                  }}
                  className={`${R} flex size-[4.5rem] cursor-grab flex-col items-center justify-center gap-1 border border-dashed border-[#1a3d32]/40 bg-[#1a3d32]/5 text-center text-[10px] font-semibold text-[#1a3d32] active:cursor-grabbing`}
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-neutral-600">Flyt-modus</span>
          <button
            type="button"
            onClick={() => {
              const d = { ...value, mode: 'linear' as const }
              if (d.linearSteps.length === 0) d.linearSteps = defaultWorkflowFlowDocument().linearSteps
              updateDoc(d)
            }}
            className={`${BTN} ${value.mode === 'linear' ? 'border-[#1a3d32] bg-[#1a3d32] text-white' : 'border-neutral-200 bg-white'}`}
          >
            Lineær
          </button>
          <button
            type="button"
            onClick={() => updateDoc({ ...value, mode: 'xor' })}
            className={`${BTN} ${value.mode === 'xor' ? 'border-[#1a3d32] bg-[#1a3d32] text-white' : 'border-neutral-200 bg-white'}`}
          >
            <Split className="size-4" />
            XOR
          </button>
        </div>
        {value.mode === 'xor' ? (
          <p className="text-xs text-amber-900">
            <strong>XOR:</strong> Nøyaktig én gren skal matche. 0 eller flere = ingen handling.
          </p>
        ) : (
          <p className="text-xs text-neutral-600">Alle «Når»-steg må være oppfylt (OG), deretter kjøres «Så»-steg.</p>
        )}

        {value.mode === 'linear' ? (
          renderFlowColumn(undefined, value.linearSteps)
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
              Ny gren
            </button>
            <div className="space-y-4">
              {value.xorBranches.map((branch) => (
                <div key={branch.id} className={`${R} border border-neutral-200 bg-white p-3`}>
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
                    className={`${R} mb-2 w-full border border-neutral-300 bg-neutral-50 px-2 py-1.5 text-sm font-semibold`}
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
                      className="mb-2 text-xs text-red-600 hover:underline"
                    >
                      Slett gren
                    </button>
                  ) : null}
                  {renderFlowColumn(branch.id, branch.steps)}
                </div>
              ))}
            </div>
          </div>
        )}

        {compileError ? (
          <p className={`${R} border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800`}>{compileError}</p>
        ) : null}
      </div>

      {/* Right: specification */}
      <div className={`${R} min-h-[320px] border border-neutral-200 bg-white p-5 shadow-sm lg:min-h-[480px]`}>
        <h4 className="text-xs font-bold uppercase tracking-wide text-neutral-600">Spesifikasjon</h4>
        {!selectedStep ? (
          <p className="mt-12 text-center text-sm text-neutral-500">Velg et steg i flyten til venstre for å redigere.</p>
        ) : selectedStep.kind === 'condition' ? (
          <div className="mt-4 space-y-4">
            <label className="block text-sm">
              <span className="text-xs font-semibold text-neutral-600">Visningsnavn</span>
              <input
                value={selectedStep.label ?? ''}
                onChange={(e) => patchSelectedStep({ ...selectedStep, label: e.target.value })}
                className={`${R} mt-1 w-full border border-neutral-300 px-3 py-2`}
                placeholder="F.eks. Kritisk hendelse"
              />
            </label>
            <div>
              <span className="text-xs font-semibold text-neutral-600">Når skal dette gjelde?</span>
              <select
                value={selectedStep.condition.match}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === 'always') patchSelectedStep({ ...selectedStep, condition: { match: 'always' } })
                  if (v === 'field_equals')
                    patchSelectedStep({ ...selectedStep, condition: { match: 'field_equals', path: '', value: '' } })
                  if (v === 'array_any')
                    patchSelectedStep({ ...selectedStep, condition: { match: 'array_any', path: '', where: {} } })
                }}
                className={`${R} mt-2 w-full border border-neutral-300 bg-white px-2 py-2 text-sm`}
              >
                <option value="always">Alltid (alle lagringer i kilden)</option>
                <option value="array_any">Når data i en liste matcher…</option>
                <option value="field_equals">Når ett felt er lik en verdi (avansert)</option>
              </select>
            </div>
            <WorkflowConditionForm
              value={selectedStep.condition}
              onChange={(c) => patchSelectedStep({ ...selectedStep, condition: c })}
              sourceModule={sourceModule}
            />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="text-xs font-semibold text-neutral-600">Visningsnavn</span>
              <input
                value={selectedStep.label ?? ''}
                onChange={(e) => patchSelectedStep({ ...selectedStep, label: e.target.value })}
                className={`${R} mt-1 w-full border border-neutral-300 px-3 py-2`}
              />
            </label>
            <WorkflowActionsEditor
              actions={selectedStep.actions}
              onChange={(a) => patchSelectedStep({ ...selectedStep, actions: a })}
            />
          </div>
        )}
      </div>
    </div>
  )
}
