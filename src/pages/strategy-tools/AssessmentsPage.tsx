/* Route page: Strategy Tools → Assessments. Renders the interactive
   diagnostics view inside the scoped tools shell. */

import { StrategyToolsShell } from './StrategyToolsShell'
import { AssessmentsView } from './AssessmentsView'

export function AssessmentsPage() {
  return (
    <StrategyToolsShell>
      <AssessmentsView />
    </StrategyToolsShell>
  )
}

export default AssessmentsPage
