import type { CSSProperties } from 'react'
import { mergeLayoutPayload, menu1BarStyleObject } from '../lib/layoutLabTokens'
import { useUiThemeOptional } from './useUiTheme'
import { DEFAULT_LAYOUT_LAB } from '../types/layoutLab'

/**
 * Dark gradient strip used for KPI/stat tiles (same token as legacy menu_1 bar).
 * Kept separate from hub tab styling so KPIs stay theme-aware without coupling to HubMenu1Bar.
 */
export function useWorkplaceKpiStripStyle() {
  const ctx = useUiThemeOptional()
  const merged = mergeLayoutPayload(ctx?.payload ?? DEFAULT_LAYOUT_LAB)
  return {
    barStyle: menu1BarStyleObject(merged) as CSSProperties,
  }
}
