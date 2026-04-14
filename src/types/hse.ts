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

export type IncidentKind = 'incident' | 'near_miss'

export type IncidentSeverity = 'low' | 'medium' | 'high'

export type Incident = {
  id: string
  kind: IncidentKind
  severity: IncidentSeverity
  occurredAt: string
  location: string
  description: string
  immediateActions: string
  reportedBy: string
  status: 'reported' | 'investigating' | 'closed'
  createdAt: string
  updatedAt: string
}

export type HseAuditAction =
  | 'module_init'
  | 'safety_round_created'
  | 'safety_round_updated'
  | 'inspection_created'
  | 'inspection_updated'
  | 'inspection_config_updated'
  | 'inspection_run_created'
  | 'inspection_run_updated'
  | 'incident_created'
  | 'incident_updated'
  | 'settings_note'
  | 'demo_reset'

export type HseAuditEntry = {
  id: string
  at: string
  action: HseAuditAction
  entityType: 'safety_round' | 'inspection' | 'incident' | 'system' | 'inspection_config' | 'inspection_run'
  entityId: string
  summary: string
  /** Immutable snapshot detail for audit (JSON-serializable) */
  detail?: Record<string, string | number | boolean | null>
  performedBy?: string
}
