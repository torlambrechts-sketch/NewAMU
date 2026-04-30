import { useCallback } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { Certificate } from '../../types/learning'
import type { LearningState } from './learningStorage'
import { getSupabaseErrorMessage } from '../../lib/supabaseError'
import type { SupabaseClient } from '@supabase/supabase-js'

export type LearningCertificatesDeps = {
  useSupabase: boolean
  supabase: SupabaseClient | null
  orgId: string | undefined
  userId: string | undefined
  setState: Dispatch<SetStateAction<LearningState>>
  setError: (msg: string | null) => void
  refreshLearning: () => Promise<void>
  refreshPermissions: () => void | Promise<void>
  isMountedRef: MutableRefObject<boolean>
  canManage: boolean
}

export function useLearningCertificates(deps: LearningCertificatesDeps) {
  const {
    useSupabase,
    supabase,
    orgId,
    userId,
    setState,
    setError,
    refreshLearning,
    refreshPermissions,
    isMountedRef,
    canManage,
  } = deps

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
            courseVersion: course.courseVersion ?? 1,
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
      if (!isMountedRef.current) return null
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
        course_version?: number | null
      }
      const out: Certificate = {
        id: r.id,
        userId: userId ?? undefined,
        courseId: r.course_id,
        courseTitle: r.course_title,
        learnerName: r.learner_name,
        issuedAt: r.issued_at,
        verifyCode: r.verify_code,
        courseVersion: r.course_version ?? 1,
      }
      await refreshLearning()
      void refreshPermissions()
      return out
    },
    [useSupabase, supabase, setState, setError, refreshLearning, refreshPermissions, isMountedRef],
  )

  const submitExternalCertificate = useCallback(
    async (input: { title: string; issuer?: string; validUntil?: string | null; file: File }) => {
      if (!useSupabase || !supabase || !orgId || !userId) return { ok: false as const, error: 'Ikke innlogget.' }
      const ext = input.file.name.split('.').pop()?.toLowerCase() ?? 'bin'
      const ALLOWED_EXTS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'])
      const safeExt = ALLOWED_EXTS.has(ext) ? ext : 'bin'
      const path = `${userId}/${crypto.randomUUID()}.${safeExt}`
      const { error: upErr } = await supabase.storage.from('learning_external_certs').upload(path, input.file, {
        cacheControl: '3600',
        upsert: false,
      })
      if (!isMountedRef.current) return { ok: false as const, error: 'Avbrutt.' }
      if (upErr) return { ok: false as const, error: getSupabaseErrorMessage(upErr) }
      const { error: insErr } = await supabase.from('learning_external_certificates').insert({
        organization_id: orgId,
        user_id: userId,
        title: input.title.trim(),
        issuer: input.issuer?.trim() || null,
        valid_until: input.validUntil || null,
        storage_path: path,
      })
      if (!isMountedRef.current) return { ok: false as const, error: 'Avbrutt.' }
      if (insErr) return { ok: false as const, error: getSupabaseErrorMessage(insErr) }
      await refreshLearning()
      return { ok: true as const }
    },
    [useSupabase, supabase, orgId, userId, refreshLearning, isMountedRef],
  )

  const approveExternalCertificate = useCallback(
    async (id: string, approve: boolean, note?: string) => {
      if (!useSupabase || !supabase || !canManage) return { ok: false as const, error: 'Krever tilgang.' }
      const { error: e } = await supabase.rpc('learning_approve_external_certificate', {
        p_id: id,
        p_approve: approve,
        p_note: note ?? null,
      })
      if (!isMountedRef.current) return { ok: false as const, error: 'Avbrutt.' }
      if (e) return { ok: false as const, error: getSupabaseErrorMessage(e) }
      await refreshLearning()
      return { ok: true as const }
    },
    [useSupabase, supabase, canManage, refreshLearning, isMountedRef],
  )

  return {
    issueCertificate,
    submitExternalCertificate,
    approveExternalCertificate,
  }
}
