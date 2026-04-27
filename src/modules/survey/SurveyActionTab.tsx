import { useState } from 'react'
import { CheckSquare } from 'lucide-react'
import type { SurveyModuleState } from './useSurveyLegacy'
import type { SurveyCampaignRow, SurveyActionPlanRow, SurveyActionStatus } from '../../data/survey'
import { ACTION_STATUS_LABEL, ACTION_STATUS_COLOR, PILLAR_LABEL, scoreColor } from '../../data/survey'

type Props = { survey: SurveyModuleState; campaign: SurveyCampaignRow }

export function SurveyActionTab({ survey, campaign }: Props) {
  const open = survey.actionPlans.filter((p) => p.status !== 'closed')
  const closed = survey.actionPlans.filter((p) => p.status === 'closed')

  if (survey.actionPlans.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <CheckSquare className="h-10 w-10 text-neutral-300" />
        <p className="text-sm font-medium text-neutral-500">Ingen handlingsplaner ennå</p>
        <p className="text-xs text-neutral-400">
          Handlingsplaner opprettes automatisk når resultater beregnes og score er under {campaign.action_threshold}.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#1a3d32]/20 bg-[#f4f1ea] px-4 py-3 text-sm text-[#1a3d32]">
        <strong>AML § 3-1 / IK-forskriften § 5:</strong> Tiltak skal iverksettes ved avvik. Handlingsplaner her er
        automatisk opprettet der score er under {campaign.action_threshold}/100. Alle tiltak skal presenteres for AMU og
        vernombud.
      </div>

      {open.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-4 py-2.5">
            <h3 className="text-sm font-semibold text-[#1a3d32]">Åpne tiltak</h3>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">{open.length}</span>
          </div>
          <div className="divide-y divide-neutral-100">
            {open.map((p) => (
              <ActionPlanRow key={p.id} plan={p} onUpdate={survey.updateActionPlan} />
            ))}
          </div>
        </div>
      )}

      {closed.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-2.5">
            <h3 className="text-sm font-semibold text-neutral-500">Lukkede tiltak ({closed.length})</h3>
          </div>
          <div className="divide-y divide-neutral-100">
            {closed.map((p) => (
              <ActionPlanRow key={p.id} plan={p} onUpdate={survey.updateActionPlan} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ActionPlanRow({
  plan: p,
  onUpdate,
}: {
  plan: SurveyActionPlanRow
  onUpdate: (id: string, patch: Partial<SurveyActionPlanRow>) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`border-l-4 ${p.status === 'closed' ? 'border-l-emerald-400' : p.status === 'in_progress' ? 'border-l-amber-400' : 'border-l-red-400'}`}
    >
      <button
        type="button"
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-800">{p.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
            <span>{PILLAR_LABEL[p.pillar]}</span>
            <span>·</span>
            <span>{p.category}</span>
            {p.score !== null && <span className={`font-semibold ${scoreColor(p.score)}`}>Score: {p.score}</span>}
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ACTION_STATUS_COLOR[p.status]}`}
        >
          {ACTION_STATUS_LABEL[p.status]}
        </span>
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-neutral-100 bg-neutral-50/50 px-4 py-3">
          {p.description && <p className="text-sm text-neutral-600">{p.description}</p>}
          <div className="flex flex-wrap gap-2">
            {(['open', 'in_progress', 'closed'] as SurveyActionStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void onUpdate(p.id, { status: s })}
                disabled={p.status === s}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${p.status === s ? ACTION_STATUS_COLOR[s] : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100'}`}
              >
                {ACTION_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
