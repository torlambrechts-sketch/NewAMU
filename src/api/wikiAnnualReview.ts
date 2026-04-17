import type { SupabaseClient } from '@supabase/supabase-js'

export type WikiAnnualReviewRow = {
  id: string
  organization_id: string
  year: number
  status: 'in_progress' | 'completed' | 'overdue'
  started_at: string
  completed_at: string | null
  completed_by: string | null
  review_page_id: string | null
  items_reviewed: number
  items_total: number
  notes: string | null
}

export type WikiAnnualReviewItemRow = {
  id: string
  review_id: string
  page_id: string | null
  legal_ref: string
  description: string
  status: 'pending' | 'ok' | 'needs_update' | 'not_applicable'
  reviewer_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
}

export async function apiFetchAnnualReview(
  supabase: SupabaseClient,
  orgId: string,
  year: number,
): Promise<{ review: WikiAnnualReviewRow | null; items: WikiAnnualReviewItemRow[] }> {
  const { data: rev, error: re } = await supabase
    .from('wiki_annual_reviews')
    .select('*')
    .eq('organization_id', orgId)
    .eq('year', year)
    .maybeSingle()
  if (re) throw re
  if (!rev) return { review: null, items: [] }
  const { data: items, error: ie } = await supabase
    .from('wiki_annual_review_items')
    .select('*')
    .eq('review_id', (rev as WikiAnnualReviewRow).id)
    .order('legal_ref')
  if (ie) throw ie
  return { review: rev as WikiAnnualReviewRow, items: (items ?? []) as WikiAnnualReviewItemRow[] }
}

export async function apiInsertAnnualReview(
  supabase: SupabaseClient,
  orgId: string,
  year: number,
): Promise<WikiAnnualReviewRow> {
  const { data, error } = await supabase
    .from('wiki_annual_reviews')
    .insert({
      organization_id: orgId,
      year,
      status: 'in_progress',
    })
    .select('*')
    .single()
  if (error) throw error
  return data as WikiAnnualReviewRow
}

export async function apiFetchLegalCoverageRefs(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('wiki_legal_coverage_items').select('ref, label').order('ref')
  if (error) throw error
  return (data ?? []) as { ref: string; label: string }[]
}

export async function apiInsertAnnualReviewItems(
  supabase: SupabaseClient,
  reviewId: string,
  rows: { page_id: string | null; legal_ref: string; description: string }[],
) {
  if (rows.length === 0) return
  const { error } = await supabase.from('wiki_annual_review_items').insert(
    rows.map((r) => ({
      review_id: reviewId,
      page_id: r.page_id,
      legal_ref: r.legal_ref,
      description: r.description,
      status: 'pending',
    })),
  )
  if (error) throw error
}

export async function apiUpdateAnnualReviewItem(
  supabase: SupabaseClient,
  id: string,
  patch: {
    status?: WikiAnnualReviewItemRow['status']
    reviewer_notes?: string | null
    reviewed_by?: string | null
    reviewed_at?: string | null
  },
) {
  const { error } = await supabase.from('wiki_annual_review_items').update(patch).eq('id', id)
  if (error) throw error
}

export async function apiRecalcAnnualReviewProgress(supabase: SupabaseClient, reviewId: string) {
  const { data: items, error: e1 } = await supabase.from('wiki_annual_review_items').select('id, status').eq('review_id', reviewId)
  if (e1) throw e1
  const list = items ?? []
  const total = list.length
  const reviewed = list.filter((i: { status: string }) => i.status !== 'pending').length
  const { error: e2 } = await supabase
    .from('wiki_annual_reviews')
    .update({ items_total: total, items_reviewed: reviewed })
    .eq('id', reviewId)
  if (e2) throw e2
}

export async function apiCompleteAnnualReview(
  supabase: SupabaseClient,
  reviewId: string,
  userId: string,
  patch: { completed_at: string; review_page_id: string | null; notes?: string | null },
) {
  const { error } = await supabase
    .from('wiki_annual_reviews')
    .update({
      status: 'completed',
      completed_at: patch.completed_at,
      completed_by: userId,
      review_page_id: patch.review_page_id,
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    })
    .eq('id', reviewId)
  if (error) throw error
}
