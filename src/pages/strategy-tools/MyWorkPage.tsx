/* Route page: Strategy Tools → My Work. Renders the role-scoped "My Work" home
   view inside the scoped tools shell (people/date context + toast channel). */

import { StrategyToolsShell } from './StrategyToolsShell'
import { MyWorkView } from './MyWorkView'

export function MyWorkPage() {
  return (
    <StrategyToolsShell>
      <MyWorkView />
    </StrategyToolsShell>
  )
}

export default MyWorkPage
