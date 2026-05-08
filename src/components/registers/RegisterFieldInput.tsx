// RegisterFieldInput — schema-driven input renderer.
// Switches on field.kind and dispatches to the right primitive.
// Used by RegisterRecordForm. The advanced kinds (doc_ref, location_ref)
// are placeholders for now — they'll get proper pickers when consuming
// surfaces need them.

import { ToggleSwitch } from '../ui/FormToggles'
import { StandardInput } from '../ui/Input'
import { SearchableSelect } from '../ui/SearchableSelect'
import { WPSTD_FORM_FIELD_LABEL } from '../layout/WorkplaceStandardFormPanel'
import type { RegisterField } from '../../types/registers'

type Props = {
  field: RegisterField
  value: unknown
  onChange: (next: unknown) => void
  disabled?: boolean
}

export function RegisterFieldInput({ field, value, onChange, disabled }: Props) {
  return (
    <div>
      <label className={WPSTD_FORM_FIELD_LABEL} htmlFor={`register-field-${field.key}`}>
        {field.label}
        {field.required ? <span className="ml-0.5 text-red-600">*</span> : null}
      </label>
      {field.hint ? (
        <p className="mt-0.5 text-xs text-neutral-500">{field.hint}</p>
      ) : null}
      <div className="mt-1.5">
        <FieldByKind field={field} value={value} onChange={onChange} disabled={disabled} />
      </div>
    </div>
  )
}

function FieldByKind({ field, value, onChange, disabled }: Props) {
  const inputId = `register-field-${field.key}`
  switch (field.kind) {
    case 'text':
      return (
        <StandardInput
          id={inputId}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )
    case 'number':
      return (
        <StandardInput
          id={inputId}
          type="number"
          value={
            typeof value === 'number'
              ? value
              : typeof value === 'string' && value !== ''
                ? value
                : ''
          }
          onChange={(e) => {
            const raw = e.target.value
            if (raw === '') {
              onChange(null)
              return
            }
            const n = Number(raw)
            onChange(Number.isNaN(n) ? null : n)
          }}
          disabled={disabled}
        />
      )
    case 'date':
      return (
        <StandardInput
          id={inputId}
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
        />
      )
    case 'boolean':
      return (
        <ToggleSwitch
          checked={Boolean(value)}
          onChange={(v) => onChange(v)}
          label={field.label}
        />
      )
    case 'select': {
      const options = (field.options ?? []).map((o) => ({
        value: o.value,
        label: o.label,
      }))
      return (
        <SearchableSelect
          value={typeof value === 'string' ? value : ''}
          options={[{ value: '', label: '— ikke valgt —' }, ...options]}
          onChange={(v) => onChange(v || null)}
          disabled={disabled}
        />
      )
    }
    case 'select_multi': {
      const selected = new Set(Array.isArray(value) ? (value as unknown[]).filter((x): x is string => typeof x === 'string') : [])
      const options = field.options ?? []
      return (
        <div className="space-y-1.5 rounded-md border border-neutral-300 bg-white p-2.5">
          {options.length === 0 ? (
            <p className="text-xs text-neutral-500">Ingen valg konfigurert.</p>
          ) : (
            options.map((o) => {
              const on = selected.has(o.value)
              return (
                <label
                  key={o.value}
                  className="flex cursor-pointer items-start gap-2 rounded-sm px-1.5 py-1 text-sm text-neutral-800 hover:bg-neutral-50"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = new Set(selected)
                      if (e.target.checked) next.add(o.value)
                      else next.delete(o.value)
                      onChange(Array.from(next))
                    }}
                    className="mt-1"
                  />
                  <span>{o.label}</span>
                </label>
              )
            })
          )}
        </div>
      )
    }
    case 'doc_ref':
    case 'location_ref':
      // Placeholders — proper pickers land when first consumer needs them.
      return (
        <StandardInput
          id={inputId}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder={field.kind === 'doc_ref' ? 'Dokument-id (placeholder)' : 'Lokasjon-id (placeholder)'}
          disabled={disabled}
        />
      )
  }
}
