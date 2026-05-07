// DashboardFilterBar — persistent chip strip rendered above the widget
// grid. Each chip = "<dimension> <operator> <value(s)>". Clicking the
// chip body opens an edit popover (operator + value); the X removes.
// "+ Filter" opens the dimension picker, then drills into operator +
// value selection for that dimension.
//
// State is owned by the page (DashboardLayoutHook persists `filters`).
// This component is presentational + stateless beyond its own popovers.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Filter, X } from 'lucide-react'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import {
  filtersEqual,
  makeFilter,
  type DashboardDimension,
  type DashboardDimensionOption,
  type DashboardFilter,
  type DashboardFilterOperator,
} from '../../../lib/dashboards/dashboardFilters'

type Props = {
  filters: DashboardFilter[]
  dimensions: DashboardDimension[]
  onChange: (next: DashboardFilter[]) => void
}

const OPERATOR_LABEL: Record<DashboardFilterOperator, string> = {
  is: 'er',
  is_not: 'er ikke',
  in: 'er en av',
  between: 'mellom',
  after: 'etter',
  before: 'før',
}

export function DashboardFilterBar({ filters, dimensions, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editing, setEditing] = useState<{ filter: DashboardFilter } | null>(null)

  const dimById = useMemo(() => {
    const m = new Map<string, DashboardDimension>()
    for (const d of dimensions) m.set(d.id, d)
    return m
  }, [dimensions])

  if (dimensions.length === 0) return null

  const removeFilter = (id: string) => {
    onChange(filters.filter((f) => f.id !== id))
  }

  const upsertFilter = (next: DashboardFilter) => {
    const exists = filters.some((f) => f.id === next.id)
    const updated = exists
      ? filters.map((f) => (f.id === next.id ? next : f))
      : [...filters, next]
    if (!filtersEqual(updated, filters)) onChange(updated)
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-2.5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-800"
        >
          <Filter className="h-3.5 w-3.5" aria-hidden />
          + Filter
        </button>

        {filters.length === 0 ? (
          <span className="text-xs text-neutral-500">Ingen filtre — viser alle data.</span>
        ) : (
          <>
            {filters.map((f) => {
              const dim = dimById.get(f.dimensionId)
              if (!dim) return null
              return (
                <FilterChip
                  key={f.id}
                  filter={f}
                  dimension={dim}
                  onClick={() => setEditing({ filter: f })}
                  onRemove={() => removeFilter(f.id)}
                />
              )
            })}
            <button
              type="button"
              onClick={() => onChange([])}
              className="ml-auto text-xs font-medium text-neutral-500 underline-offset-2 hover:text-neutral-800 hover:underline"
            >
              Fjern alle
            </button>
          </>
        )}
      </div>

      {pickerOpen ? (
        <DimensionPickerPopover
          dimensions={dimensions}
          existing={filters}
          onClose={() => setPickerOpen(false)}
          onPick={(dim) => {
            setPickerOpen(false)
            // Mint a chip with the dimension's default operator + an
            // empty value, then immediately open the editor so the user
            // fills the value in.
            const op =
              dim.defaultOperator ?? (dim.kind === 'date_range' ? 'between' : 'is')
            const seed = makeFilter(dim.id, op, dim.kind === 'date_range' ? { from: '', to: '' } : '')
            setEditing({ filter: seed })
          }}
        />
      ) : null}

      {editing ? (
        <FilterEditPopover
          filter={editing.filter}
          dimension={dimById.get(editing.filter.dimensionId)!}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            upsertFilter(next)
            setEditing(null)
          }}
          onRemove={() => {
            removeFilter(editing.filter.id)
            setEditing(null)
          }}
        />
      ) : null}
    </div>
  )
}

// ── Chip ────────────────────────────────────────────────────────────────────

function FilterChip({
  filter,
  dimension,
  onClick,
  onRemove,
}: {
  filter: DashboardFilter
  dimension: DashboardDimension
  onClick: () => void
  onRemove: () => void
}) {
  const summary = describeFilterValue(filter, dimension)
  return (
    <span className="inline-flex items-center overflow-hidden rounded-full border border-[#1a3d32]/20 bg-[#1a3d32]/5 text-xs font-medium text-[#1a3d32]">
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-1 px-2.5 py-1 transition-colors hover:bg-[#1a3d32]/10"
      >
        <span className="font-semibold">{dimension.label}</span>
        <span className="text-[#1a3d32]/70">{OPERATOR_LABEL[filter.operator]}</span>
        <span className="font-semibold">{summary || '—'}</span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Fjern filter ${dimension.label}`}
        className="border-l border-[#1a3d32]/15 px-1.5 py-1 text-[#1a3d32]/60 hover:bg-[#1a3d32]/10 hover:text-[#1a3d32]"
      >
        <X className="h-3 w-3" aria-hidden />
      </button>
    </span>
  )
}

function describeFilterValue(filter: DashboardFilter, dimension: DashboardDimension): string {
  const v = filter.value
  if (dimension.kind === 'date_range') {
    if (filter.operator === 'between' && v && typeof v === 'object') {
      const r = v as { from?: string; to?: string }
      return `${r.from || '…'} → ${r.to || '…'}`
    }
    if ((filter.operator === 'after' || filter.operator === 'before') && typeof v === 'string') {
      return v || '—'
    }
  }
  if (filter.operator === 'in' && Array.isArray(v)) {
    if (v.length === 0) return '—'
    if (v.length <= 2) return v.map((x) => String(x)).join(', ')
    return `${v.length} valg`
  }
  if (typeof v === 'string') return v
  return ''
}

// ── Dimension picker popover ────────────────────────────────────────────────

function DimensionPickerPopover({
  dimensions,
  existing,
  onClose,
  onPick,
}: {
  dimensions: DashboardDimension[]
  existing: DashboardFilter[]
  onClose: () => void
  onPick: (d: DashboardDimension) => void
}) {
  const [query, setQuery] = useState('')
  const popRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!popRef.current) return
      if (!popRef.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const q = query.trim().toLowerCase()
  const visible = dimensions.filter((d) => {
    if (!q) return true
    return d.label.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q)
  })

  return (
    <div
      ref={popRef}
      className="absolute z-30 mt-2 w-[18rem] rounded-md border border-neutral-200 bg-white shadow-lg"
      role="dialog"
      aria-label="Velg filter"
    >
      <div className="border-b border-neutral-100 p-2">
        <StandardInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Søk dimensjon …"
          autoFocus
        />
      </div>
      <ul className="max-h-72 overflow-y-auto py-1">
        {visible.length === 0 ? (
          <li className="px-3 py-3 text-xs text-neutral-500">Ingen treff.</li>
        ) : (
          visible.map((d) => {
            const used = existing.filter((f) => f.dimensionId === d.id).length
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => onPick(d)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-neutral-900">{d.label}</span>
                    {d.description ? (
                      <span className="block text-xs text-neutral-500">{d.description}</span>
                    ) : null}
                  </span>
                  {used > 0 ? <Badge variant="neutral">{used}</Badge> : null}
                </button>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}

// ── Filter edit popover ─────────────────────────────────────────────────────

function FilterEditPopover({
  filter,
  dimension,
  onClose,
  onSave,
  onRemove,
}: {
  filter: DashboardFilter
  dimension: DashboardDimension
  onClose: () => void
  onSave: (next: DashboardFilter) => void
  onRemove: () => void
}) {
  const [operator, setOperator] = useState<DashboardFilterOperator>(filter.operator)
  const [options, setOptions] = useState<DashboardDimensionOption[]>([])
  // Default-true so the lint-fragile synchronous `setOptionsLoading(true)`
  // inside the loader effect can be removed; the loader flips it to false
  // in its async callback when the option list arrives.
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [stringValue, setStringValue] = useState<string>(
    typeof filter.value === 'string' ? filter.value : '',
  )
  const [arrayValue, setArrayValue] = useState<string[]>(
    Array.isArray(filter.value) ? (filter.value as string[]) : [],
  )
  const [from, setFrom] = useState<string>(
    filter.value && typeof filter.value === 'object'
      ? ((filter.value as Record<string, unknown>).from as string) || ''
      : '',
  )
  const [to, setTo] = useState<string>(
    filter.value && typeof filter.value === 'object'
      ? ((filter.value as Record<string, unknown>).to as string) || ''
      : '',
  )

  const popRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!popRef.current) return
      if (!popRef.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  useEffect(() => {
    if (dimension.kind !== 'enum' || !dimension.loadOptions) return
    let cancelled = false
    Promise.resolve(dimension.loadOptions()).then((opts) => {
      if (cancelled) return
      setOptions(opts)
      setOptionsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [dimension])

  const operators: DashboardFilterOperator[] =
    dimension.operatorOptions ??
    (dimension.kind === 'date_range'
      ? ['between', 'after', 'before']
      : dimension.kind === 'enum'
      ? ['is', 'is_not', 'in']
      : ['is', 'is_not'])

  const handleSave = () => {
    let value: unknown
    if (dimension.kind === 'date_range') {
      if (operator === 'between') value = { from, to }
      else if (operator === 'after') value = from
      else if (operator === 'before') value = to
      else value = stringValue
    } else if (operator === 'in') {
      value = arrayValue
    } else {
      value = stringValue
    }
    onSave({ ...filter, operator, value })
  }

  return (
    <div
      ref={popRef}
      className="absolute z-30 mt-2 w-[22rem] rounded-md border border-neutral-200 bg-white p-3 shadow-lg"
      role="dialog"
      aria-label={`Rediger filter ${dimension.label}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
        {dimension.label}
      </p>

      <div className="mt-3 space-y-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Operator
          </label>
          <select
            value={operator}
            onChange={(e) => setOperator(e.target.value as DashboardFilterOperator)}
            className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm"
          >
            {operators.map((op) => (
              <option key={op} value={op}>
                {OPERATOR_LABEL[op]}
              </option>
            ))}
          </select>
        </div>

        {dimension.kind === 'enum' ? (
          operator === 'in' ? (
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Verdier
              </label>
              {optionsLoading ? (
                <p className="text-xs text-neutral-500">Laster …</p>
              ) : (
                <ul className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-neutral-200 bg-neutral-50 p-2">
                  {options.map((o) => {
                    const checked = arrayValue.includes(o.id)
                    return (
                      <li key={o.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-white">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) setArrayValue([...arrayValue, o.id])
                              else setArrayValue(arrayValue.filter((x) => x !== o.id))
                            }}
                          />
                          <span>{o.label}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Verdi
              </label>
              {optionsLoading ? (
                <p className="text-xs text-neutral-500">Laster …</p>
              ) : (
                <select
                  value={stringValue}
                  onChange={(e) => setStringValue(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm"
                >
                  <option value="">— velg —</option>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )
        ) : dimension.kind === 'date_range' ? (
          operator === 'between' ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Fra
                </label>
                <StandardInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Til
                </label>
                <StandardInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Dato
              </label>
              <StandardInput
                type="date"
                value={operator === 'after' ? from : to}
                onChange={(e) => (operator === 'after' ? setFrom(e.target.value) : setTo(e.target.value))}
              />
            </div>
          )
        ) : (
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Verdi
            </label>
            <StandardInput value={stringValue} onChange={(e) => setStringValue(e.target.value)} />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          Fjern
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Avbryt
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave}>
            Bruk
          </Button>
        </div>
      </div>
    </div>
  )
}
