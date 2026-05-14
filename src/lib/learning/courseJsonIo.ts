// Course JSON I/O — serialise/parse Course + CourseModule shapes so
// authors can hand-edit content (or generate from external tools) and
// import via the builder.
//
// Schema is intentionally permissive on the content payload: each
// module kind has its own `content` shape (see types/learning.ts +
// modules/learning/moduleContentSchemas.ts) and we don't re-validate
// per-kind here. The course/module-level structure is validated by
// Zod, but `content` falls through as `unknown`. A round-trip via
// `serialiseModule` -> JSON -> `parseModuleJson` reproduces the same
// content blob, byte for byte.

import { z } from 'zod'
import type { Course, CourseModule } from '../../types/learning'

const ModuleKindSchema = z.enum([
  'flashcard',
  'quiz',
  'text',
  'image',
  'video',
  'checklist',
  'tips',
  'on_job',
  'event',
  'scenario',
  'other',
])

// Module schema uses passthrough so author-only fields (refLawIds, points,
// badgeId, etc.) survive the round-trip without needing a typed entry here.
// Validation only covers the structural fields the importer relies on.
const ModuleJsonSchema = z
  .object({
    title: z.string().default(''),
    kind: ModuleKindSchema,
    durationMinutes: z.number().int().nonnegative().default(5),
    order: z.number().optional(),
    content: z.unknown(),
    sectionId: z.string().nullable().optional(),
    refLawIds: z.array(z.string()).optional(),
    points: z.number().int().nonnegative().optional(),
    badgeId: z.string().optional(),
  })
  .passthrough()

const CourseSectionJsonSchema = z.object({
  id: z.string(),
  title: z.string(),
  order: z.number().optional(),
})

// Course-level passthrough lets `badges`, `milestones`, and any other
// gamification metadata survive a parse → re-export round trip.
const CourseJsonSchema = z
  .object({
    title: z.string(),
    description: z.string().optional().default(''),
    status: z.enum(['draft', 'published', 'archived']).optional(),
    tags: z.array(z.string()).optional().default([]),
    recertificationMonths: z.number().int().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    /** Per-course flat string array (legacy compliance pattern) */
    lawRefs: z.array(z.string()).optional().default([]),
    /** Optional gamification badge catalog */
    badges: z.array(z.unknown()).optional(),
    /** Optional gamification milestone definitions */
    milestones: z.array(z.unknown()).optional(),
    modules: z.array(ModuleJsonSchema).default([]),
    sections: z.array(CourseSectionJsonSchema).optional(),
    metadataSchema: z.unknown().optional(),
  })
  .passthrough()

export type ModuleJson = z.infer<typeof ModuleJsonSchema>
export type CourseJson = z.infer<typeof CourseJsonSchema>

// ── System course catalog (per-locale modules) ──────────────────────────
// System courses are shared across orgs. The catalog stores a flat array of
// modules per locale in `learning_system_course_locales.modules`. The shape
// here mirrors the JSONB columns 1:1 so a round-trip export → edit → import
// preserves what the runtime resolver expects (see mergeCatalogIntoCourses
// in useLearning.ts and the `learning_fork_system_course` plpgsql RPC).
const SystemCourseModuleJsonSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    order: z.number().int().optional(),
    kind: ModuleKindSchema,
    durationMinutes: z.number().int().nonnegative().default(5),
    content: z.unknown(),
    refLawIds: z.array(z.string()).optional(),
    points: z.number().int().nonnegative().optional(),
    badgeId: z.string().optional(),
  })
  .passthrough()

const SystemCourseLocaleJsonSchema = z
  .object({
    locale: z.string().min(1),
    title: z.string().default(''),
    description: z.string().default(''),
    modules: z.array(SystemCourseModuleJsonSchema).default([]),
    lawRefs: z.array(z.unknown()).optional(),
    badges: z.array(z.unknown()).optional(),
    milestones: z.array(z.unknown()).optional(),
    // Per-locale versioning (added in schemaVersion 5).
    versionMajor: z.number().int().min(1).optional(),
    versionMinor: z.number().int().min(0).optional(),
    versionPublishedAt: z.string().nullable().optional(),
    changeNotesMd: z.string().nullable().optional(),
  })
  .passthrough()

const SystemCourseJsonSchema = z
  .object({
    id: z.string().min(1),
    slug: z.string().min(1),
    defaultLocale: z.string().default('nb'),
    locales: z.array(SystemCourseLocaleJsonSchema).min(1),
  })
  .passthrough()

const AllCoursesExportJsonSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal('courses_all_export'),
    exportedAt: z.string(),
    schemaVersion: z.number().int().optional(),
    orgCourses: z.array(CourseJsonSchema.extend({ id: z.string() })).default([]),
    systemCourses: z.array(SystemCourseJsonSchema).default([]),
  })
  .passthrough()

export type SystemCourseModuleJson = z.infer<typeof SystemCourseModuleJsonSchema>
export type SystemCourseLocaleJson = z.infer<typeof SystemCourseLocaleJsonSchema>
export type SystemCourseJson = z.infer<typeof SystemCourseJsonSchema>
export type AllCoursesExportJson = z.infer<typeof AllCoursesExportJsonSchema>

export function serialiseModule(mod: CourseModule): ModuleJson {
  return {
    title: mod.title,
    kind: mod.kind,
    durationMinutes: mod.durationMinutes,
    order: mod.order,
    content: mod.content,
    sectionId: mod.sectionId ?? null,
  }
}

export function serialiseCourse(course: Course): CourseJson {
  return {
    title: course.title,
    description: course.description,
    status: course.status,
    tags: course.tags,
    recertificationMonths: course.recertificationMonths ?? null,
    categoryId: course.categoryId ?? null,
    lawRefs: course.lawRefs ?? [],
    modules: course.modules.map(serialiseModule),
    sections: course.sections,
    metadataSchema: course.metadataSchema ?? undefined,
  }
}

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

export function parseModuleJson(json: unknown): ParseResult<ModuleJson> {
  const r = ModuleJsonSchema.safeParse(json)
  if (!r.success) return { ok: false, error: humaniseZodError(r.error) }
  return { ok: true, value: r.data }
}

export function parseCourseJson(json: unknown): ParseResult<CourseJson> {
  const r = CourseJsonSchema.safeParse(json)
  if (!r.success) return { ok: false, error: humaniseZodError(r.error) }
  return { ok: true, value: r.data }
}

export function parseAllCoursesExportJson(json: unknown): ParseResult<AllCoursesExportJson> {
  const r = AllCoursesExportJsonSchema.safeParse(json)
  if (!r.success) return { ok: false, error: humaniseZodError(r.error) }
  return { ok: true, value: r.data }
}

function humaniseZodError(err: z.ZodError): string {
  const first = err.issues[0]
  if (!first) return 'Ugyldig JSON.'
  const path = first.path.join('.')
  return path ? `${path}: ${first.message}` : first.message
}

// ── Browser helpers ─────────────────────────────────────────────────────

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Browser file-picker → parsed JSON. Returns null when the user cancels
 *  or the file isn't valid JSON. */
export function pickJsonFile(): Promise<unknown | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        try {
          resolve(JSON.parse(String(reader.result)))
        } catch {
          resolve(null)
        }
      }
      reader.onerror = () => resolve(null)
      reader.readAsText(file)
    }
    input.click()
  })
}

/** Filename-safe slug derived from a course/module title. */
export function jsonFilename(title: string, suffix: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  const stem = slug || 'kurs'
  return `${stem}-${suffix}.json`
}
