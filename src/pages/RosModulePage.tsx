import { useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ClipboardList, Settings } from 'lucide-react'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { RosModuleView } from '../../modules/ros/RosModuleView'
import { RosModuleAdminPage } from './RosModuleAdminPage'
import { Tabs } from '../components/ui/Tabs'

type RosRootTab = 'oversikt' | 'innstillinger'

export function RosModulePage() {
  const { supabase, can, isAdmin } = useOrgSetupContext()
  const canManageRos = isAdmin || can('ros.manage')
  const [rootTab, setRootTab] = useState<RosRootTab>('oversikt')

  const rootTabItems = useMemo(() => {
    const items: { id: RosRootTab; label: string; icon: LucideIcon }[] = [
      { id: 'oversikt', label: 'Oversikt', icon: ClipboardList },
    ]
    if (canManageRos) items.push({ id: 'innstillinger', label: 'Innstillinger', icon: Settings })
    return items
  }, [canManageRos])

  const activeRootTab: RosRootTab =
    rootTab === 'innstillinger' && !canManageRos ? 'oversikt' : rootTab

  return (
    <div className="min-h-screen bg-[#F9F7F2]">
      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-8">
        <Tabs items={rootTabItems} activeId={activeRootTab} onChange={(id) => setRootTab(id as RosRootTab)} />

        {activeRootTab === 'oversikt' && <RosModuleView supabase={supabase} hideAdminNav={canManageRos} />}
        {activeRootTab === 'innstillinger' && canManageRos ? <RosModuleAdminPage embedded /> : null}
      </div>
    </div>
  )
}
