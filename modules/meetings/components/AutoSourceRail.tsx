// Renders the resolved data bindings (already computed by
// useMeetingDataBindings) as a clickable side-rail in the agenda builder.
// Each card surfaces a one-line summary + a "+ legg til" affordance that
// asks the parent to create a new agenda item seeded with the binding.

import type { ReactNode } from 'react'
import { Plus, Activity, AlertTriangle, ClipboardCheck, ListChecks, ShieldAlert, BookOpen } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { Button } from '../../../src/components/ui/Button'
import type { RenderedBindingResult } from '../types'

const SOURCE_ICON: Record<string, LucideIcon> = {
  sick_leave_stats: Activity,
  incidents: AlertTriangle,
  vernerunde_findings: ClipboardCheck,
  open_ros_high: ShieldAlert,
  training_completion: BookOpen,
  headcount_and_amu_composition: ListChecks,
  whistleblowing_anonymized: ShieldAlert,
  open_decisions: ListChecks,
  compliance_checklist_status: ListChecks,
  survey_results: BookOpen,
}

const SOURCE_LABEL: Record<string, string> = {
  sick_leave_stats: 'Sykefravær',
  incidents: 'Avvik',
  vernerunde_findings: 'Vernerunde-funn',
  open_ros_high: 'Åpne ROS — høy risiko',
  training_completion: 'Opplæringsstatus',
  headcount_and_amu_composition: 'Bemanning + AMU-sammensetning',
  whistleblowing_anonymized: 'Varsling (anonymisert)',
  open_decisions: 'Åpne vedtak',
  compliance_checklist_status: 'Sjekkliste-status',
  survey_results: 'Undersøkelse-resultater',
  bht_annual_report: 'BHT-årsrapport',
  ik_annual_review_status: 'IK årlig gjennomgang',
}

export function AutoSourceRail({
  bindings,
  loading,
  onAddItem,
  emptyHint,
}: {
  bindings: Record<string, RenderedBindingResult | null>
  loading: boolean
  onAddItem: (sourceKey: string, summaryMarkdown: string) => Promise<void> | void
  emptyHint?: ReactNode
}) {
  const sources = Object.entries(bindings)
    .filter(([, b]) => b && !b.error)
    .sort(([a], [b]) => (SOURCE_LABEL[a] ?? a).localeCompare(SOURCE_LABEL[b] ?? b, 'nb'))

  if (loading && sources.length === 0) {
    return (
      <ModuleSectionCard className="p-4">
        <p className="text-xs text-neutral-500">Laster auto-kilder …</p>
      </ModuleSectionCard>
    )
  }
  if (sources.length === 0) {
    return (
      <ModuleSectionCard className="p-4">
        <h3 className="text-sm font-semibold text-neutral-900">Auto-kilder</h3>
        <p className="mt-1.5 text-[11px] text-neutral-500">
          {emptyHint ?? 'Ingen aktuelle data å hente nå. Last meeting med en mal som har dataBindings.'}
        </p>
      </ModuleSectionCard>
    )
  }

  return (
    <ModuleSectionCard className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900">Auto-kilder</h3>
        <span className="text-[10px] text-neutral-400">Legg til som sak</span>
      </div>
      <ul className="space-y-2">
        {sources.map(([key, binding]) => {
          const Icon = SOURCE_ICON[key] ?? ListChecks
          const label = SOURCE_LABEL[key] ?? key
          const summary = binding?.summaryMarkdown?.split('\n')[0] ?? '—'
          return (
            <li
              key={key}
              className="flex items-start gap-2.5 rounded-lg border border-neutral-200 bg-white p-2.5 transition-colors hover:border-cyan-500/40"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-neutral-900">{label}</p>
                <p className="line-clamp-2 text-[11px] text-neutral-600">{summary}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void onAddItem(key, binding?.summaryMarkdown ?? '')}
                aria-label={`Legg til ${label} som agenda-sak`}
                className="text-neutral-400 hover:bg-neutral-100 hover:text-cyan-700"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </li>
          )
        })}
      </ul>
    </ModuleSectionCard>
  )
}
