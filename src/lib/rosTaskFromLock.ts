import { riskColour } from '../data/rosTemplate'
import { consequenceCategoryLabel } from '../data/rosConsequenceCategories'
import type { RosAssessment, RosRiskRow } from '../types/internalControl'

function nonEmpty(s: string | undefined): boolean {
  return Boolean(s?.trim())
}

/**
 * Opprett oppgave ved låst ROS når handlingsplan er utfylt og risiko ikke er akseptert
 * (gul/rød brutto eller gul/rød restrisiko etter tiltak).
 */
export function shouldCreateTaskForRosRow(row: RosRiskRow): boolean {
  const measure = row.proposedMeasures?.trim()
  const who = row.responsible?.trim()
  const due = row.dueDate?.trim()
  if (!measure || !who || !due) return false

  const grossHigh = riskColour(row.riskScore) !== 'green'
  const residual = row.residualScore
  const residualHigh = residual != null && riskColour(residual) !== 'green'

  if (grossHigh && (residual == null || residualHigh)) return true
  if (residualHigh) return true
  return false
}

export function buildRosApprovedTaskDescription(ros: RosAssessment, row: RosRiskRow): string {
  const lines: string[] = []
  lines.push(`Automatisk fra godkjent og låst ROS «${ros.title}».`)
  lines.push('')
  if (nonEmpty(ros.description)) {
    lines.push('Kontekst (ROS-beskrivelse):')
    lines.push(ros.description!.trim())
    lines.push('')
  }
  lines.push(`Avdeling: ${ros.department || '—'} · Vurdert av: ${ros.assessor || '—'} · Dato: ${ros.assessedAt}`)
  lines.push('')
  lines.push('Risiko:')
  lines.push(`Konsekvenskategori: ${consequenceCategoryLabel(row.consequenceCategory)}`)
  if (nonEmpty(row.riskCategory)) lines.push(`Tema: ${row.riskCategory}`)
  lines.push(`Aktivitet: ${row.activity || '—'}`)
  lines.push(`Fare / hendelse: ${row.hazard || '—'}`)
  lines.push(`Brutt risiko: ${row.riskScore} (alvor ${row.severity} × sannsynlighet ${row.likelihood})`)
  if (row.residualScore != null) {
    lines.push(
      `Restrisiko etter tiltak: ${row.residualScore}` +
        (row.residualSeverity != null && row.residualLikelihood != null
          ? ` (alvor ${row.residualSeverity} × sannsynlighet ${row.residualLikelihood})`
          : ''),
    )
  }
  lines.push('')
  if (nonEmpty(row.vulnerabilityHuman) || nonEmpty(row.vulnerabilityTechnical) || nonEmpty(row.vulnerabilityOrganizational)) {
    lines.push('Sårbarhetsvurdering:')
    if (nonEmpty(row.vulnerabilityHuman)) lines.push(`· Menneskelige faktorer: ${row.vulnerabilityHuman!.trim()}`)
    if (nonEmpty(row.vulnerabilityTechnical)) lines.push(`· Tekniske faktorer: ${row.vulnerabilityTechnical!.trim()}`)
    if (nonEmpty(row.vulnerabilityOrganizational)) lines.push(`· Organisatoriske faktorer: ${row.vulnerabilityOrganizational!.trim()}`)
    lines.push('')
  }
  if (nonEmpty(row.existingControls) || nonEmpty(row.barrierPreventive) || nonEmpty(row.barrierConsequenceReducing)) {
    lines.push('Eksisterende barrierer / tiltak:')
    if (nonEmpty(row.barrierPreventive)) lines.push(`· Forebyggende: ${row.barrierPreventive!.trim()}`)
    if (nonEmpty(row.barrierConsequenceReducing)) lines.push(`· Konsekvensreduserende: ${row.barrierConsequenceReducing!.trim()}`)
    if (nonEmpty(row.existingControls)) lines.push(`· Øvrig: ${row.existingControls!.trim()}`)
    lines.push('')
  }
  if (nonEmpty(row.uncertaintyNotes)) {
    lines.push('Usikkerhet / kunnskapsgrunnlag:')
    lines.push(row.uncertaintyNotes!.trim())
    lines.push('')
  }
  lines.push('Handlingsplan (risikoreduserende tiltak):')
  lines.push(row.proposedMeasures!.trim())
  if (nonEmpty(row.residualNarrative)) {
    lines.push('')
    lines.push('Restrisiko / aksept (vurdering etter tiltak):')
    lines.push(row.residualNarrative!.trim())
  }
  if (nonEmpty(row.redResidualJustification)) {
    lines.push('')
    lines.push('Strakstiltak / eskalering (ved rød restrisiko):')
    lines.push(row.redResidualJustification!.trim())
  }
  return lines.join('\n')
}
