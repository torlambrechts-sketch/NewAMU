import type { ReactNode } from 'react'

/** Matches layout-reference Job Postings / Pinpoint forest green */
export const TASK_POSTINGS_FOREST = '#1a3d32'

export const TASK_POSTINGS_SERIF = "'Libre Baskerville', Georgia, serif"

/** Rounded white card like `WhiteCard` in PlatformPinpointLayoutsPage */
export function PostingsStyleSurface({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-lg border border-neutral-200/80 bg-white shadow-sm ${className}`}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      {children}
    </div>
  )
}
