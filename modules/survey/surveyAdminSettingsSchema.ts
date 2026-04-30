import { z } from 'zod'

/** Stored in `org_module_payloads` with `module_key = survey_settings`. */
export const SurveyModuleSettingsSchema = z
  .object({
    // ── General ───────────────────────────────────────────────────────────
    intro_html: z.string().max(20000).optional(),
    default_anonymous: z.boolean().optional(),
    /** Dispatch workflow once when completed / total reaches this % (0 = off) */
    response_rate_threshold_pct: z.number().int().min(0).max(100).optional(),

    // ── Email ─────────────────────────────────────────────────────────────
    /** {{title}} {{link}} {{name}} */
    invite_email_subject_template: z.string().max(500).optional(),
    invite_email_html_template: z.string().max(50000).optional(),
    reminder_email_subject_template: z.string().max(500).optional(),
    reminder_email_html_template: z.string().max(50000).optional(),
    /** 0 = unlimited */
    max_reminders_per_invitation: z.number().int().min(0).max(20).optional(),
    reminder_min_hours_since_last: z.number().int().min(0).max(8760).optional(),
    email_send_delay_ms: z.number().int().min(0).max(60000).optional(),

    // ── Layout / Appearance ───────────────────────────────────────────────
    survey_layout: z.enum(['paginated', 'single_page', 'one_per_page']).optional(),
    show_progress_bar: z.boolean().optional(),
    show_question_numbers: z.boolean().optional(),
    allow_back_navigation: z.boolean().optional(),
    welcome_page_enabled: z.boolean().optional(),
    welcome_page_html: z.string().max(10000).optional(),
    thankyou_page_html: z.string().max(10000).optional(),
    /** Absolute URL to logo shown in survey header */
    branding_logo_url: z.string().max(500).optional(),
    /** Hex/CSS colour for buttons/accents */
    branding_primary_color: z.string().max(20).optional(),
    font_size: z.enum(['small', 'medium', 'large']).optional(),

    // ── SMS push ──────────────────────────────────────────────────────────
    sms_enabled: z.boolean().optional(),
    sms_provider: z.enum(['twilio', 'vonage', 'messagebird', 'custom']).optional(),
    /** Alphanumeric sender (max 11 chars for most carriers) */
    sms_sender_name: z.string().max(20).optional(),
    /** {{name}} {{link}} available */
    sms_invite_template: z.string().max(500).optional(),
    sms_reminder_template: z.string().max(500).optional(),
    sms_max_reminders: z.number().int().min(0).max(5).optional(),

    // ── Integrations ──────────────────────────────────────────────────────
    webhook_enabled: z.boolean().optional(),
    webhook_url: z.string().max(500).optional(),
    webhook_secret: z.string().max(200).optional(),
    webhook_events: z.array(z.string().max(50)).max(20).optional(),
    slack_enabled: z.boolean().optional(),
    slack_webhook_url: z.string().max(500).optional(),
    slack_notify_on_response: z.boolean().optional(),
    slack_notify_on_threshold: z.boolean().optional(),
    slack_notify_on_closed: z.boolean().optional(),
    api_access_enabled: z.boolean().optional(),
  })
  .strict()

export type SurveyModuleSettings = z.infer<typeof SurveyModuleSettingsSchema>

export function parseSurveyModuleSettings(raw: unknown): SurveyModuleSettings {
  const p = SurveyModuleSettingsSchema.safeParse(raw)
  return p.success ? p.data : SurveyModuleSettingsSchema.parse({})
}
