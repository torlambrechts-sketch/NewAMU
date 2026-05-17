// DashboardScorecardFilterBar — maps the dashboard dimension/filter model
// onto a flat scorecard-style filter row.
//
// Each enum dimension exposes:
//   - a multiselect dropdown (the `in`-operator filter; the common case)
//   - any *extra* filters on the same dimension (other operators like
//     `is_not`, `between` for date dims) rendered inline as chips next
//     to the dropdown
//   - a "+ Filter" button that opens an editor popover for adding a
//     differently-shaped chip (e.g. "status is_not draft")
//
// Date-range dimensions render a from/to date pair (`between` operator).
// Text dimensions render a plain text input (`is`).
//
// Async loadOptions are resolved once per dimensions-array identity.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../../ui/Button'
import { ScorecardFilterBar, type ScorecardField } from '../../ui/ScorecardFilterBar'
import {
  DashboardFilterChip,
  DashboardFilterEditPopover,
} from './DashboardFilterBar'
import {
  filtersEqual,
  makeFilter,
  type DashboardDimension,
  type DashboardDimensionOption,
  type DashboardFilter,
} from '../../../lib/dashboards/dashboardFilters'

type Props = {
  filters: DashboardFilter[]
  dimensions: DashboardDimension[]
  onChange: (next: DashboardFilter[]) => void
  /** Optional right-side slot for actions (toggles, etc.). */
  rightSlot?: React.ReactNode
  /** Override the cream surface. */
  background?: string
}

export function DashboardScorecardFilterBar({
  filters,
  dimensions,
  onChange,
  rightSlot,
  background,
}: Props) {
  const [optionsByDim, setOptionsByDim] = useState<Record<string, DashboardDimensionOption[]>>({})
  const [editing, setEditing] = useState<{ filter: DashboardFilter } | null>(null)

  // Resolve enum dimension options once per dimensions-array identity.
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
    return () => {
      cancelled = true
    }
  }, [dimensions])

  const dimById = useMemo(() => {
    const m = new Map<string, DashboardDimension>()
    for (const d of dimensions) m.set(d.id, d)
    return m
  }, [dimensions])

  // Group filters per dimension. The "primary" filter for an enum dim is
  // the one with operator='in' (rendered via the multiselect). For
  // date_range / text dims, the primary is whatever single chip we have
  // for that operator. Everything else is "extra" — shown as chips.
  const { primaryByDim, extrasByDim } = useMemo(() => {
    const primary = new Map<string, DashboardFilter>()
    const extras = new Map<string, DashboardFilter[]>()
    for (const f of filters) {
      const dim = dimById.get(f.dimensionId)
      if (!dim) continue
      const isPrimary = (() => {
        if (primary.has(f.dimensionId)) return false
        if (dim.kind === 'enum') return f.operator === 'in'
        if (dim.kind === 'date_range') return f.operator === 'between'
        return f.operator === 'is'
      })()
      if (isPrimary) {
        primary.set(f.dimensionId, f)
      } else {
        const arr = extras.get(f.dimensionId) ?? []
        arr.push(f)
        extras.set(f.dimensionId, arr)
      }
    }
    return { primaryByDim: primary, extrasByDim: extras }
  }, [filters, dimById])

  const upsertFilter = (next: DashboardFilter) => {
    const exists = filters.some((f) => f.id === next.id)
    const updated = exists
      ? filters.map((f) => (f.id === next.id ? next : f))
      : [...filters, next]
    if (!filtersEqual(updated, filters)) onChange(updated)
  }

  const removeFilter = (id: string) => {
    onChange(filters.filter((f) => f.id !== id))
  }

  const replacePrimary = (dimensionId: string, next: DashboardFilter | null) => {
    const dim = dimById.get(dimensionId)
    if (!dim) return
    const isPrimaryRow = (f: DashboardFilter) => {
      if (f.dimensionId !== dimensionId) return false
      if (dim.kind === 'enum') return f.operator === 'in'
      if (dim.kind === 'date_range') return f.operator === 'between'
      return f.operator === 'is'
    }
    const without = filters.filter((f) => !isPrimaryRow(f))
    const updated = next ? [...without, next] : without
    if (!filtersEqual(updated, filters)) onChange(updated)
  }

  const startAddExtra = (dim: DashboardDimension) => {
    // Pick a sensible "non-primary" default operator. Enum primary is
    // `in`, so the extra defaults to `is_not` (or whatever the dim
    // declares first that isn't `in`). Date primary is `between`, so the
    // extra defaults to `after`.
    const nonPrimaryOps = (() => {
      const all =
        dim.operatorOptions ??
        (dim.kind === 'date_range'
          ? (['between', 'after', 'before'] as const)
          : dim.kind === 'enum'
          ? (['is', 'is_not', 'in'] as const)
          : (['is', 'is_not'] as const))
      const skipPrimary = dim.kind === 'enum' ? 'in' : dim.kind === 'date_range' ? 'between' : 'is'
      return all.filter((op) => op !== skipPrimary)
    })()
    const op = nonPrimaryOps[0] ?? (dim.kind === 'date_range' ? 'after' : 'is_not')
    const seed = makeFilter(dim.id, op, dim.kind === 'date_range' ? { from: '', to: '' } : '')
    setEditing({ filter: seed })
  }

  const fields: ScorecardField[] = useMemo(() => {
    const out: ScorecardField[] = []
    for (const dim of dimensions) {
      const primary = primaryByDim.get(dim.id) ?? null
      const extras = extrasByDim.get(dim.id) ?? []

      const extrasNode =
        extras.length > 0 || dim.kind !== 'text' ? (
          <>
            {extras.map((f) => (
              <DashboardFilterChip
                key={f.id}
                filter={f}
                dimension={dim}
                onClick={() => setEditing({ filter: f })}
                onRemove={() => removeFilter(f.id)}
              />
            ))}
            <Button
              variant="primary"
              size="sm"
              onClick={() => startAddExtra(dim)}
              className="inline-flex items-center gap-1 rounded-md bg-[#1a3d32] px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#14312a]"
              aria-label={`Legg til filter på ${dim.label}`}
              title={`Legg til filter på ${dim.label}`}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Filter
            </Button>
          </>
        ) : null

      if (dim.kind === 'enum') {
        const opts = optionsByDim[dim.id] ?? []
        const currentValues = (() => {
          if (!primary) return []
          if (Array.isArray(primary.value)) return primary.value as string[]
          if (typeof primary.value === 'string') return [primary.value]
          return []
        })()
        out.push({
          id: dim.id,
          label: dim.label,
          kind: 'multiselect',
          value: currentValues,
          options: opts.map((o) => ({ value: o.id, label: o.label })),
          placeholder: opts.length === 0 ? 'Ingen valg' : 'Alle',
          onChange: (next) => {
            if (next.length === 0) {
              replacePrimary(dim.id, null)
            } else {
              replacePrimary(dim.id, makeFilter(dim.id, 'in', next))
            }
          },
          extras: extrasNode,
        })
      } else if (dim.kind === 'date_range') {
        const range = (() => {
          const v = primary?.value as { from?: string | null; to?: string | null } | undefined
          return { from: v?.from ?? null, to: v?.to ?? null }
        })()
        out.push({
          id: dim.id,
          label: dim.label,
          kind: 'dateRange',
          value: range,
          onChange: (next) => {
            if (!next.from && !next.to) {
              replacePrimary(dim.id, null)
            } else {
              replacePrimary(dim.id, makeFilter(dim.id, 'between', { from: next.from, to: next.to }))
            }
          },
          extras: extrasNode,
        })
      } else if (dim.kind === 'text') {
        const v = typeof primary?.value === 'string' ? (primary.value as string) : ''
        out.push({
          id: dim.id,
          label: dim.label,
          kind: 'text',
          value: v,
          placeholder: 'Søk…',
          onChange: (next) => {
            const trimmed = next.trim()
            if (!trimmed) {
              replacePrimary(dim.id, null)
            } else {
              replacePrimary(dim.id, makeFilter(dim.id, 'is', next))
            }
          },
          extras: extrasNode,
        })
      }
    }
    return out
    // replacePrimary / removeFilter / startAddExtra close over the latest
    // filters via the dependency list below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions, primaryByDim, extrasByDim, optionsByDim, filters])

  // Anchor the edit popover to the bar root so it positions reasonably
  // relative to the chips (the popover itself absolutely-positions
  // beneath its mount point).
  const popoverHostRef = useRef<HTMLDivElement | null>(null)

  return (
    <div ref={popoverHostRef} className="relative">
      <ScorecardFilterBar fields={fields} rightSlot={rightSlot} background={background} />
      {editing ? (
        <DashboardFilterEditPopover
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
