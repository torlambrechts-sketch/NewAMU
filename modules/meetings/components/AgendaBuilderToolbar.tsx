// AgendaBuilderToolbar — "Legg til sak" button + total-duration display.
//
// Sits above the agenda list in the meeting detail view. The chair can
// add manual items until the protocol is signed (lock trigger enforces
// post-sign immutability at the DB level).

import { Clock, Plus } from 'lucide-react'
import { Button } from '../../../src/components/ui/Button'
import type { MeetingAgendaItemRow } from '../types'

export type AgendaBuilderToolbarProps = {
  items: MeetingAgendaItemRow[]
  locked: boolean
  onAddItem: () => void
}

export function AgendaBuilderToolbar({
  items,
  locked,
  onAddItem,
}: AgendaBuilderToolbarProps) {
  const totalMinutes = items.reduce(
    (sum, i) => sum + (i.duration_minutes ?? 0),
    0,
  )
  const manualCount = items.filter((i) => i.is_manual).length
  const itemsWithDuration = items.filter((i) => i.duration_minutes != null).length

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200/80 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-600">
        <span>
          <strong>{items.length}</strong> sak{items.length === 1 ? '' : 'er'}
          {manualCount > 0 ? ` (${manualCount} manuelle)` : ''}
        </span>
        {totalMinutes > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <strong>{totalMinutes} min</strong> budsjettert
            <span className="text-neutral-400">
              ({itemsWithDuration}/{items.length} med varighet)
            </span>
          </span>
        ) : null}
      </div>
      {!locked ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={<Plus className="h-3.5 w-3.5" />}
          onClick={onAddItem}
        >
          Legg til sak
        </Button>
      ) : null}
    </div>
  )
}
