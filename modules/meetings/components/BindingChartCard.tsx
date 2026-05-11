// BindingChartCard — renders one resolved binding snapshot as a chart card.
//
// Wraps the existing `ReportModuleWidget` runtime — the same widget used
// by every analytics dashboard in NewAMU (compliance, survey, learning,
// documents, …). We hand it a per-binding `ReportModule` instance + the
// corresponding dataset (both produced by `bindingToReportModule()`).

import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { ReportModuleWidget } from '../../../src/components/reports/ReportModuleWidget'
import { bindingToReportModule } from '../lib/bindingToReportModule'
import type { MeetingAgendaItemRow } from '../types'

export type BindingChartCardProps = {
  item: MeetingAgendaItemRow
  /** Cyan accent matches the meetings scope. */
  accent?: string
  /** Optional jump-to-agenda link target. */
  meetingId?: string
}

const MEETINGS_ACCENT = '#0891b2'

export function BindingChartCard({
  item,
  accent = MEETINGS_ACCENT,
  meetingId,
}: BindingChartCardProps) {
  const snapshot = item.binding_snapshot
  if (!snapshot) {
    return (
      <ModuleSectionCard className="p-4">
        <p className="text-xs font-semibold text-neutral-900">{item.title}</p>
        <p className="mt-2 text-xs text-neutral-600">
          Ingen forberedelse-snapshot ennå. Klikk «Oppdater alle data» for å
          generere det første snapshotet.
        </p>
      </ModuleSectionCard>
    )
  }

  const { module: reportModule, datasets } = bindingToReportModule(item.id, snapshot)

  return (
    <div className="space-y-2">
      <ReportModuleWidget
        module={reportModule}
        datasets={datasets}
        accent={accent}
        layoutMode="fluid"
        emptyLabel="Ingen data i perioden"
      />
      <div className="flex items-center justify-between text-[11px] text-neutral-500">
        <span>
          Agenda-punkt: <strong className="text-neutral-700">{item.title}</strong>
        </span>
        {meetingId ? (
          <Link
            to={`/meetings/${meetingId}?tab=agenda#agenda-${item.id}`}
            className="inline-flex items-center gap-0.5 underline hover:text-neutral-800"
          >
            Gå til sak <ArrowRight className="h-3 w-3" />
          </Link>
        ) : null}
      </div>
    </div>
  )
}
