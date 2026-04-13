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

/**
 * Layout_vernerunder — rekkefølge styres av publisert/lokal stack-mal:
 * - pageHeading1 — serif H1 + ingress (uten hub)
 * - hubMenu1Bar — HubMenu1Bar-faner (demo i komponisten; på HMS ligger faner ofte i modulskall)
 * - heading1 — eldre samlet blokk (behandles som pageHeading1 + hubMenu1Bar hvis nye id-er mangler)
 * - scoreStatRow — KPI
 * - workplaceTasksActions — knapper (Tasks-stil, transparent rad)
 * - table1 — tabell (2/3 i splittet rad)
 * - vernerunderScheduleCalendar — kalender (1/3)
 * Tabell er alltid venstre kolonne og kalender høyre når begge er synlige.
 */
export const VERNERUNDER_TAB_LAYOUT_BLOCK_IDS = [
  'pageHeading1',
  'hubMenu1Bar',
  'scoreStatRow',
  'workplaceTasksActions',
  'table1',
  'vernerunderScheduleCalendar',
] as const satisfies readonly LayoutComposerBlockId[]

const BLOCK_SET = new Set<string>([...VERNERUNDER_TAB_LAYOUT_BLOCK_IDS, 'heading1'])

const PRESET_NAME_CANDIDATES = ['Layout_vernerunder', 'LayoutVernerunder', 'VernerunderLayout']

function normName(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9æøå]/gi, '')
}

export const VERNERUNDER_TAB_LAYOUT_DEFAULT_ORDER: LayoutComposerBlockId[] = [
  ...VERNERUNDER_TAB_LAYOUT_BLOCK_IDS,
]

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

/** Legacy maler brukte én `heading1`-blokk; nye maler bruker `pageHeading1` + `hubMenu1Bar`. */
export function expandLegacyHeadingInLayoutOrder(order: LayoutComposerBlockId[]): LayoutComposerBlockId[] {
  const hasNew = order.some((id) => id === 'pageHeading1' || id === 'hubMenu1Bar')
  const hasLegacy = order.includes('heading1')
  if (!hasLegacy) return order
  if (hasNew) return order.filter((id) => id !== 'heading1')
  return order.flatMap((id) =>
    id === 'heading1' ? (['pageHeading1', 'hubMenu1Bar'] as LayoutComposerBlockId[]) : [id],
  )
}

function resolvedFromPreset(hit: LayoutComposerPreset): VernerunderTabLayoutResolved {
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
  return [...VERNERUNDER_TAB_LAYOUT_DEFAULT_ORDER]
}

export function resolveVernerunderTabLayout(): VernerunderTabLayoutResolved {
  const hit = findPreset(loadComposerPresets())
  if (!hit) {
    return { order: [...VERNERUNDER_TAB_LAYOUT_DEFAULT_ORDER], presetNameMatched: null }
  }
  const r = resolvedFromPreset(hit)
  return { ...r, order: mergeWithDefaults(r.order) }
}

export function resolveVernerunderTabLayoutFromPublishedRows(
  rows: ComposerTemplateRow[] | null | undefined,
): VernerunderTabLayoutResolved {
  if (rows && rows.length > 0) {
    const stackOnly = rows.filter((x) => x.kind === 'stack')
    const hitDb = findPreset(publishedStackRowsToPresets(stackOnly))
    if (hitDb) {
      const r = resolvedFromPreset(hitDb)
      return { ...r, order: mergeWithDefaults(r.order) }
    }
  }
  return resolveVernerunderTabLayout()
}

/** For diagnostics: same name rules as {@link findPreset} (stack templates in DB). */
export function matchesVernerunderTemplateName(name: string): boolean {
  const targets = new Set(PRESET_NAME_CANDIDATES.map(normName))
  const n = normName(name)
  if (targets.has(n)) return true
  return n.includes('layout') && n.includes('vernerunder')
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

/** Vertikal sortering: hvert segment får min(indeks) blant blokkene i segmentet */
export function vernerunderVerticalSegments(order: LayoutComposerBlockId[]): {
  sortIndex: number
  kind: 'pageHeading1' | 'hubMenu1Bar' | 'scoreStatRow' | 'workplaceTasksActions' | 'split'
}[] {
  const idx = (id: LayoutComposerBlockId) => {
    const i = order.indexOf(id)
    return i === -1 ? 9999 : i
  }
  const hasTable = order.includes('table1')
  const hasCal = order.includes('vernerunderScheduleCalendar')
  const pieces: {
    sortIndex: number
    kind: 'pageHeading1' | 'hubMenu1Bar' | 'scoreStatRow' | 'workplaceTasksActions' | 'split'
  }[] = []

  if (order.includes('pageHeading1')) {
    pieces.push({ sortIndex: idx('pageHeading1'), kind: 'pageHeading1' })
  }
  if (order.includes('hubMenu1Bar')) {
    pieces.push({ sortIndex: idx('hubMenu1Bar'), kind: 'hubMenu1Bar' })
  }
  if (order.includes('scoreStatRow')) {
    pieces.push({ sortIndex: idx('scoreStatRow'), kind: 'scoreStatRow' })
  }
  if (order.includes('workplaceTasksActions')) {
    pieces.push({ sortIndex: idx('workplaceTasksActions'), kind: 'workplaceTasksActions' })
  }
  if (hasTable || hasCal) {
    const splitIdx = Math.min(idx('table1'), idx('vernerunderScheduleCalendar'))
    pieces.push({ sortIndex: splitIdx, kind: 'split' })
  }

  pieces.sort((a, b) => a.sortIndex - b.sortIndex)
  return pieces
}
