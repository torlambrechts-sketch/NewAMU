// ScorecardFilterBar — a flat, always-visible filter row with small-caps
// labels and bordered selects on a cream surface.
//
// Modelled on the platform-admin "scorecard" reference layout: each field
// is a labeled control (single select, multi select, date range, or text),
// rendered side-by-side in a responsive grid. The right edge has an
// optional `rightSlot` for an action toggle.
//
// Generic UI primitive — no domain coupling. The dashboard surfaces this
// via `DashboardScorecardFilterBar`, which maps `DashboardDimension[]` +
// `DashboardFilter[]` into `ScorecardField[]`.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, X } from 'lucide-react'

export const SCORECARD_BAR_BG = '#EFE8DC'

export type ScorecardOption = {
  value: string
  label: string
}

type FieldBase = {
  /**
   * Optional extras rendered to the right of the field control, in the
   * same row. Used by `DashboardScorecardFilterBar` to surface
   * additional-operator chips + a "+ Filter" button per dimension.
   */
  extras?: ReactNode
}

export type ScorecardField =
  | (FieldBase & {
      id: string
      label: string
      kind: 'select'
      value: string | null
      options: ScorecardOption[]
      placeholder?: string
      onChange: (next: string | null) => void
      /** Show an X button to clear the value. Defaults to false. */
      clearable?: boolean
    })
  | (FieldBase & {
      id: string
      label: string
      kind: 'multiselect'
      value: string[]
      options: ScorecardOption[]
      placeholder?: string
      onChange: (next: string[]) => void
    })
  | (FieldBase & {
      id: string
      label: string
      kind: 'dateRange'
      value: { from: string | null; to: string | null }
      onChange: (next: { from: string | null; to: string | null }) => void
    })
  | (FieldBase & {
      id: string
      label: string
      kind: 'text'
      value: string
      placeholder?: string
      onChange: (next: string) => void
    })

type Props = {
  fields: ScorecardField[]
  rightSlot?: ReactNode
  /** Override the cream surface (e.g. `#f4f1ea`). */
  background?: string
  /** Optional className appended to the outer wrapper. */
  className?: string
}

export function ScorecardFilterBar({
  fields,
  rightSlot,
  background = SCORECARD_BAR_BG,
  className,
}: Props) {
  if (fields.length === 0 && !rightSlot) return null

  // Flex-wrap layout: each field grows to fit its dropdown + any inline
  // extras (e.g. additional-operator chips). Right slot stays anchored
  // to the trailing edge.
  return (
    <div
      className={
        'flex flex-wrap items-end gap-x-4 gap-y-3 rounded-lg border border-neutral-200/80 px-4 py-3' +
        (className ? ` ${className}` : '')
      }
      style={{ backgroundColor: background }}
    >
      {fields.map((field) => (
        <ScorecardFieldControl key={field.id} field={field} />
      ))}
      {rightSlot ? (
        <div className="ml-auto flex shrink-0 items-center gap-2 self-end pb-1">{rightSlot}</div>
      ) : null}
    </div>
  )
}

function FieldShell({
  label,
  control,
  extras,
}: {
  label: string
  control: ReactNode
  extras?: ReactNode
}) {
  return (
    <div className="flex min-w-[12rem] max-w-full flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-700">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="min-w-[10rem] flex-shrink-0">{control}</div>
        {extras ? <div className="flex flex-wrap items-center gap-1.5">{extras}</div> : null}
      </div>
    </div>
  )
}

function ScorecardFieldControl({ field }: { field: ScorecardField }) {
  switch (field.kind) {
    case 'select':
      return <SingleSelectField field={field} />
    case 'multiselect':
      return <MultiSelectField field={field} />
    case 'dateRange':
      return <DateRangeField field={field} />
    case 'text':
      return <TextField field={field} />
  }
}

const baseInputClass =
  'block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-none focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 disabled:cursor-not-allowed disabled:opacity-50'

function SingleSelectField({ field }: { field: Extract<ScorecardField, { kind: 'select' }> }) {
  const placeholder = field.placeholder ?? 'Velg…'
  return (
    <FieldShell
      label={field.label}
      extras={field.extras}
      control={
        <div className="flex items-center gap-1">
          <select
            className={baseInputClass}
            value={field.value ?? ''}
            onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.value)}
          >
            <option value="">{placeholder}</option>
            {field.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {field.clearable && field.value ? (
            <button
              type="button"
              onClick={() => field.onChange(null)}
              className="rounded-md border border-neutral-300 bg-white p-1.5 text-neutral-500 hover:text-neutral-800"
              aria-label={`Nullstill ${field.label}`}
              title={`Nullstill ${field.label}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      }
    />
  )
}

function MultiSelectField({ field }: { field: Extract<ScorecardField, { kind: 'multiselect' }> }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const placeholder = field.placeholder ?? 'Velg…'

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return
      if (rootRef.current.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const labelMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const opt of field.options) m.set(opt.value, opt.label)
    return m
  }, [field.options])

  const display = (() => {
    if (field.value.length === 0) return placeholder
    if (field.value.length === 1) return labelMap.get(field.value[0]!) ?? '1 valg'
    return `${field.value.length} valg`
  })()

  const toggle = (value: string) => {
    if (field.value.includes(value)) {
      field.onChange(field.value.filter((v) => v !== value))
    } else {
      field.onChange([...field.value, value])
    }
  }

  return (
    <FieldShell
      label={field.label}
      extras={field.extras}
      control={
        <div ref={rootRef} className="relative">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className={
                baseInputClass +
                ' flex items-center justify-between text-left' +
                (field.value.length === 0 ? ' text-neutral-400' : '')
              }
              aria-haspopup="listbox"
              aria-expanded={open}
            >
              <span className="truncate">{display}</span>
              <ChevronDown className="h-4 w-4 text-neutral-400" aria-hidden />
            </button>
            {field.value.length > 0 ? (
              <button
                type="button"
                onClick={() => field.onChange([])}
                className="rounded-md border border-neutral-300 bg-white p-1.5 text-neutral-500 hover:text-neutral-800"
                aria-label={`Nullstill ${field.label}`}
                title={`Nullstill ${field.label}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          {open ? (
            <div
              className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-auto rounded-md border border-neutral-200 bg-white shadow-lg"
              role="listbox"
              aria-multiselectable
            >
              {field.options.length === 0 ? (
                <p className="px-3 py-2 text-xs text-neutral-500">Ingen valg tilgjengelig.</p>
              ) : (
                <ul className="py-1">
                  {field.options.map((opt) => {
                    const selected = field.value.includes(opt.value)
                    return (
                      <li key={opt.value}>
                        <button
                          type="button"
                          onClick={() => toggle(opt.value)}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-800 hover:bg-neutral-50"
                          role="option"
                          aria-selected={selected}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            readOnly
                            className="pointer-events-none h-3.5 w-3.5 accent-neutral-900"
                          />
                          <span className="truncate">{opt.label}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      }
    />
  )
}

function DateRangeField({ field }: { field: Extract<ScorecardField, { kind: 'dateRange' }> }) {
  return (
    <FieldShell
      label={field.label}
      extras={field.extras}
      control={
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={field.value.from ?? ''}
            onChange={(e) => field.onChange({ ...field.value, from: e.target.value || null })}
            className={baseInputClass}
            aria-label={`${field.label} fra`}
          />
          <span className="text-xs text-neutral-500">–</span>
          <input
            type="date"
            value={field.value.to ?? ''}
            onChange={(e) => field.onChange({ ...field.value, to: e.target.value || null })}
            className={baseInputClass}
            aria-label={`${field.label} til`}
          />
          {field.value.from || field.value.to ? (
            <button
              type="button"
              onClick={() => field.onChange({ from: null, to: null })}
              className="rounded-md border border-neutral-300 bg-white p-1.5 text-neutral-500 hover:text-neutral-800"
              aria-label={`Nullstill ${field.label}`}
              title={`Nullstill ${field.label}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      }
    />
  )
}

function TextField({ field }: { field: Extract<ScorecardField, { kind: 'text' }> }) {
  return (
    <FieldShell
      label={field.label}
      extras={field.extras}
      control={
        <input
          type="text"
          value={field.value}
          placeholder={field.placeholder}
          onChange={(e) => field.onChange(e.target.value)}
          className={baseInputClass}
        />
      }
    />
  )
}
