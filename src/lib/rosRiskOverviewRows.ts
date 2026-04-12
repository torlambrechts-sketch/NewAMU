import { computeRiskScore, riskColour } from '../data/rosTemplate'
import type { RosAssessment } from '../types/internalControl'

export type RosRiskOverviewTableRow = {
  id: string
  category: string
  rosTitle: string
  riskTitle: string
  score: number
  level: 'Lav' | 'Middels' | 'Høy'
}

function scoreToRiskLevel(score: number): RosRiskOverviewTableRow['level'] {
  const band = riskColour(score)
  if (band === 'green') return 'Lav'
  if (band === 'yellow') return 'Middels'
  return 'Høy'
}

/** Flate ut alle risikorader fra organisasjonens ROS-vurderinger. */
export function buildRosRiskOverviewRows(assessments: RosAssessment[]): RosRiskOverviewTableRow[] {
  const out: RosRiskOverviewTableRow[] = []
  for (const ros of assessments) {
    for (const row of ros.rows) {
      const score =
        row.residualScore != null ? row.residualScore : computeRiskScore(row.severity, row.likelihood)
      const riskTitle = [row.activity, row.hazard].filter((s) => s?.trim()).join(' — ') || 'Uten tittel'
      out.push({
        id: `${ros.id}:${row.id}`,
        category: ros.department?.trim() || 'Uten avdeling',
        rosTitle: ros.title,
        riskTitle,
        score,
        level: scoreToRiskLevel(score),
      })
    }
  }
  return out
}
