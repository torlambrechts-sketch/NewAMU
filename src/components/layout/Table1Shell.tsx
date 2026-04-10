import type { ReactNode } from 'react'
import { mergeLayoutPayload, table1ShellClass } from '../../lib/layoutLabTokens'
import { useUiThemeOptional } from '../../hooks/useUiTheme'
import { DEFAULT_LAYOUT_LAB, type LayoutLabPayload } from '../../types/layoutLab'

export function Table1Shell({
  children,
  toolbar,
  payloadOverride,
  /** Layout-reference / Postings: rounded white card with soft shadow (ignores lab radius for the shell). */
  variant = 'default',
}: {
  children: ReactNode
  toolbar?: ReactNode
  payloadOverride?: LayoutLabPayload
  variant?: 'default' | 'pinpoint'
}) {
  const ctx = useUiThemeOptional()
  const merged = mergeLayoutPayload(payloadOverride ?? ctx?.payload ?? DEFAULT_LAYOUT_LAB)
  const shellClass =
    variant === 'pinpoint'
      ? 'overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm'
      : table1ShellClass(merged)
  return (
    <div
      className={shellClass}
      style={variant === 'pinpoint' ? { boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } : undefined}
    >
      {toolbar}
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}
