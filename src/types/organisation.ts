// ─── Organisation-wide settings ──────────────────────────────────────────────

export type OrgSettings = {
  /** Registered legal name */
  orgName: string
  /** Organisation number (orgnr) */
  orgNumber?: string
  /** Total headcount — drives AMU and verneombud threshold computation */
  employeeCount: number
  /** Whether a collective agreement (tariffavtale) is in force */
  hasCollectiveAgreement: boolean
  /** Name of the main collective agreement if applicable */
  collectiveAgreementName?: string
  /** Industry sector — affects some compliance thresholds */
  industrySector?: string
  /**
   * Ansatt-IDer (OrgEmployee.id) som er godkjent til digital signatur på oppgaver.
   * Tom liste = alle aktive ansatte med e-post kan velges som signatar i oppgave-skjemaet.
   */
  approvedTaskSignerEmployeeIds?: string[]

  // ─── Brreg-enriched fields (synced from Enhetsregisteret) ────────────────
  /** Official employee count from Brreg snapshot */
  brregAntallAnsatte?: number
  /** NACE industry code, e.g. "62.010" */
  brregNaceKode?: string
  /** NACE description, e.g. "Utvikling og produksjon av programvare" */
  brregNaceBeskrivelse?: string
  /** Legal form code from Brreg, e.g. "AS", "ENK", "SA" */
  brregOrgForm?: string
  /** ISO timestamp of last Brreg sync */
  brregSyncedAt?: string

  // ─── A-ordningen reference ────────────────────────────────────────────────
  /** Headcount from most recent A-melding (manual entry) */
  aOrdningAntallAnsatte?: number
  /** ISO date when A-ordning count was last updated */
  aOrdningUpdatedAt?: string

  // ─── GDPR / data retention ───────────────────────────────────────────────
  /** Months to retain inactive employee records after endDate (default 36) */
  dataRetentionInactiveMonths?: number
  /** Years to retain audit logs (default 5) */
  dataRetentionAuditYears?: number
  /** Email of the privacy officer / personvernombud */
  privacyOfficerEmail?: string
  /** Reference to data processing agreements (DPA) with processors */
  dpaDocumentRef?: string
}

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  orgName: 'Virksomheten',
  employeeCount: 0,
  hasCollectiveAgreement: false,
  approvedTaskSignerEmployeeIds: [],
  dataRetentionInactiveMonths: 36,
  dataRetentionAuditYears: 5,
}

// ─── Employee ─────────────────────────────────────────────────────────────────

/**
 * AML employment type classification.
 * `agency_worker` (innleid fra bemanningsbyrå, AML § 14-12) COUNTS toward AMU/VO thresholds.
 * `independent_contractor` (selvstendig oppdragstaker) does NOT count.
 */
export type EmploymentType =
  | 'permanent'              // Fast ansatt
  | 'temporary'              // Midlertidig (AML § 14-9)
  | 'intern'                 // Lærling / intern
  | 'agency_worker'          // Innleid fra bemanningsbyrå — teller i AML-terskler
  | 'independent_contractor' // Selvstendig — teller IKKE i AML-terskler
  | 'contractor'             // Legacy alias — behandles som independent_contractor

/**
 * A formal statutory mandate held by an employee.
 * Mandates are time-bounded and carry a legal reference.
 */
export type OrgEmployeeMandate = {
  id: string
  mandateType:
    | 'verneombud'
    | 'hoved_verneombud'
    | 'tillitsvalgt'
    | 'amu_arbeidstaker'
    | 'amu_arbeidsgiver'
    | 'amu_chair'
    | 'hms_ansvarlig'
    | 'bht_kontakt'
  /** Scope description, e.g. "IT-avdelingen" or "Hele virksomheten" */
  scope?: string
  /** ISO start date of mandate period */
  startDate: string
  /** ISO end date — omitted for open-ended mandates */
  endDate?: string
  /** ISO date of formal election/appointment */
  electedAt?: string
  /** Statutory reference, e.g. "AML § 6-1" */
  lawRef: string
}

export const MANDATE_TYPE_LABELS: Record<OrgEmployeeMandate['mandateType'], string> = {
  verneombud:      'Verneombud',
  hoved_verneombud:'Hovedverneombud',
  tillitsvalgt:    'Tillitsvalgt',
  amu_arbeidstaker:'AMU-representant (arbeidstaker)',
  amu_arbeidsgiver:'AMU-representant (arbeidsgiver)',
  amu_chair:       'AMU-leder',
  hms_ansvarlig:   'HMS-ansvarlig',
  bht_kontakt:     'BHT-kontaktperson',
}

export const MANDATE_TYPE_LAW_REFS: Record<OrgEmployeeMandate['mandateType'], string> = {
  verneombud:      'AML § 6-1',
  hoved_verneombud:'AML § 6-1 (4)',
  tillitsvalgt:    'Tariffavtale',
  amu_arbeidstaker:'AML § 7-1',
  amu_arbeidsgiver:'AML § 7-1',
  amu_chair:       'AML § 7-2',
  hms_ansvarlig:   'AML § 3-1 / IK-forskriften § 4',
  bht_kontakt:     'AML § 3-3',
}

export type OrgEmployee = {
  id: string
  name: string
  email?: string
  phone?: string
  jobTitle?: string
  /** Formal role category (e.g. "Leder", "Fagansvarlig", "Saksbehandler") */
  role?: string
  /** References OrgUnit.id — primary team/department */
  unitId?: string
  /** Denormalised unit name for quick display */
  unitName?: string
  /** References another OrgEmployee.id — the direct manager */
  reportsToId?: string
  /** Denormalised manager name for quick display */
  reportsToName?: string
  /** Work location / office */
  location?: string
  employmentType: EmploymentType
  /** Name of the staffing agency (only for agency_worker) */
  agencyName?: string
  /** ISO date */
  startDate?: string
  /** ISO date — if set, person is no longer active */
  endDate?: string
  active: boolean
  /** Formal statutory mandates (verneombud, tillitsvalgt, AMU, etc.) */
  mandates?: OrgEmployeeMandate[]
  /** ISO timestamp — set when anonymisation has been applied */
  anonymizedAt?: string
  /** ISO timestamp — scheduled GDPR deletion date */
  scheduledDeletionAt?: string
  createdAt: string
  updatedAt: string
}

// ─── Organisation types ───────────────────────────────────────────────────────
// Defines the organisational hierarchy used for targeting surveys and reports.

export type OrgUnitKind = 'division' | 'department' | 'team' | 'location'

export type OrgUnit = {
  id: string
  name: string
  kind: OrgUnitKind
  /** Parent unit ID — undefined for top-level */
  parentId?: string
  description?: string
  /** References OrgEmployee.id — formal head of this unit */
  headEmployeeId?: string
  /** Denormalised head name */
  headName?: string
  /** Legacy field kept for display */
  managerName?: string
  memberCount?: number
  /** Hex colour for org chart display */
  color?: string
  createdAt: string
  updatedAt: string
}

// ─── User groups ──────────────────────────────────────────────────────────────
// A UserGroup is a named set of org units + individual employee IDs.
// Used to target surveys, training, and reports to specific audiences.

export type UserGroupScope =
  | { kind: 'all' }                                    // Entire organisation
  | { kind: 'units'; unitIds: string[] }               // One or more OrgUnits (includes children)
  | { kind: 'employees'; employeeIds: string[] }       // Specific named employees
  | { kind: 'mixed'; unitIds: string[]; employeeIds: string[] }

export type UserGroup = {
  id: string
  name: string
  description?: string
  scope: UserGroupScope
  createdAt: string
  updatedAt: string
}
