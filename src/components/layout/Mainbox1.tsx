import type { ReactNode } from 'react'
import { mergeLayoutPayload, mainbox1PaddingClass, mainbox1ShellClass, mainbox1ShellStyleObject } from '../../lib/layoutLabTokens'
import { useUiThemeOptional } from '../../hooks/useUiTheme'
import { DEFAULT_LAYOUT_LAB, type LayoutLabPayload } from '../../types/layoutLab'

type Props = {
  children: ReactNode
  title?: string
  subtitle?: string
  payloadOverride?: LayoutLabPayload
}

export function Mainbox1({ children, title, subtitle, payloadOverride }: Props) {
  const ctx = useUiThemeOptional()
  const merged = mergeLayoutPayload(payloadOverride ?? ctx?.payload ?? DEFAULT_LAYOUT_LAB)
  const shell = mainbox1ShellClass(merged)
  const style = mainbox1ShellStyleObject(merged)
  const pad = mainbox1PaddingClass(merged)

  const body = title || subtitle ? <div className="mt-5">{children}</div> : children

  return (
    <div className={shell} style={style}>
      <div className={pad}>
        {title ? <h2 className="text-lg font-semibold text-neutral-900">{title}</h2> : null}
        {subtitle ? <p className="mt-2 text-sm text-neutral-600">{subtitle}</p> : null}
        {body}
      </div>
    </div>
  )
}
