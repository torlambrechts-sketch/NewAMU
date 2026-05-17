// Macos-style browser chrome wrapper for marketing screenshots.
// Extracted from the original LandingPage.tsx hero (lines 198-248).

import type { ReactNode } from 'react'

const FOREST_DEEP = '#0a2218'

type Props = {
  url?: string
  children: ReactNode
  tone?: 'dark' | 'light'
}

export function BrowserMockup({ url = 'app.klarert.com', children, tone = 'dark' }: Props) {
  const isDark = tone === 'dark'
  const bg = isDark ? FOREST_DEEP : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.1)' : '#e3ddcc'
  const chromeText = isDark ? 'rgba(255,255,255,0.4)' : '#6b6f68'
  const dividerColor = isDark ? 'rgba(255,255,255,0.1)' : '#e3ddcc'
  return (
    <div
      className="relative overflow-hidden rounded-t-2xl shadow-2xl shadow-black/30"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <div
        className="flex items-center gap-1.5 px-4 py-2.5"
        style={{ borderBottom: `1px solid ${dividerColor}` }}
      >
        <span className="size-3 rounded-full bg-red-500/70" />
        <span className="size-3 rounded-full bg-amber-500/70" />
        <span className="size-3 rounded-full bg-green-500/70" />
        <div
          className="ml-3 flex-1 rounded px-3 py-1 text-center text-xs"
          style={{
            border: `1px solid ${dividerColor}`,
            background: isDark ? 'rgba(255,255,255,0.05)' : '#f7f5ee',
            color: chromeText,
          }}
        >
          {url}
        </div>
      </div>
      {children}
    </div>
  )
}
