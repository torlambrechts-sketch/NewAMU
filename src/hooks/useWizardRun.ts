// useWizardRun — load/save resumable wizard state for the active user.
//
// Backed by `compliance_wizard_runs`. Pattern:
//   const { run, loading, save, complete, reset } = useWizardRun('compliance.hms_grunnmur')
//
// Compliance Studio cards use this hook to read `run.completed_at` and
// `run.current_step` for status badges, and the wizard modal calls
// `save({ currentStep, payload })` from `onAdvance` between steps.

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'

export type WizardRunRow = {
  id: string
  organization_id: string
  user_id: string
  wizard_key: string
  current_step: number
  payload: Record<string, string | boolean>
  completed_at: string | null
  updated_at: string
}

export type WizardRunSavePatch = {
  currentStep?: number
  payload?: Record<string, string | boolean>
}

const TABLE = 'compliance_wizard_runs'

export function useWizardRun(wizardKey: string) {
  const { supabase, organization, user } = useOrgSetupContext()
  const [run, setRun] = useState<WizardRunRow | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!supabase || !organization?.id || !user?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('organization_id', organization.id)
      .eq('user_id', user.id)
      .eq('wizard_key', wizardKey)
      .maybeSingle()
    if (error && error.code !== 'PGRST116') {
      // Annet enn "no rows" — la run være null, men ikke krasj.
      console.warn('useWizardRun load:', error.message)
    }
    setRun((data as WizardRunRow | null) ?? null)
    setLoading(false)
  }, [supabase, organization?.id, user?.id, wizardKey])

  useEffect(() => {
    void load()
  }, [load])

  const save = useCallback(
    async (patch: WizardRunSavePatch): Promise<WizardRunRow | null> => {
      if (!supabase || !organization?.id || !user?.id) return null
      const row = {
        organization_id: organization.id,
        user_id: user.id,
        wizard_key: wizardKey,
        current_step: patch.currentStep ?? run?.current_step ?? 0,
        payload: patch.payload ?? run?.payload ?? {},
      }
      const { data, error } = await supabase
        .from(TABLE)
        .upsert(row, { onConflict: 'organization_id,user_id,wizard_key' })
        .select('*')
        .single()
      if (error) {
        console.warn('useWizardRun save:', error.message)
        return null
      }
      const next = data as WizardRunRow
      setRun(next)
      return next
    },
    [supabase, organization?.id, user?.id, wizardKey, run?.current_step, run?.payload],
  )

  const complete = useCallback(
    async (finalPayload?: Record<string, string | boolean>): Promise<WizardRunRow | null> => {
      if (!supabase || !organization?.id || !user?.id) return null
      const row = {
        organization_id: organization.id,
        user_id: user.id,
        wizard_key: wizardKey,
        current_step: run?.current_step ?? 0,
        payload: finalPayload ?? run?.payload ?? {},
        completed_at: new Date().toISOString(),
      }
      const { data, error } = await supabase
        .from(TABLE)
        .upsert(row, { onConflict: 'organization_id,user_id,wizard_key' })
        .select('*')
        .single()
      if (error) {
        console.warn('useWizardRun complete:', error.message)
        return null
      }
      const next = data as WizardRunRow
      setRun(next)
      return next
    },
    [supabase, organization?.id, user?.id, wizardKey, run?.current_step, run?.payload],
  )

  const reset = useCallback(async () => {
    if (!supabase || !organization?.id || !user?.id) return
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('organization_id', organization.id)
      .eq('user_id', user.id)
      .eq('wizard_key', wizardKey)
    if (error) {
      console.warn('useWizardRun reset:', error.message)
      return
    }
    setRun(null)
  }, [supabase, organization?.id, user?.id, wizardKey])

  return { run, loading, save, complete, reset, reload: load }
}
