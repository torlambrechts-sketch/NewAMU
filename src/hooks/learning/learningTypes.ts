/** Shared types for the learning hooks (avoid circular imports). */

export type LearningReviewItem = {
  id: string
  courseId: string
  moduleId: string
  questionId: string
  reviewAt: string
}

export type DeptLeaderboardRow = {
  departmentId: string
  departmentName: string
  memberCount: number
  avgCompletionPct: number
}

export type LearningFlowSettings = {
  teamsWebhookUrl: string | null
  slackWebhookUrl: string | null
  genericWebhookUrl: string | null
}

export type CertificationRenewalRow = {
  id: string
  userId: string
  courseId: string
  certificateId: string | null
  expiresAt: string
  status: 'compliant' | 'expiring_soon' | 'expired' | 'renewed'
}

export type ExternalCertificateRow = {
  id: string
  title: string
  issuer: string | null
  validUntil: string | null
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

export type IltEventRow = {
  id: string
  courseId: string
  moduleId: string
  title: string
  startsAt: string
  endsAt: string | null
  locationText: string | null
  meetingUrl: string | null
  instructorName: string | null
}

export type IltRsvpStatus = 'going' | 'declined' | 'waitlist'

export type LearningPathRow = {
  id: string
  name: string
  slug: string
  description: string
  courseIds: string[]
  rules: { metadataKey: string; expectedValue: unknown }[]
}

export type PathEnrollmentRow = {
  pathId: string
  enrolledAt: string
}

export type ComplianceMatrixCell = {
  userId: string
  displayName: string
  courseId: string
  courseTitle: string
  cellStatus: 'not_started' | 'in_progress' | 'complete'
  completionPct: number
}

export type SystemCourseAdminRow = {
  systemCourseId: string
  slug: string
  title: string
  enabled: boolean
  forkedCourseId: string | null
}
