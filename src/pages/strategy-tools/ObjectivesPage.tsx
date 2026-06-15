/* Route page: Strategy Tools → Objectives (OKR tree + Strategy map). Renders the
   Objectives workspace inside the scoped tools shell; the ?view= switch (tree ·
   map) is driven by app nav. Mirrors FrameworksPage. */

import { StrategyToolsShell } from './StrategyToolsShell'
import { ObjectivesWorkspace } from './ObjectivesWorkspace'

export function ObjectivesPage() {
  return (
    <StrategyToolsShell>
      <ObjectivesWorkspace />
    </StrategyToolsShell>
  )
}

export default ObjectivesPage
