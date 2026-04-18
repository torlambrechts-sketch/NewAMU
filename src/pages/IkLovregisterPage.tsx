import { useCallback } from 'react'
import { useInternkontroll } from '../../modules/internkontroll/useInternkontroll'
import { IkLovregisterView } from '../../modules/internkontroll/IkLovregisterView'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import type { IkLegalRegisterRow } from '../../modules/internkontroll/types'
import { IkWorkplacePageShell } from '../components/internkontroll/IkWorkplacePageShell'

export function IkLovregisterPage() {
  const { legalRegister, canManage, refresh } = useInternkontroll()
  const { supabase } = useOrgSetupContext()

  const onUpsert = useCallback(async (row: Partial<IkLegalRegisterRow>) => {
    console.log('upsert', row)
  }, [])

  const onMarkReviewed = useCallback(
    async (id: string) => {
      if (!supabase) return
      const { error } = await supabase
        .from('ik_legal_register')
        .update({ reviewed_at: new Date().toISOString() })
        .eq('id', id)
      if (!error) void refresh()
      else console.error(getSupabaseErrorMessage(error))
    },
    [supabase, refresh],
  )

  return (
    <IkWorkplacePageShell
      breadcrumb={[{ label: 'HMS' }, { label: 'Internkontroll', to: '/internkontroll' }, { label: 'Lovregister' }]}
      title="Lovregister"
      description="Pilar 1 — kartlegging av gjeldende krav."
    >
      <IkLovregisterView rows={legalRegister} canManage={canManage} onUpsert={onUpsert} onMarkReviewed={onMarkReviewed} />
    </IkWorkplacePageShell>
  )
}
