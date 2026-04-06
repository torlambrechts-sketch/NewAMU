import type { ReactNode } from 'react'
import { mergeLayoutPayload, table1ShellClass } from '../../lib/layoutLabTokens'
import { useUiThemeOptional } from '../../hooks/useUiTheme'
import { DEFAULT_LAYOUT_LAB, type LayoutLabPayload } from '../../types/layoutLab'

export function Table1Shell({
  children,
  toolbar,
  payloadOverride,
}: {
  children: ReactNode
  toolbar?: ReactNode
  payloadOverride?: LayoutLabPayload
}) {
  const ctx = useUiThemeOptional()
  const merged = mergeLayoutPayload(payloadOverride ?? ctx?.payload ?? DEFAULT_LAYOUT_LAB)
  return (
    <div className={table1ShellClass(merged)}>
      {toolbar}
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}
