// DelayChip — duration picker for "innen X tid".
//
// Presets cover the common cases (umiddelbart / 1t / 4t / 1d / 1u) plus
// a custom row. v0 stores delays as `wait_delay` actions sitting just
// before the action in the compiled flow; null/0 means "no wait".

import { useState } from 'react'
import { Timer } from 'lucide-react'
import type { SentenceDelay } from '../sentenceModel'
import { Chip } from './Chip'
import { ChipPopover } from './ChipPopover'
import { StandardInput } from '../../../ui/Input'
import { SearchableSelect } from '../../../ui/SearchableSelect'
import { Button } from '../../../ui/Button'

const PRESETS: { label: string; value: SentenceDelay }[] = [
  { label: 'umiddelbart', value: null },
  { label: 'om 1 time', value: { unit: 'hours', value: 1 } },
  { label: 'om 4 timer', value: { unit: 'hours', value: 4 } },
  { label: 'om 1 dag', value: { unit: 'days', value: 1 } },
  { label: 'om 3 dager', value: { unit: 'days', value: 3 } },
  { label: 'om 7 dager', value: { unit: 'days', value: 7 } },
]

const UNIT_OPTIONS = [
  { value: 'minutes', label: 'minutter' },
  { value: 'hours', label: 'timer' },
  { value: 'days', label: 'dager' },
]

function labelFor(d: SentenceDelay): string {
  if (!d || d.value <= 0) return 'umiddelbart'
  const map: Record<NonNullable<SentenceDelay>['unit'], string> = {
    minutes: d.value === 1 ? 'minutt' : 'minutter',
    hours: d.value === 1 ? 'time' : 'timer',
    days: d.value === 1 ? 'dag' : 'dager',
  }
  return `om ${d.value} ${map[d.unit]}`
}

export function DelayChip({
  value,
  disabled,
  onChange,
}: {
  value: SentenceDelay
  disabled?: boolean
  onChange: (next: SentenceDelay) => void
}) {
  const [open, setOpen] = useState(false)
  const [unit, setUnit] = useState<'minutes' | 'hours' | 'days'>(value?.unit ?? 'days')
  const [amount, setAmount] = useState<string>(String(value?.value ?? 1))

  function commitCustom() {
    const n = Number.parseInt(amount, 10)
    if (!Number.isFinite(n) || n <= 0) {
      onChange(null)
    } else {
      onChange({ unit, value: n })
    }
    setOpen(false)
  }

  return (
    <span className="relative inline-block">
      <Chip
        icon={<Timer className="size-3.5" aria-hidden />}
        label={labelFor(value)}
        filled={value !== null && value.value > 0}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        ariaLabel={`Endre forsinkelse — nåværende: ${labelFor(value)}`}
      />
      <ChipPopover open={open} title="Når skal handlingen skje?" onClose={() => setOpen(false)}>
        <div className="space-y-3 text-sm">
          <ul className="space-y-1">
            {PRESETS.map((p) => (
              <li key={p.label}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onChange(p.value)
                    setOpen(false)
                  }}
                  className="w-full justify-start rounded-md px-2 py-1.5 text-left font-normal hover:bg-neutral-100"
                >
                  {p.label}
                </Button>
              </li>
            ))}
          </ul>
          <div className="border-t border-neutral-200 pt-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Egendefinert
            </p>
            <div className="flex items-end gap-2">
              <div className="w-20">
                <StandardInput
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  aria-label="Antall"
                />
              </div>
              <div className="min-w-0 flex-1">
                <SearchableSelect
                  value={unit}
                  options={UNIT_OPTIONS}
                  onChange={(v) => setUnit(v as 'minutes' | 'hours' | 'days')}
                />
              </div>
              <Button size="sm" variant="primary" onClick={commitCustom}>
                Bruk
              </Button>
            </div>
          </div>
        </div>
      </ChipPopover>
    </span>
  )
}
