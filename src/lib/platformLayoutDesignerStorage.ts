import { mergeLayoutComposition, type LayoutCompositionPayload } from '../types/layoutComposition'

const STORAGE_PREFIX = 'klarert_platform_layout_designer_v1'

export type LayoutDesignerPersistedTab = {
  localId: string
  dbId?: string
  referenceKey: string
  payload: LayoutCompositionPayload
}

export type LayoutDesignerDraft = {
  tabs: LayoutDesignerPersistedTab[]
  activeIdx: number
}

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`
}

export function readLayoutDesignerDraft(userId: string): LayoutDesignerDraft | null {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const tabs = (parsed as { tabs?: unknown }).tabs
    const activeIdx = (parsed as { activeIdx?: unknown }).activeIdx
    if (!Array.isArray(tabs) || tabs.length === 0) return null
    if (typeof activeIdx !== 'number' || activeIdx < 0) return null
    const normalized: LayoutDesignerPersistedTab[] = []
    for (const t of tabs) {
      if (!t || typeof t !== 'object') continue
      const row = t as Record<string, unknown>
      const localId = typeof row.localId === 'string' ? row.localId : ''
      const referenceKey = typeof row.referenceKey === 'string' ? row.referenceKey : 'layout'
      const dbId = typeof row.dbId === 'string' ? row.dbId : undefined
      if (!localId) continue
      const payload = mergeLayoutComposition((row.payload ?? {}) as Record<string, unknown>)
      normalized.push({ localId, dbId, referenceKey, payload })
    }
    if (normalized.length === 0) return null
    return {
      tabs: normalized,
      activeIdx: Math.min(Math.max(0, activeIdx), normalized.length - 1),
    }
  } catch {
    return null
  }
}

export function writeLayoutDesignerDraft(userId: string, draft: LayoutDesignerDraft): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(draft))
  } catch {
    /* quota or private mode */
  }
}

export function clearLayoutDesignerDraft(userId: string): void {
  try {
    localStorage.removeItem(storageKey(userId))
  } catch {
    /* ignore */
  }
}
