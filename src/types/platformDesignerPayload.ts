import type { UiBoxCoreDesign } from './uiBoxCore'
import { cloneUiBoxCore } from './uiBoxCore'
import type { UiTableCoreDesign } from './uiTableCore'
import { UI_TABLE_CORE_ID, cloneUiTableCore } from './uiTableCore'
import type { UiMenuCoreDesign } from './uiMenuCore'
import { UI_MENU_CORE_ID, cloneUiMenuCore } from './uiMenuCore'
import type { UiButtonCoreDesign } from './uiButtonCore'
import { UI_BUTTON_CORE_ID, cloneUiButtonCore } from './uiButtonCore'
import { deepMergeUiBox } from './uiBoxCore'

export type PlatformDesignerKind = 'ui_box_core' | 'ui_table_core' | 'ui_menu_core' | 'ui_button_core'

export type PlatformDesignerPayload =
  | UiBoxCoreDesign
  | UiTableCoreDesign
  | UiMenuCoreDesign
  | UiButtonCoreDesign

export function payloadKind(p: PlatformDesignerPayload): PlatformDesignerKind {
  switch (p.componentId) {
    case UI_TABLE_CORE_ID:
      return 'ui_table_core'
    case UI_MENU_CORE_ID:
      return 'ui_menu_core'
    case UI_BUTTON_CORE_ID:
      return 'ui_button_core'
    default:
      return 'ui_box_core'
  }
}

export function clonePayloadForKind(kind: PlatformDesignerKind): PlatformDesignerPayload {
  switch (kind) {
    case 'ui_table_core':
      return cloneUiTableCore()
    case 'ui_menu_core':
      return cloneUiMenuCore()
    case 'ui_button_core':
      return cloneUiButtonCore()
    default:
      return cloneUiBoxCore()
  }
}

export function mergePayload(
  base: PlatformDesignerPayload,
  patch: Partial<PlatformDesignerPayload>,
): PlatformDesignerPayload {
  return deepMergeUiBox(
    base as unknown as Record<string, unknown>,
    patch as Record<string, unknown>,
  ) as PlatformDesignerPayload
}

export const DESIGNER_KIND_LABELS: Record<PlatformDesignerKind, string> = {
  ui_box_core: 'Boks (ui_box_core)',
  ui_table_core: 'Tabell (ui_table_core)',
  ui_menu_core: 'Meny / faner (ui_menu_core)',
  ui_button_core: 'Knapp (ui_button_core)',
}
