import type { ComposerTemplateRow, GridTemplatePayload } from './platformComposerTemplatesApi'
import { normalizeGridSession, type GridRowPersist } from './layoutGridComposerStorage'

const GRID_NAME_CANDIDATES = ['Layout_vernerunder', 'LayoutVernerunder', 'VernerunderLayout']

function normName(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9æøå]/gi, '')
}

function findGridNameMatch(name: string): boolean {
  const n = normName(name)
  const targets = new Set(GRID_NAME_CANDIDATES.map(normName))
  if (targets.has(n)) return true
  return n.includes('layout') && n.includes('vernerunder')
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

export type ResolvedVernerunderGridTemplate = {
  templateId: string
  templateName: string
  rows: GridRowPersist[]
}

/**
 * Published **kind=grid** template named like Layout_vernerunder — same structure as «Komponer» in platform-admin.
 * When found, workplace Vernerunder should render this grid instead of the stack (vertical list) interpretation.
 */
export function resolveVernerunderGridFromPublishedRows(
  rows: ComposerTemplateRow[] | null | undefined,
): ResolvedVernerunderGridTemplate | null {
  if (!rows?.length) return null
  for (const r of rows) {
    if (r.kind !== 'grid') continue
    if (!findGridNameMatch(r.name)) continue
    const parsed = parsePublishedGridPayload(r.payload)
    if (!parsed) continue
    return { templateId: r.id, templateName: r.name, rows: parsed.rows }
  }
  return null
}
