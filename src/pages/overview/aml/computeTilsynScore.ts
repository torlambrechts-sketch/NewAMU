// Tilsyn-beredskap — composite compliance score, 0–100, open formula.
//
// MetricStream's pattern of leading with one number, but rejecting their
// black-box anti-pattern: every input here is visible and clickable.
// Weights are constants for v0; can move to org settings later.
//
//   D = Dekningsgrad      (% AML §§ with ≥1 artefact across modules)
//   E = Bevis-friskhet    (% recent evidence within freshness window)
//   P = Plan-progresjon   (% plan_items in 'done' status)
//   A = Attestasjons-rate (placeholder for Sprint γ — currently 1.0)
//
// See specs/unified-aml-view.md §5.

import type { InternkontrollDatasets } from '../internkontroll/useInternkontrollDatasets'

export type TilsynStatus = 'kritisk' | 'svak' | 'akseptabel' | 'god' | 'sterk'

export type TilsynScoreInputs = {
  D: number // 0..1
  E: number // 0..1
  P: number // 0..1
  A: number // 0..1
}

export type TilsynScoreResult = {
  score: number // rounded 0..100
  status: TilsynStatus
  inputs: TilsynScoreInputs
  /** Pretty-printed contribution per input — for the formula popover. */
  components: {
    label: string
    rawPct: number // 0..100
    weight: number
    contribution: number // weight × rawPct
  }[]
}

export const TILSYN_WEIGHTS = {
  D: 0.4,
  E: 0.25,
  P: 0.2,
  A: 0.15,
} as const

const STATUS_THRESHOLDS: { min: number; status: TilsynStatus }[] = [
  { min: 85, status: 'sterk' },
  { min: 70, status: 'god' },
  { min: 55, status: 'akseptabel' },
  { min: 40, status: 'svak' },
  { min: 0, status: 'kritisk' },
]

export const STATUS_LABEL: Record<TilsynStatus, string> = {
  kritisk: 'Kritisk',
  svak: 'Svak',
  akseptabel: 'Akseptabel',
  god: 'God',
  sterk: 'Sterk',
}

export const STATUS_COLOR: Record<TilsynStatus, string> = {
  kritisk: '#dc2626',
  svak: '#d97706',
  akseptabel: '#ca8a04',
  god: '#16a34a',
  sterk: '#15803d',
}

export function statusFromScore(score: number): TilsynStatus {
  for (const t of STATUS_THRESHOLDS) {
    if (score >= t.min) return t.status
  }
  return 'kritisk'
}

/**
 * Compute the score from the internkontroll datasets we already produce.
 * Defensive against zero-row situations — D=0 when no paragraphs exist.
 *
 * Inputs derived for v0:
 * - D from `internkontroll_kpi_summary.pctCoverage` (0..100 → 0..1)
 * - E placeholder = 1.0 until we wire recent_evidence freshness in Sprint γ
 * - P from `internkontroll_plan_items_by_status.Fullført` /
 *        total of all four statuses, or 1.0 when zero plan items exist
 *        (no backlog = nothing to fail on)
 * - A placeholder = 1.0 until Sprint β attestation lineage lands
 */
export function computeTilsynScore(
  datasets: Pick<
    InternkontrollDatasets,
    'internkontroll_kpi_summary' | 'internkontroll_plan_items_by_status'
  >,
): TilsynScoreResult {
  const D = (datasets.internkontroll_kpi_summary.pctCoverage ?? 0) / 100

  const E = 1.0 // Sprint γ wires this from recent_evidence freshness

  const planByStatus = datasets.internkontroll_plan_items_by_status
  const planTotal =
    (planByStatus.Planlagt ?? 0) +
    (planByStatus.Pågår ?? 0) +
    (planByStatus.Blokkert ?? 0) +
    (planByStatus.Fullført ?? 0)
  const P = planTotal === 0 ? 1.0 : (planByStatus.Fullført ?? 0) / planTotal

  const A = 1.0 // Sprint β wires this from document_attestations

  const score = Math.round(
    100 *
      (TILSYN_WEIGHTS.D * D +
        TILSYN_WEIGHTS.E * E +
        TILSYN_WEIGHTS.P * P +
        TILSYN_WEIGHTS.A * A),
  )

  const status = statusFromScore(score)

  return {
    score: Math.max(0, Math.min(100, score)),
    status,
    inputs: { D, E, P, A },
    components: [
      {
        label: 'Dekningsgrad',
        rawPct: Math.round(D * 100),
        weight: TILSYN_WEIGHTS.D,
        contribution: TILSYN_WEIGHTS.D * D * 100,
      },
      {
        label: 'Bevis-friskhet',
        rawPct: Math.round(E * 100),
        weight: TILSYN_WEIGHTS.E,
        contribution: TILSYN_WEIGHTS.E * E * 100,
      },
      {
        label: 'Plan-progresjon',
        rawPct: Math.round(P * 100),
        weight: TILSYN_WEIGHTS.P,
        contribution: TILSYN_WEIGHTS.P * P * 100,
      },
      {
        label: 'Attestasjons-rate',
        rawPct: Math.round(A * 100),
        weight: TILSYN_WEIGHTS.A,
        contribution: TILSYN_WEIGHTS.A * A * 100,
      },
    ],
  }
}
