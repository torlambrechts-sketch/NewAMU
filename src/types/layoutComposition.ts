/** Page / section layout builder — rows of cells; each cell is a widget or a saved component design. */

export const LAYOUT_COMPOSITION_VERSION = 3 as const
export const LAYOUT_COMPOSITION_VERSION_LEGACY = 1 as const
export const LAYOUT_COMPOSITION_VERSION_2 = 2 as const

export type LayoutSlotSpan = 'full' | 'half' | 'third' | 'auto'

export type TextWidgetAlign = 'left' | 'center' | 'right'

/** Inline typography for a single widget (overrides page defaults). */
export type LayoutWidgetTextStyle = {
  fontFamily: string
  fontSize: string
  fontWeight: '400' | '500' | '600' | '700'
  fontStyle: 'normal' | 'italic'
  textDecoration: 'none' | 'underline' | 'line-through'
  color: string
  lineHeight: string
  letterSpacing: string
  textAlign: TextWidgetAlign
}

export const DEFAULT_WIDGET_TEXT_STYLE: LayoutWidgetTextStyle = {
  fontFamily: 'inherit',
  fontSize: '1rem',
  fontWeight: '400',
  fontStyle: 'normal',
  textDecoration: 'none',
  color: '#171717',
  lineHeight: '1.5',
  letterSpacing: '0',
  textAlign: 'left',
}

export type LayoutWidgetPayload =
  | {
      kind: 'heading'
      text: string
      level: 1 | 2 | 3 | 4
      style: Partial<LayoutWidgetTextStyle>
    }
  | {
      kind: 'text'
      text: string
      style: Partial<LayoutWidgetTextStyle>
    }
  | { kind: 'spacer'; height: string }
  | { kind: 'divider'; color: string; thickness: string }
  | {
      kind: 'image'
      src: string
      alt: string
      objectFit: 'cover' | 'contain'
      borderRadius: string
      maxHeight: string
      width: string
    }
  | {
      kind: 'button'
      label: string
      href: string
      backgroundColor: string
      textColor: string
      fontSize: string
      fontWeight: '400' | '500' | '600' | '700'
      borderRadius: string
      padding: string
      borderWidth: string
      borderStyle: string
      borderColor: string
      boxShadow: string
    }
  | {
      kind: 'layout'
      /** Nested rows (same structure as page-level rows). */
      rows: LayoutCompositionRow[]
      /** Visual box around the inner grid. */
      containerStyle: {
        padding: string
        gap: string
        backgroundColor: string
        borderRadius: string
        borderWidth: string
        borderStyle: string
        borderColor: string
        boxShadow: string
      }
    }

export type LayoutCompositionSlot = {
  id: string
  /** Editor label */
  label: string
  /** Use saved Komponentdesigner, or built-in widget */
  mode: 'component' | 'widget'
  /** `platform_box_designs.reference_key` */
  componentReferenceKey: string | null
  widget: LayoutWidgetPayload | null
  span: LayoutSlotSpan
  align: 'stretch' | 'start' | 'center' | 'end'
  /** Optional box around this cell */
  slotStyle?: {
    backgroundColor: string
    padding: string
    borderRadius: string
    borderWidth: string
    borderStyle: string
    borderColor: string
    boxShadow: string
  }
}

/** `equal`: columns share width by count (responsive grid). `fixed`: use 12-col + span. */
export type LayoutRowColumnMode = 'fixed' | 'equal'

export type LayoutCompositionRowStyle = {
  backgroundColor: string
  padding: string
  borderRadius: string
  borderWidth: string
  borderStyle: string
  borderColor: string
  boxShadow: string
  marginTop: string
  marginBottom: string
}

export type LayoutCompositionRow = {
  id: string
  gap: string
  alignItems: 'stretch' | 'start' | 'center' | 'end'
  /** How columns divide horizontal space. */
  columnMode: LayoutRowColumnMode
  rowStyle: LayoutCompositionRowStyle
  cells: LayoutCompositionSlot[]
}

export type LayoutCompositionTypography = {
  fontFamily: string
  headingFontFamily: string
  baseFontSize: string
  textColor: string
  headingColor: string
}

export type LayoutCompositionPayload = {
  version: typeof LAYOUT_COMPOSITION_VERSION
  metadata: {
    name: string
    description: string
  }
  typography: LayoutCompositionTypography
  canvas: {
    maxWidth: string
    padding: string
    gap: string
    backgroundColor: string
    backgroundGradient: string
    minHeight: string
    borderRadius: string
    borderWidth: string
    borderStyle: string
    borderColor: string
  }
  /** Horizontal rows; each row is a flex row of cells (boxes/widgets). */
  rows: LayoutCompositionRow[]
}

export type LayoutPathSegment = { rowId: string; cellId: string }

/** Legacy flat slots (v1) — migrated to a single row on load. */
type LegacyLayoutPayload = {
  version?: typeof LAYOUT_COMPOSITION_VERSION_LEGACY | typeof LAYOUT_COMPOSITION_VERSION_2
  metadata?: LayoutCompositionPayload['metadata']
  canvas?: Partial<LayoutCompositionPayload['canvas']>
  slots?: LegacySlot[]
}

type LegacySlot = Omit<LayoutCompositionSlot, 'mode' | 'widget'> & {
  mode?: 'component' | 'widget'
  widget?: LayoutWidgetPayload | null
}

export function defaultRowStyle(): LayoutCompositionRowStyle {
  return {
    backgroundColor: 'transparent',
    padding: '0',
    borderRadius: '0',
    borderWidth: '0',
    borderStyle: 'solid',
    borderColor: 'transparent',
    boxShadow: 'none',
    marginTop: '0',
    marginBottom: '0',
  }
}

export const DEFAULT_LAYOUT_COMPOSITION: LayoutCompositionPayload = {
  version: LAYOUT_COMPOSITION_VERSION,
  metadata: {
    name: 'Ny side-mal',
    description: 'Dra rader og celler, velg widget eller lagret komponent. Lagre som mal for gjenbruk.',
  },
  typography: {
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    headingFontFamily: 'ui-sans-serif, system-ui, sans-serif',
    baseFontSize: '16px',
    textColor: '#262626',
    headingColor: '#171717',
  },
  canvas: {
    maxWidth: '1200px',
    padding: '24px',
    gap: '16px',
    backgroundColor: '#f5f0e8',
    backgroundGradient: '',
    minHeight: '400px',
    borderRadius: '16px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(0,0,0,0.08)',
  },
  rows: [],
}

export function newSlotId(): string {
  return `slot-${crypto.randomUUID().slice(0, 8)}`
}

export function newRowId(): string {
  return `row-${crypto.randomUUID().slice(0, 8)}`
}

export function defaultSlotStyle(): NonNullable<LayoutCompositionSlot['slotStyle']> {
  return {
    backgroundColor: 'transparent',
    padding: '0',
    borderRadius: '0',
    borderWidth: '0',
    borderStyle: 'solid',
    borderColor: 'transparent',
    boxShadow: 'none',
  }
}

export type LayoutWidgetContainerStyle = Extract<LayoutWidgetPayload, { kind: 'layout' }>['containerStyle']

export function defaultLayoutContainerStyle(): LayoutWidgetContainerStyle {
  return {
    padding: '12px',
    gap: '12px',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: '8px',
    borderWidth: '1px',
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.12)',
    boxShadow: 'none',
  }
}

export function emptyWidget(kind: LayoutWidgetPayload['kind']): LayoutWidgetPayload {
  switch (kind) {
    case 'heading':
      return { kind: 'heading', text: 'Overskrift', level: 2, style: {} }
    case 'text':
      return { kind: 'text', text: 'Brødtekst…', style: {} }
    case 'spacer':
      return { kind: 'spacer', height: '24px' }
    case 'divider':
      return { kind: 'divider', color: 'rgba(0,0,0,0.12)', thickness: '1px' }
    case 'image':
      return {
        kind: 'image',
        src: 'https://picsum.photos/seed/layout/800/400',
        alt: '',
        objectFit: 'cover',
        borderRadius: '8px',
        maxHeight: '12rem',
        width: '100%',
      }
    case 'button':
      return {
        kind: 'button',
        label: 'Knapp',
        href: '#',
        backgroundColor: '#1a3d32',
        textColor: '#ffffff',
        fontSize: '0.875rem',
        fontWeight: '600',
        borderRadius: '8px',
        padding: '8px 16px',
        borderWidth: '0',
        borderStyle: 'solid',
        borderColor: 'transparent',
        boxShadow: 'none',
      }
    case 'layout':
      return {
        kind: 'layout',
        rows: [
          newRow([newCell({ label: 'Kolonne 1', span: 'auto' }), newCell({ label: 'Kolonne 2', span: 'auto' })]),
        ],
        containerStyle: defaultLayoutContainerStyle(),
      }
    default:
      return { kind: 'text', text: '', style: {} }
  }
}

export function newCell(partial?: Partial<LayoutCompositionSlot>): LayoutCompositionSlot {
  return {
    id: newSlotId(),
    label: partial?.label ?? 'Celle',
    mode: partial?.mode ?? 'widget',
    componentReferenceKey: partial?.componentReferenceKey ?? null,
    widget: partial?.widget ?? emptyWidget('text'),
    span: partial?.span ?? 'full',
    align: partial?.align ?? 'stretch',
    slotStyle: partial?.slotStyle ?? defaultSlotStyle(),
  }
}

export function newRow(cells?: LayoutCompositionSlot[], opts?: { columnMode?: LayoutRowColumnMode }): LayoutCompositionRow {
  const columnMode = opts?.columnMode ?? 'fixed'
  const defaultSpan: LayoutSlotSpan = columnMode === 'equal' ? 'auto' : 'full'
  const list =
    cells?.length ?
      cells
    : [newCell({ label: 'Celle 1', span: defaultSpan })]
  return {
    id: newRowId(),
    gap: '16px',
    alignItems: 'stretch',
    columnMode,
    rowStyle: defaultRowStyle(),
    cells: list,
  }
}

function isObj(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x)
}

function migrateLegacySlot(s: LegacySlot): LayoutCompositionSlot {
  const hasComp = Boolean(s.componentReferenceKey)
  const mode: 'component' | 'widget' = s.mode ?? (hasComp ? 'component' : 'widget')
  const baseStyle = { ...defaultSlotStyle(), ...(s.slotStyle as Record<string, unknown> | undefined) }
  return {
    id: s.id || newSlotId(),
    label: s.label || 'Celle',
    mode,
    componentReferenceKey: s.componentReferenceKey ?? null,
    widget: s.widget ?? (mode === 'widget' ? emptyWidget('text') : null),
    span: (s.span as LayoutSlotSpan | undefined) ?? 'full',
    align: s.align ?? 'stretch',
    slotStyle: baseStyle as NonNullable<LayoutCompositionSlot['slotStyle']>,
  }
}

function normalizeWidgetDeep(w: LayoutWidgetPayload | null, defaultGap: string): LayoutWidgetPayload | null {
  if (!w) return null
  if (w.kind === 'button') {
    const b = w as Extract<LayoutWidgetPayload, { kind: 'button' }>
    return {
      ...b,
      fontSize: b.fontSize ?? '0.875rem',
      borderRadius: b.borderRadius ?? '8px',
      padding: b.padding ?? '8px 16px',
      borderWidth: b.borderWidth ?? '0',
      borderStyle: b.borderStyle ?? 'solid',
      borderColor: b.borderColor ?? 'transparent',
      boxShadow: b.boxShadow ?? 'none',
    }
  }
  if (w.kind === 'layout') {
    const L = w as Extract<LayoutWidgetPayload, { kind: 'layout' }>
    return {
      ...L,
      rows: L.rows.map((r) => normalizeRow(r, defaultGap)),
      containerStyle: { ...defaultLayoutContainerStyle(), ...L.containerStyle },
    }
  }
  if (w.kind === 'image') {
    const im = w as Extract<LayoutWidgetPayload, { kind: 'image' }>
    return {
      ...im,
      borderRadius: im.borderRadius ?? '8px',
      maxHeight: im.maxHeight ?? '12rem',
      width: im.width ?? '100%',
    }
  }
  return w
}

function deepMergeLayout<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const out = { ...target } as Record<string, unknown>
  for (const k of Object.keys(source)) {
    const sv = (source as Record<string, unknown>)[k]
    const tv = out[k]
    if (sv === undefined) continue
    if ((k === 'rows' || k === 'slots') && Array.isArray(sv)) {
      out[k] = sv
      continue
    }
    if (isObj(sv) && isObj(tv)) {
      out[k] = deepMergeLayout(tv as Record<string, unknown>, sv as Record<string, unknown>)
    } else {
      out[k] = sv
    }
  }
  return out as T
}

function normalizeCell(c: LegacySlot | LayoutCompositionSlot, defaultGap: string): LayoutCompositionSlot {
  const m = migrateLegacySlot(c as LegacySlot)
  const mode =
    (c as LayoutCompositionSlot).mode ??
    (m.componentReferenceKey ? 'component' : 'widget')
  let widget =
    (c as LayoutCompositionSlot).widget ??
    (mode === 'component' ? null : emptyWidget('text'))
  widget = normalizeWidgetDeep(widget, defaultGap)
  const slotStyle = { ...defaultSlotStyle(), ...m.slotStyle, ...(c as LayoutCompositionSlot).slotStyle }
  return {
    ...m,
    mode,
    widget,
    slotStyle,
  }
}

function normalizeRow(r: Partial<LayoutCompositionRow>, defaultGap: string): LayoutCompositionRow {
  const columnMode = r.columnMode ?? 'fixed'
  const rowStyle = { ...defaultRowStyle(), ...(r.rowStyle ?? {}) }
  const cells = (r.cells ?? []).map((c) => normalizeCell(c as LegacySlot, defaultGap))
  const normalizedCells =
    columnMode === 'equal' ?
      cells.map((cell) => (cell.span === 'full' || cell.span === 'half' || cell.span === 'third' ? { ...cell, span: 'auto' as const } : cell))
    : cells
  return {
    id: r.id || newRowId(),
    gap: r.gap ?? defaultGap,
    alignItems: r.alignItems ?? 'stretch',
    columnMode,
    rowStyle,
    cells: normalizedCells.length ? normalizedCells : [newCell({ label: 'Celle 1', span: columnMode === 'equal' ? 'auto' : 'full' })],
  }
}

/**
 * Normalize any saved payload to current shape (migrates v1 `slots` → one `row`; v2 → v3).
 */
export function mergeLayoutComposition(partial: Partial<LayoutCompositionPayload> | Record<string, unknown>): LayoutCompositionPayload {
  const raw = partial as LegacyLayoutPayload & Partial<LayoutCompositionPayload>
  const base = structuredClone(DEFAULT_LAYOUT_COMPOSITION)

  const canvas = deepMergeLayout(
    base.canvas as unknown as Record<string, unknown>,
    (raw.canvas ?? {}) as Record<string, unknown>,
  ) as LayoutCompositionPayload['canvas']

  const metadata = {
    ...base.metadata,
    ...(raw.metadata ?? {}),
  }

  const typography = {
    ...base.typography,
    ...(raw.typography ?? {}),
  }

  let rows: LayoutCompositionRow[] = []
  if (Array.isArray(raw.rows) && raw.rows.length > 0) {
    rows = (raw.rows as LayoutCompositionRow[]).map((r) => normalizeRow(r, canvas.gap))
  } else if (Array.isArray(raw.slots) && raw.slots.length > 0) {
    rows = [
      normalizeRow(
        {
          id: newRowId(),
          gap: canvas.gap,
          cells: (raw.slots as LegacySlot[]).map((c) => normalizeCell(c, canvas.gap)),
        },
        canvas.gap,
      ),
    ]
  } else {
    rows = [newRow()]
  }

  if (rows.length === 0) rows = [newRow()]

  return {
    version: LAYOUT_COMPOSITION_VERSION,
    metadata,
    typography,
    canvas,
    rows,
  }
}

export function cloneLayoutComposition(overrides?: Partial<LayoutCompositionPayload>): LayoutCompositionPayload {
  return mergeLayoutComposition(overrides ?? {})
}

/** Oppdater tekst/overskrift-widget stil uten å miste kind-narrowing. */
export function patchTextLikeWidgetStyle(
  w: LayoutWidgetPayload,
  patch: Partial<LayoutWidgetTextStyle>,
): LayoutWidgetPayload {
  if (w.kind === 'heading') return { ...w, style: { ...w.style, ...patch } }
  if (w.kind === 'text') return { ...w, style: { ...w.style, ...patch } }
  return w
}

/** Rows edited in the designer for the current context (`path` = parent layout cell chain; empty = root). */
export function getEditableRows(rows: LayoutCompositionRow[], editorContextPath: LayoutPathSegment[]): LayoutCompositionRow[] {
  if (editorContextPath.length === 0) return rows
  const cell = getCellAtPath(rows, editorContextPath)
  if (!cell?.widget || cell.widget.kind !== 'layout') return rows
  return cell.widget.rows
}

export function getCellAtPath(rows: LayoutCompositionRow[], path: LayoutPathSegment[]): LayoutCompositionSlot | null {
  if (path.length === 0) return null
  let list = rows
  for (let i = 0; i < path.length; i++) {
    const seg = path[i]
    const row = list.find((r) => r.id === seg.rowId)
    if (!row) return null
    const cell = row.cells.find((c) => c.id === seg.cellId)
    if (!cell) return null
    if (i === path.length - 1) return cell
    if (cell.mode !== 'widget' || !cell.widget || cell.widget.kind !== 'layout') return null
    list = cell.widget.rows
  }
  return null
}

export function updateCellAtPath(
  rows: LayoutCompositionRow[],
  path: LayoutPathSegment[],
  patch: Partial<LayoutCompositionSlot>,
): LayoutCompositionRow[] {
  if (path.length === 0) return rows
  const [head, ...rest] = path
  return rows.map((row) => {
    if (row.id !== head.rowId) return row
    if (rest.length === 0) {
      return {
        ...row,
        cells: row.cells.map((c) => (c.id === head.cellId ? { ...c, ...patch } : c)),
      }
    }
    return {
      ...row,
      cells: row.cells.map((c) => {
        if (c.id !== head.cellId) return c
        if (c.mode !== 'widget' || !c.widget || c.widget.kind !== 'layout') return c
        return {
          ...c,
          widget: {
            ...c.widget,
            rows: updateCellAtPath(c.widget.rows, rest, patch),
          },
        }
      }),
    }
  })
}

export function updateWidgetAtPath(
  rows: LayoutCompositionRow[],
  path: LayoutPathSegment[],
  widget: LayoutWidgetPayload,
): LayoutCompositionRow[] {
  return updateCellAtPath(rows, path, { widget, mode: 'widget' })
}

type RowUpdater = (row: LayoutCompositionRow) => LayoutCompositionRow

export function updateRowAtPath(rows: LayoutCompositionRow[], path: LayoutPathSegment[], rowId: string, updater: RowUpdater): LayoutCompositionRow[] {
  if (path.length === 0) {
    return rows.map((r) => (r.id === rowId ? updater(r) : r))
  }
  const [head, ...rest] = path
  return rows.map((row) => {
    if (row.id !== head.rowId) return row
    return {
      ...row,
      cells: row.cells.map((c) => {
        if (c.id !== head.cellId) return c
        if (c.mode !== 'widget' || !c.widget || c.widget.kind !== 'layout') return c
        return {
          ...c,
          widget: {
            ...c.widget,
            rows: updateRowAtPath(c.widget.rows, rest, rowId, updater),
          },
        }
      }),
    }
  })
}

function mapRowCellsDeep(rows: LayoutCompositionRow[], fn: (row: LayoutCompositionRow) => LayoutCompositionRow): LayoutCompositionRow[] {
  return rows.map((row) => {
    const next = fn(row)
    return {
      ...next,
      cells: next.cells.map((c) => {
        if (c.mode !== 'widget' || !c.widget || c.widget.kind !== 'layout') return c
        return {
          ...c,
          widget: {
            ...c.widget,
            rows: mapRowCellsDeep(c.widget.rows, fn),
          },
        }
      }),
    }
  })
}

/** Move one cell within or between rows (any depth). Row ids must be unique in the tree. */
export function moveCellInTree(
  rows: LayoutCompositionRow[],
  fromRowId: string,
  fromIndex: number,
  toRowId: string,
  toIndex: number,
): LayoutCompositionRow[] {
  if (fromRowId === toRowId) {
    return mapRowCellsDeep(rows, (row) => {
      if (row.id !== fromRowId) return row
      const cells = [...row.cells]
      const [c] = cells.splice(fromIndex, 1)
      if (!c) return row
      const insertAt = fromIndex < toIndex ? toIndex - 1 : toIndex
      cells.splice(Math.max(0, insertAt), 0, c)
      return { ...row, cells }
    })
  }

  let extracted: LayoutCompositionSlot | null = null

  const afterExtract = mapRowCellsDeep(rows, (row) => {
    if (row.id !== fromRowId) return row
    const cells = [...row.cells]
    const [c] = cells.splice(fromIndex, 1)
    extracted = c ?? null
    return { ...row, cells }
  })

  if (!extracted) return rows

  return mapRowCellsDeep(afterExtract, (row) => {
    if (row.id !== toRowId) return row
    const cells = [...row.cells]
    const insertAt = Math.max(0, Math.min(toIndex, cells.length))
    cells.splice(insertAt, 0, extracted!)
    return { ...row, cells }
  })
}

/** Move a row by index within the same row list (root or nested under a layout widget). */
export function moveRowInList(rows: LayoutCompositionRow[], from: number, to: number): LayoutCompositionRow[] {
  if (from < 0 || from >= rows.length || to < 0 || to > rows.length || from === to) return rows
  const next = [...rows]
  const [r] = next.splice(from, 1)
  const insertAt = from < to ? to - 1 : to
  next.splice(insertAt, 0, r)
  return next
}

/** Replace the `rows` array at root (`path` empty) or inside a nested layout widget. */
export function replaceRowsAtPath(rows: LayoutCompositionRow[], path: LayoutPathSegment[], nextRows: LayoutCompositionRow[]): LayoutCompositionRow[] {
  if (path.length === 0) return nextRows
  const [head, ...rest] = path
  return rows.map((row) => {
    if (row.id !== head.rowId) return row
    return {
      ...row,
      cells: row.cells.map((c) => {
        if (c.id !== head.cellId) return c
        if (c.mode !== 'widget' || !c.widget || c.widget.kind !== 'layout') return c
        return {
          ...c,
          widget: {
            ...c.widget,
            rows: rest.length === 0 ? nextRows : replaceRowsAtPath(c.widget.rows, rest, nextRows),
          },
        }
      }),
    }
  })
}
