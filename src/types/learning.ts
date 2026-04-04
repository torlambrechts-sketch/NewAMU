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
  | { kind: 'other'; title: string; body: string }

export type CourseModule = {
  id: string
  title: string
  order: number
  kind: ModuleKind
  content: ModuleContent
  /** Estimated minutes (micro-learning) */
  durationMinutes: number
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
}

export type ModuleProgress = {
  moduleId: string
  completed: boolean
  score?: number
  /** quiz: last attempt */
  lastAnswers?: Record<string, number>
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
