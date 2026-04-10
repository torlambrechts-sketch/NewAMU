/** Page / section layout builder — rows of cells; each cell is a widget or a saved component design. */

export const LAYOUT_COMPOSITION_VERSION = 2 as const
export const LAYOUT_COMPOSITION_VERSION_LEGACY = 1 as const

export type LayoutSlotSpan = 'full' | 'half' | 'third'

export type TextWidgetAlign = 'left' | 'center' | 'right'

/** Inline typography for a single widget (overrides page defaults). */
export type LayoutWidgetTextStyle = {
  fontFamily: string
  fontSize: string
  fontWeight: '400' | '500' | '600' | '700'
  color: string
  lineHeight: string
  textAlign: TextWidgetAlign
}

export const DEFAULT_WIDGET_TEXT_STYLE: LayoutWidgetTextStyle = {
  fontFamily: 'inherit',
  fontSize: '1rem',
  fontWeight: '400',
  color: '#171717',
  lineHeight: '1.5',
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
  | { kind: 'image'; src: string; alt: string; objectFit: 'cover' | 'contain' }
  | {
      kind: 'button'
      label: string
      href: string
      backgroundColor: string
      textColor: string
      fontWeight: '400' | '500' | '600' | '700'
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
  }
}

export type LayoutCompositionRow = {
  id: string
  gap: string
  alignItems: 'stretch' | 'start' | 'center' | 'end'
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

/** Legacy flat slots (v1) — migrated to a single row on load. */
type LegacyLayoutPayload = {
  version?: typeof LAYOUT_COMPOSITION_VERSION_LEGACY
  metadata?: LayoutCompositionPayload['metadata']
  canvas?: Partial<LayoutCompositionPayload['canvas']>
  slots?: LegacySlot[]
}

type LegacySlot = Omit<LayoutCompositionSlot, 'mode' | 'widget'> & {
  mode?: 'component' | 'widget'
  widget?: LayoutWidgetPayload | null
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
      return { kind: 'image', src: 'https://picsum.photos/seed/layout/800/400', alt: '', objectFit: 'cover' }
    case 'button':
      return {
        kind: 'button',
        label: 'Knapp',
        href: '#',
        backgroundColor: '#1a3d32',
        textColor: '#ffffff',
        fontWeight: '600',
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

export function newRow(cells?: LayoutCompositionSlot[]): LayoutCompositionRow {
  return {
    id: newRowId(),
    gap: '16px',
    alignItems: 'stretch',
    cells: cells?.length ? cells : [newCell({ label: 'Celle 1', span: 'full' })],
  }
}

function isObj(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x)
}

function migrateLegacySlot(s: LegacySlot): LayoutCompositionSlot {
  const hasComp = Boolean(s.componentReferenceKey)
  const mode: 'component' | 'widget' = s.mode ?? (hasComp ? 'component' : 'widget')
  return {
    id: s.id || newSlotId(),
    label: s.label || 'Celle',
    mode,
    componentReferenceKey: s.componentReferenceKey ?? null,
    widget: s.widget ?? (mode === 'widget' ? emptyWidget('text') : null),
    span: s.span ?? 'full',
    align: s.align ?? 'stretch',
    slotStyle: s.slotStyle ?? defaultSlotStyle(),
  }
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

function normalizeCell(c: LegacySlot | LayoutCompositionSlot): LayoutCompositionSlot {
  const m = migrateLegacySlot(c as LegacySlot)
  const mode =
    (c as LayoutCompositionSlot).mode ??
    (m.componentReferenceKey ? 'component' : 'widget')
  const widget =
    (c as LayoutCompositionSlot).widget ??
    (mode === 'component' ? null : emptyWidget('text'))
  return {
    ...m,
    mode,
    widget,
    slotStyle: (c as LayoutCompositionSlot).slotStyle ?? defaultSlotStyle(),
  }
}

function normalizeRow(r: Partial<LayoutCompositionRow>, defaultGap: string): LayoutCompositionRow {
  return {
    id: r.id || newRowId(),
    gap: r.gap ?? defaultGap,
    alignItems: r.alignItems ?? 'stretch',
    cells: (r.cells ?? []).map((c) => normalizeCell(c as LegacySlot)),
  }
}

/**
 * Normalize any saved payload to current v2 shape (migrates v1 `slots` → one `row`).
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
          cells: (raw.slots as LegacySlot[]).map((c) => normalizeCell(c)),
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
