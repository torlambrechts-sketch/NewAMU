/* Route page: Strategy Tools → Accountability. Renders the Accountability view
   (gap queue · what I'm accountable for · charters · status history) inside the
   scoped tools shell, mirroring FrameworksPage. */

import { StrategyToolsShell } from './StrategyToolsShell'
import { AccountabilityView } from './AccountabilityView'

export function AccountabilityPage() {
  return (
    <StrategyToolsShell>
      <AccountabilityView />
    </StrategyToolsShell>
  )
}

export default AccountabilityPage
