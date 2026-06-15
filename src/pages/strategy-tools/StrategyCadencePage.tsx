/* Route page: Strategy Tools → Cadence. Renders the Cadence workspace —
   Check-ins & reminders, Reviews (Weekly · Business review · 1:1) and the
   Decision log — inside the scoped tools shell. Named StrategyCadencePage to
   avoid clashing with the unrelated CadencePage in pages/cadence/. */

import { StrategyToolsShell } from './StrategyToolsShell'
import { StrategyCadenceWorkspace } from './StrategyCadenceWorkspace'

export function StrategyCadencePage() {
  return (
    <StrategyToolsShell>
      <StrategyCadenceWorkspace />
    </StrategyToolsShell>
  )
}

export default StrategyCadencePage
