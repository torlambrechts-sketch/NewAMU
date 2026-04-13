import type { Level1SystemSignatureMeta } from './level1Signature'

/** Ja/Nei for strukturerte spørsmål i årsgjennomgang */
export type AnnualReviewYesNo = 'yes' | 'no'

/** IK-f § 5 nr. 8 — strukturerte vurderingsfelt (erstatter fri tekst som eneste innhold) */
export type AnnualReviewSections = {
  goalsLastYearAchieved: AnnualReviewYesNo | ''
  goalsLastYearComment: string
  /** Rapporteringskultur og korrigerende tiltak */
  deviationsReview: string
  /** ROS — oppdatert? nye farer? */
  rosReview: string
  /** Sykefravær — trender, oppfølging */
  sickLeaveReview: string
  /** Konkrete HMS-mål neste 12 mnd */
  goalsNextYear: string
}

export type AnnualReviewActionDraft = {
  id: string
  title: string
  description: string
  assignee: string
  dueDate: string
}

export type AnnualReviewSignatureRole = 'manager' | 'safety_rep'

export type AnnualReviewSignature = {
  role: AnnualReviewSignatureRole
  signerName: string
  signerUserId?: string
  signedAt: string
  level1?: Level1SystemSignatureMeta
}

export type AnnualReviewStatus = 'draft' | 'pending_safety_rep' | 'locked'

/** Radstatus: utkast / innsending / ferdig + operative tilstander (eldre «open» mappes til utkast ved lesing). */
export type RosRowStatus =
  | 'draft'
  | 'submitted'
  | 'finished'
  | 'in_progress'
  | 'deferred'
  | 'cancelled'
  | 'open'
  | 'closed'

/** Rader som ikke lenger skal telle som «åpne» i oversikter (utkast/pågår teller som åpne). */
export function isRosRowDoneForTracking(status: RosRowStatus | undefined): boolean {
  const s = status ?? 'draft'
  return s === 'finished' || s === 'closed' || s === 'cancelled'
}

/** Hele ROS-dokumentet regnes som utkast: ikke låst og ingen signaturer ennå. */
export function isRosDocumentDraft(ros: RosAssessment): boolean {
  return !ros.locked && (ros.signatures?.length ?? 0) === 0
}

export function isRosRiskRowDraft(row: RosRiskRow): boolean {
  return row.status === 'draft'
}

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
  /** Fritekst risikokategori (f.eks. HMS, psykososialt, brann) */
  riskCategory?: string
  /** Konsekvenskategori — hva som rammes (liv/helse, økonomi, miljø, …) */
  consequenceCategory?: string
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
  /** Bakgrunn, omfang, metode — fritekst */
  description?: string
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

/** Årlig gjennomgang av internkontrollen (IK-f § 5 nr. 8) */
export type AnnualReview = {
  id: string
  year: number
  reviewedAt: string
  reviewer: string
  /** Eldre format når sections mangler */
  summary: string
  nextReviewDue: string
  status?: AnnualReviewStatus
  sections?: AnnualReviewSections
  actionPlanDrafts?: AnnualReviewActionDraft[]
  signatures?: AnnualReviewSignature[]
  locked?: boolean
  createdAt?: string
  updatedAt?: string
}

export const EMPTY_ANNUAL_REVIEW_SECTIONS: AnnualReviewSections = {
  goalsLastYearAchieved: '',
  goalsLastYearComment: '',
  deviationsReview: '',
  rosReview: '',
  sickLeaveReview: '',
  goalsNextYear: '',
}

export function isLegacyAnnualReview(a: AnnualReview): boolean {
  return !a.sections && Boolean(a.summary?.trim())
}

export type InternalControlAuditEntry = {
  id: string
  at: string
  action: string
  message: string
  meta?: Record<string, string | number | boolean>
}
