import type { SupabaseClient } from '@supabase/supabase-js'

/** Typed RPC rows — PostgREST returns array of objects */
export type ChoiceCountRow = { choice_label: string; cnt: number }
export type NumericStatsRow = { avg_val: number | null; n: number; min_val: number | null; max_val: number | null }

export async function fetchSurveyChoiceCountsRpc(
  supabase: SupabaseClient,
  surveyId: string,
  questionId: string,
  minCompleted = 5,
): Promise<ChoiceCountRow[] | null> {
  const { data, error } = await supabase.rpc('survey_question_choice_counts_for_org', {
    p_survey_id: surveyId,
    p_question_id: questionId,
    p_min_completed: minCompleted,
  })
  if (error) return null
  if (!Array.isArray(data)) return null
  return data.map((r: { choice_label?: string; cnt?: number }) => ({
    choice_label: String(r.choice_label ?? ''),
    cnt: Number(r.cnt ?? 0),
  }))
}

export async function fetchSurveyNumericStatsRpc(
  supabase: SupabaseClient,
  surveyId: string,
  questionId: string,
  minCompleted = 5,
): Promise<NumericStatsRow | null> {
  const { data, error } = await supabase.rpc('survey_question_numeric_stats_for_org', {
    p_survey_id: surveyId,
    p_question_id: questionId,
    p_min_completed: minCompleted,
  })
  if (error) return null
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') return null
  const o = row as Record<string, unknown>
  return {
    avg_val: o.avg_val != null ? Number(o.avg_val) : null,
    n: Number(o.n ?? 0),
    min_val: o.min_val != null ? Number(o.min_val) : null,
    max_val: o.max_val != null ? Number(o.max_val) : null,
  }
}
