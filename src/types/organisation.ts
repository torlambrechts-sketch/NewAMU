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
  managerId?: string
  managerName?: string
  memberCount?: number
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
