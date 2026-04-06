import type { CSSProperties, ReactNode } from 'react'
import type { LayoutLabPayload } from '../../types/layoutLab'
import {
  mergeLayoutPayload,
  sidebarBox1ButtonClass,
  sidebarBox1ButtonStyleObject,
  sidebarBox1HeadingClassFromPayload,
  sidebarBox1Padding,
  sidebarBox1ShellClass,
} from '../../lib/layoutLabTokens'
import { useUiThemeOptional } from '../../hooks/useUiTheme'
import { DEFAULT_LAYOUT_LAB } from '../../types/layoutLab'

export type SidebarBox1PrimaryProps = {
  className: string
  style: CSSProperties | undefined
}

type Props = {
  heading: string
  subheading?: string
  children: ReactNode
  /** Primary action — receives Layout Lab classes (omit for no button row) */
  primaryAction?: (props: SidebarBox1PrimaryProps) => ReactNode
  payloadOverride?: LayoutLabPayload
}

export function SidebarBox1({ heading, subheading, children, primaryAction, payloadOverride }: Props) {
  const ctx = useUiThemeOptional()
  const merged = mergeLayoutPayload(payloadOverride ?? ctx?.payload ?? DEFAULT_LAYOUT_LAB)
  const shell = sidebarBox1ShellClass(merged)
  const pad = sidebarBox1Padding(merged)
  const hClass = sidebarBox1HeadingClassFromPayload(merged)
  const btnClass = sidebarBox1ButtonClass(merged)
  const btnStyle = sidebarBox1ButtonStyleObject(merged)

  return (
    <div className={shell}>
      <div className={pad}>
        <h2 className={hClass}>{heading}</h2>
        {subheading ? <p className="mt-1 text-xs text-neutral-500">{subheading}</p> : null}
        <div className="mt-4 space-y-3">{children}</div>
        {primaryAction ? <div className="mt-4">{primaryAction({ className: btnClass, style: btnStyle })}</div> : null}
      </div>
    </div>
  )
}
