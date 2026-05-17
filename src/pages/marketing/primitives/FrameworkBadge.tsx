// Larger trust badge for the landing hero strip and /compliance grid.
// Shows the framework name, a paragraph-count proof, and a one-line summary.

import type { Framework } from '../content/compliance'

const FOREST = '#1a3d32'
const TEAL = '#2dd4bf'

type Props = {
  framework: Framework
  variant?: 'dark' | 'light'
}

export function FrameworkBadge({ framework, variant = 'dark' }: Props) {
  const isDark = variant === 'dark'
  const bg = isDark ? 'rgba(255,255,255,0.05)' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.12)' : '#e3ddcc'
  const heading = isDark ? '#ffffff' : FOREST
  const sub = isDark ? 'rgba(255,255,255,0.55)' : '#6b6f68'
  const accent = TEAL

  return (
    <div
      className="rounded-2xl p-5 transition-colors"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold tracking-tight" style={{ color: heading }}>
          {framework.short}
        </h3>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ background: `${accent}22`, color: accent }}
        >
          {framework.paragraphs.length} {framework.paragraphs.length === 1 ? 'paragraf' : 'paragrafer'}
        </span>
      </div>
      <p className="text-[11px] uppercase tracking-widest" style={{ color: sub }}>
        {framework.full}
      </p>
      <p className="mt-3 text-sm leading-relaxed" style={{ color: isDark ? 'rgba(255,255,255,0.75)' : '#1d1f1c' }}>
        {framework.summary}
      </p>
    </div>
  )
}
