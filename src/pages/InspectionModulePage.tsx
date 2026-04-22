import { useMemo, useState } from 'react'
import { ClipboardList, Plus, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { InspectionModuleView } from '../../modules/inspection/InspectionModuleView'
import { InspectionModuleAdminPage } from './InspectionModuleAdminPage'
import { Tabs } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { ModulePageShell } from '../components/module/ModulePageShell'

type InspectionRootTab = 'oversikt' | 'innstillinger'

/**
 * Thin route wrapper for `/inspection-module`.
 *
 * Mirrors `RosModulePage`: when the user can manage Inspection settings it
 * renders a root-tab strip (Oversikt / Innstillinger). The module view /
 * admin body render inside a shared `ModulePageShell` so the chrome stays
 * stable across root tabs — no double heading, no duplicate back-button on
 * the embedded admin. The existing `/inspection-module/admin` route still
 * works (uses the non-embedded `InspectionModuleAdminPage` shell).
 */
export function InspectionModulePage() {
  const navigate = useNavigate()
  const { supabase, can, isAdmin } = useOrgSetupContext()
  const canManageInspection = isAdmin || can('inspection.manage')
  const [rootTab, setRootTab] = useState<InspectionRootTab>('oversikt')

  const rootTabItems = useMemo(() => {
    const items: { id: InspectionRootTab; label: string; icon: typeof ClipboardList }[] = [
      { id: 'oversikt', label: 'Oversikt', icon: ClipboardList },
    ]
    if (canManageInspection) items.push({ id: 'innstillinger', label: 'Innstillinger', icon: Settings })
    return items
  }, [canManageInspection])

  const activeRootTab: InspectionRootTab =
    rootTab === 'innstillinger' && !canManageInspection ? 'oversikt' : rootTab

  // Only render the root-tab strip when there's more than one root tab.
  const rootTabsNode =
    rootTabItems.length > 1 ? (
      <Tabs
        items={rootTabItems}
        activeId={activeRootTab}
        onChange={(id) => setRootTab(id as InspectionRootTab)}
      />
    ) : undefined

  // When Innstillinger is active, wrap the admin body in the same
  // ModulePageShell the view uses — this way root tabs stay visible and
  // chrome stays stable across tab switches.
  if (activeRootTab === 'innstillinger' && canManageInspection) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'Inspeksjonsrunder' }]}
        title="Inspeksjonsrunder"
        description="Konfigurer maler, lokasjoner, signeringsregler og arbeidsflyt for vernerunder."
        tabs={rootTabsNode}
        headerActions={
          <Button
            variant="primary"
            type="button"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => navigate('/inspection-module')}
          >
            Ny runde
          </Button>
        }
      >
        <InspectionModuleAdminPage embedded />
      </ModulePageShell>
    )
  }

  return (
    <InspectionModuleView
      supabase={supabase}
      hideAdminNav={canManageInspection}
      tabs={rootTabsNode}
    />
  )
}
