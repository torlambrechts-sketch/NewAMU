import { BarChart3 } from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'

export function LearningInsights() {
  const { stats, courses } = useLearning()
  const moduleCount = courses.reduce((acc, c) => acc + c.modules.length, 0)
  const byKind = courses.flatMap((c) => c.modules).reduce(
    (acc, m) => {
      acc[m.kind] = (acc[m.kind] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-[#2D403A]">Insights</h1>
        <p className="mt-2 text-sm text-neutral-600">High-level usage in this browser session.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InsightCard label="Courses" value={stats.totalCourses} />
        <InsightCard label="Modules" value={moduleCount} />
        <InsightCard label="Certificates" value={stats.certs} />
        <InsightCard label="Enrolments" value={stats.enrolled} />
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold text-[#2D403A]">
          <BarChart3 className="size-5" />
          Modules by type
        </h2>
        <ul className="mt-4 space-y-2 text-sm">
          {Object.entries(byKind)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => (
              <li key={k} className="flex justify-between border-b border-neutral-100 py-2 last:border-0">
                <span className="text-neutral-600">{k}</span>
                <span className="font-medium tabular-nums">{v}</span>
              </li>
            ))}
          {Object.keys(byKind).length === 0 ? (
            <li className="text-neutral-500">No modules yet.</li>
          ) : null}
        </ul>
      </div>
    </div>
  )
}

function InsightCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="text-2xl font-semibold tabular-nums text-[#2D403A]">{value}</div>
      <div className="text-sm text-neutral-600">{label}</div>
    </div>
  )
}
