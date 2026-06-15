/* Route page: Strategy Tools → Settings. Renders the unified Settings view
   (modules · members · branding · frameworks · custom fields · templates ·
   notifications · integrations · import/export) inside the scoped tools shell,
   mirroring FoundationPage. */

import { StrategyToolsShell } from './StrategyToolsShell'
import { SettingsView } from './SettingsView'

export function SettingsPage() {
  return (
    <StrategyToolsShell>
      <SettingsView />
    </StrategyToolsShell>
  )
}

export default SettingsPage
