// ControlEditorPanel — slide-panel create / edit for an internal_control.
//
// Used by both ControlsHubLanding (new control) and ControlDetailPage
// (edit existing). System controls are read-only — the panel surfaces
// a warning and disables the save action. Uses design-system primitives.

import { useEffect, useState } from 'react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { FormModal } from '../../template'
import { Button } from '../../src/components/ui/Button'
import { StandardInput } from '../../src/components/ui/Input'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import { useInternalControls } from './useInternalControls'
import {
  CONTROL_FAMILIES,
  CONTROL_FREQUENCY_HINTS,
  CONTROL_STATUSES,
} from './types'
import type {
  ControlFamily,
  ControlFrequencyHint,
  ControlStatus,
  InternalControlRow,
} from './types'

type Mode = 'create' | 'edit'

type Props = {
  open: boolean
  mode: Mode
  /** Required for mode='edit'. */
  control?: InternalControlRow | null
  onClose: () => void
  onSaved?: (id: string) => void | Promise<void>
}

const FAMILY_OPTIONS = CONTROL_FAMILIES.map((f) => ({ value: f, label: f }))
const STATUS_OPTIONS = CONTROL_STATUSES.map((s) => ({ value: s, label: s }))
const FREQUENCY_OPTIONS = [
  { value: '', label: '— ingen —' },
  ...CONTROL_FREQUENCY_HINTS.map((f) => ({ value: f, label: f })),
]

export function ControlEditorPanel({
  open,
  mode,
  control,
  onClose,
  onSaved,
}: Props) {
  const { supabase } = useOrgSetupContext()
  const { createControl, updateControl } = useInternalControls({ supabase })

  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [family, setFamily] = useState<ControlFamily>('preventive')
  const [frequency, setFrequency] = useState<ControlFrequencyHint | ''>('')
  const [ownerRole, setOwnerRole] = useState('')
  const [status, setStatus] = useState<ControlStatus>('draft')
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && control) {
      setSlug(control.slug)
      setName(control.name)
      setPurpose(control.purpose)
      setFamily(control.control_family)
      setFrequency(control.frequency_hint ?? '')
      setOwnerRole(control.owner_role ?? '')
      setStatus(control.status)
    } else {
      setSlug('')
      setName('')
      setPurpose('')
      setFamily('preventive')
      setFrequency('')
      setOwnerRole('')
      setStatus('draft')
    }
    setLocalError(null)
  }, [open, mode, control])

  const isSystem = mode === 'edit' && control?.is_system === true

  const handleSave = async () => {
    setLocalError(null)
    if (!name.trim()) {
      setLocalError('Navn er påkrevd.')
      return
    }
    if (mode === 'create' && !slug.trim()) {
      setLocalError('Slug er påkrevd.')
      return
    }
    if (isSystem) {
      setLocalError('Systemkontroller kan ikke endres.')
      return
    }
    setSaving(true)
    try {
      if (mode === 'create') {
        const id = await createControl({
          slug: slug.trim(),
          name: name.trim(),
          purpose: purpose.trim(),
          control_family: family,
          frequency_hint: frequency === '' ? null : frequency,
          owner_role: ownerRole.trim() || null,
          status,
        })
        if (id) {
          await onSaved?.(id)
          onClose()
        }
      } else if (control) {
        await updateControl({
          id: control.id,
          name: name.trim(),
          purpose: purpose.trim(),
          control_family: family,
          frequency_hint: frequency === '' ? null : frequency,
          owner_role: ownerRole.trim() || null,
          status,
        })
        await onSaved?.(control.id)
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open={open}
      title={mode === 'create' ? 'Ny kontroll' : 'Rediger kontroll'}
      description={
        isSystem
          ? 'Dette er en systemkontroll. Du kan ikke endre den fra appen.'
          : 'Definer hva kontrollen mitigerer og hvor ofte den må gjennomføres.'
      }
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={saving || isSystem}
          >
            {saving ? 'Lagrer…' : 'Lagre'}
          </Button>
        </>
      }
    >
      {localError ? (
        <div className="rounded border border-rose-200 bg-rose-50 p-2 text-sm text-rose-800">
          {localError}
        </div>
      ) : null}
      <label className="block text-sm">
        <span className="text-neutral-700">Slug</span>
        <StandardInput
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          disabled={mode === 'edit'}
          placeholder="kontroll-min-prosess"
          className="mt-1 font-mono"
        />
      </label>
      <label className="block text-sm">
        <span className="text-neutral-700">Navn</span>
        <StandardInput
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isSystem}
          className="mt-1"
        />
      </label>
      <label className="block text-sm">
        <span className="text-neutral-700">Formål</span>
        <StandardTextarea
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          disabled={isSystem}
          rows={3}
          className="mt-1"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-neutral-700">Familie</span>
          <SearchableSelect
            value={family}
            options={FAMILY_OPTIONS}
            onChange={(v) => setFamily(v as ControlFamily)}
            disabled={isSystem}
            className="mt-1"
          />
        </label>
        <label className="block text-sm">
          <span className="text-neutral-700">Frekvens</span>
          <SearchableSelect
            value={frequency}
            options={FREQUENCY_OPTIONS}
            onChange={(v) => setFrequency(v as ControlFrequencyHint | '')}
            disabled={isSystem}
            className="mt-1"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-neutral-700">Eier-rolle</span>
          <StandardInput
            type="text"
            value={ownerRole}
            onChange={(e) => setOwnerRole(e.target.value)}
            disabled={isSystem}
            placeholder="hms_leder, dpo, amu_leder …"
            className="mt-1 font-mono"
          />
        </label>
        <label className="block text-sm">
          <span className="text-neutral-700">Status</span>
          <SearchableSelect
            value={status}
            options={STATUS_OPTIONS}
            onChange={(v) => setStatus(v as ControlStatus)}
            disabled={isSystem}
            className="mt-1"
          />
        </label>
      </div>
    </FormModal>
  )
}
