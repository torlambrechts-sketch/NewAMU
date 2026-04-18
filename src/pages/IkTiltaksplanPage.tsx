import { useCallback } from 'react'
import { useInternkontroll } from '../../modules/internkontroll/useInternkontroll'
import { IkTiltaksplanView } from '../../modules/internkontroll/IkTiltaksplanView'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import type { IkActionPlanRow } from '../../modules/internkontroll/types'

export function IkTiltaksplanPage() {
  const { actionPlans, canManage, refresh } = useInternkontroll()
  const { supabase } = useOrgSetupContext()

  const onUpdateStatus = useCallback(async (id: string, status: IkActionPlanRow['status']) => {
    if (!supabase) return
    await supabase.from('ik_action_plans').update({
      status,
      ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
    }).eq('id', id)
    void refresh()
  }, [supabase, refresh])

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-neutral-900">Tiltaksplan</h1>
        <p className="mt-1 text-sm text-neutral-500">Pilar 5 & 8 — tiltak fra alle kilder samlet</p>
      </div>
      <IkTiltaksplanView
        plans={actionPlans}
        canManage={canManage}
        onUpsert={(plan) => console.log('upsert plan', plan)}
        onUpdateStatus={onUpdateStatus}
      />
    </div>
  )
}
