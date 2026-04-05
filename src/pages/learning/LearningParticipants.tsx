import { ArrowDownUp, Search, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { PIN_GREEN } from '../../components/learning/LearningLayout'
import type { CourseProgress } from '../../types/learning'

type SortKey = 'learner' | 'course' | 'started' | 'days' | 'progress'
type SortDir = 'asc' | 'desc'

function SortHead({
  colKey,
  label,
  activeKey,
  dir,
  onSort,
}: {
  colKey: SortKey
  label: string
  activeKey: SortKey
  dir: SortDir
  onSort: (k: SortKey) => void
}) {
  return (
    <th className="px-4 py-3 font-medium">
      <button
        type="button"
        onClick={() => onSort(colKey)}
        className="inline-flex items-center gap-1 text-neutral-700 hover:text-[#2D403A]"
      >
        {label}
        {activeKey === colKey ? <span className="text-[10px] font-normal text-neutral-500">{dir === 'asc' ? '↑' : '↓'}</span> : null}
      </button>
    </th>
  )
}

function daysSinceStarted(iso: string): number {
  const start = new Date(iso).getTime()
  if (Number.isNaN(start)) return 0
  return Math.floor((Date.now() - start) / 86_400_000)
}

function ProgressBarMini({ value }: { value: number }) {
  const pct = Math.round(Math.min(100, Math.max(0, value * 100)))
  return (
    <div className="flex min-w-[120px] items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: PIN_GREEN }} />
      </div>
      <span className="shrink-0 tabular-nums text-xs text-neutral-600">{pct}%</span>
    </div>
  )
}

function rowKey(p: CourseProgress): string {
  return `${p.userId ?? 'local'}:${p.courseId}`
}

export function LearningParticipants() {
  const { can, profile } = useOrgSetupContext()
  const canManage = can('learning.manage')
  const { progress, courses, learningLoading, learningError } = useLearning()

  const [query, setQuery] = useState('')
  const [courseFilter, setCourseFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('started')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const rows = useMemo(() => {
    const enriched = progress.map((p) => {
      const c = courses.find((x) => x.id === p.courseId)
      const total = c?.modules.length ?? 0
      const done = c ? c.modules.filter((m) => p.moduleProgress[m.id]?.completed).length : 0
      const pct = total > 0 ? done / total : 0
      const days = daysSinceStarted(p.startedAt)
      const name =
        p.learnerName?.trim() ||
        (!canManage && profile?.display_name ? profile.display_name.trim() : '') ||
        '—'
      return { p, c, total, done, pct, days, name, courseTitle: c?.title ?? p.courseId }
    })

    let out = enriched.filter((r) => {
      if (courseFilter !== 'all' && r.p.courseId !== courseFilter) return false
      const q = query.trim().toLowerCase()
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        r.courseTitle.toLowerCase().includes(q) ||
        r.p.courseId.toLowerCase().includes(q)
      )
    })

    const mul = sortDir === 'asc' ? 1 : -1
    out = [...out].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'learner':
          cmp = a.name.localeCompare(b.name, 'nb')
          break
        case 'course':
          cmp = a.courseTitle.localeCompare(b.courseTitle, 'nb')
          break
        case 'started':
          cmp = new Date(a.p.startedAt).getTime() - new Date(b.p.startedAt).getTime()
          break
        case 'days':
          cmp = a.days - b.days
          break
        case 'progress':
          cmp = a.pct - b.pct
          break
        default:
          cmp = 0
      }
      return cmp * mul
    })

    return out
  }, [progress, courses, query, courseFilter, sortKey, sortDir, canManage, profile])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'learner' || key === 'course' ? 'asc' : 'desc')
    }
  }

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

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søk etter navn eller kurs…"
            className="w-full rounded-full border border-neutral-200 bg-white py-2 pl-10 pr-4 text-sm"
            aria-label="Filtrer tabell"
          />
        </div>
        <div className="flex items-center gap-2">
          <ArrowDownUp className="size-4 text-neutral-400" aria-hidden />
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="rounded-full border border-neutral-200 bg-white px-3 py-2 text-sm"
            aria-label="Filtrer på kurs"
          >
            <option value="all">Alle kurs</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/80 text-neutral-600">
                <SortHead colKey="learner" label="Medarbeider" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortHead colKey="course" label="Kurs" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortHead colKey="started" label="Startet" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortHead colKey="days" label="Dager siden start" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortHead colKey="progress" label="Fremdrift" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map(({ p, total, done, pct, days, name, courseTitle }) => (
                <tr key={rowKey(p)}>
                  <td className="px-4 py-3 font-medium text-[#2D403A]">{name}</td>
                  <td className="px-4 py-3">{courseTitle}</td>
                  <td className="px-4 py-3 text-xs text-neutral-500">{new Date(p.startedAt).toLocaleString()}</td>
                  <td
                    className={`px-4 py-3 tabular-nums ${days > 20 ? 'font-medium text-red-600' : 'text-neutral-700'}`}
                  >
                    {days}
                    {days > 20 ? <span className="ml-1 text-[10px] font-normal text-red-500">(over 20 d.)</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <ProgressBarMini value={pct} />
                      <span className="text-xs text-neutral-500">
                        {total ? `${done}/${total} moduler` : '—'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? (
          <p className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-neutral-500">
            <Users className="size-4" />
            Ingen treff — juster filter eller åpne et kurs for å starte fremdrift.
          </p>
        ) : null}
      </div>
    </div>
  )
}
