/* Route page: Strategy Tools → Alignment map. Renders the cascading strategy
   alignment tree (company → pillar → team → objective → initiative) inside the
   scoped tools shell. */

import { StrategyToolsShell } from './StrategyToolsShell'
import { AlignmentView } from './AlignmentView'

export function AlignmentPage() {
  return (
    <StrategyToolsShell>
      <AlignmentView />
    </StrategyToolsShell>
  )
}

export default AlignmentPage
