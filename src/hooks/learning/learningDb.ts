import type {
  Certificate,
  Course,
  CourseModule,
  CourseOrigin,
  CourseProgress,
  ModuleKind,
  ModuleProgress,
} from '../../types/learning'
import { parseDbModuleContent } from '../../lib/learningValidation'

export type DbCourseRow = {
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
}

export type DbOrgCourseSetting = {
  organization_id: string
  system_course_id: string
  enabled: boolean
  forked_course_id: string | null
}

export type CatalogLocaleRow = {
  system_course_id: string
  locale: string
  title: string
  description: string
  modules: unknown
}

export type DbModuleRow = {
  id: string
  course_id: string
  title: string
  sort_order: number
  kind: string
  content: unknown
  duration_minutes: number
}

export type DbProgressRow = {
  user_id: string
  course_id: string
  module_progress: Record<string, ModuleProgress>
  started_at: string
  completed_at: string | null
}

export type DbCertRow = {
  id: string
  user_id?: string
  course_id: string
  course_title: string
  learner_name: string
  issued_at: string
  verify_code: string
  course_version?: number | null
}

export function moduleFromRow(m: DbModuleRow): CourseModule {
  return {
    id: m.id,
    title: m.title,
    order: m.sort_order,
    kind: m.kind as ModuleKind,
    content: parseDbModuleContent(m.content, m.id),
    durationMinutes: m.duration_minutes,
  }
}

export function coursesFromDb(courseRows: DbCourseRow[], moduleRows: DbModuleRow[]): Course[] {
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
    }
  })
}

function moduleFromCatalogJson(raw: Record<string, unknown>): CourseModule | null {
  if (typeof raw.id !== 'string' || typeof raw.title !== 'string') return null
  const order = typeof raw.order === 'number' ? raw.order : 0
  const kind = raw.kind as ModuleKind
  const content = parseDbModuleContent(raw.content, raw.id)
  const durationMinutes = typeof raw.durationMinutes === 'number' ? raw.durationMinutes : 5
  return {
    id: raw.id,
    title: raw.title,
    order,
    kind,
    content,
    durationMinutes,
  }
}

export function mergeCatalogIntoCourses(
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

export function mapProgressRows(
  progressRows: DbProgressRow[],
  profileNameById: Map<string, string>,
): CourseProgress[] {
  return progressRows.map((r) => ({
    userId: r.user_id,
    learnerName: profileNameById.get(r.user_id)?.trim() || '—',
    courseId: r.course_id,
    moduleProgress: r.module_progress ?? {},
    startedAt: r.started_at,
    completedAt: r.completed_at ?? undefined,
  }))
}

export function mapCertRows(certRows: DbCertRow[]): Certificate[] {
  return certRows.map((r) => ({
    id: r.id,
    ...(r.user_id ? { userId: r.user_id } : {}),
    courseId: r.course_id,
    courseTitle: r.course_title,
    learnerName: r.learner_name,
    issuedAt: r.issued_at,
    verifyCode: r.verify_code,
    courseVersion: r.course_version ?? 1,
  }))
}
