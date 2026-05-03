import { z } from 'zod'

/**
 * Stored in `org_module_payloads` with `module_key = 'documents_settings'`.
 *
 * Design anchors:
 *  - IK-f §5 nr. 5  — annual review (auto-create, required fields)
 *  - IK-f §5 nr. 7  — written procedures kept up to date (revision defaults)
 *  - AML §3-2        — risk assessments must be accessible and current
 *  - AML §6-1 / §7   — Verneombud / AMU mandate tracking
 *  - GDPR art. 5(1)e — retention / storage limitation
 */
export const DocumentsModuleSettingsSchema = z
  .object({
    // ── General ───────────────────────────────────────────────────────────
    /** Require at least one legal reference before a page can be published. */
    require_legal_ref_on_publish: z.boolean().optional(),
    /** Show a coloured revision-status badge on document list rows. */
    show_revision_badge: z.boolean().optional(),
    /**
     * Automatically create the current-year annual review record on first
     * visit after 1 Feb (IK-f §5 nr. 5).
     */
    auto_create_annual_review: z.boolean().optional(),
    /** Organisation default language for new documents. */
    default_language: z.enum(['no', 'en']).optional(),

    // ── Revision (IK-f §5 nr. 7) ──────────────────────────────────────────
    /** Default revision interval applied when a new page is published. */
    default_revision_interval_months: z.number().int().min(1).max(120).optional(),
    /**
     * Days before `next_revision_due_at` to start showing the overdue warning
     * badge. 0 = only show after the date passes.
     */
    revision_warning_days: z.number().int().min(0).max(365).optional(),
    /** Send notification to document owner when revision is approaching. */
    notify_owner_on_revision_due: z.boolean().optional(),
    /** Send notification to all org admins when revision is approaching. */
    notify_admins_on_revision_due: z.boolean().optional(),

    // ── Acknowledgements ──────────────────────────────────────────────────
    /**
     * Default audience applied when `requires_acknowledgement` is enabled on
     * a new page — can be overridden per document.
     */
    default_ack_audience: z.enum(['all_employees', 'leaders_only', 'safety_reps_only']).optional(),
    /** Days between automatic acknowledgement reminders (0 = no reminders). */
    ack_reminder_days: z.number().int().min(0).max(365).optional(),
    /** Maximum number of reminders before stopping. 0 = unlimited. */
    ack_max_reminders: z.number().int().min(0).max(20).optional(),
    /**
     * Grace period (days) after a new page version is published before
     * compliance reporting counts incomplete acknowledgements.
     */
    ack_grace_period_days: z.number().int().min(0).max(90).optional(),
  })
  .strict()

export type DocumentsModuleSettings = z.infer<typeof DocumentsModuleSettingsSchema>

export function parseDocumentsModuleSettings(raw: unknown): DocumentsModuleSettings {
  const p = DocumentsModuleSettingsSchema.safeParse(raw)
  return p.success ? p.data : DocumentsModuleSettingsSchema.parse({})
}
