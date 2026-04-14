/**
 * HMS inspeksjonsmodul — konfigurasjon og kjøringer.
 * Struktur speiler typisk Firebase: modules/hseInspections/{config|runs|...}
 * (her: localStorage til Firebase er koblet på).
 */

export type InspectionFieldType =
  | 'yes_no_na'
  | 'text'
  | 'number'
  | 'photo_required'
  | 'photo_optional'

/** Svar per felt i en kjøring */
export type InspectionFieldAnswer =
  | { type: 'yes_no_na'; value: 'yes' | 'no' | 'na' }
  | { type: 'text'; value: string }
  | { type: 'number'; value: number | null }
  | { type: 'photo_required'; dataUrl: string | null; fileName?: string }
  | { type: 'photo_optional'; dataUrl: string | null; fileName?: string }

export type InspectionTemplateField = {
  id: string
  order: number
  label: string
  helpText?: string
  lawRef?: string
  fieldType: InspectionFieldType
  required?: boolean
  /** for number */
  min?: number
  max?: number
}

export type InspectionTemplate = {
  id: string
  name: string
  description?: string
  /** Sjekkliste / dynamisk skjema */
  fields: InspectionTemplateField[]
  createdAt: string
  updatedAt: string
}

export type InspectionTypeDef = {
  id: string
  name: string
  description?: string
  /** Mal brukt når ny runde opprettes */
  templateId: string
  /** Tillatte lokasjons-IDer (tom = alle) */
  allowedLocationIds?: string[]
  order: number
  active: boolean
}

export type LocationKind = 'department' | 'building' | 'room' | 'equipment' | 'other'

export type LocationNode = {
  id: string
  kind: LocationKind
  name: string
  code?: string
  parentId?: string
  order: number
}

export type HseRoleGroup = 'inspector' | 'verneombud' | 'management' | 'hms_coordinator' | 'employee'

export type InspectionPermission = 'create' | 'execute' | 'approve' | 'delete'

export type RolePermissionRule = {
  id: string
  roleGroup: HseRoleGroup
  permissions: InspectionPermission[]
  /** Begrens til bestemte inspeksjonstyper (tom = alle) */
  inspectionTypeIds?: string[]
}

export type InspectionStatusDef = {
  id: string
  label: string
  order: number
  /** Første status for nye runder */
  isInitial?: boolean
  /** Status som teller som lukket/fullført */
  isTerminal?: boolean
}

export type ScheduleIntervalUnit = 'day' | 'week' | 'month' | 'quarter' | 'year'

export type InspectionScheduleRule = {
  id: string
  name: string
  inspectionTypeId: string
  templateId: string
  /** Standard lokasjon (valgfritt) */
  defaultLocationId?: string
  intervalValue: number
  intervalUnit: ScheduleIntervalUnit
  /** ISO neste genererte frist (demo: manuell «kjør plan») */
  nextDueAt?: string
  active: boolean
  /** Siste gang plan genererte forslag */
  lastGeneratedAt?: string
}

export type DeviationSeverityDef = {
  id: string
  label: string
  order: number
  /** Standard frist i dager når avvik registreres fra sjekkliste */
  defaultDueDays: number
  color?: 'low' | 'medium' | 'high' | 'critical'
}

export type HseInspectionConfig = {
  version: number
  inspectionTypes: InspectionTypeDef[]
  templates: InspectionTemplate[]
  locations: LocationNode[]
  roleRules: RolePermissionRule[]
  statusFlow: InspectionStatusDef[]
  schedules: InspectionScheduleRule[]
  deviationSeverities: DeviationSeverityDef[]
  /** Merknad om Firebase — vises i UI */
  configSourceNote?: string
}

export type InspectionDeviation = {
  id: string
  fieldId: string
  fieldLabel: string
  severityId: string
  note: string
  dueAt?: string
  createdAt: string
}

/** Én gjennomført eller pågående inspeksjon basert på mal */
export type InspectionRun = {
  id: string
  inspectionTypeId: string
  templateId: string
  templateSnapshotVersion?: number
  title: string
  statusId: string
  locationId?: string
  objectLabel?: string
  conductedAt: string
  conductedBy: string
  answers: Record<string, InspectionFieldAnswer>
  deviations: InspectionDeviation[]
  notes: string
  createdAt: string
  updatedAt: string
}
