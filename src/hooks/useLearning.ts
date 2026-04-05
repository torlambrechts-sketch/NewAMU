import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import { useI18n } from './useI18n'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import type {
  Certificate,
  Course,
  CourseModule,
  CourseProgress,
  ModuleContent,
  ModuleKind,
  ModuleProgress,
  CourseOrigin,
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

export type SystemCourseAdminRow = {
  systemCourseId: string
  slug: string
  title: string
  enabled: boolean
  forkedCourseId: string | null
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
    return {
      courses: storedCourses,
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
  source_system_course_id?: string | null
  catalog_locale?: string | null
}

type DbOrgCourseSetting = {
  organization_id: string
  system_course_id: string
  enabled: boolean
  forked_course_id: string | null
}

type CatalogLocaleRow = {
  system_course_id: string
  locale: string
  title: string
  description: string
  modules: unknown
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
  return courseRows.map((c) => {
    const tags = c.tags ?? []
    const origin: CourseOrigin = c.source_system_course_id
      ? tags.includes('fork') || tags.includes('forked')
        ? 'fork'
        : 'system'
      : 'org'
    return {
      id: c.id,
      title: c.title,
      description: c.description ?? '',
      status: c.status as Course['status'],
      tags,
      modules: byCourse.get(c.id) ?? [],
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      sourceSystemCourseId: c.source_system_course_id ?? null,
      catalogLocale: c.catalog_locale ?? null,
      origin,
      forkedFromSystemId: null,
    }
  })
}

function moduleFromCatalogJson(raw: Record<string, unknown>): CourseModule | null {
  if (typeof raw.id !== 'string' || typeof raw.title !== 'string') return null
  const order = typeof raw.order === 'number' ? raw.order : 0
  const kind = raw.kind as ModuleKind
  const content = raw.content as ModuleContent
  const durationMinutes = typeof raw.durationMinutes === 'number' ? raw.durationMinutes : 5
  if (!content || typeof content !== 'object') return null
  return {
    id: raw.id,
    title: raw.title,
    order,
    kind,
    content,
    durationMinutes,
  }
}

function mergeCatalogIntoCourses(
  courses: Course[],
  moduleRows: DbModuleRow[],
  catalogRows: CatalogLocaleRow[],
  appLocale: 'nb' | 'en',
): Course[] {
  const hasDbModules = new Set(moduleRows.map((m) => m.course_id))
  const catalogByKey = new Map<string, CatalogLocaleRow>()
  for (const row of catalogRows) {
    catalogByKey.set(`${row.system_course_id}:${row.locale}`, row)
  }

  return courses.map((c) => {
    const sid = c.sourceSystemCourseId
    if (!sid || hasDbModules.has(c.id)) return c
    const loc = (c.catalogLocale === 'en' || c.catalogLocale === 'nb' ? c.catalogLocale : null) ?? appLocale
    const row =
      catalogByKey.get(`${sid}:${loc}`) ?? catalogByKey.get(`${sid}:nb`) ?? catalogByKey.get(`${sid}:en`)
    if (!row?.modules || !Array.isArray(row.modules)) return { ...c, modules: [], catalogLocale: loc }
    const modules = (row.modules as Record<string, unknown>[])
      .map(moduleFromCatalogJson)
      .filter(Boolean) as CourseModule[]
    modules.sort((a, b) => a.order - b.order)
    return {
      ...c,
      title: row.title || c.title,
      description: row.description ?? c.description,
      modules,
      catalogLocale: loc,
    }
  })
}

export function useLearning() {
  const { supabase, organization, user, can, refreshPermissions } = useOrgSetupContext()
  const { locale: appLocale } = useI18n()
  const orgId = organization?.id
  const userId = user?.id
  const useSupabase = !!(supabase && orgId && userId)
  const canManage = can('learning.manage')
  const catalogLocale: 'nb' | 'en' = appLocale === 'en' ? 'en' : 'nb'

  const [localState, setLocalState] = useState<LearningState>(() => load())
  const [remoteState, setRemoteState] = useState<LearningState>({
    courses: [],
    progress: [],
    certificates: [],
  })
  const [systemCourseAdmin, setSystemCourseAdmin] = useState<SystemCourseAdminRow[]>([])
  const [loading, setLoading] = useState(useSupabase)
  const [error, setError] = useState<string | null>(null)

  const refreshLearning = useCallback(async () => {
    if (!supabase || !orgId || !userId) return
    setLoading(true)
    setError(null)
    try {
      const { error: rpcErr } = await supabase.rpc('learning_ensure_system_course_rows', {
        p_locale: catalogLocale,
      })
      if (rpcErr) console.warn('learning_ensure_system_course_rows', rpcErr.message)

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
      const [cRes, mRes, setRes, sysRes, pRes, certRes] = await Promise.all([
        supabase.from('learning_courses').select('*').eq('organization_id', orgId),
        supabase.from('learning_modules').select('*').eq('organization_id', orgId),
        supabase.from('learning_org_course_settings').select('*').eq('organization_id', orgId),
        supabase.from('learning_system_courses').select('id, slug, default_locale'),
        progressQuery,
        certQuery,
      ])
      if (cRes.error) throw cRes.error
      if (mRes.error) throw mRes.error
      if (setRes.error) throw setRes.error
      if (sysRes.error) throw sysRes.error
      if (pRes.error) throw pRes.error
      if (certRes.error) throw certRes.error

      const courseRows = (cRes.data ?? []) as DbCourseRow[]
      const moduleRows = (mRes.data ?? []) as DbModuleRow[]
      const settingsRows = (setRes.data ?? []) as DbOrgCourseSetting[]
      const settingsBySystem = new Map(settingsRows.map((r) => [r.system_course_id, r]))
      const systemCourseIds = ((sysRes.data ?? []) as { id: string; slug: string; default_locale: string }[]).map(
        (s) => s.id,
      )
      let adminRows: SystemCourseAdminRow[] = []
      if (systemCourseIds.length) {
        const { data: titleData, error: titleErr } = await supabase
          .from('learning_system_course_locales')
          .select('system_course_id, locale, title')
          .in('system_course_id', systemCourseIds)
          .in('locale', ['nb', 'en'])
        if (titleErr) throw titleErr
        const titleByCourse = new Map<string, string>()
        for (const row of (titleData ?? []) as { system_course_id: string; locale: string; title: string }[]) {
          const k = row.system_course_id
          const cur = titleByCourse.get(k)
          if (!cur || row.locale === catalogLocale) {
            titleByCourse.set(k, row.title)
          }
        }
        const sysList = (sysRes.data ?? []) as { id: string; slug: string; default_locale: string }[]
        adminRows = sysList.map((s) => {
          const st = settingsBySystem.get(s.id)
          return {
            systemCourseId: s.id,
            slug: s.slug,
            title: titleByCourse.get(s.id) ?? s.slug,
            enabled: st?.enabled !== false,
            forkedCourseId: st?.forked_course_id ?? null,
          }
        })
      }
      setSystemCourseAdmin(adminRows)

      let courses = coursesFromDb(courseRows, moduleRows)

      const systemIds = [
        ...new Set(
          courseRows.filter((c) => c.source_system_course_id).map((c) => c.source_system_course_id as string),
        ),
      ]
      let catalogRows: CatalogLocaleRow[] = []
      if (systemIds.length) {
        const { data: locData, error: locErr } = await supabase
          .from('learning_system_course_locales')
          .select('system_course_id, locale, title, description, modules')
          .in('system_course_id', systemIds)
          .in('locale', ['nb', 'en'])
        if (locErr) throw locErr
        catalogRows = (locData ?? []) as CatalogLocaleRow[]
      }

      courses = mergeCatalogIntoCourses(courses, moduleRows, catalogRows, catalogLocale)

      const forkTargetIds = new Set(
        settingsRows.map((s) => s.forked_course_id).filter((x): x is string => !!x),
      )

      courses = courses
        .map((c) => {
          const sid = c.sourceSystemCourseId
          if (!sid) return c
          const st = settingsBySystem.get(sid)
          const forkId = st?.forked_course_id
          if (!forkId) return c
          const forkRow = courseRows.find((row) => row.id === forkId)
          const forkMods = moduleRows.filter((m) => m.course_id === forkId)
          if (!forkRow || forkMods.length === 0) return c
          const merged = coursesFromDb([forkRow], forkMods)[0]
          return {
            ...c,
            title: merged.title,
            description: merged.description,
            status: merged.status,
            modules: merged.modules,
            tags: merged.tags,
            origin: 'fork' as const,
            forkedFromSystemId: sid,
          }
        })
        .filter((c) => {
          if (forkTargetIds.has(c.id)) return false
          const sid = c.sourceSystemCourseId
          if (!sid) return true
          const st = settingsBySystem.get(sid)
          if (st && st.enabled === false) return false
          return true
        })

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
      setSystemCourseAdmin([])
      setRemoteState({ courses: [], progress: [], certificates: [] })
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId, userId, canManage, catalogLocale])

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

  const setSystemCourseEnabled = useCallback(
    async (systemCourseId: string, enabled: boolean) => {
      if (!useSupabase || !supabase) return { ok: false as const, error: 'Krever innlogget organisasjon.' }
      const { error: e } = await supabase.rpc('learning_set_system_course_enabled', {
        p_system_course_id: systemCourseId,
        p_enabled: enabled,
      })
      if (e) return { ok: false as const, error: getSupabaseErrorMessage(e) }
      await refreshLearning()
      return { ok: true as const }
    },
    [useSupabase, supabase, refreshLearning],
  )

  const forkSystemCourse = useCallback(
    async (systemCourseId: string) => {
      if (!useSupabase || !supabase) return { ok: false as const, error: 'Krever innlogget organisasjon.' }
      const { data, error: e } = await supabase.rpc('learning_fork_system_course', {
        p_system_course_id: systemCourseId,
        p_locale: catalogLocale,
      })
      if (e) return { ok: false as const, error: getSupabaseErrorMessage(e) }
      await refreshLearning()
      return { ok: true as const, newCourseId: data as string }
    },
    [useSupabase, supabase, refreshLearning, catalogLocale],
  )

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
    systemCourseSettings: useSupabase ? systemCourseAdmin : [],
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
    setSystemCourseEnabled,
    forkSystemCourse,
  }
}
