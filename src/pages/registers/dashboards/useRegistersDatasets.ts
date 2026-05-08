// useRegistersDatasets — computes the datasets the registers dashboard
// scope publishes. Aggregates `register_records` (active, not deleted)
// across every enabled type for the current org.
//
// Pure compute — no fetching here. Caller (RegistersAnalysePage) hands
// in the records + types + categories + the active filter set.

import { useMemo } from 'react'
import type { DashboardFilter } from '../../../lib/dashboards/dashboardFilters'
import type {
  RegisterCategory,
  RegisterRecord,
} from '../../../types/registers'
import type { ResolvedRegisterType } from '../../../hooks/useRegisters'

export const STATUS_OPTIONS = [
  { id: 'active', label: 'Aktiv' },
  { id: 'draft', label: 'Utkast' },
  { id: 'archived', label: 'Arkivert' },
] as const

type Args = {
  records: RegisterRecord[]
  types: ResolvedRegisterType[]
  categories: RegisterCategory[]
  filters: DashboardFilter[]
}

export function useRegistersDatasets({
  records,
  types,
  categories,
  filters,
}: Args): Record<string, unknown> {
  return useMemo(() => {
    // Apply chip filters first.
    const filtered = applyFilters(records, types, categories, filters)

    // KPI summary
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const thirtyDaysFromNow = new Date(today)
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    let active = 0
    let reviewsOverdue = 0
    let reviewsDueIn30Days = 0
    for (const r of filtered) {
      if (r.status === 'active') active += 1
      if (r.reviewDueAt) {
        const due = new Date(r.reviewDueAt)
        if (!Number.isNaN(due.getTime())) {
          if (due < today) reviewsOverdue += 1
          else if (due <= thirtyDaysFromNow) reviewsDueIn30Days += 1
        }
      }
    }

    const enabledTypes = types.filter((t) => t.isEnabledForOrg).length

    // Status distribution (donut segments)
    const statusCounts: Record<string, number> = { Aktiv: 0, Utkast: 0, Arkivert: 0 }
    for (const r of filtered) {
      const label =
        r.status === 'active' ? 'Aktiv' : r.status === 'draft' ? 'Utkast' : 'Arkivert'
      statusCounts[label] = (statusCounts[label] ?? 0) + 1
    }

    // By type (bar segments)
    const typeNameById = new Map(types.map((t) => [t.id, t.resolvedName]))
    const byType: Record<string, number> = {}
    for (const r of filtered) {
      const name = typeNameById.get(r.registerTypeId) ?? r.registerTypeId
      byType[name] = (byType[name] ?? 0) + 1
    }

    // By regulation — one record can count for multiple regulations
    // (its type's regulation_ids list is multi). Cross-regulation reach
    // is exactly the point of this engine.
    const byRegulation: Record<string, number> = {}
    const typeRegsById = new Map(types.map((t) => [t.id, t.regulationIds]))
    for (const r of filtered) {
      const regs = typeRegsById.get(r.registerTypeId) ?? []
      if (regs.length === 0) {
        byRegulation['Uten regelverk'] = (byRegulation['Uten regelverk'] ?? 0) + 1
        continue
      }
      for (const rid of regs) {
        const label = rid.toUpperCase()
        byRegulation[label] = (byRegulation[label] ?? 0) + 1
      }
    }

    // Reviews due within 30 days — table rows for the bottom widget.
    const dueSoonRows = filtered
      .filter((r) => {
        if (!r.reviewDueAt) return false
        const due = new Date(r.reviewDueAt)
        if (Number.isNaN(due.getTime())) return false
        return due >= today && due <= thirtyDaysFromNow
      })
      .sort((a, b) => (a.reviewDueAt ?? '').localeCompare(b.reviewDueAt ?? ''))
      .slice(0, 12)
      .map((r) => ({
        name: pickRecordName(r),
        type: typeNameById.get(r.registerTypeId) ?? r.registerTypeId,
        reviewDueAt: r.reviewDueAt ?? '',
        status:
          r.status === 'active' ? 'Aktiv' : r.status === 'draft' ? 'Utkast' : 'Arkivert',
      }))

    return {
      registers_kpi_summary: {
        activeRecords: active,
        reviewsOverdue,
        reviewsDueIn30Days,
        enabledTypes,
      },
      registers_status_distribution: statusCounts,
      registers_by_type: byType,
      registers_by_regulation: byRegulation,
      registers_by_category: aggregateByCategory(filtered, types, categories),
      registers_review_due_soon: dueSoonRows,
    }
  }, [records, types, categories, filters])
}

function aggregateByCategory(
  records: RegisterRecord[],
  types: ResolvedRegisterType[],
  categories: RegisterCategory[],
): Record<string, number> {
  const categoryByType = new Map(types.map((t) => [t.id, t.categoryId]))
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]))
  const out: Record<string, number> = {}
  for (const r of records) {
    const catId = categoryByType.get(r.registerTypeId) ?? null
    const label = catId
      ? (categoryNameById.get(catId) ?? 'Uten kategori')
      : 'Uten kategori'
    out[label] = (out[label] ?? 0) + 1
  }
  return out
}

function pickRecordName(r: RegisterRecord): string {
  // Best-effort: most schemas have a `name` or `title` field as the
  // first required entry. Fall back to the record id's first 8 chars.
  const v = r.values
  for (const key of ['name', 'title', 'navn', 'tittel', 'purpose']) {
    const val = (v as Record<string, unknown>)[key]
    if (typeof val === 'string' && val.trim()) return val
  }
  return r.id.slice(0, 8)
}

function applyFilters(
  records: RegisterRecord[],
  types: ResolvedRegisterType[],
  categories: RegisterCategory[],
  filters: DashboardFilter[],
): RegisterRecord[] {
  if (filters.length === 0) return records
  const typeRegsById = new Map(types.map((t) => [t.id, t.regulationIds]))
  const typeCategoryById = new Map(types.map((t) => [t.id, t.categoryId]))
  return records.filter((r) => {
    for (const f of filters) {
      const v = f.value
      switch (f.dimensionId) {
        case 'register_type': {
          const target = arrayOrSingle(v)
          if (target.length > 0 && !target.includes(r.registerTypeId)) return false
          break
        }
        case 'status': {
          const target = arrayOrSingle(v)
          if (target.length > 0 && !target.includes(r.status)) return false
          break
        }
        case 'regulation': {
          const target = arrayOrSingle(v)
          if (target.length === 0) break
          const regs = typeRegsById.get(r.registerTypeId) ?? []
          if (!regs.some((rid) => target.includes(rid))) return false
          break
        }
        case 'category': {
          const target = arrayOrSingle(v)
          if (target.length === 0) break
          const cat = typeCategoryById.get(r.registerTypeId) ?? null
          if (cat === null || !target.includes(cat)) return false
          break
        }
        case 'owner': {
          const target = arrayOrSingle(v)
          if (target.length > 0 && (!r.ownerUserId || !target.includes(r.ownerUserId))) {
            return false
          }
          break
        }
      }
    }
    void categories
    return true
  })
}

function arrayOrSingle(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string')
  if (typeof v === 'string' && v) return [v]
  return []
}
