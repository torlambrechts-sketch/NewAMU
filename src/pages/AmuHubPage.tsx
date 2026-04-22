import { useMemo, useState } from 'react'
import { ClipboardList, Plus, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { AmuPage } from '../../modules/amu/AmuPage'
import { AmuModuleAdminPage } from './AmuModuleAdminPage'
import { Tabs } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { ModulePageShell } from '../components/module/ModulePageShell'

type AmuRootTab = 'mater' | 'innstillinger'

/**
 * Thin route wrapper for `/council/amu`.
 *
 * Mirrors `RosModulePage` / `InspectionModulePage` / `VernerunderPageRoute`
 * / `SjaModulePage`: when the user can manage AMU settings it renders a
 * root-tab strip (Møter / Innstillinger). The module view / admin body
 * render inside a shared `ModulePageShell` so the chrome stays stable
 * across root tabs — no double heading, no duplicate back-button on the
 * embedded admin. The existing `/council/amu/admin` route still works
 * (uses the non-embedded `AmuModuleAdminPage` shell).
 *
 * The `/council/amu/:meetingId` detail route continues to render the
 * module's `AmuPage` directly (it delegates to `AmuDetailView` internally
 * when a meetingId is present).
 */
export function AmuHubPage() {
  const navigate = useNavigate()
  const { can, isAdmin } = useOrgSetupContext()
  const canManageAmu = isAdmin || can('amu.manage')
  const [rootTab, setRootTab] = useState<AmuRootTab>('mater')

  const rootTabItems = useMemo(() => {
    const items: { id: AmuRootTab; label: string; icon: typeof ClipboardList }[] = [
      { id: 'mater', label: 'Møter', icon: ClipboardList },
    ]
    if (canManageAmu) items.push({ id: 'innstillinger', label: 'Innstillinger', icon: Settings })
    return items
  }, [canManageAmu])

  const activeRootTab: AmuRootTab =
    rootTab === 'innstillinger' && !canManageAmu ? 'mater' : rootTab

  const rootTabsNode =
    rootTabItems.length > 1 ? (
      <Tabs
        items={rootTabItems}
        activeId={activeRootTab}
        onChange={(id) => setRootTab(id as AmuRootTab)}
      />
    ) : undefined

  if (activeRootTab === 'innstillinger' && canManageAmu) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'Samarbeid' }, { label: 'AMU' }]}
        title="Arbeidsmiljøutvalg (AMU)"
        description="Konfigurer standard saksliste og arbeidsflyt for AMU-møter."
        tabs={rootTabsNode}
        headerActions={
          <Button
            variant="primary"
            type="button"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => navigate('/council/amu')}
          >
            Nytt møte
          </Button>
        }
      >
        <AmuModuleAdminPage embedded />
      </ModulePageShell>
    )
  }

  return <AmuPage hideAdminNav={canManageAmu} tabs={rootTabsNode} />
}
