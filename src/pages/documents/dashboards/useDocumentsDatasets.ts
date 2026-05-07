// useDocumentsDatasets — extracted-style dataset compute for the documents
// dashboard scope (documents-parity §T2). Same shape as
// useChecklistDatasets / useSurveyDatasets / useTasksDatasets / useLearningDatasets:
// take active filter chips + the source data the page already owns,
// return the scope's `Record<datasetKey, unknown>` map.
//
// Documents have no sign event, so there's no "comparison vs prev YTD"
// machinery in the v1; it lands in T11 as a follow-up.

import { useMemo } from 'react'
import type { DashboardFilter } from '../../../lib/dashboards/dashboardFilters'
import type { OrgCustomTemplate } from '../../../hooks/useDocuments'
import type {
  PageStatus,
  WikiPage,
  WikiSpace,
} from '../../../types/documents'

export const STATUS_OPTIONS: { id: PageStatus; label: string }[] = [
  { id: 'draft', label: 'Kladd' },
  { id: 'published', label: 'Publisert' },
  { id: 'archived', label: 'Arkivert' },
]

export type RetentionBucket = 'overdue' | 'due_30' | 'due_60' | 'due_90' | 'future'

export const RETENTION_OPTIONS: { id: RetentionBucket; label: string }[] = [
  { id: 'overdue', label: 'Forfalt' },
  { id: 'due_30', label: 'Innen 30 dager' },
  { id: 'due_60', label: 'Innen 60 dager' },
  { id: 'due_90', label: 'Innen 90 dager' },
  { id: 'future', label: 'Senere' },
]

type FilterSelectors = {
  spaces: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  templates: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  statuses: { ids: Set<PageStatus>; mode: 'include' | 'exclude' } | null
  retentionBucket: RetentionBucket | null
  owners: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  from: Date | null
  to: Date | null
}

function buildSelectors(filters: DashboardFilter[]): FilterSelectors {
  const out: FilterSelectors = {
    spaces: null,
    templates: null,
    statuses: null,
    retentionBucket: null,
    owners: null,
    from: null,
    to: null,
  }
  const setOf = <T extends string>(v: unknown): Set<T> =>
    new Set(Array.isArray(v) ? (v as T[]) : typeof v === 'string' && v ? [v as T] : [])

  for (const f of filters) {
    const mode = f.operator === 'is_not' ? 'exclude' : 'include'
    if (f.dimensionId === 'space') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.spaces = { ids, mode }
    } else if (f.dimensionId === 'template') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.templates = { ids, mode }
    } else if (f.dimensionId === 'status') {
      const ids = setOf<PageStatus>(f.value)
      if (ids.size) out.statuses = { ids, mode }
    } else if (f.dimensionId === 'retention') {
      if (typeof f.value === 'string' && f.value) {
        out.retentionBucket = f.value as RetentionBucket
      }
    } else if (f.dimensionId === 'owner') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.owners = { ids, mode }
    } else if (f.dimensionId === 'date') {
      if (f.operator === 'between' && f.value && typeof f.value === 'object') {
        const r = f.value as { from?: string; to?: string }
        if (r.from) out.from = new Date(r.from)
        if (r.to) out.to = new Date(r.to + 'T23:59:59')
      } else if (f.operator === 'after' && typeof f.value === 'string' && f.value) {
        out.from = new Date(f.value)
      } else if (f.operator === 'before' && typeof f.value === 'string' && f.value) {
        out.to = new Date(f.value + 'T23:59:59')
      }
    }
  }
  return out
}

const matchesSet = <T,>(s: { ids: Set<T>; mode: 'include' | 'exclude' } | null, v: T): boolean => {
  if (!s) return true
  return s.mode === 'include' ? s.ids.has(v) : !s.ids.has(v)
}

const dateInRange = (d: Date | null, from: Date | null, to: Date | null): boolean => {
  if (!d) return true
  if (from && d < from) return false
  if (to && d > to) return false
  return true
}

function retentionBucketFor(page: WikiPage, now: Date): RetentionBucket | null {
  if (!page.nextRevisionDueAt) return null
  const due = new Date(page.nextRevisionDueAt)
  if (Number.isNaN(due.getTime())) return null
  const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 30) return 'due_30'
  if (diffDays <= 60) return 'due_60'
  if (diffDays <= 90) return 'due_90'
  return 'future'
}

export type DocumentsDatasetsArgs = {
  filters: DashboardFilter[]
  pages: WikiPage[]
  spaces: WikiSpace[]
  /** Per-org template list — drives the "Mest brukte maler" widget +
   *  the template filter dimension. Surfaces from useDocuments.orgCustomTemplates
   *  on the host page. */
  orgCustomTemplates: OrgCustomTemplate[]
  accessRequestsOpen: number
}

export function useDocumentsDatasets({
  filters,
  pages: rawPages,
  spaces,
  orgCustomTemplates,
  accessRequestsOpen,
}: DocumentsDatasetsArgs): Record<string, unknown> {
  return useMemo(() => {
    const sel = buildSelectors(filters)
    const now = new Date()
    const yearStart = new Date(now.getFullYear(), 0, 1)

    // Filter pages by chips first; downstream datasets bucket the
    // already-filtered set so a single chip moves every widget consistently.
    const pages = rawPages.filter((p) => {
      if (!matchesSet(sel.spaces, p.spaceId)) return false
      // Status filter — null page.status (legacy rows) are treated as 'draft'.
      if (!matchesSet(sel.statuses, p.status)) return false
      if (sel.owners) {
        if (!p.authorId) {
          if (sel.owners.mode === 'include') return false
        } else if (!matchesSet(sel.owners, p.authorId)) {
          return false
        }
      }
      if (sel.retentionBucket) {
        const b = retentionBucketFor(p, now)
        if (b !== sel.retentionBucket) return false
      }
      if (sel.from || sel.to) {
        // Per OQ-D2 we use updatedAt as the page's primary timestamp —
        // wiki_pages doesn't expose a published_at column today; the
        // "publish" event mutates updatedAt + status. When a published_at
        // column lands, swap this for it.
        const at = p.updatedAt ? new Date(p.updatedAt) : p.createdAt ? new Date(p.createdAt) : null
        if (!dateInRange(at, sel.from, sel.to)) return false
      }
      return true
    })

    // ── KPI ──────────────────────────────────────────────────────────────
    let total = 0
    let published = 0
    let pendingReview = 0 // page.reviewRequired && !reviewerId
    let retentionOverdue = 0
    let publishedYtd = 0
    /** YTD-published count for the equivalent date range last year — drives
     *  the comparison delta on the "Publisert i år" KPI (documents-parity §T11). */
    let publishedPrevYtd = 0
    const prevYearStart = new Date(now.getFullYear() - 1, 0, 1)
    const prevYearCutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    const statusCounts: Record<string, number> = { Kladd: 0, Publisert: 0, Arkivert: 0 }
    const spaceCounts = new Map<string, number>()
    const templateCounts = new Map<string, number>()
    const retentionCounts: Record<string, number> = {
      Forfalt: 0,
      'Innen 30 dager': 0,
      'Innen 60 dager': 0,
      'Innen 90 dager': 0,
      Senere: 0,
    }

    const monthKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = (d: Date) =>
      d.toLocaleDateString('nb-NO', { month: 'short', year: '2-digit' })
    const months: { key: string; label: string }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ key: monthKey(d), label: monthLabel(d) })
    }
    const publishedByMonth = new Map<string, number>(months.map((m) => [m.key, 0]))
    // Previous-period series (months 23..12 ago) — drives the line widget's
    // dashed comparison overlay (documents-parity §T11).
    const prevMonths: { key: string; label: string }[] = []
    for (let i = 23; i >= 12; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      prevMonths.push({ key: monthKey(d), label: monthLabel(d) })
    }
    const publishedByMonthPrev = new Map<string, number>(prevMonths.map((m) => [m.key, 0]))

    const spaceById = new Map(spaces.map((s) => [s.id, s.title]))
    const templateById = new Map(orgCustomTemplates.map((t) => [t.id, t.label]))

    for (const p of pages) {
      total += 1

      if (p.status === 'published') {
        published += 1
        statusCounts.Publisert += 1
        const at = p.updatedAt ? new Date(p.updatedAt) : null
        if (at) {
          if (at >= yearStart) publishedYtd += 1
          if (at >= prevYearStart && at <= prevYearCutoff) publishedPrevYtd += 1
          const k = monthKey(at)
          if (publishedByMonth.has(k))
            publishedByMonth.set(k, (publishedByMonth.get(k) ?? 0) + 1)
          else if (publishedByMonthPrev.has(k))
            publishedByMonthPrev.set(k, (publishedByMonthPrev.get(k) ?? 0) + 1)
        }
      } else if (p.status === 'archived') {
        statusCounts.Arkivert += 1
      } else {
        statusCounts.Kladd += 1
      }

      if (p.reviewRequired && !p.reviewerId) pendingReview += 1

      const retentionBucket = retentionBucketFor(p, now)
      if (retentionBucket === 'overdue') {
        retentionOverdue += 1
        retentionCounts.Forfalt += 1
      } else if (retentionBucket === 'due_30') retentionCounts['Innen 30 dager'] += 1
      else if (retentionBucket === 'due_60') retentionCounts['Innen 60 dager'] += 1
      else if (retentionBucket === 'due_90') retentionCounts['Innen 90 dager'] += 1
      else if (retentionBucket === 'future') retentionCounts.Senere += 1

      const spaceLabel = spaceById.get(p.spaceId) ?? '(uten plass)'
      spaceCounts.set(spaceLabel, (spaceCounts.get(spaceLabel) ?? 0) + 1)
    }

    // Template counts — derived by matching pages back to the template
    // they were created from. Pages don't carry a template id today, so
    // the v1 surfaces "ingen mal" + the org templates list as zero-counts
    // for catalog visibility. When `wiki_pages.created_from_template_id`
    // lands as part of T8 follow-up work, this loop should fill it in.
    for (const t of orgCustomTemplates) {
      templateCounts.set(t.label, 0)
    }

    const topTemplates = [...templateCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
    const templateBar: Record<string, number> = {}
    for (const [name, count] of topTemplates) templateBar[name] = count

    void templateById // tracked for future template-id lookups
    void published // suppressed — value flows through statusCounts already

    return {
      documents_kpi_summary: {
        totalPages: total,
        published,
        pendingReview,
        retentionOverdue,
        accessRequestsOpen,
        publishedYtd,
      },
      documents_status_distribution: statusCounts,
      documents_space_distribution: Object.fromEntries(spaceCounts),
      documents_top_templates: templateBar,
      documents_retention_buckets: retentionCounts,
      documents_published_over_time: months.map((m) => ({
        x: m.label,
        y: publishedByMonth.get(m.key) ?? 0,
      })),
      documents_published_over_time_prev: prevMonths.map((m) => ({
        x: m.label,
        y: publishedByMonthPrev.get(m.key) ?? 0,
      })),
      documents_kpi_summary_prev: { publishedYtd: publishedPrevYtd },
    } as Record<string, unknown>
  }, [filters, rawPages, spaces, orgCustomTemplates, accessRequestsOpen])
}
