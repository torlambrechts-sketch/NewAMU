// RegisterRecordForm — schema-driven form rendered inside a SlidePanel
// when authoring/editing a register_record.
//
// Reads `type.metadataSchema.fields` and renders a RegisterFieldInput
// per field. Owners + reviewDueAt + status sit at the bottom as
// engine-level fields (always present regardless of type schema).
//
// Validates required fields client-side; the DB stays permissive so a
// schema migration on the type doesn't invalidate historical rows.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../ui/Button'
import { SlidePanel } from '../layout/SlidePanel'
import { SearchableSelect } from '../ui/SearchableSelect'
import { StandardInput } from '../ui/Input'
import { WPSTD_FORM_FIELD_LABEL } from '../layout/WorkplaceStandardFormPanel'
import { WarningBox } from '../ui/AlertBox'
import { RegisterFieldInput } from './RegisterFieldInput'
import type {
  RegisterRecord,
  RegisterRecordStatus,
  RegisterType,
} from '../../types/registers'

type Props = {
  open: boolean
  type: RegisterType
  /** null = new record; non-null = editing existing. */
  record: RegisterRecord | null
  onClose: () => void
  onSubmit: (payload: {
    values: Record<string, unknown>
    status: RegisterRecordStatus
    reviewDueAt: string | null
  }) => Promise<boolean | void>
  onDelete?: (record: RegisterRecord) => void | Promise<void>
}

const STATUS_OPTIONS: { value: RegisterRecordStatus; label: string }[] = [
  { value: 'active', label: 'Aktiv' },
  { value: 'draft', label: 'Utkast' },
  { value: 'archived', label: 'Arkivert' },
]

export function RegisterRecordForm({ open, type, record, onClose, onSubmit, onDelete }: Props) {
  const isEditing = record !== null
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [status, setStatus] = useState<RegisterRecordStatus>('active')
  const [reviewDueAt, setReviewDueAt] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [missingRequired, setMissingRequired] = useState<string[]>([])
  const lastRecordKey = useRef<string | null>(null)

  // Re-sync local form state whenever the record being edited changes.
  useEffect(() => {
    const key = record ? `r:${record.id}` : `new:${type.id}`
    if (lastRecordKey.current === key) return
    lastRecordKey.current = key
    if (record) {
      setValues({ ...record.values })
      setStatus(record.status)
      setReviewDueAt(record.reviewDueAt ?? '')
    } else {
      setValues({})
      setStatus('active')
      setReviewDueAt('')
    }
    setMissingRequired([])
  }, [record, type.id])

  const requiredKeys = useMemo(
    () => type.metadataSchema.fields.filter((f) => f.required).map((f) => f.key),
    [type.metadataSchema.fields],
  )

  const handleSubmit = async () => {
    const missing = requiredKeys.filter((k) => {
      const v = values[k]
      if (v == null) return true
      if (typeof v === 'string' && v.trim() === '') return true
      if (Array.isArray(v) && v.length === 0) return true
      return false
    })
    setMissingRequired(missing)
    if (missing.length > 0) return
    setSubmitting(true)
    try {
      const ok = await onSubmit({
        values,
        status,
        reviewDueAt: reviewDueAt || null,
      })
      if (ok !== false) onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="register-record-form"
      title={isEditing ? `Rediger ${type.name}` : `Ny ${type.name.toLowerCase()}`}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {isEditing && onDelete && record ? (
            <Button
              type="button"
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
              onClick={() => {
                if (!window.confirm('Slette denne raden?')) return
                void onDelete(record)
              }}
              disabled={submitting}
            >
              Slett
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Avbryt
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleSubmit()}
              disabled={submitting}
            >
              {submitting ? 'Lagrer …' : isEditing ? 'Lagre endringer' : 'Opprett'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {missingRequired.length > 0 ? (
          <WarningBox>
            Mangler påkrevde felter: {missingRequired.join(', ')}.
          </WarningBox>
        ) : null}

        {type.metadataSchema.fields.map((field) => (
          <RegisterFieldInput
            key={field.key}
            field={field}
            value={values[field.key]}
            onChange={(next) =>
              setValues((s) => ({ ...s, [field.key]: next }))
            }
            disabled={submitting}
          />
        ))}

        {/* Engine-level fields ─ always present, after schema fields */}
        <div className="border-t border-neutral-200 pt-5">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
            Status og oppfølging
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <span className={WPSTD_FORM_FIELD_LABEL}>Status</span>
              <div className="mt-1.5">
                <SearchableSelect
                  value={status}
                  options={STATUS_OPTIONS}
                  onChange={(v) => setStatus(v as RegisterRecordStatus)}
                />
              </div>
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="register-review-due">
                Neste gjennomgang
              </label>
              <p className="mt-0.5 text-xs text-neutral-500">
                Gir et flagg på dashbordet når den nærmer seg.
              </p>
              <StandardInput
                id="register-review-due"
                type="date"
                value={reviewDueAt}
                onChange={(e) => setReviewDueAt(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
        </div>
      </div>
    </SlidePanel>
  )
}
