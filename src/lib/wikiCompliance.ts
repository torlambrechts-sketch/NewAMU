import type { AcknowledgementAudience, ComplianceReceipt, WikiPage, WikiPageVersionSnapshot } from '../types/documents'

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

/** Snapshots at version `k` describe the state before bumping page version from k → k+1. */
function publishChainUsedOnlyMinorRevisions(
  pageId: string,
  fromReceiptVersion: number,
  currentPageVersion: number,
  pageVersions: WikiPageVersionSnapshot[],
): boolean {
  if (fromReceiptVersion >= currentPageVersion) return true
  for (let k = fromReceiptVersion; k < currentPageVersion; k++) {
    const snap = pageVersions.find((v) => v.pageId === pageId && v.version === k)
    if (!snap?.isMinorRevision) return false
  }
  return true
}

export function maxReceiptVersionForUser(
  pageId: string,
  userId: string | undefined,
  receipts: ComplianceReceipt[],
): number | null {
  if (!userId) return null
  let max: number | null = null
  for (const r of receipts) {
    if (r.pageId !== pageId || r.userId !== userId) continue
    if (max == null || r.pageVersion > max) max = r.pageVersion
  }
  return max
}

/**
 * User has a valid receipt for the current page version, including "minor revision" bumps
 * that do not require a new signature.
 */
export function hasAcknowledgedCurrentVersion(
  page: WikiPage,
  userId: string | undefined,
  receipts: ComplianceReceipt[],
  pageVersions: WikiPageVersionSnapshot[],
): boolean {
  if (!userId || !page.requiresAcknowledgement) return false
  const maxRv = maxReceiptVersionForUser(page.id, userId, receipts)
  if (maxRv == null) return false
  if (maxRv === page.version) return true
  if (maxRv > page.version) return false
  return publishChainUsedOnlyMinorRevisions(page.id, maxRv, page.version, pageVersions)
}
