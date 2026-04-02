import type { Course, CourseProgress } from '../types/learning'

/** Count flashcard slides with review due (from progress or slide). */
export function countFlashcardsDue(course: Course, cp: CourseProgress | undefined): number {
  if (!cp) return 0
  let n = 0
  for (const mod of course.modules) {
    if (mod.content.kind !== 'flashcard') continue
    const mp = cp.moduleProgress[mod.id]
    const st = mp?.flashcardSlideState ?? {}
    for (const slide of mod.content.slides) {
      const dueStr = st[slide.id]?.reviewDueAt ?? slide.reviewDueAt
      if (!dueStr) continue
      if (new Date(dueStr) <= new Date()) n += 1
    }
  }
  return n
}
