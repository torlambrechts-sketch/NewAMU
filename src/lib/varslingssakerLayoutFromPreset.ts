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
import { expandLegacyHeadingInLayoutOrder } from './vernerunderLayoutFromPreset'

/**
 * Stack-mal **Layout_varslingssaker** (eller liknende navn) på Oppgaver → Varslingssaker:
 * - pageHeading1 — H1 + ingress (uten hub; hub ligger i Tasks-skjell)
 * - hubMenu1Bar — faner (demo; valgfri)
 * - heading1 — eldre samlet blokk (migreres til pageHeading1 + hubMenu1Bar)
 * - scoreStatRow — KPI-bokser
 * - list2 — liste / tabell-seksjon (søk, filter, rader)
 */
export const VARSLINGSSAKER_TAB_LAYOUT_BLOCK_IDS = [
  'pageHeading1',
  'hubMenu1Bar',
  'scoreStatRow',
  'list2',
] as const satisfies readonly LayoutComposerBlockId[]

const BLOCK_SET = new Set<string>([...VARSLINGSSAKER_TAB_LAYOUT_BLOCK_IDS, 'heading1'])

const PRESET_NAME_CANDIDATES = [
  'Layout_varslingssaker',
  'LayoutVarslingssaker',
  'VarslingssakerLayout',
  'Layout_whistleblowing',
]

function normName(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9æøå]/gi, '')
}

export const VARSLINGSSAKER_TAB_LAYOUT_DEFAULT_ORDER: LayoutComposerBlockId[] = [
  ...VARSLINGSSAKER_TAB_LAYOUT_BLOCK_IDS,
]

function findPreset(presets: LayoutComposerPreset[]): LayoutComposerPreset | null {
  const targets = new Set(PRESET_NAME_CANDIDATES.map(normName))
  for (const p of presets) {
    if (targets.has(normName(p.name))) return p
  }
  for (const p of presets) {
    const n = normName(p.name)
    if (n.includes('layout') && (n.includes('varsling') || n.includes('whistle'))) return p
  }
  return null
}

export type VarslingssakerTabLayoutResolved = {
  order: LayoutComposerBlockId[]
  presetNameMatched: string | null
}

function resolvedFromPreset(hit: LayoutComposerPreset): VarslingssakerTabLayoutResolved {
  const visible = { ...hit.visible } as Record<string, boolean>
  const rawOrder = normalizeComposerOrder(hit.order, LAYOUT_COMPOSER_BLOCK_ORDER) as LayoutComposerBlockId[]
  const filtered = rawOrder.filter((id) => BLOCK_SET.has(id) && visible[id] !== false)
  const order = expandLegacyHeadingInLayoutOrder(filtered)
  return {
    order: order.length > 0 ? order : [],
    presetNameMatched: hit.name,
  }
}

function mergeWithDefaults(order: LayoutComposerBlockId[]): LayoutComposerBlockId[] {
  if (order.length > 0) return order
  return [...VARSLINGSSAKER_TAB_LAYOUT_DEFAULT_ORDER]
}

export function resolveVarslingssakerTabLayout(): VarslingssakerTabLayoutResolved {
  const hit = findPreset(loadComposerPresets())
  if (!hit) {
    return { order: [...VARSLINGSSAKER_TAB_LAYOUT_DEFAULT_ORDER], presetNameMatched: null }
  }
  const r = resolvedFromPreset(hit)
  return { ...r, order: mergeWithDefaults(r.order) }
}

export function resolveVarslingssakerTabLayoutFromPublishedRows(
  rows: ComposerTemplateRow[] | null | undefined,
): VarslingssakerTabLayoutResolved {
  if (rows && rows.length > 0) {
    const hitDb = findPreset(publishedStackRowsToPresets(rows))
    if (hitDb) {
      const r = resolvedFromPreset(hitDb)
      return { ...r, order: mergeWithDefaults(r.order) }
    }
  }
  return resolveVarslingssakerTabLayout()
}

export async function resolveVarslingssakerTabLayoutAsync(
  supabase: SupabaseClient | null | undefined,
  opts?: { publishedRows?: ComposerTemplateRow[] | null },
): Promise<VarslingssakerTabLayoutResolved> {
  if (opts?.publishedRows != null) {
    return resolveVarslingssakerTabLayoutFromPublishedRows(opts.publishedRows)
  }
  if (supabase) {
    const { data } = await fetchPublishedComposerTemplates(supabase)
    return resolveVarslingssakerTabLayoutFromPublishedRows(data)
  }
  return resolveVarslingssakerTabLayout()
}
