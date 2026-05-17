// EventChip — picks the trigger (sourceModule + eventName).
//
// Reads from `listWorkflowEvents()`. Grouped by scope label. Searchable.
// Sets both `sourceModule` and `eventName` in one go because the two are
// coupled (event names are namespaced per scope).

import { useMemo, useState } from 'react'
import { Zap } from 'lucide-react'
import type { WorkflowSourceModule } from '../../../../types/workflow'
import { listWorkflowEvents } from '../../../../lib/workflows/workflowRegistry'
import { Chip } from './Chip'
import { ChipPopover } from './ChipPopover'
import { Button } from '../../../ui/Button'
import { StandardInput } from '../../../ui/Input'

export function EventChip({
  sourceModule,
  eventName,
  disabled,
  onChange,
}: {
  sourceModule: WorkflowSourceModule
  eventName: string
  disabled?: boolean
  onChange: (next: { sourceModule: WorkflowSourceModule; eventName: string }) => void
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')

  const all = useMemo(() => listWorkflowEvents(), [])
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return all
    return all.filter(
      ({ scope, event }) =>
        scope.label.toLowerCase().includes(q) ||
        event.label.toLowerCase().includes(q) ||
        event.name.toLowerCase().includes(q),
    )
  }, [all, filter])

  const groups = useMemo(() => {
    const map = new Map<string, typeof all>()
    for (const item of filtered) {
      const key = item.scope.scopeId
      const arr = map.get(key) ?? []
      arr.push(item)
      map.set(key, arr)
    }
    return [...map.entries()].map(([scopeId, items]) => ({
      scopeId,
      scopeLabel: items[0].scope.label,
      accent: items[0].scope.accent,
      items,
    }))
  }, [filtered])

  const current = all.find(
    (x) => x.scope.scopeId === sourceModule && x.event.name === eventName,
  )
  const label = current
    ? `${current.event.label}`
    : 'velg utløsende hendelse'

  return (
    <span className="relative inline-block">
      <Chip
        icon={<Zap className="size-3.5" aria-hidden />}
        label={label}
        filled={Boolean(current)}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        ariaLabel={`Endre utløsende hendelse — nåværende: ${current ? `${current.event.label} (${current.scope.label})` : 'ikke valgt'}`}
      />
      <ChipPopover
        open={open}
        title="Velg utløsende hendelse"
        onClose={() => setOpen(false)}
      >
        <div className="space-y-3">
          <StandardInput
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Søk etter hendelse eller modul…"
            aria-label="Søk etter hendelse"
            autoFocus
          />
          <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
            {groups.length === 0 ? (
              <p className="text-sm text-neutral-500">Ingen treff.</p>
            ) : (
              groups.map((g) => (
                <div key={g.scopeId}>
                  <p
                    className="mb-1 text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: g.accent ?? '#525252' }}
                  >
                    {g.scopeLabel}
                  </p>
                  <ul className="space-y-1">
                    {g.items.map(({ event }) => {
                      const selected =
                        sourceModule === g.scopeId && eventName === event.name
                      return (
                        <li key={event.name}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              onChange({
                                sourceModule: g.scopeId as WorkflowSourceModule,
                                eventName: event.name,
                              })
                              setOpen(false)
                            }}
                            // P1 #7: brand green pill replaces Tailwind emerald.
                            className={`flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left font-normal hover:bg-neutral-100 ${selected ? 'bg-[#1a3d32]/10 text-[#1a3d32] hover:bg-[#1a3d32]/15' : 'text-neutral-800'}`}
                          >
                            <span className="font-medium">{event.label}</span>
                            {event.description ? (
                              <span className="text-xs text-neutral-500">{event.description}</span>
                            ) : null}
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>
        </div>
      </ChipPopover>
    </span>
  )
}
