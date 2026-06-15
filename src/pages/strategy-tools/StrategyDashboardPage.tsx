/* Route page: Strategy Tools → Dashboard. Renders the customizable widget-grid
   Dashboard view inside the scoped tools shell. Prefixed `Strategy` to avoid the
   unrelated app-level pages/dashboard/DashboardPage. */

import { StrategyToolsShell } from './StrategyToolsShell'
import { StrategyDashboardView } from './StrategyDashboardView'

export function StrategyDashboardPage() {
  return (
    <StrategyToolsShell>
      <StrategyDashboardView />
    </StrategyToolsShell>
  )
}

export default StrategyDashboardPage
