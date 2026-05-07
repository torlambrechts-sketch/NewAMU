// useSurveyDatasets — extracted from SurveyAnalysePage (3.5.1).
// Mirrors useChecklistDatasets / useLearningDatasets in shape: take the
// active filters + the source data the page already owns, return the
// scope's `Record<datasetKey, unknown>` map.

import { useMemo } from 'react'
import type { DashboardFilter } from '../../../src/lib/dashboards/dashboardFilters'
import type {
  DepartmentRow,
  LocationRow,
} from '../../../src/types/organization'
import type { SurveyPackRow, SurveyRow, SurveyStatus } from '../types'
import type { SurveyTemplateCatalogRow } from '../surveyTemplateCatalogTypes'

export const STATUS_OPTIONS: { id: SurveyStatus; label: string }[] = [
  { id: 'draft', label: 'Kladd' },
  { id: 'active', label: 'Aktiv / publisert' },
  { id: 'closed', label: 'Lukket' },
  { id: 'archived', label: 'Arkivert' },
]

type FilterSelectors = {
  packs: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  templates: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  statuses: { ids: Set<SurveyStatus>; mode: 'include' | 'exclude' } | null
  categories: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  locations: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  departments: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  participants: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  anonymous: 'only' | 'exclude' | null
  from: Date | null
  to: Date | null
}

function buildSelectors(filters: DashboardFilter[]): FilterSelectors {
  const out: FilterSelectors = {
    packs: null,
    templates: null,
    statuses: null,
    categories: null,
    locations: null,
    departments: null,
    participants: null,
    anonymous: null,
    from: null,
    to: null,
  }
  const setOf = <T extends string>(v: unknown): Set<T> =>
    new Set(Array.isArray(v) ? (v as T[]) : typeof v === 'string' && v ? [v as T] : [])

  for (const f of filters) {
    const mode = f.operator === 'is_not' ? 'exclude' : 'include'
    if (f.dimensionId === 'pack') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.packs = { ids, mode }
    } else if (f.dimensionId === 'template') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.templates = { ids, mode }
    } else if (f.dimensionId === 'status') {
      const ids = setOf<SurveyStatus>(f.value)
      if (ids.size) out.statuses = { ids, mode }
    } else if (f.dimensionId === 'category') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.categories = { ids, mode }
    } else if (f.dimensionId === 'location') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.locations = { ids, mode }
    } else if (f.dimensionId === 'department') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.departments = { ids, mode }
    } else if (f.dimensionId === 'participant') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.participants = { ids, mode }
    } else if (f.dimensionId === 'anonymity') {
      const v = typeof f.value === 'string' ? f.value : ''
      if (v === 'anonymous') out.anonymous = 'only'
      else if (v === 'identified') out.anonymous = 'exclude'
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

export type SurveyDatasetsArgs = {
  filters: DashboardFilter[]
  surveys: SurveyRow[]
  templateCatalog: SurveyTemplateCatalogRow[]
  packs: SurveyPackRow[]
  locations: LocationRow[]
  departments: DepartmentRow[]
  /** Resolved at the call site from useSurveyOrgTemplates so the hook
   *  doesn't have to know about the override layer. */
  categoryByCatalogId: Map<string, string | null>
}

export function useSurveyDatasets({
  filters,
  surveys: rawSurveys,
  templateCatalog,
  packs,
  locations,
  departments,
  categoryByCatalogId,
}: SurveyDatasetsArgs): Record<string, unknown> {
  return useMemo(() => {
    const sel = buildSelectors(filters)
    const now = new Date()
    const yearStart = new Date(now.getFullYear(), 0, 1)

    // Filter surveys by chips first; downstream datasets bucket the
    // already-filtered set so a single chip moves every widget consistently.
    const surveys = rawSurveys.filter((s: SurveyRow) => {
      if (!matchesSet(sel.packs, s.pack)) return false
      if (s.catalog_id && !matchesSet(sel.templates, s.catalog_id)) return false
      if (sel.templates && !s.catalog_id) {
        if (sel.templates.mode === 'include') return false
      }
      if (sel.categories) {
        const catId = s.catalog_id ? categoryByCatalogId.get(s.catalog_id) ?? null : null
        if (!catId) {
          if (sel.categories.mode === 'include') return false
        } else if (!matchesSet(sel.categories, catId)) {
          return false
        }
      }
      if (!matchesSet(sel.statuses, s.status)) return false
      if (sel.locations) {
        if (!s.location_id) {
          if (sel.locations.mode === 'include') return false
        } else if (!matchesSet(sel.locations, s.location_id)) {
          return false
        }
      }
      if (sel.departments) {
        if (!s.department_id) {
          if (sel.departments.mode === 'include') return false
        } else if (!matchesSet(sel.departments, s.department_id)) {
          return false
        }
      }
      if (sel.participants) {
        const intersects = s.participant_member_ids.some((id) => sel.participants!.ids.has(id))
        if (sel.participants.mode === 'include' ? !intersects : intersects) return false
      }
      if (sel.anonymous === 'only' && !s.is_anonymous) return false
      if (sel.anonymous === 'exclude' && s.is_anonymous) return false
      if (sel.from || sel.to) {
        const at = s.closed_at
          ? new Date(s.closed_at)
          : s.published_at
          ? new Date(s.published_at)
          : s.created_at
          ? new Date(s.created_at)
          : null
        if (!dateInRange(at, sel.from, sel.to)) return false
      }
      return true
    })

    let total = 0
    let open = 0
    let closed = 0
    let ytdClosed = 0
    let anonymous = 0
    const statusCounts: Record<string, number> = {
      Kladd: 0,
      Aktiv: 0,
      Lukket: 0,
      Arkivert: 0,
    }
    const packCounts: Record<string, number> = {}
    const templateCounts = new Map<string, number>()
    const locationCounts = new Map<string, number>()
    const departmentCounts = new Map<string, number>()
    const locationById = new Map(locations.map((l) => [l.id, l.name]))
    const departmentById = new Map(departments.map((d) => [d.id, d.name]))

    const monthKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = (d: Date) =>
      d.toLocaleDateString('nb-NO', { month: 'short', year: '2-digit' })
    const months: { key: string; label: string }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ key: monthKey(d), label: monthLabel(d) })
    }
    // Responses-over-time: when survey was published in month X, attribute
    // its responses to X. We don't have per-response timestamps loaded here
    // (would need a separate query); the proxy is "publish month volume".
    const publishedByMonth = new Map<string, number>(months.map((m) => [m.key, 0]))

    for (const s of surveys) {
      total += 1
      if (s.status === 'closed') {
        closed += 1
        statusCounts.Lukket = (statusCounts.Lukket ?? 0) + 1
        if (s.closed_at && new Date(s.closed_at) >= yearStart) ytdClosed += 1
      } else if (s.status === 'archived') {
        statusCounts.Arkivert = (statusCounts.Arkivert ?? 0) + 1
      } else if (s.status === 'active') {
        open += 1
        statusCounts.Aktiv = (statusCounts.Aktiv ?? 0) + 1
      } else {
        open += 1
        statusCounts.Kladd = (statusCounts.Kladd ?? 0) + 1
      }
      if (s.is_anonymous) anonymous += 1

      const packLabel =
        packs.find((p) => p.slug === s.pack)?.short_name ?? s.pack
      packCounts[packLabel] = (packCounts[packLabel] ?? 0) + 1

      if (s.catalog_id) {
        const tpl = templateCatalog.find((t) => t.id === s.catalog_id)
        const tplName = tpl?.name ?? '(ad-hoc)'
        templateCounts.set(tplName, (templateCounts.get(tplName) ?? 0) + 1)
      } else {
        templateCounts.set('(ad-hoc)', (templateCounts.get('(ad-hoc)') ?? 0) + 1)
      }

      const locName = s.location_id
        ? locationById.get(s.location_id) ?? '(ukjent)'
        : '(uten lokasjon)'
      locationCounts.set(locName, (locationCounts.get(locName) ?? 0) + 1)

      const depName = s.department_id
        ? departmentById.get(s.department_id) ?? '(ukjent)'
        : '(uten avdeling)'
      departmentCounts.set(depName, (departmentCounts.get(depName) ?? 0) + 1)

      // Attribute each survey's responses to the month it was published.
      // Approximation — a more accurate version would bucket each
      // org_survey_responses row by its own submitted_at, but that would
      // require loading per-response data on the analyse list view.
      const published = s.published_at ? new Date(s.published_at) : null
      if (published) {
        const k = monthKey(published)
        if (publishedByMonth.has(k))
          publishedByMonth.set(k, (publishedByMonth.get(k) ?? 0) + s.response_count)
      }
    }

    // Cached counts on the surveys row are maintained by triggers in
    // migration 20260828120028. Sum across the filtered set; rate is
    // total responses / total invitations across published surveys
    // (drafts + archived contribute zero invitations).
    let responses = 0
    let invitationsTotal = 0
    for (const s of surveys) {
      responses += s.response_count
      if (s.status === 'active' || s.status === 'closed') {
        invitationsTotal += s.invitation_count
      }
    }
    const responseRatePct =
      invitationsTotal > 0 ? Math.round((responses / invitationsTotal) * 100) : 0

    const topTemplates = [...templateCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
    const templateBar: Record<string, number> = {}
    for (const [name, count] of topTemplates) templateBar[name] = count

    return {
      survey_kpi_summary: {
        total,
        open,
        closed,
        ytdClosed,
        responses,
        responseRatePct,
      },
      survey_status_distribution: statusCounts,
      survey_pack_distribution: packCounts,
      survey_template_distribution: templateBar,
      survey_responses_by_location: Object.fromEntries(locationCounts),
      survey_responses_by_department: Object.fromEntries(departmentCounts),
      survey_anonymity_distribution: {
        Anonym: anonymous,
        Identifisert: total - anonymous,
      },
      survey_responses_over_time: months.map((m) => ({
        x: m.label,
        y: publishedByMonth.get(m.key) ?? 0,
      })),
      survey_response_rate_over_time: months.map((m) => ({
        x: m.label,
        y: 0,
      })),
    } as Record<string, unknown>
  }, [filters, rawSurveys, templateCatalog, packs, locations, departments, categoryByCatalogId])
}
