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

export type RosRowStatus = 'open' | 'in_progress' | 'closed'

export type RosRiskRow = {
  id: string
  activity: string
  hazard: string
  existingControls: string
  /** 1–5 illustrativ skala — brutto (før tiltak) */
  severity: number
  /** 1–5 illustrativ skala — brutto */
  likelihood: number
  /** severity × likelihood */
  riskScore: number
  proposedMeasures: string
  responsible: string
  dueDate: string
  /** Workflow status — replaces the old done boolean */
  status: RosRowStatus
  // ── Restrisiko (residual risk after the measure is applied) ───────────────
  /** Ny alvorlighetsgrad etter tiltak (1–5) */
  residualSeverity?: number
  /** Ny sannsynlighet etter tiltak (1–5) */
  residualLikelihood?: number
  /** residualSeverity × residualLikelihood (computed) */
  residualScore?: number
  /** Legacy field — kept for migration */
  done?: boolean
}

export type RosSignatureRole = 'leader' | 'verneombud'

export type RosSignature = {
  role: RosSignatureRole
  signerName: string
  signedAt: string
}

/** ROS / risikovurdering (mal kan kopieres) */
export type RosAssessment = {
  id: string
  title: string
  department: string
  assessedAt: string
  assessor: string
  rows: RosRiskRow[]
  /** Electronic signatures — assessment locks when both leader and verneombud have signed */
  signatures: RosSignature[]
  /** True once both required signatures are present */
  locked: boolean
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
