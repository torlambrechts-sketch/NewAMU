// LearningCourseDetailPage — Course offering detail. Tabs: Innhold (lessons),
// Læringer (roster), Spillifisering (XP+badges), Versjoner, Audit. This is the
// "course one-pager" that ships above the builder + viewer.
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Award,
  Bell,
  BookOpen,
  CalendarPlus,
  Check,
  Clock,
  Coffee,
  Download,
  Flame,
  GitBranch,
  HeartHandshake,
  History,
  ListOrdered,
  Pencil,
  PlayCircle,
  Send,
  ShieldCheck,
  Target,
  Trophy,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { Button } from '../../components/ui/Button'
import { Tabs, type TabItem } from '../../components/ui/Tabs'
import { ModulePageShell } from '../../components/module'
import {
  aggregateCohort,
  courseDurationHours,
  deriveLeaderboard,
  formatDateNb,
  formatDateTimeNb,
  frameworkForCourse,
  isMandatoryCourse,
  learnerProgressFor,
  learnerScoreFor,
  learnerStatusFor,
  learnerTimeHours,
  moduleKindToBlock,
  quizQuestionCount,
} from '../../lib/learning/elearningDesignKit'
import {
  BlockChip,
  Card,
  CohortStatusPill,
  DesignIcon,
  FrameworkPill,
  Initials,
  ProgressBar,
} from '../../components/ui/elearningPrimitives'
import type { Course, CourseProgress } from '../../types/learning'

type DetailTab = 'innhold' | 'laerere' | 'gamification' | 'versjoner' | 'audit'

export function LearningCourseDetailPage() {
  const navigate = useNavigate()
  const { courseId } = useParams<{ courseId: string }>()
  const learning = useLearning()
  const { can, isAdmin } = useOrgSetupContext()
  const canManage = isAdmin || can('learning.manage')
  const { courses, progress, learningLoading, learningError } = learning
  const [tab, setTab] = useState<DetailTab>('innhold')

  const course = useMemo(() => courses.find((c) => c.id === courseId) ?? null, [courses, courseId])

  // Reset to "innhold" when navigating between courses
  const [lastCourseId, setLastCourseId] = useState(courseId)
  if (lastCourseId !== courseId) {
    setLastCourseId(courseId)
    if (tab !== 'innhold') setTab('innhold')
  }

  if (learningLoading) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'Klarert', to: '/' }, { label: 'Opplæring', to: '/learning' }, { label: 'Laster…' }]}
        title="Laster kurs…"
        description={null}
        loading
        loadingLabel="Henter kursdetaljer…"
      >
        <div />
      </ModulePageShell>
    )
  }

  if (!course) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'Klarert', to: '/' }, { label: 'Opplæring', to: '/learning' }, { label: 'Kurs ikke funnet' }]}
        title="Fant ikke kurset"
        description="Det opplærte kurset eksisterer ikke lenger, eller du har ikke tilgang til det."
        notFound={{ title: 'Kurs ikke funnet', onBack: () => navigate('/learning'), backLabel: 'Til e-læring' }}
      >
        <div />
      </ModulePageShell>
    )
  }

  const fwId = frameworkForCourse(course)
  const mandatory = isMandatoryCourse(course)
  const cohort = aggregateCohort(course, progress)
  const ownProgress = progress.filter((p) => p.courseId === course.id)

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Klarert', to: '/' },
        { label: 'Opplæring', to: '/learning' },
        { label: course.title.length > 40 ? course.title.slice(0, 38) + '…' : course.title },
      ]}
      title={course.title}
      description={`${course.description || 'Ingen beskrivelse.'} · ${cohort.enrolled} påmeldte · v${course.localeVersionMajor ?? course.courseVersion ?? 1}.${course.localeVersionMinor ?? course.courseVersionMinor ?? 0}`}
      headerActions={
        <>
          <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate('/learning')}>
            Tilbake
          </Button>
          {canManage ? (
            <Button
              variant="secondary"
              icon={<Pencil className="h-4 w-4" />}
              onClick={() => navigate(`/learning/courses/${course.id}`)}
            >
              Åpne bygger
            </Button>
          ) : null}
          {canManage ? (
            <Button variant="secondary" icon={<UserPlus className="h-4 w-4" />} onClick={() => navigate('/learning/deltakere')}>
              Meld inn læringer
            </Button>
          ) : null}
          <Button
            variant="primary"
            icon={<PlayCircle className="h-4 w-4" />}
            onClick={() => navigate(`/learning/play/${course.id}`)}
          >
            Vis kurs
          </Button>
        </>
      }
    >
      {learningError ? (
        <div className="flex items-start gap-2.5 rounded-md border border-red-300 bg-red-50 px-3 py-3 text-sm text-red-900">
          <DesignIcon name="AlertTriangle" className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <span className="flex-1">{learningError}</span>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200/80 bg-white px-5 py-3" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <div className="flex flex-wrap items-center gap-3">
          <CohortStatusPill status={cohort.status} />
          <FrameworkPill id={fwId} />
          {mandatory ? (
            <span className="inline-flex items-center gap-1 rounded border border-[#c5d3c8] bg-[#e7efe9] px-2 py-0.5 text-[11px] font-semibold text-[#14312a]">
              <ShieldCheck className="h-3 w-3" /> Lovpålagt
            </span>
          ) : null}
          {(course.lawRefs ?? []).slice(0, 4).map((l) => (
            <span
              key={l}
              className="rounded border border-[#c5d3c8] bg-[#e7efe9] px-1.5 py-0.5 text-[10px] font-semibold text-[#14312a]"
            >
              {l.length > 28 ? l.slice(0, 26) + '…' : l}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-600">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-neutral-400" /> {courseDurationHours(course)}t
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ListOrdered className="h-3.5 w-3.5 text-neutral-400" /> {course.modules.length} moduler
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5 text-neutral-400" />
            Sertifikat: {course.recertificationMonths ? `${Math.round(course.recertificationMonths / 12)} år` : 'Permanent'}
          </span>
        </div>
      </div>

      <Card>
        <div className="border-b border-neutral-100 px-5 py-2.5">
          <Tabs
            items={[
              { id: 'innhold', label: 'Innhold', icon: BookOpen, badgeCount: course.modules.length } as TabItem,
              { id: 'laerere', label: 'Læringer', icon: Users, badgeCount: ownProgress.length } as TabItem,
              { id: 'gamification', label: 'Spillifisering', icon: Trophy } as TabItem,
              { id: 'versjoner', label: 'Versjoner', icon: GitBranch } as TabItem,
              { id: 'audit', label: 'Audit', icon: History } as TabItem,
            ]}
            activeId={tab}
            onChange={(id) => setTab(id as DetailTab)}
          />
        </div>
        <div className="p-5">
          {tab === 'innhold' ? <InnholdTab course={course} onOpenBuilder={() => navigate(`/learning/courses/${course.id}`)} /> : null}
          {tab === 'laerere' ? <LaerereTab course={course} progress={ownProgress} /> : null}
          {tab === 'gamification' ? <GamificationTab course={course} progress={ownProgress} /> : null}
          {tab === 'versjoner' ? <VersjonerTab course={course} /> : null}
          {tab === 'audit' ? <AuditTab course={course} progress={ownProgress} /> : null}
        </div>
      </Card>
    </ModulePageShell>
  )
}

function InnholdTab({
  course,
  onOpenBuilder,
}: {
  course: Course
  onOpenBuilder: () => void
}) {
  const sortedModules = [...course.modules].sort((a, b) => a.order - b.order)
  const totalMin = sortedModules.reduce((a, m) => a + (m.durationMinutes || 0), 0)

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Læringsløp</h3>
            <p className="mt-0.5 text-[11px] text-neutral-500">
              {sortedModules.length} leksjoner · {Math.round((totalMin / 60) * 10) / 10}t ·{' '}
              {sortedModules.length} innholdsblokker
            </p>
          </div>
          <Button variant="primary" size="sm" icon={<Pencil className="h-3 w-3" />} onClick={onOpenBuilder}>
            Åpne bygger
          </Button>
        </div>

        <ol className="space-y-2">
          {sortedModules.length === 0 ? (
            <li className="rounded-md border-2 border-dashed border-neutral-200 px-6 py-12 text-center text-sm text-neutral-500">
              Ingen leksjoner ennå. Bruk byggeren til å lage den første leksjonen.
            </li>
          ) : null}
          {sortedModules.map((m, idx) => {
            const block = moduleKindToBlock(m.kind)
            const questions = quizQuestionCount(m.content)
            return (
              <li
                key={m.id}
                className="rounded-md border border-neutral-200/80 bg-white p-3"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#1a3d32] text-xs font-bold tabular-nums text-white">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-semibold text-neutral-900">{m.title}</span>
                      <span className="ml-auto inline-flex items-center gap-1 text-[10px] tabular-nums text-neutral-500">
                        <Clock className="h-2.5 w-2.5" /> {m.durationMinutes} min
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <BlockChip
                        type={block}
                        title={m.title}
                        durationMin={block === 'video' ? m.durationMinutes : undefined}
                        questions={questions ?? undefined}
                      />
                      {(m.refLawIds ?? []).slice(0, 2).map((ref) => (
                        <span
                          key={ref}
                          className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700"
                        >
                          <BookOpen className="h-2.5 w-2.5" /> {ref}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      <aside className="space-y-3">
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-neutral-900">Læringsmål</h3>
          <ul className="mt-2 space-y-1.5 text-[12px]">
            {(deriveObjectives(course)).map((o, i) => (
              <li key={i} className="flex items-start gap-1.5 text-neutral-700">
                <Target className="mt-0.5 h-3 w-3 shrink-0 text-[#1a3d32]" />
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold text-neutral-900">Eksamen og sertifikat</h3>
          <ul className="mt-2 space-y-2 text-[12px]">
            <li className="flex justify-between">
              <span className="text-neutral-500">Bestått-grense</span>
              <span className="font-semibold tabular-nums text-neutral-900">80%</span>
            </li>
            <li className="flex justify-between">
              <span className="text-neutral-500">Sluttest</span>
              <span className="text-neutral-900">
                {(() => {
                  const quizMods = sortedModules.filter((m) => m.kind === 'quiz')
                  if (!quizMods.length) return 'Ingen quiz'
                  const total = quizMods.reduce((a, m) => a + (quizQuestionCount(m.content) ?? 0), 0)
                  return `${total} spørsmål`
                })()}
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-neutral-500">Forsøk</span>
              <span className="text-neutral-900">3 maks</span>
            </li>
            <li className="flex justify-between">
              <span className="text-neutral-500">Gyldighet</span>
              <span className="text-neutral-900">{course.recertificationMonths ? `${Math.round(course.recertificationMonths / 12)} år` : 'Permanent'}</span>
            </li>
          </ul>
        </Card>
      </aside>
    </div>
  )
}

function deriveObjectives(course: Course): string[] {
  const objectives: string[] = []
  if (course.description) {
    const lines = course.description.split(/\n+/).map((l) => l.trim()).filter(Boolean)
    for (const line of lines) {
      if (line.startsWith('- ')) objectives.push(line.slice(2))
      else if (objectives.length < 5) objectives.push(line)
      if (objectives.length >= 5) break
    }
  }
  if (objectives.length < 5) {
    course.modules.slice(0, 5 - objectives.length).forEach((m) => objectives.push(`Lære om ${m.title.toLowerCase()}`))
  }
  return objectives.slice(0, 5)
}

function LaerereTab({
  course,
  progress,
}: {
  course: Course
  progress: CourseProgress[]
}) {
  const [filter, setFilter] = useState<'all' | 'fullført' | 'pågår' | 'ikke startet'>('all')

  const filtered = useMemo(() => {
    if (filter === 'all') return progress
    return progress.filter((p) => learnerStatusFor(course, p) === filter)
  }, [progress, filter, course])

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all' as const, label: `Alle (${progress.length})` },
              {
                id: 'fullført' as const,
                label: `Fullført (${progress.filter((p) => learnerStatusFor(course, p) === 'fullført').length})`,
              },
              {
                id: 'pågår' as const,
                label: `Pågår (${progress.filter((p) => learnerStatusFor(course, p) === 'pågår').length})`,
              },
              {
                id: 'ikke startet' as const,
                label: `Ikke startet (${progress.filter((p) => learnerStatusFor(course, p) === 'ikke startet').length})`,
              },
            ]
          ).map((f) => (
            <Button
              key={f.id}
              variant={filter === f.id ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setFilter(f.id)}
              className={[
                '!gap-0 !rounded-full !px-2.5 !py-1 text-[11px]',
                filter === f.id ? '' : '!bg-neutral-100 text-neutral-600 hover:!bg-neutral-200/70',
              ].join(' ')}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" icon={<Bell className="h-3 w-3" />}>
            Send påminnelse
          </Button>
          <Button variant="secondary" size="sm" icon={<Download className="h-3 w-3" />}>
            Eksporter
          </Button>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-md border border-neutral-200/80">
        <table className="w-full min-w-[860px] text-xs">
          <thead style={{ background: '#fbf9f3' }}>
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700">Læring</th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700">Avdeling</th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700">Rolle</th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700">Fremdrift</th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700">Score</th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700">Tidsbruk</th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700">Status</th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700">Sertifikat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-12 text-center text-sm text-neutral-500">
                  Ingen påmeldte i denne kategorien.
                </td>
              </tr>
            ) : null}
            {filtered.map((p, idx) => {
              const status = learnerStatusFor(course, p)
              const pct = learnerProgressFor(course, p)
              const score = learnerScoreFor(course, p)
              return (
                <tr key={p.userId ?? `${idx}`} className="hover:bg-neutral-50/60">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Initials name={p.learnerName ?? '?'} size={22} tone={(['forest', 'cream', 'sand'] as const)[idx % 3]} />
                      <span className="font-medium text-neutral-900">{p.learnerName ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-neutral-500">
                    {p.departmentIdAtCompletion
                      ? <span className="font-mono text-[10px]">{p.departmentIdAtCompletion.slice(0, 8)}…</span>
                      : <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-neutral-500">
                    {p.locationIdAtCompletion
                      ? <span className="font-mono text-[10px]">{p.locationIdAtCompletion.slice(0, 8)}…</span>
                      : <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-16">
                        <ProgressBar value={pct} height={3} />
                      </div>
                      <span className="tabular-nums text-neutral-700">{Math.round(pct * 100)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {score !== null ? (
                      <span
                        className={[
                          'font-semibold',
                          score >= 90 ? 'text-green-700' : score >= 75 ? 'text-neutral-900' : 'text-amber-700',
                        ].join(' ')}
                      >
                        {score}
                      </span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-neutral-700">{learnerTimeHours(course, p)}t</td>
                  <td className="px-3 py-2">
                    <span
                      className={[
                        'inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                        status === 'fullført'
                          ? 'bg-green-100 text-green-800'
                          : status === 'pågår'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-neutral-100 text-neutral-700',
                      ].join(' ')}
                    >
                      {status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-[10px] tabular-nums text-neutral-600">{p.completedAt ? `CERT-${(p.userId ?? '').slice(0, 8).toUpperCase()}` : '—'}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GamificationTab({
  course,
  progress,
}: {
  course: Course
  progress: CourseProgress[]
}) {
  const leaderboard = deriveLeaderboard(course, progress, 5)
  const badges = course.badges ?? []

  const totalLearners = progress.length || 1
  // "Aktive læringer" — proxy for "currently in progress" (started but not
  // completed). Without per-day session telemetry we cannot reliably show
  // "denne uka", so the label below reflects what we can compute.
  const activeInProgress = progress.filter((p) => !!p.startedAt && !p.completedAt).length
  const completedTotal = progress.filter((p) => p.completedAt).length
  const failedQuizzes = progress.reduce((acc, p) => {
    return acc + Object.values(p.moduleProgress).filter((mp) => typeof mp.score === 'number' && mp.score < 75).length
  }, 0)

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900">Topp 5 — XP-leaderboard</h3>
        {leaderboard.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-neutral-200 bg-neutral-50/40 px-4 py-6 text-center text-sm text-neutral-500">
            Ingen påmeldte enda. Topplisten fylles ut når læringer starter kurset.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {leaderboard.map((p) => (
              <li
                key={p.rank}
                className={[
                  'flex items-center gap-3 rounded-lg border p-3',
                  p.rank === 1
                    ? 'border-amber-300 bg-gradient-to-r from-amber-50 to-white'
                    : p.rank === 2
                      ? 'border-neutral-300 bg-neutral-50'
                      : p.rank === 3
                        ? 'border-orange-200 bg-orange-50/40'
                        : 'border-neutral-200 bg-white',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums',
                    p.rank === 1
                      ? 'bg-amber-500 text-white'
                      : p.rank === 2
                        ? 'bg-neutral-400 text-white'
                        : p.rank === 3
                          ? 'bg-orange-400 text-white'
                          : 'bg-neutral-200 text-neutral-700',
                  ].join(' ')}
                >
                  #{p.rank}
                </span>
                <Initials name={p.name} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-neutral-900">{p.name}</div>
                  <div className="mt-0.5 flex items-center gap-3 text-[11px] text-neutral-600">
                    <span className="inline-flex items-center gap-1">
                      <Zap className="h-3 w-3 text-amber-500" />
                      <span className="font-semibold tabular-nums">{p.xp}</span> XP
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Award className="h-3 w-3 text-purple-600" />
                      <span className="font-semibold tabular-nums">{p.badges}</span> badges
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Flame className="h-3 w-3 text-orange-500" />
                      <span className="font-semibold tabular-nums">{p.streak}</span> dagers stim
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mt-6 text-sm font-semibold text-neutral-900">Badges</h3>
        {badges.length === 0 ? (
          <div className="mt-3 rounded-md border border-dashed border-neutral-200 bg-neutral-50/40 px-4 py-6 text-center text-sm text-neutral-500">
            Ingen badges definert for kurset ennå. Legg dem inn via byggeren.
          </div>
        ) : (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {badges.map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-lg border border-neutral-200/80 bg-white p-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{ background: (b.color ?? '#1a3d32') + '20', color: b.color ?? '#1a3d32' }}
                >
                  <DesignIcon name={b.icon ?? 'Award'} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-neutral-900">{b.label}</div>
                  <div className="text-[11px] text-neutral-500">{b.description ?? ''}</div>
                </div>
                <span className="text-xs font-semibold tabular-nums text-neutral-700">
                  {/* TODO: replace heuristic once per-badge earned-count lands on Course.badges */}
                  <span className="text-neutral-400">—</span>
                  <span className="text-[10px] text-neutral-400">/{totalLearners}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <aside className="space-y-3">
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-neutral-900">Engasjement</h3>
          <ul className="mt-2 space-y-2 text-xs">
            <li className="flex justify-between">
              <span className="text-neutral-500">Pågående læringer</span>
              <span className="font-semibold tabular-nums text-neutral-900">
                {activeInProgress} av {progress.length}
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-neutral-500">Totalt fullført</span>
              <span className="font-semibold tabular-nums text-neutral-900">{completedTotal}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-neutral-500">Snittfremdrift</span>
              <span className="font-semibold tabular-nums text-neutral-900">
                {progress.length
                  ? Math.round((progress.reduce((s, p) => s + learnerProgressFor(course, p), 0) / progress.length) * 100)
                  : 0}
                %
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-neutral-500">Ufullførte quizzer</span>
              <span className="font-semibold tabular-nums text-amber-700">{failedQuizzes}</span>
            </li>
          </ul>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold text-neutral-900">Belønninger</h3>
          <ul className="mt-2 space-y-2 text-[11px] text-neutral-600">
            <li className="flex items-center gap-1.5">
              <Trophy className="h-3 w-3 text-amber-600" /> Topp 3 mottar HMS-gavekort 1000 kr
            </li>
            <li className="flex items-center gap-1.5">
              <Coffee className="h-3 w-3 text-neutral-500" /> 14-dagers stim → kaffe-gavekort
            </li>
            <li className="flex items-center gap-1.5">
              <HeartHandshake className="h-3 w-3 text-green-600" /> 100% bestått → «Verneombud of the Year»
            </li>
          </ul>
        </Card>
      </aside>
    </div>
  )
}

function VersjonerTab({ course }: { course: Course }) {
  // Derive a synthetic version list from course meta until version history loads asynchronously.
  const major = course.localeVersionMajor ?? course.courseVersion ?? 1
  const minor = course.localeVersionMinor ?? course.courseVersionMinor ?? 0
  const publishedAt = course.localeVersionPublishedAt ?? course.updatedAt
  const versions = [
    {
      v: `${major}.${minor}`,
      current: true,
      when: formatDateNb(publishedAt),
      by: 'System',
      notes: course.localeChangeNotesMd ?? 'Aktiv versjon. Endringslogg ikke registrert.',
    },
    ...(major > 1
      ? [
          {
            v: `${major - 1}.0`,
            current: false,
            when: formatDateNb(course.createdAt),
            by: 'System',
            notes: 'Tidligere stor versjon — opprinnelig publisering.',
          },
        ]
      : []),
  ]
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Versjonshistorikk</h3>
      <p className="mt-0.5 text-[11px] text-neutral-500">
        Sertifikater er knyttet til versjonen som var aktiv ved fullføring.
      </p>
      <ol className="relative mt-4 border-l-2 border-neutral-200 pl-6">
        {versions.map((v, i) => (
          <li key={i} className="relative mb-4 last:mb-0">
            <span
              className={[
                'absolute -left-[34px] top-0 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-white',
                v.current ? 'bg-[#1a3d32] text-white' : 'bg-neutral-200 text-neutral-600',
              ].join(' ')}
            >
              <GitBranch className="h-3.5 w-3.5" />
            </span>
            <div
              className={[
                'rounded-md border p-3',
                v.current ? 'border-[#1a3d32]/30 bg-[#e7efe9]/30' : 'border-neutral-200/80 bg-white',
              ].join(' ')}
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-baseline justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tabular-nums text-neutral-900">v{v.v}</span>
                  {v.current ? (
                    <span className="rounded bg-[#1a3d32] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                      Aktiv
                    </span>
                  ) : null}
                </div>
                <span className="text-[10px] tabular-nums text-neutral-500">
                  {v.when} · {v.by}
                </span>
              </div>
              <p className="mt-1 text-[12px] text-neutral-700">{v.notes}</p>
              {!v.current ? (
                <Button variant="ghost" size="sm" className="mt-2 !gap-0 !border-transparent !bg-transparent !px-0 !py-0 text-[10px] font-medium text-neutral-500 hover:text-neutral-800">
                  Sammenlign med aktiv ›
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function AuditTab({
  course,
  progress,
}: {
  course: Course
  progress: CourseProgress[]
}) {
  const events = useMemo(() => {
    const items: { when: string; actor: string; action: string; detail: string; icon: 'Check' | 'Trophy' | 'UserPlus' | 'Send' | 'Bell' | 'CalendarPlus'; tone: 'success' | 'neutral' | 'warning' }[] = []
    for (const p of progress) {
      if (p.completedAt) {
        items.push({
          when: formatDateTimeNb(p.completedAt),
          actor: p.learnerName ?? '—',
          action: 'fullførte kurset',
          detail: `Sertifikat utstedt for v${(p.startedVersionMajor ?? 1)}.${(p.startedVersionMinor ?? 0)}`,
          icon: 'Trophy',
          tone: 'success',
        })
      }
      items.push({
        when: formatDateTimeNb(p.startedAt),
        actor: 'System',
        action: 'meldte inn',
        detail: `${p.learnerName ?? '—'} meldt på`,
        icon: 'UserPlus',
        tone: 'neutral',
      })
    }
    items.push({
      when: formatDateTimeNb(course.localeVersionPublishedAt ?? course.updatedAt),
      actor: 'System',
      action: 'publisert',
      detail: `v${course.localeVersionMajor ?? 1}.${course.localeVersionMinor ?? 0} publisert`,
      icon: 'Send',
      tone: 'success',
    })
    items.push({
      when: formatDateTimeNb(course.createdAt),
      actor: 'System',
      action: 'opprettet',
      detail: 'Kurs opprettet i katalogen',
      icon: 'CalendarPlus',
      tone: 'neutral',
    })
    return items.sort((a, b) => (a.when < b.when ? 1 : -1))
  }, [course, progress])

  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Audit-logg</h3>
      <p className="mt-0.5 text-[11px] text-neutral-500">
        Alle hendelser knyttet til kurset — påmeldinger, fullføringer, sertifikater, versjoner. Lagres i 10 år.
      </p>
      <ol className="relative mt-4 border-l-2 border-neutral-200 pl-6">
        {events.length === 0 ? (
          <li className="text-sm text-neutral-500">Ingen hendelser ennå.</li>
        ) : null}
        {events.map((e, i) => (
          <AuditRow key={i} event={e} />
        ))}
      </ol>
    </div>
  )
}

function AuditRow({
  event,
}: {
  event: { when: string; actor: string; action: string; detail: string; icon: 'Check' | 'Trophy' | 'UserPlus' | 'Send' | 'Bell' | 'CalendarPlus'; tone: 'success' | 'neutral' | 'warning' }
}) {
  const iconNode = (() => {
    switch (event.icon) {
      case 'Check':
        return <Check className="h-3.5 w-3.5" />
      case 'Trophy':
        return <Trophy className="h-3.5 w-3.5" />
      case 'UserPlus':
        return <UserPlus className="h-3.5 w-3.5" />
      case 'Send':
        return <Send className="h-3.5 w-3.5" />
      case 'Bell':
        return <Bell className="h-3.5 w-3.5" />
      default:
        return <CalendarPlus className="h-3.5 w-3.5" />
    }
  })()
  const tone =
    event.tone === 'success'
      ? { bg: 'bg-green-100', fg: 'text-green-700' }
      : event.tone === 'warning'
        ? { bg: 'bg-amber-100', fg: 'text-amber-700' }
        : { bg: 'bg-neutral-100', fg: 'text-neutral-600' }
  return (
    <li className="relative mb-4 last:mb-0">
      <span
        className={['absolute -left-[34px] top-0 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-white', tone.bg, tone.fg].join(' ')}
      >
        {iconNode}
      </span>
      <div className="rounded-md border border-neutral-200/80 bg-white p-3" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-xs">
            <span className="font-semibold text-neutral-900">{event.actor}</span>
            <span className="text-neutral-500"> {event.action}</span>
          </div>
          <span className="shrink-0 text-[10px] tabular-nums text-neutral-400">{event.when}</span>
        </div>
        <p className="mt-1 text-[12px] text-neutral-700">{event.detail}</p>
      </div>
    </li>
  )
}

