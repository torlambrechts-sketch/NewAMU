import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import type { InspectionRoundRow } from '../inspection/types'

export type IkAnnualReviewYearStats = {
  deviationCount: number
  signedInspectionRoundsCount: number
}

/**
 * Statistikk for evalueringsfanen: avvik og signerte inspeksjonsrunder i gitt kalenderår.
 */
export async function fetchIkAnnualReviewYearStats(
  supabase: SupabaseClient,
  organizationId: string,
  year: number,
): Promise<{ data: IkAnnualReviewYearStats | null; error: string | null }> {
  const yearStart = `${year}-01-01T00:00:00.000Z`
  const yearEnd = `${year + 1}-01-01T00:00:00.000Z`
  try {
    const inspOr =
      `and(deputy_signed_at.gte.${yearStart},deputy_signed_at.lt.${yearEnd}),` +
      `and(manager_signed_at.gte.${yearStart},manager_signed_at.lt.${yearEnd}),` +
      `and(completed_at.gte.${yearStart},completed_at.lt.${yearEnd})`

    const [devRes, inspRes] = await Promise.all([
      supabase
        .from('deviations')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .gte('created_at', yearStart)
        .lt('created_at', yearEnd),
      supabase
        .from('inspection_rounds')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'signed')
        .is('deleted_at', null)
        .or(inspOr),
    ])
    if (devRes.error) throw devRes.error
    if (inspRes.error) throw inspRes.error
    return {
      data: {
        deviationCount: devRes.count ?? 0,
        signedInspectionRoundsCount: inspRes.count ?? 0,
      },
      error: null,
    }
  } catch (err) {
    return { data: null, error: getSupabaseErrorMessage(err) }
  }
}

/** Typet liste for enkel visning (valgfritt brukt av hooks) */
export async function fetchSignedInspectionRoundsInYear(
  supabase: SupabaseClient,
  organizationId: string,
  year: number,
): Promise<InspectionRoundRow[]> {
  const yearStart = `${year}-01-01T00:00:00.000Z`
  const yearEnd = `${year + 1}-01-01T00:00:00.000Z`
  const inspOr =
    `and(deputy_signed_at.gte.${yearStart},deputy_signed_at.lt.${yearEnd}),` +
    `and(manager_signed_at.gte.${yearStart},manager_signed_at.lt.${yearEnd}),` +
    `and(completed_at.gte.${yearStart},completed_at.lt.${yearEnd})`
  const { data, error } = await supabase
    .from('inspection_rounds')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'signed')
    .is('deleted_at', null)
    .or(inspOr)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as InspectionRoundRow[]
}
