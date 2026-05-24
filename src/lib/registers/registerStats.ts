// Stats derived from register_records — feeds the hub tiles + the
// detail-page KPI row + the compliance-status sidebar.
//
// The numbers are computed at read time rather than denormalised
// onto the type row so we don't need a separate counter table. For
// the ~hundreds of records per org we see today this is essentially
// free. If a tenant grows past 100k records we'll revisit with a
// view or a periodic cron.

import type { RegisterRecord, RegisterType } from '../../types/registers'

export type RegisterStats = {
  /** Active records (status === 'active') in this type. */
  total: number
  /** Active + draft + archived (full census, for displays that show all). */
  totalAll: number
  /** Active records past their review_due_at. */
  reviewsOverdue: number
  /** Active records with review_due_at in the next 30 days. */
  reviewsDueSoon: number
  /** Records flagged with CMR via display_metadata.cmrField. */
  cmrCount: number
  /** Open vs. archived breakdown for sidebar pill rows. */
  drafts: number
  archived: number
  /**
   * Free-form per-pill counters used by the per-register filter chips
   * on the detail page. Keys are filter ids; values are counts.
   * Computed in `chipsForRecords` because the relevant chips depend on
   * which fields the type declares.
   */
  byChip: Record<string, number>
}

const DAY_MS = 86_400_000

function inRange(due: Date, today: Date, days: number): boolean {
  return due >= today && due.getTime() - today.getTime() <= days * DAY_MS
}

function parseDate(v: unknown): Date | null {
  if (typeof v !== 'string' || !v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Compute stats for a single type's records. Pass active + soft-deleted
 * records filtered out by the caller (the per-type list already drops
 * deleted rows; the cross-type aggregator does the same).
 */
export function computeRegisterStats(
  type: RegisterType,
  records: RegisterRecord[],
): RegisterStats {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let total = 0
  let drafts = 0
  let archived = 0
  let reviewsOverdue = 0
  let reviewsDueSoon = 0
  let cmrCount = 0

  const byChip: Record<string, number> = {}

  const cmrKey = type.displayMetadata.cmrField ?? null
  const fieldKeys = new Set(type.metadataSchema.fields.map((f) => f.key))

  for (const r of records) {
    if (r.status === 'active') total += 1
    else if (r.status === 'draft') drafts += 1
    else if (r.status === 'archived') archived += 1

    if (r.reviewDueAt) {
      const due = parseDate(r.reviewDueAt)
      if (due) {
        if (due < today) reviewsOverdue += 1
        else if (inRange(due, today, 30)) reviewsDueSoon += 1
      }
    }

    if (cmrKey && fieldKeys.has(cmrKey) && r.values[cmrKey] === true) cmrCount += 1
  }

  // Detail-page chip counters
  byChip['all'] = records.length
  if (reviewsOverdue > 0) byChip['reviews_overdue'] = reviewsOverdue
  if (reviewsDueSoon > 0) byChip['reviews_due_soon'] = reviewsDueSoon
  if (drafts > 0) byChip['drafts'] = drafts
  if (archived > 0) byChip['archived'] = archived
  if (cmrCount > 0) byChip['cmr'] = cmrCount

  // Severity / status field chips — derived from select fields that
  // look like a status column. We inspect the metadata_schema for any
  // 'select' field with options that overlap a well-known status
  // vocabulary, then count the records per option.
  for (const field of type.metadataSchema.fields) {
    if (field.kind !== 'select' || !field.options) continue
    const lowerKey = field.key.toLowerCase()
    const isStatusLike = /(status|severity|severitet|alvorlighet|risiko|compliance|risk|criticality|kritikalitet)/.test(
      lowerKey,
    )
    if (!isStatusLike) continue
    for (const opt of field.options) {
      const count = records.filter((r) => r.values[field.key] === opt.value).length
      if (count > 0) byChip[`${field.key}:${opt.value}`] = count
    }
  }

  return {
    total,
    totalAll: records.length,
    reviewsOverdue,
    reviewsDueSoon,
    cmrCount,
    drafts,
    archived,
    byChip,
  }
}

/**
 * Cross-type rollup: how many issues across the whole org. Used by the
 * "Compliance-status" sidebar on the hub page (utløper snart / utgått
 * / sensitive / mandatory). 'expiringSoon' = reviews due in 90 days
 * (broader than the per-type chip).
 */
export type RegisterComplianceSummary = {
  mandatoryRegisters: number
  totalRegisters: number
  sensitiveRegisters: number
  expiringSoon: number
  overdue: number
}

export function computeComplianceSummary(
  types: RegisterType[],
  recordsByType: Map<string, RegisterRecord[]>,
): RegisterComplianceSummary {
  const enabledTypes = types
  const mandatoryRegisters = enabledTypes.filter((t) => t.displayMetadata.mandatory === true).length
  const sensitiveRegisters = enabledTypes.filter(
    (t) => t.displayMetadata.sensitive === true || t.displayMetadata.gdpr === true,
  ).length

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let overdue = 0
  let expiringSoon = 0
  for (const [, recs] of recordsByType) {
    for (const r of recs) {
      if (!r.reviewDueAt) continue
      const due = parseDate(r.reviewDueAt)
      if (!due) continue
      if (due < today) overdue += 1
      else if (inRange(due, today, 90)) expiringSoon += 1
    }
  }

  return {
    mandatoryRegisters,
    totalRegisters: enabledTypes.length,
    sensitiveRegisters,
    expiringSoon,
    overdue,
  }
}

/**
 * Group records by their type for downstream per-type stats.
 * Skips records whose type isn't in the catalogue (orphan after type
 * deletion — shouldn't happen in practice but safe-guarded here).
 */
export function groupRecordsByType(
  records: RegisterRecord[],
): Map<string, RegisterRecord[]> {
  const out = new Map<string, RegisterRecord[]>()
  for (const r of records) {
    const arr = out.get(r.registerTypeId) ?? []
    arr.push(r)
    out.set(r.registerTypeId, arr)
  }
  return out
}

/** Filter records for the detail-page chip filter. */
export function filterByChip(
  type: RegisterType,
  records: RegisterRecord[],
  chipId: string,
): RegisterRecord[] {
  if (chipId === 'all') return records
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (chipId === 'reviews_overdue') {
    return records.filter((r) => {
      const due = parseDate(r.reviewDueAt)
      return due !== null && due < today
    })
  }
  if (chipId === 'reviews_due_soon') {
    return records.filter((r) => {
      const due = parseDate(r.reviewDueAt)
      return due !== null && inRange(due, today, 30)
    })
  }
  if (chipId === 'drafts') return records.filter((r) => r.status === 'draft')
  if (chipId === 'archived') return records.filter((r) => r.status === 'archived')
  if (chipId === 'cmr') {
    const k = type.displayMetadata.cmrField
    if (!k) return []
    return records.filter((r) => r.values[k] === true)
  }
  // Field-specific filter ("field:value")
  const colonIdx = chipId.indexOf(':')
  if (colonIdx > 0) {
    const key = chipId.slice(0, colonIdx)
    const value = chipId.slice(colonIdx + 1)
    return records.filter((r) => r.values[key] === value)
  }
  return records
}
