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
      className={`flex h-20 w-36 shrink-0 items-center justify-center rounded-2xl shadow-md md:h-24 md:w-44 ${className}`}
    >
      {children}
    </div>
  )
}
