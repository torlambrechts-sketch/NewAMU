// AlertsCreateForm — slide panel for committee-created alert cases.
//
// The public submission flow uses public_submit_alert RPC (anonymous).
// This form is the *committee* path: a logged-in admin / committee member
// records a case received off-channel (phone, walk-in, paper). The DB
// trigger handles confidentiality + acknowledgement_due_at + snapshots
// from the template.

import { useEffect, useState } from 'react'
import { FormModal } from '../../../src/template'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_ROW_GRID,
} from '../../../src/components/layout/WorkplaceStandardFormPanel'
import type { ResolvedAlertTemplate } from '../types'

export type AlertsCreatePayload = {
  templateId: string
  templateKind: 'system' | 'org'
  kind: 'whistleblowing' | 'gdpr_breach' | 'hms_incident' | 'security_incident' | 'ethical_concern'
  title: string
  description: string
  occurredAtText?: string
  isAnonymous: boolean
  reporterContact?: string
}

type Props = {
  open: boolean
  onClose: () => void
  templates: ResolvedAlertTemplate[]
  /** Pre-selected template id (when invoked from the per-template page). */
  defaultTemplateId?: string | null
  onCreate: (payload: AlertsCreatePayload) => Promise<void>
}

const EMPTY = {
  templateId: '',
  title: '',
  description: '',
  occurredAtText: '',
  isAnonymous: false,
  reporterContact: '',
}

export function AlertsCreateForm({ open, onClose, templates, defaultTemplateId, onCreate }: Props) {
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    if (templates.length === 0) return
    setForm((prev) => {
      const want = defaultTemplateId && templates.find((t) => t.id === defaultTemplateId)
        ? defaultTemplateId
        : prev.templateId && templates.some((t) => t.id === prev.templateId)
          ? prev.templateId
          : templates[0].id
      const tpl = templates.find((t) => t.id === want)!
      return {
        ...prev,
        templateId: want,
        title: prev.title.trim().length === 0 ? tpl.name : prev.title,
      }
    })
  }, [open, templates, defaultTemplateId])

  const selected = templates.find((t) => t.id === form.templateId) ?? null
  const allowsAnonymous = selected?.allowsAnonymous ?? true
  const canSubmit =
    !submitting && form.templateId.length > 0 && form.title.trim().length > 0 && (form.isAnonymous || !!form.description.trim())

  const handleSubmit = async () => {
    if (!canSubmit || !selected) return
    setSubmitting(true)
    try {
      await onCreate({
        templateId: selected.id,
        templateKind: selected.kind,
        kind: selected.templateKind,
        title: form.title.trim(),
        description: form.description.trim(),
        occurredAtText: form.occurredAtText.trim() || undefined,
        isAnonymous: form.isAnonymous,
        reporterContact: form.isAnonymous ? undefined : form.reporterContact.trim() || undefined,
      })
      setForm(EMPTY)
    } finally {
      setSubmitting(false)
    }
  }

  const templateOptions = templates.map((t) => ({ value: t.id, label: t.name }))
  const optionalTag = (
    <span className="ml-1.5 font-normal normal-case tracking-normal text-neutral-400">Valgfri</span>
  )

  return (
    <FormModal
      open={open}
      onClose={onClose}
      titleId="form-create-alert-case"
      title="Ny sak"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="button" variant="primary" onClick={() => void handleSubmit()} disabled={!canSubmit}>
            Opprett
          </Button>
        </div>
      }
    >
      <div className="-mx-6 -mt-8 sm:-mx-8">
        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Hvilken mal beskriver saken?</p>
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
            {selected ? (
              <p className="mt-1.5 text-xs text-neutral-500">
                Konfidensialitet: <strong>{selected.defaultConfidentialityLevel}</strong> · Oppbevaring: <strong>{selected.retentionYears} år</strong> · Bekreftelsesfrist: <strong>{selected.acknowledgementDueDays} virkedager</strong>
              </p>
            ) : null}
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Kort tittel?</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Tittel</p>
            <StandardInput
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="F.eks. Mulig brudd på personvern"
              className="mt-1.5"
            />
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Beskriv forholdet — fra varsleren eller fra mottakssamtalen.</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Beskrivelse</p>
            <StandardTextarea
              rows={5}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Hva har skjedd? Hvilke regler eller etiske normer mener varsleren er brutt?"
              className="mt-1.5"
            />
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Når skjedde det? Fri tekst.</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Tidspunkt {optionalTag}</p>
            <StandardInput
              value={form.occurredAtText}
              onChange={(e) => setForm({ ...form, occurredAtText: e.target.value })}
              placeholder="«Forrige uke», «25. mars 2026», eller «pågående»"
              className="mt-1.5"
            />
          </div>
        </div>

        {allowsAnonymous ? (
          <div className={WPSTD_FORM_ROW_GRID}>
            <p className={WPSTD_FORM_LEAD}>
              Skal varsleren forbli anonym? Identitet er uforanderlig etter innsending.
            </p>
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Anonymitet</p>
              <div className="mt-1.5 space-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={form.isAnonymous}
                    onChange={() => setForm({ ...form, isAnonymous: true, reporterContact: '' })}
                  />
                  Anonym
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={!form.isAnonymous}
                    onChange={() => setForm({ ...form, isAnonymous: false })}
                  />
                  Identifisert — varsler har oppgitt kontakt
                </label>
                {!form.isAnonymous ? (
                  <StandardInput
                    value={form.reporterContact}
                    onChange={(e) => setForm({ ...form, reporterContact: e.target.value })}
                    placeholder="e-post eller telefon"
                    className="mt-1"
                  />
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </FormModal>
  )
}
