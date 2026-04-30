import { useMemo } from 'react'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { VERNEOMBUD_REQUIRED_MINUTES, verneombudComplianceTone } from './learningVerneombud'

function cellColor(status: string) {
  if (status === 'complete') return 'bg-emerald-500'
  if (status === 'in_progress') return 'bg-amber-400'
  return 'bg-red-500'
}

export function LearningComplianceMatrix() {
  const { can } = useOrgSetupContext()
  const canManage = can('learning.manage')
  const { complianceMatrix, learningLoading, learningError, safetyRepComplianceRows } = useLearning()

  const verneombudKpi = useMemo(() => {
    const rows = safetyRepComplianceRows
    if (rows.length === 0) return null
    const sum = rows.reduce((a, r) => a + r.minutesCompleted, 0)
    const avg = Math.round(sum / rows.length)
    return { avg, count: rows.length }
  }, [safetyRepComplianceRows])

  const { users, courses, grid } = useMemo(() => {
    const uids = [...new Set(complianceMatrix.map((c) => c.userId))]
    const userNames = new Map(complianceMatrix.map((c) => [c.userId, c.displayName]))
    const cids = [...new Set(complianceMatrix.map((c) => c.courseId))]
    const courseTitles = new Map(complianceMatrix.map((c) => [c.courseId, c.courseTitle]))
    const g = new Map<string, (typeof complianceMatrix)[0]>()
    for (const cell of complianceMatrix) {
      g.set(`${cell.userId}:${cell.courseId}`, cell)
    }
    return {
      users: uids.map((id) => ({ id, name: userNames.get(id) ?? id })),
      courses: cids.map((id) => ({ id, title: courseTitles.get(id) ?? id })),
      grid: g,
    }
  }, [complianceMatrix])

  if (!canManage) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-6 text-sm text-neutral-800">
        Team-heatmap er kun tilgjengelig for kursansvarlige med rettigheten «E-learning — opprette og redigere kurs».
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-[#2D403A]">Team-heatmap</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Publiserte kurs × medarbeidere. Grønn = fullført, gul = påbegynt, rød = ikke startet.
        </p>
      </div>
      {learningError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{learningError}</p>
      ) : null}
      {learningLoading ? <p className="text-sm text-neutral-500">Laster…</p> : null}

      {verneombudKpi ? (
        <div
          className={`rounded-xl border p-5 shadow-sm ${
            verneombudComplianceTone(verneombudKpi.avg) === 'green'
              ? 'border-emerald-300 bg-emerald-50/90'
              : verneombudComplianceTone(verneombudKpi.avg) === 'amber'
                ? 'border-amber-300 bg-amber-50/90'
                : 'border-red-300 bg-red-50/90'
          }`}
        >
          <h2 className="font-serif text-lg font-semibold text-[#2D403A]">Verneombud 40 t — AML § 6-5</h2>
          <p className="mt-2 text-sm text-neutral-700">
            Snitt akkumulerte minutter (fullførte moduler i kurs med tag <code className="rounded bg-white/80 px-1">verneombud</code>)
            blant {verneombudKpi.count} verneombud:
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#2D403A]">
            {verneombudKpi.avg} min / {VERNEOMBUD_REQUIRED_MINUTES} min (40 t)
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            Rød &lt; 1200 min, amber 1200–2399, grønn ≥ 2400 (per snitt).
          </p>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50/80">
              <th className="sticky left-0 z-10 bg-neutral-50 px-3 py-2 font-medium text-neutral-700">Person</th>
              {courses.map((c) => (
                <th key={c.id} className="max-w-[10rem] px-2 py-2 font-medium text-neutral-600" title={c.title}>
                  <span className="line-clamp-3">{c.title}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-neutral-50">
                <td className="sticky left-0 z-10 bg-white px-3 py-2 text-sm font-medium text-[#2D403A]">{u.name}</td>
                {courses.map((c) => {
                  const cell = grid.get(`${u.id}:${c.id}`)
                  const st = cell?.cellStatus ?? 'not_started'
                  return (
                    <td key={c.id} className="px-2 py-2 text-center">
                      <span
                        className={`inline-block size-4 rounded-sm ${cellColor(st)}`}
                        title={`${Math.round((cell?.completionPct ?? 0) * 100)}% · ${st}`}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && !learningLoading ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-500">Ingen data ennå.</p>
        ) : null}
      </div>
    </div>
  )
}
