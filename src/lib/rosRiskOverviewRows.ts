import { computeRiskScore, riskColour } from '../data/rosTemplate'
import type { RosAssessment, RosRiskRow } from '../types/internalControl'

export type RosRiskOverviewTableRow = {
  id: string
  category: string
  rosTitle: string
  riskTitle: string
  score: number
  level: 'Lav' | 'Middels' | 'Høy'
}

/** Samme flate liste som tabellen, med 5×5-akser (0–4: topp = høy konsekvens, venstre = lav sannsynlighet). */
export type RosRiskFlattenedRow = RosRiskOverviewTableRow & {
  displayIndex: number
  impactIndex: number
  likelihoodIndex: number
}

function scoreToRiskLevel(score: number): RosRiskOverviewTableRow['level'] {
  const band = riskColour(score)
  if (band === 'green') return 'Lav'
  if (band === 'yellow') return 'Middels'
  return 'Høy'
}

function clampAxis1to5(n: number): number {
  return Math.min(5, Math.max(1, Math.round(n)))
}

/** Brutto- eller rest-akser: begge restfelt må være satt for å bruke rest på aksene (samme logikk som score). */
export function rosRowAxesForMatrix(row: RosRiskRow): { severity: number; likelihood: number } {
  if (row.residualSeverity != null && row.residualLikelihood != null) {
    return { severity: row.residualSeverity, likelihood: row.residualLikelihood }
  }
  return { severity: row.severity, likelihood: row.likelihood }
}

/**
 * 5×5-varmekart: rad 0 øverst = høy konsekvens (alvor 5), kolonne 0 = lav sannsynlighet (1).
 */
export function matrixCellIndicesFromAxes(severity: number, likelihood: number): {
  impactRow: number
  likelihoodCol: number
} {
  const s = clampAxis1to5(severity)
  const l = clampAxis1to5(likelihood)
  return {
    impactRow: 5 - s,
    likelihoodCol: l - 1,
  }
}

/** Én flat rad per risiko — brukes av både varmekart og gruppert risiko-oversikt. */
export function buildRosRiskFlattenedRows(assessments: RosAssessment[]): RosRiskFlattenedRow[] {
  const out: RosRiskFlattenedRow[] = []
  let displayIndex = 0
  for (const ros of assessments) {
    for (const row of ros.rows) {
      displayIndex += 1
      const { severity, likelihood } = rosRowAxesForMatrix(row)
      const { impactRow, likelihoodCol } = matrixCellIndicesFromAxes(severity, likelihood)
      const score =
        row.residualScore != null ? row.residualScore : computeRiskScore(row.severity, row.likelihood)
      const riskTitle = [row.activity, row.hazard].filter((s) => s?.trim()).join(' — ') || 'Uten tittel'
      out.push({
        id: `${ros.id}:${row.id}`,
        displayIndex,
        category: ros.department?.trim() || 'Uten avdeling',
        rosTitle: ros.title,
        riskTitle,
        score,
        level: scoreToRiskLevel(score),
        impactIndex: impactRow,
        likelihoodIndex: likelihoodCol,
      })
    }
  }
  return out
}

/** Flate ut alle risikorader fra organisasjonens ROS-vurderinger (kun tabellfelt). */
export function buildRosRiskOverviewRows(assessments: RosAssessment[]): RosRiskOverviewTableRow[] {
  return buildRosRiskFlattenedRows(assessments).map((r) => ({
    id: r.id,
    category: r.category,
    rosTitle: r.rosTitle,
    riskTitle: r.riskTitle,
    score: r.score,
    level: r.level,
  }))
}
