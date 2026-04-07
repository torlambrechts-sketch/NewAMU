import type { PlatformDesignerPayload } from '../../types/platformDesignerPayload'
import { payloadKind } from '../../types/platformDesignerPayload'
import { UiBoxCorePreview } from './UiBoxCorePreview'
import { UiTableCorePreview } from './UiTableCorePreview'
import { UiMenuCorePreview } from './UiMenuCorePreview'
import { UiButtonCorePreview } from './UiButtonCorePreview'
import type { UiBoxCoreDesign } from '../../types/uiBoxCore'
import type { UiTableCoreDesign } from '../../types/uiTableCore'
import type { UiMenuCoreDesign } from '../../types/uiMenuCore'
import type { UiButtonCoreDesign } from '../../types/uiButtonCore'

export function ComponentDesignPreview({ payload }: { payload: PlatformDesignerPayload | null | undefined }) {
  if (!payload || !payload.componentId) {
    return <p className="text-xs text-neutral-500">Ingen komponentdata.</p>
  }
  const kind = payloadKind(payload)
  switch (kind) {
    case 'ui_table_core':
      return <UiTableCorePreview design={payload as UiTableCoreDesign} />
    case 'ui_menu_core':
      return <UiMenuCorePreview design={payload as UiMenuCoreDesign} />
    case 'ui_button_core':
      return <UiButtonCorePreview design={payload as UiButtonCoreDesign} />
    default:
      return <UiBoxCorePreview design={payload as UiBoxCoreDesign} />
  }
}
