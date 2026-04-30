import type { Certificate, Course, CourseProgress } from '../../types/learning'
import { seedCourses } from '../../data/learningSeedData'

export const STORAGE_KEY = 'atics-learning-v1'

export const LEARNING_EXPORT_VERSION = 1

export type LearningState = {
  courses: Course[]
  progress: CourseProgress[]
  certificates: Certificate[]
}

export type LearningExportPayload = {
  version: typeof LEARNING_EXPORT_VERSION
  exportedAt: string
  courses: Course[]
  progress: CourseProgress[]
  certificates: Certificate[]
}

export type LearningPartialExportPayload =
  | {
      version: typeof LEARNING_EXPORT_VERSION
      kind: 'course'
      exportedAt: string
      course: Course
    }
  | {
      version: typeof LEARNING_EXPORT_VERSION
      kind: 'progress_slice'
      exportedAt: string
      progress: CourseProgress[]
    }
  | {
      version: typeof LEARNING_EXPORT_VERSION
      kind: 'certificates_slice'
      exportedAt: string
      certificates: Certificate[]
    }

export function loadLearningLocal(): LearningState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { courses: seedCourses, progress: [], certificates: [] }
    }
    const p = JSON.parse(raw) as LearningState
    const storedCourses: Course[] = Array.isArray(p.courses) && p.courses.length ? p.courses : seedCourses
    return {
      courses: storedCourses,
      progress: Array.isArray(p.progress) ? p.progress : [],
      certificates: Array.isArray(p.certificates) ? p.certificates : [],
    }
  } catch {
    return { courses: seedCourses, progress: [], certificates: [] }
  }
}

export function saveLearningLocal(state: LearningState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function isLearningExportPayload(raw: unknown): raw is LearningExportPayload {
  if (!raw || typeof raw !== 'object') return false
  const o = raw as Record<string, unknown>
  if (o.version !== LEARNING_EXPORT_VERSION) return false
  if (typeof o.exportedAt !== 'string') return false
  if (!Array.isArray(o.courses) || !Array.isArray(o.progress) || !Array.isArray(o.certificates)) return false
  return true
}

export function isPartialExportPayload(raw: unknown): raw is LearningPartialExportPayload {
  if (!raw || typeof raw !== 'object') return false
  const o = raw as Record<string, unknown>
  if (o.version !== LEARNING_EXPORT_VERSION) return false
  const kind = o.kind
  if (kind === 'course') {
    return (
      typeof o.course === 'object' &&
      o.course !== null &&
      typeof (o.course as Record<string, unknown>).id === 'string'
    )
  }
  if (kind === 'progress_slice') return Array.isArray(o.progress)
  if (kind === 'certificates_slice') return Array.isArray(o.certificates)
  return false
}
