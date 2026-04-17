import type { AcknowledgementAudience, WikiPage } from '../types/documents'

/** Same rules as DB view: published and revision date strictly after "today" (local calendar), or no due date. */
export function isRevisionCurrent(nextRevisionDueAt: string | null | undefined): boolean {
  if (nextRevisionDueAt == null || nextRevisionDueAt === '') return true
  const due = new Date(nextRevisionDueAt)
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime()
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return dueDay > todayStart
}

export function pageCoversLegalRef(page: WikiPage, ref: string): boolean {
  return page.status === 'published' && page.legalRefs.includes(ref) && isRevisionCurrent(page.nextRevisionDueAt)
}

export function userMustAcknowledgePage(
  page: WikiPage,
  ctx: {
    isOrgAdmin: boolean
    departmentId: string | null | undefined
    learningMetadata: Record<string, unknown> | null | undefined
  },
): boolean {
  if (!page.requiresAcknowledgement) return false
  const aud: AcknowledgementAudience = page.acknowledgementAudience ?? 'all_employees'
  if (aud === 'all_employees') return true
  if (aud === 'leaders_only') return ctx.isOrgAdmin === true
  if (aud === 'safety_reps_only') {
    return ctx.learningMetadata?.is_safety_rep === true
  }
  if (aud === 'department') {
    if (!page.acknowledgementDepartmentId) return true
    return ctx.departmentId === page.acknowledgementDepartmentId
  }
  return true
}
