// Studio Builder — Advanced-mode property form generator.
//
// Renders a PropertySchema (from a kind's registration) as a form. Mirrors
// the existing WizardField renderer in src/components/wizard/WizardModal.tsx
// but is decoupled from the wizard step model so the inspector can mount
// fields directly without a wrapping modal.
//
// PropertyField kinds that need bespoke surfaces (rich-text-embed,
// layout-embed, law-ref-picker) are stubbed here and surface a clear
// "TODO: implement in Phase 2a" panel. Phase 1 only needs the leaf
// kinds — text / textarea / number / toggle / select / radio-cards /
// checkbox-group — to be functional.
//
// Spec: specs/studio-builder.md §4 + §5 Phase 0 Task 0.4.

import type { ReactNode } from 'react'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import { ToggleSwitch } from '../../components/ui/FormToggles'
import { WPSTD_FORM_FIELD_LABEL } from '../../components/layout/WorkplaceStandardFormPanel'
import type { PropertyField, PropertySchema } from './studioTypes'

type Values = Record<string, unknown>

export type PropertyFormGeneratorProps = {
  schema: PropertySchema
  values: Values
  onChange: (next: Values) => void
  /** When true, fields render disabled (preview / locked rows). */
  readonly?: boolean
}

export function PropertyFormGenerator({
  schema,
  values,
  onChange,
  readonly = false,
}: PropertyFormGeneratorProps): ReactNode {
  const setField = (id: string, value: unknown) => {
    onChange({ ...values, [id]: value })
  }

  return (
    <div className="space-y-4">
      {schema.fields.map((field) => {
        if (field.showWhen && !field.showWhen(values)) return null
        return (
          <FieldRow
            key={field.id}
            field={field}
            value={values[field.id]}
            onChange={(v) => setField(field.id, v)}
            readonly={readonly}
          />
        )
      })}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// Per-kind field renderer
// ────────────────────────────────────────────────────────────────────

function FieldRow({
  field,
  value,
  onChange,
  readonly,
}: {
  field: PropertyField
  value: unknown
  onChange: (v: unknown) => void
  readonly: boolean
}): ReactNode {
  const labelEl = (
    <label className={WPSTD_FORM_FIELD_LABEL} htmlFor={`studio-field-${field.id}`}>
      {field.label}
      {field.required ? <span className="ml-0.5 text-neutral-600 font-bold">*</span> : null}
    </label>
  )

  const hintEl = field.hint ? <p className="mt-1 text-xs text-neutral-500">{field.hint}</p> : null

  if (field.kind === 'text') {
    return (
      <div>
        {labelEl}
        <StandardInput
          id={`studio-field-${field.id}`}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={readonly}
          className="mt-1.5"
        />
        {hintEl}
      </div>
    )
  }

  if (field.kind === 'textarea') {
    return (
      <div>
        {labelEl}
        <StandardTextarea
          id={`studio-field-${field.id}`}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={readonly}
          className="mt-1.5"
        />
        {hintEl}
      </div>
    )
  }

  if (field.kind === 'number') {
    return (
      <div>
        {labelEl}
        <StandardInput
          id={`studio-field-${field.id}`}
          type="number"
          value={value == null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          disabled={readonly}
          className="mt-1.5"
        />
        {hintEl}
      </div>
    )
  }

  if (field.kind === 'toggle') {
    // ToggleSwitch doesn't accept a disabled prop today; readonly is rendered
    // as a pointer-events-none wrapper. Phase 1 adds a proper disabled state
    // to the primitive if needed.
    return (
      <div className="flex items-center justify-between gap-3">
        <div>
          {labelEl}
          {hintEl}
        </div>
        <div className={readonly ? 'pointer-events-none opacity-60' : ''}>
          <ToggleSwitch
            checked={value === true}
            onChange={(v) => onChange(v)}
            label={field.label}
          />
        </div>
      </div>
    )
  }

  if (field.kind === 'select') {
    return (
      <div>
        {labelEl}
        <SearchableSelect
          value={typeof value === 'string' ? value : ''}
          onChange={(v) => onChange(v)}
          options={field.options}
          disabled={readonly}
          className="mt-1.5"
        />
        {hintEl}
      </div>
    )
  }

  if (field.kind === 'radio-cards') {
    return (
      <div>
        {labelEl}
        <div className="mt-1.5 space-y-2">
          {field.options.map((opt) => {
            const checked = value === opt.value
            return (
              <label
                key={opt.value}
                className={
                  'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ' +
                  (checked
                    ? 'border-[#1a3d32] bg-[#e7efe9]/40'
                    : 'border-neutral-200/80 bg-white hover:border-[#1a3d32]/40')
                }
              >
                <input
                  type="radio"
                  name={`studio-field-${field.id}`}
                  checked={checked}
                  onChange={() => onChange(opt.value)}
                  disabled={readonly}
                  className="mt-1 accent-[#1a3d32]"
                />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-neutral-900">{opt.label}</span>
                  <p className="mt-0.5 text-xs text-neutral-600">{opt.description}</p>
                </div>
              </label>
            )
          })}
        </div>
        {hintEl}
      </div>
    )
  }

  if (field.kind === 'checkbox-group') {
    const arr = Array.isArray(value) ? (value as string[]) : []
    return (
      <div>
        {labelEl}
        <div className="mt-1.5 space-y-1">
          {field.options.map((opt) => {
            const checked = arr.includes(opt.value)
            return (
              <label key={opt.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = checked ? arr.filter((v) => v !== opt.value) : [...arr, opt.value]
                    onChange(next)
                  }}
                  disabled={readonly}
                  aria-label={opt.label}
                  className="accent-[#1a3d32]"
                />
                {opt.label}
              </label>
            )
          })}
        </div>
        {hintEl}
      </div>
    )
  }

  // Bespoke kinds — stubbed until Phase 2a wires them properly.
  if (
    field.kind === 'law-ref-picker' ||
    field.kind === 'preset-picker' ||
    field.kind === 'rich-text-embed' ||
    field.kind === 'layout-embed'
  ) {
    return (
      <div>
        {labelEl}
        <div className="mt-1.5 rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 py-3 text-xs text-neutral-500">
          <code className="font-mono">{field.kind}</code> renderes i Phase 2a — embedder-kontrakten avgjør om feltet mounter TipTap, dashboard_layouts widget, eller en picker.
        </div>
        {hintEl}
      </div>
    )
  }

  // Exhaustiveness guard — TS verifies all branches above. The `void`
  // reference silences noUnusedLocals; the assignment is what enforces
  // the compile-time check.
  const _exhaustive: never = field
  void _exhaustive
  return null
}
