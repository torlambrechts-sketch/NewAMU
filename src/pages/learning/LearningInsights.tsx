import { BarChart3 } from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'

const KIND_LABELS: Record<string, string> = {
  flashcard: 'Flashkort', quiz: 'Quiz', text: 'Lese', image: 'Bilde',
  video: 'Video', checklist: 'Sjekkliste', tips: 'Tips',
  on_job: 'I praksis', event: 'Arrangement', other: 'Annet',
}

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
        <h1 className="font-serif text-3xl font-semibold text-[#2D403A]">Innsikt</h1>
        <p className="mt-2 text-sm text-[#6b6f68]">Aggregert oversikt over gjennomføring i organisasjonen.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InsightCard label="Kurs" value={stats.totalCourses} />
        <InsightCard label="Moduler" value={moduleCount} />
        <InsightCard label="Sertifikater" value={stats.certs} />
        <InsightCard label="Påmeldinger" value={stats.enrolled} />
      </div>
      <div className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-6">
        <h2 className="flex items-center gap-2 font-semibold text-[#2D403A]">
          <BarChart3 className="size-5" />
          Moduler etter type
        </h2>
        <ul className="mt-4 space-y-2 text-sm">
          {Object.entries(byKind)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => (
              <li key={k} className="flex justify-between border-b border-[#e3ddcc] py-2 last:border-0">
                <span className="text-[#6b6f68]">{KIND_LABELS[k] ?? k}</span>
                <span className="font-medium tabular-nums">{v}</span>
              </li>
            ))}
          {Object.keys(byKind).length === 0 ? (
            <li className="text-[#6b6f68]">Ingen moduler ennå.</li>
          ) : null}
        </ul>
      </div>
    </div>
  )
}

function InsightCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.7px] text-[#6b6f68]">{label}</div>
      <div className="mt-1 font-serif text-[28px] font-semibold leading-none text-[#1d1f1c]">{value}</div>
    </div>
  )
}
