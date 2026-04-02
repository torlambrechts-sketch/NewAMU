export type ChecklistItemStatus = 'ok' | 'issue' | 'na'

export type HseChecklistItem = {
  id: string
  label: string
  lawRef: string
}

export type SafetyRound = {
  id: string
  title: string
  conductedAt: string
  location: string
  conductedBy: string
  /** checklist template id -> status */
  items: Record<string, ChecklistItemStatus>
  notes: string
  createdAt: string
  updatedAt: string
}

export type InspectionKind = 'internal' | 'external' | 'audit'

export type HseProtocolSignature = {
  signerName: string
  signedAt: string
  role: 'inspector' | 'management' | 'verneombud'
}

export type Inspection = {
  id: string
  kind: InspectionKind
  title: string
  conductedAt: string
  scope: string
  findings: string
  followUp: string
  status: 'open' | 'closed'
  responsible: string
  /** Signatur på inspeksjonsprotokoll */
  protocolSignatures?: HseProtocolSignature[]
  createdAt: string
  updatedAt: string
}

// ─── Incidents — expanded ─────────────────────────────────────────────────────

export type IncidentKind =
  | 'incident'      // generell ulykke / skade
  | 'near_miss'     // nestenulykke
  | 'violence'      // vold
  | 'threat'        // trusler
  | 'deviation'     // avvik fra prosedyre / rutine

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

export type Incident = {
  id: string
  kind: IncidentKind
  category: IncidentCategory
  formTemplate: IncidentFormTemplate
  severity: IncidentSeverity
  occurredAt: string
  location: string
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
  status: 'reported' | 'investigating' | 'action_pending' | 'closed'
  routing?: IncidentRouting
  /** Notified Arbeidstilsynet if required (AML §5-2) */
  arbeidstilsynetNotified?: boolean
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

// ─── Audit ───────────────────────────────────────────────────────────────────

export type HseAuditAction =
  | 'module_init'
  | 'safety_round_created'
  | 'safety_round_updated'
  | 'inspection_created'
  | 'inspection_updated'
  | 'incident_created'
  | 'incident_updated'
  | 'sick_leave_created'
  | 'sick_leave_updated'
  | 'sick_leave_milestone_completed'
  | 'settings_note'
  | 'demo_reset'

export type HseAuditEntry = {
  id: string
  at: string
  action: HseAuditAction
  entityType: 'safety_round' | 'inspection' | 'incident' | 'sick_leave' | 'system'
  entityId: string
  summary: string
  /** Immutable snapshot detail for audit (JSON-serializable) */
  detail?: Record<string, string | number | boolean | null>
  performedBy?: string
}

