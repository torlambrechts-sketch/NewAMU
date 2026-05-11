// Stable, hash-derived colour per user id for presence avatars and lock
// indicators. Same id → same hue across sessions and devices, so colleagues
// recognise each other in a glance. Colours pulled from the design system's
// chip palette so they sit well next to module accents.

const PRESENCE_PALETTE = [
  { ring: '#1a3d32', soft: '#dcfce7', text: '#14532d' }, // emerald
  { ring: '#7c3aed', soft: '#ede9fe', text: '#4c1d95' }, // violet
  { ring: '#c2410c', soft: '#ffedd5', text: '#7c2d12' }, // amber
  { ring: '#0e7490', soft: '#cffafe', text: '#155e75' }, // teal
  { ring: '#4338ca', soft: '#e0e7ff', text: '#312e81' }, // indigo
  { ring: '#be185d', soft: '#fce7f3', text: '#831843' }, // pink
  { ring: '#9333ea', soft: '#f3e8ff', text: '#581c87' }, // purple
  { ring: '#0d9488', soft: '#ccfbf1', text: '#134e4a' }, // deep teal
] as const

export type PresenceColor = (typeof PRESENCE_PALETTE)[number]

export function presenceColorFor(userId: string): PresenceColor {
  if (!userId) return PRESENCE_PALETTE[0]
  let hash = 0
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0
  }
  const idx = Math.abs(hash) % PRESENCE_PALETTE.length
  return PRESENCE_PALETTE[idx]
}

export function initialsFromDisplayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
}
