/**
 * Local persistence for platform-admin /platform-admin/layout composer (element order + visibility + named presets).
 * Browser-only; no Supabase (platform admins may use shared machines — presets are per-browser).
 */

export type LayoutComposerPreset = {
  id: string
  name: string
  createdAt: string
  /** Which block ids are visible */
  visible: Record<string, boolean>
  /** Top-to-bottom order of block ids in preview */
  order: string[]
}

const SESSION_KEY = 'klarert-platform-layout-composer-session-v1'
const PRESETS_KEY = 'klarert-platform-layout-composer-presets-v1'

export type LayoutComposerSession = {
  visible: Record<string, boolean>
  order: string[]
}

export function normalizeComposerOrder(order: string[], canonical: readonly string[]): string[] {
  const allowed = new Set(canonical)
  const out: string[] = []
  const used = new Set<string>()
  for (const id of order) {
    if (allowed.has(id) && !used.has(id)) {
      used.add(id)
      out.push(id)
    }
  }
  for (const id of canonical) {
    if (!used.has(id)) out.push(id)
  }
  return out
}

export function loadComposerSession(): LayoutComposerSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as LayoutComposerSession
    if (!p || typeof p !== 'object' || !p.visible || !Array.isArray(p.order)) return null
    return p
  } catch {
    return null
  }
}

export function saveComposerSession(session: LayoutComposerSession) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    /* ignore quota */
  }
}

export function loadComposerPresets(): LayoutComposerPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr.filter(
      (x): x is LayoutComposerPreset =>
        x &&
        typeof x === 'object' &&
        typeof (x as LayoutComposerPreset).id === 'string' &&
        typeof (x as LayoutComposerPreset).name === 'string' &&
        typeof (x as LayoutComposerPreset).createdAt === 'string' &&
        typeof (x as LayoutComposerPreset).visible === 'object' &&
        Array.isArray((x as LayoutComposerPreset).order),
    )
  } catch {
    return []
  }
}

export function saveComposerPresets(presets: LayoutComposerPreset[]) {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets))
  } catch {
    /* ignore */
  }
}
