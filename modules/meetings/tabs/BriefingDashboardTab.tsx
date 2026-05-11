// BriefingDashboardTab — renders a template-declared dashboard.
//
// Triggered when the meeting's `definition_snapshot.dashboard` block is
// set (today: the consolidated AMU template). The tab calls
// `useMeetingBriefingDatasets` for live data, looks up the widget
// layout on the snapshot, and hands both to `ReportModulesGrid` so
// the widgets render with the dashboard engine.
//
// Period rules mirror DatapakkeTab: whatever sits on
// `meeting.reporting_period_*` overrides the relative window. The
// period chip is read-only here; chairs change it from the Datapakke tab.

import { useMemo } from 'react'
import { CalendarRange } from 'lucide-react'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { ModulePageEmpty } from '../../../src/components/module/ModulePageShell'
import { ReportModulesGrid } from '../../../src/components/reports/ReportModuleWidget'
import { useMeetingBriefingDatasets } from '../dashboards/useMeetingBriefingDatasets'
import type {
  MeetingAgendaItemRow,
  MeetingRow,
  MeetingTemplateDashboard,
} from '../types'
import type { ReportModule } from '../../../src/types/reportBuilder'

const MEETINGS_ACCENT = '#0891b2'

export type BriefingDashboardTabProps = {
  meeting: MeetingRow
  agendaItems: MeetingAgendaItemRow[]
}

function fmtPeriod(meeting: MeetingRow): string {
  if (meeting.reporting_period_label) return meeting.reporting_period_label
  const s = meeting.reporting_period_start
  const e = meeting.reporting_period_end
  if (s && e) return `${s} – ${e}`
  return 'Ingen periode satt — relative vinduer fra malen brukes'
}

export function BriefingDashboardTab({
  meeting,
  agendaItems,
}: BriefingDashboardTabProps) {
  const dashboard = meeting.definition_snapshot?.dashboard as
    | MeetingTemplateDashboard
    | undefined
  const { datasets } = useMeetingBriefingDatasets(meeting, agendaItems)

  const layout = useMemo<ReportModule[]>(() => {
    const raw = dashboard?.layout ?? []
    return raw as unknown as ReportModule[]
  }, [dashboard])

  if (!dashboard || layout.length === 0) {
    return (
      <ModuleSectionCard className="p-5 md:p-6">
        <ModulePageEmpty
          title="Ingen dashboard på denne malen"
          description="Denne maltypen har ikke et dashboard. Mal-redaktøren kan legge til widgets under «Dashboard» i mal-innstillingene."
        />
      </ModuleSectionCard>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 border-l-4 border-[#0891b2] pl-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-800">
            Dashboard
          </h3>
          <p className="mt-0.5 text-xs text-neutral-600">
            Widgets definert i malen, scoped til møtets rapporteringsperiode. Endre periode fra Datapakke-fanen.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600">
        <CalendarRange className="h-4 w-4 text-neutral-400" />
        <span className="font-medium text-neutral-700">Periode:</span>
        <span>{fmtPeriod(meeting)}</span>
        <span className="ml-auto text-neutral-400">
          {layout.length} widget{layout.length === 1 ? '' : 's'}
        </span>
      </div>

      <ReportModulesGrid
        modules={layout}
        datasets={datasets}
        accent={MEETINGS_ACCENT}
        layoutMode="grid12"
        emptyLabel="Ingen data i perioden"
      />
    </div>
  )
}
