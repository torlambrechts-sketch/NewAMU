import { Users } from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'

export function LearningParticipants() {
  const { can } = useOrgSetupContext()
  const canManage = can('learning.manage')
  const { progress, courses, learningLoading, learningError } = useLearning()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-[#2D403A]">Participants</h1>
        <p className="mt-2 text-sm text-neutral-600">
          {canManage
            ? 'Fremdrift for alle brukere i organisasjonen (synlig for kursansvarlige).'
            : 'Din egen fremdrift på tvers av kurs.'}
        </p>
      </div>
      {learningError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{learningError}</p>
      ) : null}
      {learningLoading ? <p className="text-sm text-neutral-500">Laster…</p> : null}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50/80 text-neutral-600">
              <th className="px-4 py-3 font-medium">Course</th>
              <th className="px-4 py-3 font-medium">Started</th>
              <th className="px-4 py-3 font-medium">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {progress.map((p) => {
              const c = courses.find((x) => x.id === p.courseId)
              const total = c?.modules.length ?? 0
              const done = c
                ? c.modules.filter((m) => p.moduleProgress[m.id]?.completed).length
                : 0
              return (
                <tr key={p.courseId}>
                  <td className="px-4 py-3 font-medium text-[#2D403A]">
                    {c?.title ?? p.courseId}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500">
                    {new Date(p.startedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {total ? `${done}/${total} modules` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {progress.length === 0 ? (
          <p className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-neutral-500">
            <Users className="size-4" />
            Ingen registreringer ennå — åpne et kurs i forhåndsvisning for å starte.
          </p>
        ) : null}
      </div>
    </div>
  )
}
