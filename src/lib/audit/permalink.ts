// Per-event permalink. The row context menu emits `?event=<id>` so a
// recipient can land directly on the row.

export function eventPermalink(eventId: string): string {
  const base = typeof window !== 'undefined' ? window.location.pathname : ''
  const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  search.set('event', eventId)
  return `${base}?${search.toString()}`
}

export async function copyEventPermalink(eventId: string): Promise<boolean> {
  if (typeof window === 'undefined' || !navigator.clipboard) return false
  const href = `${window.location.origin}${eventPermalink(eventId)}`
  try {
    await navigator.clipboard.writeText(href)
    return true
  } catch {
    return false
  }
}

export function readPermalinkEventId(): string | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  return params.get('event')
}
