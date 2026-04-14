/**
 * Page Layout system — simple, CRUD-capable, fully DB-backed.
 *
 * A PageLayout is keyed by a stable `pageKey` (e.g. "hse.vernerunder").
 * It contains an ordered list of Sections. Each Section has a named
 * column preset that maps to a fixed Tailwind grid class.
 * Each column has an ordered list of Blocks.
 */

/**
 * Named column presets — map to hardcoded Tailwind grid classes.
 * Using named presets avoids all colSpan number coercion problems.
 *
 * full      = 1 column, full width
 * split-2-1 = 2 columns, 2/3 + 1/3  (grid-cols-[2fr_1fr])
 * split-1-2 = 2 columns, 1/3 + 2/3  (grid-cols-[1fr_2fr])
 * halves    = 2 equal columns        (grid-cols-2)
 * thirds    = 3 equal columns        (grid-cols-3)
 */
export type ColumnPreset = 'full' | 'split-2-1' | 'split-1-2' | 'halves' | 'thirds'

export type PageLayoutBlock = {
  id: string            // stable uuid for this block instance
  blockId: string       // e.g. "scoreStatRow", "kpiInfoBoxes", "noticeInfo"
  /** Admin-editable text overrides, keyed by a stable label. */
  textOverride?: Record<string, string>
  /** Generic block-level props (e.g. { boxCount: 4 } for kpiInfoBoxes). */
  blockProps?: Record<string, unknown>
  /** Whether this block is visible (soft-hide without removing). */
  visible?: boolean
}

export type PageLayoutColumn = {
  id: string
  blocks: PageLayoutBlock[]
  /** colSpan kept for backwards-compat with old saved data; ignored in new renderer. */
  colSpan?: number
}

export type PageLayoutSection = {
  id: string
  /** Named column layout preset — drives how many columns and their widths. */
  preset: ColumnPreset
  label?: string
  cols: PageLayoutColumn[]
}

export type PageLayout = {
  id: string                // DB uuid (or "local" for localStorage fallback)
  pageKey: string           // stable identifier, e.g. "hse.vernerunder"
  sections: PageLayoutSection[]
  publishedAt?: string | null
  updatedAt?: string
  createdBy?: string
}

/** Lightweight shape stored in Supabase — `sections` is stored as JSONB. */
export type PageLayoutRow = {
  id: string
  page_key: string
  sections: PageLayoutSection[]
  published: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

/** A registered block: component key + display info. */
export type PageLayoutBlockDef = {
  id: string
  label: string
  description?: string
  /** Editable text field keys this block exposes (for the inline editor). */
  editableTextKeys?: string[]
  /** Default colSpan when dropped into a new column (1–12). */
  defaultColSpan?: number
}

/** Human-readable labels for column presets. */
export const COLUMN_PRESET_LABELS: Record<ColumnPreset, string> = {
  'full':      '1 kolonne — full bredde',
  'split-2-1': '2 kolonner — 2/3 + 1/3',
  'split-1-2': '2 kolonner — 1/3 + 2/3',
  'halves':    '2 kolonner — 50 / 50',
  'thirds':    '3 kolonner — like brede',
}

/** How many columns each preset creates. */
export const COLUMN_PRESET_COUNT: Record<ColumnPreset, number> = {
  'full': 1, 'split-2-1': 2, 'split-1-2': 2, 'halves': 2, 'thirds': 3,
}
