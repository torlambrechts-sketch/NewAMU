import type { Level1SystemSignatureMeta } from './level1Signature'

export type ChecklistItemStatus = 'ok' | 'issue' | 'na'

export type HseChecklistItem = {
  id: string
  label: string
  lawRef: string
}

/**
 * Per-checklist-item avvik detail — only populated when status === 'issue'.
 * Kept separate from the status map so the base record stays compact.
 */
export type ChecklistItemDetail = {
  /** Free-text description of the deviation */
  description: string
  /** data: URI or URL for an attached photo. In production this would be a storage ref. */
  photoUrl?: string
  /** Who is responsible for fixing this item */
  assignee: string
  /** ISO date string for when this must be resolved */
  dueDate: string
  /** Whether this has been resolved independently of the round's overall status */
  resolvedAt?: string
}

export type SafetyRoundStatus =
  | 'in_progress'
  /** Leder har signert — venter verneombud (AML § 3-1) */
  | 'pending_verneombud'
  /** @deprecated Bruk pending_verneombud */
  | 'pending_approval'
  | 'approved'

export type SafetyRoundSignatureRole = 'management' | 'safety_rep'

export type SafetyRoundSignature = {
  role: SafetyRoundSignatureRole
  signerName: string
  signerUserId?: string
  signedAt: string
  level1?: Level1SystemSignatureMeta
}

export type SafetyRoundApproval = {
  approverName: string
  approvedAt: string
  comment?: string
  level1?: Level1SystemSignatureMeta
}

export type SafetyRound = {
  id: string
  title: string
  conductedAt: string
  location: string
  /** Kun visning / historikk — ikke brukt til juridisk signatur */
  conductedBy: string
  department?: string
  /** Mal brukt for denne runden */
  checklistTemplateId?: string
  /** checklist template id -> status */
  items: Record<string, ChecklistItemStatus>
  /** checklist item id -> avvik detail (only set when status === 'issue') */
  itemDetails: Record<string, ChecklistItemDetail>
  notes: string
  /** Workflow status */
  status: SafetyRoundStatus
  /** Set when status reaches 'pending_approval' */
  submittedForApprovalAt?: string
  /** Leder + verneombud (nivå 1) — begge kreves før låsing */
  signatures?: SafetyRoundSignature[]
  /** Oppgaver opprettet på Kanban etter endelig VO-signatur */
  issueTasksSynced?: boolean
  /** Merknad fra leder ved signatur (visning) */
  leaderComment?: string
  /** Manager sign-off — locks the checklist */
  approval?: SafetyRoundApproval
  createdAt: string
  updatedAt: string
}

export type InspectionKind = 'internal' | 'external' | 'audit'

export type HseProtocolSignature = {
  signerName: string
  signedAt: string
  role: 'inspector' | 'management' | 'verneombud'
  level1?: Level1SystemSignatureMeta
}

/** Inspeksjonsobjekt — koblet til organisasjonsenhet eller merket utstyr/lokasjon */
export type InspectionSubjectKind = 'free_text' | 'org_unit' | 'equipment_or_area'

export type InspectionFindingStatus = 'open' | 'resolved'

/** Sporbart avvik under inspeksjon (egen «child»-rad) */
export type InspectionFinding = {
  id: string
  description: string
  status: InspectionFindingStatus
  /** Supabase Storage path (bucket hse_inspection_files) */
  photoPath?: string
  /** Midlertidig visning (data-URL) eller signert URL */
  photoUrl?: string
  /** Koblet Kanban-oppgave etter lukking av inspeksjon */
  linkedTaskId?: string
  createdAt: string
  resolvedAt?: string
}

export type InspectionAttachmentKind = 'image' | 'pdf' | 'other'

export type InspectionAttachment = {
  id: string
  kind: InspectionAttachmentKind
  /** Storage object path under org folder */
  path: string
  fileName: string
  uploadedAt: string
}

export type Inspection = {
  id: string
  kind: InspectionKind
  title: string
  conductedAt: string
  scope: string
  /** Kort oppsummering av funn (ikke erstatning for konkrete avvik) */
  findings: string
  followUp: string
  status: 'open' | 'closed'
  /** Visningsnavn (denormalisert) */
  responsible: string
  /** Kobling til ansatt som hovedansvarlig */
  responsibleEmployeeId?: string
  subjectKind?: InspectionSubjectKind
  /** Når subjectKind === org_unit */
  subjectUnitId?: string
  /** Fritekst / merkelapp for utstyr eller rom (truck 3, fryserom B, …) */
  subjectLabel?: string
  /** Ved «kun fritekst» — gammelt omfang i scope; subjectLabel kan speile scope i UI */
  concreteFindings?: InspectionFinding[]
  attachments?: InspectionAttachment[]
  /** Når sann: ingen redigering (app-nivå; RLS i DB anbefales for produksjon) */
  locked?: boolean
  /** Signatur ved formell lukking / fullføring (nivå 1) */
  closureSignature?: HseProtocolSignature
  /** Oppgaver opprettet for åpne avvik ved lukking */
  findingTasksSynced?: boolean
  /** Signatur på inspeksjonsprotokoll (underveis) */
  protocolSignatures?: HseProtocolSignature[]
  createdAt: string
  updatedAt: string
}

// ─── Incidents — expanded ─────────────────────────────────────────────────────

export type IncidentKind =
  | 'incident'        // generell ulykke / skade
  | 'near_miss'       // nestenulykke
  | 'dangerous_cond'  // farlige forhold (AML §2-3 (2))
  | 'violence'        // vold
  | 'threat'          // trusler
  | 'deviation'       // avvik fra prosedyre / rutine

export type IncidentCategory =
  | 'physical_injury'
  | 'psychological'
  | 'property_damage'
  | 'fire_explosion'
  | 'chemical'
  | 'ergonomic'
  | 'other'

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical'

export type IncidentFormTemplate =
  | 'standard'
  | 'violence_school'   // vold og trusler i skole
  | 'violence_health'   // vold og trusler i helsesektoren
  | 'deviation'         // avvik fra internkontroll

export type CorrectiveAction = {
  id: string
  description: string
  responsible: string
  dueDate: string
  completedAt?: string
}

export type IncidentRouting = {
  /** Nearest manager notified */
  managerName: string
  /** Verneombud notified */
  verneombudNotified: boolean
  /** AMU case created */
  amuCaseCreated: boolean
  routedAt: string
}

/** Bildebevis — bucket `hse_incident_files`, path `{orgId}/incidents/{incidentId}/…` */
export type IncidentEvidencePhoto = {
  path: string
  fileName: string
  uploadedAt: string
}

export type Incident = {
  id: string
  kind: IncidentKind
  category: IncidentCategory
  formTemplate: IncidentFormTemplate
  severity: IncidentSeverity
  occurredAt: string
  location: string
  /** Avdeling/enhet (relasjonell ID når satt) */
  departmentId?: string
  /** Visningsnavn / bakoverkompatibilitet (f.eks. fri tekst fra eldre data) */
  department: string
  description: string
  /** What the person felt/experienced (violence/threat detail) */
  experienceDetail?: string
  /** Were witnesses present */
  witnesses?: string
  injuredPerson?: string
  immediateActions: string
  rootCause?: string
  correctiveActions: CorrectiveAction[]
  reportedBy: string
  /** Kobling til ansatt som meldte (for rapportering / tilgang) */
  reportedByEmployeeId?: string
  /** Nærmeste leder som skal varsles (OrgEmployee.id) */
  nearestLeaderEmployeeId?: string
  status: 'reported' | 'investigating' | 'action_pending' | 'closed'
  routing?: IncidentRouting
  /** Notified Arbeidstilsynet if required (AML §5-2) */
  arbeidstilsynetNotified?: boolean
  /** Innlogget bruker som opprettet (auth) — brukes til tilgangskontroll i app */
  createdByUserId?: string
  evidencePhotos?: IncidentEvidencePhoto[]
  createdAt: string
  updatedAt: string
}

// ─── Sick leave follow-up (AML §4-6, NAV timelines) ─────────────────────────

export type SickLeaveMilestoneKind =
  | 'contact_day_4'          // Kontakt innen dag 4 (egenmeldingsregler)
  | 'followup_plan_4wk'      // Oppfølgingsplan innen 4 uker (AML §4-6 nr. 1)
  | 'dialog_meeting_7wk'     // Dialogmøte 1 innen 7 uker (AML §4-6 nr. 2)
  | 'nav_report_9wk'         // Melding til NAV innen 9 uker
  | 'dialog_meeting_26wk'    // Dialogmøte 2 innen 26 uker
  | 'activity_plan_1yr'      // Aktivitetsplan ved langtidssykmelding

export type SickLeaveMilestone = {
  kind: SickLeaveMilestoneKind
  label: string
  lawRef: string
  dueAt: string          // ISO date — calculated from sickFrom
  completedAt?: string
  note?: string
  /** Link to an uploaded/drafted plan */
  planRef?: string
}

export type SickLeaveStatus =
  | 'active'              // sykemeldt
  | 'partial'             // gradert sykemeldt
  | 'returning'           // i retur
  | 'closed'              // tilbake i jobb / avsluttet

export type SickLeaveCase = {
  id: string
  /** Employee name — stored separately from medical details */
  employeeName: string
  employeeId?: string
  department: string
  managerName: string
  /** Sick-from date (ISO) */
  sickFrom: string
  /** Projected or actual return date */
  returnDate?: string
  status: SickLeaveStatus
  /** Degree 0–100 */
  sicknessDegree: number
  /** Free-text notes from the accommodation dialogue — CONFIDENTIAL */
  accommodationNotes: string
  /** Messages exchanged in the secure portal (append-only) */
  portalMessages: SickLeaveMessage[]
  milestones: SickLeaveMilestone[]
  /** Explicit consent to record medical context */
  consentRecorded: boolean
  createdAt: string
  updatedAt: string
}

export type SickLeaveMessage = {
  id: string
  sentAt: string
  senderRole: 'manager' | 'employee'
  senderName: string
  text: string
}

// ─── SJA (Sikker Jobb Analyse / Safe Job Analysis) ────────────────────────────
// Required by IK-f §5 nr. 2 and AML §3-1 for non-routine / high-risk tasks.

export type SjaHazardRow = {
  id: string
  /** Work step being analysed */
  step: string
  hazard: string
  consequence: string
  /** Existing control measures */
  existingControls: string
  /** New / additional measures required */
  additionalMeasures: string
  responsible: string
  /** Ansvarlig for tiltak (OrgEmployee.id) */
  responsibleEmployeeId?: string
}

/** Utkast → venter på alle valgte deltakere (Level 1) → godkjent når alle har signert */
export type SjaStatus = 'draft' | 'awaiting_participants' | 'approved' | 'closed'

export type SjaSignature = {
  signerName: string
  role: 'foreman' | 'verneombud' | 'worker' | 'management'
  signedAt: string
  level1?: Level1SystemSignatureMeta
  /** Kobling til ansatt (for deltakersignatur) */
  signerEmployeeId?: string
  signerUserId?: string
}

export type SjaAnalysis = {
  id: string
  title: string
  /** Free-text work task / job description */
  jobDescription: string
  location: string
  department: string
  /** Avdeling/enhet (ID) for rapportering */
  departmentId?: string
  plannedAt: string
  conductedBy: string
  /** Arbeidsleder (OrgEmployee.id) */
  workLeaderEmployeeId?: string
  /** Deltakere som må signere før jobb (OrgEmployee.id) */
  participantEmployeeIds?: string[]
  /** Participants who reviewed the SJA */
  participants: string
  rows: SjaHazardRow[]
  status: SjaStatus
  /** Overall conclusion / approved-by notes */
  conclusion: string
  signatures: SjaSignature[]
  /** Varmt arbeid — trigger for sjekklister fra dokumentbibliotek (app-integrasjon) */
  involvesHotWork?: boolean
  /** Krever LOTO / utkobling */
  requiresLoto?: boolean
  /** Merknad om hvilke maler/sjekklister som skal vedlegges (f.eks. fra dokumenter) */
  permitChecklistNote?: string
  /** Link to related incident (if SJA triggered by an event) */
  relatedIncidentId?: string
  createdAt: string
  updatedAt: string
}

// ─── Department-specific checklist templates ──────────────────────────────────

export type ChecklistTemplate = {
  id: string
  name: string
  /** Restricts to a specific department; undefined = applies to all */
  department?: string
  items: HseChecklistItem[]
  createdAt: string
}

// ─── Training register (opplæringsoversikt) ───────────────────────────────────
// Tracks mandatory 40-hour HMS course for verneombud/managers (AML §3-5, §6-5)
// plus any custom training requirements.

export type TrainingKind =
  | 'hms_40hr'          // 40-timers HMS-kurs (AML §3-5 / §6-5)
  | 'fire_warden'       // Brannvernleder
  | 'first_aid'         // Førstehjelp
  | 'ppe_usage'         // Verneutstyr
  | 'chemical_handling' // Kjemikaliehåndtering
  | 'custom'

export type TrainingRecord = {
  id: string
  employeeName: string
  employeeId?: string
  department: string
  role: string
  trainingKind: TrainingKind
  customLabel?: string
  /** Completion date */
  completedAt?: string
  /** Expiry date (e.g. first aid every 3 years) */
  expiresAt?: string
  provider?: string
  certificateRef?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

// ─── Audit ───────────────────────────────────────────────────────────────────

export type HseAuditAction =
  | 'module_init'
  | 'safety_round_created'
  | 'safety_round_updated'
  | 'inspection_created'
  | 'inspection_updated'
  | 'incident_created'
  | 'incident_updated'
  | 'incident_anonymised'
  | 'sja_created'
  | 'sja_updated'
  | 'sja_approved'
  | 'training_created'
  | 'training_updated'
  | 'sick_leave_created'
  | 'sick_leave_updated'
  | 'sick_leave_milestone_completed'
  | 'sick_leave_anonymised'
  | 'settings_note'
  | 'data_exported'
  | 'demo_reset'

export type HseAuditEntry = {
  id: string
  at: string
  action: HseAuditAction
  entityType: 'safety_round' | 'inspection' | 'incident' | 'sja' | 'training' | 'sick_leave' | 'system'
  entityId: string
  summary: string
  /** Immutable snapshot detail for audit (JSON-serializable) */
  detail?: Record<string, string | number | boolean | null>
  performedBy?: string
}

