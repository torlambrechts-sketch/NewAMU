import type { Level1SystemSignatureMeta } from './level1Signature'

export type TaskStatus = 'todo' | 'in_progress' | 'done'

// ── Pack architecture (mirrors compliance_pack) ──────────────────────────

export type TaskPack = 'aml-amu' | 'iso-45001'

/** Lovkrav-kategori — mappes til PDCA-fase og AML-paragraf */
export type TaskSourceCategory = 'avvik' | 'risikovurdering' | 'tiltak' | 'general'

/** PDCA-fase på PDCA-tavlen */
export type TaskPdcaPhase = 'plan' | 'do' | 'check' | 'act'

export type TaskItemPriority = 'low' | 'medium' | 'high' | 'critical'

/** Relasjonell oppgave (task_items-tabellen). Erstatter JSON Task for nye oppgaver. */
export type TaskItem = {
  id: string
  organizationId: string
  projectId?: string
  pack: TaskPack
  sourceCategory: TaskSourceCategory
  pdcaPhase: TaskPdcaPhase
  title: string
  description: string
  status: TaskStatus
  priority: TaskItemPriority
  lawRefs: string[]
  assigneeUserId?: string
  assigneeName?: string
  ownerRole?: string
  dueDate?: string
  /** Bro til eksisterende TaskSourceType-verdier */
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

/** Prosjekt-container for PDCA-syklus med bevissamling */
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

/** Bevispost knyttet til et prosjekt */
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

/** Systemmal for oppgavekategori */
export type TaskTemplateCatalog = {
  id: string
  organizationId?: string
  slug: string
  pack: TaskPack
  sourceCategory: TaskSourceCategory
  name: string
  description: string
  lawRefs: string[]
  defaultPdcaPhase: TaskPdcaPhase
  definition: {
    fields: Array<{
      id: string
      label: string
      kind: 'text' | 'textarea' | 'date' | 'datetime' | 'daterange' | 'number' | 'boolean'
      required: boolean
    }>
    checklistItems: Array<{ id: string; text: string }>
  }
  cadenceHint?: string
  isActive: boolean
  isSystem: boolean
  createdAt: string
  updatedAt: string
}

/** Per-org mal-aktivering */
export type TaskOrgTemplate = {
  id: string
  organizationId: string
  catalogId: string
  navPinned: boolean
  isActive: boolean
  deletedAt?: string
  createdAt: string
  updatedAt: string
}

/** Revisortilgangstoken for prosjektpakke */
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

/** Per-org pakkekonfigurasjon */
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

export type TaskModule =
  | 'general'
  | 'council'
  | 'members'
  | 'org_health'
  | 'hse'
  | 'hrm'
  | 'learning'

export type TaskSourceType =
  | 'manual'
  | 'task_cosign_request'
  | 'council_meeting'
  | 'council_compliance'
  | 'representatives'
  | 'survey'
  | 'hse_safety_round'
  | 'hse_inspection'
  /** Konkret avvik under HMS-inspeksjon */
  | 'hse_inspection_finding'
  | 'hse_incident'
  | 'hse_sja'
  /** Oppgave generert fra sykefravær-milepæl (NAV/AML-frist) */
  | 'hse_sick_leave_milestone'
  | 'nav_report'
  | 'labor_metric'
  | 'learning_course'
  /** Opprettet automatisk ved låst ROS når rad har tiltak, ansvarlig og frist */
  | 'ros_measure'
  /** Opprettet fra årsgjennomgang (handlingsplan) */
  | 'annual_review_action'

export type DigitalSignature = {
  signerName: string
  /** Innlogget bruker som signerte (auth.users.id / profiles.id) */
  signerUserId?: string
  signedAt: string
  /** Level 1 system signature (SHA-256 + auth.uid audit) */
  level1?: Level1SystemSignatureMeta
}

export type Task = {
  id: string
  title: string
  description: string
  status: TaskStatus
  /** Ansvarlig utfører (visningsnavn) */
  assignee: string
  /** Kobling til ansattliste når valgt i skjema */
  assigneeEmployeeId?: string
  /** Rolle / ansvar (f.eks. verneombud, leder) */
  ownerRole: string
  /** Leder / godkjenner (kobling til ansatt) */
  leaderEmployeeId?: string
  /** Denormalisert navn for visning uten org-data */
  leaderName?: string
  dueDate: string
  createdAt: string
  module: TaskModule
  sourceType: TaskSourceType
  sourceId?: string
  sourceLabel?: string
  requiresManagementSignOff: boolean
  /** Fullføring bekreftet av ansvarlig (digital signatur — navn + tid) */
  assigneeSignature?: DigitalSignature
  /** Ledelses godkjenning når påkrevd */
  managementSignature?: DigitalSignature
  /**
   * E-post (normalisert lowercase) for hvem som kan signere som utfører.
   * Satt fra valgt signatar (godkjent liste) eller ansvarlig-ansatt.
   */
  assigneeSignerEmail?: string
  /** Valgt signatar utfører (OrgEmployee.id) — kan skille fra ansvarlig for oppgaven */
  assigneeSignerEmployeeId?: string
  /** E-post for hvem som kan signere som leder/medgodkjenner */
  managementSignerEmail?: string
  /** Valgt leder-signatar (OrgEmployee.id) */
  managementSignerEmployeeId?: string
  /** Visningsnavn for leder (til påminnelsesoppgave) */
  managementSignerName?: string
  /** Hvis satt: påminnelse om medsignatur for hovedoppgaven med denne id */
  cosignParentTaskId?: string
}
