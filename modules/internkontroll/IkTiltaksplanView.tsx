import { useState } from 'react'
import type { IkActionPlanRow, IkActionPlanSource } from './types'

const PRIORITY_COLOR: Record<IkActionPlanRow['priority'], { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-red-100',    text: 'text-red-800',    label: 'Kritisk' },
  high:     { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Høy' },
  medium:   { bg: 'bg-amber-50',   text: 'text-amber-800',  label: 'Middels' },
  low:      { bg: 'bg-neutral-100',text: 'text-neutral-600',label: 'Lav' },
}

const SOURCE_ICON: Record<IkActionPlanSource, string> = {
  manual:        '✏️',
  ros:           '🔴',
  avvik:         '⚠️',
  inspection:    '🔍',
  annual_review: '📋',
}

type Props = {
  plans: IkActionPlanRow[]
  canManage: boolean
  onUpsert: (plan: Partial<IkActionPlanRow>) => void
  onUpdateStatus: (id: string, status: IkActionPlanRow['status']) => void
}

export function IkTiltaksplanView({ plans, canManage, onUpsert, onUpdateStatus }: Props) {
  const [statusFilter, setStatusFilter] = useState<IkActionPlanRow['status'] | 'all'>('open')
  const today = new Date()

  const filtered = statusFilter === 'all' ? plans : plans.filter((p) => p.status === statusFilter)
  const overdue = plans.filter(
    (p) => ['open', 'in_progress'].includes(p.status) && p.due_date && new Date(p.due_date) < today,
  ).length

  return (
    <div className="space-y-4">
      {/* Overdue banner */}
      {overdue > 0 && (
        <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 px-4 py-2.5">
          <span className="text-red-600">⚠</span>
          <p className="text-sm font-semibold text-red-800">{overdue} tiltak er forfalt</p>
        </div>
      )}

      {/* Filters + add */}
      <div className="flex flex-wrap items-center gap-2">
        {(['open', 'in_progress', 'completed', 'all'] as const).map((s) => {
          const labels = { open: 'Åpne', in_progress: 'Pågår', completed: 'Fullført', all: 'Alle' }
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded border px-3 py-1 text-xs font-semibold transition-colors ${
                statusFilter === s
                  ? 'bg-neutral-900 text-white border-neutral-900'
                  : 'border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {labels[s]}
            </button>
          )
        })}
        {canManage && (
          <button
            type="button"
            onClick={() => onUpsert({})}
            className="ml-auto rounded border border-[#1a3d32] bg-[#1a3d32] px-3 py-1 text-xs font-semibold text-white hover:bg-[#14312a]"
          >
            + Nytt tiltak
          </button>
        )}
      </div>

      {/* Plans list */}
      <div className="overflow-hidden rounded border border-neutral-200">
        {filtered.map((plan, i) => {
          const pc = PRIORITY_COLOR[plan.priority]
          const isOverdue = ['open', 'in_progress'].includes(plan.status) && plan.due_date && new Date(plan.due_date) < today
          return (
            <div key={plan.id} className={`border-b border-neutral-100 px-4 py-3 last:border-b-0 ${i % 2 === 0 ? 'bg-white' : 'bg-neutral-50/40'}`}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-base" title={plan.source}>{SOURCE_ICON[plan.source]}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-neutral-900">{plan.title}</p>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${pc.bg} ${pc.text}`}>
                      {pc.label}
                    </span>
                    {isOverdue && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">FORFALT</span>
                    )}
                    {plan.law_pillar && (
                      <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">{plan.law_pillar}</span>
                    )}
                  </div>
                  {plan.description && (
                    <p className="mt-0.5 text-xs text-neutral-500 line-clamp-1">{plan.description}</p>
                  )}
                  <p className="mt-1 text-xs text-neutral-400">
                    {plan.assigned_name ? `Ansvarlig: ${plan.assigned_name}` : 'Ikke tildelt'}
                    {plan.due_date && ` · Frist: ${new Date(plan.due_date).toLocaleDateString('nb-NO')}`}
                  </p>
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-2">
                    {plan.status === 'open' && (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(plan.id, 'in_progress')}
                        className="text-xs text-[#1a3d32] hover:underline"
                      >
                        Start
                      </button>
                    )}
                    {plan.status === 'in_progress' && (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(plan.id, 'completed')}
                        className="text-xs text-green-700 hover:underline"
                      >
                        Lukk
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onUpsert(plan)}
                      className="text-xs text-neutral-500 hover:underline"
                    >
                      Rediger
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-neutral-400">Ingen tiltak.</p>
        )}
      </div>
    </div>
  )
}
