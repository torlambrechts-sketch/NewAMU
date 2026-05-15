import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import { useI18n } from './useI18n'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import type {
  Certificate,
  Course,
  CourseModule,
  CourseProgress,
  CourseSection,
  ModuleContent,
  ModuleKind,
  ModuleProgress,
  CourseOrigin,
  ModuleCompleteMeta,
  TemplateMetadataSchema,
  LearnerVersionDiff,
  LocaleVersionHistoryRow,
  MyCompletionRow,
} from '../types/learning'
import {
  parseAllCoursesExportJson,
  type AllCoursesExportJson,
  type SystemCourseJson,
} from '../lib/learning/courseJsonIo'

export const STORAGE_KEY = 'atics-learning-v1'

export const LEARNING_EXPORT_VERSION = 1

/** One successful learning fetch per org+user session — avoids toggling loading on every navigation/remount when data already exists. */
const learningSessionHydrated = new Map<string, boolean>()

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

export type LearningReviewItem = {
  id: string
  courseId: string
  moduleId: string
  questionId: string
  reviewAt: string
}

export type DeptLeaderboardRow = {
  departmentId: string
  departmentName: string
  memberCount: number
  avgCompletionPct: number
}

export type LearningFlowSettings = {
  teamsWebhookUrl: string | null
  slackWebhookUrl: string | null
  genericWebhookUrl: string | null
}

export type CertificationRenewalRow = {
  id: string
  courseId: string
  certificateId: string | null
  expiresAt: string
  status: 'compliant' | 'expiring_soon' | 'expired' | 'renewed'
}

export type IssueCertificateResult =
  | { ok: true; certificate: Certificate }
  | { ok: false; error: string }

export type ExternalCertificateRow = {
  id: string
  title: string
  issuer: string | null
  validUntil: string | null
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

export type IltEventRow = {
  id: string
  courseId: string
  moduleId: string
  title: string
  startsAt: string
  endsAt: string | null
  locationText: string | null
  meetingUrl: string | null
  instructorName: string | null
}

export type IltRsvpStatus = 'going' | 'declined' | 'waitlist'

export type LearningPathRow = {
  id: string
  name: string
  slug: string
  description: string
  courseIds: string[]
  rules: { metadataKey: string; expectedValue: unknown }[]
}

export type PathEnrollmentRow = {
  pathId: string
  enrolledAt: string
}

export type ComplianceMatrixCell = {
  userId: string
  displayName: string
  courseId: string
  courseTitle: string
  cellStatus: 'not_started' | 'in_progress' | 'complete'
  completionPct: number
}

export type SystemCourseAdminRow = {
  systemCourseId: string
  slug: string
  title: string
  enabled: boolean
  forkedCourseId: string | null
}

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
    /* quota / private mode */
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
    case 'event':
      content = {
        kind: 'event',
        instructions: '<p>Instruksjoner for økt (sted, forberedelser, lenke).</p>',
      }
      break
    case 'scenario':
      content = {
        kind: 'scenario',
        intro: 'Sett deg inn i situasjonen og velg det handlingsalternativet du mener er riktig.',
        passingImpactScore: 0,
        steps: [
          {
            id: crypto.randomUUID(),
            prompt: 'Beskriv situasjonen som lederen står overfor…',
            choices: [
              { id: crypto.randomUUID(), label: 'Handlingsvalg A', impactScore: 5, feedback: 'God begrunnelse for hvorfor dette er riktig.' },
              { id: crypto.randomUUID(), label: 'Handlingsvalg B', impactScore: -3, feedback: 'Forklaring på hvorfor dette ikke er optimalt.' },
            ],
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
  prerequisite_course_ids?: string[] | null
  course_version?: number | null
  recertification_months?: number | null
  metadata_schema?: TemplateMetadataSchema | null
  law_refs?: string[] | null
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
  // JSONB bucket for locale-level extension fields (badges, milestones,
  // lawRefs catalog, schemaVersion, …) written by
  // learning_admin_upsert_system_course via JSONB subtraction.
  meta: Record<string, unknown> | null
  version_major: number | null
  version_minor: number | null
  version_published_at: string | null
  change_notes_md: string | null
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
  started_version_major?: number | null
  started_version_minor?: number | null
  location_id_at_completion?: string | null
  department_id_at_completion?: string | null
  team_id_at_completion?: string | null
  metadata?: Record<string, unknown> | null
}

type DbCertRow = {
  id: string
  course_id: string
  course_title: string
  learner_name: string
  issued_at: string
  verify_code: string
  course_version?: number | null
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
      prerequisiteCourseIds: c.prerequisite_course_ids ?? [],
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      sourceSystemCourseId: c.source_system_course_id ?? null,
      catalogLocale: c.catalog_locale ?? null,
      origin,
      forkedFromSystemId: null,
      courseVersion: c.course_version ?? 1,
      recertificationMonths: c.recertification_months ?? null,
      metadataSchema: c.metadata_schema ?? { fields: [] },
      lawRefs: c.law_refs ?? [],
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
  const refLawIds = Array.isArray(raw.refLawIds)
    ? (raw.refLawIds.filter((x) => typeof x === 'string') as string[])
    : Array.isArray((raw.content as { refLawIds?: unknown }).refLawIds)
      ? (((raw.content as { refLawIds?: unknown }).refLawIds as unknown[]).filter(
          (x) => typeof x === 'string',
        ) as string[])
      : undefined
  // Course exports nest `points` / `badgeId` under `config: {…}`; fall back to
  // top-level keys for hand-authored modules. Either shape works at runtime.
  const config = (raw.config as Record<string, unknown> | undefined) ?? {}
  const points =
    typeof raw.points === 'number'
      ? raw.points
      : typeof config.points === 'number'
        ? config.points
        : undefined
  const badgeId =
    typeof raw.badgeId === 'string'
      ? raw.badgeId
      : typeof config.badgeId === 'string'
        ? config.badgeId
        : undefined
  return {
    id: raw.id,
    title: raw.title,
    order,
    kind,
    content,
    durationMinutes,
    refLawIds,
    points,
    badgeId,
  }
}

/** Bundle export shape for a single org course (omits id; caller adds it). */
type CourseBundleEntry = {
  title: string
  description: string
  status: Course['status']
  tags: string[]
  recertificationMonths: number | null
  lawRefs: string[]
  metadataSchema: TemplateMetadataSchema | null
  modules: {
    title: string
    kind: ModuleKind
    durationMinutes: number
    order: number
    content: ModuleContent
  }[]
}

function serialiseCourseForBundle(course: Course): CourseBundleEntry {
  return {
    title: course.title,
    description: course.description,
    status: course.status,
    tags: course.tags ?? [],
    recertificationMonths: course.recertificationMonths ?? null,
    lawRefs: course.lawRefs ?? [],
    metadataSchema: course.metadataSchema ?? null,
    modules: course.modules.map((m) => ({
      title: m.title,
      kind: m.kind,
      durationMinutes: m.durationMinutes,
      order: m.order,
      content: m.content,
    })),
  }
}

function hydrateCourseFromBundle(
  c: { id: string; title: string; description?: string; status?: Course['status']; tags?: string[];
       recertificationMonths?: number | null; lawRefs?: string[]; metadataSchema?: unknown;
       modules: { title: string; kind: ModuleKind; durationMinutes?: number; order?: number; content?: unknown }[] },
  existing?: Course,
): Course {
  const now = new Date().toISOString()
  return {
    id: c.id,
    title: c.title,
    description: c.description ?? '',
    status: (c.status ?? 'draft') as Course['status'],
    tags: c.tags ?? [],
    modules: c.modules.map((m, i) => ({
      id: crypto.randomUUID(),
      title: m.title,
      kind: m.kind,
      durationMinutes: m.durationMinutes ?? 5,
      order: typeof m.order === 'number' ? m.order : i,
      content: (m.content ?? {}) as ModuleContent,
    })),
    prerequisiteCourseIds: existing?.prerequisiteCourseIds ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    sourceSystemCourseId: existing?.sourceSystemCourseId ?? null,
    catalogLocale: existing?.catalogLocale ?? null,
    origin: existing?.origin ?? 'org',
    forkedFromSystemId: existing?.forkedFromSystemId ?? null,
    courseVersion: existing?.courseVersion ?? 1,
    recertificationMonths: c.recertificationMonths ?? null,
    metadataSchema: (c.metadataSchema as TemplateMetadataSchema | null) ?? { fields: [] },
    lawRefs: c.lawRefs ?? [],
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
    // Locale-level extension fields written via JSON import land in `meta`
    // (see learning_admin_upsert_system_course). Spread the gamification
    // primitives onto the Course so GamificationHUD has real data without
    // an extra round-trip.
    const meta = row.meta ?? {}
    const badges = Array.isArray(meta.badges) ? (meta.badges as Course['badges']) : undefined
    const milestones = Array.isArray(meta.milestones)
      ? (meta.milestones as Course['milestones'])
      : undefined
    return {
      ...c,
      title: row.title || c.title,
      description: row.description ?? c.description,
      modules,
      catalogLocale: loc,
      localeVersionMajor: row.version_major ?? 1,
      localeVersionMinor: row.version_minor ?? 0,
      localeVersionPublishedAt: row.version_published_at ?? null,
      localeChangeNotesMd: row.change_notes_md ?? null,
      ...(badges ? { badges } : {}),
      ...(milestones ? { milestones } : {}),
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

  const learningSessionKey = orgId && userId ? `${orgId}:${userId}` : ''
  const initialSnap = learningSessionKey ? readLearningSnapshot(learningSessionKey) : null

  const [localState, setLocalState] = useState<LearningState>(() => load())
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

  const refreshLearning = useCallback(async () => {
    if (!supabase || !orgId || !userId) return
    const sessionKey = `${orgId}:${userId}`
    const alreadyHydrated = learningSessionHydrated.get(sessionKey) === true
    if (!alreadyHydrated) setLoading(true)
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
          .select(
            'system_course_id, locale, title, description, modules, meta, version_major, version_minor, version_published_at, change_notes_md',
          )
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

      const progressRows = (pRes.data ?? []) as DbProgressRow[]
      const progressUserIds = [...new Set(progressRows.map((r) => r.user_id))]
      let profileNameById = new Map<string, string>()
      if (progressUserIds.length && supabase) {
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
      const progress: CourseProgress[] = progressRows.map((r) => ({
        userId: r.user_id,
        learnerName: profileNameById.get(r.user_id)?.trim() || '—',
        courseId: r.course_id,
        moduleProgress: r.module_progress ?? {},
        startedAt: r.started_at,
        completedAt: r.completed_at ?? undefined,
        startedVersionMajor: r.started_version_major ?? null,
        startedVersionMinor: r.started_version_minor ?? null,
        locationIdAtCompletion: r.location_id_at_completion ?? null,
        departmentIdAtCompletion: r.department_id_at_completion ?? null,
        teamIdAtCompletion: r.team_id_at_completion ?? null,
        metadata: r.metadata ?? {},
      }))
      const certificates: Certificate[] = ((certRes.data ?? []) as DbCertRow[]).map((r) => ({
        id: r.id,
        courseId: r.course_id,
        courseTitle: r.course_title,
        learnerName: r.learner_name,
        issuedAt: r.issued_at,
        verifyCode: r.verify_code,
        courseVersion: r.course_version ?? 1,
      }))
      const nextRemoteState: LearningState = { courses, progress, certificates }

      const renewQuery = supabase
        .from('learning_certification_renewals')
        .select('id, course_id, certificate_id, expires_at, status')
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
      /** GDPR data minimisation: suppress small departments (same threshold as survey k-anonymity). */
      const DEPT_LEADERBOARD_MIN_MEMBERS = 5
      const nextDepartmentLeaderboard = !lbRes.error && Array.isArray(lbRes.data)
        ? (lbRes.data as { department_id: string; department_name: string; member_count: number; avg_completion_pct: number }[])
            .filter((r) => Number(r.member_count) >= DEPT_LEADERBOARD_MIN_MEMBERS)
            .map((r) => ({
              departmentId: r.department_id,
              departmentName: r.department_name,
              memberCount: r.member_count,
              avgCompletionPct: Number(r.avg_completion_pct),
            }))
        : []
      const fs = fsRes.data as { teams_webhook_url?: string | null; slack_webhook_url?: string | null; generic_webhook_url?: string | null } | null
      const nextFlowSettings: LearningFlowSettings | null =
        !fsRes.error && fs
          ? {
              teamsWebhookUrl: fs.teams_webhook_url ?? null,
              slackWebhookUrl: fs.slack_webhook_url ?? null,
              genericWebhookUrl: fs.generic_webhook_url ?? null,
            }
          : null

      const nextCertificationRenewals = !renewRes.error && Array.isArray(renewRes.data)
        ? (renewRes.data as { id: string; course_id: string; certificate_id: string | null; expires_at: string; status: string }[]).map(
            (r) => ({
              id: r.id,
              courseId: r.course_id,
              certificateId: r.certificate_id,
              expiresAt: r.expires_at,
              status: r.status as CertificationRenewalRow['status'],
            }),
          )
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
      setError(getSupabaseErrorMessage(e))
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
      setLoading(false)
    }
  }, [supabase, orgId, userId, canManage, catalogLocale])

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
        if (patch.prerequisiteCourseIds !== undefined) row.prerequisite_course_ids = patch.prerequisiteCourseIds
        if (patch.recertificationMonths !== undefined) row.recertification_months = patch.recertificationMonths
        if (patch.metadataSchema !== undefined) row.metadata_schema = patch.metadataSchema ?? { fields: [] }
        if (patch.lawRefs !== undefined) row.law_refs = patch.lawRefs ?? []
        const { error: e } = await supabase.from('learning_courses').update(row).eq('id', id).eq('organization_id', orgId)
        if (e) setError(getSupabaseErrorMessage(e))
        else await refreshLearning()
      })()
    },
    [useSupabase, supabase, orgId, setState, refreshLearning],
  )

  const addModule = useCallback(
    (courseId: string, kind: ModuleKind, title: string, sectionId: string | null = null): CourseModule | null => {
      const mod = emptyModule(kind, title.trim() || 'Untitled module', 0)
      if (!useSupabase || !supabase || !orgId) {
        let created: CourseModule | null = null
        setState((s) => ({
          ...s,
          courses: s.courses.map((c) => {
            if (c.id !== courseId) return c
            const order = c.modules.length
            const withOrder: CourseModule = { ...mod, order, sectionId }
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
        const withOrder: CourseModule = { ...mod, order, sectionId }
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
        else {
          // Section assignment lives in local state until the matching DB column lands.
          if (sectionId) {
            setState((s) => ({
              ...s,
              courses: s.courses.map((c) =>
                c.id === courseId
                  ? {
                      ...c,
                      modules: c.modules.map((m) =>
                        m.id === withOrder.id ? { ...m, sectionId } : m,
                      ),
                    }
                  : c,
              ),
            }))
          }
          await refreshLearning()
        }
      })()
      return { ...mod, order: 0, sectionId }
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

  /**
   * Permanently delete a course (and the modules / progress / certificates
   * that the database cascades from it). RLS still gates by organization, but
   * the *application-level* permission gate lives at the call site —
   * `learning.delete` is the canonical key (`learning.manage` is a superset).
   */
  const deleteCourse = useCallback(
    async (courseId: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!useSupabase || !supabase || !orgId) {
        setState((s) => ({
          ...s,
          courses: s.courses.filter((c) => c.id !== courseId),
          progress: s.progress.filter((p) => p.courseId !== courseId),
          certificates: s.certificates.filter((cert) => cert.courseId !== courseId),
        }))
        return { ok: true as const }
      }
      const { error: e } = await supabase
        .from('learning_courses')
        .delete()
        .eq('id', courseId)
        .eq('organization_id', orgId)
      if (e) {
        const msg = getSupabaseErrorMessage(e)
        setError(msg)
        return { ok: false as const, error: msg }
      }
      await refreshLearning()
      return { ok: true as const }
    },
    [useSupabase, supabase, orgId, setState, refreshLearning],
  )

  /**
   * Add a new section (chapter) to a course. Sections live on the local Course
   * object until the matching `learning_course_sections` migration ships; calls
   * are non-blocking and safe to invoke against Supabase-backed state.
   */
  const addSection = useCallback(
    (courseId: string, title: string, description?: string): CourseSection | null => {
      const id = (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sec-${Date.now()}`)
      const trimmed = title.trim() || 'Ny seksjon'
      let created: CourseSection | null = null
      setState((s) => ({
        ...s,
        courses: s.courses.map((c) => {
          if (c.id !== courseId) return c
          const next: CourseSection = {
            id,
            title: trimmed,
            order: (c.sections?.length ?? 0),
            description: description?.trim() || null,
          }
          created = next
          return { ...c, sections: [...(c.sections ?? []), next], updatedAt: new Date().toISOString() }
        }),
      }))
      return created
    },
    [setState],
  )

  const updateSection = useCallback(
    (courseId: string, sectionId: string, patch: Partial<Omit<CourseSection, 'id'>>) => {
      setState((s) => ({
        ...s,
        courses: s.courses.map((c) => {
          if (c.id !== courseId) return c
          const sections = (c.sections ?? []).map((sec) =>
            sec.id === sectionId ? { ...sec, ...patch } : sec,
          )
          return { ...c, sections, updatedAt: new Date().toISOString() }
        }),
      }))
    },
    [setState],
  )

  const deleteSection = useCallback(
    (courseId: string, sectionId: string) => {
      setState((s) => ({
        ...s,
        courses: s.courses.map((c) => {
          if (c.id !== courseId) return c
          const sections = (c.sections ?? []).filter((sec) => sec.id !== sectionId)
          // Modules in the deleted section fall back to the course root.
          const modules = c.modules.map((m) =>
            m.sectionId === sectionId ? { ...m, sectionId: null } : m,
          )
          return { ...c, sections, modules, updatedAt: new Date().toISOString() }
        }),
      }))
    },
    [setState],
  )

  const assignModuleToSection = useCallback(
    (courseId: string, moduleId: string, sectionId: string | null) => {
      setState((s) => ({
        ...s,
        courses: s.courses.map((c) => {
          if (c.id !== courseId) return c
          const modules = c.modules.map((m) => (m.id === moduleId ? { ...m, sectionId } : m))
          return { ...c, modules, updatedAt: new Date().toISOString() }
        }),
      }))
    },
    [setState],
  )

  /**
   * Reorder course sections client-side. The new order is communicated as the full
   * list of section IDs in the desired final order.
   */
  const reorderSections = useCallback(
    (courseId: string, sectionIdsInOrder: string[]) => {
      setState((s) => ({
        ...s,
        courses: s.courses.map((c) => {
          if (c.id !== courseId) return c
          const byId = new Map((c.sections ?? []).map((sec) => [sec.id, sec]))
          const reordered = sectionIdsInOrder
            .map((id, idx) => {
              const sec = byId.get(id)
              return sec ? { ...sec, order: idx } : null
            })
            .filter((x): x is NonNullable<typeof x> => x !== null)
          return { ...c, sections: reordered, updatedAt: new Date().toISOString() }
        }),
      }))
    },
    [setState],
  )

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
      if (existing) {
        await refreshLearning()
        return
      }
      // Snapshot the locale's current version onto the progress row so we can
      // compute "what changed since you started" later. Falls back to (1, 0)
      // when the course doesn't resolve through a system locale.
      const startedCourse = state.courses.find((c) => c.id === courseId)
      const startedMajor = startedCourse?.localeVersionMajor ?? startedCourse?.courseVersion ?? 1
      const startedMinor = startedCourse?.localeVersionMinor ?? startedCourse?.courseVersionMinor ?? 0
      const { error: e } = await supabase.from('learning_course_progress').insert({
        user_id: userId,
        organization_id: orgId,
        course_id: courseId,
        module_progress: {},
        started_at: new Date().toISOString(),
        started_version_major: startedMajor,
        started_version_minor: startedMinor,
      })
      if (e) setError(getSupabaseErrorMessage(e))
      else await refreshLearning()
    },
    [useSupabase, supabase, orgId, userId, setState, state.courses, refreshLearning],
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

        await refreshLearning()
      })()
    },
    [useSupabase, supabase, orgId, userId, setState, refreshLearning],
  )

  const setProgressMetadata = useCallback(
    async (courseId: string, metadata: Record<string, unknown>): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!useSupabase || !supabase || !orgId || !userId) {
        setState((s) => ({
          ...s,
          progress: s.progress.map((p) =>
            p.courseId === courseId ? { ...p, metadata } : p,
          ),
        }))
        return { ok: true }
      }
      const { data: row, error: fetchErr } = await supabase
        .from('learning_course_progress')
        .select('started_at')
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .maybeSingle()
      if (fetchErr) return { ok: false, error: getSupabaseErrorMessage(fetchErr) }
      const { error: upErr } = await supabase.from('learning_course_progress').upsert(
        {
          user_id: userId,
          organization_id: orgId,
          course_id: courseId,
          started_at: row?.started_at ?? new Date().toISOString(),
          metadata,
        },
        { onConflict: 'user_id,course_id' },
      )
      if (upErr) return { ok: false, error: getSupabaseErrorMessage(upErr) }
      await refreshLearning()
      return { ok: true }
    },
    [useSupabase, supabase, orgId, userId, setState, refreshLearning],
  )

  const issueCertificate = useCallback(
    async (courseId: string, learnerName: string): Promise<IssueCertificateResult> => {
      const trimmed = learnerName.trim()
      if (!trimmed) {
        return { ok: false, error: 'Skriv inn navnet som skal stå på kursbeviset.' }
      }

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
            learnerName: trimmed,
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
        if (!issued) {
          return {
            ok: false,
            error: 'Kunne ikke utstede kursbevis. Sjekk at alle moduler er fullført, og at du ikke allerede har et bevis for dette kurset.',
          }
        }
        return { ok: true, certificate: issued }
      }
      const { data, error: e } = await supabase.rpc('learning_issue_certificate', {
        p_course_id: courseId,
        p_learner_name: trimmed || null,
      })
      if (e) {
        return { ok: false, error: getSupabaseErrorMessage(e) }
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
        courseId: r.course_id,
        courseTitle: r.course_title,
        learnerName: r.learner_name,
        issuedAt: r.issued_at,
        verifyCode: r.verify_code,
        courseVersion: r.course_version ?? 1,
      }
      await refreshLearning()
      void refreshPermissions()
      return { ok: true, certificate: out }
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

  const dismissReview = useCallback(
    async (reviewId: string) => {
      if (!useSupabase || !supabase || !userId) return
      const { error: e } = await supabase
        .from('learning_quiz_reviews')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('id', reviewId)
        .eq('user_id', userId)
      if (e) setError(getSupabaseErrorMessage(e))
      else await refreshLearning()
    },
    [useSupabase, supabase, userId, refreshLearning],
  )

  const saveFlowSettings = useCallback(
    async (patch: Partial<LearningFlowSettings>) => {
      if (!useSupabase || !supabase || !orgId || !canManage) {
        return { ok: false as const, error: 'Krever tilgang.' }
      }
      const base = flowSettings ?? {
        teamsWebhookUrl: null as string | null,
        slackWebhookUrl: null as string | null,
        genericWebhookUrl: null as string | null,
      }
      const row = {
        organization_id: orgId,
        teams_webhook_url: patch.teamsWebhookUrl ?? base.teamsWebhookUrl,
        slack_webhook_url: patch.slackWebhookUrl ?? base.slackWebhookUrl,
        generic_webhook_url: patch.genericWebhookUrl ?? base.genericWebhookUrl,
        updated_at: new Date().toISOString(),
      }
      const { error: e } = await supabase.from('learning_flow_settings').upsert(row, { onConflict: 'organization_id' })
      if (e) return { ok: false as const, error: getSupabaseErrorMessage(e) }
      await refreshLearning()
      return { ok: true as const }
    },
    [useSupabase, supabase, orgId, canManage, flowSettings, refreshLearning],
  )

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

  const bumpCourseVersion = useCallback(
    async (courseId: string) => {
      if (!useSupabase || !supabase || !canManage) return { ok: false as const, error: 'Krever tilgang.' }
      const { data, error: e } = await supabase.rpc('learning_bump_course_version', { p_course_id: courseId })
      if (e) return { ok: false as const, error: getSupabaseErrorMessage(e) }
      await refreshLearning()
      return { ok: true as const, version: data as number }
    },
    [useSupabase, supabase, canManage, refreshLearning],
  )

  /**
   * Publish a new version of a system-course locale. The RPC validates monotonic
   * increase, writes the new modules array, and inserts an immutable history row.
   * Returns the inserted version row so the caller can refresh the Versjonshistorikk
   * tab without a round trip.
   */
  const publishLocaleVersion = useCallback(
    async (input: {
      systemCourseId: string
      locale: string
      versionMajor: number
      versionMinor: number
      isMajor: boolean
      changeNotesMd: string
      modules: CourseModule[]
    }) => {
      if (!useSupabase || !supabase || !canManage) return { ok: false as const, error: 'Krever tilgang.' }
      const { data, error: e } = await supabase.rpc('learning_publish_locale_version', {
        p_system_course_id: input.systemCourseId,
        p_locale: input.locale,
        p_version_major: input.versionMajor,
        p_version_minor: input.versionMinor,
        p_is_major: input.isMajor,
        p_change_notes_md: input.changeNotesMd,
        p_modules: input.modules,
      })
      if (e) return { ok: false as const, error: getSupabaseErrorMessage(e) }
      await refreshLearning()
      return { ok: true as const, row: data as LocaleVersionHistoryRow }
    },
    [useSupabase, supabase, canManage, refreshLearning],
  )

  /**
   * Compute the diff between the learner's `started_version` and the current
   * published version for the course's resolved locale. Returns `{ hasProgress:
   * false }` when there is no progress row.
   */
  const computeLearnerDiff = useCallback(
    async (courseId: string, locale = 'nb'): Promise<LearnerVersionDiff> => {
      if (!useSupabase || !supabase || !userId) return { hasProgress: false }
      const { data, error: e } = await supabase.rpc('learning_compute_learner_diff', {
        p_course_id: courseId,
        p_locale: locale,
      })
      if (e || !data) return { hasProgress: false }
      const raw = data as {
        has_progress: boolean
        has_diff?: boolean
        is_major?: boolean
        from_version?: { major: number; minor: number }
        to_version?: { major: number; minor: number }
        added_module_ids?: string[]
        removed_module_ids?: string[]
      }
      if (!raw.has_progress) return { hasProgress: false }
      if (!raw.has_diff) {
        return {
          hasProgress: true,
          hasDiff: false,
          fromVersion: raw.from_version,
          toVersion: raw.to_version,
        }
      }
      return {
        hasProgress: true,
        hasDiff: true,
        isMajor: raw.is_major ?? false,
        fromVersion: raw.from_version ?? { major: 1, minor: 0 },
        toVersion: raw.to_version ?? { major: 1, minor: 0 },
        addedModuleIds: raw.added_module_ids ?? [],
        removedModuleIds: raw.removed_module_ids ?? [],
      }
    },
    [useSupabase, supabase, userId],
  )

  /** List version-history rows for a system-course locale, newest first. */
  const fetchLocaleVersionHistory = useCallback(
    async (systemCourseId: string, locale: string) => {
      if (!useSupabase || !supabase) return { ok: false as const, error: 'Krever Supabase.' }
      const { data, error: e } = await supabase
        .from('learning_system_course_locale_versions')
        .select(
          'id, system_course_id, locale, version_major, version_minor, published_at, published_by, change_notes_md, module_ids_snapshot, is_major',
        )
        .eq('system_course_id', systemCourseId)
        .eq('locale', locale)
        .order('version_major', { ascending: false })
        .order('version_minor', { ascending: false })
      if (e) return { ok: false as const, error: getSupabaseErrorMessage(e) }
      const rows: LocaleVersionHistoryRow[] = (data ?? []).map((r) => ({
        id: r.id as string,
        systemCourseId: r.system_course_id as string,
        locale: r.locale as string,
        versionMajor: r.version_major as number,
        versionMinor: r.version_minor as number,
        publishedAt: r.published_at as string,
        publishedBy: (r.published_by as string | null) ?? null,
        changeNotesMd: (r.change_notes_md as string | null) ?? null,
        moduleIdsSnapshot: Array.isArray(r.module_ids_snapshot)
          ? (r.module_ids_snapshot as string[])
          : [],
        isMajor: Boolean(r.is_major),
      }))
      return { ok: true as const, rows }
    },
    [useSupabase, supabase],
  )

  /** Per-user completion history surfaced as "Min historikk". */
  const fetchMyCompletionHistory = useCallback(async () => {
    if (!useSupabase || !supabase || !userId) return { ok: false as const, error: 'Ikke innlogget.' }
    const { data, error: e } = await supabase
      .from('learning_course_completion_audit')
      .select('course_id, course_version, course_title_snapshot, completed_at, certificate_id')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
    if (e) return { ok: false as const, error: getSupabaseErrorMessage(e) }
    const rows: MyCompletionRow[] = (data ?? []).map((r) => ({
      courseId: r.course_id as string,
      courseTitleSnapshot: r.course_title_snapshot as string,
      courseVersion: r.course_version as number,
      completedAt: r.completed_at as string,
      certificateId: (r.certificate_id as string | null) ?? null,
      status: 'compliant', // resolved against current published versions on the page
    }))
    return { ok: true as const, rows }
  }, [useSupabase, supabase, userId])

  /**
   * Publish a new version of a per-org course. Mirror of publishLocaleVersion
   * but writes to learning_org_course_versions. Use for courses without a
   * source_system_course_id.
   */
  const publishOrgCourseVersion = useCallback(
    async (input: {
      courseId: string
      versionMajor: number
      versionMinor: number
      isMajor: boolean
      changeNotesMd: string
    }) => {
      if (!useSupabase || !supabase || !canManage) return { ok: false as const, error: 'Krever tilgang.' }
      const { data, error: e } = await supabase.rpc('learning_publish_org_course_version', {
        p_course_id: input.courseId,
        p_version_major: input.versionMajor,
        p_version_minor: input.versionMinor,
        p_is_major: input.isMajor,
        p_change_notes_md: input.changeNotesMd,
      })
      if (e) return { ok: false as const, error: getSupabaseErrorMessage(e) }
      await refreshLearning()
      return { ok: true as const, row: data as LocaleVersionHistoryRow }
    },
    [useSupabase, supabase, canManage, refreshLearning],
  )

  /** List org-course version history, newest first. */
  const fetchOrgCourseVersionHistory = useCallback(
    async (courseId: string) => {
      if (!useSupabase || !supabase) return { ok: false as const, error: 'Krever Supabase.' }
      const { data, error: e } = await supabase
        .from('learning_org_course_versions')
        .select(
          'id, course_id, version_major, version_minor, published_at, published_by, change_notes_md, module_ids_snapshot, is_major',
        )
        .eq('course_id', courseId)
        .order('version_major', { ascending: false })
        .order('version_minor', { ascending: false })
      if (e) return { ok: false as const, error: getSupabaseErrorMessage(e) }
      const rows: LocaleVersionHistoryRow[] = (data ?? []).map((r) => ({
        id: r.id as string,
        systemCourseId: r.course_id as string,
        locale: 'org',
        versionMajor: r.version_major as number,
        versionMinor: r.version_minor as number,
        publishedAt: r.published_at as string,
        publishedBy: (r.published_by as string | null) ?? null,
        changeNotesMd: (r.change_notes_md as string | null) ?? null,
        moduleIdsSnapshot: Array.isArray(r.module_ids_snapshot)
          ? (r.module_ids_snapshot as string[])
          : [],
        isMajor: Boolean(r.is_major),
      }))
      return { ok: true as const, rows }
    },
    [useSupabase, supabase],
  )

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
      if (e) return { ok: false as const, error: getSupabaseErrorMessage(e) }
      await refreshLearning()
      return { ok: true as const }
    },
    [useSupabase, supabase, userId, refreshLearning],
  )

  const setIltAttendance = useCallback(
    async (eventId: string, attendeeUserId: string, present: boolean) => {
      if (!useSupabase || !supabase || !userId || !canManage) return { ok: false as const, error: 'Krever tilgang.' }
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
      if (e) return { ok: false as const, error: getSupabaseErrorMessage(e) }
      await refreshLearning()
      return { ok: true as const }
    },
    [useSupabase, supabase, userId, canManage, refreshLearning],
  )

  const submitExternalCertificate = useCallback(
    async (input: { title: string; issuer?: string; validUntil?: string | null; file: File }) => {
      if (!useSupabase || !supabase || !orgId || !userId) return { ok: false as const, error: 'Ikke innlogget.' }
      const ext = input.file.name.split('.').pop()?.toLowerCase() ?? 'bin'
      const safeExt = ext.length <= 8 ? ext : 'bin'
      const path = `${userId}/${crypto.randomUUID()}.${safeExt}`
      const { error: upErr } = await supabase.storage.from('learning_external_certs').upload(path, input.file, {
        cacheControl: '3600',
        upsert: false,
      })
      if (upErr) return { ok: false as const, error: getSupabaseErrorMessage(upErr) }
      const { error: insErr } = await supabase.from('learning_external_certificates').insert({
        organization_id: orgId,
        user_id: userId,
        title: input.title.trim(),
        issuer: input.issuer?.trim() || null,
        valid_until: input.validUntil || null,
        storage_path: path,
      })
      if (insErr) return { ok: false as const, error: getSupabaseErrorMessage(insErr) }
      await refreshLearning()
      return { ok: true as const }
    },
    [useSupabase, supabase, orgId, userId, refreshLearning],
  )

  const approveExternalCertificate = useCallback(
    async (id: string, approve: boolean, note?: string) => {
      if (!useSupabase || !supabase || !canManage) return { ok: false as const, error: 'Krever tilgang.' }
      const { error: e } = await supabase.rpc('learning_approve_external_certificate', {
        p_id: id,
        p_approve: approve,
        p_note: note ?? null,
      })
      if (e) return { ok: false as const, error: getSupabaseErrorMessage(e) }
      await refreshLearning()
      return { ok: true as const }
    },
    [useSupabase, supabase, canManage, refreshLearning],
  )

  const saveLearningPath = useCallback(
    async (input: {
      id?: string
      name: string
      slug: string
      description: string
      courseIds: string[]
      rules: { metadataKey: string; expectedValue: unknown }[]
    }) => {
      if (!useSupabase || !supabase || !orgId || !canManage) return { ok: false as const, error: 'Krever tilgang.' }
      const slug = input.slug.trim().toLowerCase().replace(/\s+/g, '-')
      let pathId = input.id
      if (!pathId) {
        const { data: ins, error: ie } = await supabase
          .from('learning_paths')
          .insert({
            organization_id: orgId,
            name: input.name.trim(),
            slug,
            description: input.description.trim(),
          })
          .select('id')
          .single()
        if (ie) return { ok: false as const, error: getSupabaseErrorMessage(ie) }
        pathId = (ins as { id: string }).id
      } else {
        const { error: ue } = await supabase
          .from('learning_paths')
          .update({
            name: input.name.trim(),
            slug,
            description: input.description.trim(),
          })
          .eq('id', pathId)
          .eq('organization_id', orgId)
        if (ue) return { ok: false as const, error: getSupabaseErrorMessage(ue) }
        await supabase.from('learning_path_courses').delete().eq('path_id', pathId)
        await supabase.from('learning_path_rules').delete().eq('path_id', pathId)
      }
      const courseRows = input.courseIds.map((course_id, sort_order) => ({
        path_id: pathId!,
        course_id,
        sort_order,
      }))
      if (courseRows.length) {
        const { error: ce } = await supabase.from('learning_path_courses').insert(courseRows)
        if (ce) return { ok: false as const, error: getSupabaseErrorMessage(ce) }
      }
      const ruleRows = input.rules.map((r) => ({
        path_id: pathId!,
        metadata_key: r.metadataKey,
        expected_value: r.expectedValue as never,
      }))
      if (ruleRows.length) {
        const { error: re } = await supabase.from('learning_path_rules').insert(ruleRows)
        if (re) return { ok: false as const, error: getSupabaseErrorMessage(re) }
      }
      const { error: rpcErr } = await supabase.rpc('learning_refresh_path_enrollments_for_user')
      if (rpcErr) console.warn('learning_refresh_path_enrollments_for_user', rpcErr.message)
      await refreshLearning()
      return { ok: true as const, pathId: pathId! }
    },
    [useSupabase, supabase, orgId, canManage, refreshLearning],
  )

  const deleteLearningPath = useCallback(
    async (pathId: string) => {
      if (!useSupabase || !supabase || !orgId || !canManage) return { ok: false as const, error: 'Krever tilgang.' }
      const { error: e } = await supabase.from('learning_paths').delete().eq('id', pathId).eq('organization_id', orgId)
      if (e) return { ok: false as const, error: getSupabaseErrorMessage(e) }
      await refreshLearning()
      return { ok: true as const }
    },
    [useSupabase, supabase, orgId, canManage, refreshLearning],
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

  // ── All-courses bundle (org-owned + system catalog) ────────────────────
  // Roundtrip surface for external editing: bundle every course an admin can
  // touch in one JSON file. Org courses are exported as the runtime `Course`
  // shape; system courses keep their per-locale catalog rows so the round
  // trip preserves all locales (not just the resolved one).
  const exportAllCoursesBundle = useCallback(
    async (): Promise<{ ok: true; json: string } | { ok: false; error: string }> => {
      if (!useSupabase || !supabase) {
        const payload: AllCoursesExportJson = {
          version: 1,
          kind: 'courses_all_export',
          schemaVersion: 5,
          exportedAt: new Date().toISOString(),
          orgCourses: state.courses.map((c) => ({
            ...serialiseCourseForBundle(c),
            id: c.id,
          })),
          systemCourses: [],
        }
        return { ok: true, json: JSON.stringify(payload, null, 2) }
      }
      const [{ data: sysRows, error: sysErr }, { data: locRows, error: locErr }] = await Promise.all([
        supabase.from('learning_system_courses').select('id, slug, default_locale'),
        supabase
          .from('learning_system_course_locales')
          .select(
            'system_course_id, locale, title, description, modules, meta, version_major, version_minor, version_published_at, change_notes_md',
          ),
      ])
      if (sysErr) return { ok: false, error: getSupabaseErrorMessage(sysErr) }
      if (locErr) return { ok: false, error: getSupabaseErrorMessage(locErr) }
      const sysList = (sysRows ?? []) as { id: string; slug: string; default_locale: string }[]
      const locList = (locRows ?? []) as {
        system_course_id: string
        locale: string
        title: string
        description: string
        modules: unknown
        meta: Record<string, unknown> | null
        version_major: number | null
        version_minor: number | null
        version_published_at: string | null
        change_notes_md: string | null
      }[]
      const localesByCourse = new Map<string, SystemCourseJson['locales']>()
      for (const row of locList) {
        const list = localesByCourse.get(row.system_course_id) ?? []
        // Spread `meta` first so the structural fields override any
        // accidental collision; the result mirrors what was sent on import.
        list.push({
          ...(row.meta ?? {}),
          locale: row.locale,
          title: row.title ?? '',
          description: row.description ?? '',
          modules: Array.isArray(row.modules) ? (row.modules as SystemCourseJson['locales'][number]['modules']) : [],
          versionMajor: row.version_major ?? 1,
          versionMinor: row.version_minor ?? 0,
          versionPublishedAt: row.version_published_at ?? null,
          changeNotesMd: row.change_notes_md ?? null,
        })
        localesByCourse.set(row.system_course_id, list)
      }
      const systemCourses: SystemCourseJson[] = sysList.map((s) => ({
        id: s.id,
        slug: s.slug,
        defaultLocale: s.default_locale ?? 'nb',
        locales: localesByCourse.get(s.id) ?? [],
      }))
      const orgCourses = state.courses
        .filter((c) => c.origin !== 'system')
        .map((c) => ({ ...serialiseCourseForBundle(c), id: c.id }))
      const payload: AllCoursesExportJson = {
        version: 1,
        kind: 'courses_all_export',
        schemaVersion: 5,
        exportedAt: new Date().toISOString(),
        orgCourses,
        systemCourses,
      }
      return { ok: true, json: JSON.stringify(payload, null, 2) }
    },
    [useSupabase, supabase, state.courses],
  )

  const importAllCoursesBundle = useCallback(
    async (
      json: string,
    ): Promise<
      | { ok: true; orgCount: number; systemCount: number }
      | { ok: false; error: string }
    > => {
      let raw: unknown
      try {
        raw = JSON.parse(json)
      } catch {
        return { ok: false, error: 'Kunne ikke parse JSON.' }
      }
      const parsed = parseAllCoursesExportJson(raw)
      if (!parsed.ok) return { ok: false, error: parsed.error }
      const bundle = parsed.value

      if (!useSupabase || !supabase || !orgId) {
        // Local demo: only org courses can be merged into in-memory state.
        if (bundle.systemCourses.length > 0) {
          return {
            ok: false,
            error: 'Systemkurs kan ikke importeres uten Supabase. Logg inn for å oppdatere systemkatalogen.',
          }
        }
        setLocalState((s) => {
          const byId = new Map(s.courses.map((c) => [c.id, c]))
          for (const c of bundle.orgCourses) {
            const existing = byId.get(c.id)
            byId.set(c.id, hydrateCourseFromBundle(c, existing))
          }
          return { ...s, courses: [...byId.values()] }
        })
        return { ok: true, orgCount: bundle.orgCourses.length, systemCount: 0 }
      }

      for (const sc of bundle.systemCourses) {
        // Spread each module/locale verbatim so author-extension fields
        // (refLawIds, points, badgeId, lawRefs, badges, milestones, …) reach
        // the JSONB columns intact. The RPC only reads id/title/order/kind/
        // content/durationMinutes itself, but the JSONB it stores is the full
        // object — preserving extras is essential for the gamification + law
        // catalog round trip.
        const { error: e } = await supabase.rpc('learning_admin_upsert_system_course', {
          p_id: sc.id,
          p_slug: sc.slug,
          p_default_locale: sc.defaultLocale || 'nb',
          p_locales: sc.locales.map((l) => ({
            ...(l as Record<string, unknown>),
            locale: l.locale,
            title: l.title,
            description: l.description,
            modules: l.modules.map((m, j) => ({
              ...(m as Record<string, unknown>),
              id: m.id,
              title: m.title,
              order: typeof m.order === 'number' ? m.order : j,
              kind: m.kind,
              durationMinutes: m.durationMinutes,
              content: m.content,
            })),
          })),
        })
        if (e) return { ok: false, error: `Systemkurs «${sc.slug}»: ${getSupabaseErrorMessage(e)}` }
      }

      for (const c of bundle.orgCourses) {
        const courseRow = {
          id: c.id,
          organization_id: orgId,
          title: c.title,
          description: c.description ?? '',
          status: c.status ?? 'draft',
          tags: c.tags ?? [],
          recertification_months: c.recertificationMonths ?? null,
          metadata_schema: c.metadataSchema ?? { fields: [] },
          law_refs: c.lawRefs ?? [],
          updated_at: new Date().toISOString(),
        }
        const { error: upErr } = await supabase.from('learning_courses').upsert(courseRow, {
          onConflict: 'id',
        })
        if (upErr) return { ok: false, error: `Kurs «${c.title}»: ${getSupabaseErrorMessage(upErr)}` }

        const { error: delErr } = await supabase
          .from('learning_modules')
          .delete()
          .eq('course_id', c.id)
          .eq('organization_id', orgId)
        if (delErr) return { ok: false, error: `Kurs «${c.title}»: ${getSupabaseErrorMessage(delErr)}` }

        if (c.modules.length > 0) {
          const moduleRows = c.modules.map((m, i) => ({
            id: crypto.randomUUID(),
            organization_id: orgId,
            course_id: c.id,
            title: m.title,
            sort_order: typeof m.order === 'number' ? m.order : i,
            kind: m.kind,
            content: (m.content ?? {}) as unknown as Record<string, unknown>,
            duration_minutes: m.durationMinutes,
          }))
          const { error: insErr } = await supabase.from('learning_modules').insert(moduleRows)
          if (insErr) return { ok: false, error: `Kurs «${c.title}»: ${getSupabaseErrorMessage(insErr)}` }
        }
      }

      await refreshLearning()
      return {
        ok: true,
        orgCount: bundle.orgCourses.length,
        systemCount: bundle.systemCourses.length,
      }
    },
    [useSupabase, supabase, orgId, refreshLearning],
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
    deleteCourse,
    addModule,
    updateModule,
    reorderModules,
    deleteModule,
    addSection,
    updateSection,
    deleteSection,
    assignModuleToSection,
    reorderSections,
    ensureProgress,
    setModuleCompleted,
    setProgressMetadata,
    issueCertificate,
    resetDemo,
    exportJson,
    importFromJson,
    exportCourseJson,
    exportProgressSliceJson,
    exportCertificatesSliceJson,
    importPartialJson,
    exportAllCoursesBundle,
    importAllCoursesBundle,
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
    publishLocaleVersion,
    publishOrgCourseVersion,
    computeLearnerDiff,
    fetchLocaleVersionHistory,
    fetchOrgCourseVersionHistory,
    fetchMyCompletionHistory,
    upsertIltEvent,
    setIltRsvp,
    setIltAttendance,
    submitExternalCertificate,
    approveExternalCertificate,
    saveLearningPath,
    deleteLearningPath,
  }
}
