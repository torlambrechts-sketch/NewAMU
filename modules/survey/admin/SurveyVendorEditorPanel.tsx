// SurveyVendorEditorPanel — slide-panel form for create + edit of a vendor
// row. Drives both flows from a single component: when `vendor` is null we
// call onCreate, otherwise onUpdate with the diff.
//
// Mirrors the create/edit pattern used by SurveyPackEditorPanel.

import { useState } from 'react'
import { FormModal } from '../../../src/template'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { SearchableSelect, type SelectOption } from '../../../src/components/ui/SearchableSelect'
import { WarningBox } from '../../../src/components/ui/AlertBox'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_ROW_GRID,
} from '../../../src/components/layout/WorkplaceStandardFormPanel'
import type { VendorRow, VendorStatus } from '../types'
import { VENDOR_STATUS_LABEL } from '../types'
import type { CreateVendorInput, UpdateVendorInput } from '../useVendors'

type Props = {
  vendor: VendorRow | null
  onClose: () => void
  onCreate: (input: CreateVendorInput) => Promise<string | null>
  onUpdate: (input: UpdateVendorInput) => Promise<void>
}

const STATUS_OPTIONS: SelectOption[] = (
  ['active', 'inactive', 'offboarded'] as VendorStatus[]
).map((v) => ({ value: v, label: VENDOR_STATUS_LABEL[v] }))

export function SurveyVendorEditorPanel({ vendor, onClose, onCreate, onUpdate }: Props) {
  const isEdit = vendor !== null
  const [displayName, setDisplayName] = useState(vendor?.display_name ?? '')
  const [orgNumber, setOrgNumber] = useState(vendor?.org_number ?? '')
  const [primaryEmail, setPrimaryEmail] = useState(vendor?.primary_email ?? '')
  const [contactName, setContactName] = useState(vendor?.contact_name ?? '')
  const [status, setStatus] = useState<VendorStatus>(vendor?.status ?? 'active')
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const canSubmit = !submitting && displayName.trim().length > 0

  const handleSave = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setLocalError(null)
    try {
      if (isEdit && vendor) {
        await onUpdate({
          id: vendor.id,
          displayName: displayName.trim(),
          orgNumber: orgNumber.trim() || null,
          primaryEmail: primaryEmail.trim() || null,
          contactName: contactName.trim() || null,
          status,
        })
      } else {
        const newId = await onCreate({
          displayName: displayName.trim(),
          orgNumber: orgNumber.trim() || undefined,
          primaryEmail: primaryEmail.trim() || undefined,
          contactName: contactName.trim() || undefined,
        })
        if (!newId) {
          setLocalError('Kunne ikke opprette leverandør.')
          return
        }
      }
      onClose()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Kunne ikke lagre.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormModal
      open
      onClose={onClose}
      titleId="form-edit-survey-vendor"
      title={isEdit ? `Rediger ${vendor?.display_name}` : 'Ny leverandør'}
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            disabled={!canSubmit}
          >
            {isEdit ? 'Lagre' : 'Opprett'}
          </Button>
        </div>
      }
    >
      <div className="-mx-6 -mt-8 sm:-mx-8">
        {localError ? (
          <div className="px-4 pt-4 md:px-5">
            <WarningBox>{localError}</WarningBox>
          </div>
        ) : null}

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Visningsnavn brukes i lister og rapporter.</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Navn</p>
            <StandardInput
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1.5"
              placeholder="F.eks. Acme Vask AS"
            />
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Organisasjonsnummer (Brønnøysund) — valgfri.</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Org.nr</p>
            <StandardInput
              value={orgNumber}
              onChange={(e) => setOrgNumber(e.target.value)}
              className="mt-1.5"
              placeholder="999 999 999"
            />
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Navn på primær kontaktperson hos leverandør.</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Kontaktperson</p>
            <StandardInput
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>E-postadresse for utsendelse av leverandørundersøkelser.</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>E-post</p>
            <StandardInput
              type="email"
              value={primaryEmail}
              onChange={(e) => setPrimaryEmail(e.target.value)}
              className="mt-1.5"
              placeholder="kontakt@leverandor.no"
            />
          </div>
        </div>

        {isEdit ? (
          <div className={WPSTD_FORM_ROW_GRID}>
            <p className={WPSTD_FORM_LEAD}>
              Inaktive eller avsluttede leverandører kan ikke motta nye undersøkelser.
            </p>
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Status</p>
              <div className="mt-1.5">
                <SearchableSelect
                  value={status}
                  options={STATUS_OPTIONS}
                  onChange={(v) => setStatus(v as VendorStatus)}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </FormModal>
  )
}
