import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadComposerPresets,
  normalizeComposerOrder,
  type LayoutComposerPreset,
} from './platformLayoutComposerStorage'
import { fetchPublishedComposerTemplates, type ComposerTemplateRow } from './platformComposerTemplatesApi'
import { publishedStackRowsToPresets } from './publishedStackPresets'
import type { LayoutComposerBlockId } from '../pages/platform/PlatformLayoutComposerPage'
import { LAYOUT_COMPOSER_BLOCK_ORDER } from '../pages/platform/PlatformLayoutComposerPage'

export const VERNERUNDER_TAB_LAYOUT_BLOCK_IDS = [
  'scoreStatRow',
  'vernerunderScheduleCalendar',
  'table1',
] as const satisfies readonly LayoutComposerBlockId[]

const BLOCK_SET = new Set<string>(VERNERUNDER_TAB_LAYOUT_BLOCK_IDS)

const PRESET_NAME_CANDIDATES = ['Layout_vernerunder', 'LayoutVernerunder', 'VernerunderLayout']

function normName(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9æøå]/gi, '')
}

export const VERNERUNDER_TAB_LAYOUT_DEFAULT_ORDER: LayoutComposerBlockId[] = [...VERNERUNDER_TAB_LAYOUT_BLOCK_IDS]

function findPreset(presets: LayoutComposerPreset[]): LayoutComposerPreset | null {
  const targets = new Set(PRESET_NAME_CANDIDATES.map(normName))
  for (const p of presets) {
    if (targets.has(normName(p.name))) return p
  }
  for (const p of presets) {
    const n = normName(p.name)
    if (n.includes('layout') && n.includes('vernerunder')) return p
  }
  return null
}

export type VernerunderTabLayoutResolved = {
  order: LayoutComposerBlockId[]
  presetNameMatched: string | null
}

function resolvedFromPreset(hit: LayoutComposerPreset): VernerunderTabLayoutResolved {
  const visible = { ...hit.visible } as Record<string, boolean>
  const rawOrder = normalizeComposerOrder(hit.order, LAYOUT_COMPOSER_BLOCK_ORDER) as LayoutComposerBlockId[]
  const filtered = rawOrder.filter((id) => BLOCK_SET.has(id) && visible[id] !== false)
  return {
    order: filtered.length > 0 ? filtered : [...VERNERUNDER_TAB_LAYOUT_DEFAULT_ORDER],
    presetNameMatched: hit.name,
  }
}

export function resolveVernerunderTabLayout(): VernerunderTabLayoutResolved {
  const hit = findPreset(loadComposerPresets())
  if (!hit) {
    return { order: [...VERNERUNDER_TAB_LAYOUT_DEFAULT_ORDER], presetNameMatched: null }
  }
  return resolvedFromPreset(hit)
}

export function resolveVernerunderTabLayoutFromPublishedRows(
  rows: ComposerTemplateRow[] | null | undefined,
): VernerunderTabLayoutResolved {
  if (rows && rows.length > 0) {
    const hitDb = findPreset(publishedStackRowsToPresets(rows))
    if (hitDb) return resolvedFromPreset(hitDb)
  }
  return resolveVernerunderTabLayout()
}

export async function resolveVernerunderTabLayoutAsync(
  supabase: SupabaseClient | null | undefined,
  opts?: { publishedRows?: ComposerTemplateRow[] | null },
): Promise<VernerunderTabLayoutResolved> {
  if (opts?.publishedRows != null) {
    return resolveVernerunderTabLayoutFromPublishedRows(opts.publishedRows)
  }
  if (supabase) {
    const { data } = await fetchPublishedComposerTemplates(supabase)
    return resolveVernerunderTabLayoutFromPublishedRows(data)
  }
  return resolveVernerunderTabLayout()
}
