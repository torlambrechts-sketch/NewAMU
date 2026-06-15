/* Route page: Strategy Tools → Execution (Initiatives). Renders the Execution
   workspace — Overview, Projects, Timeline, Roadmap, Kanban, Tasks plus the
   initiative detail + create/edit forms — inside the scoped tools shell. */

import { StrategyToolsShell } from './StrategyToolsShell'
import { ExecutionWorkspace } from './ExecutionWorkspace'

export function ExecutionPage() {
  return (
    <StrategyToolsShell>
      <ExecutionWorkspace />
    </StrategyToolsShell>
  )
}

export default ExecutionPage
