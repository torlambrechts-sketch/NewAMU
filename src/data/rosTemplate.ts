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
    status: 'open',
    residualSeverity: undefined,
    residualLikelihood: undefined,
    residualScore: undefined,
  }
}

/** Risk colour thresholds (standard 5×5 matrix) */
export function riskColour(score: number): 'green' | 'yellow' | 'red' {
  if (score <= 6) return 'green'
  if (score <= 12) return 'yellow'
  return 'red'
}

export const RISK_COLOUR_CLASSES: Record<'green' | 'yellow' | 'red', { bg: string; text: string; border: string; label: string }> = {
  green:  { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300', label: 'Akseptabel' },
  yellow: { bg: 'bg-amber-100',   text: 'text-amber-900',   border: 'border-amber-300',   label: 'Moderat' },
  red:    { bg: 'bg-red-100',     text: 'text-red-800',     border: 'border-red-300',     label: 'Uakseptabel' },
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
