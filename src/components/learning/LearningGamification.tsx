// LearningGamification — reusable presentational components for
// course-level gamification (points, badges, milestones) and the
// inline "Lederinnsikt" callout shown inside text modules.

import { Award, Sparkles, Lock, Trophy, Crown } from 'lucide-react'
import type { Course, CourseProgress, CourseBadge, CourseMilestone } from '../../types/learning'
import { MarkdownBody } from './MarkdownBody'

// ── Points + badges computation ──────────────────────────────────────────────
export function computeEarnedPoints(course: Course, progress?: CourseProgress): number {
  if (!progress) return 0
  return course.modules.reduce((sum, m) => {
    const done = progress.moduleProgress[m.id]?.completed
    return sum + (done ? (m.points ?? 0) : 0)
  }, 0)
}

export function computeTotalPoints(course: Course): number {
  return course.modules.reduce((sum, m) => sum + (m.points ?? 0), 0)
}

export function computeEarnedBadges(course: Course, progress?: CourseProgress): CourseBadge[] {
  if (!progress || !course.badges?.length) return []
  const earned = new Set<string>()
  // Per-module badges
  for (const m of course.modules) {
    if (m.badgeId && progress.moduleProgress[m.id]?.completed) earned.add(m.badgeId)
  }
  // Milestone badges
  for (const ms of course.milestones ?? []) {
    if (ms.moduleIds.every((id) => progress.moduleProgress[id]?.completed)) {
      earned.add(ms.badgeId)
    }
  }
  return course.badges.filter((b) => earned.has(b.id))
}

// ── HUD ──────────────────────────────────────────────────────────────────────
export function GamificationHUD({
  course,
  progress,
  className = '',
}: {
  course: Course
  progress?: CourseProgress
  className?: string
}) {
  const earnedPoints = computeEarnedPoints(course, progress)
  const totalPoints = computeTotalPoints(course)
  const earnedBadges = computeEarnedBadges(course, progress)
  const allBadges = course.badges ?? []
  const milestones = course.milestones ?? []

  if (totalPoints === 0 && allBadges.length === 0 && milestones.length === 0) return null

  return (
    <aside
      className={`rounded-2xl border border-amber-200/70 bg-gradient-to-b from-amber-50 to-white p-4 shadow-sm ${className}`}
      aria-label="Compliance Points og badges"
    >
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-amber-900">Compliance Points</h3>
      </div>

      {totalPoints > 0 && (
        <div className="mt-3">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-amber-700">{earnedPoints}</span>
            <span className="text-sm text-amber-700/70">/ {totalPoints} poeng</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-amber-100">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-500"
              style={{ width: `${totalPoints ? (earnedPoints / totalPoints) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {allBadges.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-amber-800">
            <Trophy className="size-3" /> Badges
          </div>
          <ul className="grid grid-cols-3 gap-2">
            {allBadges.map((b) => {
              const isEarned = earnedBadges.some((eb) => eb.id === b.id)
              return (
                <li
                  key={b.id}
                  className={`relative flex flex-col items-center rounded-lg p-2 text-center transition-all ${
                    isEarned ? 'bg-white shadow-sm ring-1 ring-amber-300' : 'bg-neutral-50 opacity-60'
                  }`}
                  title={b.description ?? b.label}
                >
                  <div
                    className="flex size-9 items-center justify-center rounded-full text-base"
                    style={{ background: isEarned ? b.color ?? '#fbbf24' : '#e5e5e5', color: isEarned ? '#fff' : '#a3a3a3' }}
                  >
                    {isEarned ? <BadgeIcon icon={b.icon} /> : <Lock className="size-4" />}
                  </div>
                  <span className={`mt-1 line-clamp-2 text-[10px] font-medium leading-tight ${isEarned ? 'text-amber-900' : 'text-neutral-500'}`}>
                    {b.label}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {milestones.length > 0 && (
        <div className="mt-4 border-t border-amber-200/70 pt-3">
          <div className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-amber-800">
            <Crown className="size-3" /> Milepæler
          </div>
          <ul className="space-y-2">
            {milestones.map((m) => {
              const done = m.moduleIds.filter((id) => progress?.moduleProgress[id]?.completed).length
              const total = m.moduleIds.length
              const complete = done === total
              return (
                <li key={m.id} className="rounded-lg bg-white/70 p-2">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className={`font-medium ${complete ? 'text-amber-900' : 'text-neutral-700'}`}>{m.label}</span>
                    <span className="shrink-0 text-amber-700">{done}/{total}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </aside>
  )
}

function BadgeIcon({ icon }: { icon?: string }) {
  if (!icon) return <Award className="size-4" />
  // Treat single emoji (or short string without spaces) as a direct char
  if (icon.length <= 4 && !/^[a-z-]+$/i.test(icon)) return <span aria-hidden>{icon}</span>
  return <Award className="size-4" />
}

// ── Per-module points badge (inline pill) ────────────────────────────────────
export function ModulePointsPill({ points }: { points?: number }) {
  if (!points || points <= 0) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
      <Sparkles className="size-3" /> +{points} poeng
    </span>
  )
}

// ── Leadership insight callout (inside text modules) ─────────────────────────
export function LeadershipInsight({ markdown }: { markdown: string }) {
  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-[#1a3d32]/30 bg-[#f0f9f5]">
      <div className="flex items-center gap-2 border-b border-[#1a3d32]/20 bg-[#1a3d32]/10 px-4 py-2">
        <Crown className="size-4 shrink-0 text-[#1a3d32]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[#1a3d32]">Lederinnsikt</span>
      </div>
      <div className="px-4 py-3">
        <MarkdownBody markdown={markdown} />
      </div>
    </div>
  )
}

// helper export (avoid unused-export lint)
export type { CourseMilestone }
