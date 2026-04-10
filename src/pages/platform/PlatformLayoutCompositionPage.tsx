import { useCallback, useEffect, useMemo, useState, type CSSProperties, type DragEvent } from 'react'
import { ArrowLeft, GripVertical, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { getSupabaseBrowserClient } from '../../lib/supabaseClient'
import { getSupabaseErrorMessage } from '../../lib/supabaseError'
import { usePlatformAdmin } from '../../hooks/usePlatformAdmin'
import { ComponentDesignPreview } from '../../components/platform/ComponentDesignPreview'
import { LayoutCompositionPreview } from '../../components/platform/LayoutCompositionPreview'
import { LayoutWidgetPreview } from '../../components/platform/LayoutWidgetPreview'
import { alignSelfCss, cellFlexStyle, flexAlignItemsCss } from '../../lib/layoutCompositionFlex'
import {
  cloneLayoutComposition,
  defaultLayoutContainerStyle,
  defaultRowStyle,
  defaultSlotStyle,
  emptyWidget,
  getCellAtPath,
  getEditableRows,
  mergeLayoutComposition,
  moveCellInTree,
  moveRowInList,
  newCell,
  newRow,
  patchTextLikeWidgetStyle,
  replaceRowsAtPath,
  updateCellAtPath,
  updateRowAtPath,
  type LayoutCompositionPayload,
  type LayoutCompositionRow,
  type LayoutCompositionSlot,
  type LayoutPathSegment,
  type LayoutSlotSpan,
  type LayoutWidgetPayload,
} from '../../types/layoutComposition'
import type { PlatformDesignerPayload } from '../../types/platformDesignerPayload'
import {
  mergePayload,
  clonePayloadForKind,
  payloadKind,
  inferDesignerKindFromUnknown,
} from '../../types/platformDesignerPayload'
import { baselineAnsatteLayout, baselineStyreOgValgLayout } from '../../data/baselineLayoutTemplates'
import { ColorField, SelectField, TextField } from './boxDesigner/sharedFields'
import { LABEL, PANEL, SECTION } from './boxDesigner/fieldTokens'

type DesignTab = {
  localId: string
  dbId?: string
  referenceKey: string
  payload: LayoutCompositionPayload
}

type ComponentRow = {
  reference_key: string
  display_name: string
  payload: PlatformDesignerPayload
}

const WIDGET_KIND_OPTIONS: { value: LayoutWidgetPayload['kind']; label: string }[] = [
  { value: 'heading', label: 'Overskrift' },
  { value: 'text', label: 'Tekst' },
  { value: 'button', label: 'Knapp' },
  { value: 'image', label: 'Bilde' },
  { value: 'divider', label: 'Delelinje' },
  { value: 'spacer', label: 'Luft' },
  { value: 'layout', label: 'Layout (rader/kolonner)' },
]

const MIME_ROW = 'application/x-klarert-layout-row'
const MIME_CELL = 'application/x-klarert-layout-cell'

function slugKey(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '')
      .slice(0, 64) || 'layout'
  )
}

export function PlatformLayoutCompositionPage() {
  const { userId, isAdmin } = usePlatformAdmin()
  const supabase = getSupabaseBrowserClient()

  const [tabs, setTabs] = useState<DesignTab[]>(() => [
    {
      localId: crypto.randomUUID(),
      referenceKey: 'layout-dashboard',
      payload: cloneLayoutComposition(),
    },
  ])
  const [activeIdx, setActiveIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [library, setLibrary] = useState<ComponentRow[]>([])
  /** Path to the layout-widget cell whose inner `rows` we edit (empty = root). */
  const [editorContextPath, setEditorContextPath] = useState<LayoutPathSegment[]>([])
  /** Full path from root to the selected cell (for style / widget editor). */
  const [selectedPath, setSelectedPath] = useState<LayoutPathSegment[] | null>(null)

  const active = tabs[activeIdx]

  const patchPayloadRows = useCallback(
    (fn: (rows: LayoutCompositionRow[]) => LayoutCompositionRow[]) => {
      setTabs((prev) => {
        const next = [...prev]
        const cur = next[activeIdx]
        if (!cur) return prev
        next[activeIdx] = { ...cur, payload: { ...cur.payload, rows: fn(cur.payload.rows) } }
        return next
      })
    },
    [activeIdx],
  )

  const updateCellByPath = useCallback(
    (path: LayoutPathSegment[], patch: Partial<LayoutCompositionSlot>) => {
      patchPayloadRows((rows) => updateCellAtPath(rows, path, patch))
    },
    [patchPayloadRows],
  )

  const libraryMap = useMemo(() => {
    const m = new Map<string, PlatformDesignerPayload>()
    for (const row of library) {
      m.set(row.reference_key, row.payload)
    }
    return m
  }, [library])

  const libraryOptions = useMemo(() => {
    return library.map((r) => ({
      value: r.reference_key,
      label: `${r.reference_key} (${payloadKind(r.payload)})`,
    }))
  }, [library])

  const loadLibrary = useCallback(async () => {
    if (!supabase || !userId || !isAdmin) return
    try {
      const { data, error: e } = await supabase
        .from('platform_box_designs')
        .select('reference_key,display_name,payload')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
      if (e) throw e
      setLibrary(
        (data ?? []).map((row: { reference_key: string; display_name: string; payload: unknown }) => {
          const raw = row.payload
          const kind = inferDesignerKindFromUnknown(raw)
          const payload = mergePayload(clonePayloadForKind(kind), raw as object)
          return {
            reference_key: row.reference_key as string,
            display_name: row.display_name as string,
            payload,
          }
        }),
      )
    } catch {
      setLibrary([])
    }
  }, [supabase, userId, isAdmin])

  const loadCompositions = useCallback(async () => {
    if (!supabase || !userId || !isAdmin) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      await loadLibrary()
      const { data, error: e } = await supabase
        .from('platform_layout_compositions')
        .select('id,reference_key,display_name,payload,updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
      if (e) throw e
      const rows = (data ?? []) as { id: string; reference_key: string; display_name: string; payload: unknown }[]
      if (rows.length === 0) {
        setTabs([
          {
            localId: crypto.randomUUID(),
            referenceKey: 'layout-dashboard',
            payload: cloneLayoutComposition(),
          },
        ])
        setActiveIdx(0)
        setEditorContextPath([])
        setSelectedPath(null)
        return
      }
      setTabs(
        rows.map((row) => ({
          localId: crypto.randomUUID(),
          dbId: row.id as string,
          referenceKey: row.reference_key as string,
          payload: mergeLayoutComposition(row.payload as Record<string, unknown>),
        })),
      )
      setActiveIdx(0)
      setEditorContextPath([])
      setSelectedPath(null)
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [supabase, userId, isAdmin, loadLibrary])

  useEffect(() => {
    void loadCompositions()
  }, [loadCompositions])

  const updatePayload = useCallback(
    (patch: Partial<LayoutCompositionPayload>) => {
      setTabs((prev) => {
        const next = [...prev]
        const cur = next[activeIdx]
        if (!cur) return prev
        const merged = { ...cur.payload, ...patch }
        next[activeIdx] = {
          ...cur,
          payload: mergeLayoutComposition(merged as Record<string, unknown>),
        }
        return next
      })
    },
    [activeIdx],
  )

  const updateTypography = useCallback(
    (patch: Partial<LayoutCompositionPayload['typography']>) => {
      setTabs((prev) => {
        const next = [...prev]
        const cur = next[activeIdx]
        if (!cur) return prev
        next[activeIdx] = {
          ...cur,
          payload: {
            ...cur.payload,
            typography: { ...cur.payload.typography, ...patch },
          },
        }
        return next
      })
    },
    [activeIdx],
  )

  const updateRowMeta = useCallback(
    (rowId: string, patch: Partial<LayoutCompositionRow>) => {
      patchPayloadRows((rows) =>
        updateRowAtPath(rows, editorContextPath, rowId, (r) => ({ ...r, ...patch })),
      )
    },
    [patchPayloadRows, editorContextPath],
  )

  const addRow = useCallback(() => {
    setTabs((prev) => {
      const next = [...prev]
      const cur = next[activeIdx]
      if (!cur) return prev
      const list = getEditableRows(cur.payload.rows, editorContextPath)
      const row = newRow([newCell({ label: 'Kolonne 1', span: 'full' })])
      const newRows = [...list, row]
      const rows = replaceRowsAtPath(cur.payload.rows, editorContextPath, newRows)
      next[activeIdx] = { ...cur, payload: { ...cur.payload, rows } }
      return next
    })
    setSelectedPath(null)
  }, [activeIdx, editorContextPath])

  const removeRow = useCallback(
    (rowId: string) => {
      setTabs((prev) => {
        const next = [...prev]
        const cur = next[activeIdx]
        if (!cur) return prev
        const list = getEditableRows(cur.payload.rows, editorContextPath)
        if (list.length <= 1) return prev
        const newRows = list.filter((r) => r.id !== rowId)
        const rows = replaceRowsAtPath(cur.payload.rows, editorContextPath, newRows)
        next[activeIdx] = { ...cur, payload: { ...cur.payload, rows } }
        return next
      })
      setSelectedPath((p) => (p?.some((s) => s.rowId === rowId) ? null : p))
    },
    [activeIdx, editorContextPath],
  )

  const moveRow = useCallback(
    (from: number, to: number) => {
      setTabs((prev) => {
        const next = [...prev]
        const cur = next[activeIdx]
        if (!cur) return prev
        const list = getEditableRows(cur.payload.rows, editorContextPath)
        const newRows = moveRowInList(list, from, to)
        if (newRows === list) return prev
        const rows = replaceRowsAtPath(cur.payload.rows, editorContextPath, newRows)
        next[activeIdx] = { ...cur, payload: { ...cur.payload, rows } }
        return next
      })
    },
    [activeIdx, editorContextPath],
  )

  const addCell = useCallback(
    (rowId: string) => {
      setTabs((prev) => {
        const next = [...prev]
        const cur = next[activeIdx]
        if (!cur) return prev
        const list = getEditableRows(cur.payload.rows, editorContextPath)
        const newRows = list.map((r) => {
          if (r.id !== rowId) return r
          const span: LayoutSlotSpan = r.columnMode === 'equal' ? 'auto' : 'half'
          return {
            ...r,
            cells: [...r.cells, newCell({ label: `Kolonne ${r.cells.length + 1}`, span })],
          }
        })
        const rows = replaceRowsAtPath(cur.payload.rows, editorContextPath, newRows)
        next[activeIdx] = { ...cur, payload: { ...cur.payload, rows } }
        return next
      })
    },
    [activeIdx, editorContextPath],
  )

  const removeCell = useCallback(
    (rowId: string, cellId: string) => {
      setTabs((prev) => {
        const next = [...prev]
        const cur = next[activeIdx]
        if (!cur) return prev
        const list = getEditableRows(cur.payload.rows, editorContextPath)
        const newRows = list.map((r) => {
          if (r.id !== rowId) return r
          if (r.cells.length <= 1) return r
          return { ...r, cells: r.cells.filter((c) => c.id !== cellId) }
        })
        const rows = replaceRowsAtPath(cur.payload.rows, editorContextPath, newRows)
        next[activeIdx] = { ...cur, payload: { ...cur.payload, rows } }
        return next
      })
      setSelectedPath((p) => (p?.some((s) => s.cellId === cellId) ? null : p))
    },
    [activeIdx, editorContextPath],
  )

  const onCellDragStart = useCallback((e: DragEvent, rowId: string, cellIndex: number) => {
    e.dataTransfer?.setData(MIME_CELL, JSON.stringify({ rowId, cellIndex }))
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  }, [])

  const onCellDropOnCell = useCallback(
    (e: DragEvent, targetRowId: string, targetIndex: number) => {
      e.preventDefault()
      const raw = e.dataTransfer.getData(MIME_CELL)
      if (!raw) return
      try {
        const { rowId: fromRowId, cellIndex: fromIndex } = JSON.parse(raw) as {
          rowId: string
          cellIndex: number
        }
        setTabs((prev) => {
          const next = [...prev]
          const cur = next[activeIdx]
          if (!cur) return prev
          const list = getEditableRows(cur.payload.rows, editorContextPath)
          const newList = moveCellInTree(list, fromRowId, fromIndex, targetRowId, targetIndex)
          const rows = replaceRowsAtPath(cur.payload.rows, editorContextPath, newList)
          next[activeIdx] = { ...cur, payload: { ...cur.payload, rows } }
          return next
        })
      } catch {
        /* ignore */
      }
    },
    [activeIdx, editorContextPath],
  )

  const onRowDragStart = useCallback((e: DragEvent, rowIndex: number) => {
    e.dataTransfer?.setData(MIME_ROW, String(rowIndex))
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  }, [])

  const onRowDrop = useCallback(
    (e: DragEvent, targetIndex: number) => {
      e.preventDefault()
      const raw = e.dataTransfer.getData(MIME_ROW)
      if (raw === '') return
      const from = Number(raw)
      if (Number.isNaN(from)) return
      if (from === targetIndex) return
      moveRow(from, targetIndex > from ? targetIndex - 1 : targetIndex)
    },
    [moveRow],
  )

  const setReferenceKeyRaw = useCallback(
    (referenceKey: string) => {
      setTabs((prev) => {
        const next = [...prev]
        const cur = next[activeIdx]
        if (!cur) return prev
        next[activeIdx] = { ...cur, referenceKey }
        return next
      })
    },
    [activeIdx],
  )

  const addTab = useCallback(() => {
    const n = tabs.length + 1
    const referenceKey = `layout-${n}-${Math.random().toString(36).slice(2, 6)}`
    const payload = cloneLayoutComposition({
      metadata: { name: `Ny mal ${n}`, description: 'Dra rader og celler. Lagre for gjenbruk.' },
    })
    setTabs((prev) => [...prev, { localId: crypto.randomUUID(), referenceKey, payload }])
    setActiveIdx(tabs.length)
    setEditorContextPath([])
    setSelectedPath(null)
    setMessage(null)
  }, [tabs.length])

  const removeTab = useCallback(
    async (idx: number) => {
      const tab = tabs[idx]
      if (!tab) return
      if (tabs.length <= 1) {
        setError('Minst én layout-fane må være åpen.')
        return
      }
      if (tab.dbId && supabase) {
        setBusy(true)
        setError(null)
        try {
          const { error: e } = await supabase.from('platform_layout_compositions').delete().eq('id', tab.dbId)
          if (e) throw e
        } catch (err) {
          setError(getSupabaseErrorMessage(err))
          setBusy(false)
          return
        }
        setBusy(false)
      }
      setTabs((prev) => prev.filter((_, i) => i !== idx))
      setActiveIdx((i) => {
        if (i === idx) return Math.max(0, idx - 1)
        if (i > idx) return i - 1
        return i
      })
      setEditorContextPath([])
      setSelectedPath(null)
    },
    [supabase, tabs],
  )

  const saveActive = useCallback(async () => {
    if (!supabase || !userId || !isAdmin || !active) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const key = slugKey(active.referenceKey)
      if (!key) {
        setError('Referansenøkkel kan ikke være tom.')
        setBusy(false)
        return
      }
      const displayName = active.payload.metadata.name.trim() || key
      let newId = active.dbId
      if (active.dbId) {
        const { error: e } = await supabase
          .from('platform_layout_compositions')
          .update({
            reference_key: key,
            display_name: displayName,
            payload: active.payload,
          })
          .eq('id', active.dbId)
        if (e) throw e
      } else {
        const { data, error: e } = await supabase
          .from('platform_layout_compositions')
          .insert({
            user_id: userId,
            reference_key: key,
            display_name: displayName,
            payload: active.payload,
          })
          .select('id')
          .single()
        if (e) throw e
        newId = data?.id as string
      }
      setTabs((prev) => {
        const next = [...prev]
        const cur = next[activeIdx]
        if (cur) next[activeIdx] = { ...cur, referenceKey: key, dbId: newId }
        return next
      })
      setMessage(`Mal lagret som «${key}». JSON inneholder rader, typografi og widgets — gjenbruk i nye sider.`)
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }, [supabase, userId, isAdmin, active, activeIdx])

  const exportJson = useMemo(() => (active ? JSON.stringify(active.payload, null, 2) : ''), [active])

  const copyExport = useCallback(() => {
    void navigator.clipboard.writeText(exportJson)
    setMessage('JSON kopiert.')
  }, [exportJson])

  const applyBaselineStyreOgValg = useCallback(() => {
    const payload = baselineStyreOgValgLayout()
    setTabs((prev) => {
      const next = [...prev]
      const cur = next[activeIdx]
      if (!cur) return prev
      next[activeIdx] = {
        ...cur,
        referenceKey: 'baseline-styre-og-valg',
        payload,
      }
      return next
    })
    setEditorContextPath([])
    setSelectedPath(null)
    setMessage('Lastet inn mal «Baselinje: Styre og valg». Lagre med ønsket referansenøkkel.')
  }, [activeIdx])

  const applyBaselineAnsatte = useCallback(() => {
    const payload = baselineAnsatteLayout()
    setTabs((prev) => {
      const next = [...prev]
      const cur = next[activeIdx]
      if (!cur) return prev
      next[activeIdx] = {
        ...cur,
        referenceKey: 'baseline-ansatte',
        payload,
      }
      return next
    })
    setEditorContextPath([])
    setSelectedPath(null)
    setMessage('Lastet inn mal «Baselinje: Ansatte». Lagre med ønsket referansenøkkel.')
  }, [activeIdx])

  const selectedSlot = useMemo(() => {
    if (!active || !selectedPath?.length) return null
    return getCellAtPath(active.payload.rows, selectedPath)
  }, [active, selectedPath])

  const editableRows = useMemo(
    () => (active ? getEditableRows(active.payload.rows, editorContextPath) : []),
    [active, editorContextPath],
  )

  const pathKey = (path: LayoutPathSegment[]) => path.map((s) => `${s.rowId}:${s.cellId}`).join('>')

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-neutral-300">
        <Loader2 className="size-5 animate-spin" />
        Laster layout…
      </div>
    )
  }

  if (!active) {
    return <p className="text-neutral-400">Ingen fane.</p>
  }

  const p = active.payload
  const c = p.canvas
  const typo = p.typography

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Layout-designer</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Bygg <strong className="text-neutral-300">rader</strong> og <strong className="text-neutral-300">kolonner</strong> med dra-og-slipp.
          Hver celle kan være <strong className="text-neutral-300">widget</strong>, <strong className="text-neutral-300">layout (nestede rader)</strong> eller lagret{' '}
          <strong className="text-neutral-300">komponent</strong>. Kolonner kan deles <strong className="text-neutral-300">likt</strong> (auto etter antall) eller med{' '}
          <strong className="text-neutral-300">12-kolonne</strong> span. Bruk «Stil» på hver celle og «Rad-stil» for bakgrunn/kant på raden.
          <strong className="ml-1 text-amber-200/90">Lagre</strong> som gjenbrukbar mal i databasen.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Start fra app-mal</span>
        <button
          type="button"
          onClick={applyBaselineStyreOgValg}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-neutral-200 hover:bg-white/10"
        >
          Styre og valg (råd)
        </button>
        <button
          type="button"
          onClick={applyBaselineAnsatte}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-neutral-200 hover:bg-white/10"
        >
          Ansatte (organisasjon)
        </button>
        <span className="text-xs text-neutral-500">
          Erstatter aktiv fane (ikke lagret før du trykker «Lagre mal»).
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
        {tabs.map((tab, idx) => (
          <div key={tab.localId} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveIdx(idx)
                setEditorContextPath([])
                setSelectedPath(null)
              }}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                idx === activeIdx ? 'bg-white/15 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {tab.referenceKey}
            </button>
            <button
              type="button"
              onClick={() => void removeTab(idx)}
              className="rounded p-1.5 text-neutral-500 hover:bg-white/10 hover:text-red-300"
              title="Fjern fane"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addTab}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/20 px-3 py-2 text-sm text-neutral-300 hover:border-white/40 hover:text-white"
        >
          <Plus className="size-4" />
          Ny mal
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,400px)]">
        <div className="space-y-4">
          <section className={SECTION}>
            <h2 className="text-sm font-semibold text-white">Identitet</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TextField label="Referansenøkkel (mal)" value={active.referenceKey} onChange={setReferenceKeyRaw} />
              <TextField label="metadata.name" value={p.metadata.name} onChange={(v) => updatePayload({ metadata: { ...p.metadata, name: v } })} />
            </div>
            <label className={`${LABEL} mt-3`}>
              Beskrivelse
              <textarea
                value={p.metadata.description}
                onChange={(e) => updatePayload({ metadata: { ...p.metadata, description: e.target.value } })}
                rows={2}
                className={PANEL}
              />
            </label>
          </section>

          <section className={SECTION}>
            <h2 className="text-sm font-semibold text-white">Sidetypografi</h2>
            <p className="mt-1 text-xs text-neutral-500">Gjelder hele malen; enkeltwidgets kan overstyre.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TextField
                label="Font (brødtekst)"
                value={typo.fontFamily}
                onChange={(v) => updateTypography({ fontFamily: v })}
              />
              <TextField
                label="Font (overskrifter)"
                value={typo.headingFontFamily}
                onChange={(v) => updateTypography({ headingFontFamily: v })}
              />
              <TextField label="Basestørrelse" value={typo.baseFontSize} onChange={(v) => updateTypography({ baseFontSize: v })} />
              <ColorField label="Tekstfarge" value={typo.textColor} onChange={(v) => updateTypography({ textColor: v })} />
              <ColorField label="Overskriftfarge" value={typo.headingColor} onChange={(v) => updateTypography({ headingColor: v })} />
            </div>
          </section>

          <section className={SECTION}>
            <h2 className="text-sm font-semibold text-white">Lerret (canvas)</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TextField label="maxWidth" value={c.maxWidth} onChange={(v) => updatePayload({ canvas: { ...c, maxWidth: v } })} />
              <TextField label="padding" value={c.padding} onChange={(v) => updatePayload({ canvas: { ...c, padding: v } })} />
              <TextField label="Vertikal gap (mellom rader)" value={c.gap} onChange={(v) => updatePayload({ canvas: { ...c, gap: v } })} />
              <TextField label="minHeight" value={c.minHeight} onChange={(v) => updatePayload({ canvas: { ...c, minHeight: v } })} />
              <ColorField label="backgroundColor" value={c.backgroundColor} onChange={(v) => updatePayload({ canvas: { ...c, backgroundColor: v } })} />
              <TextField label="borderRadius" value={c.borderRadius} onChange={(v) => updatePayload({ canvas: { ...c, borderRadius: v } })} />
              <TextField label="borderWidth" value={c.borderWidth} onChange={(v) => updatePayload({ canvas: { ...c, borderWidth: v } })} />
              <TextField label="borderStyle" value={c.borderStyle} onChange={(v) => updatePayload({ canvas: { ...c, borderStyle: v } })} />
              <ColorField label="borderColor" value={c.borderColor} onChange={(v) => updatePayload({ canvas: { ...c, borderColor: v } })} />
              <label className={`${LABEL} sm:col-span-2`}>
                backgroundGradient (valgfritt)
                <textarea
                  value={c.backgroundGradient}
                  onChange={(e) => updatePayload({ canvas: { ...c, backgroundGradient: e.target.value } })}
                  rows={2}
                  className={PANEL}
                  placeholder="linear-gradient(...)"
                />
              </label>
            </div>
          </section>

          <section className={SECTION}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">Rader og kolonner</h2>
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-xs text-neutral-300 hover:bg-white/5"
              >
                <Plus className="size-3.5" />
                Ny rad
              </button>
            </div>
            {editorContextPath.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                <span>Redigerer nested layout ({editorContextPath.length} nivå)</span>
                <button
                  type="button"
                  onClick={() => {
                    setEditorContextPath((prev) => prev.slice(0, -1))
                    setSelectedPath(null)
                  }}
                  className="inline-flex items-center gap-1 rounded border border-amber-400/40 px-2 py-1 font-medium hover:bg-amber-500/20"
                >
                  <ArrowLeft className="size-3.5" />
                  Ett nivå opp
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditorContextPath([])
                    setSelectedPath(null)
                  }}
                  className="rounded border border-white/20 px-2 py-1 hover:bg-white/10"
                >
                  Til rot
                </button>
              </div>
            ) : null}
            <p className="mt-1 text-xs text-neutral-500">
              Dra <GripVertical className="inline size-3" /> på rad eller celle i forhåndsvisningen. Bibliotek: {library.length} komponent(er).{' '}
              <strong className="text-neutral-400">Lik fordeling</strong> skalerer kolonner etter antall celler i raden.
            </p>
            <div className="mt-4 space-y-6">
              {editableRows.map((row, rowIndex) => (
                <div
                  key={row.id}
                  className="rounded-lg border border-white/10 bg-slate-950/50 p-3"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onRowDrop(e, rowIndex)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        draggable
                        onDragStart={(e) => onRowDragStart(e, rowIndex)}
                        className="cursor-grab rounded p-1 text-neutral-500 hover:bg-white/10 active:cursor-grabbing"
                        title="Dra for å flytte rad"
                      >
                        <GripVertical className="size-4" />
                      </button>
                      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Rad {rowIndex + 1}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <TextField label="gap" value={row.gap} onChange={(v) => updateRowMeta(row.id, { gap: v })} />
                      <SelectField
                        label="Kolonner"
                        value={row.columnMode}
                        options={[
                          { value: 'fixed', label: '12-kolonne (span)' },
                          { value: 'equal', label: 'Lik fordeling' },
                        ]}
                        onChange={(v) => {
                          const columnMode = v as LayoutCompositionRow['columnMode']
                          updateRowMeta(row.id, {
                            columnMode,
                            cells: row.cells.map((c) =>
                              columnMode === 'equal' && (c.span === 'full' || c.span === 'half' || c.span === 'third')
                                ? { ...c, span: 'auto' as const }
                                : c,
                            ),
                          })
                        }}
                      />
                      <SelectField
                        label="alignItems"
                        value={row.alignItems}
                        options={[
                          { value: 'stretch', label: 'stretch' },
                          { value: 'start', label: 'start' },
                          { value: 'center', label: 'center' },
                          { value: 'end', label: 'end' },
                        ]}
                        onChange={(v) => updateRowMeta(row.id, { alignItems: v as LayoutCompositionRow['alignItems'] })}
                      />
                      <button
                        type="button"
                        onClick={() => addCell(row.id)}
                        className="rounded border border-white/15 px-2 py-1 text-xs text-neutral-300 hover:bg-white/5"
                      >
                        + Kolonne
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="rounded p-1.5 text-neutral-500 hover:bg-white/10 hover:text-red-300"
                        title="Slett rad"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                  <details className="mt-2 rounded border border-white/10 bg-slate-900/30 px-2 py-1.5">
                    <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      Rad-stil (bakgrunn, kant, margin)
                    </summary>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <ColorField
                        label="Rad bakgrunn"
                        value={row.rowStyle.backgroundColor}
                        onChange={(v) => updateRowMeta(row.id, { rowStyle: { ...defaultRowStyle(), ...row.rowStyle, backgroundColor: v } })}
                      />
                      <TextField
                        label="Rad padding"
                        value={row.rowStyle.padding}
                        onChange={(v) => updateRowMeta(row.id, { rowStyle: { ...defaultRowStyle(), ...row.rowStyle, padding: v } })}
                      />
                      <TextField
                        label="Rad borderRadius"
                        value={row.rowStyle.borderRadius}
                        onChange={(v) => updateRowMeta(row.id, { rowStyle: { ...defaultRowStyle(), ...row.rowStyle, borderRadius: v } })}
                      />
                      <TextField
                        label="Rad borderWidth"
                        value={row.rowStyle.borderWidth}
                        onChange={(v) => updateRowMeta(row.id, { rowStyle: { ...defaultRowStyle(), ...row.rowStyle, borderWidth: v } })}
                      />
                      <TextField
                        label="Rad borderStyle"
                        value={row.rowStyle.borderStyle}
                        onChange={(v) => updateRowMeta(row.id, { rowStyle: { ...defaultRowStyle(), ...row.rowStyle, borderStyle: v } })}
                      />
                      <ColorField
                        label="Rad borderColor"
                        value={row.rowStyle.borderColor}
                        onChange={(v) => updateRowMeta(row.id, { rowStyle: { ...defaultRowStyle(), ...row.rowStyle, borderColor: v } })}
                      />
                      <TextField
                        label="boxShadow"
                        value={row.rowStyle.boxShadow}
                        onChange={(v) => updateRowMeta(row.id, { rowStyle: { ...defaultRowStyle(), ...row.rowStyle, boxShadow: v } })}
                      />
                      <TextField
                        label="marginTop"
                        value={row.rowStyle.marginTop}
                        onChange={(v) => updateRowMeta(row.id, { rowStyle: { ...defaultRowStyle(), ...row.rowStyle, marginTop: v } })}
                      />
                      <TextField
                        label="marginBottom"
                        value={row.rowStyle.marginBottom}
                        onChange={(v) => updateRowMeta(row.id, { rowStyle: { ...defaultRowStyle(), ...row.rowStyle, marginBottom: v } })}
                      />
                    </div>
                  </details>
                  <div className="mt-3 space-y-3">
                    {row.cells.map((slot, cellIndex) => {
                      const cellPath: LayoutPathSegment[] = [...editorContextPath, { rowId: row.id, cellId: slot.id }]
                      const pathStr = pathKey(cellPath)
                      const selStr = selectedPath ? pathKey(selectedPath) : ''
                      const isSel = pathStr === selStr
                      return (
                        <div
                          key={slot.id}
                          className={`rounded-lg border p-3 ${
                            isSel ? 'border-amber-400/50 bg-amber-500/5' : 'border-white/10 bg-slate-900/40'
                          }`}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => onCellDropOnCell(e, row.id, cellIndex)}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <button
                              type="button"
                              draggable
                              onDragStart={(e) => onCellDragStart(e, row.id, cellIndex)}
                              className="mt-1 cursor-grab rounded p-1 text-neutral-500 hover:bg-white/10 active:cursor-grabbing"
                              title="Dra celle"
                            >
                              <GripVertical className="size-4" />
                            </button>
                            <div className="min-w-0 flex-1">
                              <TextField
                                label="Etikett"
                                value={slot.label}
                                onChange={(v) => updateCellByPath(cellPath, { label: v })}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedPath(cellPath)}
                              className="rounded border border-amber-500/40 px-2 py-1 text-xs text-amber-200 hover:bg-amber-500/10"
                            >
                              Stil
                            </button>
                            {slot.mode === 'widget' && slot.widget?.kind === 'layout' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditorContextPath(cellPath)
                                  setSelectedPath(null)
                                }}
                                className="rounded border border-sky-500/40 px-2 py-1 text-xs text-sky-200 hover:bg-sky-500/10"
                              >
                                Åpne layout
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => removeCell(row.id, slot.id)}
                              className="rounded p-1.5 text-neutral-500 hover:bg-white/10 hover:text-red-300"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <SelectField
                              label="Innhold"
                              value={slot.mode}
                              options={[
                                { value: 'widget', label: 'Widget (bygg her)' },
                                { value: 'component', label: 'Lagret komponent' },
                              ]}
                              onChange={(v) => {
                                const mode = v as LayoutCompositionSlot['mode']
                                updateCellByPath(cellPath, {
                                  mode,
                                  widget: mode === 'widget' ? slot.widget ?? emptyWidget('text') : null,
                                  componentReferenceKey: mode === 'component' ? slot.componentReferenceKey : null,
                                })
                              }}
                            />
                            <SelectField
                              label="Bredde"
                              value={slot.span}
                              options={
                                row.columnMode === 'equal'
                                  ? [{ value: 'auto', label: 'Auto (lik)' }]
                                  : [
                                      { value: 'full', label: 'Full (12/12)' },
                                      { value: 'half', label: 'Halv (6/12)' },
                                      { value: 'third', label: 'Tredjedel (4/12)' },
                                      { value: 'auto', label: 'Flex (1:1)' },
                                    ]
                              }
                              onChange={(v) => updateCellByPath(cellPath, { span: v as LayoutSlotSpan })}
                            />
                            <SelectField
                              label="Justering"
                              value={slot.align}
                              options={[
                                { value: 'stretch', label: 'stretch' },
                                { value: 'start', label: 'start' },
                                { value: 'center', label: 'center' },
                                { value: 'end', label: 'end' },
                              ]}
                              onChange={(v) => updateCellByPath(cellPath, { align: v as LayoutCompositionSlot['align'] })}
                            />
                            {slot.mode === 'component' ? (
                              <SelectField
                                label="Komponent"
                                value={slot.componentReferenceKey ?? ''}
                                options={[{ value: '', label: '— Velg —' }, ...libraryOptions.map((o) => ({ value: o.value, label: o.label }))]}
                                onChange={(v) => updateCellByPath(cellPath, { componentReferenceKey: v || null })}
                              />
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveActive()}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500/90 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Lagre mal
            </button>
            <button
              type="button"
              onClick={copyExport}
              className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-neutral-200 hover:bg-white/5"
            >
              Kopier JSON
            </button>
          </div>
        </div>

        <div className="space-y-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Forhåndsvisning (full side)</p>
            <div
              className="mt-4"
              style={{
                maxWidth: c.maxWidth,
                margin: '0 auto',
                padding: c.padding,
                minHeight: c.minHeight,
                borderRadius: c.borderRadius,
                borderWidth: c.borderWidth,
                borderStyle: c.borderStyle as CSSProperties['borderStyle'],
                borderColor: c.borderColor,
                background: c.backgroundGradient?.trim() || c.backgroundColor,
                fontFamily: typo.fontFamily,
                fontSize: typo.baseFontSize,
                color: typo.textColor,
              }}
            >
              <LayoutCompositionPreview rows={p.rows} typography={typo} libraryMap={libraryMap} verticalGap={c.gap} />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Redigeringsforhåndsvisning</p>
            <p className="mt-1 text-[10px] text-neutral-500">
              Speiler kolonnemodus (lik / 12-kolonne). Dra rader og celler her.
            </p>
            <div
              className="mt-3 max-h-[min(420px,50vh)] overflow-auto rounded-lg border border-white/10 bg-neutral-100/90 p-2"
              style={{ fontFamily: typo.fontFamily, fontSize: typo.baseFontSize, color: typo.textColor }}
            >
              {editableRows.map((row, rowIndex) => {
                const rs = row.rowStyle
                const n = row.cells.length || 1
                return (
                  <div
                    key={row.id}
                    className="mb-2 flex flex-wrap"
                    style={{
                      gap: row.gap,
                      alignItems: flexAlignItemsCss(row.alignItems),
                      backgroundColor: rs.backgroundColor,
                      padding: rs.padding,
                      borderRadius: rs.borderRadius,
                      borderWidth: rs.borderWidth,
                      borderStyle: rs.borderStyle as CSSProperties['borderStyle'],
                      borderColor: rs.borderColor,
                      boxShadow: rs.boxShadow === 'none' ? undefined : rs.boxShadow,
                      marginTop: rs.marginTop,
                      marginBottom: rs.marginBottom,
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onRowDrop(e, rowIndex)}
                  >
                    {row.cells.map((slot, cellIndex) => {
                      const comp = slot.componentReferenceKey ? libraryMap.get(slot.componentReferenceKey) : undefined
                      const st = slot.slotStyle
                      const cellPath: LayoutPathSegment[] = [...editorContextPath, { rowId: row.id, cellId: slot.id }]
                      const pathStr = pathKey(cellPath)
                      const selStr = selectedPath ? pathKey(selectedPath) : ''
                      const isSel = pathStr === selStr
                      const flexStyle = cellFlexStyle(slot.span, row.columnMode, n)
                      return (
                        <div
                          key={slot.id}
                          className="min-w-0"
                          style={{ ...flexStyle, alignSelf: alignSelfCss(slot) }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => onCellDropOnCell(e, row.id, cellIndex)}
                        >
                          <div
                            className={`rounded border border-dashed border-black/20 p-1.5 ${isSel ? 'ring-2 ring-amber-400/70' : ''}`}
                            style={{
                              backgroundColor: st?.backgroundColor,
                              padding: st?.padding,
                              borderRadius: st?.borderRadius,
                              borderWidth: st?.borderWidth,
                              borderStyle: st?.borderStyle as CSSProperties['borderStyle'],
                              borderColor: st?.borderColor,
                              boxShadow: st?.boxShadow === 'none' ? undefined : st?.boxShadow,
                            }}
                          >
                            <div className="mb-1 flex items-center justify-between gap-1 text-[9px] uppercase tracking-wide text-neutral-600">
                              <span className="truncate">{slot.label}</span>
                              <button
                                type="button"
                                draggable
                                onDragStart={(e) => onCellDragStart(e, row.id, cellIndex)}
                                className="cursor-grab rounded p-0.5 hover:bg-black/5 active:cursor-grabbing"
                              >
                                <GripVertical className="size-3" />
                              </button>
                            </div>
                            <div className="overflow-hidden rounded bg-white/95">
                              {slot.mode === 'component' && comp ? (
                                <ComponentDesignPreview payload={comp} />
                              ) : slot.mode === 'widget' && slot.widget ? (
                                slot.widget.kind === 'layout' ? (
                                  <div className="p-2 text-center text-[10px] text-neutral-500">Layout (åpne for å redigere)</div>
                                ) : (
                                  <div className="p-2">
                                    <LayoutWidgetPreview widget={slot.widget} typography={typo} />
                                  </div>
                                )
                              ) : (
                                <p className="p-2 text-center text-[10px] text-neutral-500">Tom</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>

          {selectedSlot && selectedPath ? (
            <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Celle: {selectedSlot.label}</p>
              <p className="mt-1 text-[10px] text-neutral-500">Ramme / padding / skygge</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <ColorField
                  label="Bakgrunn"
                  value={selectedSlot.slotStyle?.backgroundColor ?? defaultSlotStyle().backgroundColor}
                  onChange={(v) =>
                    updateCellByPath(selectedPath, {
                      slotStyle: { ...defaultSlotStyle(), ...selectedSlot.slotStyle, backgroundColor: v },
                    })
                  }
                />
                <TextField
                  label="padding"
                  value={selectedSlot.slotStyle?.padding ?? defaultSlotStyle().padding}
                  onChange={(v) =>
                    updateCellByPath(selectedPath, {
                      slotStyle: { ...defaultSlotStyle(), ...selectedSlot.slotStyle, padding: v },
                    })
                  }
                />
                <TextField
                  label="borderRadius"
                  value={selectedSlot.slotStyle?.borderRadius ?? defaultSlotStyle().borderRadius}
                  onChange={(v) =>
                    updateCellByPath(selectedPath, {
                      slotStyle: { ...defaultSlotStyle(), ...selectedSlot.slotStyle, borderRadius: v },
                    })
                  }
                />
                <TextField
                  label="borderWidth"
                  value={selectedSlot.slotStyle?.borderWidth ?? defaultSlotStyle().borderWidth}
                  onChange={(v) =>
                    updateCellByPath(selectedPath, {
                      slotStyle: { ...defaultSlotStyle(), ...selectedSlot.slotStyle, borderWidth: v },
                    })
                  }
                />
                <TextField
                  label="borderStyle"
                  value={selectedSlot.slotStyle?.borderStyle ?? defaultSlotStyle().borderStyle}
                  onChange={(v) =>
                    updateCellByPath(selectedPath, {
                      slotStyle: { ...defaultSlotStyle(), ...selectedSlot.slotStyle, borderStyle: v },
                    })
                  }
                />
                <ColorField
                  label="borderColor"
                  value={selectedSlot.slotStyle?.borderColor ?? defaultSlotStyle().borderColor}
                  onChange={(v) =>
                    updateCellByPath(selectedPath, {
                      slotStyle: { ...defaultSlotStyle(), ...selectedSlot.slotStyle, borderColor: v },
                    })
                  }
                />
                <TextField
                  label="boxShadow"
                  value={selectedSlot.slotStyle?.boxShadow ?? defaultSlotStyle().boxShadow}
                  onChange={(v) =>
                    updateCellByPath(selectedPath, {
                      slotStyle: { ...defaultSlotStyle(), ...selectedSlot.slotStyle, boxShadow: v },
                    })
                  }
                />
              </div>

              {selectedSlot.mode === 'widget' && selectedSlot.widget ? (
                (() => {
                  const w = selectedSlot.widget
                  const path = selectedPath
                  return (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <SelectField
                    label="Widget-type"
                    value={w.kind}
                    options={WIDGET_KIND_OPTIONS}
                    onChange={(v) => {
                      const kind = v as LayoutWidgetPayload['kind']
                      updateCellByPath(path, { widget: emptyWidget(kind) })
                    }}
                  />
                  {w.kind === 'heading' ? (
                    <div className="mt-3 space-y-2">
                      <TextField
                        label="Tekst"
                        value={w.text}
                        onChange={(text) =>
                          updateCellByPath(path, {
                            widget: { ...w, text },
                          })
                        }
                      />
                      <SelectField
                        label="Nivå"
                        value={String(w.level)}
                        options={[
                          { value: '1', label: 'H1' },
                          { value: '2', label: 'H2' },
                          { value: '3', label: 'H3' },
                          { value: '4', label: 'H4' },
                        ]}
                        onChange={(v) =>
                          updateCellByPath(path, {
                            widget: { ...w, level: Number(v) as 1 | 2 | 3 | 4 },
                          })
                        }
                      />
                    </div>
                  ) : null}
                  {w.kind === 'text' ? (
                    <label className={`${LABEL} mt-3`}>
                      Tekst
                      <textarea
                        value={w.text}
                        onChange={(e) =>
                          updateCellByPath(path, {
                            widget: { ...w, text: e.target.value },
                          })
                        }
                        rows={4}
                        className={PANEL}
                      />
                    </label>
                  ) : null}
                  {w.kind === 'button' ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <TextField
                        label="Etikett"
                        value={w.label}
                        onChange={(label) =>
                          updateCellByPath(path, {
                            widget: { ...w, label },
                          })
                        }
                      />
                      <TextField
                        label="href"
                        value={w.href}
                        onChange={(href) =>
                          updateCellByPath(path, {
                            widget: { ...w, href },
                          })
                        }
                      />
                      <TextField
                        label="fontSize"
                        value={w.fontSize}
                        onChange={(fontSize) =>
                          updateCellByPath(path, {
                            widget: { ...w, fontSize },
                          })
                        }
                      />
                      <ColorField
                        label="Bakgrunn"
                        value={w.backgroundColor}
                        onChange={(backgroundColor) =>
                          updateCellByPath(path, {
                            widget: { ...w, backgroundColor },
                          })
                        }
                      />
                      <ColorField
                        label="Tekst"
                        value={w.textColor}
                        onChange={(textColor) =>
                          updateCellByPath(path, {
                            widget: { ...w, textColor },
                          })
                        }
                      />
                      <SelectField
                        label="Vekt"
                        value={w.fontWeight}
                        options={[
                          { value: '400', label: 'Normal' },
                          { value: '500', label: 'Medium' },
                          { value: '600', label: 'Semibold' },
                          { value: '700', label: 'Bold' },
                        ]}
                        onChange={(fontWeight) =>
                          updateCellByPath(path, {
                            widget: {
                              ...w,
                              fontWeight: fontWeight as '400' | '500' | '600' | '700',
                            },
                          })
                        }
                      />
                      <TextField
                        label="padding"
                        value={w.padding}
                        onChange={(padding) =>
                          updateCellByPath(path, {
                            widget: { ...w, padding },
                          })
                        }
                      />
                      <TextField
                        label="borderRadius"
                        value={w.borderRadius}
                        onChange={(borderRadius) =>
                          updateCellByPath(path, {
                            widget: { ...w, borderRadius },
                          })
                        }
                      />
                      <TextField
                        label="borderWidth"
                        value={w.borderWidth}
                        onChange={(borderWidth) =>
                          updateCellByPath(path, {
                            widget: { ...w, borderWidth },
                          })
                        }
                      />
                      <TextField
                        label="borderStyle"
                        value={w.borderStyle}
                        onChange={(borderStyle) =>
                          updateCellByPath(path, {
                            widget: { ...w, borderStyle },
                          })
                        }
                      />
                      <ColorField
                        label="borderColor"
                        value={w.borderColor}
                        onChange={(borderColor) =>
                          updateCellByPath(path, {
                            widget: { ...w, borderColor },
                          })
                        }
                      />
                      <TextField
                        label="boxShadow"
                        value={w.boxShadow}
                        onChange={(boxShadow) =>
                          updateCellByPath(path, {
                            widget: { ...w, boxShadow },
                          })
                        }
                      />
                    </div>
                  ) : null}
                  {w.kind === 'image' ? (
                    <div className="mt-3 grid gap-2">
                      <TextField
                        label="URL"
                        value={w.src}
                        onChange={(src) =>
                          updateCellByPath(path, {
                            widget: { ...w, src },
                          })
                        }
                      />
                      <TextField
                        label="alt"
                        value={w.alt}
                        onChange={(alt) =>
                          updateCellByPath(path, {
                            widget: { ...w, alt },
                          })
                        }
                      />
                      <SelectField
                        label="objectFit"
                        value={w.objectFit}
                        options={[
                          { value: 'cover', label: 'cover' },
                          { value: 'contain', label: 'contain' },
                        ]}
                        onChange={(objectFit) =>
                          updateCellByPath(path, {
                            widget: {
                              ...w,
                              objectFit: objectFit as 'cover' | 'contain',
                            },
                          })
                        }
                      />
                      <TextField
                        label="borderRadius"
                        value={w.borderRadius}
                        onChange={(borderRadius) =>
                          updateCellByPath(path, {
                            widget: { ...w, borderRadius },
                          })
                        }
                      />
                      <TextField
                        label="maxHeight"
                        value={w.maxHeight}
                        onChange={(maxHeight) =>
                          updateCellByPath(path, {
                            widget: { ...w, maxHeight },
                          })
                        }
                      />
                      <TextField
                        label="width"
                        value={w.width}
                        onChange={(width) =>
                          updateCellByPath(path, {
                            widget: { ...w, width },
                          })
                        }
                      />
                    </div>
                  ) : null}
                  {w.kind === 'divider' ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <ColorField
                        label="Farge"
                        value={w.color}
                        onChange={(color) =>
                          updateCellByPath(path, {
                            widget: { ...w, color },
                          })
                        }
                      />
                      <TextField
                        label="Tykkelse"
                        value={w.thickness}
                        onChange={(thickness) =>
                          updateCellByPath(path, {
                            widget: { ...w, thickness },
                          })
                        }
                      />
                    </div>
                  ) : null}
                  {w.kind === 'spacer' ? (
                    <TextField
                      label="Høyde"
                      value={w.height}
                      onChange={(height) =>
                        updateCellByPath(path, {
                          widget: { ...w, height },
                        })
                      }
                    />
                  ) : null}
                  {w.kind === 'layout' ? (
                    <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
                      <p className="text-[10px] font-semibold uppercase text-neutral-500">Ytre boks (nested layout)</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <TextField
                          label="padding"
                          value={w.containerStyle.padding}
                          onChange={(padding) =>
                            updateCellByPath(path, {
                              widget: {
                                ...w,
                                containerStyle: { ...defaultLayoutContainerStyle(), ...w.containerStyle, padding },
                              },
                            })
                          }
                        />
                        <TextField
                          label="gap (mellom rader)"
                          value={w.containerStyle.gap}
                          onChange={(gap) =>
                            updateCellByPath(path, {
                              widget: {
                                ...w,
                                containerStyle: { ...defaultLayoutContainerStyle(), ...w.containerStyle, gap },
                              },
                            })
                          }
                        />
                        <ColorField
                          label="Bakgrunn"
                          value={w.containerStyle.backgroundColor}
                          onChange={(backgroundColor) =>
                            updateCellByPath(path, {
                              widget: {
                                ...w,
                                containerStyle: { ...defaultLayoutContainerStyle(), ...w.containerStyle, backgroundColor },
                              },
                            })
                          }
                        />
                        <TextField
                          label="borderRadius"
                          value={w.containerStyle.borderRadius}
                          onChange={(borderRadius) =>
                            updateCellByPath(path, {
                              widget: {
                                ...w,
                                containerStyle: { ...defaultLayoutContainerStyle(), ...w.containerStyle, borderRadius },
                              },
                            })
                          }
                        />
                        <TextField
                          label="borderWidth"
                          value={w.containerStyle.borderWidth}
                          onChange={(borderWidth) =>
                            updateCellByPath(path, {
                              widget: {
                                ...w,
                                containerStyle: { ...defaultLayoutContainerStyle(), ...w.containerStyle, borderWidth },
                              },
                            })
                          }
                        />
                        <TextField
                          label="borderStyle"
                          value={w.containerStyle.borderStyle}
                          onChange={(borderStyle) =>
                            updateCellByPath(path, {
                              widget: {
                                ...w,
                                containerStyle: { ...defaultLayoutContainerStyle(), ...w.containerStyle, borderStyle },
                              },
                            })
                          }
                        />
                        <ColorField
                          label="borderColor"
                          value={w.containerStyle.borderColor}
                          onChange={(borderColor) =>
                            updateCellByPath(path, {
                              widget: {
                                ...w,
                                containerStyle: { ...defaultLayoutContainerStyle(), ...w.containerStyle, borderColor },
                              },
                            })
                          }
                        />
                        <TextField
                          label="boxShadow"
                          value={w.containerStyle.boxShadow}
                          onChange={(boxShadow) =>
                            updateCellByPath(path, {
                              widget: {
                                ...w,
                                containerStyle: { ...defaultLayoutContainerStyle(), ...w.containerStyle, boxShadow },
                              },
                            })
                          }
                        />
                      </div>
                      <p className="text-xs text-neutral-500">
                        Rediger rader og celler inne i denne boksen med «Åpne layout» på cellekortet til venstre.
                      </p>
                    </div>
                  ) : null}

                  {(w.kind === 'heading' || w.kind === 'text') && (
                    <div className="mt-4 border-t border-white/10 pt-3">
                      <p className="text-[10px] font-semibold uppercase text-neutral-500">Widget-typografi</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <TextField
                          label="fontFamily (tom = arv)"
                          value={w.style.fontFamily ?? ''}
                          onChange={(fontFamily) =>
                            updateCellByPath(path, {
                              widget: patchTextLikeWidgetStyle(w, {
                                fontFamily: fontFamily || undefined,
                              }),
                            })
                          }
                        />
                        <TextField
                          label="fontSize"
                          value={w.style.fontSize ?? ''}
                          onChange={(fontSize) =>
                            updateCellByPath(path, {
                              widget: patchTextLikeWidgetStyle(w, {
                                fontSize: fontSize || undefined,
                              }),
                            })
                          }
                        />
                        <SelectField
                          label="fontWeight"
                          value={w.style.fontWeight ?? '400'}
                          options={[
                            { value: '400', label: '400' },
                            { value: '500', label: '500' },
                            { value: '600', label: '600' },
                            { value: '700', label: '700' },
                          ]}
                          onChange={(fontWeight) =>
                            updateCellByPath(path, {
                              widget: patchTextLikeWidgetStyle(w, {
                                fontWeight: fontWeight as '400' | '500' | '600' | '700',
                              }),
                            })
                          }
                        />
                        <SelectField
                          label="fontStyle"
                          value={w.style.fontStyle ?? 'normal'}
                          options={[
                            { value: 'normal', label: 'Normal' },
                            { value: 'italic', label: 'Kursiv' },
                          ]}
                          onChange={(fontStyle) =>
                            updateCellByPath(path, {
                              widget: patchTextLikeWidgetStyle(w, {
                                fontStyle: fontStyle as 'normal' | 'italic',
                              }),
                            })
                          }
                        />
                        <SelectField
                          label="textDecoration"
                          value={w.style.textDecoration ?? 'none'}
                          options={[
                            { value: 'none', label: 'Ingen' },
                            { value: 'underline', label: 'Understrek' },
                            { value: 'line-through', label: 'Gjennomstreking' },
                          ]}
                          onChange={(textDecoration) =>
                            updateCellByPath(path, {
                              widget: patchTextLikeWidgetStyle(w, {
                                textDecoration: textDecoration as 'none' | 'underline' | 'line-through',
                              }),
                            })
                          }
                        />
                        <TextField
                          label="letterSpacing"
                          value={w.style.letterSpacing ?? ''}
                          onChange={(letterSpacing) =>
                            updateCellByPath(path, {
                              widget: patchTextLikeWidgetStyle(w, {
                                letterSpacing: letterSpacing || undefined,
                              }),
                            })
                          }
                        />
                        <ColorField
                          label="Farge (tom = arv)"
                          value={w.style.color ?? ''}
                          onChange={(color) =>
                            updateCellByPath(path, {
                              widget: patchTextLikeWidgetStyle(w, {
                                color: color || undefined,
                              }),
                            })
                          }
                        />
                        <TextField
                          label="lineHeight"
                          value={w.style.lineHeight ?? ''}
                          onChange={(lineHeight) =>
                            updateCellByPath(path, {
                              widget: patchTextLikeWidgetStyle(w, {
                                lineHeight: lineHeight || undefined,
                              }),
                            })
                          }
                        />
                        <SelectField
                          label="textAlign"
                          value={w.style.textAlign ?? 'left'}
                          options={[
                            { value: 'left', label: 'Venstre' },
                            { value: 'center', label: 'Senter' },
                            { value: 'right', label: 'Høyre' },
                          ]}
                          onChange={(textAlign) =>
                            updateCellByPath(path, {
                              widget: patchTextLikeWidgetStyle(w, {
                                textAlign: textAlign as 'left' | 'center' | 'right',
                              }),
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
                  )
                })()
              ) : null}
            </div>
          ) : (
            <p className="rounded-xl border border-white/10 bg-slate-900/30 p-4 text-sm text-neutral-500">
              Velg «Stil» på en celle for ramme, skygge og widget-detaljer (også i nestede layout).
            </p>
          )}

          <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Rå JSON</p>
            <pre className="mt-2 max-h-[min(280px,30vh)] overflow-auto rounded-lg bg-black/30 p-3 text-[10px] leading-relaxed text-emerald-100/90">
              {exportJson}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
