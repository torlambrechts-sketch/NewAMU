// ComplianceCreateForm — slide panel for creating a new checklist execution.
// Templates passed in are already filtered to the active pack; the form does
// not branch on pack identity.

import { useEffect, useState } from 'react'
import { FormModal } from '../../src/template'
import { Button } from '../../src/components/ui/Button'
import { StandardInput } from '../../src/components/ui/Input'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'
import type {
  ComplianceAssignableUser,
  ComplianceTemplateRow,
} from './types'

type CreatePayload = {
  templateId: string
  title: string
  scheduledFor?: string
  assignedTo?: string
}

type Props = {
  open: boolean
  onClose: () => void
  templates: ComplianceTemplateRow[]
  assignableUsers: ComplianceAssignableUser[]
  onCreate: (payload: CreatePayload) => Promise<void>
}

const EMPTY_FORM = {
  templateId: '',
  title: '',
  scheduledFor: '',
  assignedTo: '',
}

export function ComplianceCreateForm({
  open,
  onClose,
  templates,
  assignableUsers,
  onCreate,
}: Props) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  // Default the form to the first template + its name when the panel opens
  // or the available templates change underneath.
  useEffect(() => {
    if (!open) return
    if (templates.length === 0) return
    setForm((prev) => {
      if (prev.templateId && templates.some((t) => t.id === prev.templateId)) {
        return prev
      }
      const first = templates[0]
      return { ...prev, templateId: first.id, title: prev.title || first.name }
    })
  }, [open, templates])

  const templateOptions = templates.map((t) => ({ value: t.id, label: t.name }))
  const userOptions = [
    { value: '', label: '(Ingen)' },
    ...assignableUsers.map((u) => ({ value: u.id, label: u.displayName })),
  ]

  const canSubmit =
    !submitting && form.templateId.length > 0 && form.title.trim().length > 0

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await onCreate({
        templateId: form.templateId,
        title: form.title.trim(),
        scheduledFor: form.scheduledFor || undefined,
        assignedTo: form.assignedTo || undefined,
      })
      setForm(EMPTY_FORM)
    } finally {
      setSubmitting(false)
    }
  }

  const optionalTag = (
    <span className="ml-1.5 font-normal normal-case tracking-normal text-neutral-400">
      Valgfri
    </span>
  )

  return (
    <FormModal
      open={open}
      onClose={onClose}
      titleId="form-create-compliance-checklist"
      title="Ny utførelse"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            Opprett
          </Button>
        </div>
      }
    >
      <div className="-mx-6 -mt-8 sm:-mx-8">
        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Hvilken mal skal brukes?</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Mal</p>
            <SearchableSelect
              options={templateOptions}
              value={form.templateId}
              onChange={(value) => {
                const t = templates.find((x) => x.id === value)
                setForm((prev) => ({
                  ...prev,
                  templateId: value,
                  title: prev.title.trim().length === 0 && t ? t.name : prev.title,
                }))
              }}
              placeholder="Velg mal …"
              className="mt-1.5"
            />
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Hva er tittelen på utførelsen?</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Tittel</p>
            <StandardInput
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="F.eks. Q1 — Produksjonshall"
              className="mt-1.5"
            />
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Når skal utførelsen gjennomføres?</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>
              Planlagt tidspunkt {optionalTag}
            </p>
            <StandardInput
              type="datetime-local"
              value={form.scheduledFor}
              onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Hvem er ansvarlig?</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>
              Tildelt til {optionalTag}
            </p>
            <SearchableSelect
              options={userOptions}
              value={form.assignedTo}
              onChange={(value) => setForm({ ...form, assignedTo: value })}
              placeholder="Velg ansvarlig …"
              className="mt-1.5"
            />
          </div>
        </div>
      </div>
    </FormModal>
  )
}
