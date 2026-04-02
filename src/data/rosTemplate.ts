import type { RosRiskRow } from '../types/internalControl'

/** Start-rader for ny ROS — tilpass virksomheten. */
export function emptyRosRow(): RosRiskRow {
  return {
    id: crypto.randomUUID(),
    activity: '',
    hazard: '',
    existingControls: '',
    severity: 3,
    likelihood: 3,
    riskScore: 9,
    proposedMeasures: '',
    responsible: '',
    dueDate: '',
    done: false,
  }
}

export const ROS_TEMPLATE_HELP = {
  title: 'ROS — risiko og sikkerhet',
  intro:
    'Mal for systematisk kartlegging (illustrasjon). I virksomheten må dere dokumentere etter eget regelverk og internkontrollforskriften.',
  severityScale: 'Alvor (1–5): konsekvens ved uønsket hendelse.',
  likelihoodScale: 'Sannsynlighet (1–5): hvor sannsynlig er det at faren inntreffer.',
}

export function computeRiskScore(severity: number, likelihood: number): number {
  const s = Math.min(5, Math.max(1, Math.round(severity)))
  const l = Math.min(5, Math.max(1, Math.round(likelihood)))
  return s * l
}
