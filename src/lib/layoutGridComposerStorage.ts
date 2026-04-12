/**
 * Local persistence for platform-admin layout grid composer (rows/columns + block slots).
 * Browser-only — same pattern as platformLayoutComposerStorage.
 */

export type GridCellPersist = {
  id: string
  /** Relative column width as CSS fr (e.g. 7 + 3 → WorkplaceSplit7030Layout) */
  flex: number
  blockId: string | null
}

export type GridRowPersist = {
  id: string
  columns: GridCellPersist[]
}

export type LayoutGridComposerSession = {
  rows: GridRowPersist[]
}

export type SavedGridLayout = {
  id: string
  name: string
  createdAt: string
  updatedAt?: string
  rows: GridRowPersist[]
}

const SESSION_KEY = 'klarert-platform-layout-grid-session-v1'
const SAVED_KEY = 'klarert-platform-layout-grid-saved-v1'

export function newGridCell(flex = 1, blockId: string | null = null): GridCellPersist {
  return { id: crypto.randomUUID(), flex: Math.max(1, Math.round(flex)), blockId }
}

export function newGridRow(columns: GridCellPersist[]): GridRowPersist {
  return { id: crypto.randomUUID(), columns }
}

/** One row, 7fr + 3fr — matches WorkplaceSplit7030Layout / layout-reference Dashboard 70/30 */
export function default7030Row(): GridRowPersist {
  return newGridRow([newGridCell(7, null), newGridCell(3, null)])
}

export function defaultGridSession(): LayoutGridComposerSession {
  return { rows: [default7030Row()] }
}

export function loadGridSession(): LayoutGridComposerSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as LayoutGridComposerSession
    if (!p || typeof p !== 'object' || !Array.isArray(p.rows)) return null
    return normalizeGridSession(p)
  } catch {
    return null
  }
}

export function saveGridSession(session: LayoutGridComposerSession) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(normalizeGridSession(session)))
  } catch {
    /* quota */
  }
}

function isCell(x: unknown): x is GridCellPersist {
  if (!x || typeof x !== 'object') return false
  const c = x as GridCellPersist
  if (typeof c.id !== 'string' || typeof c.flex !== 'number') return false
  const b = c.blockId
  return b === null || typeof b === 'string'
}

function isRow(x: unknown): x is GridRowPersist {
  return (
    !!x &&
    typeof x === 'object' &&
    typeof (x as GridRowPersist).id === 'string' &&
    Array.isArray((x as GridRowPersist).columns) &&
    (x as GridRowPersist).columns.every(isCell)
  )
}

export function normalizeGridSession(s: LayoutGridComposerSession): LayoutGridComposerSession {
  const rows = (s.rows ?? []).filter(isRow).map((r) => ({
    id: r.id,
    columns: r.columns.map((c) => ({
      id: c.id,
      flex: Math.max(1, Math.min(24, Math.round(Number(c.flex)) || 1)),
      blockId: c.blockId,
    })),
  }))
  if (rows.length === 0) return defaultGridSession()
  return { rows }
}

export function loadSavedGridLayouts(): SavedGridLayout[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr.filter(
      (x): x is SavedGridLayout =>
        x &&
        typeof x === 'object' &&
        typeof (x as SavedGridLayout).id === 'string' &&
        typeof (x as SavedGridLayout).name === 'string' &&
        typeof (x as SavedGridLayout).createdAt === 'string' &&
        Array.isArray((x as SavedGridLayout).rows),
    )
  } catch {
    return []
  }
}

export function saveSavedGridLayouts(layouts: SavedGridLayout[]) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(layouts))
  } catch {
    /* quota */
  }
}
