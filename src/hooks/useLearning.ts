import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  Certificate,
  Course,
  CourseModule,
  CourseProgress,
  ModuleContent,
  ModuleKind,
  ModuleProgress,
} from '../types/learning'

export const STORAGE_KEY = 'atics-learning-v1'

export const LEARNING_EXPORT_VERSION = 1

export type LearningExportPayload = {
  version: typeof LEARNING_EXPORT_VERSION
  exportedAt: string
  courses: Course[]
  progress: CourseProgress[]
  certificates: Certificate[]
}

/** Single-course or slice exports (import merges into existing data). */
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

type LearningState = {
  courses: Course[]
  progress: CourseProgress[]
  certificates: Certificate[]
}

function normalizeQuizQuestions(
  questions: import('../types/learning').QuizQuestion[],
): import('../types/learning').QuizQuestion[] {
  return questions.map((q) => ({
    ...q,
    explanation: q.explanation ?? '',
  }))
}

function normalizeModuleContent(content: ModuleContent): ModuleContent {
  switch (content.kind) {
    case 'quiz':
      return { ...content, questions: normalizeQuizQuestions(content.questions) }
    case 'tips':
      return { ...content, reflectionPrompt: content.reflectionPrompt }
    case 'text':
      return { ...content, reflectionPrompt: content.reflectionPrompt }
    default:
      return content
  }
}

function normalizeModule(m: CourseModule): CourseModule {
  return {
    ...m,
    content: normalizeModuleContent(m.content),
    minPassScore: m.minPassScore,
  }
}

function normalizeCourse(c: Course): Course {
  return {
    ...c,
    learningObjectives: c.learningObjectives ?? [],
    minPassScore: c.minPassScore ?? 70,
    modules: c.modules.map(normalizeModule),
  }
}

function normalizeState(raw: LearningState): LearningState {
  return {
    courses: raw.courses.map(normalizeCourse),
    progress: raw.progress,
    certificates: raw.certificates,
  }
}

function isLearningExportPayload(raw: unknown): raw is LearningExportPayload {
  if (!raw || typeof raw !== 'object') return false
  const o = raw as Record<string, unknown>
  if (o.version !== LEARNING_EXPORT_VERSION) return false
  if (typeof o.exportedAt !== 'string') return false
  if (!Array.isArray(o.courses) || !Array.isArray(o.progress) || !Array.isArray(o.certificates)) return false
  return true
}

function isPartialExportPayload(raw: unknown): raw is LearningPartialExportPayload {
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

function emptyModule(kind: ModuleKind, title: string, order: number): CourseModule {
  const id = crypto.randomUUID()
  let content: ModuleContent
  switch (kind) {
    case 'flashcard':
      content = {
        kind: 'flashcard',
        slides: [
          { id: crypto.randomUUID(), front: 'Front', back: 'Back' },
        ],
      }
      break
    case 'quiz':
      content = {
        kind: 'quiz',
        questions: [
          {
            id: crypto.randomUUID(),
            question: 'Sample question?',
            options: ['A', 'B', 'C'],
            correctIndex: 0,
            explanation: 'Explain why the correct answer is right — learners see this after they answer.',
          },
        ],
      }
      break
    case 'text':
      content = { kind: 'text', body: '<p>Write learning content here.</p>' }
      break
    case 'image':
      content = {
        kind: 'image',
        caption: 'Caption',
        imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800',
      }
      break
    case 'video':
      content = {
        kind: 'video',
        url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        caption: 'Replace with video URL (MP4 or embed).',
      }
      break
    case 'checklist':
      content = {
        kind: 'checklist',
        items: [{ id: crypto.randomUUID(), label: 'First step' }],
      }
      break
    case 'tips':
      content = {
        kind: 'tips',
        items: ['Practical tip one', 'Practical tip two'],
        reflectionPrompt: 'Which of these applies most to your situation right now?',
      }
      break
    case 'on_job':
      content = {
        kind: 'on_job',
        tasks: [
          {
            id: crypto.randomUUID(),
            title: 'Observe',
            description: 'What to do on the job',
          },
        ],
      }
      break
    default:
      content = { kind: 'other', title: 'Custom', body: '<p>Content</p>' }
  }
  return {
    id,
    title,
    order,
    kind,
    content,
    durationMinutes: 5,
  }
}

const seedCourses: Course[] = [
  {
    id: 'c-demo',
    title: 'Safety 101',
    description: 'Introductory workplace safety and reporting.',
    status: 'published',
    tags: ['HMS', 'Onboarding'],
    learningObjectives: [
      'Recognize basic safety terms and reporting paths.',
      'Complete a start-of-shift checklist.',
      'Pass a short knowledge check on PPE.',
    ],
    minPassScore: 70,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    modules: [
      {
        ...emptyModule('flashcard', 'Key definitions', 0),
        id: 'm-fc1',
        content: {
          kind: 'flashcard',
          slides: [
            {
              id: 's1',
              front: 'What is a near miss?',
              back: 'An unwanted event that could have caused harm.',
            },
            {
              id: 's2',
              front: 'Who do you report hazards to?',
              back: 'Your supervisor and/or verneombud.',
            },
          ],
        },
        durationMinutes: 3,
      },
      {
        ...emptyModule('quiz', 'Quick check', 1),
        id: 'm-q1',
        content: {
          kind: 'quiz',
        questions: [
          {
            id: 'q1',
            question: 'PPE must be used when?',
            options: ['Never', 'When risk requires it', 'Only on Fridays'],
            correctIndex: 1,
            explanation: 'Use PPE whenever the risk assessment requires it — not only on certain days.',
          },
        ],
        },
        durationMinutes: 5,
      },
      {
        ...emptyModule('checklist', 'Start of shift', 2),
        id: 'm-cl1',
        content: {
          kind: 'checklist',
          items: [
            { id: 'i1', label: 'Area is tidy' },
            { id: 'i2', label: 'Emergency exits clear' },
          ],
        },
        durationMinutes: 2,
      },
    ],
  },
]

function load(): LearningState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return normalizeState({ courses: seedCourses, progress: [], certificates: [] })
    }
    const p = JSON.parse(raw) as LearningState
    const courses =
      Array.isArray(p.courses) && p.courses.length ? p.courses.map(normalizeCourse) : seedCourses.map(normalizeCourse)
    return normalizeState({
      courses,
      progress: Array.isArray(p.progress) ? p.progress : [],
      certificates: Array.isArray(p.certificates) ? p.certificates : [],
    })
  } catch {
    return normalizeState({ courses: seedCourses, progress: [], certificates: [] })
  }
}

function save(state: LearningState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function useLearning() {
  const [state, setState] = useState<LearningState>(() => load())

  useEffect(() => {
    save(state)
  }, [state])

  const createCourse = useCallback((title: string, description: string) => {
    const now = new Date().toISOString()
    const c: Course = normalizeCourse({
      id: crypto.randomUUID(),
      title: title.trim(),
      description: description.trim(),
      status: 'draft',
      tags: [],
      modules: [],
      learningObjectives: [],
      minPassScore: 70,
      createdAt: now,
      updatedAt: now,
    })
    setState((s) => ({ ...s, courses: [c, ...s.courses] }))
    return c
  }, [])

  const updateCourse = useCallback((id: string, patch: Partial<Course>) => {
    setState((s) => ({
      ...s,
      courses: s.courses.map((c) =>
        c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c,
      ),
    }))
  }, [])

  const addModule = useCallback((courseId: string, kind: ModuleKind, title: string): CourseModule | null => {
    const mod = emptyModule(kind, title.trim() || 'Untitled module', 0)
    setState((s) => ({
      ...s,
      courses: s.courses.map((c) => {
        if (c.id !== courseId) return c
        const order = c.modules.length
        const withOrder: CourseModule = { ...mod, order }
        return { ...c, modules: [...c.modules, withOrder], updatedAt: new Date().toISOString() }
      }),
    }))
    return mod
  }, [])

  const updateModule = useCallback((courseId: string, moduleId: string, patch: Partial<CourseModule>) => {
    setState((s) => ({
      ...s,
      courses: s.courses.map((c) => {
        if (c.id !== courseId) return c
        return {
          ...c,
          modules: c.modules.map((m) => (m.id === moduleId ? { ...m, ...patch } : m)),
          updatedAt: new Date().toISOString(),
        }
      }),
    }))
  }, [])

  const reorderModules = useCallback((courseId: string, moduleIds: string[]) => {
    setState((s) => ({
      ...s,
      courses: s.courses.map((c) => {
        if (c.id !== courseId) return c
        const map = new Map(c.modules.map((m) => [m.id, m]))
        const next = moduleIds.map((id, i) => {
          const m = map.get(id)
          return m ? { ...m, order: i } : null
        }).filter(Boolean) as CourseModule[]
        return { ...c, modules: next, updatedAt: new Date().toISOString() }
      }),
    }))
  }, [])

  const deleteModule = useCallback((courseId: string, moduleId: string) => {
    setState((s) => ({
      ...s,
      courses: s.courses.map((c) => {
        if (c.id !== courseId) return c
        const modules = c.modules
          .filter((m) => m.id !== moduleId)
          .map((m, i) => ({ ...m, order: i }))
        return { ...c, modules, updatedAt: new Date().toISOString() }
      }),
    }))
  }, [])

  const ensureProgress = useCallback((courseId: string) => {
    setState((s) => {
      if (s.progress.some((p) => p.courseId === courseId)) return s
      const np: CourseProgress = {
        courseId,
        moduleProgress: {},
        startedAt: new Date().toISOString(),
      }
      return { ...s, progress: [...s.progress, np] }
    })
  }, [])

  const setModuleCompleted = useCallback(
    (courseId: string, moduleId: string, data?: { score?: number; lastAnswers?: Record<string, number> }) => {
      setState((s) => {
        const hasRow = s.progress.some((p) => p.courseId === courseId)
        const baseProgress: CourseProgress[] = hasRow
          ? s.progress
          : [
              ...s.progress,
              {
                courseId,
                moduleProgress: {},
                startedAt: new Date().toISOString(),
              },
            ]
        return {
          ...s,
          progress: baseProgress.map((p) => {
            if (p.courseId !== courseId) return p
            const prev = p.moduleProgress[moduleId]
            return {
              ...p,
              moduleProgress: {
                ...p.moduleProgress,
                [moduleId]: {
                  ...prev,
                  moduleId,
                  completed: true,
                  score: data?.score ?? prev?.score,
                  lastAnswers: data?.lastAnswers ?? prev?.lastAnswers,
                },
              },
            }
          }),
        }
      })
    },
    [],
  )

  const patchModuleProgress = useCallback(
    (courseId: string, moduleId: string, patch: Partial<ModuleProgress>) => {
      setState((s) => {
        const hasRow = s.progress.some((p) => p.courseId === courseId)
        const baseProgress: CourseProgress[] = hasRow
          ? s.progress
          : [
              ...s.progress,
              {
                courseId,
                moduleProgress: {},
                startedAt: new Date().toISOString(),
              },
            ]
        return {
          ...s,
          progress: baseProgress.map((p) => {
            if (p.courseId !== courseId) return p
            const prev = p.moduleProgress[moduleId] ?? { moduleId, completed: false }
            return {
              ...p,
              moduleProgress: {
                ...p.moduleProgress,
                [moduleId]: { ...prev, ...patch, moduleId },
              },
            }
          }),
        }
      })
    },
    [],
  )

  const issueCertificate = useCallback((courseId: string, learnerName: string): Certificate | null => {
    let issued: Certificate | null = null
    setState((s) => {
      const course = s.courses.find((c) => c.id === courseId)
      if (!course) return s
      const prog = s.progress.find((p) => p.courseId === courseId)
      const allDone =
        course.modules.length > 0 &&
        course.modules.every((m) => prog?.moduleProgress[m.id]?.completed)
      if (!allDone) return s
      if (s.certificates.some((c) => c.courseId === courseId)) return s
      const cert: Certificate = {
        id: crypto.randomUUID(),
        courseId,
        courseTitle: course.title,
        learnerName: learnerName.trim(),
        issuedAt: new Date().toISOString(),
        verifyCode: crypto.randomUUID().slice(0, 8).toUpperCase(),
      }
      issued = cert
      return {
        ...s,
        certificates: [cert, ...s.certificates],
        progress: s.progress.map((p) =>
          p.courseId === courseId ? { ...p, completedAt: new Date().toISOString() } : p,
        ),
      }
    })
    return issued
  }, [])

  const stats = useMemo(() => {
    const published = state.courses.filter((c) => c.status === 'published').length
    const drafts = state.courses.filter((c) => c.status === 'draft').length
    const certs = state.certificates.length
    const enrolled = state.progress.length
    return { published, drafts, certs, enrolled, totalCourses: state.courses.length }
  }, [state])

  const resetDemo = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setState(load())
  }, [])

  const exportJson = useCallback((): string => {
    const payload: LearningExportPayload = {
      version: LEARNING_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      courses: state.courses,
      progress: state.progress,
      certificates: state.certificates,
    }
    return JSON.stringify(payload, null, 2)
  }, [state])

  const importFromJson = useCallback((json: string): { ok: true } | { ok: false; error: string } => {
    try {
      const raw = JSON.parse(json) as unknown
      if (!isLearningExportPayload(raw)) {
        return { ok: false, error: 'Ugyldig fil: forventet learning export v1.' }
      }
      setState({
        courses: raw.courses,
        progress: raw.progress,
        certificates: raw.certificates,
      })
      return { ok: true }
    } catch {
      return { ok: false, error: 'Kunne ikke parse JSON.' }
    }
  }, [])

  const exportCourseJson = useCallback(
    (courseId: string): string | null => {
      const course = state.courses.find((c) => c.id === courseId)
      if (!course) return null
      const payload: LearningPartialExportPayload = {
        version: LEARNING_EXPORT_VERSION,
        kind: 'course',
        exportedAt: new Date().toISOString(),
        course,
      }
      return JSON.stringify(payload, null, 2)
    },
    [state.courses],
  )

  const exportProgressSliceJson = useCallback((): string => {
    const payload: LearningPartialExportPayload = {
      version: LEARNING_EXPORT_VERSION,
      kind: 'progress_slice',
      exportedAt: new Date().toISOString(),
      progress: state.progress,
    }
    return JSON.stringify(payload, null, 2)
  }, [state.progress])

  const exportCertificatesSliceJson = useCallback((): string => {
    const payload: LearningPartialExportPayload = {
      version: LEARNING_EXPORT_VERSION,
      kind: 'certificates_slice',
      exportedAt: new Date().toISOString(),
      certificates: state.certificates,
    }
    return JSON.stringify(payload, null, 2)
  }, [state.certificates])

  const importPartialJson = useCallback(
    (json: string): { ok: true } | { ok: false; error: string } => {
      try {
        const raw = JSON.parse(json) as unknown
        if (!isPartialExportPayload(raw)) {
          return { ok: false, error: 'Ugyldig fil: forventet delvis export (course / progress / certificates).' }
        }
        if (raw.kind === 'course') {
          const course = normalizeCourse(raw.course)
          setState((s) => ({
            ...s,
            courses: s.courses.some((c) => c.id === course.id)
              ? s.courses.map((c) => (c.id === course.id ? course : c))
              : [...s.courses, course],
          }))
          return { ok: true }
        }
        if (raw.kind === 'progress_slice') {
          setState((s) => {
            const byCourse = new Map(s.progress.map((p) => [p.courseId, p]))
            for (const p of raw.progress) {
              byCourse.set(p.courseId, p)
            }
            return { ...s, progress: [...byCourse.values()] }
          })
          return { ok: true }
        }
        if (raw.kind === 'certificates_slice') {
          setState((s) => {
            const byId = new Map(s.certificates.map((c) => [c.id, c]))
            for (const c of raw.certificates) {
              byId.set(c.id, c)
            }
            return { ...s, certificates: [...byId.values()] }
          })
          return { ok: true }
        }
        return { ok: false, error: 'Ukjent delvis export-type.' }
      } catch {
        return { ok: false, error: 'Kunne ikke parse JSON.' }
      }
    },
    [],
  )

  return {
    ...state,
    stats,
    createCourse,
    updateCourse,
    addModule,
    updateModule,
    reorderModules,
    deleteModule,
    ensureProgress,
    setModuleCompleted,
    patchModuleProgress,
    issueCertificate,
    resetDemo,
    exportJson,
    importFromJson,
    exportCourseJson,
    exportProgressSliceJson,
    exportCertificatesSliceJson,
    importPartialJson,
  }
}
