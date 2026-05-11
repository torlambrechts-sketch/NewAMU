// Maps a `RenderedBindingResult` snapshot to a `ReportModule` + dataset
// pair that `ReportModuleWidget` (`src/components/reports/ReportModuleWidget.tsx`)
// can render. Per-source visual kind chosen here:
//
//   sick_leave_stats             → bar (by department)
//   incidents                    → donut (by status)
//   vernerunde_findings          → donut (signed vs pending vs ongoing)
//   open_ros_high                → table (top-5 risks)
//   training_completion          → kpi + bar (kinds)
//   headcount_and_amu_composition → table (role distribution)
//   open_decisions               → table (top-5 open vedtak)
//   survey_results               → kpi + small table
//   compliance_checklist_status  → kpi grid
//   whistleblowing_anonymized    → donut (status distribution)
//   *                            → table fallback
//
// The mapper is pure — pass a snapshot, get a `{ module, dataset }` pair.

import type { ReportModule } from '../../../src/types/reportBuilder'
import type { RenderedBindingResult } from '../types'

export type BindingChartSpec = {
  module: ReportModule
  /** Single-entry dataset map keyed by the module's `datasetKey`. */
  datasets: Record<string, unknown>
}

const titleBySource: Record<string, string> = {
  sick_leave_stats: 'Sykefraværsstatistikk',
  incidents: 'Avvik / hendelser',
  vernerunde_findings: 'Vernerunder',
  open_ros_high: 'ROS — høy restrisiko',
  training_completion: 'Opplæring',
  headcount_and_amu_composition: 'Ansatte og AMU-sammensetning',
  open_decisions: 'Åpne vedtak',
  survey_results: 'Arbeidsmiljøundersøkelse',
  compliance_checklist_status: 'Sjekklister — status',
  whistleblowing_anonymized: 'Varslingssaker (anonymisert)',
  bht_annual_report: 'BHT — årsrapport',
  ik_annual_review_status: 'Internkontroll — årsgjennomgang',
}

function widgetTitle(snapshot: RenderedBindingResult): string {
  return titleBySource[snapshot.source] ?? snapshot.source
}

/**
 * Maps a `RenderedBindingResult` to a self-contained widget spec. The
 * caller passes `module` + `datasets` to a `ReportModuleWidget`
 * (or `ReportModulesGrid` once aggregated).
 *
 * `widgetId` should be unique within the meeting — typically the agenda
 * item id so React keys are stable on re-render.
 */
export function bindingToReportModule(
  widgetId: string,
  snapshot: RenderedBindingResult,
): BindingChartSpec {
  const title = widgetTitle(snapshot)
  const datasetKey = `meetings:binding:${widgetId}`
  const rows = snapshot.dataRows ?? []

  switch (snapshot.source) {
    case 'sick_leave_stats': {
      // dataRows: [{ department, count }]
      const datasetObj: Record<string, number> & { __rows__?: typeof rows } = {}
      for (const r of rows as Array<{ department?: string; count?: number }>) {
        if (r.department) datasetObj[r.department] = r.count ?? 0
      }
      return {
        module: {
          id: widgetId,
          kind: 'bar',
          title,
          subtitle: snapshot.summaryMarkdown.split('\n')[0],
          datasetKey,
          colSpan: 'md',
          seriesKeys: Object.keys(datasetObj),
        },
        datasets: { [datasetKey]: datasetObj },
      }
    }

    case 'incidents':
    case 'whistleblowing_anonymized': {
      // dataRows: [{ status, count }]
      const segments = (rows as Array<{ status?: string; count?: number }>).map((r) => ({
        label: r.status ?? '—',
        value: r.count ?? 0,
      }))
      return {
        module: {
          id: widgetId,
          kind: 'donut',
          title,
          subtitle: snapshot.summaryMarkdown.split('\n')[0],
          datasetKey,
          colSpan: 'md',
          segmentsPath: 'segments',
        },
        datasets: { [datasetKey]: { segments } },
      }
    }

    case 'vernerunde_findings': {
      const segments = (rows as Array<{ status?: string; count?: number }>).map((r) => ({
        label: r.status ?? '—',
        value: r.count ?? 0,
      }))
      return {
        module: {
          id: widgetId,
          kind: 'donut',
          title,
          subtitle: snapshot.summaryMarkdown.split('\n')[0],
          datasetKey,
          colSpan: 'md',
          segmentsPath: 'segments',
        },
        datasets: { [datasetKey]: { segments } },
      }
    }

    case 'open_ros_high': {
      return {
        module: {
          id: widgetId,
          kind: 'table',
          title,
          subtitle: snapshot.summaryMarkdown.split('\n')[0],
          datasetKey,
          colSpan: 'full',
          rowKeys: ['assessment', 'riskScore', 'hazard'],
        },
        datasets: { [datasetKey]: rows },
      }
    }

    case 'training_completion': {
      const total = (rows as Array<{ count?: number }>).reduce(
        (s, r) => s + (r.count ?? 0),
        0,
      )
      return {
        module: {
          id: widgetId,
          kind: 'kpi',
          title,
          subtitle: snapshot.summaryMarkdown.split('\n')[0],
          datasetKey,
          colSpan: 'sm',
          valuePath: 'total',
        },
        datasets: { [datasetKey]: { total, byKind: rows } },
      }
    }

    case 'headcount_and_amu_composition': {
      return {
        module: {
          id: widgetId,
          kind: 'table',
          title,
          subtitle: snapshot.summaryMarkdown.split('\n')[0],
          datasetKey,
          colSpan: 'md',
          rowKeys: ['kategori', 'antall'],
        },
        datasets: { [datasetKey]: rows },
      }
    }

    case 'open_decisions': {
      return {
        module: {
          id: widgetId,
          kind: 'table',
          title,
          subtitle: snapshot.summaryMarkdown.split('\n')[0],
          datasetKey,
          colSpan: 'full',
          rowKeys: ['decisionText', 'decisionAt'],
        },
        datasets: { [datasetKey]: rows },
      }
    }

    case 'survey_results': {
      const total = (rows as Array<{ responses?: number }>).reduce(
        (s, r) => s + (r.responses ?? 0),
        0,
      )
      return {
        module: {
          id: widgetId,
          kind: 'kpi',
          title,
          subtitle: snapshot.summaryMarkdown.split('\n')[0],
          datasetKey,
          colSpan: 'sm',
          valuePath: 'total',
        },
        datasets: { [datasetKey]: { total, surveys: rows } },
      }
    }

    case 'compliance_checklist_status': {
      // dataRows: [{ kategori, antall }]
      return {
        module: {
          id: widgetId,
          kind: 'table',
          title,
          subtitle: snapshot.summaryMarkdown.split('\n')[0],
          datasetKey,
          colSpan: 'md',
          rowKeys: ['kategori', 'antall'],
        },
        datasets: { [datasetKey]: rows },
      }
    }

    default:
      return {
        module: {
          id: widgetId,
          kind: 'table',
          title,
          subtitle: snapshot.summaryMarkdown.split('\n')[0],
          datasetKey,
          colSpan: 'full',
          rowKeys: rows.length > 0 ? Object.keys(rows[0]) : [],
        },
        datasets: { [datasetKey]: rows },
      }
  }
}
