import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import {
  LAYOUT_COMPOSER_BLOCK_ORDER,
  MIME_GRID_CELL,
  MIME_GRID_PALETTE_BLOCK,
  layoutComposerBlockLabel,
  renderLayoutComposerBlock,
  type LayoutComposerBlockId,
  type PlatformLayoutPreviewSurface,
} from './PlatformLayoutComposerPage'
import {
  default7030Row,
  defaultGridSession,
  loadGridSession,
  loadSavedGridLayouts,
  newGridCell,
  newGridRow,
  normalizeGridSession,
  saveGridSession,
  saveSavedGridLayouts,
  type GridRowPersist,
  type LayoutGridComposerSession,
  type SavedGridLayout,
} from '../../lib/layoutGridComposerStorage'

function previewShellClass(surface: PlatformLayoutPreviewSurface) {
  return surface === 'white'
    ? 'rounded-xl border border-neutral-200 bg-white text-neutral-900'
    : 'rounded-xl border border-white/10 bg-[#F9F7F2] text-neutral-900'
}

function cloneSession(s: LayoutGridComposerSession): LayoutGridComposerSession {
  return {
    rows: s.rows.map((r) => ({
      id: r.id,
      columns: r.columns.map((c) => ({ ...c })),
    })),
  }
}

type DragPayload =
  | { kind: 'palette'; blockId: LayoutComposerBlockId }
  | { kind: 'cell'; rowId: string; cellId: string }

function parseDragPayload(dt: DataTransfer): DragPayload | null {
  const cellRaw = dt.getData(MIME_GRID_CELL)
  if (cellRaw) {
    try {
      const o = JSON.parse(cellRaw) as { rowId?: string; cellId?: string }
      if (o.rowId && o.cellId) return { kind: 'cell', rowId: o.rowId, cellId: o.cellId }
    } catch {
      /* ignore */
    }
  }
  const pal = dt.getData(MIME_GRID_PALETTE_BLOCK) as LayoutComposerBlockId
  if (pal && LAYOUT_COMPOSER_BLOCK_ORDER.includes(pal)) return { kind: 'palette', blockId: pal }
  return null
}

export function PlatformGridComposer({ previewSurface }: { previewSurface: PlatformLayoutPreviewSurface }) {
  const baseId = useId()
  const [session, setSession] = useState<LayoutGridComposerSession>(() => loadGridSession() ?? defaultGridSession())
  const [savedName, setSavedName] = useState('')
  const [savedLayouts, setSavedLayouts] = useState<SavedGridLayout[]>(() => loadSavedGridLayouts())
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    saveGridSession(normalizeGridSession(session))
  }, [session])

  const updateRow = useCallback((rowId: string, fn: (row: GridRowPersist) => GridRowPersist) => {
    setSession((s) => ({
      rows: s.rows.map((r) => (r.id === rowId ? fn({ ...r, columns: r.columns.map((c) => ({ ...c })) }) : r)),
    }))
  }, [])

  const applyDrop = useCallback(
    (targetRowId: string, targetCellId: string, payload: DragPayload) => {
      if (payload.kind === 'palette') {
        setSession((s) => ({
          rows: s.rows.map((r) =>
            r.id !== targetRowId
              ? r
              : {
                  ...r,
                  columns: r.columns.map((c) =>
                    c.id === targetCellId ? { ...c, blockId: payload.blockId } : { ...c },
                  ),
                },
          ),
        }))
        return
      }
      if (payload.rowId === targetRowId && payload.cellId === targetCellId) return

      setSession((s) => {
        const next = cloneSession(s)
        let sourceBlock: string | null = null
        let targetBlock: string | null = null
        for (const r of next.rows) {
          for (const c of r.columns) {
            if (r.id === payload.rowId && c.id === payload.cellId) sourceBlock = c.blockId
            if (r.id === targetRowId && c.id === targetCellId) targetBlock = c.blockId
          }
        }
        for (const r of next.rows) {
          for (const c of r.columns) {
            if (r.id === payload.rowId && c.id === payload.cellId) c.blockId = targetBlock
            if (r.id === targetRowId && c.id === targetCellId) c.blockId = sourceBlock
          }
        }
        return next
      })
    },
    [],
  )

  const clearCell = useCallback((rowId: string, cellId: string) => {
    setSession((s) => ({
      rows: s.rows.map((r) =>
        r.id !== rowId ? r : { ...r, columns: r.columns.map((c) => (c.id === cellId ? { ...c, blockId: null } : c)) },
      ),
    }))
  }, [])

  const addRow = useCallback(() => {
    setSession((s) => ({
      rows: [...s.rows, newGridRow([newGridCell(1, null)])],
    }))
  }, [])

  const removeRow = useCallback((rowId: string) => {
    setSession((s) => (s.rows.length <= 1 ? s : { rows: s.rows.filter((r) => r.id !== rowId) }))
  }, [])

  const addColumn = useCallback((rowId: string) => {
    updateRow(rowId, (row) => ({ ...row, columns: [...row.columns, newGridCell(1, null)] }))
  }, [updateRow])

  const removeColumn = useCallback(
    (rowId: string, cellId: string) => {
      updateRow(rowId, (row) =>
        row.columns.length <= 1 ? row : { ...row, columns: row.columns.filter((c) => c.id !== cellId) },
      )
    },
    [updateRow],
  )

  const setFlex = useCallback(
    (rowId: string, cellId: string, flex: number) => {
      const n = Math.max(1, Math.min(24, Math.round(flex)) || 1)
      updateRow(rowId, (row) => ({
        ...row,
        columns: row.columns.map((c) => (c.id === cellId ? { ...c, flex: n } : c)),
      }))
    },
    [updateRow],
  )

  const insert7030Row = useCallback(() => {
    setSession((s) => ({ rows: [...s.rows, default7030Row()] }))
  }, [])

  const saveAsNew = useCallback(() => {
    const name = savedName.trim()
    if (!name) return
    const now = new Date().toISOString()
    const next: SavedGridLayout = {
      id: crypto.randomUUID(),
      name,
      createdAt: now,
      updatedAt: now,
      rows: cloneSession(normalizeGridSession(session)).rows,
    }
    setSavedLayouts((prev) => {
      const merged = [...prev, next]
      saveSavedGridLayouts(merged)
      return merged
    })
    setEditingId(next.id)
    setSavedName('')
  }, [savedName, session])

  const updateSaved = useCallback(() => {
    if (!editingId) return
    const now = new Date().toISOString()
    setSavedLayouts((prev) => {
      const merged = prev.map((x) =>
        x.id === editingId
          ? { ...x, rows: cloneSession(normalizeGridSession(session)).rows, updatedAt: now }
          : x,
      )
      saveSavedGridLayouts(merged)
      return merged
    })
  }, [editingId, session])

  const loadSaved = useCallback((layout: SavedGridLayout) => {
    setSession(normalizeGridSession({ rows: layout.rows }))
    setEditingId(layout.id)
  }, [])

  const deleteSaved = useCallback((id: string) => {
    setSavedLayouts((prev) => {
      const merged = prev.filter((x) => x.id !== id)
      saveSavedGridLayouts(merged)
      return merged
    })
    setEditingId((cur) => (cur === id ? null : cur))
  }, [])

  const paletteItems = useMemo(
    () => LAYOUT_COMPOSER_BLOCK_ORDER.map((id) => ({ id, label: layoutComposerBlockLabel(id) })),
    [],
  )

  const metaClass = previewSurface === 'white' ? 'text-neutral-500' : 'text-neutral-400'
  const panelClass =
    previewSurface === 'white'
      ? 'space-y-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm'
      : 'space-y-3 rounded-xl border border-white/10 bg-slate-900/50 p-4'
  const btnClass =
    previewSurface === 'white'
      ? 'rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50'
      : 'rounded-md border border-white/15 px-2 py-1 text-xs text-neutral-300 hover:bg-white/5'
  const inputClass =
    previewSurface === 'white'
      ? 'w-14 rounded border border-neutral-200 bg-white px-1 py-0.5 text-xs tabular-nums text-neutral-900'
      : 'w-14 rounded border border-white/15 bg-slate-900 px-1 py-0.5 text-xs tabular-nums text-neutral-100'

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)] lg:items-start">
      <aside className={panelClass}>
        <p className={`text-xs font-semibold uppercase tracking-wide ${metaClass}`}>Element-palett</p>
        <p className={`text-xs ${metaClass}`}>Dra et element inn i en celle. Celle-til-celle bytter innhold.</p>
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {paletteItems.map((b) => (
            <li
              key={b.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(MIME_GRID_PALETTE_BLOCK, b.id)
                e.dataTransfer.effectAllowed = 'copyMove'
              }}
              className={`flex cursor-grab items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 active:cursor-grabbing ${
                previewSurface === 'white' ? 'hover:border-neutral-200 hover:bg-neutral-50' : 'hover:border-white/10 hover:bg-white/5'
              }`}
            >
              <GripVertical className="size-3.5 shrink-0 opacity-50" aria-hidden />
              <span className={`min-w-0 text-xs font-medium ${previewSurface === 'white' ? 'text-neutral-800' : 'text-neutral-200'}`}>
                {b.label}
              </span>
            </li>
          ))}
        </ul>

        <div className={`border-t pt-3 ${previewSurface === 'white' ? 'border-neutral-200' : 'border-white/10'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide ${metaClass}`}>Lagrede rutenett</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="text"
              value={savedName}
              onChange={(e) => setSavedName(e.target.value)}
              placeholder="Navn"
              className={
                previewSurface === 'white'
                  ? 'min-w-0 flex-1 rounded-md border border-neutral-200 px-2 py-1 text-sm'
                  : 'min-w-0 flex-1 rounded-md border border-white/15 bg-slate-900 px-2 py-1 text-sm text-neutral-100'
              }
            />
            <button type="button" className={btnClass} onClick={saveAsNew}>
              Lagre som nytt
            </button>
          </div>
          {editingId ? (
            <button type="button" className={`${btnClass} mt-2 w-full`} onClick={updateSaved}>
              Oppdater «{savedLayouts.find((x) => x.id === editingId)?.name ?? '…'}»
            </button>
          ) : null}
          {savedLayouts.length > 0 ? (
            <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-xs">
              {savedLayouts
                .slice()
                .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))
                .map((L) => (
                  <li key={L.id} className="flex items-center gap-1">
                    <button type="button" className="min-w-0 flex-1 truncate text-left hover:underline" onClick={() => loadSaved(L)}>
                      {L.name}
                    </button>
                    <button type="button" className="shrink-0 p-1 text-red-400 hover:bg-red-500/10" onClick={() => deleteSaved(L.id)} aria-label="Slett">
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
            </ul>
          ) : (
            <p className={`mt-2 text-xs ${metaClass}`}>Ingen lagrede rutenett.</p>
          )}
        </div>
      </aside>

      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btnClass} onClick={addRow}>
            <Plus className="mr-1 inline size-3.5" />
            Ny rad (1 kolonne)
          </button>
          <button type="button" className={btnClass} onClick={insert7030Row}>
            + rad 7/3 (split)
          </button>
          <span className={`text-xs ${metaClass}`}>
            Rediger <code className="rounded px-1">fr</code> per kolonne — f.eks. 7 og 3 som{' '}
            <code className="rounded px-1">WorkplaceSplit7030Layout</code>.
          </span>
        </div>

        <div className={`p-4 md:p-6 ${previewShellClass(previewSurface)}`}>
          <div className="space-y-8">
            {session.rows.map((row, ri) => {
              const template = row.columns.map((c) => `${c.flex}fr`).join(' ')
              return (
                <div key={row.id} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={`text-xs font-semibold uppercase tracking-wide ${metaClass}`}>
                      Rad {ri + 1} — grid: <code className="font-mono text-[11px]">{template}</code>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={btnClass} onClick={() => addColumn(row.id)}>
                        + kolonne
                      </button>
                      <button type="button" className={btnClass} onClick={() => removeRow(row.id)} disabled={session.rows.length <= 1}>
                        Fjern rad
                      </button>
                    </div>
                  </div>

                  <div
                    className="grid gap-4"
                    style={{
                      gridTemplateColumns: row.columns.map((c) => `minmax(0,${c.flex}fr)`).join(' '),
                    }}
                  >
                    {row.columns.map((cell) => {
                      const content: ReactNode = cell.blockId ? renderLayoutComposerBlock(cell.blockId as LayoutComposerBlockId) : null
                      const sid = `${baseId}-${row.id}-${cell.id}`
                      return (
                        <div
                          key={cell.id}
                          className={`flex min-h-[120px] flex-col rounded-lg border-2 border-dashed p-2 ${
                            previewSurface === 'white' ? 'border-neutral-300 bg-neutral-50/50' : 'border-white/20 bg-white/5'
                          }`}
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.dataTransfer.dropEffect = 'move'
                          }}
                          onDrop={(e) => {
                            e.preventDefault()
                            const p = parseDragPayload(e.dataTransfer)
                            if (!p) return
                            applyDrop(row.id, cell.id, p)
                          }}
                        >
                          <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-neutral-200/50 pb-2">
                            <button
                              type="button"
                              draggable
                              onDragStart={(ev) => {
                                ev.dataTransfer.setData(MIME_GRID_CELL, JSON.stringify({ rowId: row.id, cellId: cell.id }))
                                ev.dataTransfer.effectAllowed = 'move'
                              }}
                              className={`cursor-grab rounded p-1 active:cursor-grabbing ${previewSurface === 'white' ? 'text-neutral-400 hover:bg-neutral-100' : 'text-neutral-500 hover:bg-white/10'}`}
                              aria-label="Dra celle"
                              title="Dra for å flytte / bytte innhold"
                            >
                              <GripVertical className="size-4" />
                            </button>
                            <label htmlFor={sid} className={`text-[10px] font-bold uppercase ${metaClass}`}>
                              fr
                            </label>
                            <input
                              id={sid}
                              type="number"
                              min={1}
                              max={24}
                              value={cell.flex}
                              onChange={(ev) => setFlex(row.id, cell.id, Number(ev.target.value))}
                              className={inputClass}
                            />
                            <button type="button" className={btnClass} onClick={() => clearCell(row.id, cell.id)}>
                              Tøm
                            </button>
                            <button
                              type="button"
                              className={btnClass}
                              onClick={() => removeColumn(row.id, cell.id)}
                              disabled={row.columns.length <= 1}
                            >
                              Fjern kolonne
                            </button>
                          </div>
                          <div className="min-w-0 flex-1 overflow-x-auto">
                            {content ?? (
                              <p className={`py-8 text-center text-sm ${metaClass}`}>Slipp element her</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
