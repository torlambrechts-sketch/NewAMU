// Alternative 4 — "Klasserom". LMS-inspired layout: a visual lesson-rail on the
// left (each module is a thumbnail card), the active lesson in the middle, and
// a community/discussion panel on the right. Inspiration sources: Easygenerator
// and Coassemble. Adds peer presence + threaded comments to give the course a
// social layer that the other three designs intentionally avoid.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  Compass,
  FileText,
  HelpCircle,
  MessageSquare,
  PenLine,
  Send,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react'
import {
  MOCK_COURSE,
  moduleKindLabel,
  moduleTimeLabel,
  type MockBadgeIcon,
  type MockCourse,
  type MockDiscussionThread,
  type MockModule,
  type MockPeer,
} from './mockCourse'

const ACCENT = '#6d28d9'
const ACCENT_SOFT = '#ede9fe'

const KIND_ICON: Record<MockModule['kind'], LucideIcon> = {
  text: FileText,
  quiz: HelpCircle,
  reflection: PenLine,
}

const BADGE_ICON: Record<MockBadgeIcon, LucideIcon> = {
  Compass,
  ShieldCheck,
  Award,
  Trophy,
}

export function PlatformCoursePlayerKlasseromPage() {
  const [idx, setIdx] = useState(0)
  const [completed, setCompleted] = useState<Record<string, boolean>>({})
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [reflections, setReflections] = useState<Record<string, string>>({})
  const [finished, setFinished] = useState(false)
  const [draftComment, setDraftComment] = useState('')

  const course = MOCK_COURSE
  const mod = course.modules[idx]
  const total = course.modules.length
  const completedCount = Object.values(completed).filter(Boolean).length
  const earnedPoints = course.modules.reduce((sum, m) => (completed[m.id] ? sum + m.points : sum), 0)
  const earnedBadges = course.badges.filter((b) => completed[b.awardedAtModuleId])
  const peerLookup = useMemo(
    () => Object.fromEntries(course.peers.map((p) => [p.id, p])),
    [course.peers],
  )

  const quizScore = useMemo(() => {
    if (mod.kind !== 'quiz') return null
    const right = mod.questions.filter((q) => quizAnswers[q.id] === q.correctIndex).length
    return { right, total: mod.questions.length, ratio: right / mod.questions.length }
  }, [mod, quizAnswers])

  const canAdvance = (() => {
    if (mod.kind === 'quiz') return quizSubmitted && quizScore !== null && quizScore.ratio >= 2 / 3
    if (mod.kind === 'reflection')
      return mod.prompts.every((p) => (reflections[p.id] ?? '').trim().length >= 10)
    return true
  })()

  function advance() {
    setCompleted((c) => ({ ...c, [mod.id]: true }))
    if (idx < total - 1) {
      setIdx(idx + 1)
      setQuizSubmitted(false)
    } else {
      setFinished(true)
    }
  }

  function back() {
    if (idx > 0) {
      setIdx(idx - 1)
      setQuizSubmitted(false)
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'ArrowLeft') back()
      if (e.key === 'ArrowRight' && canAdvance) advance()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, canAdvance])

  const moduleDiscussion = course.discussion.filter((t) => t.moduleId === mod.id)

  return (
    <div className="-mx-4 -my-8 md:-mx-8">
      <div className="min-h-[calc(100vh-100px)] bg-[#f3eefb] text-[#1f2421]">
        {/* Top utility band — like a tiny LMS chrome */}
        <div className="border-b border-[#e2d6f3] bg-white">
          <div className="mx-auto flex max-w-[1340px] flex-wrap items-center justify-between gap-3 px-6 py-3">
            <Link
              to="/platform-admin/course-player"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1f2421]/70 hover:text-[#1f2421]"
            >
              <ChevronLeft className="size-3.5" /> Tilbake til oversikt
            </Link>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#1f2421]/70">
              <span className="font-semibold text-[#0f1311]">{course.title}</span>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold"
                style={{ backgroundColor: ACCENT_SOFT, color: ACCENT }}
              >
                <Sparkles className="size-3" /> {earnedPoints} / {course.totalPoints} XP
              </span>
              <span className="text-[#1f2421]/55">
                {completedCount} av {total} leksjoner fullført
              </span>
            </div>
          </div>
        </div>

        {/* Three-column LMS layout */}
        <div className="mx-auto grid max-w-[1340px] grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[200px_minmax(0,1fr)_320px]">
          {/* Left: visual lesson rail */}
          <LessonRail
            course={course}
            currentIdx={idx}
            completed={completed}
            onPick={(i) => {
              setIdx(i)
              setQuizSubmitted(false)
            }}
          />

          {/* Middle: hero + active lesson + module accordion */}
          {!finished ? (
            <section className="space-y-5">
              <LessonHero mod={mod} course={course} idx={idx} />
              <article className="rounded-3xl border border-[#e2d6f3] bg-white p-7 shadow-sm">
                <KlasseromBody
                  mod={mod}
                  quizAnswers={quizAnswers}
                  setQuizAnswers={setQuizAnswers}
                  quizSubmitted={quizSubmitted}
                  setQuizSubmitted={setQuizSubmitted}
                  quizScore={quizScore}
                  reflections={reflections}
                  setReflections={setReflections}
                />
              </article>

              <ModuleAccordion
                course={course}
                currentIdx={idx}
                completed={completed}
                onPick={(i) => {
                  setIdx(i)
                  setQuizSubmitted(false)
                }}
              />

              <FooterPager
                idx={idx}
                total={total}
                canAdvance={canAdvance}
                onBack={back}
                onAdvance={advance}
              />
            </section>
          ) : (
            <section>
              <KlasseromFinished
                course={course}
                earnedPoints={earnedPoints}
                earnedBadges={earnedBadges}
                onRestart={() => {
                  setFinished(false)
                  setIdx(0)
                  setCompleted({})
                  setQuizAnswers({})
                  setQuizSubmitted(false)
                  setReflections({})
                }}
              />
            </section>
          )}

          {/* Right: community + certs */}
          <aside className="space-y-5">
            <PeerPresence peers={course.peers} />
            <CertificationCard course={course} completed={completed} />
            {!finished ? (
              <DiscussionPanel
                threads={moduleDiscussion}
                peerLookup={peerLookup}
                modTitle={mod.title}
                draftComment={draftComment}
                setDraftComment={setDraftComment}
              />
            ) : null}
          </aside>
        </div>

        <KlasseromDesignNotes />
      </div>
    </div>
  )
}

function LessonRail({
  course,
  currentIdx,
  completed,
  onPick,
}: {
  course: MockCourse
  currentIdx: number
  completed: Record<string, boolean>
  onPick: (i: number) => void
}) {
  return (
    <nav
      aria-label="Leksjoner"
      className="space-y-2 lg:sticky lg:top-6 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"
    >
      <p className="px-1 text-[10px] font-semibold uppercase tracking-[2px] text-[#1f2421]/55">
        Leksjoner
      </p>
      <ol className="space-y-2">
        {course.modules.map((m, i) => {
          const done = completed[m.id]
          const isCurrent = i === currentIdx
          const Icon = KIND_ICON[m.kind]
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onPick(i)}
                aria-current={isCurrent ? 'step' : undefined}
                className={`group relative flex w-full flex-col gap-2 overflow-hidden rounded-2xl border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d28d9] ${
                  isCurrent
                    ? 'border-[#6d28d9] bg-[#1f1232] shadow-lg shadow-[#6d28d9]/20'
                    : done
                      ? 'border-[#e2d6f3] bg-[#2a1f3f] text-white/90'
                      : 'border-[#e2d6f3] bg-[#5a4a7a]/85 text-white/85'
                }`}
              >
                {/* Subtle texture */}
                <span
                  className="pointer-events-none absolute inset-0 opacity-40"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08), transparent 50%), radial-gradient(circle at 80% 80%, rgba(0,0,0,0.15), transparent 60%)',
                  }}
                  aria-hidden
                />
                <div className="relative flex items-center justify-between">
                  <span
                    className={`flex size-7 items-center justify-center rounded-lg ${
                      isCurrent
                        ? 'bg-[#c4b5fd] text-[#1f1232]'
                        : done
                          ? 'bg-[#6d28d9]/40 text-white'
                          : 'bg-white/15 text-white'
                    }`}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  {done ? (
                    <span
                      aria-label="Fullført"
                      className="flex size-5 items-center justify-center rounded-full bg-white/15 text-white"
                    >
                      <Check className="size-3" />
                    </span>
                  ) : null}
                </div>
                <div className="relative">
                  <p className="text-[10px] font-semibold uppercase tracking-[1.5px] text-white/65">
                    Modul {i + 1}
                  </p>
                  <p className="text-[13px] font-semibold leading-tight text-white">{m.title}</p>
                  <p className="mt-1 text-[10px] text-white/65">
                    {moduleKindLabel(m.kind)} · {moduleTimeLabel(m.durationMinutes)}
                  </p>
                </div>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function LessonHero({
  mod,
  course,
  idx,
}: {
  mod: MockModule
  course: MockCourse
  idx: number
}) {
  const Icon = KIND_ICON[mod.kind]
  const badge = mod.badgeOnComplete
    ? course.badges.find((b) => b.id === mod.badgeOnComplete)
    : null
  return (
    <header
      className="relative overflow-hidden rounded-3xl border border-[#e2d6f3] p-7 text-white shadow-lg"
      style={{
        background:
          'linear-gradient(135deg, #1f1232 0%, #4a2c8c 55%, #6d28d9 100%)',
      }}
    >
      <span
        className="pointer-events-none absolute -right-6 -top-6 size-40 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(196,181,253,0.35), transparent 70%)',
        }}
        aria-hidden
      />
      <div className="relative space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white/15 text-white">
            <Icon className="size-4" />
          </span>
          <p className="text-[11px] font-semibold uppercase tracking-[2.5px] text-white/65">
            Leksjon {idx + 1} av {course.modules.length} · {moduleKindLabel(mod.kind)}
          </p>
        </div>
        <h1 className="text-[26px] font-semibold leading-tight">{mod.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/80">
          <span>{moduleTimeLabel(mod.durationMinutes)}</span>
          <span aria-hidden>·</span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 font-semibold">
            +{mod.points} XP
          </span>
          {badge ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 font-semibold">
              <Trophy className="size-3" /> Låser opp «{badge.label}»
            </span>
          ) : null}
          {mod.lawRefs.map((r) => (
            <span
              key={r}
              className="rounded-sm bg-black/25 px-1.5 py-0.5 font-mono text-[11px]"
            >
              {r}
            </span>
          ))}
        </div>
      </div>
    </header>
  )
}

function ModuleAccordion({
  course,
  currentIdx,
  completed,
  onPick,
}: {
  course: MockCourse
  currentIdx: number
  completed: Record<string, boolean>
  onPick: (i: number) => void
}) {
  return (
    <details
      open
      className="rounded-3xl border border-[#e2d6f3] bg-white shadow-sm"
    >
      <summary className="flex cursor-pointer items-center justify-between rounded-3xl px-5 py-4 text-sm font-semibold text-[#0f1311]">
        <span className="inline-flex items-center gap-2">
          <BookOpen className="size-4" style={{ color: ACCENT }} />
          Hele kurset · {course.modules.length} leksjoner
        </span>
        <span className="text-[11px] font-medium text-[#1f2421]/55">Klikk for å bla</span>
      </summary>
      <ul className="divide-y divide-[#e2d6f3] border-t border-[#e2d6f3]">
        {course.modules.map((m, i) => {
          const done = completed[m.id]
          const isCurrent = i === currentIdx
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onPick(i)}
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d28d9] ${
                  isCurrent ? 'bg-[#f5f0fd]' : 'hover:bg-[#f9f4ff]'
                }`}
              >
                <span className="flex items-center gap-3">
                  {done ? (
                    <Check className="size-4" style={{ color: ACCENT }} />
                  ) : (
                    <span
                      className={`flex size-4 items-center justify-center rounded-full border text-[10px] font-semibold ${
                        isCurrent
                          ? 'border-[#6d28d9] text-[#6d28d9]'
                          : 'border-[#dcd4be] text-[#1f2421]/55'
                      }`}
                    >
                      {i + 1}
                    </span>
                  )}
                  <span
                    className={
                      isCurrent
                        ? 'font-semibold text-[#6d28d9]'
                        : done
                          ? 'text-[#0f1311]'
                          : 'text-[#1f2421]/85'
                    }
                  >
                    Leksjon {i + 1}: {m.title}
                  </span>
                </span>
                <span className="text-[11px] text-[#1f2421]/55">
                  {moduleKindLabel(m.kind)} · {moduleTimeLabel(m.durationMinutes)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </details>
  )
}

function FooterPager({
  idx,
  total,
  canAdvance,
  onBack,
  onAdvance,
}: {
  idx: number
  total: number
  canAdvance: boolean
  onBack: () => void
  onAdvance: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onBack}
        disabled={idx === 0}
        aria-label="Forrige leksjon (pil venstre)"
        className="inline-flex items-center gap-2 rounded-full border border-[#e2d6f3] bg-white px-4 py-2 text-sm font-medium text-[#1f2421] hover:bg-[#f9f4ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ArrowLeft className="size-4" /> Forrige
      </button>
      <p className="text-xs text-[#1f2421]/55">
        Leksjon {idx + 1} av {total}
      </p>
      <button
        type="button"
        onClick={onAdvance}
        disabled={!canAdvance}
        className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white shadow-md transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-40"
        style={{ backgroundColor: ACCENT }}
      >
        {idx === total - 1 ? 'Fullfør kurset' : 'Fortsett'}
        <ArrowRight className="size-4" />
      </button>
    </div>
  )
}

function PeerPresence({ peers }: { peers: MockPeer[] }) {
  return (
    <div className="rounded-3xl border border-[#e2d6f3] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[2px] text-[#1f2421]/70">
        <Users className="size-3.5" style={{ color: ACCENT }} />
        Påmeldte ({peers.length})
      </div>
      <p className="mt-1 text-[11px] text-[#1f2421]/55">
        Andre fra Pundit Invest som tar kurset.
      </p>
      <ul className="mt-3 grid grid-cols-4 gap-2">
        {peers.map((p) => (
          <li key={p.id}>
            <span
              title={`${p.name} — ${p.role}`}
              className="flex aspect-square items-center justify-center rounded-full text-[11px] font-semibold text-white"
              style={{ backgroundColor: p.tint }}
            >
              {p.initials}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CertificationCard({
  course,
  completed,
}: {
  course: MockCourse
  completed: Record<string, boolean>
}) {
  return (
    <div className="rounded-3xl border border-[#e2d6f3] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[2px] text-[#1f2421]/70">
        <Trophy className="size-3.5" style={{ color: ACCENT }} />
        Sertifisering
      </div>
      <p className="mt-1 text-[11px] text-[#1f2421]/55">
        Tre merker å låse opp i dette kurset.
      </p>
      <ul className="mt-3 space-y-2">
        {course.badges.map((b) => {
          const earned = !!completed[b.awardedAtModuleId]
          const Icon = BADGE_ICON[b.icon]
          return (
            <li
              key={b.id}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition ${
                earned ? 'border-[#6d28d9]/30 bg-[#f5f0fd]' : 'border-[#e2d6f3] bg-white'
              }`}
            >
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                  earned
                    ? 'bg-[#6d28d9] text-white'
                    : 'border border-dashed border-[#c4b5fd] text-[#1f2421]/35'
                }`}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p
                  className={`text-xs font-semibold ${
                    earned ? 'text-[#0f1311]' : 'text-[#1f2421]/45'
                  }`}
                >
                  {b.label}
                </p>
                <p className="truncate text-[10px] text-[#1f2421]/55">{b.description}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function DiscussionPanel({
  threads,
  peerLookup,
  modTitle,
  draftComment,
  setDraftComment,
}: {
  threads: MockDiscussionThread[]
  peerLookup: Record<string, MockPeer>
  modTitle: string
  draftComment: string
  setDraftComment: (v: string) => void
}) {
  return (
    <div className="rounded-3xl border border-[#e2d6f3] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[2px] text-[#1f2421]/70">
        <MessageSquare className="size-3.5" style={{ color: ACCENT }} />
        Diskusjon ({threads.length})
      </div>
      <p className="mt-1 text-[11px] text-[#1f2421]/55">Knyttet til «{modTitle}».</p>

      <ul className="mt-4 space-y-4">
        {threads.length === 0 ? (
          <li className="rounded-xl border border-dashed border-[#e2d6f3] px-3 py-4 text-center text-[12px] text-[#1f2421]/55">
            Ingen diskusjon enda — start gjerne en tråd nedenfor.
          </li>
        ) : (
          threads.map((t) => (
            <li key={t.id} className="space-y-2">
              <CommentBubble peer={peerLookup[t.authorId]} time={t.postedAt} body={t.body} />
              <div className="flex items-center gap-3 pl-9 text-[11px] text-[#1f2421]/55">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 hover:bg-[#f5f0fd]"
                >
                  <ThumbsUp className="size-3" /> {t.upvotes}
                </button>
                <span>{t.replies.length} svar</span>
              </div>
              {t.replies.length > 0 ? (
                <ul className="ml-6 space-y-2 border-l-2 border-[#e2d6f3] pl-4">
                  {t.replies.map((r) => (
                    <li key={r.id}>
                      <CommentBubble
                        peer={peerLookup[r.authorId]}
                        time={r.postedAt}
                        body={r.body}
                        isLearningManager={r.isLearningManager}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))
        )}
      </ul>

      <form
        className="mt-5 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setDraftComment('')
        }}
      >
        <input
          type="text"
          value={draftComment}
          onChange={(e) => setDraftComment(e.target.value)}
          placeholder="Skriv en kommentar …"
          aria-label="Ny kommentar"
          className="flex-1 rounded-full border border-[#e2d6f3] bg-[#fdfcf7] px-3 py-2 text-[13px] text-[#1f2421] placeholder:text-[#1f2421]/40 focus:border-[#6d28d9] focus:outline-none focus:ring-2 focus:ring-[#6d28d9]/15"
        />
        <button
          type="submit"
          aria-label="Publiser kommentar"
          disabled={!draftComment.trim()}
          className="flex size-9 items-center justify-center rounded-full text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ backgroundColor: ACCENT }}
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  )
}

function CommentBubble({
  peer,
  time,
  body,
  isLearningManager,
}: {
  peer: MockPeer | undefined
  time: string
  body: string
  isLearningManager?: boolean
}) {
  if (!peer) return null
  return (
    <div className="flex items-start gap-2.5">
      <span
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
        style={{ backgroundColor: peer.tint }}
      >
        {peer.initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="font-semibold text-[#0f1311]">{peer.name}</span>
          {isLearningManager ? (
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white"
              style={{ backgroundColor: ACCENT }}
            >
              Læringsleder
            </span>
          ) : null}
          <span className="text-[#1f2421]/55">· {time}</span>
        </p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-[#1f2421]">{body}</p>
      </div>
    </div>
  )
}

function KlasseromBody({
  mod,
  quizAnswers,
  setQuizAnswers,
  quizSubmitted,
  setQuizSubmitted,
  quizScore,
  reflections,
  setReflections,
}: {
  mod: MockModule
  quizAnswers: Record<string, number>
  setQuizAnswers: (fn: (prev: Record<string, number>) => Record<string, number>) => void
  quizSubmitted: boolean
  setQuizSubmitted: (v: boolean) => void
  quizScore: { right: number; total: number; ratio: number } | null
  reflections: Record<string, string>
  setReflections: (fn: (prev: Record<string, string>) => Record<string, string>) => void
}) {
  if (mod.kind === 'text') {
    return (
      <div className="space-y-5">
        <p className="text-lg leading-relaxed text-[#0f1311]">{mod.lead}</p>
        {mod.body.map((p, i) => (
          <p key={i} className="text-[16px] leading-[1.7] text-[#2a2f2b]">
            {p}
          </p>
        ))}
        <div
          className="mt-2 rounded-2xl p-5"
          style={{ backgroundColor: `${ACCENT}0a`, border: `1px solid ${ACCENT}22` }}
        >
          <div
            className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[2px]"
            style={{ color: ACCENT }}
          >
            <Award className="size-3.5" /> Nøkkelpunkter
          </div>
          <ul className="mt-3 space-y-2">
            {mod.keyTakeaways.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[#1f2421]">
                <Check className="mt-0.5 size-4 shrink-0" style={{ color: ACCENT }} />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  if (mod.kind === 'quiz') {
    return (
      <div className="space-y-5">
        <p className="text-[15px] leading-relaxed text-[#1f2421]">{mod.intro}</p>
        {mod.questions.map((q, qi) => {
          const picked = quizAnswers[q.id]
          return (
            <fieldset key={q.id} className="space-y-2.5">
              <legend className="text-base font-semibold text-[#0f1311]">
                {qi + 1}. {q.question}
              </legend>
              <div className="space-y-1.5">
                {q.options.map((opt, oi) => {
                  const selected = picked === oi
                  const right = quizSubmitted && oi === q.correctIndex
                  const wrong = quizSubmitted && selected && oi !== q.correctIndex
                  return (
                    <label
                      key={oi}
                      className={`flex cursor-pointer items-start gap-2.5 rounded-xl border bg-white px-3 py-2.5 text-sm transition ${
                        right
                          ? 'border-[#6d28d9] bg-[#f5f0fd]'
                          : wrong
                            ? 'border-[#b3382a] bg-[#b3382a]/5'
                            : selected
                              ? 'border-[#6d28d9]'
                              : 'border-[#e2d6f3] hover:border-[#6d28d9]/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={selected}
                        onChange={() => setQuizAnswers((p) => ({ ...p, [q.id]: oi }))}
                        disabled={quizSubmitted}
                        className="mt-0.5 size-4 accent-[#6d28d9]"
                      />
                      <span>{opt}</span>
                    </label>
                  )
                })}
              </div>
              {quizSubmitted ? (
                <p className="rounded-md bg-[#f5f0fd] px-3 py-2 text-[13px] leading-relaxed text-[#1f2421]">
                  {q.explanation}
                </p>
              ) : null}
            </fieldset>
          )
        })}

        {!quizSubmitted ? (
          <button
            type="button"
            onClick={() => setQuizSubmitted(true)}
            disabled={Object.keys(quizAnswers).length < mod.questions.length}
            className="inline-flex items-center gap-2 rounded-md border border-[#6d28d9] bg-white px-4 py-2 text-sm font-semibold text-[#6d28d9] hover:bg-[#f5f0fd] disabled:opacity-40"
          >
            Sjekk svarene
          </button>
        ) : quizScore ? (
          <div
            className={`flex items-start gap-3 rounded-lg border p-4 ${
              quizScore.ratio >= 2 / 3
                ? 'border-[#6d28d9]/30 bg-[#f5f0fd]'
                : 'border-[#b3382a]/30 bg-[#b3382a]/5'
            }`}
          >
            <CheckCircle2
              className="mt-0.5 size-5 shrink-0"
              style={{ color: quizScore.ratio >= 2 / 3 ? ACCENT : '#b3382a' }}
            />
            <p className="text-sm">
              <strong className="text-[#0f1311]">
                {quizScore.right} av {quizScore.total} riktig
              </strong>{' '}
              <span className="text-[#1f2421]/80">
                — {quizScore.ratio >= 2 / 3 ? 'bestått.' : 'ikke bestått ennå.'}
              </span>
            </p>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <p className="text-[15px] leading-relaxed text-[#1f2421]">{mod.intro}</p>
      {mod.prompts.map((p) => {
        const v = reflections[p.id] ?? ''
        return (
          <div key={p.id} className="space-y-2">
            <label htmlFor={p.id} className="block text-[15px] font-semibold text-[#0f1311]">
              {p.prompt}
            </label>
            <textarea
              id={p.id}
              value={v}
              onChange={(e) => setReflections((prev) => ({ ...prev, [p.id]: e.target.value }))}
              placeholder={p.placeholder}
              rows={3}
              className="w-full rounded-lg border border-[#e2d6f3] bg-white px-3 py-2.5 text-sm text-[#1f2421] placeholder:text-[#1f2421]/40 focus:border-[#6d28d9] focus:outline-none focus:ring-2 focus:ring-[#6d28d9]/20"
            />
            <p className="text-right text-[11px] text-[#1f2421]/50">
              {v.length} tegn · minst 10 for å gå videre
            </p>
          </div>
        )
      })}
    </div>
  )
}

function KlasseromFinished({
  course,
  earnedPoints,
  earnedBadges,
  onRestart,
}: {
  course: MockCourse
  earnedPoints: number
  earnedBadges: MockCourse['badges']
  onRestart: () => void
}) {
  return (
    <div
      role="status"
      className="space-y-5 rounded-3xl border border-[#e2d6f3] bg-white p-8 shadow-sm"
    >
      <div className="flex items-start gap-4">
        <span
          className="flex size-12 shrink-0 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: ACCENT }}
        >
          <Trophy className="size-5" />
        </span>
        <div className="flex-1 space-y-1">
          <h2 className="text-2xl font-semibold text-[#0f1311]">Kurset er fullført</h2>
          <p className="text-sm text-[#1f2421]/70">
            Du tjente <strong className="text-[#0f1311]">{earnedPoints} av {course.totalPoints}</strong>{' '}
            kompetansepoeng. Kursbeviset er signert og lagret på profilen din.
          </p>
        </div>
      </div>
      {earnedBadges.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-3">
          {earnedBadges.map((b) => {
            const Icon = BADGE_ICON[b.icon]
            return (
              <li
                key={b.id}
                className="flex flex-col items-center gap-2 rounded-2xl border border-[#e2d6f3] bg-[#f5f0fd] px-3 py-4 text-center"
              >
                <span
                  className="flex size-12 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: ACCENT }}
                >
                  <Icon className="size-5" />
                </span>
                <p className="text-xs font-semibold text-[#0f1311]">{b.label}</p>
                <p className="text-[11px] leading-snug text-[#1f2421]/65">{b.description}</p>
              </li>
            )
          })}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm"
          style={{ backgroundColor: ACCENT }}
        >
          Last ned kursbevis (PDF)
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex items-center gap-2 rounded-md border border-[#e2d6f3] bg-white px-4 py-2 text-sm font-medium text-[#1f2421] hover:bg-[#f9f4ff]"
        >
          Start på nytt
        </button>
      </div>
    </div>
  )
}

function KlasseromDesignNotes() {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t border-[#e2d6f3] bg-white">
      <div className="mx-auto max-w-[1340px] px-6 py-6">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs font-semibold uppercase tracking-[1.5px]"
          style={{ color: ACCENT }}
        >
          {open ? 'Skjul' : 'Vis'} designnotater
        </button>
        {open ? (
          <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-[#1f2421]/80 md:grid-cols-2">
            <li>
              <strong>Tre-kolonner som LMS-konvensjon.</strong> Leksjons-rail / aktiv leksjon /
              diskusjon er en mental modell folk allerede kjenner fra Easygenerator/Coassemble.
              Reduserer kognitiv friksjon ved første gangs bruk.
            </li>
            <li>
              <strong>Sosiale signaler øker fullføring.</strong> Avatar-grid og lærings­leder-svar
              gir et «andre tar dette kurset også»-anker (Cialdini, sosialt bevis) – og en synlig
              kanal for å spørre når man står fast.
            </li>
            <li>
              <strong>Sertifisering oppe og fremme.</strong> Tre merker vises før kurset starter –
              ikke som overraskelse etter siste leksjon. Det skaper forventning og motivasjon.
            </li>
            <li>
              <strong>Leksjons-rail som visuelt anker.</strong> Hver leksjon har eget kort med
              modul/leksjons-merking, ikoni og status. Mer engasjerende enn ren tekstliste i ToC.
            </li>
          </ul>
        ) : null}
      </div>
    </div>
  )
}
