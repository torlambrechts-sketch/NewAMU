import type { WorkplaceCase } from '../types/workplaceReportingCase'

export type WorkplaceCaseViewerContext = {
  userId: string | undefined
  isAdmin: boolean
  isCommittee: boolean
}

/** Admin / varslingkomité ser alt. Konfidensielle saker: kun oppretter + admin/komité. Ellers: alle med modultilgang i org. */
export function canViewWorkplaceCase(c: WorkplaceCase, ctx: WorkplaceCaseViewerContext): boolean {
  if (ctx.isAdmin || ctx.isCommittee) return true
  if (c.confidential) return Boolean(ctx.userId && c.createdByUserId === ctx.userId)
  return true
}

export function canEditWorkplaceCaseStatus(_: WorkplaceCase, ctx: WorkplaceCaseViewerContext): boolean {
  return ctx.isAdmin || ctx.isCommittee
}
