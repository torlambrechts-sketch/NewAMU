import { useMemo, useState } from 'react'
import { ArrowDownUp, Search, Users } from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { CourseProgress } from '../../types/learning'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { SearchableSelect, type SelectOption } from '../../components/ui/SearchableSelect'
import { LayoutTable1PostingsShell } from '../../components/layout/LayoutTable1PostingsShell'
import { LayoutScoreStatRow } from '../../components/layout/LayoutScoreStatRow'
import type { LayoutScoreStatItem } from '../../components/layout/platformLayoutKit'
import { ModuleSectionCard } from '../../components/module'
import { ComplianceBanner } from '../../components/ui/ComplianceBanner'

const TABLE_TH =
  'px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-600'
const TABLE_TR_BODY = 'border-t border-neutral-100 hover:bg-neutral-50/60 transition-colors'

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
    <th className={TABLE_TH}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onSort(colKey)}
        className="-ml-2 h-auto px-2 py-1 font-bold text-[10px] uppercase tracking-wider text-neutral-600 hover:bg-transparent hover:text-neutral-900"
      >
        {label}
        {activeKey === colKey ? (
          <span className="text-[10px] font-normal text-neutral-500">{dir === 'asc' ? '↑' : '↓'}</span>
        ) : null}
      </Button>
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
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100"
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: '#1a3d32' }}
        />
      </div>
      <span className="shrink-0 tabular-nums text-xs text-neutral-600">{pct}%</span>
    </div>
  )
}

function rowKey(p: CourseProgress): string {
  return `${p.userId ?? 'local'}:${p.courseId}`
}

function statusFor(pct: number, days: number): { label: string; variant: 'success' | 'info' | 'neutral' | 'danger' } {
  if (pct >= 1) return { label: 'Fullført', variant: 'success' }
  if (days > 30) return { label: 'Forsinket', variant: 'danger' }
  if (pct > 0) return { label: 'I gang', variant: 'info' }
  return { label: 'Ikke startet', variant: 'neutral' }
}

export function LearningParticipants() {
  const { can, profile } = useOrgSetupContext()
  const canManage = can('learning.manage')
  const { progress, courses, learningLoading, learningError } = useLearning()

  const [query, setQuery] = useState('')
  const [courseFilter, setCourseFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('started')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const enriched = useMemo(() => {
    return progress.map((p) => {
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
  }, [progress, courses, canManage, profile])

  const rows = useMemo(() => {
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
  }, [enriched, query, courseFilter, sortKey, sortDir])

  const kpis = useMemo<LayoutScoreStatItem[]>(() => {
    const completed = enriched.filter((r) => r.pct >= 1).length
    const inProgress = enriched.filter((r) => r.pct > 0 && r.pct < 1).length
    const overdue = enriched.filter((r) => r.days > 30 && r.pct < 1).length
    return [
      { big: String(enriched.length), title: 'Tildelinger', sub: 'Aktive på tvers' },
      { big: String(completed), title: 'Fullført', sub: 'Av deltakere' },
      { big: String(inProgress), title: 'Pågående', sub: 'Aktive deltakere' },
      { big: String(overdue), title: 'Forsinket', sub: '> 30 dager siden start' },
    ]
  }, [enriched])

  const courseFilterOptions: SelectOption[] = useMemo(
    () => [{ value: 'all', label: 'Alle kurs' }, ...courses.map((c) => ({ value: c.id, label: c.title }))],
    [courses],
  )

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
      <ComplianceBanner title="Personvern">
        Visning er begrenset til {canManage ? 'kursansvarlige (HMS-leder, avdelingsleder)' : 'din egen fremdrift'} jf.
        GDPR art. 5(1)(c) og IK-forskriften § 5 nr. 2.
      </ComplianceBanner>

      {learningError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{learningError}</p>
      ) : null}
      {learningLoading ? <p className="text-sm text-neutral-600">Laster…</p> : null}

      <LayoutScoreStatRow items={kpis} />

      <ModuleSectionCard className="!p-0">
        <LayoutTable1PostingsShell
          wrap={false}
          titleTypography="sans"
          title={canManage ? 'Fremdrift — alle deltakere' : 'Min fremdrift'}
          description="Sorter kolonner eller filtrer på kurs."
          toolbar={
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative max-w-md flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <StandardInput
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Søk etter navn eller kurs…"
                  className="pl-9"
                  aria-label="Filtrer tabell"
                />
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-xs">
                <ArrowDownUp className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                <SearchableSelect
                  value={courseFilter}
                  options={courseFilterOptions}
                  onChange={setCourseFilter}
                  placeholder="Velg kurs"
                  className="mt-0 min-w-0 flex-1"
                  triggerClassName="text-sm"
                />
              </div>
            </div>
          }
          footer={<span>{rows.length} fremdriftsrader</span>}
        >
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <Users className="h-8 w-8 text-neutral-300" />
              <p className="text-sm text-neutral-600">
                Ingen treff — juster filter eller åpne et kurs for å starte fremdrift.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-neutral-50/60">
                <tr>
                  <SortHead colKey="learner" label="Medarbeider" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHead colKey="course" label="Kurs" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHead colKey="started" label="Startet" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHead colKey="days" label="Dager siden start" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHead colKey="progress" label="Fremdrift" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <th className={TABLE_TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, total, done, pct, days, name, courseTitle }) => {
                  const initials = name
                    .split(' ')
                    .map((s) => s[0])
                    .filter(Boolean)
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()
                  const status = statusFor(pct, days)
                  return (
                    <tr key={rowKey(p)} className={TABLE_TR_BODY}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold"
                            style={{ background: '#e7efe9', color: '#1a3d32' }}
                          >
                            {initials || '–'}
                          </span>
                          <span className="font-medium text-neutral-900">{name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-neutral-700">{courseTitle}</td>
                      <td className="px-5 py-3 text-xs text-neutral-500">
                        {new Date(p.startedAt).toLocaleDateString('nb-NO')}
                      </td>
                      <td
                        className={`px-5 py-3 tabular-nums ${days > 30 && pct < 1 ? 'font-semibold text-red-600' : 'text-neutral-700'}`}
                      >
                        {days}
                      </td>
                      <td className="px-5 py-3">
                        <div className="space-y-1">
                          <ProgressBarMini value={pct} />
                          <span className="text-xs text-neutral-500">
                            {total ? `${done}/${total} moduler` : '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </LayoutTable1PostingsShell>
      </ModuleSectionCard>
    </div>
  )
}
