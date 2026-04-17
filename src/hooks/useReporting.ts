import { useCallback, useMemo, useState } from 'react'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import { useOrgSetupContext } from './useOrgSetupContext'

export function useReporting() {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  type RpcResult<T> = { data: T | null; error: { message: string } | null }

  const withOrg = useCallback(
    async <T,>(op: () => PromiseLike<RpcResult<T>>): Promise<T | null> => {
      if (!supabase || !orgId) {
        setError('Mangler organisasjon.')
        return null
      }
      setLoading(true)
      setError(null)
      try {
        const { data, error: e } = await op()
        if (e) throw new Error(e.message)
        return data ?? null
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      } finally {
        setLoading(false)
      }
    },
    [supabase, orgId],
  )

  /** Same as withOrg but does not toggle global `loading` — avoids re-renders invalidating useEffect deps on report pages. */
  const withOrgQuiet = useCallback(
    async <T,>(op: () => PromiseLike<RpcResult<T>>): Promise<T | null> => {
      if (!supabase || !orgId) {
        setError('Mangler organisasjon.')
        return null
      }
      setError(null)
      try {
        const { data, error: e } = await op()
        if (e) throw new Error(e.message)
        return data ?? null
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, orgId],
  )

  const fetchAmuAnnual = useCallback(
    (year: number) =>
      withOrg(() => supabase!.rpc('reporting_amu_annual_report', { p_org_id: orgId!, p_year: year }) as PromiseLike<RpcResult<unknown>>),
    [withOrg, supabase, orgId],
  )

  const fetchAnnualIk = useCallback(
    (year: number) =>
      withOrg(() => supabase!.rpc('reporting_annual_review_ik', { p_org_id: orgId!, p_year: year }) as PromiseLike<RpcResult<unknown>>),
    [withOrg, supabase, orgId],
  )

  const fetchArp = useCallback(
    (year: number) =>
      withOrg(() => supabase!.rpc('reporting_arp_metrics', { p_org_id: orgId!, p_year: year }) as PromiseLike<RpcResult<unknown>>),
    [withOrg, supabase, orgId],
  )

  const fetchSickByDept = useCallback(
    (year: number, minHeadcount = 5) =>
      withOrg(() =>
        supabase!.rpc('reporting_sick_leave_by_department', {
          p_org_id: orgId!,
          p_year: year,
          p_min_headcount: minHeadcount,
        }) as PromiseLike<RpcResult<unknown>>,
      ),
    [withOrg, supabase, orgId],
  )

  const fetchCorrelation = useCallback(
    (year: number) =>
      withOrg(() =>
        supabase!.rpc('reporting_training_incident_correlation', { p_org_id: orgId!, p_year: year }) as PromiseLike<
          RpcResult<unknown>
        >,
      ),
    [withOrg, supabase, orgId],
  )

  const fetchCostFriction = useCallback(
    (year: number) =>
      withOrg(() =>
        supabase!.rpc('reporting_cost_of_friction', { p_org_id: orgId!, p_year: year }) as PromiseLike<RpcResult<unknown>>,
      ),
    [withOrg, supabase, orgId],
  )

  const fetchComplianceScore = useCallback(
    () =>
      withOrgQuiet(() =>
        supabase!.rpc('reporting_compliance_score', { p_org_id: orgId! }) as PromiseLike<RpcResult<unknown>>,
      ),
    [withOrgQuiet, supabase, orgId],
  )

  const refreshComplianceMv = useCallback(async () => {
    if (!supabase) return { ok: false as const, error: 'Ingen klient' }
    setLoading(true)
    setError(null)
    try {
      const { error: e } = await supabase.rpc('reporting_refresh_compliance_score')
      if (e) throw e
      return { ok: true as const }
    } catch (err) {
      const msg = getSupabaseErrorMessage(err)
      setError(msg)
      return { ok: false as const, error: msg }
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const clearError = useCallback(() => setError(null), [])

  return useMemo(
    () => ({
      loading,
      error,
      clearError,
      fetchAmuAnnual,
      fetchAnnualIk,
      fetchArp,
      fetchSickByDept,
      fetchCorrelation,
      fetchCostFriction,
      fetchComplianceScore,
      refreshComplianceMv,
    }),
    [
      loading,
      error,
      clearError,
      fetchAmuAnnual,
      fetchAnnualIk,
      fetchArp,
      fetchSickByDept,
      fetchCorrelation,
      fetchCostFriction,
      fetchComplianceScore,
      refreshComplianceMv,
    ],
  )
}
