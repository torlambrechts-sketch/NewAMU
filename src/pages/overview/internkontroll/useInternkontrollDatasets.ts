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
  type FrameworkId,
} from './frameworkParagraphs'

type RegisterCoverageRow = { id: string; label: string; aml_paragraphs: string[] | null }

export type RegisterCoverageMatch = { id: string; label: string }

function normalizeLawRef(ref: string): string {
  return ref.replace(/\s+/g, ' ').replace(/§\s*/g, '§ ').trim()
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
    /** Placeholder until tilsynssaker register is wired in Phase 2. */
    openPalegg: number
  }
  internkontroll_framework_coverage: Record<string, number>
  internkontroll_gap_matrix: {
    rows: string[]
    columns: string[]
    cells: number[][]
  }
  internkontroll_recent_evidence: Array<{
    Paragraf: string
    Modul: string
    Type: string
    Tittel: string
    Kilde: string
  }>
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
  const { supabase, organization } = useOrgSetupContext()
  const [registerRows, setRegisterRows] = useState<RegisterCoverageRow[]>([])
  const [registersLoading, setRegistersLoading] = useState<boolean>(true)

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

  const framework: FrameworkId = (pickFilterValue(filters, 'framework') as FrameworkId | null) ?? 'aml'

  // Resolve coverage entries per paragraph and module column.
  const matrix = useMemo(() => {
    const def = FRAMEWORKS[framework]
    const paragraphCodes = def.paragraphs.map((p) => p.code)
    const cells: number[][] = paragraphCodes.map((code) => {
      const norm = normalizeLawRef(code)
      const entries: CoverageEntry[] = coverage.get(norm) ?? []
      return GAP_MODULE_COLUMNS.map((col) => {
        if (col.id === 'registers') {
          // Registers aren't in useRegelverkCoverage; count from the
          // local register_types query — match by aml_paragraphs[].
          if (framework !== 'aml') return 0
          return registerRows.reduce(
            (sum, r) => sum + ((r.aml_paragraphs ?? []).includes(code) ? 1 : 0),
            0,
          )
        }
        return entries.filter((e) => col.kinds.includes(e.kind)).length
      })
    })
    return {
      rows: paragraphCodes,
      columns: GAP_MODULE_COLUMNS.map((c) => c.label),
      cells,
    }
  }, [framework, coverage, registerRows])

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
      openPalegg: 0,
    }
  }, [matrix])

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
        if (hasNonRegister || hasRegister) covered += 1
      }
      out[def.shortLabel] = total === 0 ? 0 : Math.round((covered / total) * 100)
    }
    return out
  }, [coverage, registerRows])

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
    }),
    [kpiSummary, frameworkCoverage, matrix, recentEvidence],
  )

  const entriesFor = useMemo(() => {
    return (lawRef: string) => {
      const norm = normalizeLawRef(lawRef)
      const entries: CoverageEntry[] = coverage.get(norm) ?? []
      const registerMatches: RegisterCoverageMatch[] = registerRows
        .filter((r) => (r.aml_paragraphs ?? []).includes(lawRef))
        .map((r) => ({ id: r.id, label: r.label }))
      return { entries, registerMatches }
    }
  }, [coverage, registerRows])

  return {
    datasets,
    loading: coverageLoading || registersLoading,
    framework,
    coverage,
    registerRows,
    entriesFor,
  }
}
