// Internkontroll datasets — composes useRegelverkCoverage (5 of the 6
// member modules) with a small register_types query for the registers
// column, then exposes four scope-namespaced datasets:
//
//   internkontroll_kpi_summary       (kpi-record)
//   internkontroll_framework_coverage (segments — coverage % per framework)
//   internkontroll_gap_matrix        (heatmap — paragraphs × 5 modules)
//   internkontroll_recent_evidence   (rows — last execution events)
//
// The hook also exposes the raw coverage map + register rows so the
// Phase 2 paragraph inspector can read per-paragraph entries without
// re-fetching the same data.
//
// The Phase-1 evidence ledger is intentionally a stub: it emits a row
// per template-side entry from useRegelverkCoverage so the dashboard
// has *something* to render. Phase 2 swaps in the proper
// `useParagraphEvidence` 5-table union from spec §5.4.

import { useEffect, useMemo, useState } from 'react'
import type { DashboardFilter } from '../../../lib/dashboards/dashboardFilters'
import {
  useRegelverkCoverage,
  type CoverageEntry,
  type CoverageMap,
} from '../../../hooks/useRegelverkCoverage'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import {
  FRAMEWORKS,
  FRAMEWORK_IDS,
  GAP_MODULE_COLUMNS,
  chapterToken,
  type FrameworkId,
} from './frameworkParagraphs'
import { useControlsByLawRef } from './useControlsByLawRef'

type RegisterCoverageRow = { id: string; label: string; aml_paragraphs: string[] | null }
type PlanItemStatusRow = { status: 'planned' | 'in_progress' | 'blocked' | 'done' }

const PLAN_STATUS_LABEL: Record<PlanItemStatusRow['status'], string> = {
  planned: 'Planlagt',
  in_progress: 'Pågår',
  blocked: 'Blokkert',
  done: 'Fullført',
}

export type RegisterCoverageMatch = { id: string; label: string }

function normalizeLawRef(ref: string): string {
  return ref.replace(/\s+/g, ' ').replace(/§\s*/g, '§ ').trim()
}

// Dedupe coverage entries by `${kind}:${id}` so a single source resource
// is counted once even when it surfaces multiple times in the coverage
// hook (e.g. a checklist_template whose N items each tag the same §
// would produce 1 template entry + N item entries — all pointing at the
// same template id). Without dedup, a single checklist with 3 items can
// inflate the "Sjekklister" cell to 4. Mirrors the dedup pattern used
// by useRegelverkDatasets.
function dedupeEntries(entries: CoverageEntry[]): CoverageEntry[] {
  const m = new Map<string, CoverageEntry>()
  for (const e of entries) m.set(`${e.kind}:${e.id}`, e)
  return [...m.values()]
}

function pickFilterValue(filters: DashboardFilter[], dimensionId: string): string | null {
  const chip = filters.find((f) => f.dimensionId === dimensionId)
  if (!chip) return null
  if (typeof chip.value === 'string' && chip.value !== '') return chip.value
  if (Array.isArray(chip.value) && chip.value.length > 0 && typeof chip.value[0] === 'string') {
    return chip.value[0] as string
  }
  return null
}

export type InternkontrollDatasets = {
  internkontroll_kpi_summary: {
    paragraphsTotal: number
    paragraphsCovered: number
    pctCoverage: number
    paragraphsUncovered: number
    /** Count of compliance_plan_items with status='in_progress' across
     *  the active framework. Real metric — when zero, leaders know
     *  the closure backlog hasn't been picked up. */
    openPlanItems: number
  }
  internkontroll_framework_coverage: Record<string, number>
  internkontroll_gap_matrix: {
    rows: string[]
    columns: string[]
    cells: number[][]
    /** Reverse-lookup from the prefixed row label back to the bare
     *  law-ref string. Used by drill-down handlers to translate a cell
     *  click into a paragraph reference. */
    codeByLabel: Record<string, string>
  }
  internkontroll_recent_evidence: Array<{
    Paragraf: string
    Modul: string
    Type: string
    Tittel: string
    Kilde: string
  }>
  /** Plan items grouped by status — donut/bar input. */
  internkontroll_plan_items_by_status: Record<string, number>
}

export function useInternkontrollDatasets(filters: DashboardFilter[]): {
  datasets: InternkontrollDatasets
  loading: boolean
  framework: FrameworkId
  /** Raw coverage map — passed to the paragraph inspector. */
  coverage: CoverageMap
  /** Register rows that reference an AML paragraph — used by the inspector. */
  registerRows: RegisterCoverageRow[]
  /** Helper for the inspector — read entries for a paragraph + register matches. */
  entriesFor: (lawRef: string) => {
    entries: CoverageEntry[]
    registerMatches: RegisterCoverageMatch[]
  }
} {
  const { coverage, loading: coverageLoading } = useRegelverkCoverage()
  const controlsLookup = useControlsByLawRef()
  const { supabase, organization } = useOrgSetupContext()
  const [registerRows, setRegisterRows] = useState<RegisterCoverageRow[]>([])
  const [registersLoading, setRegistersLoading] = useState<boolean>(true)
  const [openPlanItems, setOpenPlanItems] = useState<number>(0)
  const [planItemsByStatus, setPlanItemsByStatus] = useState<Record<string, number>>({
    Planlagt: 0,
    Pågår: 0,
    Blokkert: 0,
    Fullført: 0,
  })

  useEffect(() => {
    if (!supabase || !organization?.id) {
      setRegistersLoading(false)
      return
    }
    let cancelled = false
    void supabase
      .from('register_types')
      .select('id, label, aml_paragraphs')
      .or(`organization_id.eq.${organization.id},organization_id.is.null`)
      .eq('is_active', true)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setRegisterRows([])
          setRegistersLoading(false)
          return
        }
        setRegisterRows(data as RegisterCoverageRow[])
        setRegistersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, organization?.id])

  // Plan-item status distribution for the active org — used by the
  // "Tiltak i arbeid" KPI and the "Tiltak per status" donut on the
  // dashboard. One query, two derived signals.
  useEffect(() => {
    if (!supabase || !organization?.id) {
      setOpenPlanItems(0)
      setPlanItemsByStatus({ Planlagt: 0, Pågår: 0, Blokkert: 0, Fullført: 0 })
      return
    }
    let cancelled = false
    void supabase
      .from('compliance_plan_items')
      .select('status')
      .eq('organization_id', organization.id)
      .is('deleted_at', null)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setOpenPlanItems(0)
          setPlanItemsByStatus({ Planlagt: 0, Pågår: 0, Blokkert: 0, Fullført: 0 })
          return
        }
        const rows = (data as PlanItemStatusRow[] | null) ?? []
        const counts: Record<string, number> = {
          Planlagt: 0, Pågår: 0, Blokkert: 0, Fullført: 0,
        }
        for (const r of rows) {
          const label = PLAN_STATUS_LABEL[r.status]
          if (label) counts[label] = (counts[label] ?? 0) + 1
        }
        setPlanItemsByStatus(counts)
        setOpenPlanItems(counts['Pågår'] ?? 0)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, organization?.id])

  const framework: FrameworkId = (pickFilterValue(filters, 'framework') as FrameworkId | null) ?? 'aml'
  const chapterFilter = pickFilterValue(filters, 'chapter')

  // Resolve coverage entries per paragraph and module column. Rows are
  // optionally narrowed by the `chapter` filter chip; row labels carry
  // a short chapter token ("K2A · AML § 2A-1") so chapter membership is
  // visible even without the chip.
  const matrix = useMemo(() => {
    const def = FRAMEWORKS[framework]
    const paragraphs = chapterFilter
      ? def.paragraphs.filter((p) => p.chapter === chapterFilter)
      : def.paragraphs
    const rowLabels = paragraphs.map((p) => `${chapterToken(p.chapter)} · ${p.code}`)
    const codeByLabel = new Map(rowLabels.map((label, i) => [label, paragraphs[i]!.code]))
    const cells: number[][] = paragraphs.map((p) => {
      const norm = normalizeLawRef(p.code)
      const entries = dedupeEntries(coverage.get(norm) ?? [])
      return GAP_MODULE_COLUMNS.map((col) => {
        if (col.id === 'controls') {
          // Count of internal controls (Tier 2) whose junction links to
          // this paragraph. Cross-framework — a single control can cover
          // ISO 9.3 + AML § 7-2 (2) f + IK-f § 5 nr. 8 simultaneously.
          // Lookup key is normalised (whitespace + § spacing) on both
          // sides so an org-custom clause with whitespace variants still
          // matches the framework paragraph definition.
          return controlsLookup.countByLawRef.get(normalizeLawRef(p.code)) ?? 0
        }
        if (col.id === 'registers') {
          if (framework !== 'aml') return 0
          return registerRows.reduce(
            (sum, r) => sum + ((r.aml_paragraphs ?? []).includes(p.code) ? 1 : 0),
            0,
          )
        }
        return entries.filter((e) => col.kinds.includes(e.kind)).length
      })
    })
    return {
      rows: rowLabels,
      columns: GAP_MODULE_COLUMNS.map((c) => c.label),
      cells,
      // Reverse-lookup so drill-down events can map the prefixed row
      // label back to the bare law-ref string.
      codeByLabel: Object.fromEntries(codeByLabel) as Record<string, string>,
    }
  }, [framework, coverage, registerRows, chapterFilter, controlsLookup.countByLawRef])

  const kpiSummary = useMemo(() => {
    const total = matrix.rows.length
    const covered = matrix.cells.reduce(
      (acc, row) => acc + (row.some((c) => c > 0) ? 1 : 0),
      0,
    )
    const pct = total === 0 ? 0 : Math.round((covered / total) * 100)
    return {
      paragraphsTotal: total,
      paragraphsCovered: covered,
      pctCoverage: pct,
      paragraphsUncovered: total - covered,
      openPlanItems,
    }
  }, [matrix, openPlanItems])

  const frameworkCoverage = useMemo(() => {
    const out: Record<string, number> = {}
    for (const id of FRAMEWORK_IDS) {
      const def = FRAMEWORKS[id]
      const total = def.paragraphs.length
      let covered = 0
      for (const p of def.paragraphs) {
        const norm = normalizeLawRef(p.code)
        const entries = coverage.get(norm) ?? []
        const hasNonRegister = entries.length > 0
        const hasRegister =
          id === 'aml' &&
          registerRows.some((r) => (r.aml_paragraphs ?? []).includes(p.code))
        // Tier-2 internal controls also count as coverage. Without this
        // branch a paragraph covered only by a control row shows green
        // in the gap matrix (the Kontroller column) but doesn't count
        // toward the framework coverage % — inconsistent. Key is the
        // normalised form so org-custom whitespace variants still match.
        const hasControl =
          (controlsLookup.countByLawRef.get(normalizeLawRef(p.code)) ?? 0) > 0
        if (hasNonRegister || hasRegister || hasControl) covered += 1
      }
      out[def.shortLabel] = total === 0 ? 0 : Math.round((covered / total) * 100)
    }
    return out
  }, [coverage, registerRows, controlsLookup.countByLawRef])

  const recentEvidence = useMemo(() => {
    const def = FRAMEWORKS[framework]
    const out: InternkontrollDatasets['internkontroll_recent_evidence'] = []
    for (const p of def.paragraphs) {
      const entries = coverage.get(normalizeLawRef(p.code)) ?? []
      for (const e of entries) {
        if (out.length >= 50) break
        out.push({
          Paragraf: p.code,
          Modul:
            GAP_MODULE_COLUMNS.find((c) => c.kinds.includes(e.kind))?.label ?? e.kind,
          Type: e.source === 'instance' ? 'Publisert' : 'Mal',
          Tittel: e.title,
          Kilde: e.status ?? '—',
        })
      }
      if (out.length >= 50) break
    }
    return out
  }, [framework, coverage])

  const datasets: InternkontrollDatasets = useMemo(
    () => ({
      internkontroll_kpi_summary: kpiSummary,
      internkontroll_framework_coverage: frameworkCoverage,
      internkontroll_gap_matrix: matrix,
      internkontroll_recent_evidence: recentEvidence,
      internkontroll_plan_items_by_status: planItemsByStatus,
    }),
    [kpiSummary, frameworkCoverage, matrix, recentEvidence, planItemsByStatus],
  )

  const entriesFor = useMemo(() => {
    return (lawRef: string) => {
      const norm = normalizeLawRef(lawRef)
      const entries = dedupeEntries(coverage.get(norm) ?? [])
      const registerMatches: RegisterCoverageMatch[] = registerRows
        .filter((r) => (r.aml_paragraphs ?? []).includes(lawRef))
        .map((r) => ({ id: r.id, label: r.label }))
      return { entries, registerMatches }
    }
  }, [coverage, registerRows])

  return {
    datasets,
    loading: coverageLoading || registersLoading || controlsLookup.loading,
    framework,
    coverage,
    registerRows,
    entriesFor,
  }
}
