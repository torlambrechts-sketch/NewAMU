/* Route page: Strategy Tools → Whiteboard. Renders the shared Frameworks /
   Whiteboard workspace in "whiteboard" mode inside the scoped tools shell. */

import { StrategyToolsShell } from './StrategyToolsShell'
import { FrameworksWorkspace } from './FrameworksWorkspace'

export function WhiteboardPage() {
  return (
    <StrategyToolsShell>
      <FrameworksWorkspace mode="whiteboard" />
    </StrategyToolsShell>
  )
}

export default WhiteboardPage
