// Tiny initials avatar — used by the schema-driven cell renderer for
// person-like cells (employee, owner, responsible). Forest-palette
// so it sits inside register tiles without clashing.

type Props = {
  name: string
  size?: number
  tone?: 'forest' | 'cream' | 'sand'
}

const PALETTE: Record<NonNullable<Props['tone']>, { bg: string; fg: string }> = {
  forest: { bg: '#e7efe9', fg: '#1a3d32' },
  cream: { bg: '#f1ecdf', fg: '#5a4a2a' },
  sand: { bg: '#efe9d8', fg: '#6b5a2b' },
}

export function RegisterInitials({ name, size = 24, tone = 'forest' }: Props) {
  const parts = String(name).split(' ').filter(Boolean)
  const initials =
    (parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')
  const c = PALETTE[tone]
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        background: c.bg,
        color: c.fg,
        fontSize: Math.max(9, Math.round(size * 0.42)),
        letterSpacing: 0.2,
      }}
    >
      {initials.toUpperCase()}
    </span>
  )
}
