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
}

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  orgName: 'Virksomheten',
  employeeCount: 0,
  hasCollectiveAgreement: false,
}

// ─── Employee ─────────────────────────────────────────────────────────────────

export type EmploymentType = 'permanent' | 'temporary' | 'intern' | 'contractor'

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
  /** ISO date */
  startDate?: string
  /** ISO date — if set, person is no longer active */
  endDate?: string
  active: boolean
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
