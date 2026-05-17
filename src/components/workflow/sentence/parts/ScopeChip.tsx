// ScopeChip — picks HVOR the rule applies.
//
// v0 supports: hele organisasjonen (default), or a single equality on
// location_id / enhet_id / avdeling_id (free-text uuid input). The
// compile.ts roundtrips these as field_equals conditions on the
// well-known paths.

import { useState } from 'react'
import { MapPin } from 'lucide-react'
import type { SentenceScopeFilter } from '../sentenceModel'
import { Chip } from './Chip'
import { ChipPopover } from './ChipPopover'
import { StandardInput } from '../../../ui/Input'
import { SearchableSelect } from '../../../ui/SearchableSelect'
import { Button } from '../../../ui/Button'

const KIND_OPTIONS = [
  { value: 'all', label: 'Hele organisasjonen' },
  { value: 'location', label: 'Lokasjon (location_id)' },
  { value: 'enhet', label: 'Enhet (enhet_id)' },
  { value: 'avdeling', label: 'Avdeling (avdeling_id)' },
]

function labelFor(sf: SentenceScopeFilter): string {
  if (!sf) return 'hele organisasjonen'
  if (sf.kind === 'location') return `lokasjon ${sf.locationId.slice(0, 8)}…`
  if (sf.kind === 'enhet') return `enhet ${sf.enhetId.slice(0, 8)}…`
  return `avdeling ${sf.avdelingId.slice(0, 8)}…`
}

function currentId(sf: SentenceScopeFilter): string {
  if (!sf) return ''
  if (sf.kind === 'location') return sf.locationId
  if (sf.kind === 'enhet') return sf.enhetId
  return sf.avdelingId
}

function currentKind(sf: SentenceScopeFilter): 'all' | 'location' | 'enhet' | 'avdeling' {
  if (!sf) return 'all'
  return sf.kind
}

export function ScopeChip({
  value,
  disabled,
  onChange,
}: {
  value: SentenceScopeFilter
  disabled?: boolean
  onChange: (next: SentenceScopeFilter) => void
}) {
  const [open, setOpen] = useState(false)
  const [draftKind, setDraftKind] = useState<string>(currentKind(value))
  const [draftId, setDraftId] = useState<string>(currentId(value))

  function reset() {
    setDraftKind(currentKind(value))
    setDraftId(currentId(value))
  }

  function commit() {
    if (draftKind === 'all') onChange(null)
    else if (draftKind === 'location') onChange({ kind: 'location', locationId: draftId.trim() })
    else if (draftKind === 'enhet') onChange({ kind: 'enhet', enhetId: draftId.trim() })
    else if (draftKind === 'avdeling') onChange({ kind: 'avdeling', avdelingId: draftId.trim() })
    setOpen(false)
  }

  return (
    <span className="relative inline-block">
      <Chip
        icon={<MapPin className="size-3.5" aria-hidden />}
        label={labelFor(value)}
        filled={value !== null}
        disabled={disabled}
        onClick={() => {
          reset()
          setOpen((v) => !v)
        }}
        ariaLabel={`Endre omfang — nåværende: ${labelFor(value)}`}
      />
      <ChipPopover open={open} title="Hvor skal regelen gjelde?" onClose={() => setOpen(false)}>
        <div className="space-y-3 text-sm">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Type omfang
            </label>
            <SearchableSelect
              value={draftKind}
              options={KIND_OPTIONS}
              onChange={(v) => setDraftKind(v)}
            />
          </div>
          {draftKind !== 'all' ? (
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                ID
              </label>
              <StandardInput
                value={draftId}
                onChange={(e) => setDraftId(e.target.value)}
                placeholder="UUID for valgt enhet"
              />
              <p className="mt-1 text-xs text-neutral-500">
                Kompilerer til <code>field_equals</code> på{' '}
                <code>
                  {draftKind === 'location'
                    ? 'location_id'
                    : draftKind === 'enhet'
                      ? 'enhet_id'
                      : 'avdeling_id'}
                </code>
                .
              </p>
            </div>
          ) : (
            <p className="text-xs text-neutral-500">
              Ingen filtrering — regelen kjører for alle hendelser i organisasjonen.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
            <Button size="sm" variant="primary" onClick={commit}>
              Bruk
            </Button>
          </div>
        </div>
      </ChipPopover>
    </span>
  )
}
