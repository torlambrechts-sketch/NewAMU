// ChecklistScopeSelector — lets the user declare what a checklist execution is *about*.
// Three modes: a registered location, a free-text catalogue item (e.g. an external
// vendor, a machine, a contract), or a free-text "other" subject.
// The component commits on each change so the caller only needs an onSave callback.

import { useState } from 'react'
import { MapPin, Package, HelpCircle } from 'lucide-react'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { StandardInput } from '../../../src/components/ui/Input'
import { Button } from '../../../src/components/ui/Button'
import { WPSTD_FORM_FIELD_LABEL } from '../../../src/components/layout/WorkplaceStandardFormPanel'
import type { LocationRow } from '../../../src/types/organization'
import type { ChecklistScopeType } from '../types'

type Props = {
  scopeType: ChecklistScopeType | null
  locationId: string | null
  catalogueItemLabel: string | null
  otherLabel: string | null
  locations: LocationRow[]
  readOnly?: boolean
  onSave: (patch: {
    scopeType?: ChecklistScopeType | null
    locationId?: string | null
    catalogueItemLabel?: string | null
    otherLabel?: string | null
  }) => void | Promise<void>
}

const SCOPE_OPTIONS: { id: ChecklistScopeType; label: string; icon: React.ReactNode }[] = [
  { id: 'location', label: 'Lokasjon', icon: <MapPin className="h-4 w-4" /> },
  { id: 'catalogue_item', label: 'Katalogelement', icon: <Package className="h-4 w-4" /> },
  { id: 'other', label: 'Annet', icon: <HelpCircle className="h-4 w-4" /> },
]

export function ChecklistScopeSelector({
  scopeType,
  locationId,
  catalogueItemLabel,
  otherLabel,
  locations,
  readOnly = false,
  onSave,
}: Props) {
  const [catalogueDraft, setCatalogueDraft] = useState(catalogueItemLabel ?? '')
  const [otherDraft, setOtherDraft] = useState(otherLabel ?? '')

  const locationOptions = [
    { value: '', label: 'Velg lokasjon …' },
    ...locations.map((l) => ({ value: l.id, label: l.name })),
  ]

  const selectType = (next: ChecklistScopeType | null) => {
    if (readOnly) return
    onSave({ scopeType: next })
  }

  const flushCatalogue = () => {
    const next = catalogueDraft.trim() || null
    if (next !== catalogueItemLabel) onSave({ catalogueItemLabel: next })
  }

  const flushOther = () => {
    const next = otherDraft.trim() || null
    if (next !== otherLabel) onSave({ otherLabel: next })
  }

  return (
    <div className="space-y-3">
      <div>
        <p className={WPSTD_FORM_FIELD_LABEL}>Hva gjelder sjekklisten?</p>
        <p className="mb-2 text-xs text-neutral-500">
          Angi hva eller hvem denne runden er knyttet til — lokasjon, et element i
          en katalog (leverandør, maskin, kontrakt …) eller et fritekst-emne.
        </p>
        <div className="flex flex-wrap gap-2">
          {/* "Ikke satt" pill */}
          <Button
            size="sm"
            variant={scopeType === null ? 'primary' : 'secondary'}
            disabled={readOnly}
            onClick={() => selectType(null)}
            className={[
              'rounded-full',
              scopeType === null ? 'bg-neutral-800 hover:bg-neutral-700' : '',
              readOnly ? 'cursor-not-allowed opacity-60' : '',
            ].join(' ')}
          >
            Ikke satt
          </Button>

          {SCOPE_OPTIONS.map((opt) => (
            <Button
              key={opt.id}
              size="sm"
              variant={scopeType === opt.id ? 'primary' : 'secondary'}
              disabled={readOnly}
              onClick={() => selectType(opt.id)}
              icon={opt.icon}
              className={[
                'rounded-full',
                readOnly ? 'cursor-not-allowed opacity-60' : '',
              ].join(' ')}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {scopeType === 'location' && (
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL}>Lokasjon</label>
          <SearchableSelect
            value={locationId ?? ''}
            options={locationOptions}
            onChange={(v) => onSave({ locationId: v || null })}
            disabled={readOnly}
          />
        </div>
      )}

      {scopeType === 'catalogue_item' && (
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="scope-catalogue">
            Katalogelement
          </label>
          <p className="mb-1 text-xs text-neutral-500">
            F.eks. «Leverandør: Acme AS», «Maskin: Truck #7», «Kontrakt: 2024-087»
          </p>
          <StandardInput
            id="scope-catalogue"
            value={catalogueDraft}
            onChange={(e) => setCatalogueDraft(e.target.value)}
            onBlur={flushCatalogue}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            readOnly={readOnly}
            placeholder="Beskriv elementet …"
          />
        </div>
      )}

      {scopeType === 'other' && (
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="scope-other">
            Emne
          </label>
          <StandardInput
            id="scope-other"
            value={otherDraft}
            onChange={(e) => setOtherDraft(e.target.value)}
            onBlur={flushOther}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            readOnly={readOnly}
            placeholder="Beskriv emnet …"
          />
        </div>
      )}
    </div>
  )
}
