import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, GripVertical, Loader2, Plus, Trash2, Zap } from 'lucide-react'
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
import { usePlatformAdmin } from '../../hooks/usePlatformAdmin'
import { usePlatformGridComposerTemplates, type GridLayoutUI } from '../../hooks/usePlatformComposerTemplates'
import {
  VERNERUNDER_TAB_LAYOUT_BLOCK_IDS,
  VERNERUNDER_TAB_LAYOUT_DEFAULT_ORDER,
} from '../../lib/vernerunderLayoutFromPreset'
import {
  ROS_TAB_LAYOUT_BLOCK_IDS,
  ROS_TAB_LAYOUT_DEFAULT_ORDER,
} from '../../lib/rosLayoutFromPreset'
import {
  VARSLINGSSAKER_TAB_LAYOUT_BLOCK_IDS,
  VARSLINGSSAKER_TAB_LAYOUT_DEFAULT_ORDER,
} from '../../lib/varslingssakerLayoutFromPreset'
import { usePlatformStackComposerTemplates } from '../../hooks/usePlatformComposerTemplates'

function previewShellClass(surface: PlatformLayoutPreviewSurface) {
  return surface === 'white'
    ? 'rounded-xl border border-neutral-200 bg-white text-neutral-900'
    : 'rounded-xl border border-white/10 bg-[#F9F7F2] text-neutral-900'
}

// ─── Known named stack templates ──────────────────────────────────────────────

type KnownStackTemplate = {
  name: string
  description: string
  page: string
  blocks: readonly LayoutComposerBlockId[]
  order: readonly LayoutComposerBlockId[]
}

const KNOWN_STACK_TEMPLATES: KnownStackTemplate[] = [
  {
    name: 'Layout_vernerunder',
    description: 'HSE → Vernerunder (KPI, handlinger, tabell + kalender)',
    page: '/vernerunder',
    blocks: VERNERUNDER_TAB_LAYOUT_BLOCK_IDS,
    order: VERNERUNDER_TAB_LAYOUT_DEFAULT_ORDER,
  },
  {
    name: 'Layout_inspeksjoner',
    description: 'HSE → Inspeksjoner (KPI, handlinger, tabell + kalender)',
    page: '/hse?tab=inspections',
    blocks: VERNERUNDER_TAB_LAYOUT_BLOCK_IDS,
    order: VERNERUNDER_TAB_LAYOUT_DEFAULT_ORDER,
  },
  {
    name: 'Layout_ROS',
    description: 'Internkontroll → ROS (KPI-rad, liste 2, risikomatrise, risikotabell)',
    page: '/internal-control?tab=ros',
    blocks: ROS_TAB_LAYOUT_BLOCK_IDS,
    order: ROS_TAB_LAYOUT_DEFAULT_ORDER,
  },
  {
    name: 'Layout_varslingssaker',
    description: 'Internkontroll → Varslingssaker (overskrift, KPI, liste 2)',
    page: '/internal-control?tab=whistle',
    blocks: VARSLINGSSAKER_TAB_LAYOUT_BLOCK_IDS,
    order: VARSLINGSSAKER_TAB_LAYOUT_DEFAULT_ORDER,
  },
]

// ─── Template seed panel ──────────────────────────────────────────────────────

function TemplateSeedPanel({
  userId,
  isAdmin,
  metaClass,
  btnClass,
}: {
  userId: string | null
  isAdmin: boolean
  metaClass: string
  btnClass: string
}) {
  const { mergedPresets, saveStackToDatabase } = usePlatformStackComposerTemplates(
    isAdmin,
    userId,
    isAdmin,
  )
  const [open, setOpen] = useState(false)
  const [seeding, setSeeding] = useState<string | null>(null)
  const [seedMsg, setSeedMsg] = useState<string | null>(null)

  const presetList = useMemo(() => mergedPresets(), [mergedPresets])

  const seedTemplate = useCallback(
    async (tpl: KnownStackTemplate) => {
      setSeeding(tpl.name)
      setSeedMsg(null)
      const visible: Record<string, boolean> = {}
      for (const id of tpl.blocks) visible[id] = true
      const existing = presetList.find(
        (p) => p.name.trim().toLowerCase() === tpl.name.toLowerCase() && p.source === 'database',
      )
      const { error } = await saveStackToDatabase({
        dbId: existing?.dbId,
        name: tpl.name,
        visible,
        order: [...tpl.order],
        published: true,
      })
      setSeeding(null)
      setSeedMsg(error ? `Feil: ${error}` : `✓ ${tpl.name} publisert.`)
    },
    [presetList, saveStackToDatabase],
  )

  if (!isAdmin) return null

  return (
    <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Zap className="size-4 shrink-0 text-amber-400" />
          <span className="text-sm font-semibold text-amber-200">Seed kjente mal-layouter</span>
        </div>
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-amber-400" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-amber-400" />
        )}
      </button>
      <p className={`mt-1 text-xs ${metaClass}`}>
        Opprett og publiser standardblokker for navngitte stack-maler (én klikk per mal). Arbeidsflaten bruker disse
        automatisk ved navnematch. Idempotent — trygt å kjøre på nytt.
      </p>

      {open && (
        <div className="mt-4 space-y-3">
          {seedMsg && (
            <p className={`text-xs ${seedMsg.startsWith('Feil') ? 'text-red-300' : 'text-emerald-300'}`}>
              {seedMsg}
            </p>
          )}
          <div className="space-y-2">
            {KNOWN_STACK_TEMPLATES.map((tpl) => {
              const exists = presetList.some(
                (p) => p.name.trim().toLowerCase() === tpl.name.toLowerCase(),
              )
              const published = presetList.some(
                (p) =>
                  p.name.trim().toLowerCase() === tpl.name.toLowerCase() && p.published,
              )
              return (
                <div
                  key={tpl.name}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-white/10 bg-slate-900/60 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs font-bold text-amber-200">
                        {tpl.name}
                      </code>
                      {published ? (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                          publisert
                        </span>
                      ) : exists ? (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300">
                          finnes (ikke publisert)
                        </span>
                      ) : (
                        <span className="rounded-full bg-neutral-500/20 px-2 py-0.5 text-[10px] text-neutral-400">
                          mangler
                        </span>
                      )}
                    </div>
                    <p className={`mt-1 text-xs ${metaClass}`}>{tpl.description}</p>
                    <p className={`mt-0.5 text-[10px] ${metaClass}`}>
                      Blokker: {tpl.order.join(' → ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={seeding === tpl.name}
                    onClick={() => void seedTemplate(tpl)}
                    className={`shrink-0 ${btnClass} flex items-center gap-1 border-amber-400/40 text-amber-200 hover:bg-amber-500/10`}
                  >
                    {seeding === tpl.name ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Zap className="size-3" />
                    )}
                    {published ? 'Re-seed' : 'Seed + publiser'}
                  </button>
                </div>
              )
            })}
          </div>

          <div className="mt-3 rounded-lg border border-white/10 bg-slate-950/40 p-3 text-xs">
            <p className={`font-semibold ${metaClass}`}>Hvordan lage en ny mal for en annen side:</p>
            <ol className={`mt-1.5 list-decimal space-y-1 pl-4 ${metaClass}`}>
              <li>
                Velg blokker og rekkefølge i <strong className="text-neutral-200">Layout-komponenter — komponer</strong> (fanen
                over).
              </li>
              <li>
                Skriv inn et navn som samsvarer med det siden forventer (f.eks.{' '}
                <code className="rounded bg-white/10 px-1">Layout_vernerunder</code>).
              </li>
              <li>
                Huk av <strong className="text-neutral-200">Publiser</strong> og klikk{' '}
                <strong className="text-neutral-200">Lagre i DB</strong>.
              </li>
              <li>
                Siden henter automatisk den publiserte malen via{' '}
                <code className="rounded bg-white/10 px-1">WorkplacePublishedComposerProvider</code>.
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  )
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
  const { userId, isAdmin, loading: adminLoading } = usePlatformAdmin()
  const {
    loading: tplLoading,
    error: tplError,
    mergedLayouts,
    saveGridToDatabase,
    removeGridTemplate,
    setGridPublished,
    bumpLocal: bumpGridTemplatesLocal,
  } = usePlatformGridComposerTemplates(true, userId, isAdmin)
  const [session, setSession] = useState<LayoutGridComposerSession>(() => loadGridSession() ?? defaultGridSession())
  const [savedName, setSavedName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingDbId, setEditingDbId] = useState<string | null>(null)
  const [publishToWorkplace, setPublishToWorkplace] = useState(false)
  const [tplBusy, setTplBusy] = useState(false)
  const [tplMessage, setTplMessage] = useState<string | null>(null)

  const layoutList = useMemo(() => mergedLayouts(), [mergedLayouts])

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

  const saveAsNewLocal = useCallback(() => {
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
    const prev = loadSavedGridLayouts()
    const merged = [...prev.filter((x) => x.name.trim().toLowerCase() !== name.toLowerCase()), next]
    saveSavedGridLayouts(merged)
    setEditingId(next.id)
    setEditingDbId(null)
    setSavedName('')
    setTplMessage('Lagret lokalt.')
    bumpGridTemplatesLocal()
  }, [savedName, session, bumpGridTemplatesLocal])

  const updateSavedLocal = useCallback(() => {
    if (!editingId) return
    const now = new Date().toISOString()
    const prev = loadSavedGridLayouts()
    const merged = prev.map((x) =>
      x.id === editingId ? { ...x, rows: cloneSession(normalizeGridSession(session)).rows, updatedAt: now } : x,
    )
    saveSavedGridLayouts(merged)
    setTplMessage('Oppdatert lokalt.')
    bumpGridTemplatesLocal()
  }, [editingId, session, bumpGridTemplatesLocal])

  const saveToDatabase = useCallback(async () => {
    const name = savedName.trim()
    if (!name) return
    setTplBusy(true)
    setTplMessage(null)
    const rows = cloneSession(normalizeGridSession(session)).rows
    const { error, id } = await saveGridToDatabase({
      dbId: editingDbId,
      name,
      rows,
      published: publishToWorkplace,
    })
    setTplBusy(false)
    if (error) {
      setTplMessage(error)
      return
    }
    if (id) {
      setEditingDbId(id)
      setEditingId(id)
    }
    setTplMessage('Lagret i database.')
  }, [savedName, session, editingDbId, publishToWorkplace, saveGridToDatabase])

  const loadSaved = useCallback((layout: GridLayoutUI) => {
    setSession(normalizeGridSession({ rows: layout.rows }))
    setEditingId(layout.id)
    setEditingDbId(layout.dbId ?? null)
    setSavedName(layout.name)
    setPublishToWorkplace(!!layout.published)
    setTplMessage(null)
  }, [])

  const deleteSaved = useCallback(
    async (layout: GridLayoutUI) => {
      setTplBusy(true)
      setTplMessage(null)
      const err = await removeGridTemplate(layout)
      setTplBusy(false)
      if (err) setTplMessage(err)
      else setTplMessage('Slettet.')
      if (editingId === layout.id) {
        setEditingId(null)
        setEditingDbId(null)
        setSavedName('')
      }
    },
    [removeGridTemplate, editingId],
  )

  const toggleGridPublished = useCallback(
    async (layout: GridLayoutUI) => {
      if (!layout.dbId) return
      setTplBusy(true)
      const err = await setGridPublished(layout.dbId, !layout.published)
      setTplBusy(false)
      if (err) setTplMessage(err)
      else {
        setTplMessage(!layout.published ? 'Publisert.' : 'Avpublisert.')
        if (editingDbId === layout.dbId) setPublishToWorkplace(!layout.published)
      }
    },
    [setGridPublished, editingDbId],
  )

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
  const selectBlockClass =
    previewSurface === 'white'
      ? 'min-w-0 max-w-full flex-1 rounded border border-neutral-200 bg-white px-1.5 py-1 text-[11px] text-neutral-900 sm:text-xs'
      : 'min-w-0 max-w-full flex-1 rounded border border-white/20 bg-slate-950/40 px-1.5 py-1 text-[11px] text-neutral-100 sm:text-xs'

  const setCellBlock = useCallback((rowId: string, cellId: string, blockId: string) => {
    const id = blockId === '' ? null : (blockId as LayoutComposerBlockId)
    setSession((s) => ({
      rows: s.rows.map((r) =>
        r.id !== rowId
          ? r
          : {
              ...r,
              columns: r.columns.map((c) => (c.id === cellId ? { ...c, blockId: id } : c)),
            },
      ),
    }))
  }, [])

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)] lg:items-start">
      <aside className={panelClass}>
        <p className={`text-xs font-semibold uppercase tracking-wide ${metaClass}`}>Element-palett</p>
        <p className={`text-xs ${metaClass}`}>
          Dra element inn i en celle (skrivebord), eller bruk{' '}
          <strong
            className={`font-medium ${previewSurface === 'white' ? 'text-neutral-800' : 'text-neutral-200'}`}
          >
            rullegardin i hver celle
          </strong>{' '}
          nedenfor — samme blokker som under Layout-komponenter — komponer.
        </p>
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
          <p className={`mt-1 text-xs ${metaClass}`}>
            Lokal = nettleser. Database = plattformadmin.             Publiser rutenett med navn som{' '}
            <strong className="font-medium text-inherit">Layout_vernerunder</strong> (HSE → Vernerunder) eller{' '}
            <strong className="font-medium text-inherit">Layout_inspeksjoner</strong> (HSE → Inspeksjoner) — samme rader/fr som
            her.
          </p>
          {adminLoading || tplLoading ? (
            <p className={`mt-2 flex items-center gap-2 text-xs ${metaClass}`}>
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Laster…
            </p>
          ) : null}
          {tplError ? <p className="mt-2 text-xs text-red-400">{tplError}</p> : null}
          {tplMessage ? (
            <p className={`mt-2 text-xs ${previewSurface === 'white' ? 'text-amber-800' : 'text-amber-200/90'}`}>{tplMessage}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="text"
              value={savedName}
              onChange={(e) => {
                setSavedName(e.target.value)
                setTplMessage(null)
              }}
              placeholder="Navn"
              className={
                previewSurface === 'white'
                  ? 'min-w-0 flex-1 rounded-md border border-neutral-200 px-2 py-1 text-sm'
                  : 'min-w-0 flex-1 rounded-md border border-white/15 bg-slate-900 px-2 py-1 text-sm text-neutral-100'
              }
            />
            <button type="button" className={btnClass} disabled={tplBusy} onClick={saveAsNewLocal}>
              Lagre lokalt
            </button>
            {isAdmin ? (
              <button type="button" className={btnClass} disabled={tplBusy} onClick={() => void saveToDatabase()}>
                Lagre i DB
              </button>
            ) : null}
          </div>
          {isAdmin ? (
            <label className={`mt-2 flex cursor-pointer items-center gap-2 text-xs ${metaClass}`}>
              <input
                type="checkbox"
                checked={publishToWorkplace}
                onChange={(e) => setPublishToWorkplace(e.target.checked)}
                className="rounded border-neutral-300"
              />
              Publiser
            </label>
          ) : null}
          {editingId ? (
            <button type="button" className={`${btnClass} mt-2 w-full`} disabled={tplBusy} onClick={updateSavedLocal}>
              Oppdater lokalt
            </button>
          ) : null}
          {editingDbId ? (
            <p className={`mt-1 text-[10px] ${metaClass}`}>DB-rad: {editingDbId.slice(0, 8)}…</p>
          ) : null}
          {layoutList.length > 0 ? (
            <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-xs">
              {layoutList.map((L) => (
                <li key={`${L.source}-${L.id}`} className="flex flex-wrap items-center gap-1">
                  <button type="button" className="min-w-0 flex-1 truncate text-left hover:underline" onClick={() => loadSaved(L)}>
                    {L.name}
                    <span className={`ml-1 text-[10px] ${metaClass}`}>
                      {L.source === 'database' ? 'DB' : 'Lokal'}
                      {L.published ? ' · pub.' : ''}
                    </span>
                  </button>
                  {L.dbId ? (
                    <button type="button" className={btnClass} disabled={tplBusy} onClick={() => void toggleGridPublished(L)}>
                      {L.published ? 'Avpub.' : 'Pub.'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="shrink-0 p-1 text-red-400 hover:bg-red-500/10"
                    disabled={tplBusy}
                    onClick={() => void deleteSaved(L)}
                    aria-label="Slett"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={`mt-2 text-xs ${metaClass}`}>Ingen lagrede rutenett.</p>
          )}
        </div>

        {/* ── Stack template seed panel ─────────────────────────────────── */}
        <TemplateSeedPanel
          userId={userId}
          isAdmin={isAdmin === true}
          metaClass={metaClass}
          btnClass={btnClass}
        />
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
                          <div className="mb-2 w-full min-w-0">
                            <label htmlFor={`${sid}-block`} className="sr-only">
                              Velg blokk for celle
                            </label>
                            <select
                              id={`${sid}-block`}
                              value={cell.blockId ?? ''}
                              onChange={(ev) => setCellBlock(row.id, cell.id, ev.target.value)}
                              className={selectBlockClass}
                              aria-label="Velg layout-blokk (samme som komponer-palett)"
                            >
                              <option value="">— Velg blokk (mobil) —</option>
                              {paletteItems.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="min-w-0 flex-1 overflow-x-auto">
                            {content ?? (
                              <p className={`py-8 text-center text-sm ${metaClass}`}>Velg blokk over eller slipp her</p>
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
