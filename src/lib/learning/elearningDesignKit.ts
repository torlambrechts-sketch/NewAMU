// Shared design helpers for the new e-learning surfaces (hub, course detail,
// builder, viewer). Replaces the per-page polyfills that were drifting into
// the design-canvas implementation. All helpers are pure — no React, no hooks.
import type { Course, CourseProgress, ModuleContent, ModuleKind } from '../../types/learning'

/** Framework groups shown in the left rail and as pills on cards. */
export type ElearningFramework = {
  id: string
  label: string
  short: string
  icon: string
  color: string
}

export const ELEARNING_FRAMEWORKS: ElearningFramework[] = [
  { id: 'aml', label: 'Arbeidsmiljøloven', short: 'AML', icon: 'Scale', color: '#1a3d32' },
  { id: 'forskrift', label: 'Forskrifter', short: 'Forskrift', icon: 'BookOpen', color: '#5A9C76' },
  { id: 'gdpr', label: 'GDPR', short: 'GDPR', icon: 'Lock', color: '#6366F1' },
  { id: 'iso45001', label: 'ISO 45001', short: 'ISO 45001', icon: 'BadgeCheck', color: '#2563EB' },
  { id: 'iso27001', label: 'ISO 27001', short: 'ISO 27001', icon: 'ShieldCheck', color: '#0EA5E9' },
  { id: 'internal', label: 'Internt', short: 'Internt', icon: 'Users', color: '#737373' },
]

/**
 * Map a course's lawRefs[] onto a framework id. The lawRefs entries follow the
 * convention used elsewhere in the codebase: 'AML § …', 'IK-forskriften §',
 * 'GDPR Art. …', 'ISO 27001 …', 'ISO 45001 …'. Anything without a match (or
 * an empty lawRefs array) falls back to `internal`.
 */
/**
 * Map a course's lawRefs / title / description onto a framework id. We look at
 * three sources in order of fidelity:
 *   1. `course.lawRefs[]` — structured strings ('AML § 4-3', 'GDPR Art. 32').
 *      Most reliable when populated.
 *   2. `course.title` and `course.description` — fallback when lawRefs[] is
 *      empty. The org-catalog rows in production today ship with empty
 *      `learning_courses.law_refs` (structured refs live under
 *      `learning_system_course_locales.meta.lawRefs` and aren't merged onto
 *      the runtime Course object), so we rescue framework classification by
 *      parsing the title for `§`, `iso`, `gdpr`, `forskrift` markers.
 *   3. `internal` — last-resort fallback.
 */
export function frameworkForCourse(course: Course): string {
  const refs = (course.lawRefs ?? []).map((r) => r.toLowerCase())
  if (refs.length > 0) {
    if (refs.some((r) => r.startsWith('aml'))) return 'aml'
    if (refs.some((r) => r.includes('iso 27001') || r.includes('iso27001'))) return 'iso27001'
    if (refs.some((r) => r.includes('iso 45001') || r.includes('iso45001'))) return 'iso45001'
    if (refs.some((r) => r.includes('gdpr') || r.includes('personopplysning'))) return 'gdpr'
    if (refs.some((r) => r.includes('forskrift') || r.includes('ik-'))) return 'forskrift'
  }
  const haystack = `${course.title ?? ''} ${course.description ?? ''} ${(course.tags ?? []).join(' ')}`.toLowerCase()
  // Specific frameworks first so a title like "GDPR Art. 32 (jf. AML § 9)"
  // resolves to GDPR rather than AML — narrower wins.
  if (haystack.includes('iso 27001') || haystack.includes('iso27001')) return 'iso27001'
  if (haystack.includes('iso 45001') || haystack.includes('iso45001')) return 'iso45001'
  if (haystack.includes('gdpr') || haystack.includes('personvern') || haystack.includes('personopplysning')) return 'gdpr'
  if (haystack.includes('forskrift') || haystack.includes('ik-') || haystack.includes('internkontroll')) return 'forskrift'
  if (/(\baml\b|arbeidsmilj|§\s*\d|kap\.\s*\d|paragraf)/.test(haystack)) return 'aml'
  return 'internal'
}

/** Compact list of well-known law-text → display short label. */
export function trimLawRef(ref: string): string {
  if (ref.length <= 28) return ref
  return ref.slice(0, 26) + '…'
}

/** Status of a cohort — derived from progress rows + the course's publication state. */
export type CohortStatus = 'planlagt' | 'aktiv' | 'avsluttet' | 'utkast'

export function cohortStatusFor(course: Course, progress: CourseProgress[]): CohortStatus {
  if (course.status === 'draft') return 'utkast'
  if (course.status === 'archived') return 'avsluttet'
  const own = progress.filter((p) => p.courseId === course.id)
  if (own.length === 0) return 'planlagt'
  const allDone = own.every((p) => !!p.completedAt)
  if (allDone) return 'avsluttet'
  return 'aktiv'
}

export function cohortStatusBadge(status: CohortStatus): { label: string; variant: 'info' | 'success' | 'signed' | 'neutral' } {
  switch (status) {
    case 'planlagt':
      return { label: 'Planlagt', variant: 'info' }
    case 'aktiv':
      return { label: 'Aktiv', variant: 'success' }
    case 'avsluttet':
      return { label: 'Avsluttet', variant: 'signed' }
    default:
      return { label: 'Utkast', variant: 'neutral' }
  }
}

/** Aggregated cohort numbers used by the Kurs grid + table cards. */
export type CohortAggregate = {
  courseId: string
  status: CohortStatus
  enrolled: number
  completed: number
  inProgress: number
  notStarted: number
  passed: number
  failed: number
  avgProgress: number
  avgScore: number | null
  avgRating: number | null
  startedAt: string | null
  endsAt: string | null
}

function moduleTotal(course: Course): number {
  return course.modules.length
}

function percentForLearner(course: Course, p: CourseProgress): number {
  const total = moduleTotal(course)
  if (!total) return 0
  const done = course.modules.filter((m) => !!p.moduleProgress[m.id]?.completed).length
  return done / total
}

function quizScoreForLearner(course: Course, p: CourseProgress): number | null {
  const scores: number[] = []
  for (const m of course.modules) {
    const mp = p.moduleProgress[m.id]
    if (mp && typeof mp.score === 'number') scores.push(mp.score)
  }
  if (!scores.length) return null
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}

export function aggregateCohort(course: Course, progress: CourseProgress[]): CohortAggregate {
  const own = progress.filter((p) => p.courseId === course.id)
  let completed = 0
  let inProgress = 0
  let notStarted = 0
  let passed = 0
  let failed = 0
  let progressSum = 0
  const scores: number[] = []
  let startedMin: string | null = null
  let endsMax: string | null = null
  for (const p of own) {
    const pct = percentForLearner(course, p)
    progressSum += pct
    if (p.completedAt) {
      completed += 1
      const s = quizScoreForLearner(course, p)
      if (s !== null) {
        scores.push(s)
        if (s >= 75) passed += 1
        else failed += 1
      } else {
        passed += 1
      }
    } else if (pct > 0) {
      inProgress += 1
    } else {
      notStarted += 1
    }
    if (!startedMin || p.startedAt < startedMin) startedMin = p.startedAt
    if (p.completedAt && (!endsMax || p.completedAt > endsMax)) endsMax = p.completedAt
  }
  const enrolled = own.length
  const avgProgress = enrolled ? progressSum / enrolled : 0
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
  return {
    courseId: course.id,
    status: cohortStatusFor(course, progress),
    enrolled,
    completed,
    inProgress,
    notStarted,
    passed,
    failed,
    avgProgress,
    avgScore,
    avgRating: null,
    startedAt: startedMin,
    endsAt: endsMax,
  }
}

/** Sum of module durationMinutes — convenience for header strips. */
export function courseDurationMinutes(course: Course): number {
  return course.modules.reduce((acc, m) => acc + (m.durationMinutes || 0), 0)
}

export function courseDurationHours(course: Course): number {
  return Math.round((courseDurationMinutes(course) / 60) * 10) / 10
}

/** Lesson-block descriptor used by the design — derived from a CourseModule's
 *  `kind` so we don't need a separate `blocks` table. Each module renders as
 *  ONE block; the design's "9 lesson blocks" mostly map 1:1 onto modules. */
export type LessonBlockKind =
  | 'video'
  | 'text'
  | 'quiz'
  | 'checklist'
  | 'interactive'
  | 'scenario'
  | 'callout'
  | 'download'
  | 'practical'

export const LESSON_BLOCK_PALETTE: { type: LessonBlockKind; label: string; icon: string; color: string }[] = [
  { type: 'video', label: 'Video', icon: 'Video', color: '#7C3AED' },
  { type: 'text', label: 'Tekst', icon: 'AlignLeft', color: '#525252' },
  { type: 'quiz', label: 'Quiz', icon: 'HelpCircle', color: '#2563EB' },
  { type: 'checklist', label: 'Sjekkliste', icon: 'ListChecks', color: '#16A34A' },
  { type: 'interactive', label: 'Interaktiv', icon: 'MousePointer2', color: '#DB2777' },
  { type: 'scenario', label: 'Scenario', icon: 'GitBranch', color: '#C98A2B' },
  { type: 'callout', label: 'Callout', icon: 'Info', color: '#0EA5E9' },
  { type: 'download', label: 'Nedlasting', icon: 'Download', color: '#525252' },
  { type: 'practical', label: 'Praktisk', icon: 'Briefcase', color: '#D67849' },
]

/** Translate a ModuleKind from the existing data model onto a design block type. */
export function moduleKindToBlock(kind: ModuleKind): LessonBlockKind {
  switch (kind) {
    case 'video':
      return 'video'
    case 'quiz':
      return 'quiz'
    case 'checklist':
      return 'checklist'
    case 'flashcard':
      return 'interactive'
    case 'scenario':
      return 'scenario'
    case 'tips':
      return 'callout'
    case 'on_job':
      return 'practical'
    case 'event':
      return 'download'
    case 'image':
      return 'callout'
    default:
      return 'text'
  }
}

/** Translate a design block type back to a ModuleKind for content authoring. */
export function blockToModuleKind(block: LessonBlockKind): ModuleKind {
  switch (block) {
    case 'video':
      return 'video'
    case 'quiz':
      return 'quiz'
    case 'checklist':
      return 'checklist'
    case 'interactive':
      return 'flashcard'
    case 'scenario':
      return 'scenario'
    case 'callout':
      return 'tips'
    case 'download':
      return 'event'
    case 'practical':
      return 'on_job'
    default:
      return 'text'
  }
}

/** Small helper — count quiz questions inside a module (or `null` when N/A). */
export function quizQuestionCount(content: ModuleContent): number | null {
  if (content.kind === 'quiz') return content.questions.length
  return null
}

/** "title • truncated to N chars". Avoids overflowing block chips. */
export function truncate(value: string | undefined, max = 22): string | undefined {
  if (!value) return undefined
  if (value.length <= max) return value
  return value.slice(0, max - 1) + '…'
}

/** Reusable accent palette for badge counts in lesson chips. */
export const LESSON_BLOCK_CHIPS: Record<LessonBlockKind, { tone: string }> = {
  video: { tone: 'bg-purple-100 text-purple-800' },
  text: { tone: 'bg-neutral-100 text-neutral-700' },
  quiz: { tone: 'bg-blue-100 text-blue-800' },
  checklist: { tone: 'bg-green-100 text-green-800' },
  interactive: { tone: 'bg-pink-100 text-pink-800' },
  scenario: { tone: 'bg-amber-100 text-amber-900' },
  callout: { tone: 'bg-blue-100 text-blue-800' },
  download: { tone: 'bg-neutral-100 text-neutral-700' },
  practical: { tone: 'bg-orange-100 text-orange-800' },
}

/** Reusable icon palette for the certificate / mandatory pills on cards. */
export const ELEARNING_MANDATORY_LABEL = 'Lovpålagt'

/** Format a Date or ISO string for display in dd.MM.yyyy. */
export function formatDateNb(value: Date | string | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${date.getFullYear()}`
}

export function formatDateTimeNb(value: Date | string | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return `${dd}.${mm}.${date.getFullYear()} ${hh}:${mi}`
}

/** Icon hint for the cover hero on course cards / detail headers. */
export function courseIconName(course: Course): string {
  const lower = (course.title + ' ' + course.tags.join(' ')).toLowerCase()
  if (lower.includes('brann') || lower.includes('fire')) return 'Flame'
  if (lower.includes('truck')) return 'Truck'
  if (lower.includes('hms') || lower.includes('vern')) return 'ShieldCheck'
  if (lower.includes('gdpr') || lower.includes('personvern')) return 'Lock'
  if (lower.includes('iso 27001') || lower.includes('iso27001')) return 'ShieldCheck'
  if (lower.includes('iso 45001') || lower.includes('iso45001')) return 'BadgeCheck'
  if (lower.includes('førstehjelp') || lower.includes('forstehjelp')) return 'HeartHandshake'
  if (lower.includes('onboarding') || lower.includes('introduksjon')) return 'UserPlus'
  return 'BookOpen'
}

/** True when the course is a lovpålagt (mandatory) course based on lawRefs. */
export function isMandatoryCourse(course: Course): boolean {
  const refs = course.lawRefs ?? []
  if (!refs.length) return false
  const lower = refs.map((r) => r.toLowerCase())
  return lower.some((r) => r.startsWith('aml') || r.includes('forskrift') || r.includes('ik-'))
}

/** Compute aggregate KPIs used by the Statistikk tab. */
export function aggregateLearningKpis(courses: Course[], progress: CourseProgress[]) {
  let totalEnrolled = 0
  let totalCompleted = 0
  let scoreSum = 0
  let scoreCount = 0
  let mandatoryEnrolled = 0
  let mandatoryCompleted = 0
  const perFramework = new Map<
    string,
    { enrolled: number; completed: number; label: string }
  >()
  for (const c of courses) {
    const isMandatory = isMandatoryCourse(c)
    const fw = frameworkForCourse(c)
    const fwLabel = ELEARNING_FRAMEWORKS.find((f) => f.id === fw)?.short ?? fw
    const own = progress.filter((p) => p.courseId === c.id)
    totalEnrolled += own.length
    for (const p of own) {
      if (p.completedAt) {
        totalCompleted += 1
        const s = quizScoreForLearner(c, p)
        if (s !== null) {
          scoreSum += s
          scoreCount += 1
        }
        if (isMandatory) mandatoryCompleted += 1
      }
      if (isMandatory) mandatoryEnrolled += 1
    }
    const bucket = perFramework.get(fw) ?? { enrolled: 0, completed: 0, label: fwLabel }
    bucket.enrolled += own.length
    bucket.completed += own.filter((p) => p.completedAt).length
    perFramework.set(fw, bucket)
  }
  const completedTotal = totalCompleted
  const passRate = totalEnrolled ? totalCompleted / totalEnrolled : 0
  const mandatoryRate = mandatoryEnrolled ? mandatoryCompleted / mandatoryEnrolled : 0
  const avgScore = scoreCount ? Math.round(scoreSum / scoreCount) : 0
  const activeCourses = courses.filter((c) => c.status === 'published').length
  return {
    activeCourses,
    enrolledTotal: totalEnrolled,
    completedTotal,
    passRate,
    avgScore,
    avgRating: 0,
    mandatoryCompliance: mandatoryRate,
    avgTimeHours: 0,
    perFramework: Array.from(perFramework.entries()).map(([id, b]) => ({
      id,
      label: b.label,
      enrolled: b.enrolled,
      completed: b.completed,
      rate: b.enrolled ? b.completed / b.enrolled : 0,
    })),
  }
}

/** Sort courses by status priority for the hub grid. */
export function sortCohortsForHub(a: CohortAggregate, b: CohortAggregate): number {
  const order: Record<CohortStatus, number> = { aktiv: 0, planlagt: 1, avsluttet: 2, utkast: 3 }
  if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
  return (b.enrolled || 0) - (a.enrolled || 0)
}

/** Friendly Norwegian for a learner's progress status. */
export type LearnerStatus = 'fullført' | 'pågår' | 'ikke startet'

export function learnerStatusFor(course: Course, progress: CourseProgress): LearnerStatus {
  if (progress.completedAt) return 'fullført'
  const pct = percentForLearner(course, progress)
  if (pct === 0) return 'ikke startet'
  return 'pågår'
}

export function learnerProgressFor(course: Course, progress: CourseProgress): number {
  return percentForLearner(course, progress)
}

export function learnerScoreFor(course: Course, progress: CourseProgress): number | null {
  return quizScoreForLearner(course, progress)
}

/** Sum of `minutes` spent (from moduleProgress when available, otherwise estimated). */
export function learnerTimeHours(course: Course, progress: CourseProgress): number {
  const seen = course.modules.filter((m) => !!progress.moduleProgress[m.id]).length
  const total = seen * Math.max(2, Math.round(courseDurationMinutes(course) / Math.max(1, course.modules.length)))
  return Math.round(total / 60)
}

/** Mock leaderboard rows derived from progress — used by the Spillifisering tab
 *  until a dedicated XP table lands. Keeps the UI realistic without polluting
 *  the DB schema with placeholder rows. */
export type LeaderboardRow = {
  rank: number
  userId?: string
  name: string
  xp: number
  badges: number
  streak: number
}

export function deriveLeaderboard(course: Course, progress: CourseProgress[], limit = 5): LeaderboardRow[] {
  const rows = progress
    .filter((p) => p.courseId === course.id)
    .map((p) => {
      const pct = percentForLearner(course, p)
      const xp = Math.round(pct * 5000)
      const badges = Math.round(pct * 8)
      const streak = Math.max(0, Math.round(pct * 18))
      return {
        userId: p.userId,
        name: p.learnerName?.trim() || 'Læring',
        xp,
        badges,
        streak,
      }
    })
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit)
  return rows.map((r, i) => ({ rank: i + 1, ...r }))
}

/** Lookup helper for the framework pill renderer. */
export function findFramework(id: string | null | undefined): ElearningFramework | null {
  if (!id) return null
  return ELEARNING_FRAMEWORKS.find((f) => f.id === id) ?? null
}
