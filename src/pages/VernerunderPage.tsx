import { useMemo, useState } from 'react'
import { ClipboardList, Plus, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { VernerunderPage } from '../../modules/vernerunder/VernerunderPage'
import { VernerunderAdminPage } from './VernerunderAdminPage'
import { Tabs } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { ModulePageShell } from '../components/module/ModulePageShell'

type VernerunderRootTab = 'oversikt' | 'innstillinger'

/**
 * Thin route wrapper for `/vernerunder`.
 *
 * Mirrors `RosModulePage` / `InspectionModulePage`: when the user can
 * manage Vernerunder settings it renders a root-tab strip
 * (Oversikt / Innstillinger). The module view / admin body render inside
 * a shared `ModulePageShell` so the chrome stays stable across root tabs
 * — no double heading, no duplicate back-button on the embedded admin.
 * The existing `/vernerunder/admin` route still works (uses the
 * non-embedded `VernerunderAdminPage` shell).
 */
export function VernerunderPageRoute() {
  const navigate = useNavigate()
  const { can, isAdmin } = useOrgSetupContext()
  const canManageVernerunder = isAdmin || can('vernerunder.manage')
  const [rootTab, setRootTab] = useState<VernerunderRootTab>('oversikt')

  const rootTabItems = useMemo(() => {
    const items: { id: VernerunderRootTab; label: string; icon: typeof ClipboardList }[] = [
      { id: 'oversikt', label: 'Oversikt', icon: ClipboardList },
    ]
    if (canManageVernerunder) items.push({ id: 'innstillinger', label: 'Innstillinger', icon: Settings })
    return items
  }, [canManageVernerunder])

  const activeRootTab: VernerunderRootTab =
    rootTab === 'innstillinger' && !canManageVernerunder ? 'oversikt' : rootTab

  const rootTabsNode =
    rootTabItems.length > 1 ? (
      <Tabs
        items={rootTabItems}
        activeId={activeRootTab}
        onChange={(id) => setRootTab(id as VernerunderRootTab)}
      />
    ) : undefined

  if (activeRootTab === 'innstillinger' && canManageVernerunder) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'Vernerunder' }]}
        title="Vernerunder"
        description="Konfigurer maler, kategorier og arbeidsflyt for vernerunder."
        tabs={rootTabsNode}
        headerActions={
          <Button
            variant="primary"
            type="button"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => navigate('/vernerunder')}
          >
            Ny runde
          </Button>
        }
      >
        <VernerunderAdminPage embedded />
      </ModulePageShell>
    )
  }

  return <VernerunderPage hideAdminNav={canManageVernerunder} tabs={rootTabsNode} />
}
