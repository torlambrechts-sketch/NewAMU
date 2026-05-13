// Datasets-hook for regelverk_coverage scope.
//
// Tar useRegelverkCoverage()-output + aktive filter-chips og produserer
// nøklede datasets som widgets leser via datasetKey. Holder dashboard-
// engine uten module-spesifikk kunnskap — denne hooken er det eneste
// stedet som vet hvordan «covered/partial/uncovered» mappes til
// segment-form, kpi-record-form, og scorecard-grupper.

import { useMemo } from 'react'
import {
  REGELVERK,
  REQUIREMENTS,
  type Requirement,
} from '../../../data/regelverkRequirements'
import {
  useRegelverkCoverage,
  type CoverageEntry,
} from '../../../hooks/useRegelverkCoverage'
import type {
  DashboardDimension,
  DashboardFilter,
} from '../../../lib/dashboards/dashboardFilters'
import { REGELVERK_ROLES, requirementMatchesRole } from './regelverkRoles'
import {
  isFreshProof,
  isOperationalKind,
  isStaleInstance,
  obligationLabel,
  type RequirementWithCoverage,
} from './regelverkCoverageTypes'

export type RegelverkScorecardRow = {
  id: string
  label: string
  title?: string
  applies?: string
  obligation: Requirement['obligation']
  status: RequirementWithCoverage['status']
}

export type RegelverkScorecardGroup = {
  category: string
  total: number
  covered: number
  partial: number
  needsAttention: number
  rows: RegelverkScorecardRow[]
}

function pickFilterValue(filters: DashboardFilter[], dimensionId: string): string | null {
  const chip = filters.find((f) => f.dimensionId === dimensionId)
  if (!chip) return null
  if (typeof chip.value === 'string' && chip.value !== '') return chip.value
  return null
}

export function buildRegelverkDimensions(categories: string[]): DashboardDimension[] {
  return [
    {
      id: 'regelverk',
      label: 'Regelverk',
      kind: 'enum',
      defaultOperator: 'is',
      operatorOptions: ['is'],
      loadOptions: () =>
        REGELVERK.map((r) => ({ id: r.id, label: `${r.label} — ${r.fullName}` })),
    },
    {
      id: 'category',
      label: 'Kategori',
      kind: 'enum',
      defaultOperator: 'is',
      operatorOptions: ['is'],
      loadOptions: () => categories.map((c) => ({ id: c, label: c })),
    },
    {
      id: 'role',
      label: 'Rolle',
      kind: 'enum',
      defaultOperator: 'is',
      operatorOptions: ['is'],
      loadOptions: () => REGELVERK_ROLES.map((r) => ({ id: r.slug, label: r.label })),
    },
  ]
}

export function useRegelverkDatasets(filters: DashboardFilter[]): {
  datasets: Record<string, unknown>
  loading: boolean
  // Eksponer det datadrevne (requirements + coverage) til siden så slide-over
  // og chip-bar-kategorier kan dele samme grunn-sett.
  enriched: RequirementWithCoverage[]
  categories: string[]
} {
  const { coverage, loading } = useRegelverkCoverage()

  const regelverkId = pickFilterValue(filters, 'regelverk') ?? 'aml'
  const categoryFilter = pickFilterValue(filters, 'category')
  const roleFilter = pickFilterValue(filters, 'role')

  const requirementsForRegelverk = useMemo(
    () =>
      REQUIREMENTS.filter(
        (r) => r.regelverkId === regelverkId && requirementMatchesRole(r, roleFilter),
      ),
    [regelverkId, roleFilter],
  )

  const enriched = useMemo<RequirementWithCoverage[]>(() => {
    return requirementsForRegelverk.map((req) => {
      const exact = coverage.get(req.lawRef) ?? []
      const alts: CoverageEntry[] = []
      for (const altRef of req.alternateRefs ?? []) {
        const found = coverage.get(altRef) ?? []
        alts.push(...found)
      }
      const dedup = new Map<string, CoverageEntry>()
      for (const e of [...exact, ...alts]) dedup.set(`${e.kind}:${e.id}`, e)
      const entries = [...dedup.values()]

      const byKind: RequirementWithCoverage['byKind'] = {
        course_system: 0,
        course_org: 0,
        document: 0,
        document_template: 0,
        survey: 0,
        checklist_template: 0,
        checklist_item: 0,
        ros: 0,
        task: 0,
        meeting_template: 0,
      }
      for (const e of entries) byKind[e.kind] += 1

      const now = new Date()
      const freshInstances = entries.filter((e) => isFreshProof(e, now)).length
      const staleInstances = entries.filter((e) => isStaleInstance(e, now)).length
      const templatesOnly = entries.filter(
        (e) => e.source === 'template' && !isOperationalKind(e.kind),
      ).length
      const operationalCount = entries.filter((e) => isOperationalKind(e.kind)).length

      const status: RequirementWithCoverage['status'] =
        freshInstances > 0
          ? 'covered'
          : staleInstances + templatesOnly > 0
            ? 'partial'
            : operationalCount > 0
              ? 'only_avvik'
              : 'uncovered'

      return {
        ...req,
        coverage: entries,
        byKind,
        status,
        proof: { freshInstances, staleInstances, templatesOnly },
      }
    })
  }, [requirementsForRegelverk, coverage])

  // Kategori-chipen skjuler andre kategorier i scorecard/tabell, men de
  // skal fortsatt være valgbare i chip-bar — derfor leveres hele settet
  // separat til dimensions-bygging.
  const categories = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const r of enriched) {
      if (!seen.has(r.category)) {
        seen.add(r.category)
        out.push(r.category)
      }
    }
    return out
  }, [enriched])

  const filtered = useMemo(() => {
    if (!categoryFilter) return enriched
    return enriched.filter((r) => r.category === categoryFilter)
  }, [enriched, categoryFilter])

  const datasets = useMemo<Record<string, unknown>>(() => {
    const total = filtered.length
    const covered = filtered.filter((r) => r.status === 'covered').length
    const partial = filtered.filter((r) => r.status === 'partial').length
    const onlyAvvik = filtered.filter((r) => r.status === 'only_avvik').length
    const uncovered = filtered.filter((r) => r.status === 'uncovered').length
    const pct = total === 0 ? 0 : Math.round((covered / total) * 100)

    const uncoveredMandatory = filtered.filter(
      (r) => r.status === 'uncovered' && r.obligation === 'mandatory',
    ).length
    const partialMandatory = filtered.filter(
      (r) => r.status === 'partial' && r.obligation === 'mandatory',
    ).length
    const avvikMandatory = filtered.filter(
      (r) => r.status === 'only_avvik' && r.obligation === 'mandatory',
    ).length
    const uncoveredRecommended = filtered.filter(
      (r) => r.status === 'uncovered' && r.obligation === 'recommended',
    ).length
    const needsAttention =
      uncoveredMandatory + partialMandatory + avvikMandatory + uncoveredRecommended

    const kpiSummary: Record<string, number> = {
      total,
      covered,
      partial,
      onlyAvvik,
      uncovered,
      pct,
      uncoveredMandatory,
      partialMandatory,
      avvikMandatory,
      uncoveredRecommended,
      needsAttention,
    }

    const statusDistribution = {
      Dekket: covered,
      'Mangler bevis': partial,
      'Kun avvik': onlyAvvik,
      Udekket: uncovered,
    }

    const obligationDistribution: Record<string, number> = {}
    for (const r of filtered) {
      const k = obligationLabel(r.obligation)
      obligationDistribution[k] = (obligationDistribution[k] ?? 0) + 1
    }

    // Group by category preserving requirement insertion order.
    const groupMap = new Map<string, RegelverkScorecardGroup>()
    for (const r of filtered) {
      let g = groupMap.get(r.category)
      if (!g) {
        g = {
          category: r.category,
          total: 0,
          covered: 0,
          partial: 0,
          needsAttention: 0,
          rows: [],
        }
        groupMap.set(r.category, g)
      }
      g.total += 1
      if (r.status === 'covered') g.covered += 1
      else if (r.status === 'partial') g.partial += 1
      else g.needsAttention += 1
      g.rows.push({
        id: r.lawRef,
        label: r.lawRef,
        title: r.title,
        applies: r.applies,
        obligation: r.obligation,
        status: r.status,
      })
    }
    const scorecardGroups: RegelverkScorecardGroup[] = [...groupMap.values()]

    const topGaps = filtered
      .filter((r) => r.status === 'uncovered' || r.status === 'partial')
      .sort((a, b) => {
        const w = (s: RequirementWithCoverage) =>
          s.obligation === 'mandatory' ? 0 : s.obligation === 'recommended' ? 1 : 2
        return w(a) - w(b)
      })
      .slice(0, 25)
      .map((r) => ({
        lawRef: r.lawRef,
        title: r.title,
        category: r.category,
        obligation: obligationLabel(r.obligation),
        status:
          r.status === 'covered'
            ? 'Dekket'
            : r.status === 'partial'
              ? 'Mangler bevis'
              : r.status === 'only_avvik'
                ? 'Kun avvik'
                : 'Udekket',
      }))

    return {
      regelverk_kpi_summary: kpiSummary,
      regelverk_status_distribution: statusDistribution,
      regelverk_obligation_distribution: obligationDistribution,
      regelverk_scorecard_groups: scorecardGroups,
      regelverk_top_gaps: topGaps,
    }
  }, [filtered])

  return { datasets, loading, enriched: filtered, categories }
}
