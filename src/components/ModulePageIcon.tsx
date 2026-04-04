import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** Container: wide tile for module heroes (default: forest green box). */
  className?: string
}

/**
 * Wide hero icon tile used next to page titles (onboarding, settings, module headers).
 * Wider than tall so Lucide/mark fits without looking squeezed.
 */
export function ModulePageIcon({ children, className = '' }: Props) {
  return (
    <div
      className={`flex h-16 w-28 shrink-0 items-center justify-center rounded-2xl shadow-sm md:h-20 md:w-36 ${className}`}
    >
      {children}
    </div>
  )
}
