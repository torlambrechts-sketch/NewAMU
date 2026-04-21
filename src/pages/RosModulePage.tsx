import { useMemo, useState } from 'react'
import { ClipboardList, Plus, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { RosModuleView } from '../../modules/ros/RosModuleView'
import { RosModuleAdminPage } from './RosModuleAdminPage'
import { Tabs } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { ModulePageShell } from '../components/module/ModulePageShell'

type RosRootTab = 'oversikt' | 'innstillinger'

/**
 * Thin route wrapper for `/ros`.
 *
 * When the user can manage ROS settings, renders a root-tab strip
 * (Oversikt / Innstillinger). The module view / admin body render inside a
 * shared `ModulePageShell` so the chrome stays stable across root tabs — no
 * double heading, no duplicate back-button on the embedded admin.
 */
export function RosModulePage() {
  const navigate = useNavigate()
  const { supabase, can, isAdmin } = useOrgSetupContext()
  const canManageRos = isAdmin || can('ros.manage')
  const [rootTab, setRootTab] = useState<RosRootTab>('oversikt')

  const rootTabItems = useMemo(() => {
    const items: { id: RosRootTab; label: string; icon: typeof ClipboardList }[] = [
      { id: 'oversikt', label: 'Oversikt', icon: ClipboardList },
    ]
    if (canManageRos) items.push({ id: 'innstillinger', label: 'Innstillinger', icon: Settings })
    return items
  }, [canManageRos])

  const activeRootTab: RosRootTab =
    rootTab === 'innstillinger' && !canManageRos ? 'oversikt' : rootTab

  // Only render the root-tab strip when there's more than one root tab.
  const rootTabsNode =
    rootTabItems.length > 1 ? (
      <Tabs
        items={rootTabItems}
        activeId={activeRootTab}
        onChange={(id) => setRootTab(id as RosRootTab)}
      />
    ) : undefined

  // When Innstillinger is active, wrap the admin body in the same
  // ModulePageShell the view uses — this way root tabs stay visible and
  // chrome stays stable across tab switches.
  if (activeRootTab === 'innstillinger' && canManageRos) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'ROS-analyser' }]}
        title="Risikovurderinger"
        description="Konfigurer kategorier, maler og arbeidsflyt for ROS-analyser."
        tabs={rootTabsNode}
        headerActions={
          <Button
            variant="primary"
            type="button"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => navigate('/ros')}
          >
            Ny analyse
          </Button>
        }
      >
        <RosModuleAdminPage embedded />
      </ModulePageShell>
    )
  }

  return (
    <RosModuleView
      supabase={supabase}
      hideAdminNav={canManageRos}
      tabs={rootTabsNode}
    />
  )
}
