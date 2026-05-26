// Recent-paths log used by the command palette. Push every distinct
// pathname the user lands on; the palette surfaces the most-recent
// destinations when the query is empty so power users can return to
// where they just were without re-navigating the rails.

const KEY = 'atics-recent-paths'
const MAX = 8

export function loadRecentPaths(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((p): p is string => typeof p === 'string').slice(0, MAX)
  } catch {
    return []
  }
}

export function pushRecentPath(path: string) {
  if (!path || path === '/' || path === '/app') return
  try {
    const existing = loadRecentPaths().filter((p) => p !== path)
    const next = [path, ...existing].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}
