/**
 * Page Layout system — simple, CRUD-capable, fully DB-backed.
 *
 * A PageLayout is keyed by a stable `pageKey` (e.g. "hse.vernerunder").
 * It contains an ordered list of Sections. Each Section has 1–4 Columns.
 * Each Column has an ordered list of Blocks. Blocks reference a known
 * `blockId` (component) and can carry a `textOverride` map for
 * admin-editable text strings displayed in that component.
 */

export type PageLayoutBlock = {
  id: string            // stable uuid for this block instance
  blockId: string       // e.g. "scoreStatRow", "table1", "vernerunderScheduleCalendar"
  /** Admin-editable text overrides, keyed by a stable label. */
  textOverride?: Record<string, string>
  /** Whether this block is visible (soft-hide without removing). */
  visible?: boolean
}

export type PageLayoutColumn = {
  id: string
  /** Tailwind-style flex weight: 1–12. Columns in a section share 12 units. */
  colSpan: number
  blocks: PageLayoutBlock[]
}

export type PageLayoutSection = {
  id: string
  /** How many columns to render: cols.length drives this; kept here for the editor UI. */
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
