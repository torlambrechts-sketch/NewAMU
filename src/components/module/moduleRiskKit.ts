/**
 * Shared visual language for severity and risk-score across HSE module
 * records tables (Inspeksjonsrunder «Avvik», ROS «Tiltak», ROS «Farekilder»,
 * future SJA / Avvik-modulen).
 *
 * The **chrome** (KPIs, card, postings-shell) is already shared via
 * `ModuleRecordsTableShell`. These helpers cover the remaining inconsistency
 * — how a single row renders its severity (left-border + tint) and how a
 * single cell renders a risk-score badge (colour + «15 — Kritisk» label).
 *
 * Rationale: Avvik and Tiltak use the same vocabulary (low/medium/high/
 * critical), the same 5×5 risk matrix and the same Badge component. Having
 * a single source of truth means a design change to severity colouring
 * propagates to every module automatically.
 */
import type { BadgeVariant } from '../ui/Badge'
import { riskLabel as sharedRiskLabel } from '../hse/RiskMatrix'

export type ModuleSeverity = 'low' | 'medium' | 'high' | 'critical'

const SEVERITY_LABEL_NB: Record<ModuleSeverity, string> = {
  low: 'Lav',
  medium: 'Middels',
  high: 'Høy',
  critical: 'Kritisk',
}

/**
 * Norwegian label for a severity level. Use for badge text.
 */
export function moduleSeverityLabel(severity: ModuleSeverity): string {
  return SEVERITY_LABEL_NB[severity]
}

/**
 * Canonical `<Badge variant="…">` for a severity level.
 *
 * `low` → `info` (blue) so it stands apart from unfilled neutral rows.
 */
export function moduleSeverityBadgeVariant(severity: ModuleSeverity): BadgeVariant {
  switch (severity) {
    case 'low':
      return 'info'
    case 'medium':
      return 'medium'
    case 'high':
      return 'high'
    case 'critical':
      return 'critical'
    default:
      return 'neutral'
  }
}

/**
 * Left-border + tinted background for a records-table row keyed on severity.
 *
 * Matches the existing Avvik-row treatment (border-l-4 red/orange/yellow/blue)
 * and is intended for any row that represents a severity-graded event
 * (avvik, tiltak linked to a critical hazard, SJA-risk step, …).
 *
 * Apply to `<tr>` alongside the default hover/border classes:
 *
 * ```tsx
 * <tr className={`${MODULE_TABLE_TR_BODY} ${moduleSeverityRowClass(severity)}`}>
 * ```
 */
export function moduleSeverityRowClass(severity: ModuleSeverity | null | undefined): string {
  switch (severity) {
    case 'critical':
      return 'border-l-4 border-l-red-500 bg-red-50/30'
    case 'high':
      return 'border-l-4 border-l-orange-400 bg-orange-50/20'
    case 'medium':
      return 'border-l-4 border-l-yellow-400'
    case 'low':
      return 'border-l-4 border-l-blue-300'
    default:
      return ''
  }
}

/**
 * Map a numeric 1–25 risk score (from a 5×5 probability×consequence matrix) to
 * a severity band. Keeps Avvik and Tiltak in sync with the thresholds defined
 * by `riskLabel` in `RiskMatrix.tsx`.
 */
export function moduleSeverityFromScore(score: number | null | undefined): ModuleSeverity | null {
  if (score == null) return null
  if (score <= 4) return 'low'
  if (score <= 9) return 'medium'
  if (score <= 14) return 'high'
  return 'critical'
}

/**
 * `<Badge>` variant matching the severity band a numeric score falls into.
 */
export function moduleRiskScoreBadgeVariant(score: number | null | undefined): BadgeVariant {
  const band = moduleSeverityFromScore(score)
  return band ? moduleSeverityBadgeVariant(band) : 'neutral'
}

/**
 * Standard «15 — Kritisk» label for a score badge. Returns only the label
 * string — pass it inside a `<Badge variant={moduleRiskScoreBadgeVariant(score)}>`.
 */
export function moduleRiskScoreLabel(score: number | null | undefined): string {
  if (score == null) return '—'
  return `${score} — ${sharedRiskLabel(score)}`
}
