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
import { AuditorTokensSection } from '../../../../modules/compliance-layer/admin/AuditorTokensSection'
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
  // Surface plan-item mutation failures (insert / update / delete)
  // that the hook otherwise swallows into a null/false return. Without
  // this, a user who lacks the per-org permission to write to
  // compliance_plan_items clicks "Opprett tiltak" and sees nothing
  // happen.
  const [planItemError, setPlanItemError] = useState<string | null>(null)

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
          <div className="flex items-center gap-2">
            <a
              href={`/overview/internkontroll/plan?framework=${framework}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              Plan & tidslinje
            </a>
            <ShareWithAuditorButton
              framework={framework as FrameworkId}
              scopeLabel={row.name}
              snapshot={datasets as unknown as Record<string, unknown>}
              layout={row.layout}
            />
          </div>
        }
        onDrillDown={(e) => {
          if (e.dimensionId !== 'gap_cell') return
          const [rowLabel] = e.segmentLabel.split('::')
          if (!rowLabel) return
          // Row labels are prefixed ("K2A · AML § 2A-1"); use the
          // dataset's reverse lookup to recover the bare law_ref.
          const lawRef = datasets.internkontroll_gap_matrix.codeByLabel[rowLabel] ?? rowLabel
          // Switching to a different paragraph from inside the open
          // inspector drops the previous error context. Same intent
          // as onClose, but for the in-place switch path.
          if (lawRef !== openLawRef) setPlanItemError(null)
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
        planItemError={planItemError}
        onDismissPlanItemError={() => setPlanItemError(null)}
        onClose={() => {
          setOpenLawRef(null)
          // Reset the error when the inspector closes; a fresh open on
          // another paragraph shouldn't inherit the previous failure.
          setPlanItemError(null)
        }}
        onCreatePlanItem={async (input) => {
          if (!openLawRef) return
          const created = await planItems.createItem({
            law_ref: openLawRef,
            framework_id: framework as FrameworkId,
            title: input.title,
            description: input.description,
            status: input.status,
            due_at: input.dueAt,
          })
          // Only update the error on outcome change — do NOT clear on
          // success, since the user might still want to see a previous
          // failure for a different action they took (the dismiss
          // button is the explicit ack).
          if (!created) {
            setPlanItemError(
              `Kunne ikke opprette tiltak for ${openLawRef}. Prøv igjen, eller kontakt en administrator om problemet vedvarer.`,
            )
          }
        }}
        onUpdatePlanItem={async (id, patch) => {
          const updated = await planItems.updateItem(id, patch)
          if (!updated) {
            setPlanItemError(
              'Kunne ikke oppdatere tiltaket. Prøv igjen, eller kontakt en administrator om problemet vedvarer.',
            )
          }
        }}
        onDeletePlanItem={async (id) => {
          const ok = await planItems.deleteItem(id)
          if (!ok) {
            setPlanItemError(
              'Kunne ikke slette tiltaket. Prøv igjen, eller kontakt en administrator om problemet vedvarer.',
            )
          }
        }}
      />

      {/* Active auditor share-tokens — scoped to the currently-active
          framework so internkontroll admins only see tokens minted from
          this surface. Lets them revoke without leaving the page. */}
      <div className="mx-auto mt-6 w-full max-w-7xl px-4 md:px-8">
        <AuditorTokensSection
          frameworkFilter={framework}
          title="Aktive revisor-lenker for dette regelverket"
          description="Lenker du har delt for gjeldende regelverk. Tilbakekall for å oppheve tilgangen umiddelbart."
        />
      </div>
    </>
  )
}
