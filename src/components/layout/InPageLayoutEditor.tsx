import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import type {
  PageLayoutBlock,
  PageLayoutBlockDef,
  PageLayoutColumn,
  PageLayoutSection,
} from '../../types/pageLayout'
import { LIBRARY_BLOCK_DEFS } from './LayoutBlockLibrary'

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function cloneDeep<T>(val: T): T {
  return JSON.parse(JSON.stringify(val)) as T
}

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/* ── Small shared button styles ──────────────────────────────────────────── */

const BTN_GHOST =
  'flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors'
const BTN_PRIMARY =
  'flex items-center gap-1.5 rounded bg-[#1a3d32] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#14302700] hover:bg-[#1a3d32]/90 transition-colors'
const BTN_DANGER =
  'flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors'
const BTN_SECONDARY =
  'flex items-center gap-1.5 rounded border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors'
const INPUT =
  'w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-[#1a3d32]/25'

/* ── Icon helpers ─────────────────────────────────────────────────────────── */

function Icon({ d, size = 4 }: { d: string; size?: number }) {
  return (
    <svg className={`size-${size} shrink-0`} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d={d} />
    </svg>
  )
}

const ICONS = {
  grip: 'M5.5 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm-5 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm-5 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z',
  trash: 'M6 1a1 1 0 0 0-1 1H2v1h12V2h-3a1 1 0 0 0-1-1H6Zm-3 3v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4H3Z',
  plus: 'M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z',
  eye: 'M8 3C4.5 3 1.5 5.8 1.5 8S4.5 13 8 13s6.5-2.8 6.5-5-3-5-6.5-5Zm0 1.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm0 1.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  eyeOff: 'M2.22 1.22a.75.75 0 0 0-1.06 1.06l1.26 1.26A9.5 9.5 0 0 0 1.5 8C2.3 10.8 5 13 8 13c1.1 0 2.2-.3 3.16-.82l1.62 1.62a.75.75 0 1 0 1.06-1.06L2.22 1.22ZM8 4.5c.24 0 .47.02.7.06L4.56 8.7A3.5 3.5 0 0 1 8 4.5Zm5.26 1.14A6.5 6.5 0 0 1 14.5 8C13.7 10.8 11 13 8 13a5.7 5.7 0 0 1-1.56-.21l1.36-1.36A3.5 3.5 0 0 0 11.5 8a3.47 3.47 0 0 0-.86-2.3l2.62-2.06Z',
  chevUp: 'M4 10l4-4 4 4',
  chevDown: 'M4 6l4 4 4-4',
  cols: 'M2 3h5v10H2V3Zm7 0h5v10H9V3Z',
  edit: 'M11.7 1.3a1 1 0 0 1 1.4 1.4L4.4 11.4l-2.1.7.7-2.1 8.7-8.7Z',
  save: 'M3 2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6l-4-4H3Zm5 9.5L4.5 8 5.56 6.94l2.18 2.18 4.7-4.7 1.06 1.06L8 11.5Z',
  x: 'M3.22 3.22a.75.75 0 0 1 1.06 0L8 6.94l3.72-3.72a.75.75 0 1 1 1.06 1.06L9.06 8l3.72 3.72a.75.75 0 1 1-1.06 1.06L8 9.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06L6.94 8 3.22 4.28a.75.75 0 0 1 0-1.06Z',
  publish: 'M8 1L3 6h3v7h4V6h3L8 1Z',
  layout: 'M2 2h5v5H2V2Zm7 0h5v5H9V2Zm-7 7h5v5H2V9Zm7 0h5v5H9V9Z',
}

/* ── Types for editor selection ───────────────────────────────────────────── */

type EditorSelection =
  | { kind: 'section'; sectionId: string }
  | { kind: 'block'; sectionId: string; colId: string; blockId: string }
  | null

/* ── Block palette ─────────────────────────────────────────────────────────── */

type BlockPickerProps = {
  blockDefs: PageLayoutBlockDef[]
  onPick: (def: PageLayoutBlockDef) => void
  onClose: () => void
}

function BlockPicker({ blockDefs, onPick, onClose }: BlockPickerProps) {
  const [q, setQ] = useState('')
  const filtered = q
    ? blockDefs.filter(
        (d) =>
          d.label.toLowerCase().includes(q.toLowerCase()) ||
          d.id.toLowerCase().includes(q.toLowerCase()),
      )
    : blockDefs

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-neutral-900">Legg til blokk</p>
        <button type="button" className={BTN_GHOST} onClick={onClose}>
          <Icon d={ICONS.x} />
        </button>
      </div>
      <input
        autoFocus
        type="search"
        placeholder="Søk blokker…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className={INPUT}
      />
      <div className="max-h-52 space-y-1 overflow-y-auto">
        {filtered.map((d) => (
          <button
            key={d.id}
            type="button"
            className="flex w-full flex-col gap-0.5 rounded border border-neutral-200 bg-white px-3 py-2 text-left hover:border-[#1a3d32]/40 hover:bg-[#1a3d32]/5"
            onClick={() => onPick(d)}
          >
            <span className="text-xs font-semibold text-neutral-900">{d.label}</span>
            {d.description && (
              <span className="text-[11px] text-neutral-500">{d.description}</span>
            )}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="py-4 text-center text-xs text-neutral-400">Ingen blokker matcher søket</p>
        )}
      </div>
    </div>
  )
}

/* ── Inline text editor ────────────────────────────────────────────────────── */

type TextEditorProps = {
  keys: string[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}

function TextEditor({ keys, values, onChange }: TextEditorProps) {
  if (keys.length === 0) {
    return (
      <p className="text-xs text-neutral-400">
        Denne blokken har ingen redigerbare tekstfelter.
      </p>
    )
  }
  return (
    <div className="space-y-3">
      {keys.map((key) => (
        <div key={key} className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            {key}
          </label>
          <textarea
            rows={2}
            value={values[key] ?? ''}
            onChange={(e) => onChange(key, e.target.value)}
            className={INPUT + ' resize-y'}
          />
        </div>
      ))}
    </div>
  )
}

/* ── Drag state ────────────────────────────────────────────────────────────── */

type DragPayload = { sectionIdx: number; colIdx: number; blockIdx: number }

/* ── Main editor ───────────────────────────────────────────────────────────── */

export type InPageLayoutEditorProps = {
  /** Current sections to edit (shallow copy passed from parent). */
  sections: PageLayoutSection[]
  /** Available block catalogue. Extra defs are merged with LIBRARY_BLOCK_DEFS. */
  blockDefs?: PageLayoutBlockDef[]
  /** Is Supabase available? Controls "Publiser" button visibility. */
  hasDb: boolean
  /** Whether the current layout is already published. */
  isPublished: boolean
  /** Saving in progress. */
  saving: boolean
  /** Called when user clicks "Lagre" — passes the updated sections. */
  onSave: (sections: PageLayoutSection[]) => void
  /** Called when user clicks "Publiser". */
  onPublish: () => void
  /** Called when user clicks "Avpubliser". */
  onUnpublish: () => void
  /** Close the editor drawer. */
  onClose: () => void
}

export function InPageLayoutEditor({
  sections: initialSections,
  blockDefs: extraDefs = [],
  hasDb,
  isPublished,
  saving,
  onSave,
  onPublish,
  onUnpublish,
  onClose,
}: InPageLayoutEditorProps) {
  // Merge library defs with page-specific extra defs (extras take priority)
  const extraIds = new Set(extraDefs.map((d) => d.id))
  const blockDefs: PageLayoutBlockDef[] = [
    ...LIBRARY_BLOCK_DEFS.filter((d) => !extraIds.has(d.id)),
    ...extraDefs,
  ]

  const [sections, setSections] = useState<PageLayoutSection[]>(() =>
    cloneDeep(initialSections),
  )
  const [selection, setSelection] = useState<EditorSelection>(null)
  const [showBlockPicker, setShowBlockPicker] = useState<{
    sectionId: string
    colId: string
  } | null>(null)
  const [dirty, setDirty] = useState(false)
  const dragRef = useRef<DragPayload | null>(null)

  // Keep in sync when parent reloads from DB.
  useEffect(() => {
    setSections(cloneDeep(initialSections))
    setDirty(false)
  }, [initialSections])

  const mutate = useCallback((fn: (draft: PageLayoutSection[]) => PageLayoutSection[]) => {
    setSections((prev) => fn(cloneDeep(prev)))
    setDirty(true)
  }, [])

  /* ── Section operations ─────────────────────────────────────────────────── */

  const addSection = useCallback((colCount: 1 | 2 | 3) => {
    const spanMap: Record<1 | 2 | 3, number[]> = { 1: [12], 2: [8, 4], 3: [4, 4, 4] }
    const spans = spanMap[colCount]
    mutate((draft) => [
      ...draft,
      {
        id: uid(),
        label: `Seksjon ${draft.length + 1}`,
        cols: spans.map((span) => ({ id: uid(), colSpan: span, blocks: [] })),
      },
    ])
  }, [mutate])

  const removeSection = useCallback((sectionId: string) => {
    mutate((draft) => draft.filter((s) => s.id !== sectionId))
    setSelection(null)
  }, [mutate])

  const moveSectionUp = useCallback((idx: number) => {
    if (idx === 0) return
    mutate((draft) => moveItem(draft, idx, idx - 1))
  }, [mutate])

  const moveSectionDown = useCallback((idx: number, total: number) => {
    if (idx >= total - 1) return
    mutate((draft) => moveItem(draft, idx, idx + 1))
  }, [mutate])

  const updateSectionLabel = useCallback((sectionId: string, label: string) => {
    mutate((draft) =>
      draft.map((s) => (s.id === sectionId ? { ...s, label } : s)),
    )
  }, [mutate])

  /* ── Column operations ──────────────────────────────────────────────────── */

  const updateColSpan = useCallback((sectionId: string, colId: string, span: number) => {
    mutate((draft) =>
      draft.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              cols: s.cols.map((c) => (c.id === colId ? { ...c, colSpan: Math.max(1, Math.min(12, span)) } : c)),
            }
          : s,
      ),
    )
  }, [mutate])

  const addColumn = useCallback((sectionId: string) => {
    mutate((draft) =>
      draft.map((s) =>
        s.id === sectionId
          ? { ...s, cols: [...s.cols, { id: uid(), colSpan: 4, blocks: [] }] }
          : s,
      ),
    )
  }, [mutate])

  const removeColumn = useCallback((sectionId: string, colId: string) => {
    mutate((draft) =>
      draft.map((s) =>
        s.id === sectionId
          ? { ...s, cols: s.cols.filter((c) => c.id !== colId) }
          : s,
      ),
    )
  }, [mutate])

  /* ── Block operations ───────────────────────────────────────────────────── */

  const addBlock = useCallback((sectionId: string, colId: string, def: PageLayoutBlockDef) => {
    // Initialise default blockProps for blocks that need them
    const defaultProps: Record<string, unknown> = {}
    if (def.id === 'kpiInfoBoxes') defaultProps.boxCount = 3
    if (def.id === 'infoCard') defaultProps.variant = 'neutral'

    const block: PageLayoutBlock = {
      id: uid(),
      blockId: def.id,
      visible: true,
      textOverride: {},
      blockProps: Object.keys(defaultProps).length > 0 ? defaultProps : undefined,
    }
    mutate((draft) =>
      draft.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              cols: s.cols.map((c) =>
                c.id === colId ? { ...c, blocks: [...c.blocks, block] } : c,
              ),
            }
          : s,
      ),
    )
    setShowBlockPicker(null)
  }, [mutate])

  const removeBlock = useCallback((sectionId: string, colId: string, blockId: string) => {
    mutate((draft) =>
      draft.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              cols: s.cols.map((c) =>
                c.id === colId ? { ...c, blocks: c.blocks.filter((b) => b.id !== blockId) } : c,
              ),
            }
          : s,
      ),
    )
    setSelection(null)
  }, [mutate])

  const toggleBlockVisible = useCallback((sectionId: string, colId: string, blockId: string) => {
    mutate((draft) =>
      draft.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              cols: s.cols.map((c) =>
                c.id === colId
                  ? {
                      ...c,
                      blocks: c.blocks.map((b) =>
                        b.id === blockId ? { ...b, visible: b.visible === false ? true : false } : b,
                      ),
                    }
                  : c,
              ),
            }
          : s,
      ),
    )
  }, [mutate])

  const updateBlockText = useCallback((
    sectionId: string,
    colId: string,
    blockId: string,
    key: string,
    value: string,
  ) => {
    mutate((draft) =>
      draft.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              cols: s.cols.map((c) =>
                c.id === colId
                  ? {
                      ...c,
                      blocks: c.blocks.map((b) =>
                        b.id === blockId
                          ? { ...b, textOverride: { ...(b.textOverride ?? {}), [key]: value } }
                          : b,
                      ),
                    }
                  : c,
              ),
            }
          : s,
      ),
    )
  }, [mutate])

  const updateBlockProp = useCallback((
    sectionId: string,
    colId: string,
    blockId: string,
    key: string,
    value: unknown,
  ) => {
    mutate((draft) =>
      draft.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              cols: s.cols.map((c) =>
                c.id === colId
                  ? {
                      ...c,
                      blocks: c.blocks.map((b) =>
                        b.id === blockId
                          ? { ...b, blockProps: { ...(b.blockProps ?? {}), [key]: value } }
                          : b,
                      ),
                    }
                  : c,
              ),
            }
          : s,
      ),
    )
  }, [mutate])

  const moveBlock = useCallback((
    sectionId: string,
    colId: string,
    fromIdx: number,
    toIdx: number,
  ) => {
    mutate((draft) =>
      draft.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              cols: s.cols.map((c) =>
                c.id === colId ? { ...c, blocks: moveItem(c.blocks, fromIdx, toIdx) } : c,
              ),
            }
          : s,
      ),
    )
  }, [mutate])

  /* ── Drag and drop ──────────────────────────────────────────────────────── */

  function handleDragStart(e: DragEvent, payload: DragPayload) {
    dragRef.current = payload
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(e: DragEvent, target: DragPayload) {
    e.preventDefault()
    const src = dragRef.current
    if (!src) return
    if (src.sectionIdx !== target.sectionIdx || src.colIdx !== target.colIdx) return
    if (src.blockIdx === target.blockIdx) return

    const sectionId = sections[src.sectionIdx]?.id
    const colId = sections[src.sectionIdx]?.cols[src.colIdx]?.id
    if (!sectionId || !colId) return
    moveBlock(sectionId, colId, src.blockIdx, target.blockIdx)
    dragRef.current = null
  }

  /* ── Helpers for detail panel ───────────────────────────────────────────── */

  function resolveSelection(): {
    section: PageLayoutSection | null
    sectionIdx: number
    col: PageLayoutColumn | null
    block: PageLayoutBlock | null
    def: PageLayoutBlockDef | null
  } {
    if (!selection) return { section: null, sectionIdx: -1, col: null, block: null, def: null }
    const sectionIdx = sections.findIndex((s) => s.id === selection.sectionId)
    const section = sections[sectionIdx] ?? null
    if (selection.kind === 'section') return { section, sectionIdx, col: null, block: null, def: null }
    const col = section?.cols.find((c) => c.id === selection.colId) ?? null
    const block = col?.blocks.find((b) => b.id === selection.blockId) ?? null
    const def = block ? (blockDefs.find((d) => d.id === block.blockId) ?? null) : null
    return { section, sectionIdx, col, block, def }
  }

  const sel = resolveSelection()

  /* ── Render ─────────────────────────────────────────────────────────────── */

  return (
    <div className="flex h-full flex-col" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200/90 bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <Icon d={ICONS.layout} />
          Layout-editor
        </div>
        <div className="flex items-center gap-2">
          {hasDb && (
            isPublished ? (
              <button type="button" className={BTN_SECONDARY} onClick={onUnpublish}>
                Avpubliser
              </button>
            ) : (
              <button type="button" className={BTN_SECONDARY} onClick={onPublish} disabled={dirty}>
                <Icon d={ICONS.publish} />
                {dirty ? 'Lagre først' : 'Publiser'}
              </button>
            )
          )}
          <button
            type="button"
            disabled={!dirty || saving}
            className={BTN_PRIMARY + ' disabled:opacity-50'}
            onClick={() => onSave(sections)}
          >
            <Icon d={ICONS.save} />
            {saving ? 'Lagrer…' : 'Lagre'}
          </button>
          <button type="button" className={BTN_GHOST} onClick={onClose} aria-label="Lukk">
            <Icon d={ICONS.x} />
          </button>
        </div>
      </header>

      {/* Two-pane: section tree (left) + detail (right) */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* Left: section/block tree ─────────────────────────────────────────── */}
        <div className="flex w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-neutral-200/90 bg-neutral-50/80 p-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Seksjoner
          </p>
          {sections.map((section, sectionIdx) => (
            <div key={section.id} className="space-y-0.5">
              {/* Section row */}
              <div
                className={`flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-xs font-semibold ${
                  selection?.sectionId === section.id && selection.kind === 'section'
                    ? 'bg-[#1a3d32]/10 text-[#1a3d32]'
                    : 'text-neutral-700 hover:bg-neutral-200/60'
                }`}
                onClick={() => setSelection({ kind: 'section', sectionId: section.id })}
              >
                <span className="min-w-0 truncate">{section.label || `S${sectionIdx + 1}`}</span>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    className="rounded p-0.5 hover:bg-black/10"
                    onClick={(e) => { e.stopPropagation(); moveSectionUp(sectionIdx) }}
                    title="Flytt opp"
                  >
                    <Icon d={ICONS.chevUp} size={3} />
                  </button>
                  <button
                    type="button"
                    className="rounded p-0.5 hover:bg-black/10"
                    onClick={(e) => { e.stopPropagation(); moveSectionDown(sectionIdx, sections.length) }}
                    title="Flytt ned"
                  >
                    <Icon d={ICONS.chevDown} size={3} />
                  </button>
                </div>
              </div>

              {/* Block rows under section */}
              {section.cols.map((col, colIdx) =>
                col.blocks.map((block, blockIdx) => (
                  <div
                    key={block.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, { sectionIdx, colIdx, blockIdx })}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, { sectionIdx, colIdx, blockIdx })}
                    className={`flex cursor-pointer items-center gap-2 rounded py-1 pl-5 pr-2 text-[11px] ${
                      selection?.kind === 'block' && selection.blockId === block.id
                        ? 'bg-[#1a3d32]/10 text-[#1a3d32]'
                        : block.visible === false
                          ? 'text-neutral-400 line-through'
                          : 'text-neutral-600 hover:bg-neutral-200/40'
                    }`}
                    onClick={() =>
                      setSelection({
                        kind: 'block',
                        sectionId: section.id,
                        colId: col.id,
                        blockId: block.id,
                      })
                    }
                  >
                    <Icon d={ICONS.grip} size={3} />
                    <span className="min-w-0 flex-1 truncate">
                      {blockDefs.find((d) => d.id === block.blockId)?.label ?? block.blockId}
                    </span>
                    {block.visible === false && (
                      <Icon d={ICONS.eyeOff} size={3} />
                    )}
                  </div>
                )),
              )}

              {/* Add block buttons per column */}
              {section.cols.map((col) => (
                <button
                  key={`add-${col.id}`}
                  type="button"
                  className="flex w-full items-center gap-1 rounded px-2 py-1 pl-5 text-[11px] text-neutral-400 hover:bg-neutral-200/40 hover:text-[#1a3d32]"
                  onClick={() => {
                    setShowBlockPicker({ sectionId: section.id, colId: col.id })
                    setSelection(null)
                  }}
                >
                  <Icon d={ICONS.plus} size={3} />
                  Legg til blokk
                </button>
              ))}
            </div>
          ))}

          {/* Add section buttons */}
          <div className="mt-3 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Ny seksjon
            </p>
            {([1, 2, 3] as const).map((n) => (
              <button
                key={n}
                type="button"
                className={BTN_GHOST + ' w-full justify-start text-[11px]'}
                onClick={() => addSection(n)}
              >
                <Icon d={ICONS.layout} size={3} />
                {n === 1 ? '1 kolonne' : n === 2 ? '2 kolonner (8/4)' : '3 kolonner (4/4/4)'}
              </button>
            ))}
          </div>
        </div>

        {/* Right: detail panel ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Block picker overlay */}
          {showBlockPicker && (
            <BlockPicker
              blockDefs={blockDefs}
              onPick={(def) => {
                addBlock(showBlockPicker.sectionId, showBlockPicker.colId, def)
                setShowBlockPicker(null)
              }}
              onClose={() => setShowBlockPicker(null)}
            />
          )}

          {/* Selection: nothing */}
          {!selection && !showBlockPicker && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-sm text-neutral-400">
              <Icon d={ICONS.layout} size={8} />
              <p>Klikk en seksjon eller blokk i listen til venstre for å redigere den.</p>
              <p className="text-xs">Dra blokker for å endre rekkefølge.</p>
            </div>
          )}

          {/* Selection: section */}
          {selection?.kind === 'section' && sel.section && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-neutral-900">Seksjon</p>
                <button
                  type="button"
                  className={BTN_DANGER}
                  onClick={() => removeSection(sel.section!.id)}
                >
                  <Icon d={ICONS.trash} />
                  Slett seksjon
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Navn (intern label)
                </label>
                <input
                  type="text"
                  value={sel.section.label ?? ''}
                  onChange={(e) => updateSectionLabel(sel.section!.id, e.target.value)}
                  className={INPUT}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    Kolonner ({sel.section.cols.length})
                  </p>
                  {sel.section.cols.length < 4 && (
                    <button
                      type="button"
                      className={BTN_GHOST}
                      onClick={() => addColumn(sel.section!.id)}
                    >
                      <Icon d={ICONS.plus} />
                      Legg til
                    </button>
                  )}
                </div>

                {sel.section.cols.map((col, ci) => (
                  <div key={col.id} className="flex items-center gap-2 rounded border border-neutral-200 bg-white px-3 py-2">
                    <Icon d={ICONS.cols} size={3} />
                    <span className="flex-1 text-xs text-neutral-700">Kolonne {ci + 1}</span>
                    <label className="flex items-center gap-1 text-[11px] text-neutral-500">
                      Bredde
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={col.colSpan}
                        onChange={(e) => updateColSpan(sel.section!.id, col.id, parseInt(e.target.value, 10))}
                        className="w-12 rounded border border-neutral-200 px-1 py-0.5 text-xs text-center"
                      />
                      <span>/12</span>
                    </label>
                    {sel.section!.cols.length > 1 && (
                      <button
                        type="button"
                        className="rounded p-0.5 text-red-400 hover:bg-red-50"
                        onClick={() => removeColumn(sel.section!.id, col.id)}
                        title="Fjern kolonne"
                      >
                        <Icon d={ICONS.trash} size={3} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selection: block */}
          {selection?.kind === 'block' && sel.block && sel.col && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-neutral-900">
                  {sel.def?.label ?? sel.block.blockId}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={BTN_GHOST}
                    title={sel.block.visible === false ? 'Vis' : 'Skjul'}
                    onClick={() =>
                      toggleBlockVisible(selection.sectionId, selection.colId, selection.blockId)
                    }
                  >
                    <Icon d={sel.block.visible === false ? ICONS.eye : ICONS.eyeOff} />
                    {sel.block.visible === false ? 'Vis' : 'Skjul'}
                  </button>
                  <button
                    type="button"
                    className={BTN_DANGER}
                    onClick={() =>
                      removeBlock(selection.sectionId, selection.colId, selection.blockId)
                    }
                  >
                    <Icon d={ICONS.trash} />
                    Slett
                  </button>
                </div>
              </div>

              {sel.def?.description && (
                <p className="text-xs text-neutral-500">{sel.def.description}</p>
              )}

              {/* Block-level props — e.g. box count for kpiInfoBoxes, variant for infoCard */}
              {sel.block.blockId === 'kpiInfoBoxes' && (
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Antall bokser</p>
                  <select
                    value={Number(sel.block.blockProps?.boxCount ?? 3)}
                    onChange={(e) =>
                      updateBlockProp(selection.sectionId, selection.colId, selection.blockId, 'boxCount', Number(e.target.value))
                    }
                    className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-[#1a3d32]/25"
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>{n} {n === 1 ? 'boks' : 'bokser'}</option>
                    ))}
                  </select>
                </div>
              )}

              {sel.block.blockId === 'infoCard' && (
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Variant</p>
                  <select
                    value={String(sel.block.blockProps?.variant ?? 'neutral')}
                    onChange={(e) =>
                      updateBlockProp(selection.sectionId, selection.colId, selection.blockId, 'variant', e.target.value)
                    }
                    className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-[#1a3d32]/25"
                  >
                    <option value="neutral">Nøytral (hvit)</option>
                    <option value="info">Info (blå)</option>
                    <option value="warning">Advarsel (gul)</option>
                    <option value="success">Suksess (grønn)</option>
                  </select>
                </div>
              )}

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Tekstinnhold
                </p>
                <TextEditor
                  keys={sel.def?.editableTextKeys ?? []}
                  values={sel.block.textOverride ?? {}}
                  onChange={(key, value) =>
                    updateBlockText(selection.sectionId, selection.colId, selection.blockId, key, value)
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
