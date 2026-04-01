import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  Certificate,
  Course,
  CourseModule,
  CourseProgress,
  ModuleContent,
  ModuleKind,
} from '../types/learning'

const STORAGE_KEY = 'atics-learning-v1'

type LearningState = {
  courses: Course[]
  progress: CourseProgress[]
  certificates: Certificate[]
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
          },
        ],
      }
      break
    case 'text':
      content = { kind: 'text', body: 'Write learning content here.' }
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
      content = { kind: 'tips', items: ['Practical tip one', 'Practical tip two'] }
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
      content = { kind: 'other', title: 'Custom', body: 'Content' }
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
      return { courses: seedCourses, progress: [], certificates: [] }
    }
    const p = JSON.parse(raw) as LearningState
    return {
      courses: Array.isArray(p.courses) && p.courses.length ? p.courses : seedCourses,
      progress: Array.isArray(p.progress) ? p.progress : [],
      certificates: Array.isArray(p.certificates) ? p.certificates : [],
    }
  } catch {
    return { courses: seedCourses, progress: [], certificates: [] }
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
    const c: Course = {
      id: crypto.randomUUID(),
      title: title.trim(),
      description: description.trim(),
      status: 'draft',
      tags: [],
      modules: [],
      createdAt: now,
      updatedAt: now,
    }
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
            return {
              ...p,
              moduleProgress: {
                ...p.moduleProgress,
                [moduleId]: {
                  moduleId,
                  completed: true,
                  score: data?.score,
                  lastAnswers: data?.lastAnswers,
                },
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
    issueCertificate,
    resetDemo,
  }
}
