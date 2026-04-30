import { useMemo } from 'react'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { PIN_GREEN } from '../../components/learning/LearningLayout'

function cellColor(status: string) {
  if (status === 'complete') return 'bg-emerald-500'
  if (status === 'in_progress') return 'bg-amber-400'
  return 'bg-red-500'
}

export function LearningComplianceMatrix() {
  const { can } = useOrgSetupContext()
  const canManage = can('learning.manage')
  const { complianceMatrix, learningLoading, learningError } = useLearning()

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
        <h1 className="font-serif text-3xl font-semibold" style={{ color: PIN_GREEN }}>
          Team-heatmap
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Publiserte kurs × medarbeidere. Grønn = fullført, gul = påbegynt, rød = ikke startet.
        </p>
      </div>
      {learningError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{learningError}</p>
      ) : null}
      {learningLoading ? <p className="text-sm text-neutral-500">Laster…</p> : null}

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-[#fbf9f3] shadow-sm">
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
                <td className="sticky left-0 z-10 bg-white px-3 py-2 text-sm font-medium" style={{ color: PIN_GREEN }}>
                  {u.name}
                </td>
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
