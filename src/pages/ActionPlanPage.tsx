import { useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ClipboardList, Settings } from 'lucide-react'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { WorkplacePageHeading1 } from '../components/layout/WorkplacePageHeading1'
import { ActionPlanView } from '../../modules/action_plan/ActionPlanView'
import { ActionPlanAdminPage } from './ActionPlanAdminPage'
import { Tabs } from '../components/ui/Tabs'

type RootTab = 'oversikt' | 'innstillinger'

/**
 * Hovedside for tiltaksplanen (eget modul, path `/tiltak` eller `/action-plan` via App.tsx).
 */
export function ActionPlanPage() {
  const { supabase, can, isAdmin } = useOrgSetupContext()
  const canManage = isAdmin || can('action_plan.manage')
  const [rootTab, setRootTab] = useState<RootTab>('oversikt')

  const rootTabItems = useMemo(() => {
    const items: { id: RootTab; label: string; icon: LucideIcon }[] = [
      { id: 'oversikt', label: 'Oversikt', icon: ClipboardList },
    ]
    if (canManage) {
      items.push({ id: 'innstillinger', label: 'Innstillinger', icon: Settings })
    }
    return items
  }, [canManage])

  const activeRoot: RootTab =
    rootTab === 'innstillinger' && !canManage ? 'oversikt' : rootTab

  return (
    <div className="min-h-screen bg-[#F9F7F2]">
      <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-6 md:px-8">
        <WorkplacePageHeading1
          breadcrumb={[{ label: 'HMS' }, { label: 'Tiltaksplan' }]}
          title="Tiltaksplan"
          description="Oppfølging av korrigerende og forebyggende tiltak med ansvar, frist og status."
        />
        <Tabs items={rootTabItems} activeId={activeRoot} onChange={(id) => setRootTab(id as RootTab)} />

        {activeRoot === 'oversikt' && <ActionPlanView supabase={supabase} embedded />}

        {activeRoot === 'innstillinger' && canManage ? <ActionPlanAdminPage embedded /> : null}
      </div>
    </div>
  )
}
