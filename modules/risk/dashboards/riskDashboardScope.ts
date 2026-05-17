// Risk analytics scope registration.
//
// Registers `risk` with the dashboard registry. Datasets are computed by
// RiskAnalysePage from useRiskDatasets (P1: client-side aggregation from
// compliance findings + tasks + deviations + inspection findings + alert
// cases; P2: read from `risk_register_unified_v` view). This file is
// pure metadata — import it as a side effect to trigger registration.
//
// Accent: #b91c1c (deep red — distinct from tasks amber (#c2410c) and
// overview indigo (#4338ca) so the module visibly reads as "risk layer").
//
// Default layout serves the HMS-leder audience (11 widgets). The
// engine's `dashboard_layouts` named-views feature (DashboardChooser +
// saveAs / markDefault) lets users fork into Styret / Verneombud lenses;
// the additional preset layouts live alongside as exported constants so
// callers can pre-seed them per org if desired.

import type {
  ReportModule,
  ReportModuleBar,
  ReportModuleBowtie,
  ReportModuleDonut,
  ReportModuleHeatmap,
  ReportModuleKpi,
  ReportModuleLine,
  ReportModuleScorecard,
} from '../../../src/types/reportBuilder'
import {
  registerDashboardScope,
  type DatasetMeta,
  type WidgetCatalogEntry,
} from '../../../src/lib/dashboards/dashboardRegistry'
import { makeFilter, type DashboardFilterPreset } from '../../../src/lib/dashboards/dashboardFilters'

export const RISK_DASHBOARD_SCOPE_ID = 'risk'

// ── Dataset catalogue ────────────────────────────────────────────────────
//
// DatasetMeta.shape is constrained to kpi-record | segments | series |
// rows. Heatmap and scorecard datasets register as `rows`; widgets read
// via rowsPath / groupsPath.
const DATASETS: DatasetMeta[] = [
  { key: 'risk_kpi_summary', label: 'Risiko — KPI-sammendrag', shape: 'kpi-record' },
  { key: 'risk_matrix_cells', label: 'Risikomatrise — 5×5', shape: 'rows' },
  { key: 'risk_top10_scorecard', label: 'Topp 10 risikoer', shape: 'rows' },
  { key: 'risk_by_hazard_category', label: 'Per fareklasse', shape: 'segments' },
  { key: 'risk_psychosocial_share', label: 'Psykososial andel', shape: 'segments' },
  { key: 'risk_by_department', label: 'Per avdeling', shape: 'segments' },
  { key: 'risk_by_source', label: 'Per kilde', shape: 'segments' },
  { key: 'risk_severity_distribution', label: 'Per alvorlighet', shape: 'segments' },
  { key: 'risk_residual_band', label: 'Restrisiko-bånd', shape: 'segments' },
  { key: 'risk_time_to_mitigation_trend', label: 'Tid til tiltak (median)', shape: 'series' },
  { key: 'risk_control_effectiveness', label: 'Kontrolleffektivitet', shape: 'segments' },
  { key: 'risk_action_plan_coverage', label: 'Handlingsplan-dekning', shape: 'segments' },
  { key: 'risk_ageing_distribution', label: 'Alder siden vurdert', shape: 'segments' },
]

// ── KPI widgets ──────────────────────────────────────────────────────────
//
// Each risk KPI declares the comparison dataset key + path so the
// widget renderer can show a delta when the user picks "Sammenlign:
// Forrige periode" (or "Forrige år"). When comparison is off,
// useRiskDatasets emits an empty `risk_kpi_summary_prev` object and
// the delta chip simply doesn't render.

const KPI_OPEN: ReportModuleKpi = {
  id: 'kpi-risks-open', kind: 'kpi',
  datasetKey: 'risk_kpi_summary', title: 'Aktive risikoer',
  valuePath: 'openRisks', subtitle: 'Identifiserte, ikke lukket', colSpan: 'sm',
  comparisonDatasetKey: 'risk_kpi_summary_prev', comparisonValuePath: 'openRisks',
  comparisonLabel: 'vs. forrige periode',
}
const KPI_RED: ReportModuleKpi = {
  id: 'kpi-risks-red', kind: 'kpi',
  datasetKey: 'risk_kpi_summary', title: 'Røde risikoer (13–25)',
  valuePath: 'redBand', subtitle: 'Uakseptabel restrisiko',
  comparisonGoal: 'decrease', colSpan: 'sm',
  comparisonDatasetKey: 'risk_kpi_summary_prev', comparisonValuePath: 'redBand',
  comparisonLabel: 'vs. forrige periode',
}
const KPI_RESIDUAL_UNJUSTIFIED: ReportModuleKpi = {
  id: 'kpi-residual-unjustified', kind: 'kpi',
  datasetKey: 'risk_kpi_summary', title: 'Restrisiko uten begrunnelse',
  valuePath: 'residualUnjustified',
  subtitle: 'Arbeidstilsynet-flagg — IK-f § 5 nr. 6',
  comparisonGoal: 'decrease', colSpan: 'sm',
  comparisonDatasetKey: 'risk_kpi_summary_prev', comparisonValuePath: 'residualUnjustified',
  comparisonLabel: 'vs. forrige periode',
}
const KPI_STALE: ReportModuleKpi = {
  id: 'kpi-ageing-stale', kind: 'kpi',
  datasetKey: 'risk_kpi_summary', title: 'Ikke vurdert siste 12 mnd',
  valuePath: 'staleOver12m',
  subtitle: 'ISO 45001 2026 — unngå statisk register',
  comparisonGoal: 'decrease', colSpan: 'sm',
  comparisonDatasetKey: 'risk_kpi_summary_prev', comparisonValuePath: 'staleOver12m',
  comparisonLabel: 'vs. forrige periode',
}
const KPI_PSYCHOSOCIAL: ReportModuleKpi = {
  id: 'kpi-psychosocial-open', kind: 'kpi',
  datasetKey: 'risk_kpi_summary', title: 'Psykososial — åpne',
  valuePath: 'psychosocialOpen',
  subtitle: 'AML § 4-3', colSpan: 'sm',
  comparisonDatasetKey: 'risk_kpi_summary_prev', comparisonValuePath: 'psychosocialOpen',
  comparisonLabel: 'vs. forrige periode',
}
const KPI_CRITICAL_AVVIK_LINKED: ReportModuleKpi = {
  id: 'kpi-critical-avvik-linked', kind: 'kpi',
  datasetKey: 'risk_kpi_summary', title: 'Røde med åpent avvik',
  valuePath: 'criticalAvvikLinked',
  subtitle: 'Risiko → handlingsplan', colSpan: 'sm',
  comparisonDatasetKey: 'risk_kpi_summary_prev', comparisonValuePath: 'criticalAvvikLinked',
  comparisonLabel: 'vs. forrige periode',
}

// ── Heatmap / scorecard widgets ──────────────────────────────────────────

const HEATMAP_5X5: ReportModuleHeatmap = {
  id: 'heatmap-5x5', kind: 'heatmap',
  datasetKey: 'risk_matrix_cells',
  title: 'Risikomatrise — sannsynlighet × konsekvens',
  subtitle: 'Antall risikoer per celle · grønn ≤6 · gul ≤12 · rød 13–25',
  rowsPath: 'rows', columnsPath: 'columns', cellsPath: 'cells',
  valueLabel: 'Antall risikoer',
  valueMin: 0,
  colSpan: 'lg',
}
const SCORECARD_TOP10: ReportModuleScorecard = {
  id: 'scorecard-top10', kind: 'scorecard',
  datasetKey: 'risk_top10_scorecard',
  title: 'Topp 10 risikoer — etter restrisiko',
  subtitle: 'Klikk en rad for å åpne risikoen',
  groupsPath: '',
  drillDimensionId: 'riskId',
  colSpan: 'full',
}
const BOWTIE_TOP: ReportModuleBowtie = {
  id: 'bowtie-top-hazards', kind: 'bowtie',
  datasetKey: 'risk_bowtie_top',
  title: 'Bowtie — topp 5 røde farekilder',
  subtitle: 'Preventive barrierer (sjekklister) · sentral § · reaktive (CAPA)',
  groupsPath: '',
  drillDimensionId: 'riskId',
  colSpan: 'full',
}

// ── Distribution widgets ─────────────────────────────────────────────────

const BAR_BY_CATEGORY: ReportModuleBar = {
  id: 'bar-by-category', kind: 'bar',
  datasetKey: 'risk_by_hazard_category', title: 'Risiko per fareklasse',
  seriesKeys: [], drillDimensionId: 'hazardCategory', colSpan: 'md',
}
const DONUT_PSYCHOSOCIAL: ReportModuleDonut = {
  id: 'donut-psychosocial', kind: 'donut',
  datasetKey: 'risk_psychosocial_share',
  title: 'Psykososial risiko (AML § 4-3)',
  subtitle: 'Andel av alle aktive risikoer',
  segmentsPath: '', drillDimensionId: 'hazardCategory', colSpan: 'md',
}
const BAR_BY_DEPARTMENT: ReportModuleBar = {
  id: 'bar-by-department', kind: 'bar',
  datasetKey: 'risk_by_department', title: 'Risiko per avdeling',
  seriesKeys: [], drillDimensionId: 'department', colSpan: 'md',
}
const DONUT_BY_SOURCE: ReportModuleDonut = {
  id: 'donut-by-source', kind: 'donut',
  datasetKey: 'risk_by_source', title: 'Risiko per kilde',
  subtitle: 'Sjekklister, avvik, alarmer, inspeksjon',
  segmentsPath: '', drillDimensionId: 'source', colSpan: 'md',
}
const DONUT_SEVERITY: ReportModuleDonut = {
  id: 'donut-severity', kind: 'donut',
  datasetKey: 'risk_severity_distribution', title: 'Per alvorlighet',
  segmentsPath: '', drillDimensionId: 'severityTier', colSpan: 'md',
}
const DONUT_RESIDUAL_BAND: ReportModuleDonut = {
  id: 'donut-residual-band', kind: 'donut',
  datasetKey: 'risk_residual_band', title: 'Restrisiko-bånd',
  segmentsPath: '', drillDimensionId: 'residualBand', colSpan: 'md',
}
const DONUT_CONTROL_EFFECTIVENESS: ReportModuleDonut = {
  id: 'donut-control-effectiveness', kind: 'donut',
  datasetKey: 'risk_control_effectiveness',
  title: 'Kontrolleffektivitet',
  segmentsPath: '', colSpan: 'md',
}
const BAR_ACTION_PLAN_COVERAGE: ReportModuleBar = {
  id: 'bar-action-plan-coverage', kind: 'bar',
  datasetKey: 'risk_action_plan_coverage',
  title: 'Risiko → handlingsplan-dekning (IK-f § 5 nr. 7)',
  subtitle: 'Andel risikoer med åpent tiltak',
  seriesKeys: [], colSpan: 'md',
}
const BAR_AGEING: ReportModuleBar = {
  id: 'bar-ageing', kind: 'bar',
  datasetKey: 'risk_ageing_distribution',
  title: 'Alder siden siste vurdering',
  seriesKeys: [], colSpan: 'md',
}

// ── Trend ────────────────────────────────────────────────────────────────

const LINE_TIME_TO_MITIGATION: ReportModuleLine = {
  id: 'line-time-to-mitigation', kind: 'line',
  datasetKey: 'risk_time_to_mitigation_trend',
  title: 'Tid til tiltak — median (måned)',
  subtitle: 'Avvik: dager fra opprettet til lukket',
  pointsPath: '', xLabel: 'Måned', yLabel: 'Dager (median)',
  colSpan: 'md',
}

// ── Default layout (HMS-leder lens) ─────────────────────────────────────

const DEFAULT_LAYOUT: ReportModule[] = [
  KPI_OPEN, KPI_RED, KPI_RESIDUAL_UNJUSTIFIED, KPI_STALE,
  HEATMAP_5X5,
  SCORECARD_TOP10,
  // Bowtie sits after the top-10 list so the read order is:
  // KPI overview → matrix → ranked list → deep-dive on top hazards →
  // distributions → trend. Two `full`-spanning widgets in a row is
  // intentional; this is the centerpiece of the page.
  BOWTIE_TOP,
  BAR_BY_CATEGORY, DONUT_PSYCHOSOCIAL,
  BAR_BY_DEPARTMENT, LINE_TIME_TO_MITIGATION,
  BAR_ACTION_PLAN_COVERAGE,
]

// ── Preset layouts for other audiences ──────────────────────────────────
// Exported so a future seed migration (or page-level "Bytt visning"
// affordance) can stamp shared `dashboard_layouts` rows per org.

export const STYRET_PRESET_LAYOUT: ReportModule[] = [
  KPI_RED, KPI_RESIDUAL_UNJUSTIFIED, KPI_STALE, KPI_CRITICAL_AVVIK_LINKED,
  SCORECARD_TOP10,
  LINE_TIME_TO_MITIGATION,
]

export const VERNEOMBUD_PRESET_LAYOUT: ReportModule[] = [
  KPI_OPEN, KPI_PSYCHOSOCIAL, KPI_RED,
  DONUT_PSYCHOSOCIAL,
  BAR_BY_DEPARTMENT,
  HEATMAP_5X5,
  BAR_ACTION_PLAN_COVERAGE,
  LINE_TIME_TO_MITIGATION,
]

export const HMS_LEDER_PRESET_LAYOUT: ReportModule[] = DEFAULT_LAYOUT

// ── Widget catalog ───────────────────────────────────────────────────────

const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  { catalogId: 'kpi-risks-open', category: 'Volum', label: 'Aktive risikoer', template: KPI_OPEN },
  { catalogId: 'kpi-risks-red', category: 'Volum', label: 'Røde risikoer (13–25)', template: KPI_RED },
  { catalogId: 'kpi-residual-unjustified', category: 'Compliance', label: 'Restrisiko uten begrunnelse', description: 'Arbeidstilsynet-flagg — IK-f § 5 nr. 6', template: KPI_RESIDUAL_UNJUSTIFIED },
  { catalogId: 'kpi-ageing-stale', category: 'Compliance', label: 'Ikke vurdert siste 12 mnd', template: KPI_STALE },
  { catalogId: 'kpi-psychosocial-open', category: 'Psykososial', label: 'Psykososial — åpne (AML § 4-3)', template: KPI_PSYCHOSOCIAL },
  { catalogId: 'kpi-critical-avvik-linked', category: 'CAPA', label: 'Røde med åpent avvik', template: KPI_CRITICAL_AVVIK_LINKED },
  { catalogId: 'heatmap-5x5', category: 'Risikomatrise', label: '5×5 sannsynlighet × konsekvens', description: 'Klikk en celle for å filtrere alle widgets.', template: HEATMAP_5X5 },
  { catalogId: 'scorecard-top10', category: 'Risikomatrise', label: 'Topp 10 risikoer', template: SCORECARD_TOP10 },
  { catalogId: 'bowtie-top-hazards', category: 'Risikomatrise', label: 'Bowtie — topp 5 røde', description: 'Preventive + reaktive barrierer per topp-rød risiko.', template: BOWTIE_TOP },
  { catalogId: 'bar-by-category', category: 'Fordeling', label: 'Per fareklasse', template: BAR_BY_CATEGORY },
  { catalogId: 'donut-psychosocial', category: 'Psykososial', label: 'Psykososial andel', template: DONUT_PSYCHOSOCIAL },
  { catalogId: 'bar-by-department', category: 'Fordeling', label: 'Per avdeling', template: BAR_BY_DEPARTMENT },
  { catalogId: 'donut-by-source', category: 'Fordeling', label: 'Per kilde', template: DONUT_BY_SOURCE },
  { catalogId: 'donut-severity', category: 'Fordeling', label: 'Per alvorlighet', template: DONUT_SEVERITY },
  { catalogId: 'donut-residual-band', category: 'Fordeling', label: 'Restrisiko-bånd', template: DONUT_RESIDUAL_BAND },
  { catalogId: 'donut-control-effectiveness', category: 'Kontroll', label: 'Kontrolleffektivitet', template: DONUT_CONTROL_EFFECTIVENESS },
  { catalogId: 'bar-action-plan-coverage', category: 'CAPA', label: 'Handlingsplan-dekning', description: 'IK-f § 5 nr. 7 — andel risikoer med tiltak.', template: BAR_ACTION_PLAN_COVERAGE },
  { catalogId: 'bar-ageing', category: 'Compliance', label: 'Alder siden vurdert', template: BAR_AGEING },
  { catalogId: 'line-time-to-mitigation', category: 'Trender', label: 'Tid til tiltak (median)', template: LINE_TIME_TO_MITIGATION },
]

// ── Scope-shipped presets (quick-filter chips) ──────────────────────────
//
// Each preset replaces the active filter set atomically. Hooked into the
// engine via the `presets` field on the registered scope; the filter bar
// renders them as small chips next to "+ Filter".
//
// `freshId()`-suffixed chip ids are not stable across renders, but
// `filtersEqual` compares on dimensionId + operator + value, not id —
// so the "active" state of the preset chip resolves correctly even
// when the filters were applied earlier and re-loaded from the DB.
export const RISK_PRESETS: DashboardFilterPreset[] = [
  {
    id: 'preset-red-risks',
    label: 'Røde risikoer',
    description: 'Bare risikoer i uakseptabelt bånd (13–25).',
    filters: [makeFilter('residualBand', 'is', 'red')],
  },
  {
    id: 'preset-psykososial',
    label: 'Psykososial',
    description: 'Psykososialt arbeidsmiljø (AML § 4-3).',
    filters: [makeFilter('hazardCategory', 'is', 'psychosocial')],
  },
  {
    id: 'preset-verneombud',
    label: 'Verneombud',
    description: 'Bilde for verneombud — psykososial + åpne risikoer.',
    filters: [
      makeFilter('hazardCategory', 'in', ['psychosocial', 'ergonomic', 'physical']),
      makeFilter('status', 'in', ['open', 'in_progress']),
    ],
  },
  {
    id: 'preset-styret',
    label: 'Styret',
    description: 'Topp-presentert bilde for styret — kun røde.',
    filters: [makeFilter('residualBand', 'is', 'red')],
    comparison: 'previous_period',
  },
]

registerDashboardScope({
  scopeId: RISK_DASHBOARD_SCOPE_ID,
  label: 'Risiko',
  defaultLayout: DEFAULT_LAYOUT,
  widgetCatalog: WIDGET_CATALOG,
  datasets: DATASETS,
  accent: '#b91c1c',
  presets: RISK_PRESETS,
  // Risiko-modulen er først ute med tverrgående sammenligning.
  // useRiskDatasets bygger `risk_kpi_summary_prev` når dashboard.comparison
  // != 'none', og risiko-KPI-widgetene refererer den via comparisonDatasetKey.
  supportsComparison: true,
})
