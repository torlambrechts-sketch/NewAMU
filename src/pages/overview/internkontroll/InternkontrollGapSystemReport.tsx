// System-report-renderer for the Internkontroll Gap Analysis page.
//
// Dispatched from <SystemReport /> when the row's scopeId is
// 'internkontroll' and its slug is 'internkontroll-gap-analysis'.
// Shows the full paragraphs × 5 modules heatmap plus a compact KPI
// strip. Cell drill-down opens an in-page paragraph inspector with
// covering artefacts + plan items (Phase 2 + Phase 3).

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ModuleAnalyticsDashboard } from '../../../components/module/ModuleAnalyticsDashboard'
import { getDashboardScope } from '../../../lib/dashboards/dashboardRegistry'
import type { SystemReportRow } from '../../../lib/dashboards/useSystemReport'
import type {
  DashboardDimension,
  DashboardFilter,
} from '../../../lib/dashboards/dashboardFilters'
import { freshId } from '../../../lib/dashboards/freshId'
import { useInternkontrollDatasets } from './useInternkontrollDatasets'
import { useControlsByLawRef } from './useControlsByLawRef'
import { useCompliancePlanItems } from './useCompliancePlanItems'
import { ParagraphInspectorPanel } from './ParagraphInspectorPanel'
import { ShareWithAuditorButton } from './ShareWithAuditorButton'
import {
  FRAMEWORKS,
  FRAMEWORK_IDS,
  chaptersForFramework,
  type FrameworkId,
} from './frameworkParagraphs'
import './internkontrollDashboardScope'

export function InternkontrollGapSystemReport({
  row,
  breadcrumb,
}: {
  row: SystemReportRow
  breadcrumb?: { label: string; to?: string }[]
}) {
  const [searchParams] = useSearchParams()
  const [sessionFilters, setSessionFilters] = useState<DashboardFilter[]>(() => {
    const urlFramework = searchParams.get('framework')
    if (urlFramework && (FRAMEWORK_IDS as readonly string[]).includes(urlFramework)) {
      return [
        ...row.filters.filter((f) => f.dimensionId !== 'framework'),
        { id: freshId('f'), dimensionId: 'framework', operator: 'is', value: urlFramework },
      ]
    }
    return row.filters
  })
  const { datasets, loading, framework, entriesFor } =
    useInternkontrollDatasets(sessionFilters)
  const accent = getDashboardScope(row.scopeId)?.accent

  // Plan items for the active framework — loaded once, indexed by
  // law_ref so the inspector lookup is O(1).
  const planItems = useCompliancePlanItems(framework)
  // Internal controls (Tier 2) covering each paragraph. Same shape:
  // small per-org dataset loaded once and looked up by law_ref string.
  const controlsByLawRef = useControlsByLawRef()

  const [openLawRef, setOpenLawRef] = useState<string | null>(null)

  const dimensions: DashboardDimension[] = useMemo(
    () => [
      {
        id: 'framework',
        label: 'Regelverk',
        description: 'Velger hvilket regelverk gap-matrisen viser.',
        kind: 'enum',
        defaultOperator: 'is',
        operatorOptions: ['is'],
        loadOptions: () =>
          FRAMEWORK_IDS.map((id) => ({
            id,
            label: `${FRAMEWORKS[id].shortLabel} — ${FRAMEWORKS[id].fullLabel}`,
          })),
      },
      {
        id: 'chapter',
        label: 'Kapittel',
        description:
          'Begrenser matrisen til ett kapittel av valgt regelverk — nyttig når den fulle 80-rads-listen er for lang.',
        kind: 'enum',
        defaultOperator: 'is',
        operatorOptions: ['is'],
        loadOptions: () =>
          chaptersForFramework(framework).map((c) => ({ id: c, label: c })),
      },
    ],
    [framework],
  )

  const inspectorData = useMemo(() => {
    if (!openLawRef) return null
    const { entries, registerMatches } = entriesFor(openLawRef)
    const items = planItems.itemsByLawRef.get(openLawRef) ?? []
    // Normalise whitespace/§-spacing so the lookup keys match between
    // the gap-matrix row code and the controls map (built with the same
    // normalisation in useControlsByLawRef).
    const normalised = openLawRef.replace(/\s+/g, ' ').replace(/§\s*/g, '§ ').trim()
    const controls = controlsByLawRef.controlsByLawRef.get(normalised) ?? []
    return { entries, registerMatches, items, controls }
  }, [openLawRef, entriesFor, planItems.itemsByLawRef, controlsByLawRef.controlsByLawRef])

  return (
    <>
      <ModuleAnalyticsDashboard
        accent={accent}
        breadcrumb={breadcrumb}
        title={row.name}
        description={row.description ?? undefined}
        layout={row.layout}
        datasets={datasets as unknown as Record<string, unknown>}
        loading={loading}
        filters={sessionFilters}
        dimensions={dimensions}
        onFiltersChange={setSessionFilters}
        headerActions={
          <ShareWithAuditorButton
            framework={framework as FrameworkId}
            scopeLabel={row.name}
            snapshot={datasets as unknown as Record<string, unknown>}
            layout={row.layout}
          />
        }
        onDrillDown={(e) => {
          if (e.dimensionId !== 'gap_cell') return
          const [rowLabel] = e.segmentLabel.split('::')
          if (!rowLabel) return
          // Row labels are prefixed ("K2A · AML § 2A-1"); use the
          // dataset's reverse lookup to recover the bare law_ref.
          const lawRef = datasets.internkontroll_gap_matrix.codeByLabel[rowLabel] ?? rowLabel
          setOpenLawRef(lawRef)
        }}
      />

      <ParagraphInspectorPanel
        open={openLawRef !== null && inspectorData !== null}
        framework={framework as FrameworkId}
        lawRef={openLawRef}
        entries={inspectorData?.entries ?? []}
        registerMatches={inspectorData?.registerMatches ?? []}
        controls={inspectorData?.controls ?? []}
        planItems={inspectorData?.items ?? []}
        onClose={() => setOpenLawRef(null)}
        onCreatePlanItem={async (input) => {
          if (!openLawRef) return
          await planItems.createItem({
            law_ref: openLawRef,
            framework_id: framework as FrameworkId,
            title: input.title,
            description: input.description,
            status: input.status,
            due_at: input.dueAt,
          })
        }}
        onUpdatePlanItem={async (id, patch) => {
          await planItems.updateItem(id, patch)
        }}
        onDeletePlanItem={async (id) => {
          await planItems.deleteItem(id)
        }}
      />
    </>
  )
}
