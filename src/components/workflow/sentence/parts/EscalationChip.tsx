// EscalationChip — wraps ActionChip for the "HVIS feiler →" branch.
//
// MVP: one fallback action. Stored in SentenceModel.onError as a single-
// element array (compile.ts wraps the array into a {type:'on_error',
// actions:[…]} tail step). Click "+" to add; X removes.

import type { WorkflowAction, WorkflowSourceModule } from '../../../../types/workflow'
import { ActionChip } from './ActionChip'

export function EscalationChip({
  actions,
  sourceModule,
  disabled,
  onChange,
  onSwitchToAdvanced,
}: {
  actions: WorkflowAction[] | null
  sourceModule: WorkflowSourceModule
  disabled?: boolean
  onChange: (next: WorkflowAction[] | null) => void
  onSwitchToAdvanced?: () => void
}) {
  const head = actions && actions.length > 0 ? actions[0] : null

  return (
    <ActionChip
      action={head}
      sourceModule={sourceModule}
      disabled={disabled}
      placeholder="legg til eskalering"
      accent="#b91c1c"
      onChange={(a) => onChange([a])}
      onRemove={head ? () => onChange(null) : undefined}
      onSwitchToAdvanced={onSwitchToAdvanced}
    />
  )
}
