import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowDownUp, LayoutGrid, List as ListIcon, Search, ShieldAlert, Users } from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { CourseProgress } from '../../types/learning'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { WarningBox } from '../../components/ui/AlertBox'
import { SearchableSelect, type SelectOption } from '../../components/ui/SearchableSelect'
import { LayoutTable1PostingsShell } from '../../components/layout/LayoutTable1PostingsShell'
import { LayoutScoreStatRow } from '../../components/layout/LayoutScoreStatRow'
import type { LayoutScoreStatItem } from '../../components/layout/platformLayoutKit'
import { MODULE_TABLE_TH, MODULE_TABLE_TR_BODY, ModuleSectionCard } from '../../components/module'

type ViewMode = 'liste' | 'heatmap'
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
    <th className={MODULE_TABLE_TH}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onSort(colKey)}
        className="-ml-2 h-auto px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-600 hover:bg-transparent hover:text-neutral-900"
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
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: '#1a3d32' }} />
      </div>
      <span className="shrink-0 tabular-nums text-xs text-neutral-600">{pct}%</span>
    </div>
  )
}

function rowKey(p: CourseProgress): string {
  return `${p.userId ?? 'local'}:${p.courseId}`
}

function statusFor(pct: number, days: number): {
  label: string
  variant: 'success' | 'info' | 'neutral' | 'danger'
} {
  if (pct >= 1) return { label: 'Fullført', variant: 'success' }
  if (days > 30) return { label: 'Forsinket', variant: 'danger' }
  if (pct > 0) return { label: 'I gang', variant: 'info' }
  return { label: 'Ikke startet', variant: 'neutral' }
}

function cellColor(status: string) {
  if (status === 'complete') return 'bg-green-500'
  if (status === 'in_progress') return 'bg-amber-400'
  return 'bg-red-400'
}

/**
 * Single combined Deltakere page. Toggle between «Liste» (sortable per-row
 * fremdrift) and «Heatmap» (kurs × medarbeidere matrix). Shares the same KPI
 * row so the user can switch view without losing context.
 *
 * Replaces the old `/learning/participants` and `/learning/compliance` pages
 * (both still resolve via redirects in App.tsx).
 */
export function LearningDeltakerePage() {
  const { can, isAdmin, profile } = useOrgSetupContext()
  const canManage = isAdmin || can('learning.manage')
  const { progress, courses, complianceMatrix, learningLoading, learningError } = useLearning()

  const [searchParams, setSearchParams] = useSearchParams()
  const urlView = searchParams.get('view')
  const initialView: ViewMode = urlView === 'heatmap' ? 'heatmap' : 'liste'
  const [view, setView] = useState<ViewMode>(initialView)

  const setViewParam = (next: ViewMode) => {
    setView(next)
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next === 'liste') p.delete('view')
        else p.set('view', next)
        return p
      },
      { replace: true },
    )
  }

  const [query, setQuery] = useState('')
  const [courseFilter, setCourseFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('started')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // ── Liste view (per-progress-row) ─────────────────────────────────────────
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

  // ── Heatmap view (course × user matrix) ───────────────────────────────────
  const heatmap = useMemo(() => {
    const uids = [...new Set(complianceMatrix.map((c) => c.userId))]
    const userNames = new Map(complianceMatrix.map((c) => [c.userId, c.displayName]))
    const cids = [...new Set(complianceMatrix.map((c) => c.courseId))]
    const courseTitles = new Map(complianceMatrix.map((c) => [c.courseId, c.courseTitle]))
    const g = new Map<string, (typeof complianceMatrix)[0]>()
    for (const cell of complianceMatrix) g.set(`${cell.userId}:${cell.courseId}`, cell)
    return {
      users: uids.map((id) => ({ id, name: userNames.get(id) ?? id })),
      hcourses: cids.map((id) => ({ id, title: courseTitles.get(id) ?? id })),
      grid: g,
    }
  }, [complianceMatrix])

  // ── Shared KPI row (assignment status) ────────────────────────────────────
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

  const heatmapAvailable = canManage

  // Liste/Heatmap toggle pill — same shape as catalog Kort/Liste toggle.
  const viewToggle = (
    <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5" role="radiogroup" aria-label="Visningstype">
      <Button
        variant="ghost"
        onClick={() => setViewParam('liste')}
        role="radio"
        aria-checked={view === 'liste'}
        className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
          view === 'liste' ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500 hover:text-neutral-800'
        }`}
      >
        <ListIcon className="h-3.5 w-3.5" />
        Liste
      </Button>
      <Button
        variant="ghost"
        onClick={() => heatmapAvailable && setViewParam('heatmap')}
        role="radio"
        aria-checked={view === 'heatmap'}
        disabled={!heatmapAvailable}
        title={heatmapAvailable ? 'Vis kurs × medarbeidere som heatmap' : 'Heatmap krever lederrolle'}
        className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
          view === 'heatmap'
            ? 'bg-neutral-100 text-neutral-900'
            : heatmapAvailable
              ? 'text-neutral-500 hover:text-neutral-800'
              : 'cursor-not-allowed text-neutral-300'
        }`}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Heatmap
      </Button>
    </div>
  )

  return (
    <div className="space-y-6">
      {learningError ? <WarningBox>{learningError}</WarningBox> : null}
      {learningLoading ? <p className="text-sm text-neutral-600">Laster…</p> : null}

      <LayoutScoreStatRow items={kpis} />

      {view === 'liste' ? (
        <ModuleSectionCard className="!p-0">
          <LayoutTable1PostingsShell
            wrap={false}
            titleTypography="sans"
            title={canManage ? 'Fremdrift — alle deltakere' : 'Min fremdrift'}
            description="Sorter kolonner eller filtrer på kurs."
            headerActions={viewToggle}
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
                    <th className={MODULE_TABLE_TH}>Status</th>
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
                      <tr key={rowKey(p)} className={MODULE_TABLE_TR_BODY}>
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
      ) : (
        <>
          <ModuleSectionCard className="!p-0">
            <LayoutTable1PostingsShell
              wrap={false}
              titleTypography="sans"
              title="Publiserte kurs × medarbeidere"
              description="Grønn = fullført, gul = påbegynt, rød = ikke startet."
              headerActions={viewToggle}
              toolbar={
                <div className="flex items-center gap-3 text-xs text-neutral-600">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-sm bg-green-500" />
                    Fullført
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-sm bg-amber-400" />
                    Pågående
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-sm bg-red-400" />
                    Ikke startet
                  </span>
                </div>
              }
              footer={
                <span>
                  {heatmap.users.length} medarbeidere × {heatmap.hcourses.length} kurs
                </span>
              }
            >
              {heatmap.users.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
                  <LayoutGrid className="h-8 w-8 text-neutral-300" />
                  <p className="text-sm text-neutral-600">Ingen data ennå.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-neutral-50/60">
                      <tr>
                        <th className="sticky left-0 z-10 bg-neutral-50/80 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600 backdrop-blur">
                          Medarbeider
                        </th>
                        {heatmap.hcourses.map((c) => (
                          <th
                            key={c.id}
                            className="max-w-[10rem] px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600"
                            title={c.title}
                          >
                            <span className="line-clamp-3">{c.title}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {heatmap.users.map((u) => (
                        <tr key={u.id} className="border-t border-neutral-100 hover:bg-neutral-50/60">
                          <td className="sticky left-0 z-10 bg-white/95 px-4 py-2.5 text-sm font-medium text-neutral-900 backdrop-blur">
                            {u.name}
                          </td>
                          {heatmap.hcourses.map((c) => {
                            const cell = heatmap.grid.get(`${u.id}:${c.id}`)
                            const st = cell?.cellStatus ?? 'not_started'
                            const label =
                              st === 'complete' ? 'Fullført' : st === 'in_progress' ? 'Påbegynt' : 'Ikke startet'
                            return (
                              <td key={c.id} className="px-2 py-2.5 text-center">
                                <span
                                  className={`inline-block h-4 w-4 rounded-sm ${cellColor(st)}`}
                                  title={`${Math.round((cell?.completionPct ?? 0) * 100)}% · ${label}`}
                                />
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </LayoutTable1PostingsShell>
          </ModuleSectionCard>

          <ModuleSectionCard className="p-5 md:p-6">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" />
              <div className="text-sm text-neutral-700">
                <p className="font-semibold text-neutral-900">Personvern (GDPR art. 5)</p>
                <p className="mt-1.5">
                  Heatmap viser identifiserbar informasjon på personnivå — kun ledere med behandlingsgrunnlag
                  har tilgang. Ikke del eksterne kopier av denne tabellen.
                </p>
              </div>
            </div>
          </ModuleSectionCard>
        </>
      )}
    </div>
  )
}
