export type QuestionType = 'likert_5' | 'likert_7' | 'scale_10' | 'yes_no' | 'text'

export type SurveyQuestion = {
  id: string
  text: string
  type: QuestionType
  required: boolean
  /** Optional subscale label (used by UWES, re:Work etc.) */
  subscale?: string
  /** Scale anchor labels */
  anchors?: { low: string; high: string }
}

export type Survey = {
  id: string
  title: string
  description: string
  anonymous: boolean
  status: 'draft' | 'open' | 'closed'
  questions: SurveyQuestion[]
  /** Which pre-built template this was created from (if any) */
  templateId?: string
  /** Target audience — references a UserGroup ID */
  targetGroupId?: string
  /** Display name of the target group (denormalised for display) */
  targetGroupLabel?: string
  createdAt: string
  openedAt?: string
  closedAt?: string
}

export type SurveyResponse = {
  id: string
  surveyId: string
  answers: Record<string, number | string>
  /** For anonymous surveys: whether fritekst was given (content not stored) */
  anonymousTextProvided?: Record<string, boolean>
  submittedAt: string
  /** Opaque id so one browser can only submit once per survey (demo) */
  responseToken: string
}

export type NavSickLeaveReport = {
  id: string
  /** Typically calendar month or quarter */
  periodLabel: string
  periodStart: string
  periodEnd: string
  /** Average sick leave % of scheduled work (NAV-style sykefravær) */
  sickLeavePercent: number | null
  /** Total self-certified sick days (egenmelding) — illustrative */
  selfCertifiedDays: number | null
  /** Documented sick leave days — illustrative */
  documentedSickDays: number | null
  /** FTE or headcount denominator for rate context */
  employeeCount: number | null
  notes: string
  sourceNote: string
  createdAt: string
}

export type LaborMetricKey =
  | 'work_environment_assessment'
  | 'risk_assessment_ros'
  | 'near_miss_reports'
  | 'whistleblower_cases'
  | 'training_hours_hms'
  | 'violence_threats'
  | 'follow_up_sick_leave'

export type LaborMetricEntry = {
  id: string
  periodStart: string
  periodEnd: string
  metricKey: LaborMetricKey
  value: number | null
  textValue?: string
  unit: string
  notes: string
  createdAt: string
}

/** AML-oriented anonymous reporting categories (illustrative — verify mot avtaler og lovdata.no). */
export type AmlReportKind =
  | 'work_injury_illness'
  | 'near_miss'
  | 'harassment_discrimination'
  | 'violence_threat'
  | 'psychosocial'
  | 'whistleblowing'
  | 'other'

/**
 * Anonymous report record: no free text persisted (privacy).
 * HR sees kind, time, and whether the user indicated they had written details (text discarded).
 */
export type AnonymousAmlReport = {
  id: string
  kind: AmlReportKind
  submittedAt: string
  /** User filled the description box; content is not stored. */
  detailsIndicated: boolean
  urgency: 'low' | 'medium' | 'high'
}

export type OrgHealthAuditAction =
  | 'survey_created'
  | 'survey_opened'
  | 'survey_closed'
  | 'response_submitted'
  | 'nav_report_added'
  | 'labor_metric_added'
  | 'settings_updated'
  | 'anonymous_aml_report'

export type OrgHealthAuditEntry = {
  id: string
  at: string
  action: OrgHealthAuditAction
  message: string
  meta?: Record<string, string | number | boolean>
}
