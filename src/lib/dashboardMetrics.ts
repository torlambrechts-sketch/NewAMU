import type { Course, CourseProgress } from '../types/learning'
import type { LibraryDocument } from '../types/documents'
import type { ComplianceRequirement } from '../types/documents'

export function learningCompletionStats(courses: Course[], progress: CourseProgress[]) {
  const published = courses.filter((c) => c.status === 'published')
  let completedCourses = 0
  let inProgressCourses = 0
  for (const c of published) {
    const p = progress.find((x) => x.courseId === c.id)
    if (!p || c.modules.length === 0) continue
    const allDone = c.modules.every((m) => p.moduleProgress[m.id]?.completed)
    if (allDone) completedCourses++
    else inProgressCourses++
  }
  const notStarted = published.filter((c) => !progress.some((p) => p.courseId === c.id)).length
  return {
    publishedCount: published.length,
    completedCourses,
    inProgressCourses,
    notStarted,
  }
}

export function complianceCoverage(
  requirements: ComplianceRequirement[],
  documents: LibraryDocument[],
): { satisfied: number; partial: number; unsatisfied: number; total: number } {
  let satisfied = 0
  let partial = 0
  let unsatisfied = 0
  for (const req of requirements) {
    const links = documents.flatMap((d) =>
      (d.complianceLinks ?? []).filter((cl) => cl.requirementId === req.id).map((cl) => ({ d, cl })),
    )
    if (links.length === 0) {
      unsatisfied++
      continue
    }
    const anySat = links.some((x) => x.cl.satisfied)
    if (anySat) satisfied++
    else partial++
  }
  return { satisfied, partial, unsatisfied, total: requirements.length }
}
