import { z } from 'zod'

/**
 * AMU module settings — stored in `org_module_payloads` with
 * `module_key = 'amu_settings'`.
 *
 * Anchored in Norwegian law:
 *  - Arbeidsmiljøloven (AML) kap. 2 A (varsling), kap. 3 (BHT, opplæring),
 *    kap. 4 (krav til arbeidsmiljø), kap. 5 (registrering), kap. 7 (AMU).
 *  - Internkontrollforskriften (IK-f) § 5 nr. 1–8.
 *  - Forskrift om organisering, ledelse og medvirkning § 3-18 (40-timers HMS).
 *  - Personopplysningsloven / GDPR + Forvaltningsloven § 13 (taushetsplikt).
 */
export const AmuModuleSettingsSchema = z
  .object({
    // ── General / Committee ───────────────────────────────────────────────
    /** Override display name shown in headings */
    committee_display_name: z.string().max(200).optional(),
    /** BHT (Bedriftshelsetjeneste) presence required at meetings (AML § 3-3) */
    bht_required: z.boolean().optional(),
    /** Name of the BHT provider */
    bht_provider_name: z.string().max(200).optional(),
    /** Minimum statutory meetings per year — law requires 4 (AML § 7-2) */
    min_meetings_per_year: z.number().int().min(1).max(52).optional(),
    /** Enforce annual chair-side rotation tracking (AML § 7-5) */
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
    /**
     * Default meeting confidentiality level. Use «closed» if confidential
     * cases (varsling, sykdom) are routinely handled — invokes taushetsplikt
     * (Forvaltningsloven § 13).
     */
    default_meeting_visibility: z.enum(['open', 'closed']).optional(),
    /** Default video-link template to inject in invites — supports {{title}} */
    default_video_link_template: z.string().max(500).optional(),
    /** Auto-include open deviations in new meeting agendas */
    agenda_auto_include_deviations: z.boolean().optional(),
    /**
     * Risk score threshold (RPN) above which deviations MUST be brought to
     * AMU. Used by «kritiske saker» auto-queue.
     */
    agenda_deviation_rpn_threshold: z.number().int().min(1).max(25).optional(),
    /** Auto-include sick-leave statistics in new agendas (AML § 4-6) */
    agenda_auto_include_sick_leave: z.boolean().optional(),
    /** Auto-include open whistleblowing cases (anonymised) in agendas */
    agenda_auto_include_whistleblowing: z.boolean().optional(),
    /** Auto-include open inspections in new agendas */
    agenda_auto_include_inspections: z.boolean().optional(),
    /** Auto-include open / due action items from earlier meetings */
    agenda_auto_include_action_items: z.boolean().optional(),
    /** Auto-include employee proposals (forslag fra ansatte, AML § 4-2) */
    agenda_auto_include_employee_proposals: z.boolean().optional(),
    /** Show legal references on agenda items (AML, IK-forskriften) */
    agenda_show_legal_refs: z.boolean().optional(),
    /** Allow employees to submit topic proposals via the public link */
    allow_employee_topic_proposals: z.boolean().optional(),
    /** Allow proposals to be submitted anonymously (no PII recorded) */
    allow_anonymous_proposals: z.boolean().optional(),

    // ── Notifications ─────────────────────────────────────────────────────
    /** Send invite email to all members when a meeting is scheduled */
    notify_on_meeting_scheduled: z.boolean().optional(),
    /** Days in advance to send the meeting invite (statutory minimum 14) */
    meeting_invite_days_before: z.number().int().min(1).max(60).optional(),
    /** Custom HTML body for the invite email ({{title}} {{date}} {{location}} available) */
    meeting_invite_email_template: z.string().max(10000).optional(),
    /** Send a reminder email before the meeting */
    reminder_enabled: z.boolean().optional(),
    /** Days before the meeting to send the reminder */
    reminder_days_before: z.number().int().min(1).max(30).optional(),
    /** Distribute signed minutes to all members automatically (AML § 7-2(6)) */
    distribute_signed_minutes: z.boolean().optional(),
    /** Also distribute to all employees, not just members */
    distribute_to_all_employees: z.boolean().optional(),
    /** Custom HTML body for the signed-minutes distribution email */
    distribution_email_template: z.string().max(10000).optional(),

    // ── Varsling (Whistleblowing — AML kap. 2 A) ──────────────────────────
    /**
     * AMU shall be informed about whistleblowing in aggregate. Set the
     * cadence: every meeting / quarterly / annual.
     */
    whistleblowing_report_cadence: z.enum(['every_meeting', 'quarterly', 'annual']).optional(),
    /** Always anonymise — never expose names or unique role labels in AMU views */
    whistleblowing_force_anonymisation: z.boolean().optional(),
    /**
     * Minimum cohort size before stats are shown. Smaller groups are
     * suppressed to protect identifiable individuals (k-anonymity).
     */
    whistleblowing_min_group_size: z.number().int().min(1).max(50).optional(),
    /**
     * Statutory soft-deadline for closing a whistleblowing case (days).
     * AML § 2 A-3 requires «forsvarlig undersøkelse innen rimelig tid» —
     * ARTL guidance suggests ≤ 90 days.
     */
    whistleblowing_close_deadline_days: z.number().int().min(7).max(365).optional(),
    /** Notify AMU leader immediately when a high-severity case is filed */
    whistleblowing_notify_leader_on_high: z.boolean().optional(),
    /** Notify the AMU when a case has missed its statutory deadline */
    whistleblowing_notify_on_overdue: z.boolean().optional(),

    // ── Compliance / HMS-training (FOR § 3-18) ────────────────────────────
    /**
     * Days before an AMU member's 40-hour HMS-course expires the system
     * starts warning. 0 = warn only after expiry.
     */
    hms_training_warning_days: z.number().int().min(0).max(365).optional(),
    /** Block voting rights for members with expired HMS-training */
    hms_training_block_voting_when_expired: z.boolean().optional(),
    /** Notify member + admin when HMS-training is approaching expiry */
    notify_hms_training_expiring: z.boolean().optional(),
    /** Days before expiry to start sending HMS-training reminders */
    hms_training_reminder_days: z.number().int().min(1).max(365).optional(),

    // ── Action items & escalation ─────────────────────────────────────────
    /** Days after the due date when an action is marked overdue */
    action_overdue_grace_days: z.number().int().min(0).max(60).optional(),
    /** Escalate overdue actions to AMU leader after this many days */
    action_escalation_days: z.number().int().min(1).max(180).optional(),
    /** Auto-create deviation when an action item is missed */
    action_overdue_creates_deviation: z.boolean().optional(),

    // ── Confidentiality / GDPR (Personopplysningsloven, Fvl. § 13) ────────
    /** Show explicit taushetsplikt-banner on confidential meetings */
    show_confidentiality_banner: z.boolean().optional(),
    /** Require a signed taushetserklæring on member onboarding */
    require_signed_confidentiality: z.boolean().optional(),
    /** Days to retain unsigned meeting drafts before auto-deletion (GDPR 5(1)e) */
    draft_retention_days: z.number().int().min(30).max(3650).optional(),
    /** Years to retain signed minutes / annual reports (HMS-arkivkrav) */
    signed_record_retention_years: z.number().int().min(1).max(50).optional(),

    // ── Annual Report (AML § 7-2(5)) ──────────────────────────────────────
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
    /** Include HMS-training compliance status (FOR § 3-18) */
    annual_report_include_hms_training: z.boolean().optional(),
    /** Hard deadline (day-of-month) the annual report must be signed by */
    annual_report_signing_deadline_month: z.number().int().min(1).max(12).optional(),

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
