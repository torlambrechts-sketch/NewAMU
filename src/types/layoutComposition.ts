/** Page / section layout builder — slots reference component designs by `reference_key`. */

export const LAYOUT_COMPOSITION_VERSION = 1 as const

export type LayoutSlotSpan = 'full' | 'half' | 'third'

export type LayoutCompositionSlot = {
  id: string
  /** Editor label */
  label: string
  /** `platform_box_designs.reference_key` — which saved component design fills this slot */
  componentReferenceKey: string | null
  span: LayoutSlotSpan
  align: 'stretch' | 'start' | 'center' | 'end'
}

export type LayoutCompositionPayload = {
  version: typeof LAYOUT_COMPOSITION_VERSION
  metadata: {
    name: string
    description: string
  }
  canvas: {
    maxWidth: string
    padding: string
    gap: string
    backgroundColor: string
    backgroundGradient: string
    minHeight: string
    borderRadius: string
    borderWidth: string
    borderStyle: string
    borderColor: string
  }
  slots: LayoutCompositionSlot[]
}

export const DEFAULT_LAYOUT_COMPOSITION: LayoutCompositionPayload = {
  version: LAYOUT_COMPOSITION_VERSION,
  metadata: {
    name: 'Standard side',
    description: 'Dra inn komponenter fra komponentdesigner via referansenøkkel.',
  },
  canvas: {
    maxWidth: '1200px',
    padding: '24px',
    gap: '16px',
    backgroundColor: '#f5f0e8',
    backgroundGradient: '',
    minHeight: '400px',
    borderRadius: '16px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(0,0,0,0.08)',
  },
  slots: [],
}

export function newSlotId(): string {
  return `slot-${crypto.randomUUID().slice(0, 8)}`
}

function isObj(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x)
}

function deepMergeLayout<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const out = { ...target } as Record<string, unknown>
  for (const k of Object.keys(source)) {
    const sv = (source as Record<string, unknown>)[k]
    const tv = out[k]
    if (sv === undefined) continue
    if (k === 'slots' && Array.isArray(sv)) {
      out[k] = sv
      continue
    }
    if (isObj(sv) && isObj(tv)) {
      out[k] = deepMergeLayout(tv as Record<string, unknown>, sv as Record<string, unknown>)
    } else {
      out[k] = sv
    }
  }
  return out as T
}

export function mergeLayoutComposition(partial: Partial<LayoutCompositionPayload>): LayoutCompositionPayload {
  const base = structuredClone(DEFAULT_LAYOUT_COMPOSITION)
  base.slots = [
    {
      id: newSlotId(),
      label: 'Hovedinnhold',
      componentReferenceKey: null,
      span: 'full',
      align: 'stretch',
    },
  ]
  return deepMergeLayout(base as unknown as Record<string, unknown>, partial as Record<string, unknown>) as LayoutCompositionPayload
}

export function cloneLayoutComposition(overrides?: Partial<LayoutCompositionPayload>): LayoutCompositionPayload {
  if (!overrides) {
    return mergeLayoutComposition({})
  }
  return mergeLayoutComposition(overrides)
}
