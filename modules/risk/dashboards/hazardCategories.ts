// Hazard categories for the risk dashboard.
//
// Norwegian HMS convention (ROS / SJA / ISO 45001) recognises a stable set
// of hazard kinds. Psychosocial is broken out as a first-class category —
// ISO 45001 2026 explicitly elevates it (AML § 4-3), and the user-facing
// dashboard needs to surface it on its own slice.
//
// The ids are the chip values used by the `hazardCategory` filter
// dimension; the legacy `ros_hazard_categories` table uses similar slugs
// so the future unified view (P2) lines up without an alias map.

export type HazardCategoryId =
  | 'physical'
  | 'chemical'
  | 'ergonomic'
  | 'psychosocial'
  | 'fire'
  | 'electrical'
  | 'environmental'
  | 'other'

export type HazardCategory = {
  id: HazardCategoryId
  labelNb: string
  description: string
  /** Hex accent used in legend chips. */
  accent: string
}

export const HAZARD_CATEGORIES: HazardCategory[] = [
  { id: 'physical', labelNb: 'Fysisk', description: 'Fall, klem, støy, vibrasjon, belysning, ergonomi-uavhengig fysisk skade.', accent: '#1f2937' },
  { id: 'chemical', labelNb: 'Kjemisk', description: 'Eksponering for kjemikalier, gasser, støv, biologiske agens.', accent: '#7c3aed' },
  { id: 'ergonomic', labelNb: 'Ergonomisk', description: 'Tunge løft, repetitivt arbeid, statiske arbeidsstillinger.', accent: '#0e7490' },
  { id: 'psychosocial', labelNb: 'Psykososial', description: 'Stress, trakassering, vold/trusler, rollekonflikt, høyt arbeidspress (AML § 4-3).', accent: '#be185d' },
  { id: 'fire', labelNb: 'Brann/eksplosjon', description: 'Brann, eksplosjon, beredskap, rømning (Brann- og eksplosjonsvernloven).', accent: '#c2410c' },
  { id: 'electrical', labelNb: 'Elektrisk', description: 'Elektrisk støt, lysbue, elektrisk anlegg.', accent: '#f59e0b' },
  { id: 'environmental', labelNb: 'Ytre miljø', description: 'Utslipp til vann/luft/jord, avfall, energiforbruk.', accent: '#15803d' },
  { id: 'other', labelNb: 'Annet', description: 'Risiko som ikke faller inn under øvrige kategorier.', accent: '#737373' },
]

export const HAZARD_CATEGORY_OPTIONS = HAZARD_CATEGORIES.map((c) => ({
  id: c.id,
  label: c.labelNb,
}))

// ── Source-severity → consequence axis (1–5) ─────────────────────────────
// The compliance and inspection modules use a 4-level severity enum
// (low/medium/high/critical). The ROS convention is a 1–5 consequence
// axis. We map the 4 levels onto positions 1, 2, 4, 5 — leaving 3
// (Moderat) as the implicit "no signal yet" middle ground so the bell
// curve doesn't lump everything onto the median when severity is set.

export type SourceSeverity = 'low' | 'medium' | 'high' | 'critical'

export function mapSeverityToConsequence(s: SourceSeverity | null | undefined): 1 | 2 | 3 | 4 | 5 {
  switch (s) {
    case 'low': return 1
    case 'medium': return 2
    case 'high': return 4
    case 'critical': return 5
    default: return 3
  }
}

// Tasks expose `priority` (low/medium/high/critical) — we treat task
// priority as a stand-in for severity when the task came from an avvik or
// nestenulykke. Same mapping.
export function mapPriorityToConsequence(
  p: 'low' | 'medium' | 'high' | 'critical' | null | undefined,
): 1 | 2 | 3 | 4 | 5 {
  return mapSeverityToConsequence(p as SourceSeverity | null | undefined)
}

// Recurrence count → likelihood axis (1–5). Single occurrence = 1,
// 2–3 = 2 (Sjelden), 4–6 = 3 (Av og til), 7–12 = 4 (Ofte), 13+ = 5
// (Svært ofte). Buckets follow the ROS 5-pt scale familiar in NO HMS.
export function mapRecurrenceToLikelihood(count: number): 1 | 2 | 3 | 4 | 5 {
  if (count >= 13) return 5
  if (count >= 7) return 4
  if (count >= 4) return 3
  if (count >= 2) return 2
  return 1
}

// ── Risk-score banding (mirrors src/data/rosTemplate.ts) ─────────────────
// Kept here so the risk dashboard doesn't import from data/* (which the
// legacy ROS UI used). The math is `severity × likelihood ∈ 1..25`.
export type RiskBand = 'green' | 'yellow' | 'red'

export function riskBand(score: number): RiskBand {
  if (score >= 13) return 'red'
  if (score >= 7) return 'yellow'
  return 'green'
}

export function riskBandLabel(band: RiskBand): string {
  switch (band) {
    case 'green': return 'Akseptabel'
    case 'yellow': return 'Moderat'
    case 'red': return 'Uakseptabel'
  }
}

// Norwegian psychosocial signal — any of these law refs in a row's
// `law_refs[]` indicates the row is psychosocial in nature, regardless of
// whether it was tagged in the hazard_category column. Used by the
// `risk_psychosocial_share` dataset.
export const PSYCHOSOCIAL_LAW_REFS = [
  'AML § 4-3',
  'AML § 4-3 (1)',
  'AML § 4-3 (2)',
  'AML § 4-3 (3)',
  'AML § 4-3 (4)',
] as const
