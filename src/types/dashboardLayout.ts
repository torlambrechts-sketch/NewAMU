import type { ReportModule } from './reportBuilder'

/** Grid column span 1–12 (12-column layout). */
export type DashboardColSpan = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

export type DashboardLayoutCell = {
  id: string
  /** References `ReportModule.id` in the tab inventory; empty = empty slot */
  moduleId: string
  colSpan: DashboardColSpan
}

export type DashboardLayoutRow = {
  id: string
  cells: DashboardLayoutCell[]
}

export type WorkplaceDashboardTab = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  /** All widgets available to place on the canvas for this tab */
  inventory: ReportModule[]
  rows: DashboardLayoutRow[]
}

export type WorkplaceDashboardPayload = {
  tabs: WorkplaceDashboardTab[]
  /** Last selected tab id (client may fall back to first tab) */
  activeTabId: string | null
}

export function emptyDashboardPayload(): WorkplaceDashboardPayload {
  return { tabs: [], activeTabId: null }
}
