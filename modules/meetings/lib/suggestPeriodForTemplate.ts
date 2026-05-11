// Period suggestion helper for the create-meeting + Datapakke flows.
//
// Given a template's `cadenceHint` plus the meeting's `scheduledAt`, returns
// a sensible default reporting period the chair can accept or override.
//
//   quarterly  → previous calendar quarter relative to scheduledAt
//   semiannual → previous calendar half-year (H1 = Jan-Jun, H2 = Jul-Dec)
//   annual     → previous calendar year
//   monthly    → previous calendar month
//   ad_hoc     → no suggestion (returns nulls)
//
// The label is human-readable Norwegian (e.g. "Q4 2025", "H1 2025", "2024").

import type { MeetingCadence } from '../types'

export type SuggestedPeriod = {
  start: string | null
  end: string | null
  label: string | null
}

const NULL_PERIOD: SuggestedPeriod = { start: null, end: null, label: null }

function fmtDate(d: Date): string {
  // ISO date only, e.g. "2025-12-31"
  return d.toISOString().slice(0, 10)
}

function previousQuarter(anchor: Date): SuggestedPeriod {
  // Compute the calendar quarter PRECEDING the anchor.
  // Q1 = Jan-Mar · Q2 = Apr-Jun · Q3 = Jul-Sep · Q4 = Oct-Dec
  const anchorQ = Math.floor(anchor.getUTCMonth() / 3) // 0..3
  let prevQ = anchorQ - 1
  let year = anchor.getUTCFullYear()
  if (prevQ < 0) {
    prevQ = 3
    year -= 1
  }
  const startMonth = prevQ * 3
  const start = new Date(Date.UTC(year, startMonth, 1))
  const end = new Date(Date.UTC(year, startMonth + 3, 0)) // last day of quarter
  return { start: fmtDate(start), end: fmtDate(end), label: `Q${prevQ + 1} ${year}` }
}

function previousHalfYear(anchor: Date): SuggestedPeriod {
  // Previous calendar half (H1 = Jan-Jun, H2 = Jul-Dec).
  const anchorH = anchor.getUTCMonth() < 6 ? 0 : 1
  let prevH = anchorH - 1
  let year = anchor.getUTCFullYear()
  if (prevH < 0) {
    prevH = 1
    year -= 1
  }
  const startMonth = prevH * 6
  const start = new Date(Date.UTC(year, startMonth, 1))
  const end = new Date(Date.UTC(year, startMonth + 6, 0))
  return { start: fmtDate(start), end: fmtDate(end), label: `H${prevH + 1} ${year}` }
}

function previousYear(anchor: Date): SuggestedPeriod {
  const year = anchor.getUTCFullYear() - 1
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    label: String(year),
  }
}

function previousMonth(anchor: Date): SuggestedPeriod {
  let month = anchor.getUTCMonth() - 1
  let year = anchor.getUTCFullYear()
  if (month < 0) {
    month = 11
    year -= 1
  }
  const start = new Date(Date.UTC(year, month, 1))
  const end = new Date(Date.UTC(year, month + 1, 0))
  const monthName = start.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' })
  return { start: fmtDate(start), end: fmtDate(end), label: monthName }
}

/**
 * Suggest a reporting period the user can accept or override in the
 * create-meeting dialog. Returns nulls for ad-hoc templates (no canonical
 * window) and when cadence is unknown.
 */
export function suggestPeriodForTemplate(
  cadenceHint: MeetingCadence | null | undefined,
  scheduledAt: string | null | undefined,
): SuggestedPeriod {
  const anchor = scheduledAt ? new Date(scheduledAt) : new Date()
  if (Number.isNaN(anchor.getTime())) return NULL_PERIOD
  switch (cadenceHint) {
    case 'quarterly':
      return previousQuarter(anchor)
    case 'semiannual':
      return previousHalfYear(anchor)
    case 'annual':
      return previousYear(anchor)
    case 'monthly':
      return previousMonth(anchor)
    case 'ad_hoc':
    default:
      return NULL_PERIOD
  }
}

/** Quick-pick presets shown in the picker (label + relative-to-anchor fn). */
export const PERIOD_PRESETS: Array<{
  key: string
  label: string
  compute: (anchor: Date) => SuggestedPeriod
}> = [
  { key: 'prev_quarter', label: 'Forrige kvartal', compute: previousQuarter },
  { key: 'prev_half', label: 'Forrige halvår', compute: previousHalfYear },
  { key: 'prev_year', label: 'Forrige år', compute: previousYear },
  { key: 'prev_month', label: 'Forrige måned', compute: previousMonth },
]
