import { useCallback, useMemo, useState } from 'react'
import { GripVertical, Pencil, Plus, Split, Trash2, Workflow } from 'lucide-react'
import type { WorkflowAction } from '../../types/workflow'
import {
  defaultWorkflowFlowDocument,
  newBranchId,
  newFlowStepId,
  type WorkflowFlowDocument,
  type WorkflowFlowStep,
} from '../../lib/workflowFlowTypes'
import { summarizeCondition } from '../../lib/workflowConditionSummary'
import { presetsForSourceModule, type WorkflowInputPreset } from '../../data/workflowInputPresets'
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
import { Button } from '../ui/Button'
import { StandardInput } from '../ui/Input'
import { SearchableSelect } from '../ui/SearchableSelect'

const FIELD_LABEL = 'mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500'
const WF_LEAD = 'text-sm leading-relaxed text-neutral-600'
const STEP_CARD = 'rounded-lg border border-neutral-200/90 bg-white p-3 text-sm'

type ReorderPayload = { kind: 'reorder'; stepId: string; branchId?: string }

type ActionTemplate = 'task' | 'email' | 'notification' | 'webhook' | 'log'

function actionsForTemplate(template: ActionTemplate): WorkflowAction[] {
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

function actionBlockLabel(template: ActionTemplate): string {
  const m: Record<ActionTemplate, string> = {
    task: 'Oppgave',
    email: 'E-post',
    notification: 'Varsling',
    webhook: 'Webhook',
    log: 'Logg',
  }
  return m[template]
}

function readReorderDrag(e: React.DragEvent): ReorderPayload | null {
  try {
    const raw = e.dataTransfer.getData('application/x-atics-workflow')
    if (!raw) return null
    const p = JSON.parse(raw) as ReorderPayload
    return p?.kind === 'reorder' ? p : null
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
  dragPayload: ReorderPayload
}) {
  const IconBox =
    step.kind === 'condition' ? (
      <Workflow className="size-5 shrink-0 text-sky-700" aria-hidden />
    ) : (
      <Plus className="size-5 shrink-0 text-emerald-800" aria-hidden />
    )

  return (
    <div
      className={`${STEP_CARD} flex items-stretch gap-2 pl-1 ${selected ? 'ring-2 ring-[#1a3d32] ring-offset-1' : ''}`}
    >
      <span
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-atics-workflow', JSON.stringify(dragPayload))
          e.dataTransfer.effectAllowed = 'move'
        }}
        className="flex w-8 shrink-0 cursor-grab items-center justify-center text-neutral-400 active:cursor-grabbing"
        title="Dra for å flytte rekkefølge"
        aria-hidden
      >
        <GripVertical className="size-5" />
      </span>
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-start gap-3 rounded-lg py-0.5 text-left"
      >
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${stepAccent(step)}`}>
          {IconBox}
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-semibold text-neutral-900">
            {step.kind === 'condition' ? 'Når' : 'Så'}
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
          className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-[#1a3d32]"
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
          className="rounded-lg p-2 text-neutral-400 hover:bg-red-50 hover:text-red-700"
          aria-label="Slett"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  )
}

const ACTION_OPTIONS: { value: ActionTemplate; label: string }[] = [
  { value: 'task', label: 'Oppgave' },
  { value: 'email', label: 'E-post' },
  { value: 'notification', label: 'Varsling' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'log', label: 'Kun logg' },
]

const ACTION_SELECT_OPTIONS = [{ value: '', label: 'Velg…' }, ...ACTION_OPTIONS]

function FlowStepsBlock({
  branchId,
  steps,
  inputPresets,
  selectedPath,
  setSelectedPath,
  removeStep,
  insertStep,
  moveStep,
}: {
  branchId?: string
  steps: WorkflowFlowStep[]
  inputPresets: WorkflowInputPreset[]
  selectedPath: { branchId?: string; stepId: string } | null
  setSelectedPath: (p: { branchId?: string; stepId: string } | null) => void
  removeStep: (branchId: string | undefined, stepId: string) => void
  insertStep: (branchId: string | undefined, index: number, step: WorkflowFlowStep) => void
  moveStep: (branchId: string | undefined, from: number, to: number) => void
}) {
  const [whenPick, setWhenPick] = useState('')
  const [actPick, setActPick] = useState('')

  const handleDropOnList = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    const p = readReorderDrag(e)
    if (!p) return
    const list = steps
    const from = list.findIndex((s) => s.id === p.stepId)
    if (from < 0) return
    let to = dropIndex
    if (from < to) to -= 1
    moveStep(branchId, from, Math.max(0, to))
  }

  function addWhenPreset(presetId: string) {
    if (!presetId) return
    const pr = inputPresets.find((p) => p.id === presetId)
    if (!pr) return
    insertStep(branchId, steps.length, {
      id: newFlowStepId(),
      kind: 'condition',
      label: pr.label,
      condition: pr.condition,
    })
    setWhenPick('')
  }

  function addActionTemplate(tmpl: string) {
    if (!tmpl) return
    const template = tmpl as ActionTemplate
    insertStep(branchId, steps.length, {
      id: newFlowStepId(),
      kind: 'actions',
      label: actionBlockLabel(template),
      actions: actionsForTemplate(template),
    })
    setActPick('')
  }

  const whenPresetOptions = [{ value: '', label: 'Velg…' }, ...inputPresets.map((pr) => ({ value: pr.id, label: pr.label }))]

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <p className={FIELD_LABEL}>Legg til inndata (når)</p>
          <SearchableSelect
            value={whenPick}
            options={whenPresetOptions}
            onChange={(v) => {
              setWhenPick(v)
              addWhenPreset(v)
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className={FIELD_LABEL}>Legg til handling (så)</p>
          <SearchableSelect
            value={actPick}
            options={ACTION_SELECT_OPTIONS}
            onChange={(v) => {
              setActPick(v)
              addActionTemplate(v)
            }}
          />
        </div>
      </div>

      <div
        className="min-h-[140px] rounded-lg border border-neutral-200/90 bg-white p-3"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => handleDropOnList(e, steps.length)}
      >
        <p className={`${FIELD_LABEL} mb-2 text-neutral-500`}>Rekkefølge</p>
        <div className="space-y-0">
          {steps.length === 0 ? (
            <p className={`${WF_LEAD} py-6 text-center text-neutral-500`}>
              Ingen steg ennå. Velg inndata eller handling over.
            </p>
          ) : null}
          {steps.map((step, i) => (
            <div key={step.id}>
              {i > 0 ? <FlowConnector /> : null}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.stopPropagation()
                  handleDropOnList(e, i)
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
    </div>
  )
}

const CONDITION_MATCH_OPTIONS = [
  { value: 'always', label: 'Alltid' },
  { value: 'array_any', label: 'Når data i en liste matcher…' },
  { value: 'field_equals', label: 'Når ett felt er lik en verdi' },
]

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

  return (
    <div className="w-full space-y-0">
      <div className="grid grid-cols-1 gap-4 border-b border-neutral-200 px-4 py-4 last:border-b-0 md:grid-cols-[minmax(0,40%)_minmax(0,60%)] md:items-start md:gap-10 md:px-5 md:py-5">
        <div className="min-w-0 space-y-4">
          <div>
            <p className={FIELD_LABEL}>Flyt</p>
            <p className={`${WF_LEAD} mt-2`}>
              Legg til steg med menyene under. Juster detaljer til høyre. Du kan dra steg for å endre rekkefølge.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`${FIELD_LABEL} mr-1 text-neutral-600`}>Modus</span>
            <Button
              variant={value.mode === 'linear' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => {
                const d = { ...value, mode: 'linear' as const }
                if (d.linearSteps.length === 0) d.linearSteps = defaultWorkflowFlowDocument().linearSteps
                updateDoc(d)
              }}
            >
              Lineær
            </Button>
            <Button
              variant={value.mode === 'xor' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => updateDoc({ ...value, mode: 'xor' })}
            >
              <Split className="size-4" />
              XOR
            </Button>
          </div>

          {value.mode === 'xor' ? (
            <p className={`${WF_LEAD} text-neutral-700`}>
              <strong className="font-semibold">XOR:</strong> nøyaktig én gren skal matche.
            </p>
          ) : (
            <p className={WF_LEAD}>
              Alle <strong className="font-semibold">Når</strong>-steg kombineres med og, deretter kjøres{' '}
              <strong className="font-semibold">Så</strong>-steg.
            </p>
          )}

          {value.mode === 'linear' ? (
            <FlowStepsBlock
              steps={value.linearSteps}
              inputPresets={inputPresets}
              selectedPath={selectedPath}
              setSelectedPath={setSelectedPath}
              removeStep={removeStep}
              insertStep={insertStep}
              moveStep={moveStep}
            />
          ) : (
            <div className="space-y-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  updateDoc({
                    ...value,
                    xorBranches: [
                      ...value.xorBranches,
                      { id: newBranchId(), label: `Gren ${value.xorBranches.length + 1}`, steps: [] },
                    ],
                  })
                }
              >
                <Plus className="size-4" />
                Ny gren
              </Button>
              <div className="space-y-4">
                {value.xorBranches.map((branch) => (
                  <div key={branch.id} className="rounded-lg border border-neutral-200/90 bg-white p-4">
                    <label className={FIELD_LABEL}>Grenenavn</label>
                    <StandardInput
                      value={branch.label}
                      onChange={(e) =>
                        updateDoc({
                          ...value,
                          xorBranches: value.xorBranches.map((b) =>
                            b.id === branch.id ? { ...b, label: e.target.value } : b,
                          ),
                        })
                      }
                      className="mt-1.5 font-semibold"
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
                        className="mt-2 text-xs font-medium text-red-700 hover:underline"
                      >
                        Slett gren
                      </button>
                    ) : null}
                    <div className="mt-4">
                      <FlowStepsBlock
                        branchId={branch.id}
                        steps={branch.steps}
                        inputPresets={inputPresets}
                        selectedPath={selectedPath}
                        setSelectedPath={setSelectedPath}
                        removeStep={removeStep}
                        insertStep={insertStep}
                        moveStep={moveStep}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {compileError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{compileError}</p>
          ) : null}
        </div>

        <div className="rounded-none border border-neutral-200/90 bg-[#f4f1ea] p-5 sm:p-6 min-h-[min(70vh,36rem)]">
          <h4 className={FIELD_LABEL}>Spesifikasjon</h4>
          {!selectedStep ? (
            <p className={`${WF_LEAD} mt-10 text-center`}>Velg et steg i listen for å redigere.</p>
          ) : selectedStep.kind === 'condition' ? (
            <div className="mt-5 space-y-5">
              <div>
                <label className={FIELD_LABEL} htmlFor="wf-step-label-cond">
                  Visningsnavn
                </label>
                <StandardInput
                  id="wf-step-label-cond"
                  value={selectedStep.label ?? ''}
                  onChange={(e) => patchSelectedStep({ ...selectedStep, label: e.target.value })}
                  placeholder="Valgfritt kort navn"
                />
              </div>
              <div>
                <label className={FIELD_LABEL} htmlFor="wf-cond-match">
                  Når skal dette gjelde?
                </label>
                <SearchableSelect
                  value={selectedStep.condition.match}
                  options={CONDITION_MATCH_OPTIONS}
                  onChange={(v) => {
                    if (v === 'always') patchSelectedStep({ ...selectedStep, condition: { match: 'always' } })
                    if (v === 'field_equals')
                      patchSelectedStep({ ...selectedStep, condition: { match: 'field_equals', path: '', value: '' } })
                    if (v === 'array_any')
                      patchSelectedStep({ ...selectedStep, condition: { match: 'array_any', path: '', where: {} } })
                  }}
                />
              </div>
              <WorkflowConditionForm
                value={selectedStep.condition}
                onChange={(c) => patchSelectedStep({ ...selectedStep, condition: c })}
                sourceModule={sourceModule}
              />
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              <div>
                <label className={FIELD_LABEL} htmlFor="wf-step-label-act">
                  Visningsnavn
                </label>
                <StandardInput
                  id="wf-step-label-act"
                  value={selectedStep.label ?? ''}
                  onChange={(e) => patchSelectedStep({ ...selectedStep, label: e.target.value })}
                />
              </div>
              <WorkflowActionsEditor
                actions={selectedStep.actions}
                onChange={(a) => patchSelectedStep({ ...selectedStep, actions: a })}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
