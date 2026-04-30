import { useCallback } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { Course, CourseModule, ModuleKind } from '../../types/learning'
import { emptyModule } from '../../data/learningSeedData'
import type { LearningState } from './learningStorage'
import { getSupabaseErrorMessage } from '../../lib/supabaseError'
import type { SupabaseClient } from '@supabase/supabase-js'

export type LearningCoursesDeps = {
  useSupabase: boolean
  supabase: SupabaseClient | null
  orgId: string | undefined
  catalogLocale: 'nb' | 'en'
  setState: Dispatch<SetStateAction<LearningState>>
  setError: (msg: string | null) => void
  refreshLearning: () => Promise<void>
  isMountedRef: MutableRefObject<boolean>
  canManage: boolean
}

export function useLearningCourses(deps: LearningCoursesDeps) {
  const {
    useSupabase,
    supabase,
    orgId,
    catalogLocale,
    setState,
    setError,
    refreshLearning,
    isMountedRef,
    canManage,
  } = deps

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
        prerequisiteCourseIds: [],
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
          prerequisite_course_ids: c.prerequisiteCourseIds ?? [],
          created_at: c.createdAt,
          updated_at: c.updatedAt,
        })
        if (!isMountedRef.current) return
        if (e) {
          setError(getSupabaseErrorMessage(e))
          return
        }
        await refreshLearning()
      })()
      return c
    },
    [useSupabase, supabase, orgId, setState, setError, refreshLearning, isMountedRef],
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
        if (patch.prerequisiteCourseIds !== undefined) row.prerequisite_course_ids = patch.prerequisiteCourseIds
        if (patch.recertificationMonths !== undefined) row.recertification_months = patch.recertificationMonths
        const { error: e } = await supabase.from('learning_courses').update(row).eq('id', id).eq('organization_id', orgId)
        if (!isMountedRef.current) return
        if (e) setError(getSupabaseErrorMessage(e))
        else await refreshLearning()
      })()
    },
    [useSupabase, supabase, orgId, setState, setError, refreshLearning, isMountedRef],
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
        if (!isMountedRef.current) return
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
        if (!isMountedRef.current) return
        if (e) setError(getSupabaseErrorMessage(e))
        else await refreshLearning()
      })()
      return { ...mod, order: 0 }
    },
    [useSupabase, supabase, orgId, setState, setError, refreshLearning, isMountedRef],
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
        if (!isMountedRef.current) return
        if (e) setError(getSupabaseErrorMessage(e))
        else await refreshLearning()
      })()
    },
    [useSupabase, supabase, orgId, setState, setError, refreshLearning, isMountedRef],
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
        const { error: e } = await supabase.rpc('learning_reorder_modules', {
          p_course_id: courseId,
          p_org_id: orgId,
          p_module_ids: moduleIds,
        })
        if (!isMountedRef.current) return
        if (e) {
          setError(getSupabaseErrorMessage(e))
          return
        }
        await refreshLearning()
      })()
    },
    [useSupabase, supabase, orgId, setState, setError, refreshLearning, isMountedRef],
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
        if (!isMountedRef.current) return
        if (e) setError(getSupabaseErrorMessage(e))
        else await refreshLearning()
      })()
    },
    [useSupabase, supabase, orgId, setState, setError, refreshLearning, isMountedRef],
  )

  const forkSystemCourse = useCallback(
    async (systemCourseId: string) => {
      if (!useSupabase || !supabase) return { ok: false as const, error: 'Krever innlogget organisasjon.' }
      const { data, error: e } = await supabase.rpc('learning_fork_system_course', {
        p_system_course_id: systemCourseId,
        p_locale: catalogLocale,
      })
      if (!isMountedRef.current) return { ok: false as const, error: 'Avbrutt.' }
      if (e) return { ok: false as const, error: getSupabaseErrorMessage(e) }
      await refreshLearning()
      return { ok: true as const, newCourseId: data as string }
    },
    [useSupabase, supabase, refreshLearning, catalogLocale, isMountedRef],
  )

  const bumpCourseVersion = useCallback(
    async (courseId: string) => {
      if (!useSupabase || !supabase || !canManage) return { ok: false as const, error: 'Krever tilgang.' }
      const { data, error: e } = await supabase.rpc('learning_bump_course_version', { p_course_id: courseId })
      if (!isMountedRef.current) return { ok: false as const, error: 'Avbrutt.' }
      if (e) return { ok: false as const, error: getSupabaseErrorMessage(e) }
      await refreshLearning()
      return { ok: true as const, version: data as number }
    },
    [useSupabase, supabase, canManage, refreshLearning, isMountedRef],
  )

  return {
    createCourse,
    updateCourse,
    addModule,
    updateModule,
    reorderModules,
    deleteModule,
    forkSystemCourse,
    bumpCourseVersion,
  }
}
