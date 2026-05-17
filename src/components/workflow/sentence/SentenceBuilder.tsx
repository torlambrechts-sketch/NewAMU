// SentenceBuilder — Norwegian-prose authoring for a workflow rule.
//
// Renders a SentenceModel as a multi-row sentence with inline chip-pickers.
// The user clicks each chip to open a small popover that edits exactly
// the part the chip represents. Compile-on-save lowers the sentence to
// the canonical WorkflowFlowDocument; advanced constructs (XOR, parallel,
// sub-flows) are kicked back to the DAG builder.
//
// Read-only mode (no workflows.compose permission): chips are disabled
// and a banner explains the missing permission.

import { Plus, Trash2 } from 'lucide-react'
import type {
  WorkflowAction,
  WorkflowCondition,
  WorkflowSourceModule,
} from '../../../types/workflow'
import { defaultTaskAction } from '../workflowActionDefaults'
import { freshId } from '../../../lib/workflows/freshId'
import { ModuleSectionCard } from '../../module/ModuleSectionCard'
import { Button } from '../../ui/Button'
import { EventChip } from './parts/EventChip'
import { ScopeChip } from './parts/ScopeChip'
import { ConditionChip } from './parts/ConditionChip'
import { ActionChip } from './parts/ActionChip'
import { DelayChip } from './parts/DelayChip'
import { EscalationChip } from './parts/EscalationChip'
import type { SentenceDelay, SentenceModel, SentenceScopeFilter, SentenceStep } from './sentenceModel'

const SENT_LABEL = 'text-[11px] font-bold uppercase tracking-wider text-neutral-500'
const SENT_KEYWORD = 'text-[15px] font-bold text-[#1a3d32]'

export function SentenceBuilder({
  value,
  onChange,
  readOnly = false,
  onSwitchToAdvanced,
}: {
  value: SentenceModel
  onChange: (next: SentenceModel) => void
  readOnly?: boolean
  /**
   * Flip the host CanvasPanel to advanced mode. Forwarded to ActionChip
   * so its "ikke en innebygd hurtigredigerer" fallback is a working link
   * rather than a dead-end. P0 #3.
   */
  onSwitchToAdvanced?: () => void
}) {
  const sourceModule = value.trigger.sourceModule

  const setTrigger = (next: { sourceModule: WorkflowSourceModule; eventName: string }) => {
    onChange({ ...value, trigger: next })
  }
  const setScopeFilter = (next: SentenceScopeFilter) => onChange({ ...value, scopeFilter: next })
  const setCondition = (next: WorkflowCondition | null) => onChange({ ...value, condition: next })
  const setOnError = (next: WorkflowAction[] | null) => onChange({ ...value, onError: next })

  const updateStep = (id: string, patch: Partial<SentenceStep>) => {
    onChange({
      ...value,
      steps: value.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    })
  }
  const removeStep = (id: string) => {
    onChange({ ...value, steps: value.steps.filter((s) => s.id !== id) })
  }
  const addStep = () => {
    const newStep: SentenceStep = {
      id: freshId('sn'),
      action: defaultTaskAction(),
      delay: null,
    }
    onChange({ ...value, steps: [...value.steps, newStep] })
  }
  const setStepDelay = (id: string, delay: SentenceDelay) => updateStep(id, { delay })
  const setStepAction = (id: string, action: WorkflowAction) => updateStep(id, { action })

  // The Plain-Norwegian preview moved to its own canvas tab
  // (PlainNorwegianInspector). The legacy accordion below was removed so
  // there's a single source of truth for the prose rendering.

  return (
    <ModuleSectionCard className="p-5">
      {readOnly ? (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Du har ikke tillatelse til å redigere arbeidsflyter (<code>workflows.compose</code>).
          Setningen vises i lesemodus.
        </div>
      ) : null}

      <div className="space-y-4 text-[15px] leading-loose text-neutral-800">
        {/* NÅR row */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <span className={SENT_KEYWORD}>NÅR</span>
          <EventChip
            sourceModule={value.trigger.sourceModule}
            eventName={value.trigger.eventName}
            disabled={readOnly}
            onChange={setTrigger}
          />
          <span className="text-neutral-500">fyres</span>
        </div>

        {/* HVOR row */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <span className={SENT_KEYWORD}>HVOR</span>
          <ScopeChip value={value.scopeFilter} disabled={readOnly} onChange={setScopeFilter} />
        </div>

        {/* HVIS row */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <span className={SENT_KEYWORD}>HVIS</span>
          <ConditionChip
            value={value.condition}
            sourceModule={sourceModule}
            disabled={readOnly}
            onChange={setCondition}
          />
        </div>

        {/* DA row + steps */}
        <div>
          <span className={SENT_KEYWORD}>DA</span>
          <ol className="mt-2 space-y-2 pl-6">
            {value.steps.length === 0 ? (
              <li className="text-sm italic text-neutral-500">
                Ingen handlinger ennå. Legg til ditt første steg under.
              </li>
            ) : (
              value.steps.map((step, idx) => (
                <li key={step.id} className="flex flex-wrap items-center gap-x-2 gap-y-2">
                  <span className={`${SENT_LABEL} w-6 text-right`}>{idx + 1}.</span>
                  <ActionChip
                    action={step.action}
                    sourceModule={sourceModule}
                    disabled={readOnly}
                    onChange={(a) => setStepAction(step.id, a)}
                    onSwitchToAdvanced={onSwitchToAdvanced}
                  />
                  <span className="text-neutral-500">innen</span>
                  <DelayChip
                    value={step.delay}
                    disabled={readOnly}
                    onChange={(d) => setStepDelay(step.id, d)}
                  />
                  {!readOnly ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeStep(step.id)}
                      aria-label={`Slett steg ${idx + 1}`}
                      className="rounded-md text-neutral-400 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </li>
              ))
            )}
            {!readOnly ? (
              <li>
                <Button size="sm" variant="secondary" onClick={addStep} icon={<Plus className="size-3.5" />}>
                  Legg til steg
                </Button>
              </li>
            ) : null}
          </ol>
        </div>

        {/* HVIS FEILER row */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-neutral-200 pt-4">
          <span className={SENT_KEYWORD}>HVIS feiler →</span>
          <EscalationChip
            actions={value.onError}
            sourceModule={sourceModule}
            disabled={readOnly}
            onChange={setOnError}
            onSwitchToAdvanced={onSwitchToAdvanced}
          />
        </div>
      </div>

      {/* TASK 6 Plain-Norwegian preview accordion lifted to the
          Plain-Norsk inspector tab in CanvasPanel. */}
    </ModuleSectionCard>
  )
}
