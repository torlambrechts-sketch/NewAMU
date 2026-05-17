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
import { SearchableSelect } from '../../ui/SearchableSelect'
import { ToggleSwitch } from '../../ui/FormToggles'
import {
  filtersEqual,
  makeFilter,
  type DashboardComparisonMode,
  type DashboardDimension,
  type DashboardDimensionOption,
  type DashboardFilter,
  type DashboardFilterOperator,
  type DashboardFilterPreset,
} from '../../../lib/dashboards/dashboardFilters'

// Resolve an option id to its display label using the per-dimension
// cache. Returns the raw id when the cache doesn't have the option
// yet (loading) or when the dimension didn't declare loadOptions.
function labelFor(
  dimId: string,
  id: string,
  optionsByDim: Record<string, DashboardDimensionOption[]>,
): string {
  const opts = optionsByDim[dimId]
  if (!opts) return id
  const hit = opts.find((o) => o.id === id)
  return hit?.label ?? id
}

type Props = {
  filters: DashboardFilter[]
  dimensions: DashboardDimension[]
  onChange: (next: DashboardFilter[]) => void
  /**
   * Scope-shipped quick-applies. Each renders as a chip next to the
   * filter set; clicking replaces the filters atomically.
   */
  presets?: DashboardFilterPreset[]
  onApplyPreset?: (preset: DashboardFilterPreset) => void
  /**
   * Comparison mode for the scope. When `onComparisonChange` is set,
   * a "Sammenlign" dropdown appears on the right side of the bar.
   */
  comparison?: DashboardComparisonMode
  onComparisonChange?: (mode: DashboardComparisonMode) => void
}

const COMPARISON_OPTIONS: { value: DashboardComparisonMode; label: string }[] = [
  { value: 'none', label: 'Ingen' },
  { value: 'previous_period', label: 'Forrige periode' },
  { value: 'previous_year', label: 'Forrige år' },
]

const OPERATOR_LABEL: Record<DashboardFilterOperator, string> = {
  is: 'er',
  is_not: 'er ikke',
  in: 'er en av',
  between: 'mellom',
  after: 'etter',
  before: 'før',
}

export { FilterChip as DashboardFilterChip }
export { FilterEditPopover as DashboardFilterEditPopover }

export function DashboardFilterBar({
  filters,
  dimensions,
  onChange,
  presets,
  onApplyPreset,
  comparison,
  onComparisonChange,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editing, setEditing] = useState<{ filter: DashboardFilter } | null>(null)
  // Per-dimension option cache so chips can render labels instead of
  // raw ids. Resolved once per dimensions-array identity (same idiom
  // as DashboardScorecardFilterBar).
  const [optionsByDim, setOptionsByDim] = useState<Record<string, DashboardDimensionOption[]>>({})

  useEffect(() => {
    let cancelled = false
    const enumDims = dimensions.filter((d) => d.kind === 'enum' && d.loadOptions)
    if (enumDims.length === 0) return
    void Promise.all(
      enumDims.map(async (d) => {
        try {
          const opts = await d.loadOptions!()
          return [d.id, opts] as const
        } catch {
          return [d.id, [] as DashboardDimensionOption[]] as const
        }
      }),
    ).then((pairs) => {
      if (cancelled) return
      const map: Record<string, DashboardDimensionOption[]> = {}
      for (const [id, opts] of pairs) map[id] = opts
      setOptionsByDim((prev) => ({ ...prev, ...map }))
    })
    return () => { cancelled = true }
  }, [dimensions])

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
    <div
      className="rounded-xl border border-neutral-200/80 bg-white px-4 py-2.5"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPickerOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:text-neutral-900"
        >
          <Filter className="h-3.5 w-3.5" aria-hidden />
          + Filter
        </Button>

        {/* Preset chips — scope-shipped quick-applies (e.g. "Psykososial",
            "Røde risikoer"). Render after +Filter so they read as a
            secondary affordance, not a third filter style. */}
        {presets && presets.length > 0 && onApplyPreset ? (
          <>
            <span className="text-xs text-neutral-400" aria-hidden>·</span>
            {presets.map((p) => {
              const active =
                comparison === (p.comparison ?? 'none') &&
                filtersEqual(p.filters, filters)
              return (
                <Button
                  key={p.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => onApplyPreset(p)}
                  title={p.description}
                  className={
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ' +
                    (active
                      ? 'border-[#1a3d32] bg-[#1a3d32] text-white hover:bg-[#1a3d32]'
                      : 'border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50')
                  }
                >
                  {p.label}
                </Button>
              )
            })}
          </>
        ) : null}

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
                  optionsByDim={optionsByDim}
                  onClick={() => setEditing({ filter: f })}
                  onRemove={() => removeFilter(f.id)}
                />
              )
            })}
          </>
        )}

        {/* Right-side controls — Sammenlign + Fjern alle. `ml-auto`
            anchors the cluster to the right edge of the wrapping flex
            row, just like the dashboard mockup. */}
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {onComparisonChange ? (
            <div className="inline-flex items-center gap-1.5 text-xs text-neutral-700">
              <span className="font-medium text-neutral-600">Sammenlign:</span>
              <div className="min-w-[10rem]">
                <SearchableSelect
                  value={comparison ?? 'none'}
                  onChange={(v) => onComparisonChange(v as DashboardComparisonMode)}
                  options={COMPARISON_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                />
              </div>
            </div>
          ) : null}
          {filters.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange([])}
              className="rounded-none px-0 text-xs font-medium text-neutral-600 underline-offset-2 hover:bg-transparent hover:text-neutral-900 hover:underline"
            >
              Fjern alle
            </Button>
          ) : null}
        </div>
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
  optionsByDim,
  onClick,
  onRemove,
}: {
  filter: DashboardFilter
  dimension: DashboardDimension
  optionsByDim: Record<string, DashboardDimensionOption[]>
  onClick: () => void
  onRemove: () => void
}) {
  const summary = describeFilterValue(filter, dimension, optionsByDim)
  return (
    <span className="inline-flex items-center overflow-hidden rounded-full border border-neutral-300 bg-white text-xs text-neutral-900 shadow-sm">
      <Button
        variant="ghost"
        onClick={onClick}
        className="flex items-center gap-1.5 rounded-none px-3 py-1.5 text-neutral-900 transition-colors hover:bg-neutral-50"
      >
        <span className="font-semibold text-neutral-900">{dimension.label}</span>
        <span className="text-neutral-500">{OPERATOR_LABEL[filter.operator]}</span>
        <span className="font-semibold text-neutral-900">{summary || '—'}</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        aria-label={`Fjern filter ${dimension.label}`}
        className="ml-0 inline-flex h-auto w-auto items-center justify-center rounded-none border-l border-neutral-200 px-2.5 py-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </span>
  )
}

function describeFilterValue(
  filter: DashboardFilter,
  dimension: DashboardDimension,
  optionsByDim: Record<string, DashboardDimensionOption[]>,
): string {
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
  // Resolve option ids to their human labels — chips that show
  // "Fareklasse er physical" should read "Fareklasse er Fysisk".
  if (filter.operator === 'in' && Array.isArray(v)) {
    if (v.length === 0) return '—'
    const labels = v.map((x) => labelFor(dimension.id, String(x), optionsByDim))
    if (labels.length <= 2) return labels.join(', ')
    return `${labels.length} valg`
  }
  if (typeof v === 'string') {
    if (dimension.kind === 'enum') return labelFor(dimension.id, v, optionsByDim)
    return v
  }
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
    const onDoc = (e: PointerEvent) => {
      if (!popRef.current) return
      if (!popRef.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDoc)
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
                <Button
                  variant="ghost"
                  onClick={() => onPick(d)}
                  className="flex w-full items-start gap-2 rounded-none px-3 py-2 text-left text-sm font-normal hover:bg-neutral-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-neutral-900">{d.label}</span>
                    {d.description ? (
                      <span className="block text-xs text-neutral-500">{d.description}</span>
                    ) : null}
                  </span>
                  {used > 0 ? <Badge variant="neutral">{used}</Badge> : null}
                </Button>
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
    const onDoc = (e: PointerEvent) => {
      if (!popRef.current) return
      if (!popRef.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDoc)
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
          <SearchableSelect
            value={operator}
            onChange={(v) => setOperator(v as DashboardFilterOperator)}
            options={operators.map((op) => ({ value: op, label: OPERATOR_LABEL[op] }))}
          />
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
                    const toggle = (next: boolean) => {
                      if (next) setArrayValue([...arrayValue, o.id])
                      else setArrayValue(arrayValue.filter((x) => x !== o.id))
                    }
                    return (
                      <li key={o.id}>
                        {/* Click the whole row to toggle, not just the
                            switch. ToggleSwitch only sets aria-label,
                            so we render the visible label here in
                            neutral-900 for readability. */}
                        <Button
                          variant="ghost"
                          onClick={() => toggle(!checked)}
                          className="flex w-full items-center justify-start gap-2 rounded px-1.5 py-1 text-left text-sm font-normal text-neutral-900 hover:bg-white"
                        >
                          <ToggleSwitch checked={checked} onChange={toggle} label={o.label} />
                          <span className="text-neutral-900">{o.label}</span>
                        </Button>
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
                <SearchableSelect
                  value={stringValue}
                  onChange={(v) => setStringValue(v)}
                  options={[
                    { value: '', label: '— velg —' },
                    ...options.map((o) => ({ value: o.id, label: o.label })),
                  ]}
                />
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
