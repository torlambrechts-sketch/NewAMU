import type { Incident } from '../types/hse'

const VO_HINTS = /verneombud|vernetjeneste|hms|sikkerhetsrepresentant/i

export type IncidentViewerContext = {
  userId: string | undefined
  /** OrgEmployee.id for innlogget bruker (via profil/e-post-kobling) */
  viewerEmployeeId: string | null
  isAdmin: boolean
  /** Navn/e-post for visning når employeeId mangler */
  viewerDisplayName?: string | null
  viewerEmail?: string | null
  /** Jobbtittel / rolle-tekst for enkel VO-gjenkjenning */
  viewerJobHint?: string | null
}

function norm(s: string | null | undefined) {
  return (s ?? '').trim().toLowerCase()
}

/**
 * Streng tilgang: standard for nye hendelser med createdByUserId.
 * Eldre rader uten createdByUserId vises for alle (bakoverkompatibilitet).
 */
export function canViewIncident(inc: Incident, ctx: IncidentViewerContext): boolean {
  if (ctx.isAdmin) return true

  const legacy = !inc.createdByUserId && !inc.reportedByEmployeeId
  if (legacy) return true

  if (ctx.userId && inc.createdByUserId === ctx.userId) return true

  if (ctx.viewerEmployeeId) {
    if (inc.reportedByEmployeeId && inc.reportedByEmployeeId === ctx.viewerEmployeeId) return true
    if (inc.nearestLeaderEmployeeId && inc.nearestLeaderEmployeeId === ctx.viewerEmployeeId) return true
  }

  const rb = norm(inc.reportedBy)
  if (rb && ctx.viewerEmail && rb === norm(ctx.viewerEmail)) return true
  if (rb && ctx.viewerDisplayName && rb === norm(ctx.viewerDisplayName)) return true

  if (inc.routing?.verneombudNotified) {
    const hint = `${ctx.viewerJobHint ?? ''}`
    if (VO_HINTS.test(hint)) return true
  }

  return false
}

function isIncidentReporter(inc: Incident, ctx: IncidentViewerContext): boolean {
  if (ctx.userId && inc.createdByUserId && inc.createdByUserId === ctx.userId) return true
  if (ctx.viewerEmployeeId && inc.reportedByEmployeeId && inc.reportedByEmployeeId === ctx.viewerEmployeeId) return true
  const rb = norm(inc.reportedBy)
  if (rb && ctx.viewerEmail && rb === norm(ctx.viewerEmail)) return true
  if (rb && ctx.viewerDisplayName && rb === norm(ctx.viewerDisplayName)) return true
  return false
}

/** Rotårsak: ikke melder; kun admin eller valgt nærmeste leder (saksbehandler). */
export function canEditIncidentRootCause(inc: Incident, ctx: IncidentViewerContext): boolean {
  if (isIncidentReporter(inc, ctx)) return false
  if (ctx.isAdmin) return true
  if (ctx.viewerEmployeeId && inc.nearestLeaderEmployeeId && ctx.viewerEmployeeId === inc.nearestLeaderEmployeeId) {
    return true
  }
  return false
}
