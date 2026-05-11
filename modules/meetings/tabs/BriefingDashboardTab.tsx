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
import { BarChart3, CalendarRange } from 'lucide-react'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { ModulePageEmpty } from '../../../src/components/module/ModulePageShell'
import { Badge } from '../../../src/components/ui/Badge'
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
    <div className="space-y-5">
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#0891b2]" />
              <h2 className="text-lg font-semibold text-neutral-900">Dashboard</h2>
            </div>
            <p className="mt-1.5 text-sm text-neutral-600">
              Widgets definert i malen, scoped til møtets rapporteringsperiode.
              Endre periode fra Datapakke-fanen.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="info">
                <CalendarRange className="mr-1 inline h-3 w-3" />
                {fmtPeriod(meeting)}
              </Badge>
              <span className="text-xs text-neutral-500">
                {layout.length} widget{layout.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </div>
      </ModuleSectionCard>

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
