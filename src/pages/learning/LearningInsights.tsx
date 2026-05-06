import { useMemo } from 'react'
import { BarChart3 } from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { LayoutScoreStatRow } from '../../components/layout/LayoutScoreStatRow'
import type { LayoutScoreStatItem } from '../../components/layout/platformLayoutKit'
import { LayoutTable1PostingsShell } from '../../components/layout/LayoutTable1PostingsShell'
import { ModuleSectionCard } from '../../components/module'

const KIND_LABELS: Record<string, string> = {
  flashcard: 'Flashkort',
  quiz: 'Quiz',
  text: 'Tekst',
  image: 'Bilde',
  video: 'Video',
  checklist: 'Sjekkliste',
  tips: 'Tips',
  on_job: 'På jobben',
  event: 'Hendelse',
  other: 'Annet',
}

export function LearningInsights() {
  const { stats, courses, progress, certificates } = useLearning()

  const moduleCount = courses.reduce((acc, c) => acc + c.modules.length, 0)
  const byKind = courses.flatMap((c) => c.modules).reduce(
    (acc, m) => {
      acc[m.kind] = (acc[m.kind] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const completedRows = progress.filter(
    (p) =>
      p.completedAt ||
      (() => {
        const c = courses.find((x) => x.id === p.courseId)
        return c && c.modules.length > 0 && c.modules.every((m) => p.moduleProgress[m.id]?.completed)
      })(),
  ).length
  const completionPct = progress.length ? Math.round((completedRows / progress.length) * 100) : 0

  const kpis = useMemo<LayoutScoreStatItem[]>(
    () => [
      { big: String(stats.totalCourses), title: 'Kurs', sub: 'I katalogen' },
      { big: String(moduleCount), title: 'Moduler', sub: 'Totalt på tvers' },
      { big: String(certificates.length), title: 'Sertifikater', sub: 'Utstedt' },
      {
        big: `${completionPct}%`,
        title: 'Gjennomføring',
        sub: `${completedRows} av ${progress.length} fullført`,
      },
    ],
    [stats.totalCourses, moduleCount, certificates.length, completionPct, completedRows, progress.length],
  )

  const sortedKinds = Object.entries(byKind).sort((a, b) => b[1] - a[1])
  const maxKind = sortedKinds.length > 0 ? Math.max(...sortedKinds.map(([, v]) => v)) : 0

  return (
    <div className="space-y-6">
      <LayoutScoreStatRow items={kpis} />

      <ModuleSectionCard className="!p-0">
        <LayoutTable1PostingsShell
          wrap={false}
          titleTypography="sans"
          title="Moduler etter type"
          description="Fordeling av modulformatene på tvers av kurskatalogen."
          toolbar={
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <BarChart3 className="h-4 w-4 text-neutral-400" />
              {sortedKinds.length} ulike formater
            </div>
          }
          footer={<span>{moduleCount} moduler totalt</span>}
        >
          {sortedKinds.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-neutral-500">
              Ingen moduler i katalogen ennå.
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {sortedKinds.map(([kind, count]) => {
                const pct = maxKind ? Math.round((count / maxKind) * 100) : 0
                return (
                  <li key={kind} className="flex items-center gap-4 px-5 py-3 text-sm">
                    <div className="w-32 shrink-0 font-medium text-neutral-800">
                      {KIND_LABELS[kind] ?? kind}
                    </div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: '#1a3d32' }}
                      />
                    </div>
                    <div className="w-12 shrink-0 text-right tabular-nums text-neutral-700">
                      {count}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </LayoutTable1PostingsShell>
      </ModuleSectionCard>
    </div>
  )
}
