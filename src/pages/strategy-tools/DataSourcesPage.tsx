/* Route page: Strategy Tools → Data sources. Renders the live-feeds read-view
   (connector sync status + freshness) inside the scoped tools shell. */

import { StrategyToolsShell } from './StrategyToolsShell'
import { DataSourcesView } from './DataSourcesView'

export function DataSourcesPage() {
  return (
    <StrategyToolsShell>
      <DataSourcesView />
    </StrategyToolsShell>
  )
}

export default DataSourcesPage
