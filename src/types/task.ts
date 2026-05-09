// task.ts — canonical type definitions for the tasks module.
//
// Section A: New relational types (task_items v2, template system, ISO 45001).
// Section B: Legacy types retained for backward-compat with cross-module consumers
//            (useTasks stub, HseModule, CouncilModule, InternalControlModule, etc.).
//            These will be removed as each consuming module migrates in later phases.

import type { Level1SystemSignatureMeta } from './level1Signature'

// ─────────────────────────────────────────────────────────────────────────────
// SECTION A — New relational types
// ─────────────────────────────────────────────────────────────────────────────

// ── Enums ─────────────────────────────────────────────────────────────────

export type TaskPack = 'aml-amu' | 'iso-45001'

/** Maps to task_source_category DB enum (retained for backward-compat) */
export type TaskSourceCategory = 'avvik' | 'risikovurdering' | 'tiltak' | 'general'

/** PDCA phase — maps to task_pdca_phase DB enum */
export type TaskPdcaPhase = 'plan' | 'do' | 'check' | 'act'

/** Priority — maps to task_items.priority check constraint */
export type TaskItemPriority = 'low' | 'medium' | 'high' | 'critical'

/**
 * Template kind — drives lifecycle rules, required fields, and UI chrome.
 * Stored as task_template_catalog.template_kind (text with check constraint).
 */
export type TaskTemplateKind =
  | 'oppgave'       // General task — simple lifecycle
  | 'avvik'         // Incident / nonconformity — full CAPA lifecycle
  | 'nestenulykke'  // Near-miss — lighter investigation lifecycle
  | 'tiltak'        // Corrective/preventive action — implementation + verify
  | 'risiko'        // Risk assessment — assessment + controls + residual
  | 'forslag'       // Suggestion / improvement — review + accept/reject
  | 'sykefravær'   // Sick leave follow-up — milestone-driven

/**
 * 9-state CAPA lifecycle (ISO 45001 § 10.2).
 * Maps to task_items.status check constraint.
 * Legacy values 'todo' and 'done' remain valid at DB level for backward-compat.
 */
export type TaskItemStatus =
  | 'open'                    // rapportert — not yet picked up
  | 'in_progress'             // under behandling
  | 'root_cause_identified'   // rotårsak identifisert
  | 'action_defined'          // tiltak definert
  | 'action_implemented'      // tiltak implementert
  | 'effectiveness_pending'   // venter på effektverifisering
  | 'effectiveness_verified'  // verifisert effektiv
  | 'closed'                  // lukket
  | 'cancelled'               // kansellert

// ── Template catalog ──────────────────────────────────────────────────────

/** Field descriptor inside template metadata_schema */
export type TaskMetadataField = {
  id: string
  label: string
  kind: 'text' | 'textarea' | 'date' | 'datetime' | 'daterange' | 'number' | 'boolean' | 'select'
  required: boolean
  /** For kind='select' */
  options?: string[]
}

export type TaskMetadataSchema = {
  fields: TaskMetadataField[]
}

/** System or org-custom template from task_template_catalog */
export type TaskTemplateCatalog = {
  id: string
  organizationId?: string
  slug: string
  pack: TaskPack
  sourceCategory: TaskSourceCategory
  templateKind: TaskTemplateKind
  name: string
  description: string
  lawRefs: string[]
  defaultPdcaPhase: TaskPdcaPhase
  /** Schema-driven fields rendered on task creation / editing */
  metadataSchema: TaskMetadataSchema
  /** Legacy definition shape (fields + checklist_items) — kept for compat */
  definition: {
    fields: Array<{ id: string; label: string; kind: string; required: boolean }>
    checklistItems: Array<{ id: string; text: string }>
  }
  cadenceHint?: string
  version: number
  isActive: boolean
  isSystem: boolean
  createdAt: string
  updatedAt: string
}

/** Per-org template activation and pinning */
export type TaskOrgTemplate = {
  id: string
  organizationId: string
  catalogId: string
  categoryId?: string
  navPinned: boolean
  isActive: boolean
  deletedAt?: string
  createdAt: string
  updatedAt: string
}

/** Template category for hub grouping + collapsible sidebar headers */
export type TaskTemplateCategory = {
  id: string
  organizationId: string
  pack?: TaskPack
  name: string
  description: string
  position: number
  regulationId?: string
  isActive: boolean
  deletedAt?: string
}

/** Snapshot row from task_template_versions */
export type TaskTemplateVersion = {
  id: string
  catalogId: string
  version: number
  snapshot: Record<string, unknown>
  changedBy?: string
  changedAt: string
}

// ── Task items (relational) ───────────────────────────────────────────────

/** Full relational task item (task_items table v2) */
export type TaskItem = {
  id: string
  organizationId: string
  projectId?: string
  pack: TaskPack
  sourceCategory: TaskSourceCategory
  templateKind?: TaskTemplateKind
  templateSlug?: string
  pdcaPhase: TaskPdcaPhase
  title: string
  description: string
  status: TaskItemStatus
  priority: TaskItemPriority
  lawRefs: string[]

  // Participants
  ownerUserId?: string
  ownerName?: string
  assigneeUserId?: string
  assigneeName?: string
  reviewerUserId?: string
  reviewerName?: string
  reviewedAt?: string
  reviewComment?: string

  // Approval (closure gate)
  requiresApproval: boolean
  approvedAt?: string
  approvedBy?: string

  // Causality chain
  parentItemId?: string

  ownerRole?: string
  dueDate?: string
  estimatedHours?: number
  actualHours?: number
  slaDueAt?: string

  // Effectiveness review (ISO 45001 § 10.2)
  effectivenessReviewDueAt?: string
  effectivenessReviewedAt?: string
  residualRiskScore?: number

  // Regulatory notifications
  voNotifiedAt?: string
  amuNotifiedAt?: string
  arbeidstilsynetNotifiedAt?: string
  arbeidstilsynetNotificationDueAt?: string

  // Lifecycle gate behaviour captured at creation time
  closureGate: 'hard' | 'soft' | 'none'

  // Recurrence
  recurrenceCadence?: string
  nextRecurrenceDate?: string

  // Legacy source bridge
  sourceType?: TaskSourceType
  sourceId?: string

  requiresSignOff: boolean
  assigneeSignedAt?: string
  assigneeSignedBy?: string
  managementSignedAt?: string
  managementSignedBy?: string

  closedAt?: string
  closedBy?: string
  deletedAt?: string
  createdBy?: string
  createdAt: string
  updatedAt: string
}

// ── Supporting relational types ───────────────────────────────────────────

export type TaskSubtask = {
  id: string
  organizationId: string
  taskItemId: string
  title: string
  isDone: boolean
  doneAt?: string
  doneBy?: string
  position: number
  assigneeUserId?: string
  dueDate?: string
  deletedAt?: string
  createdBy?: string
  createdAt: string
  updatedAt: string
}

export type TaskComment = {
  id: string
  organizationId: string
  taskItemId: string
  body: string
  authorName: string
  authorUserId?: string
  parentCommentId?: string
  editedAt?: string
  deletedAt?: string
  createdAt: string
}

export type TaskActivityEntry = {
  id: string
  organizationId: string
  taskItemId: string
  action: string
  actorUserId?: string
  actorName: string
  payload: Record<string, unknown>
  createdAt: string
}

export type TaskItemEvidenceKind =
  | 'file'
  | 'photo'
  | 'note'
  | 'measurement'
  | 'checklist_ref'
  | 'survey_ref'
  | 'external_link'

export type TaskItemEvidence = {
  id: string
  organizationId: string
  taskItemId: string
  kind: TaskItemEvidenceKind
  label: string
  description: string
  filePath?: string
  fileSizeBytes?: number
  mimeType?: string
  externalRefTable?: string
  externalRefId?: string
  measurementValue?: number
  measurementUnit?: string
  uploadedBy?: string
  deletedAt?: string
  createdAt: string
}

export type TaskConsultationRole =
  | 'verneombud'
  | 'amu_member'
  | 'worker'
  | 'union_rep'
  | 'manager'
  | 'external_expert'
  | 'other'

export type TaskConsultation = {
  id: string
  organizationId: string
  taskItemId: string
  consultedUserId?: string
  consultedName: string
  role: TaskConsultationRole
  consultedAt: string
  method?: 'meeting' | 'written' | 'email' | 'phone' | 'other'
  notes?: string
  createdBy?: string
  createdAt: string
}

export type TaskWatcher = {
  id: string
  organizationId: string
  taskItemId: string
  userId: string
  role: 'watcher' | 'contributor'
  createdAt: string
}

// ── Project ───────────────────────────────────────────────────────────────

export type TaskProject = {
  id: string
  organizationId: string
  pack: TaskPack
  title: string
  description: string
  methodology: 'kanban' | 'pdca' | 'waterfall'
  status: 'active' | 'closed' | 'archived'
  startDate?: string
  endDate?: string
  lawRefs: string[]
  leadUserId?: string
  deletedAt?: string
  createdBy?: string
  createdAt: string
  updatedAt: string
}

export type TaskProjectEvidence = {
  id: string
  organizationId: string
  projectId: string
  kind: 'file' | 'checklist_execution' | 'survey_response' | 'register_record' | 'note'
  label: string
  externalRefTable?: string
  externalRefId?: string
  filePath?: string
  uploadedBy?: string
  createdAt: string
}

// ── Pack and settings ─────────────────────────────────────────────────────

export type TaskPackConfig = {
  id: string
  organizationId: string
  slug: TaskPack
  shortName: string
  pluralLabel: string
  ctaLabel: string
  description: string
  legalReferences: Array<{ code: string; text: string }>
  kpiLabels: { open: string; critical: string; ytd: string }
  severityLabels: { critical: string; high: string; medium: string; low: string }
  position: number
  isActive: boolean
}

export type TaskModuleSettings = {
  id: string
  organizationId: string
  slaCriticalHours: number
  slaHighHours: number
  slaMediumHours: number
  slaLowHours: number
  avvikClosureGate: 'hard' | 'soft' | 'none'
  risikoRequiresVoConsultation: boolean
  requiresIndependentReview: boolean
  autoArbeidstilsynetTask: boolean
  arbeidstilsynetNotificationHours: number
  escalationHoursAfterSla: number
  emailDigest: 'daily' | 'weekly' | 'none'
  effectivenessReviewDays: number
  enableRecurringTasks: boolean
  createdAt: string
  updatedAt: string
}

/** Auditor share token */
export type TaskExportToken = {
  id: string
  token: string
  organizationId: string
  projectId: string
  pack: TaskPack
  expiresAt: string
  createdBy?: string
  createdAt: string
  revokedAt?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION B — Legacy types (backward-compat, to be removed in later phases)
// Consumed by: useTasks stub, HseModule, CouncilModule, InternalControlModule,
// OrgHealthModule, ActionBoardPage, regulationForSource, reportDatasets, etc.
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Use TaskItemStatus */
export type TaskStatus = 'todo' | 'in_progress' | 'done'

/** @deprecated Use TaskTemplateKind for routing; module is a legacy concept */
export type TaskModule =
  | 'general'
  | 'council'
  | 'members'
  | 'org_health'
  | 'hse'
  | 'hrm'
  | 'learning'

/** @deprecated Legacy source type enum — bridges to TaskTemplateKind in the new model */
export type TaskSourceType =
  | 'manual'
  | 'task_cosign_request'
  | 'council_meeting'
  | 'council_compliance'
  | 'representatives'
  | 'survey'
  | 'hse_safety_round'
  | 'hse_inspection'
  | 'hse_inspection_finding'
  | 'hse_incident'
  | 'hse_sja'
  | 'hse_sick_leave_milestone'
  | 'nav_report'
  | 'labor_metric'
  | 'learning_course'
  | 'ros_measure'
  | 'annual_review_action'

export type DigitalSignature = {
  signerName: string
  signerUserId?: string
  signedAt: string
  level1?: Level1SystemSignatureMeta
}

/** @deprecated Full legacy task type — stored in org_module_payloads jsonb blob */
export type Task = {
  id: string
  title: string
  description: string
  status: TaskStatus
  assignee: string
  assigneeEmployeeId?: string
  ownerRole: string
  leaderEmployeeId?: string
  leaderName?: string
  dueDate: string
  createdAt: string
  module: TaskModule
  sourceType: TaskSourceType
  sourceId?: string
  sourceLabel?: string
  requiresManagementSignOff: boolean
  assigneeSignature?: DigitalSignature
  managementSignature?: DigitalSignature
  assigneeSignerEmail?: string
  assigneeSignerEmployeeId?: string
  managementSignerEmail?: string
  managementSignerEmployeeId?: string
  managementSignerName?: string
  cosignParentTaskId?: string
}
