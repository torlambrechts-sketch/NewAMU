import {
  loadComposerPresets,
  normalizeComposerOrder,
  type LayoutComposerPreset,
} from './platformLayoutComposerStorage'
import type { ComposerTemplateRow } from './platformComposerTemplatesApi'
import { publishedStackRowsToPresets } from './publishedStackPresets'
import type { LayoutComposerBlockId } from '../pages/platform/PlatformLayoutComposerPage'
import { LAYOUT_COMPOSER_BLOCK_ORDER } from '../pages/platform/PlatformLayoutComposerPage'
import {
  VERNERUNDER_TAB_LAYOUT_BLOCK_IDS,
  VERNERUNDER_TAB_LAYOUT_DEFAULT_ORDER,
} from './vernerunderLayoutFromPreset'

const BLOCK_SET = new Set<string>(VERNERUNDER_TAB_LAYOUT_BLOCK_IDS)

const PRESET_NAME_CANDIDATES = [
  'Layout_inspeksjoner',
  'LayoutInspeksjoner',
  'InspeksjonerLayout',
  'Layout_inspections',
  'LayoutInspections',
]

function normName(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9æøå]/gi, '')
}

function findPreset(presets: LayoutComposerPreset[]): LayoutComposerPreset | null {
  const targets = new Set(PRESET_NAME_CANDIDATES.map(normName))
  for (const p of presets) {
    if (targets.has(normName(p.name))) return p
  }
  for (const p of presets) {
    const n = normName(p.name)
    if (n.includes('layout') && n.includes('inspeksjon')) return p
    if (n.includes('layout') && n.includes('inspection')) return p
  }
  return null
}

export type InspectionsTabLayoutResolved = {
  order: LayoutComposerBlockId[]
  presetNameMatched: string | null
}

function resolvedFromPreset(hit: LayoutComposerPreset): InspectionsTabLayoutResolved {
  const visible = { ...hit.visible } as Record<string, boolean>
  const rawOrder = normalizeComposerOrder(hit.order, LAYOUT_COMPOSER_BLOCK_ORDER) as LayoutComposerBlockId[]
  const filtered = rawOrder.filter((id) => BLOCK_SET.has(id) && visible[id] !== false)
  return {
    order: filtered.length > 0 ? filtered : [],
    presetNameMatched: hit.name,
  }
}

function mergeWithDefaults(order: LayoutComposerBlockId[]): LayoutComposerBlockId[] {
  if (order.length > 0) return order
  return [...VERNERUNDER_TAB_LAYOUT_DEFAULT_ORDER]
}

export function resolveInspectionsTabLayout(): InspectionsTabLayoutResolved {
  const hit = findPreset(loadComposerPresets())
  if (!hit) {
    return { order: [...VERNERUNDER_TAB_LAYOUT_DEFAULT_ORDER], presetNameMatched: null }
  }
  const r = resolvedFromPreset(hit)
  return { ...r, order: mergeWithDefaults(r.order) }
}

export function resolveInspectionsTabLayoutFromPublishedRows(
  rows: ComposerTemplateRow[] | null | undefined,
): InspectionsTabLayoutResolved {
  if (rows && rows.length > 0) {
    const stackRows = rows.filter((x) => x.kind === 'stack')
    const hitDb = findPreset(publishedStackRowsToPresets(stackRows))
    if (hitDb) {
      const r = resolvedFromPreset(hitDb)
      return { ...r, order: mergeWithDefaults(r.order) }
    }
  }
  return resolveInspectionsTabLayout()
}
