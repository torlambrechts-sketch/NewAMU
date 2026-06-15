/* Route page: Strategy Tools → Frameworks. Renders the shared Frameworks /
   Whiteboard workspace in "frameworks" mode inside the scoped tools shell. */

import { StrategyToolsShell } from './StrategyToolsShell'
import { FrameworksWorkspace } from './FrameworksWorkspace'

export function FrameworksPage() {
  return (
    <StrategyToolsShell>
      <FrameworksWorkspace mode="frameworks" />
    </StrategyToolsShell>
  )
}

export default FrameworksPage
