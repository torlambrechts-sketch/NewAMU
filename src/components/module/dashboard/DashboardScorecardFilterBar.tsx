// DashboardScorecardFilterBar — maps the dashboard dimension/filter model
// onto a flat scorecard-style filter row.
//
// Each enum dimension becomes a multiselect (using the existing `in`
// operator, single chip per dimension). Date-range dimensions become a
// from/to date pair (`between` operator). Text dimensions become a plain
// text input (`is`). Option loading is async per the dimension contract,
// so we kick off `loadOptions()` for every enum dimension once on mount
// (and again when the dimensions array identity changes).

import { useEffect, useMemo, useState } from 'react'
import { ScorecardFilterBar, type ScorecardField } from '../../ui/ScorecardFilterBar'
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

  const filterByDim = useMemo(() => {
    const m = new Map<string, DashboardFilter>()
    for (const f of filters) {
      // First wins. The chip UX allowed multiple filters per dimension; the
      // scorecard layout collapses to one (using the `in` multiselect /
      // `between` range / `is` text), so additional filters on the same
      // dimension are ignored in the scorecard view.
      if (!m.has(f.dimensionId)) m.set(f.dimensionId, f)
    }
    return m
  }, [filters])

  const replaceFilterForDim = (dimensionId: string, next: DashboardFilter | null) => {
    const without = filters.filter((f) => f.dimensionId !== dimensionId)
    const updated = next ? [...without, next] : without
    if (!filtersEqual(updated, filters)) onChange(updated)
  }

  const fields: ScorecardField[] = useMemo(() => {
    const out: ScorecardField[] = []
    for (const dim of dimensions) {
      const existing = filterByDim.get(dim.id) ?? null
      if (dim.kind === 'enum') {
        const opts = optionsByDim[dim.id] ?? []
        const currentValues = (() => {
          if (!existing) return []
          if (Array.isArray(existing.value)) return existing.value as string[]
          if (typeof existing.value === 'string') return [existing.value]
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
              replaceFilterForDim(dim.id, null)
            } else {
              replaceFilterForDim(dim.id, makeFilter(dim.id, 'in', next))
            }
          },
        })
      } else if (dim.kind === 'date_range') {
        const range = (() => {
          const v = existing?.value as { from?: string | null; to?: string | null } | undefined
          return { from: v?.from ?? null, to: v?.to ?? null }
        })()
        out.push({
          id: dim.id,
          label: dim.label,
          kind: 'dateRange',
          value: range,
          onChange: (next) => {
            if (!next.from && !next.to) {
              replaceFilterForDim(dim.id, null)
            } else {
              replaceFilterForDim(
                dim.id,
                makeFilter(dim.id, 'between', { from: next.from, to: next.to }),
              )
            }
          },
        })
      } else if (dim.kind === 'text') {
        const v = typeof existing?.value === 'string' ? (existing.value as string) : ''
        out.push({
          id: dim.id,
          label: dim.label,
          kind: 'text',
          value: v,
          placeholder: 'Søk…',
          onChange: (next) => {
            const trimmed = next.trim()
            if (!trimmed) {
              replaceFilterForDim(dim.id, null)
            } else {
              replaceFilterForDim(dim.id, makeFilter(dim.id, 'is', next))
            }
          },
        })
      }
    }
    return out
    // replaceFilterForDim is captured stably via the filters dep; recompute on
    // dim/filter/option changes is what we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions, filterByDim, optionsByDim, filters])

  return <ScorecardFilterBar fields={fields} rightSlot={rightSlot} background={background} />
}
