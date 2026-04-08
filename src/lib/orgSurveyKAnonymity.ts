import type { OrgEmployee, OrgUnit, UserGroup } from '../types/organisation'

export const SURVEY_K_ANONYMITY_MIN = 5

/** Alle underenheter (rekursivt) for en liste rot-IDer. */
export function collectDescendantUnitIds(rootIds: string[], units: readonly OrgUnit[]): Set<string> {
  const byParent = new Map<string | undefined, OrgUnit[]>()
  for (const u of units) {
    const k = u.parentId
    if (!byParent.has(k)) byParent.set(k, [])
    byParent.get(k)!.push(u)
  }
  const out = new Set<string>()
  const stack = [...rootIds]
  while (stack.length) {
    const id = stack.pop()!
    if (out.has(id)) continue
    out.add(id)
    const children = byParent.get(id) ?? []
    for (const c of children) stack.push(c.id)
  }
  return out
}

function activeInUnits(employees: readonly OrgEmployee[], unitIds: Set<string>): number {
  return employees.filter((e) => e.active && e.unitId && unitIds.has(e.unitId)).length
}

/**
 * Antall aktive ansatte i målgruppen (for k-anonymitet ved planlegging).
 */
export function countActiveEmployeesInUserGroup(
  group: UserGroup | undefined,
  employees: readonly OrgEmployee[],
  units: readonly OrgUnit[],
  orgHeadcountFallback: number,
): number {
  if (!group) return orgHeadcountFallback
  const s = group.scope
  if (s.kind === 'all') return orgHeadcountFallback
  if (s.kind === 'employees') {
    const set = new Set(s.employeeIds)
    return employees.filter((e) => e.active && set.has(e.id)).length
  }
  if (s.kind === 'units') {
    const unitSet = collectDescendantUnitIds(s.unitIds, units)
    return activeInUnits(employees, unitSet)
  }
  if (s.kind === 'mixed') {
    const unitSet = collectDescendantUnitIds(s.unitIds, units)
    const empSet = new Set(s.employeeIds)
    const fromUnits = employees.filter((e) => e.active && e.unitId && unitSet.has(e.unitId))
    const fromList = employees.filter((e) => e.active && empSet.has(e.id))
    const ids = new Set<string>()
    for (const e of fromUnits) ids.add(e.id)
    for (const e of fromList) ids.add(e.id)
    return ids.size
  }
  return orgHeadcountFallback
}

/**
 * Finn nærmeste overordnede enhet (eller rot) der antall aktive ansatte ≥ minCount.
 * Brukes til visningsnivå når målgruppen er for liten.
 */
export function findRollupUnitForKAnonymity(
  primaryUnitId: string | undefined,
  units: readonly OrgUnit[],
  employees: readonly OrgEmployee[],
  minCount: number,
): { unitId: string | null; label: string; count: number } {
  const unitById = new Map(units.map((u) => [u.id, u]))
  if (!primaryUnitId || !unitById.has(primaryUnitId)) {
    return { unitId: null, label: 'Hele organisasjonen', count: employees.filter((e) => e.active).length }
  }
  let cur: string | undefined = primaryUnitId
  while (cur) {
    const u = unitById.get(cur)
    if (!u) break
    const desc = collectDescendantUnitIds([u.id], units)
    const n = activeInUnits(employees, desc)
    if (n >= minCount) return { unitId: u.id, label: u.name, count: n }
    cur = u.parentId
  }
  return { unitId: null, label: 'Hele organisasjonen', count: employees.filter((e) => e.active).length }
}

export type SurveyAnonymityReportGate = {
  /** Kan vise detaljerte resultater (tall + tekst) for denne undersøkelsen */
  canShowDetailedResults: boolean
  /** Målgruppe har minst minCount potensielle respondenter */
  targetMeetsK: boolean
  /** Antall innsendte svar ≥ minCount */
  responsesMeetK: boolean
  targetCount: number
  responseCount: number
  rollupHint: string
}

export function evaluateSurveyAnonymityGate(params: {
  anonymous: boolean
  targetGroup: UserGroup | undefined
  responseCount: number
  employees: readonly OrgEmployee[]
  units: readonly OrgUnit[]
  orgHeadcountFallback: number
}): SurveyAnonymityReportGate {
  const {
    anonymous,
    targetGroup,
    responseCount,
    employees,
    units,
    orgHeadcountFallback,
  } = params
  const min = SURVEY_K_ANONYMITY_MIN
  const targetCount = countActiveEmployeesInUserGroup(targetGroup, employees, units, orgHeadcountFallback)
  const targetMeetsK = targetCount >= min
  const responsesMeetK = responseCount >= min
  if (!anonymous) {
    return {
      canShowDetailedResults: true,
      targetMeetsK: true,
      responsesMeetK: true,
      targetCount,
      responseCount,
      rollupHint: '',
    }
  }
  const canShow = targetMeetsK && responsesMeetK
  let rollupHint = ''
  if (!canShow) {
    if (!targetMeetsK && targetGroup) {
      const s = targetGroup.scope
      let primaryUnit: string | undefined
      if (s.kind === 'units' && s.unitIds[0]) primaryUnit = s.unitIds[0]
      else if (s.kind === 'mixed' && s.unitIds[0]) primaryUnit = s.unitIds[0]
      const roll = findRollupUnitForKAnonymity(primaryUnit, units, employees, min)
      rollupHint = `Målgruppen er for liten (n=${targetCount}) for trygg rapportering. Anbefalt visningsnivå: ${roll.label} (ca. n=${roll.count}) eller hele virksomheten.`
    } else if (!responsesMeetK) {
      rollupHint = `For få svar (n=${responseCount}) til å vise resultater uten risiko for gjenkjenning. Vent til minst ${min} svar, eller vurder å rulle opp til større enhet.`
    }
  }
  return {
    canShowDetailedResults: canShow,
    targetMeetsK,
    responsesMeetK,
    targetCount,
    responseCount,
    rollupHint,
  }
}
