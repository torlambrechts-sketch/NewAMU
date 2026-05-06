/**
 * Settings store for the task management hub.
 *
 * Covers oppgaver + avvik + varsling + anonym AML in a single normalised
 * shape so the Innstillinger tab can render one form per concern. Stored
 * client-side via localStorage (no DDL changes); when remote persistence is
 * required this can be lifted into `org_module_payload` under a new key
 * without changing the consumer surface.
 */

import type { TaskPriority } from './types'

export type EmailDigestFrequency = 'off' | 'daily' | 'weekly'

export type TaskAuditRetentionPolicy = 'one_year' | 'three_years' | 'five_years' | 'permanent'

export type TaskModuleSettings = {
  /** Generelt — defaults applied when creating a new task. */
  defaults: {
    priority: TaskPriority
    ownerRole: string
    /** Days after creation if user does not set a due date. 0 disables auto-due. */
    dueOffsetDays: number
    /** When true, every new HSE task is created with management sign-off required. */
    autoRequireMgmtSignOffForHse: boolean
    /** Default WIP limit applied to brand-new projects. */
    defaultWipInProgress: number
  }

  /** Varslinger — in-app + email notifications. */
  notifications: {
    enabled: boolean
    /** Master email address (system can also fan out to assignee.email). */
    notificationEmail: string
    notifyOnAssignment: boolean
    notifyOnComment: boolean
    notifyOnStatusChange: boolean
    notifyOnOverdue: boolean
    /** N days before due to fire a reminder. 0 disables. */
    reminderDaysBefore: number
    /** Second reminder after first. 0 disables. */
    secondReminderDaysBefore: number
    /** Escalate to leader N days after overdue. 0 disables. */
    escalateAfterOverdueDays: number
    digestFrequency: EmailDigestFrequency
    digestSendHourLocal: number
  }

  /** E-post templates (subject / body). */
  email: {
    fromName: string
    fromEmail: string
    /** Overrides for assignment / reminder / overdue mails. Empty falls back to localized default. */
    assignmentSubject: string
    assignmentBody: string
    reminderSubject: string
    reminderBody: string
    overdueSubject: string
    overdueBody: string
  }

  /** Integrasjoner — outbound webhooks + iCal export. */
  integrations: {
    icalExportEnabled: boolean
    /** Read-only display token; rotation happens elsewhere. */
    icalExportToken: string
    slackWebhookUrl: string
    teamsWebhookUrl: string
    genericWebhookUrl: string
    webhookEvents: {
      taskCreated: boolean
      taskCompleted: boolean
      taskOverdue: boolean
      avvikCreated: boolean
      varslingCreated: boolean
    }
  }

  /** Avvik (deviations) defaults. */
  avvik: {
    defaultSeverity: 'low' | 'medium' | 'high' | 'critical'
    /** When true, every new critical avvik also creates a follow-up task. */
    autoCreateTaskOnCritical: boolean
    /** Notify management group on every critical avvik. */
    notifyManagementOnCritical: boolean
    /** Days within which an avvik must be closed (0 disables). */
    closureSlaDays: number
    requireRootCauseOnClosure: boolean
  }

  /** Varsling (whistleblowing) defaults. */
  varsling: {
    /** Days to send written acknowledgement (AML § 2 A-3 — innen rimelig tid). */
    acknowledgementDays: number
    /** Days within which the case should reach a conclusion. */
    targetClosureDays: number
    notifyCommitteeOnNewCase: boolean
    /** Public form slug (read-only display in settings). */
    publicFormSlug: string
    /** Block submissions outside business hours when committee is unavailable. */
    requireBusinessHours: boolean
  }

  /** Anonym AML rapportering. */
  anonymAml: {
    enabled: boolean
    pageSlug: string
    pageTitle: string
    leadParagraph: string
    footerNote: string
  }

  /** Etterlevelse / compliance. */
  compliance: {
    requireSignatureOnClosure: boolean
    requireMgmtSignatureForCritical: boolean
    auditRetention: TaskAuditRetentionPolicy
    /** Drops PII from comment bodies older than retention days. 0 disables. */
    autoMinimizePiiAfterDays: number
    /** Hide closed tasks from the default board after N days. */
    archiveDoneAfterDays: number
  }
}

export const DEFAULT_TASK_MODULE_SETTINGS: TaskModuleSettings = {
  defaults: {
    priority: 'medium',
    ownerRole: 'Ansvarlig',
    dueOffsetDays: 14,
    autoRequireMgmtSignOffForHse: true,
    defaultWipInProgress: 5,
  },
  notifications: {
    enabled: true,
    notificationEmail: '',
    notifyOnAssignment: true,
    notifyOnComment: true,
    notifyOnStatusChange: false,
    notifyOnOverdue: true,
    reminderDaysBefore: 3,
    secondReminderDaysBefore: 1,
    escalateAfterOverdueDays: 2,
    digestFrequency: 'weekly',
    digestSendHourLocal: 8,
  },
  email: {
    fromName: 'Klarert HMS',
    fromEmail: '',
    assignmentSubject: 'Ny oppgave: {{title}}',
    assignmentBody:
      '<p>Hei {{name}},</p><p>Du er tildelt oppgaven <strong>{{title}}</strong>. Frist: {{due}}.</p><p><a href="{{link}}">Åpne oppgaven</a></p>',
    reminderSubject: 'Påminnelse: {{title}} forfaller {{due}}',
    reminderBody:
      '<p>Hei {{name}},</p><p>Frist for <strong>{{title}}</strong> er {{due}}. <a href="{{link}}">Åpne oppgaven</a>.</p>',
    overdueSubject: 'Forfalt: {{title}}',
    overdueBody:
      '<p>Hei {{name}},</p><p>Oppgaven <strong>{{title}}</strong> er forfalt. <a href="{{link}}">Følg opp her</a>.</p>',
  },
  integrations: {
    icalExportEnabled: false,
    icalExportToken: '',
    slackWebhookUrl: '',
    teamsWebhookUrl: '',
    genericWebhookUrl: '',
    webhookEvents: {
      taskCreated: false,
      taskCompleted: true,
      taskOverdue: true,
      avvikCreated: true,
      varslingCreated: true,
    },
  },
  avvik: {
    defaultSeverity: 'medium',
    autoCreateTaskOnCritical: true,
    notifyManagementOnCritical: true,
    closureSlaDays: 30,
    requireRootCauseOnClosure: true,
  },
  varsling: {
    acknowledgementDays: 7,
    targetClosureDays: 90,
    notifyCommitteeOnNewCase: true,
    publicFormSlug: 'varsle',
    requireBusinessHours: false,
  },
  anonymAml: {
    enabled: true,
    pageSlug: 'anonym-aml',
    pageTitle: 'Anonym arbeidsmiljøhenvendelse',
    leadParagraph:
      'Velg kategori og hastegrad. Fritekst du eventuelt skriver lagres ikke — kun om du skrev noe (ja/nei) registreres.',
    footerNote: 'Ved akutt fare: ring 113. For strukturert varsling med oppfølging, bruk organisasjonens offisielle varslingskanal.',
  },
  compliance: {
    requireSignatureOnClosure: true,
    requireMgmtSignatureForCritical: true,
    auditRetention: 'five_years',
    autoMinimizePiiAfterDays: 0,
    archiveDoneAfterDays: 30,
  },
}

export const TASK_AUDIT_RETENTION_OPTIONS: ReadonlyArray<{ value: TaskAuditRetentionPolicy; label: string }> = [
  { value: 'one_year', label: '1 år' },
  { value: 'three_years', label: '3 år' },
  { value: 'five_years', label: '5 år (anbefalt — IK-forskriften § 5 nr. 8)' },
  { value: 'permanent', label: 'Permanent' },
]

export const EMAIL_DIGEST_OPTIONS: ReadonlyArray<{ value: EmailDigestFrequency; label: string }> = [
  { value: 'off', label: 'Av' },
  { value: 'daily', label: 'Daglig' },
  { value: 'weekly', label: 'Ukentlig' },
]

/**
 * Recursively merges the persisted partial settings on top of defaults so
 * additions to {@link DEFAULT_TASK_MODULE_SETTINGS} stay backward-compatible
 * with previously stored payloads.
 */
export function mergeSettings(
  base: TaskModuleSettings,
  patch: Partial<TaskModuleSettings>,
): TaskModuleSettings {
  // Cast through Record<string, unknown> so TS doesn't try to widen the per-key
  // type during deep-shallow merge (each top-level group is its own object).
  const out: Record<string, unknown> = { ...base }
  for (const key of Object.keys(patch) as Array<keyof TaskModuleSettings>) {
    const incoming = patch[key]
    if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) {
      out[key] = { ...(base[key] as object), ...(incoming as object) }
    } else if (incoming !== undefined) {
      out[key] = incoming
    }
  }
  return out as TaskModuleSettings
}
