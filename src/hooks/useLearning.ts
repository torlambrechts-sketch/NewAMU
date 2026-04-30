import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Certificate, Course, CourseProgress } from '../types/learning'
import { useOrgSetupContext } from './useOrgSetupContext'
import { useI18n } from './useI18n'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import {
  STORAGE_KEY,
  LEARNING_EXPORT_VERSION,
  loadLearningLocal,
  saveLearningLocal,
  isLearningExportPayload,
  isPartialExportPayload,
  type LearningState,
  type LearningExportPayload,
  type LearningPartialExportPayload,
} from './learning/learningStorage'

export {
  STORAGE_KEY,
  LEARNING_EXPORT_VERSION,
  type LearningExportPayload,
  type LearningPartialExportPayload,
} from './learning/learningStorage'

import type {
  LearningReviewItem,
  DeptLeaderboardRow,
  LearningFlowSettings,
  CertificationRenewalRow,
  ExternalCertificateRow,
  IltEventRow,
  IltRsvpStatus,
  LearningPathRow,
  PathEnrollmentRow,
  ComplianceMatrixCell,
  SystemCourseAdminRow,
} from './learning/learningTypes'
export type {
  LearningReviewItem,
  DeptLeaderboardRow,
  LearningFlowSettings,
  CertificationRenewalRow,
  ExternalCertificateRow,
  IltEventRow,
  IltRsvpStatus,
  LearningPathRow,
  PathEnrollmentRow,
  ComplianceMatrixCell,
  SystemCourseAdminRow,
} from './learning/learningTypes'
import {
  type DbCourseRow,
  type DbModuleRow,
  type DbOrgCourseSetting,
  type CatalogLocaleRow,
  type DbProgressRow,
  type DbCertRow,
  coursesFromDb,
  mergeCatalogIntoCourses,
  mapProgressRows,
  mapCertRows,
} from './learning/learningDb'
import { useLearningCourses } from './learning/useLearningCourses'
import { useLearningProgress } from './learning/useLearningProgress'
import { useLearningCertificates } from './learning/useLearningCertificates'
import { useLearningPaths } from './learning/useLearningPaths'
import { useLearningAdmin } from './learning/useLearningAdmin'

/** One successful learning fetch per org+user session */
const learningSessionHydrated = new Map<string, boolean>()

export type LearningBackend = 'local' | 'supabase'

const LEARNING_SNAPSHOT_VERSION = 1 as const

type LearningRemoteSnapshotV1 = {
  v: typeof LEARNING_SNAPSHOT_VERSION
  remoteState: LearningState
  systemCourseAdmin: SystemCourseAdminRow[]
  streakWeeks: number | null
  pendingReviews: LearningReviewItem[]
  departmentLeaderboard: DeptLeaderboardRow[]
  flowSettings: LearningFlowSettings | null
  certificationRenewals: CertificationRenewalRow[]
  externalCertificates: ExternalCertificateRow[]
  iltEvents: IltEventRow[]
  learningPaths: LearningPathRow[]
  pathEnrollments: PathEnrollmentRow[]
  complianceMatrix: ComplianceMatrixCell[]
}

const learningSnapshotMemory = new Map<string, LearningRemoteSnapshotV1>()

function learningSnapshotStorageKey(sessionKey: string) {
  return `atics-learning-snapshot-v1:${sessionKey}`
}

function parseLearningSnapshot(raw: string): LearningRemoteSnapshotV1 | null {
  try {
    const o = JSON.parse(raw) as LearningRemoteSnapshotV1
    if (o.v !== LEARNING_SNAPSHOT_VERSION) return null
    if (!o.remoteState || !Array.isArray(o.remoteState.courses)) return null
    return o
  } catch {
    return null
  }
}

function readLearningSnapshot(sessionKey: string): LearningRemoteSnapshotV1 | null {
  if (!sessionKey) return null
  const mem = learningSnapshotMemory.get(sessionKey)
  if (mem) return mem
  try {
    const raw = sessionStorage.getItem(learningSnapshotStorageKey(sessionKey))
    if (!raw) return null
    const p = parseLearningSnapshot(raw)
    if (p) learningSnapshotMemory.set(sessionKey, p)
    return p
  } catch {
    return null
  }
}

function writeLearningSnapshot(sessionKey: string, snap: LearningRemoteSnapshotV1) {
  learningSnapshotMemory.set(sessionKey, snap)
  try {
    sessionStorage.setItem(learningSnapshotStorageKey(sessionKey), JSON.stringify(snap))
  } catch {
    /* quota */
  }
}

function clearLearningSnapshot(sessionKey: string) {
  learningSnapshotMemory.delete(sessionKey)
  try {
    sessionStorage.removeItem(learningSnapshotStorageKey(sessionKey))
  } catch {
    /* ignore */
  }
}

export function useLearning() {
  const { supabase, organization, user, can, refreshPermissions } = useOrgSetupContext()
  const { locale: appLocale } = useI18n()
  const orgId = organization?.id
  const userId = user?.id
  const useSupabase = !!(supabase && orgId && userId)
  const canManage = can('learning.manage')
  const catalogLocale: 'nb' | 'en' = appLocale === 'en' ? 'en' : 'nb'

  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const learningSessionKey = orgId && userId ? `${orgId}:${userId}` : ''
  const initialSnap = learningSessionKey ? readLearningSnapshot(learningSessionKey) : null

  const [localState, setLocalState] = useState<LearningState>(() => loadLearningLocal())
  const [remoteState, setRemoteState] = useState<LearningState>(
    () => initialSnap?.remoteState ?? { courses: [], progress: [], certificates: [] },
  )
  const [systemCourseAdmin, setSystemCourseAdmin] = useState<SystemCourseAdminRow[]>(
    () => initialSnap?.systemCourseAdmin ?? [],
  )
  const [streakWeeks, setStreakWeeks] = useState<number | null>(() => initialSnap?.streakWeeks ?? null)
  const [pendingReviews, setPendingReviews] = useState<LearningReviewItem[]>(
    () => initialSnap?.pendingReviews ?? [],
  )
  const [departmentLeaderboard, setDepartmentLeaderboard] = useState<DeptLeaderboardRow[]>(
    () => initialSnap?.departmentLeaderboard ?? [],
  )
  const [flowSettings, setFlowSettings] = useState<LearningFlowSettings | null>(
    () => initialSnap?.flowSettings ?? null,
  )
  const [certificationRenewals, setCertificationRenewals] = useState<CertificationRenewalRow[]>(
    () => initialSnap?.certificationRenewals ?? [],
  )
  const [externalCertificates, setExternalCertificates] = useState<ExternalCertificateRow[]>(
    () => initialSnap?.externalCertificates ?? [],
  )
  const [iltEvents, setIltEvents] = useState<IltEventRow[]>(() => initialSnap?.iltEvents ?? [])
  const [learningPaths, setLearningPaths] = useState<LearningPathRow[]>(
    () => initialSnap?.learningPaths ?? [],
  )
  const [pathEnrollments, setPathEnrollments] = useState<PathEnrollmentRow[]>(
    () => initialSnap?.pathEnrollments ?? [],
  )
  const [complianceMatrix, setComplianceMatrix] = useState<ComplianceMatrixCell[]>(
    () => initialSnap?.complianceMatrix ?? [],
  )
  const [loading, setLoading] = useState(useSupabase)
  const [error, setError] = useState<string | null>(null)

  const setErrorSafe = useCallback((msg: string | null) => {
    if (!isMountedRef.current) return
    setError(msg)
  }, [])

  const refreshLearning = useCallback(async () => {
    if (!supabase || !orgId || !userId) return
    const sessionKey = `${orgId}:${userId}`
    const alreadyHydrated = learningSessionHydrated.get(sessionKey) === true
    if (!alreadyHydrated && isMountedRef.current) setLoading(true)
    if (isMountedRef.current) setError(null)
    try {
      const { error: enrollErr } = await supabase.rpc('learning_refresh_path_enrollments_for_user')
      if (enrollErr) console.warn('learning_refresh_path_enrollments_for_user', enrollErr.message)

      const { error: rpcErr } = await supabase.rpc('learning_ensure_system_course_rows', {
        p_locale: catalogLocale,
      })
      if (rpcErr) console.warn('learning_ensure_system_course_rows', rpcErr.message)

      const progressQuery = supabase
        .from('learning_course_progress')
        .select('*')
        .eq('organization_id', orgId)
        .order('started_at', { ascending: false })
        .limit(500)
      if (!canManage) progressQuery.eq('user_id', userId)

      const certQuery = supabase
        .from('learning_certificates')
        .select('*')
        .eq('organization_id', orgId)
        .order('issued_at', { ascending: false })
        .limit(200)
      if (!canManage) certQuery.eq('user_id', userId)

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
          if (!cur || row.locale === catalogLocale) titleByCourse.set(k, row.title)
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
      if (!isMountedRef.current) return
      setSystemCourseAdmin(adminRows)

      let courses = coursesFromDb(courseRows, moduleRows)
      const systemIds = [
        ...new Set(courseRows.filter((c) => c.source_system_course_id).map((c) => c.source_system_course_id as string)),
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
      const forkTargetIds = new Set(settingsRows.map((s) => s.forked_course_id).filter((x): x is string => !!x))
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

      const progressRows = (pRes.data ?? []) as DbProgressRow[]
      const progressUserIds = [...new Set(progressRows.map((r) => r.user_id))]
      let profileNameById = new Map<string, string>()
      if (progressUserIds.length) {
        const { data: profRows, error: profErr } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', progressUserIds)
        if (profErr) console.warn('profiles for learning progress', profErr.message)
        else
          profileNameById = new Map(
            ((profRows ?? []) as { id: string; display_name: string }[]).map((p) => [p.id, p.display_name]),
          )
      }
      const progress = mapProgressRows(progressRows, profileNameById)
      const certificates = mapCertRows((certRes.data ?? []) as DbCertRow[])
      const nextRemoteState: LearningState = { courses, progress, certificates }

      const renewQuery = supabase
        .from('learning_certification_renewals')
        .select('id, user_id, course_id, certificate_id, expires_at, status')
        .eq('organization_id', orgId)
      if (!canManage) renewQuery.eq('user_id', userId)

      const extQuery = supabase
        .from('learning_external_certificates')
        .select('id, title, issuer, valid_until, status, created_at')
        .eq('organization_id', orgId)
      if (!canManage) extQuery.eq('user_id', userId)

      const iltQuery = supabase
        .from('learning_ilt_events')
        .select('id, course_id, module_id, title, starts_at, ends_at, location_text, meeting_url, instructor_name')
        .eq('organization_id', orgId)

      const pathsQuery = supabase
        .from('learning_paths')
        .select(
          `
          id,
          name,
          slug,
          description,
          learning_path_courses ( course_id, sort_order ),
          learning_path_rules ( metadata_key, expected_value )
        `,
        )
        .eq('organization_id', orgId)

      const enrollQuery = supabase
        .from('learning_path_enrollments')
        .select('path_id, enrolled_at')
        .eq('user_id', userId)

      const matrixPromise = canManage ? supabase.rpc('learning_compliance_matrix') : Promise.resolve({ data: null, error: null })

      const [
        { data: streakRow },
        { data: revRows },
        lbRes,
        fsRes,
        renewRes,
        extRes,
        iltRes,
        pathsRes,
        enRes,
        matrixRes,
      ] = await Promise.all([
        supabase.from('learning_streaks').select('streak_weeks').eq('user_id', userId).eq('organization_id', orgId).maybeSingle(),
        supabase
          .from('learning_quiz_reviews')
          .select('id, course_id, module_id, question_id, review_at')
          .eq('user_id', userId)
          .eq('organization_id', orgId)
          .is('dismissed_at', null)
          .lte('review_at', new Date().toISOString())
          .order('review_at', { ascending: true })
          .limit(20),
        supabase.rpc('learning_department_leaderboard'),
        supabase.from('learning_flow_settings').select('*').eq('organization_id', orgId).maybeSingle(),
        renewQuery,
        extQuery,
        iltQuery,
        pathsQuery,
        enrollQuery,
        matrixPromise,
      ])

      const nextStreakWeeks = typeof streakRow?.streak_weeks === 'number' ? streakRow.streak_weeks : null
      const nextPendingReviews = (
        (revRows ?? []) as { id: string; course_id: string; module_id: string; question_id: string; review_at: string }[]
      ).map((r) => ({
        id: r.id,
        courseId: r.course_id,
        moduleId: r.module_id,
        questionId: r.question_id,
        reviewAt: r.review_at,
      }))
      const nextDepartmentLeaderboard = !lbRes.error && Array.isArray(lbRes.data)
        ? (lbRes.data as { department_id: string; department_name: string; member_count: number; avg_completion_pct: number }[]).map(
            (r) => ({
              departmentId: r.department_id,
              departmentName: r.department_name,
              memberCount: r.member_count,
              avgCompletionPct: Number(r.avg_completion_pct),
            }),
          )
        : []
      const fs = fsRes.data as {
        teams_webhook_url?: string | null
        slack_webhook_url?: string | null
        generic_webhook_url?: string | null
      } | null
      const nextFlowSettings: LearningFlowSettings | null =
        !fsRes.error && fs
          ? {
              teamsWebhookUrl: fs.teams_webhook_url ?? null,
              slackWebhookUrl: fs.slack_webhook_url ?? null,
              genericWebhookUrl: fs.generic_webhook_url ?? null,
            }
          : null

      const nextCertificationRenewals = !renewRes.error && Array.isArray(renewRes.data)
        ? (
            renewRes.data as {
              id: string
              user_id: string
              course_id: string
              certificate_id: string | null
              expires_at: string
              status: string
            }[]
          ).map((r) => ({
            id: r.id,
            userId: r.user_id,
            courseId: r.course_id,
            certificateId: r.certificate_id,
            expiresAt: r.expires_at,
            status: r.status as CertificationRenewalRow['status'],
          }))
        : []

      const nextExternalCertificates = !extRes.error && Array.isArray(extRes.data)
        ? (extRes.data as { id: string; title: string; issuer: string | null; valid_until: string | null; status: string; created_at: string }[]).map(
            (r) => ({
              id: r.id,
              title: r.title,
              issuer: r.issuer,
              validUntil: r.valid_until,
              status: r.status as ExternalCertificateRow['status'],
              createdAt: r.created_at,
            }),
          )
        : []

      const nextIltEvents = !iltRes.error && Array.isArray(iltRes.data)
        ? (iltRes.data as {
            id: string
            course_id: string
            module_id: string
            title: string
            starts_at: string
            ends_at: string | null
            location_text: string | null
            meeting_url: string | null
            instructor_name: string | null
          }[]).map((r) => ({
            id: r.id,
            courseId: r.course_id,
            moduleId: r.module_id,
            title: r.title,
            startsAt: r.starts_at,
            endsAt: r.ends_at,
            locationText: r.location_text,
            meetingUrl: r.meeting_url,
            instructorName: r.instructor_name,
          }))
        : []

      const nextLearningPaths = !pathsRes.error && Array.isArray(pathsRes.data)
        ? (pathsRes.data as {
            id: string
            name: string
            slug: string
            description: string | null
            learning_path_courses?: { course_id: string; sort_order: number }[] | null
            learning_path_rules?: { metadata_key: string; expected_value: unknown }[] | null
          }[]).map((p) => {
            const pcs = [...(p.learning_path_courses ?? [])].sort((a, b) => a.sort_order - b.sort_order)
            return {
              id: p.id,
              name: p.name,
              slug: p.slug,
              description: p.description ?? '',
              courseIds: pcs.map((x) => x.course_id),
              rules: (p.learning_path_rules ?? []).map((r) => ({
                metadataKey: r.metadata_key,
                expectedValue: r.expected_value,
              })),
            }
          })
        : []

      const nextPathEnrollments = !enRes.error && Array.isArray(enRes.data)
        ? (enRes.data as { path_id: string; enrolled_at: string }[]).map((r) => ({
            pathId: r.path_id,
            enrolledAt: r.enrolled_at,
          }))
        : []

      const nextComplianceMatrix = !matrixRes.error && Array.isArray(matrixRes.data)
        ? (matrixRes.data as {
            user_id: string
            display_name: string
            course_id: string
            course_title: string
            cell_status: string
            completion_pct: number
          }[]).map((r) => ({
            userId: r.user_id,
            displayName: r.display_name,
            courseId: r.course_id,
            courseTitle: r.course_title,
            cellStatus: r.cell_status as ComplianceMatrixCell['cellStatus'],
            completionPct: Number(r.completion_pct),
          }))
        : []

      writeLearningSnapshot(sessionKey, {
        v: LEARNING_SNAPSHOT_VERSION,
        remoteState: nextRemoteState,
        systemCourseAdmin: adminRows,
        streakWeeks: nextStreakWeeks,
        pendingReviews: nextPendingReviews,
        departmentLeaderboard: nextDepartmentLeaderboard,
        flowSettings: nextFlowSettings,
        certificationRenewals: nextCertificationRenewals,
        externalCertificates: nextExternalCertificates,
        iltEvents: nextIltEvents,
        learningPaths: nextLearningPaths,
        pathEnrollments: nextPathEnrollments,
        complianceMatrix: nextComplianceMatrix,
      })

      if (!isMountedRef.current) return
      setRemoteState(nextRemoteState)
      setStreakWeeks(nextStreakWeeks)
      setPendingReviews(nextPendingReviews)
      setDepartmentLeaderboard(nextDepartmentLeaderboard)
      setFlowSettings(nextFlowSettings)
      setCertificationRenewals(nextCertificationRenewals)
      setExternalCertificates(nextExternalCertificates)
      setIltEvents(nextIltEvents)
      setLearningPaths(nextLearningPaths)
      setPathEnrollments(nextPathEnrollments)
      setComplianceMatrix(nextComplianceMatrix)

      learningSessionHydrated.set(sessionKey, true)
    } catch (e) {
      learningSessionHydrated.set(sessionKey, true)
      clearLearningSnapshot(sessionKey)
      if (!isMountedRef.current) return
      setErrorSafe(getSupabaseErrorMessage(e))
      setSystemCourseAdmin([])
      setStreakWeeks(null)
      setPendingReviews([])
      setDepartmentLeaderboard([])
      setFlowSettings(null)
      setCertificationRenewals([])
      setExternalCertificates([])
      setIltEvents([])
      setLearningPaths([])
      setPathEnrollments([])
      setComplianceMatrix([])
      setRemoteState({ courses: [], progress: [], certificates: [] })
    } finally {
      if (isMountedRef.current) setLoading(false)
    }
  }, [supabase, orgId, userId, canManage, catalogLocale, setErrorSafe])

  useEffect(() => {
    if (!orgId || !userId) return
    learningSessionHydrated.delete(`${orgId}:${userId}`)
  }, [orgId, userId])

  useEffect(() => {
    if (!useSupabase) return
    void refreshLearning()
  }, [useSupabase, refreshLearning])

  useEffect(() => {
    if (useSupabase) return
    saveLearningLocal(localState)
  }, [useSupabase, localState])

  const state = useSupabase ? remoteState : localState
  const setState = useSupabase ? setRemoteState : setLocalState

  const courseDeps = useMemo(
    () => ({
      useSupabase,
      supabase,
      orgId,
      catalogLocale,
      setState,
      setError: setErrorSafe,
      refreshLearning,
      isMountedRef,
      canManage,
    }),
    [useSupabase, supabase, orgId, catalogLocale, setState, setErrorSafe, refreshLearning, canManage],
  )

  const progressDeps = useMemo(
    () => ({
      useSupabase,
      supabase,
      orgId,
      userId,
      setState,
      setError: setErrorSafe,
      refreshLearning,
      isMountedRef,
    }),
    [useSupabase, supabase, orgId, userId, setState, setErrorSafe, refreshLearning],
  )

  const certDeps = useMemo(
    () => ({
      useSupabase,
      supabase,
      orgId,
      userId,
      setState,
      setError: setErrorSafe,
      refreshLearning,
      refreshPermissions,
      isMountedRef,
      canManage,
    }),
    [useSupabase, supabase, orgId, userId, setState, setErrorSafe, refreshLearning, refreshPermissions, canManage],
  )

  const pathsDeps = useMemo(
    () => ({
      useSupabase,
      supabase,
      orgId,
      canManage,
      refreshLearning,
      isMountedRef,
    }),
    [useSupabase, supabase, orgId, canManage, refreshLearning],
  )

  const adminDeps = useMemo(
    () => ({
      useSupabase,
      supabase,
      orgId,
      canManage,
      flowSettings,
      refreshLearning,
      isMountedRef,
    }),
    [useSupabase, supabase, orgId, canManage, flowSettings, refreshLearning],
  )

  const {
    createCourse,
    updateCourse,
    addModule,
    updateModule,
    reorderModules,
    deleteModule,
    forkSystemCourse,
    bumpCourseVersion,
  } = useLearningCourses(courseDeps)

  const { ensureProgress, setModuleCompleted, dismissReview } = useLearningProgress(progressDeps)

  const { issueCertificate, submitExternalCertificate, approveExternalCertificate } =
    useLearningCertificates(certDeps)

  const { saveLearningPath, deleteLearningPath } = useLearningPaths(pathsDeps)

  const { saveFlowSettings, setSystemCourseEnabled } = useLearningAdmin(adminDeps)

  const stats = useMemo(() => {
    const published = state.courses.filter((c) => c.status === 'published').length
    const drafts = state.courses.filter((c) => c.status === 'draft').length
    const certs = state.certificates.length
    const enrolled = state.progress.length
    return { published, drafts, certs, enrolled, totalCourses: state.courses.length }
  }, [state])

  const isCourseUnlocked = useCallback(
    (courseId: string) => {
      const c = state.courses.find((x) => x.id === courseId)
      if (!c?.prerequisiteCourseIds?.length) return true
      for (const pre of c.prerequisiteCourseIds) {
        const preCourse = state.courses.find((x) => x.id === pre)
        if (!preCourse?.modules.length) return false
        const prog = state.progress.find((p) => p.courseId === pre)
        const done = preCourse.modules.every((m) => prog?.moduleProgress[m.id]?.completed)
        if (!done) return false
      }
      return true
    },
    [state.courses, state.progress],
  )

  const resetDemo = useCallback(() => {
    if (useSupabase) {
      setErrorSafe('Tilbakestilling er bare tilgjengelig i lokal demo-modus (uten organisasjon).')
      return
    }
    localStorage.removeItem(STORAGE_KEY)
    setLocalState(loadLearningLocal())
  }, [useSupabase, setErrorSafe])

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

  const upsertIltEvent = useCallback(
    async (input: {
      courseId: string
      moduleId: string
      title: string
      startsAt: string
      endsAt?: string | null
      locationText?: string | null
      meetingUrl?: string | null
      instructorName?: string | null
    }) => {
      if (!useSupabase || !supabase || !orgId || !canManage) return { ok: false as const, error: 'Krever tilgang.' }
      const row = {
        organization_id: orgId,
        course_id: input.courseId,
        module_id: input.moduleId,
        title: input.title.trim(),
        starts_at: input.startsAt,
        ends_at: input.endsAt ?? null,
        location_text: input.locationText ?? null,
        meeting_url: input.meetingUrl ?? null,
        instructor_name: input.instructorName ?? null,
      }
      const { error: e } = await supabase.from('learning_ilt_events').upsert(row, {
        onConflict: 'course_id,module_id',
      })
      if (!isMountedRef.current) return { ok: false as const, error: 'Avbrutt.' }
      if (e) return { ok: false as const, error: getSupabaseErrorMessage(e) }
      await refreshLearning()
      return { ok: true as const }
    },
    [useSupabase, supabase, orgId, canManage, refreshLearning],
  )

  const setIltRsvp = useCallback(
    async (eventId: string, status: IltRsvpStatus) => {
      if (!useSupabase || !supabase || !userId) return { ok: false as const, error: 'Ikke innlogget.' }
      const { error: e } = await supabase.from('learning_ilt_rsvps').upsert(
        {
          event_id: eventId,
          user_id: userId,
          status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'event_id,user_id' },
      )
      if (!isMountedRef.current) return { ok: false as const, error: 'Avbrutt.' }
      if (e) return { ok: false as const, error: getSupabaseErrorMessage(e) }
      await refreshLearning()
      return { ok: true as const }
    },
    [useSupabase, supabase, userId, refreshLearning],
  )

  const setIltAttendance = useCallback(
    async (eventId: string, attendeeUserId: string, present: boolean) => {
      if (!useSupabase || !supabase || !orgId || !userId || !canManage) return { ok: false as const, error: 'Krever tilgang.' }
      const { error: e } = await supabase.from('learning_ilt_attendance').upsert(
        {
          event_id: eventId,
          user_id: attendeeUserId,
          present,
          marked_by: userId,
          marked_at: new Date().toISOString(),
        },
        { onConflict: 'event_id,user_id' },
      )
      if (!isMountedRef.current) return { ok: false as const, error: 'Avbrutt.' }
      if (e) return { ok: false as const, error: getSupabaseErrorMessage(e) }
      await refreshLearning()
      return { ok: true as const }
    },
    [useSupabase, supabase, orgId, userId, canManage, refreshLearning],
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

  const learningDataReady =
    !useSupabase || (learningSessionKey !== '' && learningSessionHydrated.get(learningSessionKey) === true)

  return {
    ...state,
    stats,
    learningBackend: (useSupabase ? 'supabase' : 'local') as LearningBackend,
    learningLoading: useSupabase && loading && !learningDataReady,
    learningDataReady,
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
    streakWeeks: useSupabase ? streakWeeks : null,
    pendingReviews: useSupabase ? pendingReviews : [],
    departmentLeaderboard: useSupabase ? departmentLeaderboard : [],
    flowSettings: useSupabase ? flowSettings : null,
    isCourseUnlocked,
    dismissReview,
    saveFlowSettings,
    certificationRenewals: useSupabase ? certificationRenewals : [],
    externalCertificates: useSupabase ? externalCertificates : [],
    iltEvents: useSupabase ? iltEvents : [],
    learningPaths: useSupabase ? learningPaths : [],
    pathEnrollments: useSupabase ? pathEnrollments : [],
    complianceMatrix: useSupabase && canManage ? complianceMatrix : [],
    bumpCourseVersion,
    upsertIltEvent,
    setIltRsvp,
    setIltAttendance,
    submitExternalCertificate,
    approveExternalCertificate,
    saveLearningPath,
    deleteLearningPath,
  }
}
