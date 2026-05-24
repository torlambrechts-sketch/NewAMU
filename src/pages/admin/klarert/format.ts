// Shared formatters for the Klarert Admin sections.
// Keep dates Norwegian-locale aware and consistent across all surfaces.

const TWO = (n: number) => String(n).padStart(2, '0')

/** "22.03.2026 09:14" — same dd.MM.yyyy HH:mm the rest of the app uses. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return `${TWO(d.getDate())}.${TWO(d.getMonth() + 1)}.${d.getFullYear()} ${TWO(d.getHours())}:${TWO(d.getMinutes())}`
  } catch {
    return iso
  }
}

/** "22.03.2026" — date only. */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return `${TWO(d.getDate())}.${TWO(d.getMonth() + 1)}.${d.getFullYear()}`
  } catch {
    return iso
  }
}

/** Slugify Norwegian text → ASCII underscore-separated. Strips æåø
 *  to a/o so the slug round-trips cleanly through URLs and DB columns. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[æå]/g, 'a')
    .replace(/ø/g, 'o')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64)
}
