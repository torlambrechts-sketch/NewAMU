import { useMemo, useState } from 'react'
import { ClipboardList, Plus, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { SjaModuleView } from '../../modules/sja/SjaModuleView'
import { SjaModuleAdminView } from '../../modules/sja/SjaModuleAdminView'
import { Tabs } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { ModulePageShell } from '../components/module/ModulePageShell'

type SjaRootTab = 'oversikt' | 'innstillinger'

/**
 * Thin route wrapper for `/sja`.
 *
 * Mirrors `RosModulePage` / `InspectionModulePage` /
 * `VernerunderPageRoute`: when the user can manage SJA settings it
 * renders a root-tab strip (Oversikt / Innstillinger). The module view /
 * admin body render inside a shared `ModulePageShell` so the chrome
 * stays stable across root tabs — no double heading, no duplicate
 * back-button on the embedded admin. The existing `/sja/admin` route
 * still works (uses the non-embedded `SjaModuleAdminView` shell via
 * `SjaModuleAdminPage`).
 */
export function SjaModulePage() {
  const navigate = useNavigate()
  const { supabase, can, isAdmin, organization } = useOrgSetupContext()
  const canManageSja = isAdmin || can('sja.manage')
  const [rootTab, setRootTab] = useState<SjaRootTab>('oversikt')

  const rootTabItems = useMemo(() => {
    const items: { id: SjaRootTab; label: string; icon: typeof ClipboardList }[] = [
      { id: 'oversikt', label: 'Oversikt', icon: ClipboardList },
    ]
    if (canManageSja) items.push({ id: 'innstillinger', label: 'Innstillinger', icon: Settings })
    return items
  }, [canManageSja])

  const activeRootTab: SjaRootTab =
    rootTab === 'innstillinger' && !canManageSja ? 'oversikt' : rootTab

  const rootTabsNode =
    rootTabItems.length > 1 ? (
      <Tabs
        items={rootTabItems}
        activeId={activeRootTab}
        onChange={(id) => setRootTab(id as SjaRootTab)}
      />
    ) : undefined

  if (activeRootTab === 'innstillinger' && canManageSja) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'Sikker jobbanalyse' }]}
        title="Sikker jobbanalyse"
        description="Konfigurer maler, lokasjoner og tilganger for sikker jobbanalyse."
        tabs={rootTabsNode}
        headerActions={
          <Button
            variant="primary"
            type="button"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => navigate('/sja')}
          >
            Ny analyse
          </Button>
        }
      >
        <SjaModuleAdminView
          supabase={supabase}
          canManageRbac={isAdmin}
          organizationId={organization?.id ?? null}
          embedded
        />
      </ModulePageShell>
    )
  }

  return (
    <SjaModuleView
      supabase={supabase}
      hideAdminNav={canManageSja}
      tabs={rootTabsNode}
    />
  )
}
