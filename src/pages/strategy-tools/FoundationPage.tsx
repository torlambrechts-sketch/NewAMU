/* Route page: Strategy Tools → Foundation. Renders the Foundation view
   (vision · mission · ambition · values · intent cascade) inside the scoped
   tools shell, mirroring FrameworksPage. */

import { StrategyToolsShell } from './StrategyToolsShell'
import { FoundationView } from './FoundationView'

export function FoundationPage() {
  return (
    <StrategyToolsShell>
      <FoundationView />
    </StrategyToolsShell>
  )
}

export default FoundationPage
