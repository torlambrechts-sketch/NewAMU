// BindingEditorPanel — create / configure an internal_control_binding.
//
// Slide-panel opened from the Bindings tab on ControlDetailPage. Lets
// the admin pick a source template across the seven module surfaces and
// set requirement kind + cadence override. Template-existence validation
// is enforced server-side by the M4 trigger; failures surface as toast.
// Uses design-system primitives per DESIGN_SYSTEM.md §3.

import { useEffect, useState } from 'react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { FormModal } from '../../../template'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { useControlBindings } from '../useControlBindings'
import {
  CONTROL_BINDING_REQUIREMENT_KINDS,
  CONTROL_BINDING_SOURCE_KINDS,
  CONTROL_FREQUENCY_HINTS,
} from '../types'
import type {
  ControlBindingRequirementKind,
  ControlBindingSourceKind,
  ControlBindingSourceTemplateTable,
  ControlFrequencyHint,
} from '../types'

type Props = {
  open: boolean
  controlId: string
  onClose: () => void
  onSaved?: (id: string) => void | Promise<void>
}

// Map each source_kind to its default template table. Admin can override.
const DEFAULT_TABLE_FOR_KIND: Record<
  ControlBindingSourceKind,
  ControlBindingSourceTemplateTable
> = {
  compliance_execution: 'compliance_checklist_templates',
  survey_response: 'survey_template_catalog',
  document_acknowledgement: 'document_system_templates',
  learning_completion: 'learning_courses',
  task_completion: 'task_template_catalog',
  meeting_protocol: 'meeting_system_templates',
  register_record: 'register_types',
  manual_evidence: '',
}

const SOURCE_KIND_LABELS: Record<ControlBindingSourceKind, string> = {
  compliance_execution: 'Sjekklist-utførelse',
  survey_response: 'Undersøkelses-svar',
  document_acknowledgement: 'Dokument-bekreftelse',
  learning_completion: 'Kursfullføring',
  task_completion: 'Lukket oppgave',
  meeting_protocol: 'Møteprotokoll',
  register_record: 'Registerpost',
  manual_evidence: 'Manuelt bevis',
}

const REQUIREMENT_LABELS: Record<ControlBindingRequirementKind, string> = {
  latest_within_cadence: 'Siste innen frekvens',
  count_within_period: 'Antall innen periode',
  exists: 'Eksisterer',
  signed: 'Signert',
}

const SOURCE_KIND_OPTIONS = CONTROL_BINDING_SOURCE_KINDS.map((k) => ({
  value: k,
  label: SOURCE_KIND_LABELS[k],
}))
const REQUIREMENT_OPTIONS = CONTROL_BINDING_REQUIREMENT_KINDS.map((k) => ({
  value: k,
  label: REQUIREMENT_LABELS[k],
}))
const CADENCE_OPTIONS = [
  { value: '', label: '— arv fra kontroll —' },
  ...CONTROL_FREQUENCY_HINTS.map((f) => ({ value: f, label: f })),
]

export function BindingEditorPanel({ open, controlId, onClose, onSaved }: Props) {
  const { supabase } = useOrgSetupContext()
  const { createBinding } = useControlBindings({ supabase })

  const [sourceKind, setSourceKind] = useState<ControlBindingSourceKind>(
    'compliance_execution',
  )
  const [templateTable, setTemplateTable] =
    useState<ControlBindingSourceTemplateTable>(
      DEFAULT_TABLE_FOR_KIND.compliance_execution,
    )
  const [templateId, setTemplateId] = useState('')
  const [templateSlug, setTemplateSlug] = useState('')
  const [requirementKind, setRequirementKind] =
    useState<ControlBindingRequirementKind>('latest_within_cadence')
  const [cadence, setCadence] = useState<ControlFrequencyHint | ''>('')
  const [requiredCount, setRequiredCount] = useState(1)
  const [periodMonths, setPeriodMonths] = useState(12)
  const [isRequired, setIsRequired] = useState(true)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSourceKind('compliance_execution')
    setTemplateTable(DEFAULT_TABLE_FOR_KIND.compliance_execution)
    setTemplateId('')
    setTemplateSlug('')
    setRequirementKind('latest_within_cadence')
    setCadence('')
    setRequiredCount(1)
    setPeriodMonths(12)
    setIsRequired(true)
    setNotes('')
    setLocalError(null)
  }, [open])

  // Sync default template table when the kind changes.
  useEffect(() => {
    setTemplateTable(DEFAULT_TABLE_FOR_KIND[sourceKind])
  }, [sourceKind])

  const handleSave = async () => {
    setLocalError(null)
    if (sourceKind !== 'manual_evidence' && !templateId.trim()) {
      setLocalError('Template-id er påkrevd for ikke-manuelle bindinger.')
      return
    }
    setSaving(true)
    try {
      const id = await createBinding({
        control_id: controlId,
        source_kind: sourceKind,
        source_template_table: templateTable,
        source_template_id:
          sourceKind === 'manual_evidence' ? '' : templateId.trim(),
        source_template_slug: templateSlug.trim() || null,
        requirement_kind: requirementKind,
        cadence_hint: cadence === '' ? null : cadence,
        required_count: requiredCount,
        period_months: periodMonths,
        is_required: isRequired,
        notes: notes.trim(),
      })
      if (id) {
        await onSaved?.(id)
        onClose()
      } else {
        setLocalError(
          'Lagring feilet. Sjekk at template-iden finnes i den valgte tabellen.',
        )
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open={open}
      title="Ny binding"
      description="Velg hvilken modulartefakt som teller som bevis for kontrollen."
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={saving}
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
        <span className="text-neutral-700">Kilde-type</span>
        <SearchableSelect
          value={sourceKind}
          options={SOURCE_KIND_OPTIONS}
          onChange={(v) => setSourceKind(v as ControlBindingSourceKind)}
          className="mt-1"
        />
      </label>
      {sourceKind !== 'manual_evidence' ? (
        <>
          <label className="block text-sm">
            <span className="text-neutral-700">Template-tabell</span>
            <StandardInput
              type="text"
              value={templateTable}
              onChange={(e) =>
                setTemplateTable(
                  e.target.value as ControlBindingSourceTemplateTable,
                )
              }
              className="mt-1 font-mono text-xs"
            />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-700">
              Template-id (uuid eller slug)
            </span>
            <StandardInput
              type="text"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              placeholder="f.eks. 0d0c5b…  eller  vernerunde-standard"
              className="mt-1 font-mono text-xs"
            />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-700">
              Template-slug (valgfri, diagnostisk)
            </span>
            <StandardInput
              type="text"
              value={templateSlug}
              onChange={(e) => setTemplateSlug(e.target.value)}
              className="mt-1 font-mono text-xs"
            />
          </label>
        </>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-neutral-700">Krav-type</span>
          <SearchableSelect
            value={requirementKind}
            options={REQUIREMENT_OPTIONS}
            onChange={(v) =>
              setRequirementKind(v as ControlBindingRequirementKind)
            }
            className="mt-1"
          />
        </label>
        <label className="block text-sm">
          <span className="text-neutral-700">Frekvens-override</span>
          <SearchableSelect
            value={cadence}
            options={CADENCE_OPTIONS}
            onChange={(v) => setCadence(v as ControlFrequencyHint | '')}
            className="mt-1"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-neutral-700">Antall (for count-baserte)</span>
          <StandardInput
            type="number"
            min={1}
            value={requiredCount}
            onChange={(e) => setRequiredCount(Number(e.target.value) || 1)}
            className="mt-1"
          />
        </label>
        <label className="block text-sm">
          <span className="text-neutral-700">Periode (mnd)</span>
          <StandardInput
            type="number"
            min={1}
            value={periodMonths}
            onChange={(e) => setPeriodMonths(Number(e.target.value) || 12)}
            className="mt-1"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <StandardInput
          type="checkbox"
          checked={isRequired}
          onChange={(e) => setIsRequired(e.target.checked)}
          className="size-4"
        />
        <span className="text-neutral-700">
          Påkrevd binding (må være oppfylt for at kontrollen er på sporet)
        </span>
      </label>
      <label className="block text-sm">
        <span className="text-neutral-700">Notater</span>
        <StandardTextarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1"
        />
      </label>
    </FormModal>
  )
}
