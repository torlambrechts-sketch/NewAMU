// DatapakkeTab — pre-meeting graphical data view.
//
// Sits between Informasjon and Agenda tabs in the meeting detail view.
// Renders ONE chart card per agenda item with a binding — pulled fresh
// from cached snapshots OR re-resolved on demand via "Oppdater alle data".
//
// Inspired by Sherpany Meeting Spaces: the chair sees the full picture
// (sykefravær / avvik / ROS / opplæring / vedtak …) before walking into
// the meeting. Period selector at top lets them re-shoot the bindings
// against a different window (auto-locked at protocol_signed_at).

import { useMemo, useState } from 'react'
import { BarChart3, CalendarRange, RefreshCw } from 'lucide-react'
import { ModulePageEmpty } from '../../../src/components/module/ModulePageShell'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { InfoBox } from '../../../src/components/ui/AlertBox'
import { SlidePanel } from '../../../src/components/layout/SlidePanel'
import {
  ReportingPeriodPicker,
  type PeriodValue,
} from '../components/ReportingPeriodPicker'
import type {
  MeetingAgendaItemRow,
  MeetingDataBinding,
  MeetingRow,
  MeetingTemplateAgendaItem,
  RenderedBindingResult,
} from '../types'
import { SIGNAL_LABEL } from '../lib/frameworkSignals'
import { bindingToReportModule } from '../lib/bindingToReportModule'
import { ReportModulesGrid } from '../../../src/components/reports/ReportModuleWidget'
import type { ReportModule } from '../../../src/types/reportBuilder'

const MEETINGS_ACCENT = '#0891b2'

export type DatapakkeTabProps = {
  meeting: MeetingRow
  agendaItems: MeetingAgendaItemRow[]
  /** Live-resolved bindings from useMeetingDataBindings — used when refreshing. */
  liveBindings: Map<string, RenderedBindingResult>
  /** Framework-relevant signals NOT mapped to any agenda item. */
  extraSignals: Map<MeetingDataBinding['source'], RenderedBindingResult>
  locked: boolean
  onChangePeriod: (period: PeriodValue) => Promise<void>
  onRefreshAll: () => Promise<void>
}

function fmtPeriod(meeting: MeetingRow): string {
  if (meeting.reporting_period_label) return meeting.reporting_period_label
  const s = meeting.reporting_period_start
  const e = meeting.reporting_period_end
  if (s && e) return `${s} – ${e}`
  return 'Ingen periode satt (bruker relative vinduer fra malen)'
}

export function DatapakkeTab({
  meeting,
  agendaItems,
  liveBindings,
  extraSignals,
  locked,
  onChangePeriod,
  onRefreshAll,
}: DatapakkeTabProps) {
  const [periodOpen, setPeriodOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [periodDraft, setPeriodDraft] = useState<PeriodValue>({
    start: meeting.reporting_period_start ?? null,
    end: meeting.reporting_period_end ?? null,
    label: meeting.reporting_period_label ?? null,
  })

  // Agenda items that have a binding declared on the template.
  const bindingItems = useMemo(() => {
    const snap = meeting.definition_snapshot
    if (!snap?.agendaItems?.length) return [] as MeetingAgendaItemRow[]
    const tplWithBinding = new Set<string>()
    for (const tpl of snap.agendaItems as MeetingTemplateAgendaItem[]) {
      if (tpl.dataBinding) tplWithBinding.add(tpl.key)
    }
    return agendaItems.filter(
      (item) => item.template_item_key && tplWithBinding.has(item.template_item_key),
    )
  }, [meeting, agendaItems])

  const extraSignalsArr: Array<[MeetingDataBinding['source'], RenderedBindingResult]> =
    useMemo(() => Array.from(extraSignals.entries()), [extraSignals])

  // Hydrate items with live bindings when available (for items where the
  // chair just changed the period — the live hook resolves before the
  // snapshot column updates).
  const itemsForRender = useMemo(
    () =>
      bindingItems.map((item) => {
        const live = liveBindings.get(item.id)
        if (live && !item.binding_snapshot) {
          return { ...item, binding_snapshot: live }
        }
        return item
      }),
    [bindingItems, liveBindings],
  )

  // Build a single `ReportModule[]` + dataset map for the agenda-bound
  // widgets so they render through the same grid12 layout as the Analyse
  // page. Agenda-item title travels as the widget subtitle. Every binding
  // widget is normalised to colSpan='md' so the grid pairs uniformly
  // (the per-binding `colSpan` from `bindingToReportModule` defaults vary
  // and leave awkward whitespace when a `full` table sits next to nothing).
  const { agendaModules, agendaDatasets } = useMemo(() => {
    const modules: ReportModule[] = []
    const datasets: Record<string, unknown> = {}
    for (const item of itemsForRender) {
      if (!item.binding_snapshot) continue
      const spec = bindingToReportModule(item.id, item.binding_snapshot)
      modules.push({
        ...spec.module,
        colSpan: 'md',
        subtitle: `Agenda-punkt: ${item.title}`,
      })
      Object.assign(datasets, spec.datasets)
    }
    return { agendaModules: modules, agendaDatasets: datasets }
  }, [itemsForRender])

  const { extraModules, extraDatasets } = useMemo(() => {
    const modules: ReportModule[] = []
    const datasets: Record<string, unknown> = {}
    for (const [source, snap] of extraSignalsArr) {
      const spec = bindingToReportModule(`extra-${source}`, snap)
      modules.push({
        ...spec.module,
        colSpan: 'md',
        subtitle: `Datakilde: ${SIGNAL_LABEL[source]?.title ?? source}`,
      })
      Object.assign(datasets, spec.datasets)
    }
    return { extraModules: modules, extraDatasets: datasets }
  }, [extraSignalsArr])

  if (bindingItems.length === 0 && extraSignalsArr.length === 0) {
    return (
      <ModuleSectionCard className="p-5 md:p-6">
        <ModulePageEmpty
          title="Ingen datapakke for denne malen"
          description="Denne maltypen henter ikke aggregert data fra moduler. Bruk Agenda-fanen direkte."
        />
      </ModuleSectionCard>
    )
  }

  async function handleSavePeriod() {
    await onChangePeriod(periodDraft)
    setPeriodOpen(false)
  }

  async function handleRefreshAll() {
    setRefreshing(true)
    try {
      await onRefreshAll()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="space-y-5">
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#0891b2]" />
              <h2 className="text-lg font-semibold text-neutral-900">Datapakke</h2>
            </div>
            <p className="mt-1.5 text-sm text-neutral-600">
              Auto-pulled fra modulene basert på rapporteringsperioden. Sett periode
              eksplisitt for å låse vinduet (f.eks. AMU Q1 2026 ser på Q4 2025).
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="info">
                <CalendarRange className="mr-1 inline h-3 w-3" />
                {fmtPeriod(meeting)}
              </Badge>
              <span className="text-xs text-neutral-500">
                {bindingItems.length} datakilder · {' '}
                {bindingItems.filter((i) => i.binding_snapshot).length} med snapshot
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!locked ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  icon={<CalendarRange className="h-4 w-4" />}
                  onClick={() => setPeriodOpen(true)}
                >
                  Endre periode
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  icon={<RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />}
                  onClick={() => void handleRefreshAll()}
                  disabled={refreshing}
                >
                  Oppdater alle data
                </Button>
              </>
            ) : (
              <Badge variant="signed">Signert — låst</Badge>
            )}
          </div>
        </div>

        {bindingItems.some((i) => !i.binding_snapshot) ? (
          <div className="mt-3">
            <InfoBox>
              Noen datakilder har ikke snapshot ennå. Trykk «Oppdater alle data» for å
              generere et fastlåst utgangspunkt for møtet.
            </InfoBox>
          </div>
        ) : null}
      </ModuleSectionCard>

      {agendaModules.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-3 border-l-4 border-[#0891b2] pl-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-800">
              Fra agendaen
            </h3>
            <span className="text-xs text-neutral-500">
              {agendaModules.length} datakilde{agendaModules.length === 1 ? '' : 'r'} knyttet til sakene
            </span>
          </div>
          <ReportModulesGrid
            modules={agendaModules}
            datasets={agendaDatasets}
            accent={MEETINGS_ACCENT}
            layoutMode="grid12"
            emptyLabel="Ingen data i perioden"
          />
        </section>
      ) : null}

      {extraModules.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-3 border-l-4 border-neutral-300 pl-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-800">
              Andre signaler fra systemet
            </h3>
            <span className="text-xs text-neutral-500">
              {extraModules.length} kilde{extraModules.length === 1 ? '' : 'r'} ikke på agendaen
            </span>
          </div>
          <p className="text-xs text-neutral-600">
            Disse datakildene er relevante for {meeting.definition_snapshot?.framework ?? 'denne'}-møter
            men er ikke knyttet til en agenda-sak. Bruk «Foreslåtte saker» på Agenda-fanen for å legge dem til.
          </p>
          <ReportModulesGrid
            modules={extraModules}
            datasets={extraDatasets}
            accent={MEETINGS_ACCENT}
            layoutMode="grid12"
            emptyLabel="Ingen data i perioden"
          />
        </section>
      ) : null}

      <SlidePanel
        open={periodOpen}
        onClose={() => setPeriodOpen(false)}
        titleId="meetings-period-picker-title"
        title="Endre rapporteringsperiode"
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setPeriodOpen(false)}>
              Avbryt
            </Button>
            <Button variant="primary" onClick={() => void handleSavePeriod()}>
              Lagre + oppdater data
            </Button>
          </div>
        }
      >
        <ReportingPeriodPicker
          value={periodDraft}
          onChange={setPeriodDraft}
          anchor={meeting.scheduled_at}
          hint="Bindinger som filtrerer på dato bruker disse bounds. Periode kan ikke endres etter signering."
        />
      </SlidePanel>
    </div>
  )
}
