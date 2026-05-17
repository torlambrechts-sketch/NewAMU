// ConditionChip — opens the existing WorkflowConditionForm in a popover.
//
// Shows compact summary ("ingen" / "1 betingelse" / "2 betingelser") on
// the chip itself. The popover hosts the full condition form so power
// users can still craft array_any / field_equals predicates without
// flipping to advanced mode.

import { useState } from 'react'
import { Filter } from 'lucide-react'
import type { WorkflowCondition, WorkflowSourceModule } from '../../../../types/workflow'
import { Chip } from './Chip'
import { ChipPopover } from './ChipPopover'
import { WorkflowConditionForm } from '../../WorkflowConditionForm'
import { Button } from '../../../ui/Button'

function countConditions(c: WorkflowCondition | null): number {
  if (!c) return 0
  if (c.match === 'always') return 0
  if (c.match === 'and' || c.match === 'or' || c.match === 'xor') return c.conditions.length
  return 1
}

function summary(c: WorkflowCondition | null): string {
  const n = countConditions(c)
  if (n === 0) return 'ingen filter'
  if (n === 1) return '1 betingelse'
  return `${n} betingelser`
}

export function ConditionChip({
  value,
  sourceModule,
  disabled,
  onChange,
}: {
  value: WorkflowCondition | null
  sourceModule: WorkflowSourceModule
  disabled?: boolean
  onChange: (next: WorkflowCondition | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<WorkflowCondition>(value ?? { match: 'always' })

  function openPanel() {
    // P1 #10 (defense in depth): the chip is `disabled` in readOnly mode and
    // the click handler shouldn't fire anyway, but bail at the function
    // boundary too in case a future wrapper bypasses the Chip's disabled
    // attribute (e.g. opening via keyboard shortcut).
    if (disabled) return
    setDraft(value ?? { match: 'always' })
    setOpen(true)
  }

  function commit() {
    if (disabled) return
    onChange(draft.match === 'always' ? null : draft)
    setOpen(false)
  }

  function clear() {
    if (disabled) return
    onChange(null)
    setOpen(false)
  }

  const filled = countConditions(value) > 0
  return (
    <span className="relative inline-block">
      <Chip
        icon={<Filter className="size-3.5" aria-hidden />}
        label={summary(value)}
        filled={filled}
        disabled={disabled}
        onClick={openPanel}
        ariaLabel={`Endre betingelse — nåværende: ${summary(value)}`}
      />
      <ChipPopover
        open={open}
        title="Hvilken betingelse må være sann?"
        onClose={() => setOpen(false)}
        width="w-[min(34rem,92vw)]"
      >
        <div className="space-y-3">
          {/*
           * TODO(P1 #10, follow-up): WorkflowConditionForm does not yet
           * accept a `readOnly` prop. The chip itself is disabled in
           * read-only mode so this popover never opens today, but if a
           * future code path opens it programmatically the form inputs
           * would still be editable. Extend WorkflowConditionForm to take
           * `readOnly?: boolean` and forward to all StandardInput /
           * SearchableSelect children.
           */}
          <WorkflowConditionForm
            value={draft}
            onChange={setDraft}
            sourceModule={sourceModule}
          />
          <div className="flex justify-between gap-2 pt-1">
            <Button size="sm" variant="ghost" onClick={clear} disabled={disabled}>
              Fjern betingelse
            </Button>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>
                Avbryt
              </Button>
              <Button size="sm" variant="primary" onClick={commit} disabled={disabled}>
                Bruk
              </Button>
            </div>
          </div>
        </div>
      </ChipPopover>
    </span>
  )
}
