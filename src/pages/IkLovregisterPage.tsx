import { useCallback } from 'react'
import { useInternkontroll } from '../../modules/internkontroll/useInternkontroll'
import { IkLovregisterView } from '../../modules/internkontroll/IkLovregisterView'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import type { IkLegalRegisterRow } from '../../modules/internkontroll/types'

export function IkLovregisterPage() {
  const { legalRegister, canManage, refresh } = useInternkontroll()
  const { supabase } = useOrgSetupContext()

  const onUpsert = useCallback(async (row: Partial<IkLegalRegisterRow>) => {
    // Open a modal/drawer — wire up to your existing modal pattern
    console.log('upsert', row)
  }, [])

  const onMarkReviewed = useCallback(async (id: string) => {
    if (!supabase) return
    const { error } = await supabase
      .from('ik_legal_register')
      .update({ reviewed_at: new Date().toISOString() })
      .eq('id', id)
    if (!error) void refresh()
    else console.error(getSupabaseErrorMessage(error))
  }, [supabase, refresh])

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-neutral-900">Lovregister</h1>
        <p className="mt-1 text-sm text-neutral-500">Pilar 1 — kartlegging av gjeldende krav</p>
      </div>
      <IkLovregisterView rows={legalRegister} canManage={canManage} onUpsert={onUpsert} onMarkReviewed={onMarkReviewed} />
    </div>
  )
}
