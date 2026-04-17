import type { ComplianceReceipt, PageTemplate, WikiPage, WikiSpace } from '../types/documents'

export type InspectionReadinessInput = {
  legalCoverage: { ref: string; label: string; templateIds: string[] }[]
  pages: WikiPage[]
  pageTemplates: PageTemplate[]
  spaces: WikiSpace[]
  auditLedger: { action: string; pageId: string; at: string }[]
  employeeCount: number
  nowMs: number
  /** Current calendar year annual review (internal control) locked */
  annualReviewLockedThisYear: boolean
  /** 0–1 fraction of employees who acknowledged varsling routine page, or null if no such page */
  varslingAckRate: number | null
}

/** Published page that looks like the whistleblowing routine (AML §2A or title). */
export function findVarslingRoutinePage(pages: WikiPage[]): WikiPage | null {
  return (
    pages.find(
      (p) =>
        p.status === 'published' &&
        (p.legalRefs.some((r) => r.includes('2A')) || /varslingsrutine|varslingskanal/i.test(p.title)),
    ) ?? null
  )
}

export function varslingAcknowledgementRate(
  page: WikiPage | null,
  receipts: ComplianceReceipt[],
  employeeCount: number,
): number | null {
  if (!page || !page.requiresAcknowledgement || employeeCount <= 0) return null
  const n = receipts.filter((r) => r.pageId === page.id && r.pageVersion === page.version).length
  return n / employeeCount
}

export type InspectionReadinessBreakdown = {
  total: number
  ikCoverage: number
  maxIkCoverage: number
  noStale: number
  maxNoStale: number
  annualReview: number
  maxAnnualReview: number
  varsling: number
  maxVarsling: number
  amuQuarterly: number
  maxAmuQuarterly: number
}

const MAX_IK = 40
const MAX_STALE = 20
const MAX_ANNUAL = 20
const MAX_VARSLING = 10
const MAX_AMU = 10

function coverageRow(
  item: InspectionReadinessInput['legalCoverage'][0],
  pages: WikiPage[],
  pageTemplates: PageTemplate[],
) {
  const coveredBy = pages.filter(
    (p) =>
      p.status === 'published' &&
      item.templateIds.some((tid) => {
        const tpl = pageTemplates.find((t) => t.id === tid)
        if (!tpl) return false
        return tpl.page.legalRefs.some((r) => p.legalRefs.includes(r))
      }),
  )
  const stale = coveredBy.some((p) => {
    if (!p.nextRevisionDueAt) return false
    return new Date(p.nextRevisionDueAt).getTime() < Date.now()
  })
  return { covered: coveredBy.length > 0, stale, coveredBy }
}

/** At least N distinct months in [from, to] with ≥1 publish in AMU space */
export function amuPublishesCoverQuarters(
  spaces: WikiSpace[],
  auditLedger: InspectionReadinessInput['auditLedger'],
  pages: WikiPage[],
  nowMs: number,
  monthsBack = 12,
): { count: number; distinctMonths: number; applies: boolean } {
  const amuSpace = spaces.find((s) => /amu/i.test(s.title))
  if (!amuSpace) return { count: 0, distinctMonths: 0, applies: true }
  const amuPageIds = new Set(pages.filter((p) => p.spaceId === amuSpace.id).map((p) => p.id))
  const from = nowMs - monthsBack * 30 * 86400000
  const months = new Set<string>()
  let count = 0
  for (const e of auditLedger) {
    if (e.action !== 'published') continue
    if (!amuPageIds.has(e.pageId)) continue
    const t = new Date(e.at).getTime()
    if (t < from || t > nowMs) continue
    count += 1
    const d = new Date(e.at)
    months.add(`${d.getFullYear()}-${d.getMonth()}`)
  }
  return { count, distinctMonths: months.size, applies: true }
}

export function computeInspectionReadiness(input: InspectionReadinessInput): {
  score: number
  breakdown: InspectionReadinessBreakdown
} {
  const { legalCoverage, pages, pageTemplates, spaces, auditLedger, employeeCount, nowMs, annualReviewLockedThisYear, varslingAckRate } =
    input

  const totalRows = legalCoverage.length
  let okCoverage = 0
  let anyStale = false
  for (const item of legalCoverage) {
    const { covered, stale } = coverageRow(item, pages, pageTemplates)
    if (covered && !stale) okCoverage += 1
    if (stale) anyStale = true
  }
  const ikScore = totalRows ? Math.round((okCoverage / totalRows) * MAX_IK) : 0
  const staleScore = anyStale ? 0 : MAX_STALE

  const annualScore = annualReviewLockedThisYear ? MAX_ANNUAL : 0

  let varslingScore = 0
  if (varslingAckRate != null && varslingAckRate >= 0.8) varslingScore = MAX_VARSLING

  const amuApplies = employeeCount >= 50
  let amuScore = MAX_AMU
  if (amuApplies) {
    const { distinctMonths } = amuPublishesCoverQuarters(spaces, auditLedger, pages, nowMs)
    // Heuristic: ≥4 publiseringer siste 12 mnd i AMU-mappe ≈ kvartalsvis dokumentasjon
    amuScore = distinctMonths >= 4 ? MAX_AMU : Math.round((distinctMonths / 4) * MAX_AMU)
  }

  const score = Math.min(100, ikScore + staleScore + annualScore + varslingScore + amuScore)
  return {
    score,
    breakdown: {
      total: score,
      ikCoverage: ikScore,
      maxIkCoverage: MAX_IK,
      noStale: staleScore,
      maxNoStale: MAX_STALE,
      annualReview: annualScore,
      maxAnnualReview: MAX_ANNUAL,
      varsling: varslingScore,
      maxVarsling: MAX_VARSLING,
      amuQuarterly: amuScore,
      maxAmuQuarterly: MAX_AMU,
    },
  }
}

export function readinessColor(score: number): 'red' | 'amber' | 'green' {
  if (score >= 80) return 'green'
  if (score >= 60) return 'amber'
  return 'red'
}
