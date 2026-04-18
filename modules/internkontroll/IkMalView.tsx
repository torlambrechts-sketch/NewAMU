import { useState } from 'react'
import type { IkHseGoalMeasurementRow, IkHseGoalRow } from './types'

type Props = {
  goals: IkHseGoalRow[]
  measurements: IkHseGoalMeasurementRow[]
  canManage: boolean
  onUpsertGoal: (goal: Partial<IkHseGoalRow>) => void
  onAddMeasurement: (goalId: string) => void
}

const STATUS_COLOR: Record<IkHseGoalRow['status'], { bg: string; text: string; label: string }> = {
  active:    { bg: 'bg-blue-50',    text: 'text-blue-700',   label: 'Aktiv' },
  achieved:  { bg: 'bg-green-50',   text: 'text-green-700',  label: 'Nådd' },
  missed:    { bg: 'bg-red-50',     text: 'text-red-700',    label: 'Ikke nådd' },
  cancelled: { bg: 'bg-neutral-100',text: 'text-neutral-500',label: 'Avlyst' },
}

export function IkMalView({ goals, measurements, canManage, onUpsertGoal, onAddMeasurement }: Props) {
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear())
  const measurementsByGoal = new Map<string, IkHseGoalMeasurementRow[]>()
  for (const m of measurements) {
    if (!measurementsByGoal.has(m.goal_id)) measurementsByGoal.set(m.goal_id, [])
    measurementsByGoal.get(m.goal_id)!.push(m)
  }
  const years = [...new Set(goals.map((g) => g.year))].sort((a, b) => b - a)
  const filtered = goals.filter((g) => g.year === yearFilter)
  const lagging = filtered.filter((g) => g.goal_type === 'lagging')
  const leading = filtered.filter((g) => g.goal_type === 'leading')

  function latestValue(goalId: string): number | null {
    const ms = measurementsByGoal.get(goalId) ?? []
    if (ms.length === 0) return null
    const sorted = [...ms].sort((a, b) => b.measured_at.localeCompare(a.measured_at))
    return sorted[0].value
  }

  function GoalCard({ goal }: { goal: IkHseGoalRow }) {
    const sc = STATUS_COLOR[goal.status]
    const current = latestValue(goal.id)
    const pct = goal.target_value != null && current != null
      ? Math.min(100, Math.round((current / goal.target_value) * 100))
      : null
    return (
      <div className="rounded-xl border border-neutral-200/80 bg-white p-4 space-y-3 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-neutral-900">{goal.title}</p>
            {goal.description && <p className="text-xs text-neutral-500 mt-0.5">{goal.description}</p>}
          </div>
          <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${sc.bg} ${sc.text}`}>
            {sc.label}
          </span>
        </div>
        {goal.target_value != null && (
          <div>
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
              <span>Fremgang</span>
              <span>
                {current ?? '–'} / {goal.target_value} {goal.target_unit ?? ''}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-[#1a3d32] transition-all"
                style={{ width: `${pct ?? 0}%` }}
              />
            </div>
          </div>
        )}
        {canManage && (
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => onAddMeasurement(goal.id)} className="text-xs text-[#1a3d32] hover:underline">
              + Registrer måling
            </button>
            <button type="button" onClick={() => onUpsertGoal(goal)} className="text-xs text-neutral-500 hover:underline">
              Rediger
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Info box */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
        <strong>Lagging-indikatorer</strong> måler resultater (H1-frekvens, sykefravær). <strong>Leading-indikatorer</strong> måler forebyggende aktivitet (vernerunder, opplæringer). Bruk begge for balansert HMS-styring (AML § 3-1).
      </div>

      {/* Year + add */}
      <div className="flex flex-wrap items-center gap-2">
        {years.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => setYearFilter(y)}
            className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${
              yearFilter === y ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            {y}
          </button>
        ))}
        {canManage && (
          <button
            type="button"
            onClick={() => onUpsertGoal({})}
            className="ml-auto rounded-lg border border-[#1a3d32] bg-[#1a3d32] px-3 py-1 text-xs font-semibold text-white hover:bg-[#14312a]"
          >
            + Nytt mål
          </button>
        )}
      </div>

      {/* Lagging */}
      {lagging.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-neutral-500">Lagging-indikatorer</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lagging.map((g) => <GoalCard key={g.id} goal={g} />)}
          </div>
        </div>
      )}

      {/* Leading */}
      {leading.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-neutral-500">Leading-indikatorer</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {leading.map((g) => <GoalCard key={g.id} goal={g} />)}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <p className="py-10 text-center text-sm text-neutral-400">Ingen HMS-mål for {yearFilter}.</p>
      )}
    </div>
  )
}
