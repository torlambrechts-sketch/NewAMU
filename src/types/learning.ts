export type CourseStatus = 'draft' | 'published' | 'archived'

export type ModuleKind =
  | 'flashcard'
  | 'quiz'
  | 'text'
  | 'image'
  | 'video'
  | 'checklist'
  | 'tips'
  | 'on_job'
  | 'event'
  | 'other'

export type FlashcardSlide = {
  id: string
  front: string
  back: string
  /** Optional image URL (placeholder demo) */
  imageUrl?: string
}

export type QuizQuestion = {
  id: string
  question: string
  options: string[]
  correctIndex: number
}

export type ChecklistItem = {
  id: string
  label: string
}

export type OnJobTask = {
  id: string
  title: string
  description: string
}

export type ModuleContent =
  | { kind: 'flashcard'; slides: FlashcardSlide[] }
  | { kind: 'quiz'; questions: QuizQuestion[] }
  | { kind: 'text'; body: string }
  | { kind: 'image'; caption: string; imageUrl: string }
  | { kind: 'video'; url: string; caption: string }
  | { kind: 'checklist'; items: ChecklistItem[] }
  | { kind: 'tips'; items: string[] }
  | { kind: 'on_job'; tasks: OnJobTask[] }
  | { kind: 'event'; instructions: string }
  | { kind: 'other'; title: string; body: string }

export type CourseModule = {
  id: string
  title: string
  order: number
  kind: ModuleKind
  content: ModuleContent
  /** Estimated minutes (micro-learning) */
  durationMinutes: number
  /**
   * Optional grouping under a {@link CourseSection}. When `null`/absent, the module
   * lives at the course root. Sections are persisted client-side until the matching
   * Supabase migration lands; older callers can ignore this field.
   */
  sectionId?: string | null
}

/**
 * Optional grouping inside a {@link Course} (a.k.a. «kapittel» / chapter). A course
 * can have any number of sections; each module then belongs to one section, or to
 * the course root when `sectionId` is empty.
 */
export type CourseSection = {
  id: string
  title: string
  order: number
  description?: string | null
}

/** system = shared catalog row; org = created in org; fork = copied from system for editing */
export type CourseOrigin = 'system' | 'org' | 'fork'

export type Course = {
  id: string
  title: string
  description: string
  status: CourseStatus
  tags: string[]
  modules: CourseModule[]
  /** Course IDs that must be completed before this course is available */
  prerequisiteCourseIds?: string[]
  createdAt: string
  updatedAt: string
  /** When set, module content may be loaded from learning_system_course_locales */
  sourceSystemCourseId?: string | null
  /** Locale used for catalog resolution (nb | en) */
  catalogLocale?: string | null
  origin?: CourseOrigin
  /** True when this row is the org's editable copy of a system course */
  forkedFromSystemId?: string | null
  /** Bumped when content changes; certificates reference this */
  courseVersion?: number
  /** Months until recertification (optional) */
  recertificationMonths?: number | null
  /**
   * Optional sections that group {@link CourseModule modules} inside the course.
   * Maps onto each module's {@link CourseModule.sectionId}.
   */
  sections?: CourseSection[]
  /** Optional grouping in the courses list + sidebar (admin-defined). Null = "Annet". */
  categoryId?: string | null
}

/** Per-org curated category for grouping {@link Course} rows. */
export type LearningCategory = {
  id: string
  organization_id: string
  slug: string
  name: string
  description: string | null
  position: number
  is_active: boolean
  is_system: boolean
}

export type ModuleProgress = {
  moduleId: string
  completed: boolean
  score?: number
  /** quiz: last attempt */
  lastAnswers?: Record<string, number>
}

/** Optional metadata when completing a quiz (spaced repetition) */
export type ModuleCompleteMeta = {
  score?: number
  lastAnswers?: Record<string, number>
  quizQuestions?: { id: string; correctIndex: number }[]
}

export type CourseProgress = {
  courseId: string
  moduleProgress: Record<string, ModuleProgress>
  startedAt: string
  completedAt?: string
  /** Set when progress is loaded from Supabase (org-wide for managers) */
  userId?: string
  /** Display name from profiles (participants table) */
  learnerName?: string
}

export type Certificate = {
  id: string
  courseId: string
  courseTitle: string
  learnerName: string
  issuedAt: string
  /** simple verification code */
  verifyCode: string
  /** Snapshot of course law/content version at issue time */
  courseVersion?: number
}
