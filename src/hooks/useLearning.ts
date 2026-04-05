import { useCallback, useEffect, useMemo, useState } from 'react'
import { AML_COURSE } from '../data/amlCourse'
import { useOrgSetupContext } from './useOrgSetupContext'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
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

export type LearningBackend = 'local' | 'supabase'

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
  AML_COURSE,
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
    const storedCourses: Course[] = Array.isArray(p.courses) && p.courses.length ? p.courses : seedCourses
    const hasAml = storedCourses.some((c) => c.id === AML_COURSE.id)
    return {
      courses: hasAml ? storedCourses : [AML_COURSE, ...storedCourses],
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

type DbCourseRow = {
  id: string
  organization_id: string
  title: string
  description: string
  status: string
  tags: string[] | null
  created_at: string
  updated_at: string
}

type DbModuleRow = {
  id: string
  course_id: string
  title: string
  sort_order: number
  kind: string
  content: ModuleContent
  duration_minutes: number
}

type DbProgressRow = {
  user_id: string
  course_id: string
  module_progress: Record<string, ModuleProgress>
  started_at: string
  completed_at: string | null
}

type DbCertRow = {
  id: string
  course_id: string
  course_title: string
  learner_name: string
  issued_at: string
  verify_code: string
}

function moduleFromRow(m: DbModuleRow): CourseModule {
  return {
    id: m.id,
    title: m.title,
    order: m.sort_order,
    kind: m.kind as ModuleKind,
    content: m.content,
    durationMinutes: m.duration_minutes,
  }
}

function coursesFromDb(courseRows: DbCourseRow[], moduleRows: DbModuleRow[]): Course[] {
  const byCourse = new Map<string, CourseModule[]>()
  for (const m of moduleRows) {
    const list = byCourse.get(m.course_id) ?? []
    list.push(moduleFromRow(m))
    byCourse.set(m.course_id, list)
  }
  for (const [, mods] of byCourse) {
    mods.sort((a, b) => a.order - b.order)
  }
  return courseRows.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description ?? '',
    status: c.status as Course['status'],
    tags: c.tags ?? [],
    modules: byCourse.get(c.id) ?? [],
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }))
}

async function seedOrgCoursesIfEmpty(
  supabase: NonNullable<ReturnType<typeof import('../lib/supabaseClient').getSupabaseBrowserClient>>,
  organizationId: string,
): Promise<void> {
  const { count, error: cErr } = await supabase
    .from('learning_courses')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
  if (cErr) throw cErr
  if ((count ?? 0) > 0) return

  for (const course of seedCourses) {
    const { error: ic } = await supabase.from('learning_courses').insert({
      id: course.id,
      organization_id: organizationId,
      title: course.title,
      description: course.description,
      status: course.status,
      tags: course.tags,
      created_at: course.createdAt,
      updated_at: course.updatedAt,
    })
    if (ic) throw ic
    for (const mod of course.modules) {
      const { error: im } = await supabase.from('learning_modules').insert({
        id: mod.id,
        organization_id: organizationId,
        course_id: course.id,
        title: mod.title,
        sort_order: mod.order,
        kind: mod.kind,
        content: mod.content as unknown as Record<string, unknown>,
        duration_minutes: mod.durationMinutes,
      })
      if (im) throw im
    }
  }
}

export function useLearning() {
  const { supabase, organization, user, can, refreshPermissions } = useOrgSetupContext()
  const orgId = organization?.id
  const userId = user?.id
  const useSupabase = !!(supabase && orgId && userId)
  const canManage = can('learning.manage')

  const [localState, setLocalState] = useState<LearningState>(() => load())
  const [remoteState, setRemoteState] = useState<LearningState>({
    courses: [],
    progress: [],
    certificates: [],
  })
  const [loading, setLoading] = useState(useSupabase)
  const [error, setError] = useState<string | null>(null)

  const refreshLearning = useCallback(async () => {
    if (!supabase || !orgId || !userId) return
    setLoading(true)
    setError(null)
    try {
      if (canManage) {
        await seedOrgCoursesIfEmpty(supabase, orgId)
      }
      const progressQuery = supabase
        .from('learning_course_progress')
        .select('*')
        .eq('organization_id', orgId)
      if (!canManage) {
        progressQuery.eq('user_id', userId)
      }
      const certQuery = supabase.from('learning_certificates').select('*').eq('organization_id', orgId)
      if (!canManage) {
        certQuery.eq('user_id', userId)
      }
      const [cRes, mRes, pRes, certRes] = await Promise.all([
        supabase.from('learning_courses').select('*').eq('organization_id', orgId),
        supabase.from('learning_modules').select('*').eq('organization_id', orgId),
        progressQuery,
        certQuery,
      ])
      if (cRes.error) throw cRes.error
      if (mRes.error) throw mRes.error
      if (pRes.error) throw pRes.error
      if (certRes.error) throw certRes.error

      const courses = coursesFromDb((cRes.data ?? []) as DbCourseRow[], (mRes.data ?? []) as DbModuleRow[])
      const progress: CourseProgress[] = ((pRes.data ?? []) as DbProgressRow[]).map((r) => ({
        courseId: r.course_id,
        moduleProgress: r.module_progress ?? {},
        startedAt: r.started_at,
        completedAt: r.completed_at ?? undefined,
      }))
      const certificates: Certificate[] = ((certRes.data ?? []) as DbCertRow[]).map((r) => ({
        id: r.id,
        courseId: r.course_id,
        courseTitle: r.course_title,
        learnerName: r.learner_name,
        issuedAt: r.issued_at,
        verifyCode: r.verify_code,
      }))
      setRemoteState({ courses, progress, certificates })
    } catch (e) {
      setError(getSupabaseErrorMessage(e))
      setRemoteState({ courses: [], progress: [], certificates: [] })
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId, userId, canManage])

  useEffect(() => {
    if (!useSupabase) return
    void refreshLearning()
  }, [useSupabase, refreshLearning])

  useEffect(() => {
    if (useSupabase) return
    save(localState)
  }, [useSupabase, localState])

  const state = useSupabase ? remoteState : localState
  const setState = useSupabase ? setRemoteState : setLocalState

  const createCourse = useCallback(
    (title: string, description: string) => {
      const now = new Date().toISOString()
      const id = crypto.randomUUID()
      const c: Course = {
        id,
        title: title.trim(),
        description: description.trim(),
        status: 'draft',
        tags: [],
        modules: [],
        createdAt: now,
        updatedAt: now,
      }
      if (!useSupabase || !supabase || !orgId) {
        setState((s) => ({ ...s, courses: [c, ...s.courses] }))
        return c
      }
      void (async () => {
        const { error: e } = await supabase.from('learning_courses').insert({
          id: c.id,
          organization_id: orgId,
          title: c.title,
          description: c.description,
          status: c.status,
          tags: c.tags,
          created_at: c.createdAt,
          updated_at: c.updatedAt,
        })
        if (e) {
          setError(getSupabaseErrorMessage(e))
          return
        }
        await refreshLearning()
      })()
      return c
    },
    [useSupabase, supabase, orgId, setState, refreshLearning],
  )

  const updateCourse = useCallback(
    (id: string, patch: Partial<Course>) => {
      if (!useSupabase || !supabase || !orgId) {
        setState((s) => ({
          ...s,
          courses: s.courses.map((c) =>
            c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c,
          ),
        }))
        return
      }
      void (async () => {
        const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (patch.title !== undefined) row.title = patch.title
        if (patch.description !== undefined) row.description = patch.description
        if (patch.status !== undefined) row.status = patch.status
        if (patch.tags !== undefined) row.tags = patch.tags
        const { error: e } = await supabase.from('learning_courses').update(row).eq('id', id).eq('organization_id', orgId)
        if (e) setError(getSupabaseErrorMessage(e))
        else await refreshLearning()
      })()
    },
    [useSupabase, supabase, orgId, setState, refreshLearning],
  )

  const addModule = useCallback(
    (courseId: string, kind: ModuleKind, title: string): CourseModule | null => {
      const mod = emptyModule(kind, title.trim() || 'Untitled module', 0)
      if (!useSupabase || !supabase || !orgId) {
        let created: CourseModule | null = null
        setState((s) => ({
          ...s,
          courses: s.courses.map((c) => {
            if (c.id !== courseId) return c
            const order = c.modules.length
            const withOrder: CourseModule = { ...mod, order }
            created = withOrder
            return { ...c, modules: [...c.modules, withOrder], updatedAt: new Date().toISOString() }
          }),
        }))
        return created
      }
      void (async () => {
        const { count, error: cntErr } = await supabase
          .from('learning_modules')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', courseId)
          .eq('organization_id', orgId)
        if (cntErr) {
          setError(getSupabaseErrorMessage(cntErr))
          return
        }
        const order = count ?? 0
        const withOrder: CourseModule = { ...mod, order }
        const { error: e } = await supabase.from('learning_modules').insert({
          id: withOrder.id,
          organization_id: orgId,
          course_id: courseId,
          title: withOrder.title,
          sort_order: withOrder.order,
          kind: withOrder.kind,
          content: withOrder.content as unknown as Record<string, unknown>,
          duration_minutes: withOrder.durationMinutes,
        })
        if (e) setError(getSupabaseErrorMessage(e))
        else await refreshLearning()
      })()
      return { ...mod, order: 0 }
    },
    [useSupabase, supabase, orgId, setState, refreshLearning],
  )

  const updateModule = useCallback(
    (courseId: string, moduleId: string, patch: Partial<CourseModule>) => {
      if (!useSupabase || !supabase || !orgId) {
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
        return
      }
      void (async () => {
        const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (patch.title !== undefined) row.title = patch.title
        if (patch.order !== undefined) row.sort_order = patch.order
        if (patch.kind !== undefined) row.kind = patch.kind
        if (patch.content !== undefined) row.content = patch.content
        if (patch.durationMinutes !== undefined) row.duration_minutes = patch.durationMinutes
        const { error: e } = await supabase
          .from('learning_modules')
          .update(row)
          .eq('id', moduleId)
          .eq('course_id', courseId)
          .eq('organization_id', orgId)
        if (e) setError(getSupabaseErrorMessage(e))
        else await refreshLearning()
      })()
    },
    [useSupabase, supabase, orgId, setState, refreshLearning],
  )

  const reorderModules = useCallback(
    (courseId: string, moduleIds: string[]) => {
      if (!useSupabase || !supabase || !orgId) {
        setState((s) => ({
          ...s,
          courses: s.courses.map((c) => {
            if (c.id !== courseId) return c
            const map = new Map(c.modules.map((m) => [m.id, m]))
            const next = moduleIds
              .map((id, i) => {
                const m = map.get(id)
                return m ? { ...m, order: i } : null
              })
              .filter(Boolean) as CourseModule[]
            return { ...c, modules: next, updatedAt: new Date().toISOString() }
          }),
        }))
        return
      }
      void (async () => {
        for (let i = 0; i < moduleIds.length; i++) {
          const mid = moduleIds[i]
          const { error: e } = await supabase
            .from('learning_modules')
            .update({ sort_order: i, updated_at: new Date().toISOString() })
            .eq('id', mid)
            .eq('course_id', courseId)
            .eq('organization_id', orgId)
          if (e) {
            setError(getSupabaseErrorMessage(e))
            return
          }
        }
        await refreshLearning()
      })()
    },
    [useSupabase, supabase, orgId, setState, refreshLearning],
  )

  const deleteModule = useCallback(
    (courseId: string, moduleId: string) => {
      if (!useSupabase || !supabase || !orgId) {
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
        return
      }
      void (async () => {
        const { error: e } = await supabase
          .from('learning_modules')
          .delete()
          .eq('id', moduleId)
          .eq('course_id', courseId)
          .eq('organization_id', orgId)
        if (e) setError(getSupabaseErrorMessage(e))
        else await refreshLearning()
      })()
    },
    [useSupabase, supabase, orgId, setState, refreshLearning],
  )

  const ensureProgress = useCallback(
    (courseId: string) => {
      if (!useSupabase || !supabase || !orgId || !userId) {
        setState((s) => {
          if (s.progress.some((p) => p.courseId === courseId)) return s
          const np: CourseProgress = {
            courseId,
            moduleProgress: {},
            startedAt: new Date().toISOString(),
          }
          return { ...s, progress: [...s.progress, np] }
        })
        return
      }
      void (async () => {
        const { data: existing } = await supabase
          .from('learning_course_progress')
          .select('course_id')
          .eq('organization_id', orgId)
          .eq('user_id', userId)
          .eq('course_id', courseId)
          .maybeSingle()
        if (existing) {
          await refreshLearning()
          return
        }
        const { error: e } = await supabase.from('learning_course_progress').insert({
          user_id: userId,
          organization_id: orgId,
          course_id: courseId,
          module_progress: {},
          started_at: new Date().toISOString(),
        })
        if (e) setError(getSupabaseErrorMessage(e))
        else await refreshLearning()
      })()
    },
    [useSupabase, supabase, orgId, userId, setState, refreshLearning],
  )

  const setModuleCompleted = useCallback(
    (courseId: string, moduleId: string, data?: { score?: number; lastAnswers?: Record<string, number> }) => {
      if (!useSupabase || !supabase || !orgId || !userId) {
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
        return
      }
      void (async () => {
        const { data: row, error: fetchErr } = await supabase
          .from('learning_course_progress')
          .select('*')
          .eq('organization_id', orgId)
          .eq('user_id', userId)
          .eq('course_id', courseId)
          .maybeSingle()
        if (fetchErr) {
          setError(getSupabaseErrorMessage(fetchErr))
          return
        }
        const mp = {
          ...((row?.module_progress as Record<string, ModuleProgress> | undefined) ?? {}),
          [moduleId]: {
            moduleId,
            completed: true,
            score: data?.score,
            lastAnswers: data?.lastAnswers,
          },
        }
        const { error: upErr } = await supabase.from('learning_course_progress').upsert(
          {
            user_id: userId,
            organization_id: orgId,
            course_id: courseId,
            module_progress: mp,
            started_at: row?.started_at ?? new Date().toISOString(),
          },
          { onConflict: 'user_id,course_id' },
        )
        if (upErr) setError(getSupabaseErrorMessage(upErr))
        else await refreshLearning()
      })()
    },
    [useSupabase, supabase, orgId, userId, setState, refreshLearning],
  )

  const issueCertificate = useCallback(
    async (courseId: string, learnerName: string): Promise<Certificate | null> => {
      if (!useSupabase || !supabase) {
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
      }
      const { data, error: e } = await supabase.rpc('learning_issue_certificate', {
        p_course_id: courseId,
        p_learner_name: learnerName.trim() || null,
      })
      if (e) {
        setError(getSupabaseErrorMessage(e))
        return null
      }
      const r = data as {
        id: string
        course_id: string
        course_title: string
        learner_name: string
        issued_at: string
        verify_code: string
      }
      const out: Certificate = {
        id: r.id,
        courseId: r.course_id,
        courseTitle: r.course_title,
        learnerName: r.learner_name,
        issuedAt: r.issued_at,
        verifyCode: r.verify_code,
      }
      await refreshLearning()
      void refreshPermissions()
      return out
    },
    [useSupabase, supabase, setState, refreshLearning, refreshPermissions],
  )

  const stats = useMemo(() => {
    const published = state.courses.filter((c) => c.status === 'published').length
    const drafts = state.courses.filter((c) => c.status === 'draft').length
    const certs = state.certificates.length
    const enrolled = state.progress.length
    return { published, drafts, certs, enrolled, totalCourses: state.courses.length }
  }, [state])

  const resetDemo = useCallback(() => {
    if (useSupabase) {
      setError('Tilbakestilling er bare tilgjengelig i lokal demo-modus (uten organisasjon).')
      return
    }
    localStorage.removeItem(STORAGE_KEY)
    setLocalState(load())
  }, [useSupabase])

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

  const importFromJson = useCallback(
    (json: string): { ok: true } | { ok: false; error: string } => {
      if (useSupabase) {
        return { ok: false, error: 'Full import er kun tilgjengelig i lokal demo-modus. Bruk Admin for kurs.' }
      }
      try {
        const raw = JSON.parse(json) as unknown
        if (!isLearningExportPayload(raw)) {
          return { ok: false, error: 'Ugyldig fil: forventet learning export v1.' }
        }
        setLocalState({
          courses: raw.courses,
          progress: raw.progress,
          certificates: raw.certificates,
        })
        return { ok: true }
      } catch {
        return { ok: false, error: 'Kunne ikke parse JSON.' }
      }
    },
    [useSupabase],
  )

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
      if (useSupabase) {
        return { ok: false, error: 'Delvis import er kun tilgjengelig i lokal demo-modus.' }
      }
      try {
        const raw = JSON.parse(json) as unknown
        if (!isPartialExportPayload(raw)) {
          return { ok: false, error: 'Ugyldig fil: forventet delvis export (course / progress / certificates).' }
        }
        if (raw.kind === 'course') {
          const course = raw.course
          setLocalState((s) => ({
            ...s,
            courses: s.courses.some((c) => c.id === course.id)
              ? s.courses.map((c) => (c.id === course.id ? course : c))
              : [...s.courses, course],
          }))
          return { ok: true }
        }
        if (raw.kind === 'progress_slice') {
          setLocalState((s) => {
            const byCourse = new Map(s.progress.map((p) => [p.courseId, p]))
            for (const p of raw.progress) {
              byCourse.set(p.courseId, p)
            }
            return { ...s, progress: [...byCourse.values()] }
          })
          return { ok: true }
        }
        if (raw.kind === 'certificates_slice') {
          setLocalState((s) => {
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
    [useSupabase],
  )

  return {
    ...state,
    stats,
    learningBackend: (useSupabase ? 'supabase' : 'local') as LearningBackend,
    learningLoading: useSupabase && loading,
    learningError: error,
    refreshLearning,
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
    exportJson,
    importFromJson,
    exportCourseJson,
    exportProgressSliceJson,
    exportCertificatesSliceJson,
    importPartialJson,
  }
}
