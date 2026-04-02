import type { AmlReportKind } from './orgHealth'

/** Varslingssak — støtteverktøy; ikke juridisk komplett etter aml. kap. 2 A. */
export type WhistleCaseStatus =
  | 'received'
  | 'triage'
  | 'investigation'
  | 'internal_review'
  | 'closed'

export type WhistleCase = {
  id: string
  title: string
  /** Opprinnelig kategori fra anonym melding eller manuell */
  categoryKind?: AmlReportKind
  status: WhistleCaseStatus
  createdAt: string
  updatedAt: string
  /** Valgfri kobling til anonym org.health-melding (ID) */
  sourceAnonymousReportId?: string
  assignee: string
  /** Interne notater (ikke «ekstern varsling») */
  internalNotes: string
}

export type RosRiskRow = {
  id: string
  activity: string
  hazard: string
  existingControls: string
  /** 1–5 illustrativ skala */
  severity: number
  /** 1–5 illustrativ skala */
  likelihood: number
  /** beregnet sn × lk for demo */
  riskScore: number
  proposedMeasures: string
  responsible: string
  dueDate: string
  done: boolean
}

/** ROS / risikovurdering (mal kan kopieres) */
export type RosAssessment = {
  id: string
  title: string
  department: string
  assessedAt: string
  assessor: string
  rows: RosRiskRow[]
  createdAt: string
  updatedAt: string
}

/** Årlig gjennomgang av internkontrollen (illustrativ) */
export type AnnualReview = {
  id: string
  year: number
  reviewedAt: string
  reviewer: string
  summary: string
  /** Neste planlagte gjennomgang */
  nextReviewDue: string
}

export type InternalControlAuditEntry = {
  id: string
  at: string
  action: string
  message: string
  meta?: Record<string, string | number | boolean>
}
