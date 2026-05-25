import type { ReactNode } from 'react'

// Page-level horizontal container with four content-width modes and a
// responsive padding ladder. Replaces the hand-written
// `mx-auto max-w-[1400px] px-4 md:px-8` repeated across ~30 page shells.
//
// Width choices:
//   comfort — reading + single-column forms (~720px)
//   default — lists, detail editors (current 1400px ceiling)
//   wide    — dashboards, Kanban, deep tables (1760px ceiling)
//   full    — canvas surfaces that own their own width (no cap)
//
// Padding scales with viewport so wide monitors get more breathing room
// rather than dead gutters: 16 → 24 → 32 → 40 → 48 → 64 (px) at
// sm / lg / xl / 2xl / 3xl. The 3xl/4xl breakpoints are defined in
// `src/index.css` (@theme) and resolve to 1920px / 2560px.

export type PageWidth = 'comfort' | 'default' | 'wide' | 'full'

const WIDTHS: Record<PageWidth, string> = {
  comfort: 'max-w-[72ch]',
  default: 'max-w-[1400px]',
  wide: 'max-w-[1760px]',
  full: 'max-w-none',
}

const PADDING_X = 'px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 3xl:px-16 4xl:px-20'

export interface PageContainerProps {
  width?: PageWidth
  /** Extra utility classes appended after the container defaults. */
  className?: string
  /** Vertical padding override; omit to let the caller handle py. */
  py?: string
  children: ReactNode
}

export function PageContainer({
  width = 'default',
  className,
  py,
  children,
}: PageContainerProps) {
  const cls = ['mx-auto', WIDTHS[width], PADDING_X, py, className]
    .filter(Boolean)
    .join(' ')
  return <div className={cls}>{children}</div>
}
