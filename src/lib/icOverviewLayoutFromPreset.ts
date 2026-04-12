import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadComposerPresets,
  normalizeComposerOrder,
  type LayoutComposerPreset,
} from './platformLayoutComposerStorage'
import { fetchPublishedComposerTemplates, type StackTemplatePayload } from './platformComposerTemplatesApi'
import type { LayoutComposerBlockId } from '../pages/platform/PlatformLayoutComposerPage'

/** Canonical block order — keep in sync with PlatformLayoutComposerPage BLOCKS */
const CANONICAL: readonly LayoutComposerBlockId[] = [
  'heading1',
  'table1',
  'scorecard',
  'jobCards',
  'tableHeading',
  'scoreStatRow',
  'list2',
  'jobBoxGrid',
  'reportingDonutOneRow',
  'reportingChartsTwoRow',
]

const PRESET_NAME_CANDIDATES = [
  'WorkplaceReportinWithBox',
  'WorkplaceReportingWithBox',
  'WokplaceReportinWithBox',
]

function normName(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9æøå]/gi, '')
}

/**
 * Fallback when no matching localStorage preset exists (same intent: overskrift + KPI + boksrutenett).
 * heading1 is omitted on Internkontroll — shell already has page title.
 */
export const IC_OVERVIEW_COMPOSER_FALLBACK_ORDER: LayoutComposerBlockId[] = [
  'scoreStatRow',
  'jobBoxGrid',
]

function findSavedPreset(presets: LayoutComposerPreset[]): LayoutComposerPreset | null {
  const targets = new Set(PRESET_NAME_CANDIDATES.map(normName))
  for (const p of presets) {
    if (targets.has(normName(p.name))) return p
  }
  for (const p of presets) {
    const n = normName(p.name)
    if (n.includes('workplace') && n.includes('report') && n.includes('box')) return p
  }
  return null
}

export type IcOverviewComposerResolved = {
  /** Block ids to render top-to-bottom */
  order: LayoutComposerBlockId[]
  /** From saved preset or null if fallback */
  presetNameMatched: string | null
}

/**
 * Resolves composer blocks for Internkontroll → Oversikt.
 * Reads platform-admin "Lagrede oppsett" from localStorage when name matches.
 */
function resolvedFromPreset(hit: LayoutComposerPreset): IcOverviewComposerResolved {
  const visible = { ...hit.visible } as Record<string, boolean>
  const rawOrder = normalizeComposerOrder(hit.order, CANONICAL) as LayoutComposerBlockId[]
  const order = rawOrder.filter((id) => visible[id] !== false)
  const withoutHeading = order.filter((id) => id !== 'heading1')
  return {
    order: withoutHeading.length > 0 ? withoutHeading : [...IC_OVERVIEW_COMPOSER_FALLBACK_ORDER],
    presetNameMatched: hit.name,
  }
}

export function resolveIcOverviewComposerLayout(): IcOverviewComposerResolved {
  const presets = loadComposerPresets()
  const hit = findSavedPreset(presets)
  if (!hit) {
    return { order: [...IC_OVERVIEW_COMPOSER_FALLBACK_ORDER], presetNameMatched: null }
  }
  return resolvedFromPreset(hit)
}

/**
 * Prefer published stack template from DB (platform_composer_templates), then localStorage.
 */
export async function resolveIcOverviewComposerLayoutAsync(
  supabase: SupabaseClient | null | undefined,
): Promise<IcOverviewComposerResolved> {
  if (supabase) {
    const { data } = await fetchPublishedComposerTemplates(supabase)
    const fromDb: LayoutComposerPreset[] = data
      .filter((r) => r.kind === 'stack')
      .map((row) => {
        const p = row.payload as StackTemplatePayload
        return {
          id: row.id,
          name: row.name,
          createdAt: row.created_at,
          visible: p.visible as Record<string, boolean>,
          order: p.order as string[],
        }
      })
    const hitDb = findSavedPreset(fromDb)
    if (hitDb) return resolvedFromPreset(hitDb)
  }
  return resolveIcOverviewComposerLayout()
}
