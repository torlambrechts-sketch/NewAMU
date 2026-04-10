import type { ReactNode } from 'react'
import { ComplianceModuleChrome } from '../../components/compliance/ComplianceModuleChrome'
import type { HubMenu1Item } from '../../components/layout/HubMenu1Bar'

type Props = {
  description: ReactNode
  headerActions?: ReactNode
  hubItems: HubMenu1Item[]
  children: ReactNode
}

/** Per-tab wrapper so hub + breadcrumb stay visible (fixed overlays render inside tab content). */
export function InternalControlTabShell({ description, headerActions, hubItems, children }: Props) {
  return (
    <ComplianceModuleChrome
      breadcrumb={[
        { label: 'Workspace', to: '/' },
        { label: 'Samsvar', to: '/compliance' },
        { label: 'Internkontroll' },
      ]}
      title="Internkontroll"
      description={description}
      headerActions={headerActions}
      hubAriaLabel="Internkontroll — faner"
      hubItems={hubItems}
    >
      {children}
    </ComplianceModuleChrome>
  )
}
