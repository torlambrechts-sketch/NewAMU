import type { ComposerTemplateRow, GridTemplatePayload } from './platformComposerTemplatesApi'
import { normalizeGridSession, type GridRowPersist } from './layoutGridComposerStorage'

export function normComposerTemplateName(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9æøå]/gi, '')
}

/** Parse and normalize grid payload from a published composer row (same shape as PlatformGridComposer). */
export function parsePublishedGridPayload(payload: unknown): GridTemplatePayload | null {
  if (!payload || typeof payload !== 'object') return null
  const rawRows = (payload as { rows?: unknown }).rows
  if (!Array.isArray(rawRows)) return null
  const session = normalizeGridSession({ rows: rawRows as GridRowPersist[] })
  if (!session.rows.length) return null
  return { rows: session.rows }
}

export type ResolvedPublishedGridTemplate = {
  templateId: string
  templateName: string
  rows: GridRowPersist[]
}

export type ResolvePublishedGridOptions = {
  /** Exact normalized name matches, e.g. Layout_vernerunder */
  nameCandidates: string[]
  /** Optional: match when normalized name includes both tokens (e.g. layout + vernerunder) */
  fuzzy?: { includeAll: string[] }
}

/**
 * First published **kind=grid** row matching name candidates or fuzzy rule.
 */
export function resolvePublishedGridFromRows(
  rows: ComposerTemplateRow[] | null | undefined,
  opts: ResolvePublishedGridOptions,
): ResolvedPublishedGridTemplate | null {
  if (!rows?.length) return null
  const targets = new Set(opts.nameCandidates.map(normComposerTemplateName))
  const fuzzy = opts.fuzzy?.includeAll.map(normComposerTemplateName) ?? []

  function matches(name: string): boolean {
    const n = normComposerTemplateName(name)
    if (targets.has(n)) return true
    if (fuzzy.length > 0 && fuzzy.every((t) => n.includes(t))) return true
    return false
  }

  for (const r of rows) {
    if (r.kind !== 'grid') continue
    if (!matches(r.name)) continue
    const parsed = parsePublishedGridPayload(r.payload)
    if (!parsed) continue
    return { templateId: r.id, templateName: r.name, rows: parsed.rows }
  }
  return null
}

const VERNERUNDER_GRID_NAMES = ['Layout_vernerunder', 'LayoutVernerunder', 'VernerunderLayout']

export function resolveVernerunderGridFromPublishedRows(
  rows: ComposerTemplateRow[] | null | undefined,
): ResolvedPublishedGridTemplate | null {
  return resolvePublishedGridFromRows(rows, {
    nameCandidates: VERNERUNDER_GRID_NAMES,
    fuzzy: { includeAll: ['layout', 'vernerunder'] },
  })
}

const INSPECTIONS_GRID_NAMES = [
  'Layout_inspeksjoner',
  'LayoutInspeksjoner',
  'InspeksjonerLayout',
  'Layout_inspections',
  'LayoutInspections',
]

/** Published Komponer-mal for HSE → Inspeksjoner (samme mønster som Vernerunder). */
export function resolveInspectionsGridFromPublishedRows(
  rows: ComposerTemplateRow[] | null | undefined,
): ResolvedPublishedGridTemplate | null {
  return resolvePublishedGridFromRows(rows, {
    nameCandidates: INSPECTIONS_GRID_NAMES,
    fuzzy: { includeAll: ['layout', 'inspeksjon'] },
  })
}
