import type { SickLeaveCase } from '../types/hse'

const VO_HINTS = /verneombud|vernetjeneste|hms|sikkerhetsrepresentant/i

export type SickLeaveViewerContext = {
  viewerEmployeeId: string | null
  isAdmin: boolean
  viewerJobHint?: string | null
}

type EmployeeRef = { id: string; reportsToId?: string; unitId?: string }

/**
 * App-side tilgang til sykefravær (inntil dedikert tabell + RLS).
 * Administrator ser alt. Verneombud (gjenkjent via jobbtittel) ser ikke individuelle saker.
 * Leder ser saker der hen er registrert som nærmeste leder, eller der sykmeldt ansatt har
 * `reportsToId` lik lederens ansatt-ID.
 * Eldre rader uten `managerEmployeeId` og uten `employeeId` behandles som åpne (demo/bakoverkompatibilitet).
 */
export function canViewSickLeaveCase(
  sc: SickLeaveCase,
  ctx: SickLeaveViewerContext,
  employees: ReadonlyArray<EmployeeRef>,
): boolean {
  if (ctx.isAdmin) return true

  if (ctx.viewerJobHint && VO_HINTS.test(ctx.viewerJobHint)) return false

  // Legacy records (no employeeId or managerEmployeeId) were previously open to all users.
  // Sick leave is GDPR Art. 9 health data — legacy records are now admin-only pending migration.
  const legacy = !sc.managerEmployeeId && !sc.employeeId
  if (legacy) return false

  if (!ctx.viewerEmployeeId) return false

  if (sc.managerEmployeeId && sc.managerEmployeeId === ctx.viewerEmployeeId) return true

  const sub = sc.employeeId ? employees.find((e) => e.id === sc.employeeId) : undefined
  if (sub?.reportsToId && sub.reportsToId === ctx.viewerEmployeeId) return true

  return false
}
