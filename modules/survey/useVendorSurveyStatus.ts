// useVendorSurveyStatus — aggregates per-vendor survey invitation stats
// for the org. Reads survey_invitations where vendor_id IS NOT NULL and
// joins minimal survey + vendor metadata, then aggregates client-side
// to keep the SQL surface flat.
//
// Drives /survey/leverandorer (vendor reporting page).

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import type { SurveyInvitationStatus, VendorRow, VendorStatus } from './types'

type UseVendorSurveyStatusInput = {
  supabase: SupabaseClient | null
}

type RawInvitationRow = {
  id: string
  survey_id: string
  vendor_id: string
  status: SurveyInvitationStatus
  created_at: string
  updated_at: string
  surveys: { id: string; title: string; status: string } | null
  vendors:
    | { id: string; display_name: string; status: VendorStatus; is_active: boolean }
    | null
}

export type VendorSurveyStat = {
  vendor: Pick<VendorRow, 'id' | 'display_name' | 'status' | 'is_active'>
  totalInvitations: number
  completedInvitations: number
  pendingInvitations: number
  completionPct: number
  lastActivityAt: string | null
  surveys: ReadonlyArray<{
    surveyId: string
    title: string
    status: string
    invitationStatus: SurveyInvitationStatus
    invitationId: string
    updatedAt: string
  }>
}

export type UseVendorSurveyStatusReturn = {
  loading: boolean
  error: string | null
  stats: VendorSurveyStat[]
  refresh: () => Promise<void>
}

export function useVendorSurveyStatus(
  input: UseVendorSurveyStatusInput,
): UseVendorSurveyStatusReturn {
  const { supabase } = input
  const { organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [rows, setRows] = useState<RawInvitationRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const targetKey = supabase && orgId ? orgId : null

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    try {
      const { data, error: respErr } = await supabase
        .from('survey_invitations')
        .select(
          'id, survey_id, vendor_id, status, created_at, updated_at, ' +
            'surveys ( id, title, status ), ' +
            'vendors ( id, display_name, status, is_active )',
        )
        .eq('organization_id', orgId)
        .not('vendor_id', 'is', null)
        .order('updated_at', { ascending: false })
      if (respErr) throw respErr
      setRows((data ?? []) as unknown as RawInvitationRow[])
      setFetchedFor(orgId)
      setError(null)
    } catch (unknownError) {
      setError(getSupabaseErrorMessage(unknownError))
      setFetchedFor(orgId)
    }
  }, [supabase, orgId])

  useEffect(() => {
    if (!supabase || !orgId) return
    void load()
  }, [load, supabase, orgId])

  const loading = targetKey !== null && targetKey !== fetchedFor

  const stats = useMemo<VendorSurveyStat[]>(() => {
    const byVendor = new Map<string, VendorSurveyStat>()
    for (const r of rows) {
      if (!r.vendors) continue
      const vid = r.vendors.id
      let entry = byVendor.get(vid)
      if (!entry) {
        entry = {
          vendor: {
            id: r.vendors.id,
            display_name: r.vendors.display_name,
            status: r.vendors.status,
            is_active: r.vendors.is_active,
          },
          totalInvitations: 0,
          completedInvitations: 0,
          pendingInvitations: 0,
          completionPct: 0,
          lastActivityAt: null,
          surveys: [],
        }
        byVendor.set(vid, entry)
      }
      entry.totalInvitations += 1
      if (r.status === 'completed') entry.completedInvitations += 1
      else entry.pendingInvitations += 1
      if (!entry.lastActivityAt || r.updated_at > entry.lastActivityAt) {
        entry.lastActivityAt = r.updated_at
      }
      if (r.surveys) {
        const surveys = entry.surveys as Array<VendorSurveyStat['surveys'][number]>
        surveys.push({
          surveyId: r.surveys.id,
          title: r.surveys.title,
          status: r.surveys.status,
          invitationStatus: r.status,
          invitationId: r.id,
          updatedAt: r.updated_at,
        })
      }
    }

    const result = Array.from(byVendor.values())
    for (const s of result) {
      s.completionPct =
        s.totalInvitations > 0
          ? Math.round((s.completedInvitations / s.totalInvitations) * 100)
          : 0
    }
    result.sort((a, b) => a.vendor.display_name.localeCompare(b.vendor.display_name, 'nb'))
    return result
  }, [rows])

  return useMemo(
    () => ({ loading, error, stats, refresh: load }),
    [loading, error, stats, load],
  )
}
