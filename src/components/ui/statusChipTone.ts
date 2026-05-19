// Status label → semantic tone. Extracted from StatusChip.tsx so the
// component module can keep react-refresh purity.

export type StatusChipStatus =
  | 'open'
  | 'in_progress'
  | 'overdue'
  | 'closed'
  | 'rejected'
  | 'approved'
  | 'unknown'

export function statusFromLabel(label: string): StatusChipStatus {
  const t = label.trim().toLowerCase()
  if (!t) return 'unknown'
  if (t === 'åpen' || t === 'apen' || t === 'open') return 'open'
  if (t === 'i arbeid' || t === 'pågår' || t === 'pagar' || t === 'in_progress') return 'in_progress'
  if (t === 'forfalt' || t === 'overdue') return 'overdue'
  if (t === 'lukket' || t === 'closed') return 'closed'
  if (t === 'avvist' || t === 'rejected') return 'rejected'
  if (t === 'godkjent' || t === 'approved') return 'approved'
  return 'unknown'
}
