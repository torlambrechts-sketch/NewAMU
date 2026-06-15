/* Route page: Strategy Tools → Reports. Renders the board-ready Reports view
   (live strategy data + export menu) inside the scoped tools shell. */

import { StrategyToolsShell } from './StrategyToolsShell'
import { ReportsView } from './ReportsView'

export function ReportsPage() {
  return (
    <StrategyToolsShell>
      <ReportsView />
    </StrategyToolsShell>
  )
}

export default ReportsPage
