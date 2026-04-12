import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadComposerPresets,
  normalizeComposerOrder,
  type LayoutComposerPreset,
} from './platformLayoutComposerStorage'
import { fetchPublishedComposerTemplates, type StackTemplatePayload } from './platformComposerTemplatesApi'
import type { LayoutComposerBlockId } from '../pages/platform/PlatformLayoutComposerPage'
import { LAYOUT_COMPOSER_BLOCK_ORDER } from '../pages/platform/PlatformLayoutComposerPage'

/** Blokker som støttes på Internkontroll → ROS (rekkefølge kan styres av oppsett). */
export const ROS_TAB_LAYOUT_BLOCK_IDS = [
  'scoreStatRow',
  'list2',
  'rosRiskMatrix',
  'rosRiskTable',
] as const satisfies readonly LayoutComposerBlockId[]

const ROS_TAB_BLOCK_SET = new Set<string>(ROS_TAB_LAYOUT_BLOCK_IDS)

const PRESET_NAME_CANDIDATES = ['Layout_ROS', 'LayoutROS', 'ROSLayout']

function normName(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9æøå]/gi, '')
}

/** Standard Layout_ROS når intet publisert/lokalt oppsett matcher. */
export const ROS_TAB_LAYOUT_DEFAULT_ORDER: LayoutComposerBlockId[] = [...ROS_TAB_LAYOUT_BLOCK_IDS]

function findRosPreset(presets: LayoutComposerPreset[]): LayoutComposerPreset | null {
  const targets = new Set(PRESET_NAME_CANDIDATES.map(normName))
  for (const p of presets) {
    if (targets.has(normName(p.name))) return p
  }
  for (const p of presets) {
    const n = normName(p.name)
    if (n.includes('layout') && n.includes('ros')) return p
  }
  return null
}

export type RosTabLayoutResolved = {
  order: LayoutComposerBlockId[]
  presetNameMatched: string | null
}

function resolvedFromPreset(hit: LayoutComposerPreset): RosTabLayoutResolved {
  const visible = { ...hit.visible } as Record<string, boolean>
  const rawOrder = normalizeComposerOrder(hit.order, LAYOUT_COMPOSER_BLOCK_ORDER) as LayoutComposerBlockId[]
  const rosOnly = rawOrder.filter((id) => ROS_TAB_BLOCK_SET.has(id) && visible[id] !== false)
  return {
    order: rosOnly.length > 0 ? rosOnly : [...ROS_TAB_LAYOUT_DEFAULT_ORDER],
    presetNameMatched: hit.name,
  }
}

/** Synkront: kun localStorage-presets. */
export function resolveRosTabLayout(): RosTabLayoutResolved {
  const hit = findRosPreset(loadComposerPresets())
  if (!hit) {
    return { order: [...ROS_TAB_LAYOUT_DEFAULT_ORDER], presetNameMatched: null }
  }
  return resolvedFromPreset(hit)
}

/** Publiserte stack-maler fra DB, deretter localStorage, ellers standard. */
export async function resolveRosTabLayoutAsync(
  supabase: SupabaseClient | null | undefined,
): Promise<RosTabLayoutResolved> {
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
    const hitDb = findRosPreset(fromDb)
    if (hitDb) return resolvedFromPreset(hitDb)
  }
  return resolveRosTabLayout()
}
