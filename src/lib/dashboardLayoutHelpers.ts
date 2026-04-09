import type { ReportModule } from '../types/reportBuilder'
import type {
  DashboardColSpan,
  DashboardLayoutCell,
  DashboardLayoutRow,
  WorkplaceDashboardTab,
} from '../types/dashboardLayout'
import { createDefaultModule, newModuleId } from './reportModuleCatalog'

export function newCell(moduleId = '', colSpan: DashboardColSpan = 12): DashboardLayoutCell {
  return { id: newModuleId(), moduleId, colSpan }
}

export function newRow(cells: DashboardLayoutCell[] = [newCell()]): DashboardLayoutRow {
  return { id: newModuleId(), cells }
}

export function createDefaultTab(name = 'Ny fane'): WorkplaceDashboardTab {
  const now = new Date().toISOString()
  const kpi = createDefaultModule('kpi')
  return {
    id: newModuleId(),
    name,
    createdAt: now,
    updatedAt: now,
    inventory: [kpi],
    rows: [newRow([newCell('', 12)])],
  }
}

/** Module ids currently placed on the grid */
export function placedModuleIds(rows: DashboardLayoutRow[]): Set<string> {
  const s = new Set<string>()
  for (const r of rows) {
    for (const c of r.cells) {
      if (c.moduleId) s.add(c.moduleId)
    }
  }
  return s
}

export function rebalanceRowSpans(cells: DashboardLayoutCell[]): DashboardLayoutCell[] {
  if (cells.length === 0) return [newCell()]
  const n = cells.length
  const base = Math.floor(12 / n)
  const rem = 12 - base * n
  return cells.map((c, i) => ({
    ...c,
    colSpan: Math.min(12, Math.max(1, base + (i < rem ? 1 : 0))) as DashboardColSpan,
  }))
}

export function addRow(tab: WorkplaceDashboardTab): WorkplaceDashboardTab {
  const now = new Date().toISOString()
  return {
    ...tab,
    updatedAt: now,
    rows: [...tab.rows, newRow([newCell('', 12)])],
  }
}

export function addColumnToLastRow(tab: WorkplaceDashboardTab): WorkplaceDashboardTab {
  const now = new Date().toISOString()
  if (tab.rows.length === 0) return { ...tab, updatedAt: now, rows: [newRow([newCell('', 6), newCell('', 6)])] }
  const rows = [...tab.rows]
  const lastIdx = rows.length - 1
  const last = rows[lastIdx]!
  if (last.cells.length >= 12) return { ...tab, updatedAt: now }
  const nextCells = [...last.cells, newCell('', 1)]
  rows[lastIdx] = { ...last, cells: rebalanceRowSpans(nextCells) }
  return { ...tab, updatedAt: now, rows }
}

export function removeRow(tab: WorkplaceDashboardTab, rowId: string): WorkplaceDashboardTab {
  const now = new Date().toISOString()
  const rows = tab.rows.filter((r) => r.id !== rowId)
  return { ...tab, updatedAt: now, rows: rows.length ? rows : [newRow([newCell('', 12)])] }
}

export function moveRow(tab: WorkplaceDashboardTab, from: number, to: number): WorkplaceDashboardTab {
  if (from === to || from < 0 || to < 0 || from >= tab.rows.length || to >= tab.rows.length) return tab
  const now = new Date().toISOString()
  const rows = [...tab.rows]
  const [r] = rows.splice(from, 1)
  rows.splice(to, 0, r!)
  return { ...tab, updatedAt: now, rows }
}

export function setCellModule(
  tab: WorkplaceDashboardTab,
  rowId: string,
  cellId: string,
  moduleId: string,
): WorkplaceDashboardTab {
  const now = new Date().toISOString()
  const rows = tab.rows.map((row) =>
    row.id !== rowId
      ? row
      : {
          ...row,
          cells: row.cells.map((c) => (c.id === cellId ? { ...c, moduleId } : c)),
        },
  )
  return { ...tab, updatedAt: now, rows }
}

export function setCellSpan(
  tab: WorkplaceDashboardTab,
  rowId: string,
  cellId: string,
  colSpan: DashboardColSpan,
): WorkplaceDashboardTab {
  const now = new Date().toISOString()
  const rows = tab.rows.map((row) =>
    row.id !== rowId
      ? row
      : {
          ...row,
          cells: row.cells.map((c) => (c.id === cellId ? { ...c, colSpan } : c)),
        },
  )
  return { ...tab, updatedAt: now, rows }
}

export function swapCells(
  tab: WorkplaceDashboardTab,
  a: { rowId: string; cellId: string },
  b: { rowId: string; cellId: string },
): WorkplaceDashboardTab {
  const now = new Date().toISOString()
  let ma = ''
  let mb = ''
  for (const row of tab.rows) {
    for (const c of row.cells) {
      if (c.id === a.cellId) ma = c.moduleId
      if (c.id === b.cellId) mb = c.moduleId
    }
  }
  const rows = tab.rows.map((row) => ({
    ...row,
    cells: row.cells.map((c) => {
      if (c.id === a.cellId) return { ...c, moduleId: mb }
      if (c.id === b.cellId) return { ...c, moduleId: ma }
      return c
    }),
  }))
  return { ...tab, updatedAt: now, rows }
}

export function addModuleToInventory(tab: WorkplaceDashboardTab, mod: ReportModule): WorkplaceDashboardTab {
  const now = new Date().toISOString()
  return { ...tab, updatedAt: now, inventory: [...tab.inventory, mod] }
}

export function updateInventoryModule(tab: WorkplaceDashboardTab, mod: ReportModule): WorkplaceDashboardTab {
  const now = new Date().toISOString()
  return {
    ...tab,
    updatedAt: now,
    inventory: tab.inventory.map((m) => (m.id === mod.id ? mod : m)),
  }
}

export function removeModuleFromInventory(tab: WorkplaceDashboardTab, moduleId: string): WorkplaceDashboardTab {
  const now = new Date().toISOString()
  const rows = tab.rows.map((row) => ({
    ...row,
    cells: row.cells.map((c) => (c.moduleId === moduleId ? { ...c, moduleId: '' } : c)),
  }))
  return {
    ...tab,
    updatedAt: now,
    inventory: tab.inventory.filter((m) => m.id !== moduleId),
    rows,
  }
}

export function moduleById(tab: WorkplaceDashboardTab, moduleId: string): ReportModule | undefined {
  return tab.inventory.find((m) => m.id === moduleId)
}

/** Ensure at most one cell shows a given module (when placing a non-empty widget). */
export function assignModuleToCell(
  tab: WorkplaceDashboardTab,
  targetRowId: string,
  targetCellId: string,
  moduleId: string,
): WorkplaceDashboardTab {
  const now = new Date().toISOString()
  const rows = tab.rows.map((row) => ({
    ...row,
    cells: row.cells.map((c) => {
      if (row.id === targetRowId && c.id === targetCellId) return { ...c, moduleId }
      if (
        moduleId &&
        c.moduleId === moduleId &&
        !(row.id === targetRowId && c.id === targetCellId)
      ) {
        return { ...c, moduleId: '' }
      }
      return c
    }),
  }))
  return { ...tab, updatedAt: now, rows }
}

export function moveModuleBetweenCells(
  tab: WorkplaceDashboardTab,
  from: { rowId: string; cellId: string },
  to: { rowId: string; cellId: string },
): WorkplaceDashboardTab {
  if (from.rowId === to.rowId && from.cellId === to.cellId) return tab
  return swapCells(tab, from, to)
}
