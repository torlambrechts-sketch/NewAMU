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
  | 'other'

export type FlashcardSlide = {
  id: string
  front: string
  back: string
  /** Optional image URL (placeholder demo) */
  imageUrl?: string
  /** ISO date — when the card should be reviewed again (spaced repetition). */
  reviewDueAt?: string
}

export type QuizQuestion = {
  id: string
  question: string
  options: string[]
  correctIndex: number
  /** Shown after the learner picks an option (retrieval + feedback). */
  explanation?: string
}

export type ChecklistItem = {
  id: string
  label: string
}

export type OnJobTask = {
  id: string
  title: string
  description: string
  /** Learner or verifier initials / note (audit trail). */
  completedBy?: string
}

export type ModuleContent =
  | { kind: 'flashcard'; slides: FlashcardSlide[] }
  | { kind: 'quiz'; questions: QuizQuestion[] }
  | { kind: 'text'; body: string; /** Optional reflection before Continue on long pages */ reflectionPrompt?: string }
  | { kind: 'image'; caption: string; imageUrl: string }
  | { kind: 'video'; url: string; caption: string }
  | { kind: 'checklist'; items: ChecklistItem[] }
  | {
      kind: 'tips'
      items: string[]
      /** One-line prompt, e.g. “Which applies most to you?” */
      reflectionPrompt?: string
    }
  | { kind: 'on_job'; tasks: OnJobTask[] }
  | { kind: 'other'; title: string; body: string }

export type CourseModule = {
  id: string
  title: string
  order: number
  kind: ModuleKind
  content: ModuleContent
  /** Estimated minutes (micro-learning) */
  durationMinutes: number
  /** Quiz only: minimum % to pass (overrides course default if set). */
  minPassScore?: number
}

export type Course = {
  id: string
  title: string
  description: string
  status: CourseStatus
  tags: string[]
  modules: CourseModule[]
  createdAt: string
  updatedAt: string
  /** What the learner will be able to do (shown at start of player). */
  learningObjectives?: string[]
  /** Default minimum quiz score % (0–100). Modules can override. */
  minPassScore?: number
}

export type ModuleProgress = {
  moduleId: string
  completed: boolean
  score?: number
  /** quiz: last attempt */
  lastAnswers?: Record<string, number>
  /** flashcard: per-slide next review (ISO), keyed by slide id */
  flashcardSlideState?: Record<string, { reviewDueAt?: string }>
  /** text / other: short reflection stored when required to continue */
  reflectionAnswer?: string
  /** tips: selected item index for “which applies” */
  tipsReflectionIndex?: number
  /** on-the-job: task id → note or initials */
  onJobTaskNotes?: Record<string, string>
}

export type CourseProgress = {
  courseId: string
  moduleProgress: Record<string, ModuleProgress>
  startedAt: string
  completedAt?: string
}

export type Certificate = {
  id: string
  courseId: string
  courseTitle: string
  learnerName: string
  issuedAt: string
  /** simple verification code */
  verifyCode: string
}
