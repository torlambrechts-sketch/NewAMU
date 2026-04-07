import type { Level1SystemSignatureMeta } from './level1Signature'

export type RosRowStatus = 'open' | 'in_progress' | 'closed'

/** Arbeidsområde for ROS (veiviser / forslag — skiller fra O-ROS juridisk kategori) */
export type RosWorkspaceCategory =
  | 'general'
  | 'production'
  | 'office'
  | 'warehouse'
  | 'construction'
  | 'healthcare'

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
  /**
   * Påkrevd ved signering hvis restrisiko er rød (15–25): dokumenter strakstiltak / eskalering.
   */
  redResidualJustification?: string
  /** Legacy field — kept for migration */
  done?: boolean
}

export type RosSignatureRole = 'leader' | 'verneombud'

export type RosSignature = {
  role: RosSignatureRole
  signerName: string
  signedAt: string
  level1?: Level1SystemSignatureMeta
}

/** ROS / risikovurdering (mal kan kopieres) */
export type RosCategory = 'general' | 'organizational_change'

/** Pre-filled O-ROS hazards for omstrukturering (AML § 7-2 / arbeidsmiljø ved endring) */
export const O_ROS_PRESET_HAZARDS: { activity: string; hazard: string; existingControls: string }[] = [
  { activity: 'Omorganisering', hazard: 'Kompetansetap ved tap av nøkkelpersoner', existingControls: 'Kartlegging, kompetanseplan' },
  { activity: 'Omorganisering', hazard: 'Rolleuklarhet og uklare ansvarsforhold', existingControls: 'Oppdaterte stillingsinstrukser' },
  { activity: 'Omorganisering', hazard: 'Psykososial belastning og frykt for egen jobb', existingControls: 'Informasjon, medvirkning, oppfølging' },
]

/** ROS / risikovurdering (mal kan kopieres) */
export type RosAssessment = {
  id: string
  title: string
  department: string
  assessedAt: string
  assessor: string
  /** Organisatorisk endring (O-ROS) — krever AMU/VO-signatur i hr_ros_org_signoffs før låsing */
  rosCategory?: RosCategory
  /** Kartleggingskontekst for veiviser (Produksjon, Kontor, …) */
  workspaceCategory?: RosWorkspaceCategory
  rows: RosRiskRow[]
  /** Electronic signatures — assessment locks when both leader and verneombud have signed */
  signatures: RosSignature[]
  /** True once both required signatures are present */
  locked: boolean
  /** Når denne revisjonen er kopi fra en låst ROS */
  revisionParentId?: string
  /** Løpenummer for revisjon (1 = opprinnelig utkast uten forelder) */
  revisionVersion?: number
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
