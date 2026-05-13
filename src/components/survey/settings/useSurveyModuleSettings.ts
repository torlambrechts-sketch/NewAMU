// Shared load/save for the five Survey settings tabs that edit slices
// of `org_module_payloads.survey_settings` (Generelt / Utseende / E-post
// / SMS / Integrasjoner). Mirrors the inline lifecycle in
// `SurveyModuleAdminPage.tsx:105-209`, extracted so each scope tab can
// run standalone inside the unified settings shell.

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { fetchOrgModulePayload, upsertOrgModulePayload } from '../../../lib/orgModulePayload'
import { getSupabaseErrorMessage } from '../../../lib/supabaseError'
import {
  parseSurveyModuleSettings,
  type SurveyModuleSettings,
} from '../../../../modules/survey/surveyAdminSettingsSchema'

const SETTINGS_KEY = 'survey_settings' as const

export type UseSurveyModuleSettings = {
  settings: SurveyModuleSettings
  setSettings: React.Dispatch<React.SetStateAction<SurveyModuleSettings>>
  loading: boolean
  saving: boolean
  error: string | null
  canManage: boolean
  save: () => Promise<void>
}

export function useSurveyModuleSettings(): UseSurveyModuleSettings {
  const { supabase, can, isAdmin, organization } = useOrgSetupContext()
  const orgId = organization?.id
  const canManage = isAdmin || can('survey.manage')

  const [settings, setSettings] = useState<SurveyModuleSettings>(() =>
    parseSurveyModuleSettings({}),
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!canManage || !supabase || !orgId) {
      setLoading(false)
      return () => {
        cancelled = true
      }
    }
    setError(null)
    fetchOrgModulePayload<Record<string, unknown>>(supabase, orgId, SETTINGS_KEY)
      .then((raw) => {
        if (cancelled) return
        setSettings(parseSurveyModuleSettings(raw))
      })
      .catch((e) => {
        if (cancelled) return
        setError(getSupabaseErrorMessage(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, orgId, canManage])

  const save = useCallback(async () => {
    if (!supabase || !orgId) return
    setSaving(true)
    setError(null)
    try {
      await upsertOrgModulePayload(supabase, orgId, SETTINGS_KEY, {
        default_anonymous: settings.default_anonymous ?? false,
        intro_html: settings.intro_html?.trim() || undefined,
        response_rate_threshold_pct: settings.response_rate_threshold_pct,
        invite_email_subject_template: settings.invite_email_subject_template?.trim() || undefined,
        invite_email_html_template: settings.invite_email_html_template?.trim() || undefined,
        reminder_email_subject_template:
          settings.reminder_email_subject_template?.trim() || undefined,
        reminder_email_html_template: settings.reminder_email_html_template?.trim() || undefined,
        max_reminders_per_invitation: settings.max_reminders_per_invitation,
        reminder_min_hours_since_last: settings.reminder_min_hours_since_last,
        email_send_delay_ms: settings.email_send_delay_ms,
        survey_layout: settings.survey_layout,
        show_progress_bar: settings.show_progress_bar,
        show_question_numbers: settings.show_question_numbers,
        allow_back_navigation: settings.allow_back_navigation,
        welcome_page_enabled: settings.welcome_page_enabled,
        welcome_page_html: settings.welcome_page_html?.trim() || undefined,
        thankyou_page_html: settings.thankyou_page_html?.trim() || undefined,
        branding_logo_url: settings.branding_logo_url?.trim() || undefined,
        branding_primary_color: settings.branding_primary_color?.trim() || undefined,
        font_size: settings.font_size,
        sms_enabled: settings.sms_enabled,
        sms_provider: settings.sms_provider,
        sms_sender_name: settings.sms_sender_name?.trim() || undefined,
        sms_invite_template: settings.sms_invite_template?.trim() || undefined,
        sms_reminder_template: settings.sms_reminder_template?.trim() || undefined,
        sms_max_reminders: settings.sms_max_reminders,
        webhook_enabled: settings.webhook_enabled,
        webhook_url: settings.webhook_url?.trim() || undefined,
        webhook_secret: settings.webhook_secret?.trim() || undefined,
        webhook_events: settings.webhook_events,
        slack_enabled: settings.slack_enabled,
        slack_webhook_url: settings.slack_webhook_url?.trim() || undefined,
        slack_notify_on_response: settings.slack_notify_on_response,
        slack_notify_on_threshold: settings.slack_notify_on_threshold,
        slack_notify_on_closed: settings.slack_notify_on_closed,
        api_access_enabled: settings.api_access_enabled,
      })
    } catch (e) {
      setError(getSupabaseErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }, [supabase, orgId, settings])

  return { settings, setSettings, loading, saving, error, canManage, save }
}
