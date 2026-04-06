import type { CSSProperties } from 'react'
import { mergeLayoutPayload, menu1ActiveTabClass, menu1ActiveTabTextStyle, menu1BarStyleObject, menu1InactiveTabClass } from '../lib/layoutLabTokens'
import { useUiThemeOptional } from './useUiTheme'
import { DEFAULT_LAYOUT_LAB } from '../types/layoutLab'

export function useOrgMenu1Styles() {
  const ctx = useUiThemeOptional()
  const merged = mergeLayoutPayload(ctx?.payload ?? DEFAULT_LAYOUT_LAB)

  return {
    barStyle: menu1BarStyleObject(merged) as CSSProperties,
    tabButton: (active: boolean) => ({
      className: active ? menu1ActiveTabClass(merged) : menu1InactiveTabClass(merged),
      style: (active ? menu1ActiveTabTextStyle(merged) : undefined) as CSSProperties | undefined,
    }),
  }
}
