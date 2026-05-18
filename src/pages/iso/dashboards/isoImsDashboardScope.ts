// ISO IMS composite dashboard scope.
//
// Aggregates gap scores, SoA implementation rate, open CAPAs, and audit
// activity across all 4 ISO standards into a single curated view.
// Follows the exact same pattern as hmsOverviewScope.ts — the engine
// handles layout persistence, filter chips, and widget rendering.
//
// Side-effect import in IsoImsAnalysePage.tsx registers this scope at
// module load time. Missing this import → scope silently unregistered.

import type {
  ReportModule,
  ReportModuleKpi,
  ReportModuleBar,
  ReportModuleDonut,
  ReportModuleTable,
} from '../../../types/reportBuilder'
import {
  registerDashboardScope,
  type DatasetMeta,
  type WidgetCatalogEntry,
} from '../../../lib/dashboards/dashboardRegistry'

export const ISO_IMS_SCOPE_ID = 'iso_ims'

const DATASETS: DatasetMeta[] = [
  { key: 'iso_gap_scores',             label: 'ISO — Gap-score per standard',          shape: 'kpi-record' },
  { key: 'iso_soa_implementation',     label: 'ISO 27001 — SoA implementeringsgrad',   shape: 'kpi-record' },
  { key: 'iso_open_capas_by_standard', label: 'ISO — Åpne tiltak per standard',        shape: 'segments' },
  { key: 'iso_legal_compliance',       label: 'ISO — Rettslig samsvar (status)',        shape: 'segments' },
  { key: 'iso_audit_schedule',         label: 'ISO — Revisjonsplan (kommende)',         shape: 'rows' },
  { key: 'iso_recent_findings',        label: 'ISO — Siste avvik fra revisjoner',       shape: 'rows' },
]

// ── KPI strip ─────────────────────────────────────────────────────────────────

const KPI_GAP_9001: ReportModuleKpi = {
  id: 'kpi-gap-9001',
  kind: 'kpi',
  datasetKey: 'iso_gap_scores',
  title: 'Gap-score ISO 9001',
  valuePath: 'iso_9001',
  subtitle: 'Andel fullstendig implementert',
  colSpan: 'sm',
}
const KPI_GAP_14001: ReportModuleKpi = {
  id: 'kpi-gap-14001',
  kind: 'kpi',
  datasetKey: 'iso_gap_scores',
  title: 'Gap-score ISO 14001',
  valuePath: 'iso_14001',
  subtitle: 'Andel fullstendig implementert',
  colSpan: 'sm',
}
const KPI_GAP_45001: ReportModuleKpi = {
  id: 'kpi-gap-45001',
  kind: 'kpi',
  datasetKey: 'iso_gap_scores',
  title: 'Gap-score ISO 45001',
  valuePath: 'iso_45001',
  subtitle: 'Andel fullstendig implementert',
  colSpan: 'sm',
}
const KPI_GAP_27001: ReportModuleKpi = {
  id: 'kpi-gap-27001',
  kind: 'kpi',
  datasetKey: 'iso_gap_scores',
  title: 'Gap-score ISO 27001',
  valuePath: 'iso_27001',
  subtitle: 'Andel fullstendig implementert',
  colSpan: 'sm',
}
const KPI_SOA_RATE: ReportModuleKpi = {
  id: 'kpi-soa-rate',
  kind: 'kpi',
  datasetKey: 'iso_soa_implementation',
  title: 'SoA — implementert',
  valuePath: 'implementedCount',
  subtitle: 'Av 93 Annex A-kontroller',
  colSpan: 'sm',
}

// ── Bar chart ─────────────────────────────────────────────────────────────────

const BAR_OPEN_CAPAS: ReportModuleBar = {
  id: 'bar-open-capas',
  kind: 'bar',
  datasetKey: 'iso_open_capas_by_standard',
  title: 'Åpne tiltak per standard',
  seriesKeys: [],
  colSpan: 'md',
}

// ── Donut ─────────────────────────────────────────────────────────────────────

const DONUT_LEGAL_STATUS: ReportModuleDonut = {
  id: 'donut-legal-status',
  kind: 'donut',
  datasetKey: 'iso_legal_compliance',
  title: 'Rettslig samsvar — status',
  segmentsPath: '',
  colSpan: 'md',
}

// ── Tables ───────────────────────────────────────────────────────────────────

const TABLE_AUDIT_SCHEDULE: ReportModuleTable = {
  id: 'table-audit-schedule',
  kind: 'table',
  datasetKey: 'iso_audit_schedule',
  title: 'Kommende revisjoner',
  rowKeys: ['title', 'standard', 'scheduledFor', 'status'],
  colSpan: 'lg',
}
const TABLE_RECENT_FINDINGS: ReportModuleTable = {
  id: 'table-recent-findings',
  kind: 'table',
  datasetKey: 'iso_recent_findings',
  title: 'Siste avvik fra revisjoner',
  rowKeys: ['title', 'standard', 'severity', 'createdAt'],
  colSpan: 'lg',
}

const DEFAULT_LAYOUT: ReportModule[] = [
  KPI_GAP_9001,
  KPI_GAP_14001,
  KPI_GAP_45001,
  KPI_GAP_27001,
  KPI_SOA_RATE,
  BAR_OPEN_CAPAS,
  DONUT_LEGAL_STATUS,
  TABLE_AUDIT_SCHEDULE,
  TABLE_RECENT_FINDINGS,
]

const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  { catalogId: 'kpi-gap-9001',       category: 'Gap-analyse',   label: 'Gap-score ISO 9001',           template: KPI_GAP_9001 },
  { catalogId: 'kpi-gap-14001',      category: 'Gap-analyse',   label: 'Gap-score ISO 14001',          template: KPI_GAP_14001 },
  { catalogId: 'kpi-gap-45001',      category: 'Gap-analyse',   label: 'Gap-score ISO 45001',          template: KPI_GAP_45001 },
  { catalogId: 'kpi-gap-27001',      category: 'Gap-analyse',   label: 'Gap-score ISO 27001',          template: KPI_GAP_27001 },
  { catalogId: 'kpi-soa-rate',       category: 'ISO 27001',     label: 'SoA implementeringsgrad',      template: KPI_SOA_RATE },
  { catalogId: 'bar-open-capas',     category: 'Tiltak',        label: 'Åpne tiltak per standard',     template: BAR_OPEN_CAPAS },
  { catalogId: 'donut-legal-status', category: 'Samsvar',       label: 'Rettslig samsvar — status',    template: DONUT_LEGAL_STATUS },
  { catalogId: 'table-audit-sched',  category: 'Revisjoner',    label: 'Kommende revisjoner',          template: TABLE_AUDIT_SCHEDULE },
  { catalogId: 'table-findings',     category: 'Revisjoner',    label: 'Siste avvik',                  template: TABLE_RECENT_FINDINGS },
]

registerDashboardScope({
  scopeId: ISO_IMS_SCOPE_ID,
  label: 'ISO IMS',
  defaultLayout: DEFAULT_LAYOUT,
  widgetCatalog: WIDGET_CATALOG,
  datasets: DATASETS,
  // Indigo-adjacent — distinct from the individual pack accents so the
  // composite overview reads as "cross-standard layer" rather than
  // belonging to one specific ISO pack.
  accent: '#3730a3',
})
