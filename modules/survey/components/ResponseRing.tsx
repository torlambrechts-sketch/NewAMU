// SVG donut showing response completion rate (0–1) for a survey.
// Color-coded: ≥70 % forest green, ≥40 % amber, <40 % red.

export function ResponseRing({
  value,
  size = 40,
  strokeWidth = 4,
}: {
  value: number
  size?: number
  strokeWidth?: number
}) {
  const r = (size - strokeWidth) / 2
  const c = 2 * Math.PI * r
  const off = c * (1 - Math.min(1, Math.max(0, value)))
  const tone = value >= 0.7 ? '#1a3d32' : value >= 0.4 ? '#c98a2b' : '#b3382a'
  const cx = size / 2
  const cy = size / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E5E5E5" strokeWidth={strokeWidth} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={tone}
        strokeWidth={strokeWidth}
        strokeDasharray={c}
        strokeDashoffset={off}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text
        x="50%"
        y="50%"
        dy="0.35em"
        textAnchor="middle"
        style={{ fontSize: size * 0.3, fontWeight: 700, fill: '#1d1f1c' }}
      >
        {Math.round(value * 100)}
      </text>
    </svg>
  )
}
