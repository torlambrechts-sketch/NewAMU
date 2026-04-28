import { z } from 'zod'

/** Stored in `org_module_payloads` with `module_key = survey_settings`. */
export const SurveyModuleSettingsSchema = z
  .object({
    intro_html: z.string().max(20000).optional(),
    default_anonymous: z.boolean().optional(),
    /** {{title}} {{link}} */
    invite_email_subject_template: z.string().max(500).optional(),
    invite_email_html_template: z.string().max(50000).optional(),
    reminder_email_subject_template: z.string().max(500).optional(),
    reminder_email_html_template: z.string().max(50000).optional(),
    /** Default max reminder rounds per invitation (Edge enforces; 0 = unlimited) */
    max_reminders_per_invitation: z.number().int().min(0).max(20).optional(),
    /** Minimum hours between reminders for same invitation */
    reminder_min_hours_since_last: z.number().int().min(0).max(8760).optional(),
    /** Delay minutes between each email in bulk send (rate limit) */
    email_send_delay_ms: z.number().int().min(0).max(60000).optional(),
    /** Dispatch workflow once when completed invitations / total invitations reaches this % (0 = off). */
    response_rate_threshold_pct: z.number().int().min(0).max(100).optional(),
  })
  .strict()

export type SurveyModuleSettings = z.infer<typeof SurveyModuleSettingsSchema>

export function parseSurveyModuleSettings(raw: unknown): SurveyModuleSettings {
  const p = SurveyModuleSettingsSchema.safeParse(raw)
  return p.success ? p.data : SurveyModuleSettingsSchema.parse({})
}
