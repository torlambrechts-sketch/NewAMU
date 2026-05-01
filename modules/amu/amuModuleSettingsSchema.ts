import { z } from 'zod'

/** Stored in `org_module_payloads` with `module_key = amu_settings`. */
export const AmuModuleSettingsSchema = z
  .object({
    // ── General / Committee ───────────────────────────────────────────────
    /** Override display name shown in headings */
    committee_display_name: z.string().max(200).optional(),
    /** BHT (Bedriftshelsetjeneste) presence required at meetings */
    bht_required: z.boolean().optional(),
    /** Name of the BHT provider */
    bht_provider_name: z.string().max(200).optional(),
    /** Minimum statutory meetings per year — law requires 4 (AML §7-2) */
    min_meetings_per_year: z.number().int().min(1).max(52).optional(),
    /** Enforce annual chair-side rotation tracking (AML §7-5) */
    chair_rotation_tracking: z.boolean().optional(),
    /** Member term length in months — default 24 (2 years) */
    term_length_months: z.number().int().min(1).max(48).optional(),
    /** Minimum employer-side members (parity check) */
    min_employer_members: z.number().int().min(1).max(20).optional(),
    /** Minimum employee-side members (parity check) */
    min_employee_members: z.number().int().min(1).max(20).optional(),

    // ── Meetings & Voting ────────────────────────────────────────────────
    /** How vote counts are shown in the minutes */
    voting_display: z.enum(['inline', 'summary', 'hidden']).optional(),
    /** Require quorum before a decision can be recorded */
    require_quorum: z.boolean().optional(),
    /** Quorum = this share of voting members must be present (%) */
    quorum_threshold_pct: z.number().int().min(1).max(100).optional(),
    /** Allow hybrid (physical + digital) meetings */
    allow_hybrid: z.boolean().optional(),
    /** Default meeting duration in minutes */
    default_meeting_duration_minutes: z.number().int().min(15).max(480).optional(),
    /** Auto-include open deviations in new meeting agendas */
    agenda_auto_include_deviations: z.boolean().optional(),
    /** Auto-include sick-leave statistics in new agendas */
    agenda_auto_include_sick_leave: z.boolean().optional(),
    /** Auto-include open whistleblowing cases (anonymised count) in agendas */
    agenda_auto_include_whistleblowing: z.boolean().optional(),
    /** Auto-include open inspections in new agendas */
    agenda_auto_include_inspections: z.boolean().optional(),
    /** Show legal references on agenda items (AML, IK-forskriften) */
    agenda_show_legal_refs: z.boolean().optional(),

    // ── Notifications ─────────────────────────────────────────────────────
    /** Send invite email to all members when a meeting is scheduled */
    notify_on_meeting_scheduled: z.boolean().optional(),
    /** Days in advance to send the meeting invite */
    meeting_invite_days_before: z.number().int().min(1).max(60).optional(),
    /** Custom HTML body for the invite email ({{title}} {{date}} {{location}} available) */
    meeting_invite_email_template: z.string().max(10000).optional(),
    /** Send a reminder email before the meeting */
    reminder_enabled: z.boolean().optional(),
    /** Days before the meeting to send the reminder */
    reminder_days_before: z.number().int().min(1).max(30).optional(),
    /** Distribute signed minutes to all members automatically (AML §7-2(6)) */
    distribute_signed_minutes: z.boolean().optional(),
    /** Also distribute to all employees, not just members */
    distribute_to_all_employees: z.boolean().optional(),
    /** Custom HTML body for the signed-minutes distribution email */
    distribution_email_template: z.string().max(10000).optional(),

    // ── Annual Report ─────────────────────────────────────────────────────
    /** Month (1–12) to auto-create a draft annual report */
    annual_report_auto_draft_month: z.number().int().min(1).max(12).optional(),
    /** Require both leader and deputy leader signatures on annual report */
    annual_report_dual_signature: z.boolean().optional(),
    /** Include sick-leave statistics section in annual report */
    annual_report_include_sick_leave: z.boolean().optional(),
    /** Include deviation statistics section in annual report */
    annual_report_include_deviations: z.boolean().optional(),
    /** Include whistleblowing statistics section (anonymised) in annual report */
    annual_report_include_whistleblowing: z.boolean().optional(),
    /** Include inspection results section in annual report */
    annual_report_include_inspections: z.boolean().optional(),
    /** Include survey/kartlegging results section in annual report */
    annual_report_include_surveys: z.boolean().optional(),

    // ── Integrations ─────────────────────────────────────────────────────
    webhook_enabled: z.boolean().optional(),
    webhook_url: z.string().max(500).optional(),
    webhook_secret: z.string().max(200).optional(),
    /** AMU webhook event keys to forward */
    webhook_events: z.array(z.string().max(50)).max(20).optional(),
    slack_enabled: z.boolean().optional(),
    slack_webhook_url: z.string().max(500).optional(),
    slack_notify_on_meeting_signed: z.boolean().optional(),
    slack_notify_on_decision: z.boolean().optional(),
    slack_notify_on_critical_item: z.boolean().optional(),
    /** Expose an iCal feed URL for calendar sync */
    calendar_ical_enabled: z.boolean().optional(),
    /** Allow external systems to read AMU data via REST API */
    api_access_enabled: z.boolean().optional(),
  })
  .strict()

export type AmuModuleSettings = z.infer<typeof AmuModuleSettingsSchema>

export function parseAmuModuleSettings(raw: unknown): AmuModuleSettings {
  const p = AmuModuleSettingsSchema.safeParse(raw)
  return p.success ? p.data : AmuModuleSettingsSchema.parse({})
}
