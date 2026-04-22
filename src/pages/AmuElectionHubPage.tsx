import { useMemo, useState } from 'react'
import { ClipboardList, Settings } from 'lucide-react'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { AmuElectionPage } from '../../modules/amu_election/AmuElectionPage'
import { AmuElectionAdminPage } from './AmuElectionAdminPage'
import { Tabs } from '../components/ui/Tabs'
import { ModulePageShell } from '../components/module/ModulePageShell'

type AmuElectionRootTab = 'valg' | 'innstillinger'

/**
 * Thin route wrapper for `/internkontroll/amu-valg`.
 *
 * Mirrors `RosModulePage` / `InspectionModulePage` / `VernerunderPageRoute`
 * / `SjaModulePage` / `AmuHubPage`: when the user can manage AMU-valg
 * settings it renders a root-tab strip (Valg / Innstillinger). The module
 * view / admin body render inside a shared `ModulePageShell` so the
 * chrome stays stable across root tabs — no double heading, no duplicate
 * back-button on the embedded admin. The existing
 * `/internkontroll/amu-valg/admin` route still works (uses the
 * non-embedded `AmuElectionAdminPage` shell).
 *
 * The `/internkontroll/amu-valg/:electionId` detail route continues to
 * render `AmuElectionDetailPage` directly.
 */
export function AmuElectionHubPage() {
  const { supabase, can, isAdmin } = useOrgSetupContext()
  const canManage =
    isAdmin || can('amu_election.manage') || can('internkontroll.manage') || can('ik.manage')
  const [rootTab, setRootTab] = useState<AmuElectionRootTab>('valg')

  const rootTabItems = useMemo(() => {
    const items: { id: AmuElectionRootTab; label: string; icon: typeof ClipboardList }[] = [
      { id: 'valg', label: 'Valg', icon: ClipboardList },
    ]
    if (canManage) items.push({ id: 'innstillinger', label: 'Innstillinger', icon: Settings })
    return items
  }, [canManage])

  const activeRootTab: AmuElectionRootTab =
    rootTab === 'innstillinger' && !canManage ? 'valg' : rootTab

  const rootTabsNode =
    rootTabItems.length > 1 ? (
      <Tabs
        items={rootTabItems}
        activeId={activeRootTab}
        onChange={(id) => setRootTab(id as AmuElectionRootTab)}
      />
    ) : undefined

  if (activeRootTab === 'innstillinger' && canManage) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'Internkontroll', to: '/internkontroll' }, { label: 'AMU-valg' }]}
        title="AMU-valg"
        description="Konfigurer stemmeperiode, valgstyre og arbeidsflyt for AMU-valg."
        tabs={rootTabsNode}
      >
        <AmuElectionAdminPage embedded />
      </ModulePageShell>
    )
  }

  return (
    <AmuElectionPage
      supabase={supabase}
      hideAdminNav={canManage}
      tabs={rootTabsNode}
    />
  )
}
