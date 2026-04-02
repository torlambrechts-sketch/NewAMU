import { Users } from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'

export function LearningParticipants() {
  const { progress, courses } = useLearning()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-[#2D403A]">Participants</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Local enrolment records (one per browser). Enterprise LMS would sync users and SSO here.
        </p>
      </div>
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
            No enrolments yet — open a course preview to start.
          </p>
        ) : null}
      </div>
    </div>
  )
}
