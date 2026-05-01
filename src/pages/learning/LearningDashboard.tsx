import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Flame } from 'lucide-react'
import { useMemo } from 'react'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { CREAM, PIN_GREEN } from '../../components/learning/LearningLayout'
import { Button } from '../../components/ui/Button'
import { ComplianceBanner } from '../../components/ui/ComplianceBanner'
import { LayoutScoreStatRow } from '../../components/layout/LayoutScoreStatRow'
import type { LayoutScoreStatItem } from '../../components/layout/platformLayoutKit'
import { ModuleSectionCard } from '../../components/module'

function CompletionRings({
  publishedPct,
  enrolledPct,
  certPct,
}: {
  publishedPct: number
  enrolledPct: number
  certPct: number
}) {
  const size = 112
  const stroke = 10
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p1 = Math.min(1, publishedPct)
  const p2 = Math.min(1, enrolledPct)
  const p3 = Math.min(1, certPct)
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e5e5" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={PIN_GREEN}
          strokeWidth={stroke}
          strokeDasharray={`${c * p1} ${c}`}
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r - stroke - 4}
          fill="none"
          stroke="#93c5af"
          strokeWidth={stroke - 2}
          strokeDasharray={`${c * p2} ${c}`}
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r - 2 * stroke - 4}
          fill="none"
          stroke="#fcd34d"
          strokeWidth={stroke - 4}
          strokeDasharray={`${c * p3} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="text-center text-[10px] text-neutral-500">
        <div>
          <span className="inline-block size-2 rounded-full" style={{ backgroundColor: PIN_GREEN }} /> Publisert
        </div>
        <div>
          <span className="inline-block size-2 rounded-full bg-emerald-300" /> Påmeldt
        </div>
        <div>
          <span className="inline-block size-2 rounded-full bg-amber-300" /> Sertifikat
        </div>
      </div>
    </div>
  )
}

export function LearningDashboard() {
  const {
    stats,
    courses,
    streakWeeks,
    pendingReviews,
    departmentLeaderboard,
    dismissReview,
    isCourseUnlocked,
  } = useLearning()
  const { can } = useOrgSetupContext()
  const canManage = can('learning.manage')
  const published = courses.filter((c) => c.status === 'published')
  const maxCourses = Math.max(1, stats.totalCourses || 1)
  const ringPublished = stats.published / maxCourses
  const ringEnrolled = Math.min(1, stats.enrolled / maxCourses)
  const ringCert = Math.min(1, stats.certs / Math.max(1, stats.enrolled || 1))

  const statItems: LayoutScoreStatItem[] = useMemo(
    () => [
      { big: String(stats.published), title: 'Publiserte kurs', sub: 'I organisasjonen' },
      { big: String(stats.drafts), title: 'Utkast', sub: 'Ikke publisert' },
      { big: String(stats.certs), title: 'Utstedte sertifikater', sub: 'Kursbevis' },
      { big: String(stats.enrolled), title: 'Påmeldinger', sub: 'Fremdriftsrader' },
    ],
    [stats.published, stats.drafts, stats.certs, stats.enrolled],
  )

  const statLinks = useMemo(
    () => ({
      0: (
        <Link to="/learning/courses" className="mt-2 inline-block text-xs font-medium text-emerald-800 hover:underline">
          Åpne kurs
        </Link>
      ),
      1: (
        <Link to="/learning/courses" className="mt-2 inline-block text-xs font-medium text-emerald-800 hover:underline">
          Åpne kurs
        </Link>
      ),
      2: (
        <Link to="/learning/certifications" className="mt-2 inline-block text-xs font-medium text-emerald-800 hover:underline">
          Se sertifikater
        </Link>
      ),
      3: (
        <Link to="/learning/participants" className="mt-2 inline-block text-xs font-medium text-emerald-800 hover:underline">
          Se deltakere
        </Link>
      ),
    }),
    [],
  )

  return (
    <div className="space-y-8">
      <ModuleSectionCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1
              className="font-serif text-3xl font-semibold tracking-tight text-[#2D403A] md:text-4xl"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
            >
              God dag
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              Kurs, mikromoduler og sertifiseringer på ett sted.
            </p>
            {streakWeeks != null && streakWeeks > 0 ? (
              <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-sm font-medium text-orange-950">
                <Flame className="size-4 text-orange-600" aria-hidden />
                Læringsstreak: {streakWeeks} {streakWeeks === 1 ? 'uke' : 'uker'}
              </p>
            ) : null}
          </div>
          {canManage && (
            <Link
              to="/learning/courses"
              className="rounded-full border px-4 py-2 text-sm font-medium text-[#2D403A] hover:bg-white"
              style={{ borderColor: `${PIN_GREEN}40`, backgroundColor: CREAM }}
            >
              Administrer
            </Link>
          )}
        </div>
      </ModuleSectionCard>

      <div className="overflow-hidden rounded-lg">
        <ComplianceBanner title="Opplæring og dokumentasjon">
          AML § 3-1 · § 6-5 · IK-forskriften § 5 — oversikt over opplæring i organisasjonen.{' '}
          <Link to="/learning/compliance" className="font-medium text-white underline">
            Se samsvar
          </Link>
        </ComplianceBanner>
      </div>

      <ModuleSectionCard>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_200px]">
          <LayoutScoreStatRow items={statItems} columns={4} variant="compact" gap="tight" childrenByIndex={statLinks} />
          <div className="flex items-center justify-center rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-4">
            <CompletionRings publishedPct={ringPublished} enrolledPct={ringEnrolled} certPct={ringCert} />
          </div>
        </div>
      </ModuleSectionCard>

      {pendingReviews.length > 0 ? (
        <ModuleSectionCard>
          <section>
            <h2 className="font-serif text-lg font-semibold text-[#2D403A]">Gjentakelse (intervalltrening)</h2>
            <p className="mt-1 text-sm text-neutral-700">
              Du svarte feil på disse spørsmålene tidligere. En kort repetisjon styrker hukommelsen.
            </p>
            <ul className="mt-3 space-y-2">
              {pendingReviews.slice(0, 5).map((r) => {
                const c = courses.find((x) => x.id === r.courseId)
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 text-sm"
                  >
                    <span className="text-neutral-800">
                      {c?.title ?? r.courseId} — modul {r.moduleId.slice(0, 8)}…
                    </span>
                    <div className="flex gap-2">
                      <Link
                        to={`/learning/play/${r.courseId}?module=${encodeURIComponent(r.moduleId)}`}
                        className="text-xs font-medium text-emerald-800 underline"
                      >
                        Repeter
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs text-neutral-500 hover:text-neutral-800"
                        onClick={() => void dismissReview(r.id)}
                      >
                        Avvis
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        </ModuleSectionCard>
      ) : null}

      {departmentLeaderboard.length > 0 ? (
        <ModuleSectionCard>
          <section>
            <h2 className="font-serif text-lg font-semibold text-[#2D403A]">Avdelinger (aggregert)</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Vi rangerer ikke enkeltpersoner — kun avdelingens gjennomsnittlige kursgjennomføring (publiserte kurs).
              Koble brukere til avdeling i profilen for full effekt. Avdelinger med færre enn fem medarbeidere vises ikke
              av personvernhensyn (GDPR art. 5).
            </p>
            <ul className="mt-4 space-y-2">
              {departmentLeaderboard.map((d) => (
                <li
                  key={d.departmentId}
                  className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-[#2D403A]">{d.departmentName}</span>
                  <span className="tabular-nums text-neutral-700">
                    {d.avgCompletionPct}% <span className="text-xs text-neutral-500">({d.memberCount} brukere)</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </ModuleSectionCard>
      ) : null}

      <ModuleSectionCard>
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold text-[#2D403A]">{canManage ? 'Publiserte kurs' : 'Anbefalte kurs'}</h2>
            {canManage && (
              <Link to="/learning/courses" className="text-sm font-medium text-emerald-800 hover:underline">
                + Opprett kurs
              </Link>
            )}
          </div>
          <div className="space-y-3">
            {published.slice(0, 5).map((c) => {
              const unlocked = isCourseUnlocked(c.id)
              return (
                <div
                  key={c.id}
                  className={`block rounded-lg border border-neutral-200/80 bg-neutral-50/40 p-4 transition-colors ${
                    unlocked ? 'hover:bg-neutral-50' : 'opacity-75'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      {unlocked ? (
                        <Link to={`/learning/courses/${c.id}`} className="font-serif text-lg font-semibold text-[#2D403A] hover:underline">
                          {c.title}
                        </Link>
                      ) : (
                        <p className="font-serif text-lg font-semibold text-neutral-500">{c.title}</p>
                      )}
                      <p className="mt-1 text-sm text-neutral-600 line-clamp-2">{c.description}</p>
                      {!unlocked ? (
                        <p className="mt-2 text-xs font-medium text-amber-800">Låst — fullfør forutsetningskurs først.</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
                          {c.status.toUpperCase()}
                        </span>
                        {c.tags.map((t) => (
                          <span key={t} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-sm text-neutral-500">
                      <span className="flex items-center gap-1">
                        <BookOpen className="size-4" />
                        {`${c.modules.length} ${c.modules.length === 1 ? 'modul' : 'moduler'}`}
                      </span>
                      {unlocked ? (
                        <Link
                          to={`/learning/play/${c.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:underline"
                        >
                          Start <ArrowRight className="size-3.5" />
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
            {published.length === 0 ? (
              <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50/60 p-8 text-center text-sm text-neutral-600">
                {canManage ? 'Ingen publiserte kurs ennå.' : 'Ingen kurs tilgjengelig ennå.'}
              </p>
            ) : null}
          </div>
        </section>
      </ModuleSectionCard>
    </div>
  )
}
