import { DocumentCenterProvider } from '../../contexts/DocumentCenterContext'
import { DashboardsPage } from './DashboardsPage'

export function DashboardsLayout() {
  return (
    <DocumentCenterProvider>
      <DashboardsPage />
    </DocumentCenterProvider>
  )
}
