import { useCallback } from 'react'
import { useInternkontroll } from '../../modules/internkontroll/useInternkontroll'
import { IkTiltaksplanView } from '../../modules/internkontroll/IkTiltaksplanView'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import type { IkActionPlanRow } from '../../modules/internkontroll/types'
import { IkWorkplacePageShell } from '../components/internkontroll/IkWorkplacePageShell'

export function IkTiltaksplanPage() {
  const { actionPlans, canManage, refresh } = useInternkontroll()
  const { supabase } = useOrgSetupContext()

  const onUpdateStatus = useCallback(
    async (id: string, status: IkActionPlanRow['status']) => {
      if (!supabase) return
      await supabase
        .from('ik_action_plans')
        .update({
          status,
          ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
        })
        .eq('id', id)
      void refresh()
    },
    [supabase, refresh],
  )

  return (
    <IkWorkplacePageShell
      breadcrumb={[{ label: 'HMS' }, { label: 'Internkontroll', to: '/internkontroll' }, { label: 'Tiltaksplan' }]}
      title="Tiltaksplan"
      description="Pilar 5 & 8 — tiltak fra alle kilder samlet."
    >
      <IkTiltaksplanView
        plans={actionPlans}
        canManage={canManage}
        onUpsert={(plan) => console.log('upsert plan', plan)}
        onUpdateStatus={onUpdateStatus}
      />
    </IkWorkplacePageShell>
  )
}
