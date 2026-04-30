import { useCallback } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { CourseProgress, ModuleCompleteMeta, ModuleProgress } from '../../types/learning'
import type { LearningState } from './learningStorage'
import { getSupabaseErrorMessage } from '../../lib/supabaseError'
import type { SupabaseClient } from '@supabase/supabase-js'

export type LearningProgressDeps = {
  useSupabase: boolean
  supabase: SupabaseClient | null
  orgId: string | undefined
  userId: string | undefined
  setState: Dispatch<SetStateAction<LearningState>>
  setError: (msg: string | null) => void
  refreshLearning: () => Promise<void>
  isMountedRef: MutableRefObject<boolean>
}

export function useLearningProgress(deps: LearningProgressDeps) {
  const { useSupabase, supabase, orgId, userId, setState, setError, refreshLearning, isMountedRef } = deps

  const ensureProgress = useCallback(
    async (courseId: string): Promise<void> => {
      if (!useSupabase || !supabase || !orgId || !userId) {
        setState((s) => {
          if (s.progress.some((p) => p.courseId === courseId)) return s
          const np: CourseProgress = {
            courseId,
            moduleProgress: {},
            startedAt: new Date().toISOString(),
            learnerName: 'Demo',
          }
          return { ...s, progress: [...s.progress, np] }
        })
        return
      }
      const { data: existing } = await supabase
        .from('learning_course_progress')
        .select('course_id')
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .maybeSingle()
      if (!isMountedRef.current) return
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
      if (!isMountedRef.current) return
      if (e) setError(getSupabaseErrorMessage(e))
      else await refreshLearning()
    },
    [useSupabase, supabase, orgId, userId, setState, setError, refreshLearning, isMountedRef],
  )

  const setModuleCompleted = useCallback(
    (courseId: string, moduleId: string, data?: ModuleCompleteMeta) => {
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
                  learnerName: 'Demo',
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
        if (!isMountedRef.current) return
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
        if (!isMountedRef.current) return
        if (upErr) {
          setError(getSupabaseErrorMessage(upErr))
          return
        }

        const { error: streakErr } = await supabase.rpc('learning_record_activity')
        if (streakErr) console.warn('learning_record_activity', streakErr.message)

        if (data?.lastAnswers && data.quizQuestions?.length) {
          const reviewAt = new Date()
          reviewAt.setDate(reviewAt.getDate() + 7)
          const iso = reviewAt.toISOString()
          for (const q of data.quizQuestions) {
            const sel = data.lastAnswers[q.id]
            if (sel === undefined || sel === q.correctIndex) continue
            await supabase.from('learning_quiz_reviews').upsert(
              {
                organization_id: orgId,
                user_id: userId,
                course_id: courseId,
                module_id: moduleId,
                question_id: q.id,
                review_at: iso,
              },
              { onConflict: 'user_id,course_id,module_id,question_id' },
            )
          }
        }

        if (!isMountedRef.current) return
        await refreshLearning()
      })()
    },
    [useSupabase, supabase, orgId, userId, setState, setError, refreshLearning, isMountedRef],
  )

  const dismissReview = useCallback(
    async (reviewId: string) => {
      if (!useSupabase || !supabase || !userId) return
      const { error: e } = await supabase
        .from('learning_quiz_reviews')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('id', reviewId)
        .eq('user_id', userId)
      if (!isMountedRef.current) return
      if (e) setError(getSupabaseErrorMessage(e))
      else await refreshLearning()
    },
    [useSupabase, supabase, userId, setError, refreshLearning, isMountedRef],
  )

  return {
    ensureProgress,
    setModuleCompleted,
    dismissReview,
  }
}
