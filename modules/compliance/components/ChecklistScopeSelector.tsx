// ChecklistScopeSelector — lets the user declare what a checklist execution is *about*.
// Three modes: a registered location, a free-text catalogue item (e.g. an external
// vendor, a machine, a contract), or a free-text "other" subject.
// The component commits on each change so the caller only needs an onSave callback.

import { useState } from 'react'
import { CheckCircle2, Circle, HelpCircle, MapPin, Package } from 'lucide-react'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { StandardInput } from '../../../src/components/ui/Input'
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
        {/* Segmented group — matches YesNoToggle / checklist response buttons */}
        <div className={['flex overflow-hidden rounded-md border border-neutral-300', readOnly ? 'opacity-60' : ''].join(' ')}>
          {/* "Ikke satt" */}
          <button
            type="button"
            disabled={readOnly}
            onClick={() => selectType(null)}
            style={scopeType === null
              ? { backgroundColor: '#374151', color: 'white' }
              : { backgroundColor: 'white', color: '#9ca3af' }}
            className="flex flex-1 items-center justify-center gap-2 px-4 py-3 text-xs font-medium transition-colors"
          >
            {scopeType === null
              ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              : <Circle className="h-3.5 w-3.5 shrink-0" />}
            Ikke satt
          </button>

          {SCOPE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={readOnly}
              onClick={() => selectType(opt.id)}
              style={scopeType === opt.id
                ? { backgroundColor: '#1a3d32', color: 'white' }
                : { backgroundColor: 'white', color: '#9ca3af' }}
              className="flex flex-1 items-center justify-center gap-2 border-l border-neutral-300 px-4 py-3 text-xs font-medium transition-colors"
            >
              {scopeType === opt.id
                ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                : opt.icon}
              {opt.label}
            </button>
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
