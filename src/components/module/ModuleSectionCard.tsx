import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import { WORKPLACE_MODULE_CARD, WORKPLACE_MODULE_CARD_SHADOW } from '../layout/workplaceModuleSurface'

/**
 * Standard white surface for a single tab/section inside a module page.
 *
 * Replaces the repeated pattern:
 *
 * ```tsx
 * <div className={`${WORKPLACE_MODULE_CARD} overflow-hidden`} style={WORKPLACE_MODULE_CARD_SHADOW}>
 *   …
 * </div>
 * ```
 *
 * Use {@link ModuleSectionCard} as the outermost wrapper for every tab panel so every
 * module shares the same border-radius, border, shadow and overflow-clip behaviour.
 */
export interface ModuleSectionCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** `tight` — removes `overflow-hidden` when children control clipping explicitly. */
  clip?: 'hidden' | 'visible'
}

export function ModuleSectionCard({
  children,
  className,
  style,
  clip = 'hidden',
  ...props
}: ModuleSectionCardProps) {
  const clipClass = clip === 'hidden' ? 'overflow-hidden' : ''
  const combinedStyle: CSSProperties = { ...WORKPLACE_MODULE_CARD_SHADOW, ...(style ?? {}) }
  return (
    <div className={twMerge(WORKPLACE_MODULE_CARD, clipClass, className)} style={combinedStyle} {...props}>
      {children}
    </div>
  )
}
