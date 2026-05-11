// Møter — route wrapper / root-tab orchestrator.
//
// Mirrors VernerunderPageRoute / RosModulePage: holds the
// `rootTab` state and toggles between the hub view (Oversikt) and the
// embedded admin (Innstillinger) inside a shared `ModulePageShell` so
// chrome stays stable across tabs.

import { useMemo, useState } from 'react'
import { ClipboardList, Plus, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { Tabs } from '../../components/ui/Tabs'
import { Button } from '../../components/ui/Button'
import { ModulePageShell } from '../../components/module/ModulePageShell'
import { MeetingsHubView } from '../../../modules/meetings/MeetingsHubView'
import { MeetingsAdminPage } from './MeetingsAdminPage'

type RootTab = 'oversikt' | 'innstillinger'

export function MeetingsHubPage() {
  const navigate = useNavigate()
  const { can, isAdmin } = useOrgSetupContext()
  const canManageMeetings = isAdmin || can('meetings.manage')
  const [rootTab, setRootTab] = useState<RootTab>('oversikt')

  const rootTabItems = useMemo(() => {
    const items: { id: RootTab; label: string; icon: typeof ClipboardList }[] = [
      { id: 'oversikt', label: 'Oversikt', icon: ClipboardList },
    ]
    if (canManageMeetings) items.push({ id: 'innstillinger', label: 'Innstillinger', icon: Settings })
    return items
  }, [canManageMeetings])

  const activeRootTab: RootTab =
    rootTab === 'innstillinger' && !canManageMeetings ? 'oversikt' : rootTab

  const rootTabsNode =
    rootTabItems.length > 1 ? (
      <Tabs
        items={rootTabItems}
        activeId={activeRootTab}
        onChange={(id) => setRootTab(id as RootTab)}
      />
    ) : undefined

  if (activeRootTab === 'innstillinger' && canManageMeetings) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'Møter' }]}
        title="Møter"
        description="Konfigurer maler og kategorier for møtemodulen."
        tabs={rootTabsNode}
        headerActions={
          <Button
            variant="primary"
            type="button"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => navigate('/meetings')}
          >
            Nytt møte
          </Button>
        }
      >
        <MeetingsAdminPage embedded />
      </ModulePageShell>
    )
  }

  return <MeetingsHubView hideAdminNav={canManageMeetings} tabs={rootTabsNode} />
}
