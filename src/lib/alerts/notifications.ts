// Notifications client wrapper. Enforces the content-free rule:
// dispatchNotification only accepts a kind + variables — body content is
// looked up server-side from the templates.

import type { SupabaseClient } from '@supabase/supabase-js'

export type AlertNotificationKind =
  | 'ack_due'
  | 'feedback_due'
  | 'interim_due'
  | 'triage_breach'
  | 'dsar_received'
  | 'dsar_due'
  | 'break_glass_initiated'
  | 'break_glass_approved'
  | 'break_glass_revoked'
  | 'legal_hold_imposed'
  | 'legal_hold_released'
  | 'retention_imminent'
  | 'audit_chain_broken'
  | 'new_message_from_committee'
  | 'new_message_from_reporter'
  | 'case_assigned'

export async function dispatchNotification(
  supabase: SupabaseClient,
  caseId: string,
  kind: AlertNotificationKind,
  options: {
    toUserId?: string | null
    bodyTemplateId?: string
    variables?: Record<string, unknown>
  } = {},
): Promise<string | null> {
  const { data, error } = await supabase.rpc('alerts_dispatch_notification', {
    p_case_id: caseId,
    p_kind: kind,
    p_to_user_id: options.toUserId ?? null,
    p_body_template_id: options.bodyTemplateId ?? null,
    p_body_variables: options.variables ?? {},
  })
  if (error) return null
  return (data as string | null) ?? null
}
