export type {
  TemplateMetadataField,
  TemplateMetadataFieldKind,
  TemplateMetadataFieldOption,
  TemplateMetadataSchema,
} from '../../modules/compliance/types'

import type { TemplateMetadataSchema } from '../../modules/compliance/types'

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
  | 'scenario'
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

export type OjtEvidenceType = 'text_response' | 'file_upload' | 'signature' | 'none'

export type OnJobTask = {
  id: string
  title: string
  description: string
  /** Role that must sign off on this task (e.g. "Verneombud", "Arbeidsgiver") */
  requiredRole?: string
  /** How the learner must prove completion */
  evidenceType?: OjtEvidenceType
  /** When true the task stays pending until an admin/role approves it */
  requiresApproval?: boolean
}

/** Discriminated union for quiz validation rules stored in content.validation */
export type QuizValidation = {
  requiredScore: number   // 0–100 percent
  allowRetry: boolean
}

/** Branching scenario choice — picking an option awards an impactScore + feedback */
export type ScenarioChoice = {
  id: string
  label: string
  /** Impact score (e.g. -10 to +10) — higher = stronger HMS-compliance */
  impactScore: number
  /** Contextual feedback shown after picking this choice */
  feedback: string
  /** Optional law citation supporting why this choice is correct/incorrect */
  refLawId?: string
}

export type ScenarioStep = {
  id: string
  prompt: string
  choices: ScenarioChoice[]
}

/** Badge unlocked by completing a milestone */
export type CourseBadge = {
  id: string
  label: string
  description?: string
  icon?: string  // lucide icon name or emoji
  /** Hex color for the badge background */
  color?: string
}

/** Milestone — a set of moduleIds that, when all complete, unlocks a badge */
export type CourseMilestone = {
  id: string
  label: string
  moduleIds: string[]
  badgeId: string
}

export type ModuleContent =
  | {
      kind: 'text'
      /** Legacy HTML body — used when bodyMarkdown is absent */
      body?: string
      /** Markdown body — preferred over body when present */
      bodyMarkdown?: string
      /** Format hint: "markdown" | "html" */
      bodyFormat?: 'markdown' | 'html'
      /** Long-form extended reading (Markdown). Shown in collapsible accordion. */
      deepDive?: string
      /** 3-5 bullet takeaways shown at bottom of module */
      keyTakeaways?: string[]
      /** Strategic advice block for managers — rendered as a callout */
      leadershipInsight?: string
      /** Common mistakes / pitfalls to avoid — rendered as a 🚨 alert callout */
      commonPitfalls?: string[]
    }
  | { kind: 'flashcard'; slides: FlashcardSlide[] }
  | {
      kind: 'quiz'
      questions: QuizQuestion[]
      /** Scoring + retry rules */
      validation?: QuizValidation
    }
  | { kind: 'image'; caption: string; imageUrl: string }
  | {
      kind: 'video'
      /** Legacy flat URL */
      url?: string
      caption?: string
      /** Structured media object (v2 schema) */
      media?: { type: 'video'; url: string; duration?: number; transcript?: string }
    }
  | { kind: 'checklist'; items: ChecklistItem[] }
  | { kind: 'tips'; items: string[] }
  | { kind: 'on_job'; tasks: OnJobTask[] }
  | { kind: 'event'; instructions: string }
  | {
      kind: 'scenario'
      /** Optional context / framing for the scenario (Markdown) */
      intro?: string
      steps: ScenarioStep[]
      /** Threshold the learner must reach for the module to count as passed */
      passingImpactScore?: number
    }
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
  /** IDs referencing entries in the course-level lawRefs catalog */
  refLawIds?: string[]
  /** Compliance points awarded for completing this module */
  points?: number
  /** Badge unlocked when this module is completed (references Course.badges) */
  badgeId?: string
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
  /** Semver minor sibling to courseVersion. Defaults to 0. */
  courseVersionMinor?: number
  /** Per-locale version of the resolved system-course content (major). */
  localeVersionMajor?: number
  /** Per-locale version of the resolved system-course content (minor). */
  localeVersionMinor?: number
  /** ISO timestamp the resolved locale was last published. */
  localeVersionPublishedAt?: string | null
  /** Most-recent changelog (Markdown) on the resolved locale. */
  localeChangeNotesMd?: string | null
  /** Months until recertification (optional) */
  recertificationMonths?: number | null
  /** Compliance fase 1: rolle-slugs som SKAL bestå kurset */
  requiredForRoles?: string[]
  /**
   * Optional sections that group {@link CourseModule modules} inside the course.
   * Maps onto each module's {@link CourseModule.sectionId}.
   */
  sections?: CourseSection[]
  /** Optional grouping in the courses list + sidebar (admin-defined). Null = "Annet". */
  categoryId?: string | null
  /** Gamification: catalog of badges that modules / milestones can unlock */
  badges?: CourseBadge[]
  /** Gamification: milestones that unlock a badge when all moduleIds complete */
  milestones?: CourseMilestone[]
  /**
   * Field declarations driving the course completion metadata panel. Same shape as
   * compliance/survey templates. Built-in kinds bind to typed FK columns on
   * `learning_course_progress`; free-form kinds land in `learning_course_progress.metadata`.
   */
  metadataSchema?: TemplateMetadataSchema | null
  /**
   * Canonical law-reference codes this course is anchored to (Lovverk tab).
   * Resolved against `LEARNING_MODULE_LEGAL_REFERENCES` for display.
   */
  lawRefs?: string[]
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
  /** Cat 1 of the cross-module taxonomy (category-architecture §T2).
   *  Null when the admin hasn't classified this category under a regulation. */
  regulation_id?: string | null
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
  /** Locale version active when the learner first began the course. */
  startedVersionMajor?: number | null
  startedVersionMinor?: number | null
  /** Set when progress is loaded from Supabase (org-wide for managers) */
  userId?: string
  /** Display name from profiles (participants table) */
  learnerName?: string
  /** Org-context snapshots set by trigger on completion. Null until completed. */
  locationIdAtCompletion?: string | null
  departmentIdAtCompletion?: string | null
  teamIdAtCompletion?: string | null
  /** Free-form per-course metadata (driven by Course.metadataSchema). */
  metadata?: Record<string, unknown>
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

/** Single row in learning_system_course_locale_versions — admin Versjonshistorikk. */
export type LocaleVersionHistoryRow = {
  id: string
  systemCourseId: string
  locale: string
  versionMajor: number
  versionMinor: number
  publishedAt: string
  publishedBy?: string | null
  changeNotesMd?: string | null
  moduleIdsSnapshot: string[]
  isMajor: boolean
}

/** Output of learning_compute_learner_diff RPC. */
export type LearnerVersionDiff =
  | { hasProgress: false }
  | {
      hasProgress: true
      hasDiff: false
      fromVersion?: { major: number; minor: number }
      toVersion?: { major: number; minor: number }
    }
  | {
      hasProgress: true
      hasDiff: true
      isMajor: boolean
      fromVersion: { major: number; minor: number }
      toVersion: { major: number; minor: number }
      addedModuleIds: string[]
      removedModuleIds: string[]
    }

/** Row in the learner's Min historikk surface. */
export type MyCompletionRow = {
  courseId: string
  courseTitleSnapshot: string
  courseVersion: number
  completedAt: string
  certificateId?: string | null
  /** Computed compliance status against the current published version. */
  status: 'compliant' | 'needs_update' | 'expired'
}
