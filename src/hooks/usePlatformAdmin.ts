import { useCallback, useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '../lib/supabaseClient'
import { getSupabaseErrorMessage } from '../lib/supabaseError'

export type PlatformOrgRow = {
  id: string
  name: string
  organization_number: string
  created_at: string
  onboarding_completed_at: string | null
  member_count: number
  monthly_amount_cents: number
  currency: string
  plan: string
}

export type PlatformDashboardData = {
  organizations: PlatformOrgRow[]
  totals: {
    organization_count: number
    profile_count: number
    monthly_billing_cents: number
  }
}

export function usePlatformAdmin() {
  const supabase = getSupabaseBrowserClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState<PlatformDashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshSession = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      setIsAdmin(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const uid = sess.session?.user?.id ?? null
      setUserId(uid)
      if (!uid) {
        setIsAdmin(false)
        setDashboard(null)
        return
      }
      const { data: row, error: e } = await supabase
        .from('platform_admins')
        .select('user_id')
        .eq('user_id', uid)
        .maybeSingle()
      if (e) throw e
      const admin = !!row
      setIsAdmin(admin)
      if (admin) {
        const { data: dash, error: de } = await supabase.rpc('platform_admin_dashboard')
        if (de) throw de
        const raw = dash as { organizations?: PlatformOrgRow[]; totals?: PlatformDashboardData['totals'] }
        setDashboard({
          organizations: raw.organizations ?? [],
          totals: raw.totals ?? {
            organization_count: 0,
            profile_count: 0,
            monthly_billing_cents: 0,
          },
        })
      } else {
        setDashboard(null)
      }
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
      setIsAdmin(false)
      setDashboard(null)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    void refreshSession()
  }, [refreshSession])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setUserId(null)
    setIsAdmin(false)
    setDashboard(null)
  }, [supabase])

  const upsertBilling = useCallback(
    async (input: {
      organizationId: string
      monthlyAmountCents: number
      plan: string
      currency: string
      notes?: string
    }) => {
      if (!supabase) return { ok: false as const }
      try {
        const { error: e } = await supabase.rpc('platform_admin_upsert_billing', {
          p_organization_id: input.organizationId,
          p_monthly_amount_cents: input.monthlyAmountCents,
          p_plan: input.plan,
          p_currency: input.currency,
          p_notes: input.notes ?? null,
        })
        if (e) throw e
        await refreshSession()
        return { ok: true as const }
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return { ok: false as const }
      }
    },
    [supabase, refreshSession],
  )

  return {
    supabase,
    userId,
    isAdmin,
    loading,
    error,
    setError,
    dashboard,
    refreshSession,
    signOut,
    upsertBilling,
  }
}
