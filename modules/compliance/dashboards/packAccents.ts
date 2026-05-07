// Per-pack accent colours for compliance dashboards (4.4).
//
// `accent` is already a runtime prop on `ModuleAnalyticsDashboard` —
// per-pack colours simply make AML and ISO dashboards visually
// distinguishable when an admin switches the active pack focus via the
// sidebar pack switcher (?pack=… on the URL).
//
// Picked from the same family as the brand green so the visual jump
// stays calm; saturation differences carry the signal.

import type { CompliancePackSlug } from '../types'

export const PACK_ACCENTS: Record<CompliancePackSlug, string> = {
  'aml-amu': '#1a3d32', // brand green — AML / arbeidsmiljø
  'iso-45001': '#1e40af', // ISO blue — occupational H&S
}

/**
 * Resolve the accent for the active pack, or null if no pack focus is
 * set. Pages typically combine this with the scope's default accent:
 *
 *   const accent = packAccentFor(activeSlug) ?? getDashboardScope(...)?.accent
 */
export function packAccentFor(slug: CompliancePackSlug | string | null | undefined): string | null {
  if (!slug) return null
  return PACK_ACCENTS[slug as CompliancePackSlug] ?? null
}
