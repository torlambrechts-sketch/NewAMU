// Loads template packs for the Mal-pakker section.
//
// The "pack" concept aggregates per-framework content from:
//   - compliance_packs (per-org pack configuration)
//   - compliance_checklist_templates (per-org checklists, .pack)
//   - survey_template_catalog (.pack — system catalog enum)
//   - document_system_templates (.category + .legal_basis → framework inferred)
//   - meeting_system_templates (.framework, .frameworks[])
//   - register_types (.pack_slugs[], org_id NULL = system)
//   - learning_system_courses (no framework column — derived from law_refs)
//
// Framework keys are inconsistent across the schema (some use lowercase
// hyphenated, some uppercase underscored, some use aliases like
// 'arbeidsmiljo' for AML). normalizeFramework() collapses them.

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { slugify } from './format'
import { FRAMEWORK_PACK_DEFAULTS, FRAMEWORK_REGISTRY, getFrameworkMeta } from './packMetadata'
import type { PackSummary } from './types'

export interface PackTemplateRow {
  id: string
  packFramework: string
  module: 'sjekkliste' | 'undersokelse' | 'dokument' | 'mote' | 'register' | 'kurs'
  moduleLabel: string
  name: string
  lawRefs: string[]
  itemCount: number
  version: string
  isSystem: boolean
}

interface CompliancePackRow {
  slug: string
  short_name: string
  plural_label: string
  description: string
  legal_references: { code: string; text: string }[]
  position: number
  is_active: boolean
  updated_at: string
}

interface ChecklistTemplateRow {
  id: string
  organization_id: string | null
  pack: string
  name: string
  law_refs: string[] | null
  is_active: boolean
  is_system: boolean
  current_version_major: number | null
  current_version_minor: number | null
  internal_pack_id: string | null
}

interface SurveyCatalogRow {
  id: string
  name: string
  pack: string
  law_refs: string[] | null
  body: Record<string, unknown> | null
  is_system: boolean
}

interface DocumentTemplateRow {
  id: string
  label: string
  category: string
  legal_basis: string[] | null
}

interface MeetingTemplateRow {
  id: string
  label: string
  framework: string | null
  frameworks: string[] | null
  law_refs: string[] | null
  default_duration_minutes: number | null
}

interface RegisterTypeRow {
  id: string
  name: string
  pack_slugs: string[] | null
  regulation_ids: string[] | null
  aml_paragraphs: string[] | null
  organization_id: string | null
  is_system: boolean
  internal_pack_id: string | null
}

interface LearningCourseRow {
  id: string
  slug: string
  law_refs: unknown
  required_for_roles: string[] | null
  default_locale: string
}

interface LearningCourseLocale {
  system_course_id: string
  locale: string
  title: string
}

interface InternalPackRow {
  id: string
  slug: string
  name: string
  description: string
  source_pack_slug: string | null
  created_at: string
  updated_at: string
}

interface InternalPackedOrgRow {
  id: string
  internal_pack_id: string | null
  // Module-specific fields included via select() — typed loosely
  // because each call-site picks different columns.
  name?: string
  title?: string
  label?: string
  catalog_id?: string
  law_refs?: string[] | null
  legal_basis?: string[] | null
}

export interface CreateInternalPackResult {
  packId: string | null
  copied: number
  skipped: number
  perModule: Record<
    'checklist' | 'survey' | 'document' | 'meeting' | 'register' | 'course',
    { copied: number; failed: number }
  >
  error: string | null
}

export interface AdminPacksResult {
  packs: PackSummary[]
  templates: PackTemplateRow[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  installPack: (framework: string) => Promise<string | null>
  uninstallPack: (framework: string) => Promise<string | null>
  createInternalPackFromTemplates: (
    sourceTemplateIds: string[],
    packName: string,
    sourcePackSlug?: string | null,
  ) => Promise<CreateInternalPackResult>
  createEmptyInternalPack: (
    name: string,
    description?: string,
  ) => Promise<{ packId: string | null; error: string | null }>
}

// ── Helpers ─────────────────────────────────────────────────────────────

function safelyParseLawRefs(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map((x) => String(x)).filter(Boolean)
  if (typeof raw === 'string') return [raw]
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj.refs)) return obj.refs.map((x) => String(x))
    if (Array.isArray(obj.list)) return obj.list.map((x) => String(x))
  }
  return []
}

/**
 * Normalises the per-table framework identifiers into the canonical
 * keys used by `packMetadata.FRAMEWORK_REGISTRY`. The schema is
 * inconsistent:
 *   - compliance_packs.slug:         aml-amu | iso-45001 | iso-27001 | …
 *   - meeting_system_templates.framework: AML | ISO_45001 | …
 *   - survey_template_catalog.pack:  arbeidsmiljo | engagement | …
 *   - register_types.pack_slugs:     aml-amu | iso-45001 | …
 */
function normalizeFramework(raw: string | null | undefined): string {
  if (!raw) return 'internal'
  const lower = raw.toLowerCase()
  // Survey-pack aliases. 'arbeidsmiljo' is the survey-side label for the
  // AML grunnpakke; 'engagement' / 'vendor' / 'compliance' are survey-
  // only packs that should fold into the closest framework we render.
  if (lower === 'arbeidsmiljo') return 'aml-amu'
  if (lower === 'aml') return 'aml-amu'
  if (lower === 'engagement' || lower === 'vendor' || lower === 'compliance') {
    return 'internal'
  }
  return lower.replace(/_/g, '-')
}

/**
 * Documents are tagged with `category` (hms_handbook / policy / …)
 * instead of a framework key. Sniff `legal_basis[]` so docs land under
 * the right pack tile.
 */
function inferDocumentFramework(legalBasis: string[] | null | undefined): string {
  if (!legalBasis || legalBasis.length === 0) return 'internal'
  const joined = legalBasis.join(' ').toLowerCase()
  if (joined.includes('iso 45001') || joined.includes('iso/iec 45001')) return 'iso-45001'
  if (joined.includes('iso 27001') || joined.includes('iso/iec 27001')) return 'iso-27001'
  if (joined.includes('iso 9001')) return 'iso-9001'
  if (joined.includes('iso 14001')) return 'iso-14001'
  if (joined.includes('gdpr') || joined.includes('personopplysningsloven')) return 'gdpr'
  if (joined.includes('aml') || joined.includes('arbeidsmiljølov')) return 'aml-amu'
  if (joined.includes('ik-f') || joined.includes('internkontroll')) return 'ik'
  return 'aml-amu'
}

function inferLearningFramework(course: LearningCourseRow): string {
  const refs = safelyParseLawRefs(course.law_refs).join(' ').toLowerCase()
  if (refs.includes('iso 45001')) return 'iso-45001'
  if (refs.includes('iso 27001')) return 'iso-27001'
  if (refs.includes('iso 9001')) return 'iso-9001'
  if (refs.includes('iso 14001')) return 'iso-14001'
  if (refs.includes('gdpr')) return 'gdpr'
  if (refs.includes('ik-f') || refs.includes('internkontroll')) return 'ik'
  return 'aml-amu'
}

function questionCount(body: Record<string, unknown> | null | undefined): number {
  if (!body) return 0
  const qs = body['questions']
  if (Array.isArray(qs)) return qs.length
  return 0
}

// ── Hook ────────────────────────────────────────────────────────────────

export function useAdminPacks(): AdminPacksResult {
  const { supabase, organization } = useOrgSetupContext()
  const [packs, setPacks] = useState<PackSummary[]>([])
  const [templates, setTemplates] = useState<PackTemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !organization?.id) return
    setLoading(true)
    setError(null)
    try {
      // Per-table cap. Each module's system catalog typically holds
      // 10-80 templates; 1000 is well above realistic for any single
      // org. Past that limit, the admin shell is the wrong surface —
      // owners should drill into the module-specific page. If a query
      // ever truncates we surface that via `truncated` so the UI can
      // hint at it instead of silently lying.
      const ROW_CAP = 1000

      // Parallel fetch — none of these depend on each other.
      const [cpRes, clRes, svRes, docRes, meetRes, regRes, courseRes, ipRes, svOrgRes, docOrgRes, meetOrgRes, learnOrgRes] = await Promise.all([
        supabase
          .from('compliance_packs')
          .select('slug, short_name, plural_label, description, legal_references, position, is_active, updated_at')
          .eq('organization_id', organization.id)
          .limit(ROW_CAP),
        supabase
          .from('compliance_checklist_templates')
          .select('id, organization_id, pack, name, law_refs, is_active, is_system, current_version_major, current_version_minor, internal_pack_id')
          .eq('organization_id', organization.id)
          .is('deleted_at', null)
          .limit(ROW_CAP),
        supabase
          .from('survey_template_catalog')
          .select('id, name, pack, law_refs, body, is_system')
          .eq('is_active', true)
          .limit(ROW_CAP),
        supabase
          .from('document_system_templates')
          .select('id, label, category, legal_basis')
          .limit(ROW_CAP),
        supabase
          .from('meeting_system_templates')
          .select('id, label, framework, frameworks, law_refs, default_duration_minutes')
          .eq('is_active', true)
          .limit(ROW_CAP),
        supabase
          .from('register_types')
          .select('id, name, pack_slugs, regulation_ids, aml_paragraphs, organization_id, is_system, internal_pack_id')
          .or(`organization_id.is.null,organization_id.eq.${organization.id}`)
          .eq('is_active', true)
          .limit(ROW_CAP),
        supabase
          .from('learning_system_courses')
          .select('id, slug, law_refs, required_for_roles, default_locale')
          .limit(ROW_CAP),
        // Org-built internal packs (the wizard writes these).
        supabase
          .from('internal_packs')
          .select('id, slug, name, description, source_pack_slug, created_at, updated_at')
          .eq('organization_id', organization.id)
          .order('created_at', { ascending: false })
          .limit(ROW_CAP),
        // Org-side template tables — count rows per internal_pack for
        // the pack-summary contents map.
        supabase
          .from('survey_org_templates')
          .select('id, internal_pack_id, catalog_id')
          .eq('organization_id', organization.id)
          .not('internal_pack_id', 'is', null)
          .limit(ROW_CAP),
        supabase
          .from('document_org_templates')
          .select('id, label, internal_pack_id, legal_basis')
          .eq('organization_id', organization.id)
          .not('internal_pack_id', 'is', null)
          .limit(ROW_CAP),
        supabase
          .from('meeting_org_templates')
          .select('id, name, internal_pack_id, law_refs')
          .eq('organization_id', organization.id)
          .not('internal_pack_id', 'is', null)
          .limit(ROW_CAP),
        supabase
          .from('learning_courses')
          .select('id, title, internal_pack_id, law_refs')
          .eq('organization_id', organization.id)
          .not('internal_pack_id', 'is', null)
          .limit(ROW_CAP),
      ])

      const cpRows = (cpRes.error ? [] : (cpRes.data ?? [])) as CompliancePackRow[]
      const clRows = (clRes.error ? [] : (clRes.data ?? [])) as ChecklistTemplateRow[]
      const svRows = (svRes.error ? [] : (svRes.data ?? [])) as SurveyCatalogRow[]
      const docRows = (docRes.error ? [] : (docRes.data ?? [])) as DocumentTemplateRow[]
      const meetRows = (meetRes.error ? [] : (meetRes.data ?? [])) as MeetingTemplateRow[]
      const regRows = (regRes.error ? [] : (regRes.data ?? [])) as RegisterTypeRow[]
      const courseRows = (courseRes.error ? [] : (courseRes.data ?? [])) as LearningCourseRow[]
      const ipRows = (ipRes.error ? [] : (ipRes.data ?? [])) as InternalPackRow[]
      const svOrgRows = (svOrgRes.error ? [] : (svOrgRes.data ?? [])) as InternalPackedOrgRow[]
      const docOrgRows = (docOrgRes.error ? [] : (docOrgRes.data ?? [])) as InternalPackedOrgRow[]
      const meetOrgRows = (meetOrgRes.error ? [] : (meetOrgRes.data ?? [])) as InternalPackedOrgRow[]
      const learnOrgRows = (learnOrgRes.error ? [] : (learnOrgRes.data ?? [])) as InternalPackedOrgRow[]

      // Pull localized course titles in a follow-up query — the FK lives
      // on the locale table and Postgres doesn't expose it as a single
      // statement here. Done in a second round-trip to keep the main
      // batch clean.
      const courseIds = courseRows.map((c) => c.id)
      let courseLocales: LearningCourseLocale[] = []
      if (courseIds.length > 0) {
        const localeRes = await supabase
          .from('learning_system_course_locales')
          .select('system_course_id, locale, title')
          .in('system_course_id', courseIds)
        if (!localeRes.error) {
          courseLocales = (localeRes.data ?? []) as LearningCourseLocale[]
        }
      }
      const titleByCourse = new Map<string, string>()
      for (const cl of courseLocales) {
        const existing = titleByCourse.get(cl.system_course_id)
        if (!existing || cl.locale === 'nb') {
          titleByCourse.set(cl.system_course_id, cl.title)
        }
      }

      const collected: PackTemplateRow[] = []

      // Internal-pack-tagged rows are emitted with framework = internal:<uuid>
      // so they group under the right card. Rows with a null
      // internal_pack_id fall back to their natural framework (system
      // pack derived from .pack / .category / .legal_basis).
      const fwForInternalPack = (rawPack: string, internalPackId: string | null) =>
        internalPackId ? `internal:${internalPackId}` : normalizeFramework(rawPack)

      // 1) Checklists (per-org templates carry the pack enum directly)
      for (const c of clRows) {
        const version = `${c.current_version_major ?? 1}.${c.current_version_minor ?? 0}`
        collected.push({
          id: `cl-${c.id}`,
          packFramework: fwForInternalPack(c.pack, c.internal_pack_id ?? null),
          module: 'sjekkliste',
          moduleLabel: 'Sjekkliste',
          name: c.name,
          lawRefs: safelyParseLawRefs(c.law_refs),
          itemCount: 0,
          version,
          isSystem: c.is_system,
        })
      }

      // 2) Surveys (system catalog)
      for (const s of svRows) {
        collected.push({
          id: `sv-${s.id}`,
          packFramework: normalizeFramework(s.pack),
          module: 'undersokelse',
          moduleLabel: 'Undersøkelse',
          name: s.name,
          lawRefs: safelyParseLawRefs(s.law_refs),
          itemCount: questionCount(s.body),
          version: '1.0',
          isSystem: s.is_system,
        })
      }

      // 3) Document system templates (framework inferred from legal_basis)
      for (const d of docRows) {
        collected.push({
          id: `doc-${d.id}`,
          packFramework: inferDocumentFramework(d.legal_basis),
          module: 'dokument',
          moduleLabel: 'Dokument',
          name: d.label,
          lawRefs: safelyParseLawRefs(d.legal_basis),
          itemCount: 0,
          version: '1.0',
          isSystem: true,
        })
      }

      // 4) Meeting system templates
      for (const m of meetRows) {
        const fwKey = normalizeFramework(m.framework ?? m.frameworks?.[0])
        collected.push({
          id: `meet-${m.id}`,
          packFramework: fwKey,
          module: 'mote',
          moduleLabel: 'Møte',
          name: m.label,
          lawRefs: safelyParseLawRefs(m.law_refs),
          itemCount: m.default_duration_minutes ?? 0,
          version: '1.0',
          isSystem: true,
        })
      }

      // 5) Register types (system + per-org). When the row is tagged
      // with internal_pack_id, the natural pack-slugs split is skipped
      // and the row appears only under the internal pack. Otherwise
      // one row per pack-slug so system registers show up everywhere
      // they're listed.
      for (const r of regRows) {
        if (r.internal_pack_id) {
          collected.push({
            id: `reg-${r.id}-internal`,
            packFramework: `internal:${r.internal_pack_id}`,
            module: 'register',
            moduleLabel: 'Register',
            name: r.name,
            lawRefs: [
              ...safelyParseLawRefs(r.regulation_ids),
              ...safelyParseLawRefs(r.aml_paragraphs),
            ],
            itemCount: 0,
            version: '1.0',
            isSystem: false,
          })
          continue
        }
        const slugs =
          r.pack_slugs && r.pack_slugs.length > 0 ? r.pack_slugs : ['internal']
        for (const slug of slugs) {
          collected.push({
            id: `reg-${r.id}-${slug}`,
            packFramework: normalizeFramework(slug),
            module: 'register',
            moduleLabel: 'Register',
            name: r.name,
            lawRefs: [
              ...safelyParseLawRefs(r.regulation_ids),
              ...safelyParseLawRefs(r.aml_paragraphs),
            ],
            itemCount: 0,
            version: '1.0',
            isSystem: r.organization_id == null || r.is_system,
          })
        }
      }

      // 6) Learning system courses
      for (const c of courseRows) {
        collected.push({
          id: `course-${c.id}`,
          packFramework: inferLearningFramework(c),
          module: 'kurs',
          moduleLabel: 'Kurs',
          name: titleByCourse.get(c.id) ?? c.slug,
          lawRefs: safelyParseLawRefs(c.law_refs),
          itemCount: 0,
          version: '1.0',
          isSystem: true,
        })
      }

      // 7-10) Org-scoped per-table rows tagged with internal_pack_id.
      // These are the templates copied via the Tilpass wizard — they
      // already exist in their respective system table loops too (no,
      // they don't — system tables hold only is_system rows). The
      // per-org rows are emitted here under internal:<pack-uuid>.
      for (const r of svOrgRows) {
        if (!r.internal_pack_id) continue
        const catalogMatch = svRows.find((s) => s.id === r.catalog_id)
        collected.push({
          id: `sv-org-${r.id}`,
          packFramework: `internal:${r.internal_pack_id}`,
          module: 'undersokelse',
          moduleLabel: 'Undersøkelse',
          name: catalogMatch?.name ?? r.catalog_id ?? 'Undersøkelse',
          lawRefs: safelyParseLawRefs(r.law_refs ?? catalogMatch?.law_refs),
          itemCount: catalogMatch ? questionCount(catalogMatch.body) : 0,
          version: '1.0',
          isSystem: false,
        })
      }
      for (const r of docOrgRows) {
        if (!r.internal_pack_id) continue
        collected.push({
          id: `doc-org-${r.id}`,
          packFramework: `internal:${r.internal_pack_id}`,
          module: 'dokument',
          moduleLabel: 'Dokument',
          name: r.label ?? r.name ?? 'Dokument',
          lawRefs: safelyParseLawRefs(r.legal_basis),
          itemCount: 0,
          version: '1.0',
          isSystem: false,
        })
      }
      for (const r of meetOrgRows) {
        if (!r.internal_pack_id) continue
        collected.push({
          id: `meet-org-${r.id}`,
          packFramework: `internal:${r.internal_pack_id}`,
          module: 'mote',
          moduleLabel: 'Møte',
          name: r.name ?? 'Møte',
          lawRefs: safelyParseLawRefs(r.law_refs),
          itemCount: 0,
          version: '1.0',
          isSystem: false,
        })
      }
      for (const r of learnOrgRows) {
        if (!r.internal_pack_id) continue
        collected.push({
          id: `course-org-${r.id}`,
          packFramework: `internal:${r.internal_pack_id}`,
          module: 'kurs',
          moduleLabel: 'Kurs',
          name: r.title ?? 'Kurs',
          lawRefs: safelyParseLawRefs(r.law_refs),
          itemCount: 0,
          version: '1.0',
          isSystem: false,
        })
      }

      // Active compliance_packs rows define which packs are "installed".
      const installedSlugs = new Set(
        cpRows.filter((r) => r.is_active).map((r) => normalizeFramework(r.slug)),
      )

      // Aggregate frameworks from defaults + DB rows + template rows so
      // every framework that actually has content shows up.
      const allFrameworks = new Set<string>([
        ...FRAMEWORK_PACK_DEFAULTS.map((f) => f.framework),
        ...cpRows.map((r) => normalizeFramework(r.slug)),
        ...collected.map((t) => t.packFramework),
      ])

      const packsByFw = new Map<string, CompliancePackRow | undefined>()
      for (const p of cpRows) {
        packsByFw.set(normalizeFramework(p.slug), p)
      }

      // Internal packs are surfaced as standalone tiles (framework key
      // `internal:<uuid>`). Make sure every internal pack row appears
      // even if it has no templates yet — admins should see the
      // empty container so they can add to it.
      const internalById = new Map<string, InternalPackRow>()
      for (const p of ipRows) internalById.set(p.id, p)
      for (const p of ipRows) {
        allFrameworks.add(`internal:${p.id}`)
      }

      const result: PackSummary[] = []
      for (const fw of allFrameworks) {
        const isInternal = fw.startsWith('internal:')
        const internalPack = isInternal ? internalById.get(fw.slice('internal:'.length)) : undefined
        const meta = getFrameworkMeta(fw)
        const cpRow = isInternal ? undefined : packsByFw.get(fw)
        const defaults = isInternal
          ? undefined
          : FRAMEWORK_PACK_DEFAULTS.find((d) => d.framework === fw)
        const myTemplates = collected.filter((t) => t.packFramework === fw)
        const contents = {
          checklist: myTemplates.filter((t) => t.module === 'sjekkliste').length,
          survey: myTemplates.filter((t) => t.module === 'undersokelse').length,
          document: myTemplates.filter((t) => t.module === 'dokument').length,
          meeting: myTemplates.filter((t) => t.module === 'mote').length,
          register: myTemplates.filter((t) => t.module === 'register').length,
          course: myTemplates.filter((t) => t.module === 'kurs').length,
        }
        const totalContents =
          contents.checklist +
          contents.survey +
          contents.document +
          contents.meeting +
          contents.register +
          contents.course
        const isInstalled = isInternal
          ? true // internal packs are always "installed" — they only exist when an admin creates them
          : installedSlugs.has(fw) || (defaults?.installed ?? false)
        // Don't list frameworks that have neither a configured pack row
        // nor any content — they're registry entries with no signal to
        // render. Always include 'internal' so the Tilpass wizard has
        // somewhere to write user-built packs. Internal packs always
        // render even when empty (the admin opened them on purpose).
        if (!isInternal && totalContents === 0 && !cpRow && !defaults && fw !== 'internal') continue
        if (isInternal && !internalPack) continue
        result.push({
          id: `pack-${fw}`,
          framework: fw,
          name: internalPack?.name ?? cpRow?.plural_label ?? meta.fallbackName,
          shortName: internalPack?.name ?? cpRow?.short_name ?? meta.fallbackName,
          description:
            internalPack?.description ||
            cpRow?.description ||
            (isInternal ? 'Egendefinert pakke — redigerbar fritt.' : meta.fallbackDescription),
          icon: meta.icon,
          color: isInternal ? FRAMEWORK_REGISTRY.internal.color : meta.color,
          installed: isInstalled,
          official: !isInternal && fw !== 'internal',
          version: isInternal ? '1.0' : defaults?.version ?? '2026.1',
          lastUpdated: internalPack?.updated_at ?? cpRow?.updated_at ?? null,
          lawRefs: isInternal
            ? // For an internal pack, expose union of law refs from contained templates.
              Array.from(
                new Set(
                  myTemplates.flatMap((t) => t.lawRefs),
                ),
              ).slice(0, 6)
            : (cpRow?.legal_references ?? []).map((lr) => lr.code).filter(Boolean) ||
              meta.lawRefs,
          contents,
        })
      }

      // Order: installed first, then by total content size, then by name.
      result.sort((a, b) => {
        if (a.installed !== b.installed) return a.installed ? -1 : 1
        const aTot =
          a.contents.checklist +
          a.contents.survey +
          a.contents.document +
          a.contents.meeting +
          a.contents.register +
          a.contents.course
        const bTot =
          b.contents.checklist +
          b.contents.survey +
          b.contents.document +
          b.contents.meeting +
          b.contents.register +
          b.contents.course
        if (aTot !== bTot) return bTot - aTot
        return a.name.localeCompare(b.name)
      })

      setPacks(result)
      setTemplates(collected)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke laste mal-pakker')
    } finally {
      setLoading(false)
    }
  }, [supabase, organization?.id])

  /**
   * Install or uninstall a system pack by calling the provisioning
   * RPC (compliance / survey / meetings / registers / workflows).
   *
   * For compliance packs we call `provision_compliance_baseline_for_org`
   * with the pack slug. Other frameworks fall back to their own
   * provision_* RPC if a matching one exists.
   *
   * Returns null on success or an error message.
   */
  const installPack = useCallback(
    async (framework: string): Promise<string | null> => {
      if (!supabase || !organization?.id) return 'Mangler organisasjon.'

      // provision_compliance_baseline_for_org provisions templates +
      // upserts the compliance_packs row. It does NOT toggle is_active
      // on its own — that's a separate admin gesture.
      const { error: rpcErr } = await supabase.rpc(
        'provision_compliance_baseline_for_org',
        { p_org_id: organization.id, p_pack_slug: framework },
      )
      if (rpcErr) {
        setError(rpcErr.message)
        return rpcErr.message
      }

      // Activate the pack row so the UI reflects "installed". Idempotent.
      const { error: actErr } = await supabase
        .from('compliance_packs')
        .update({ is_active: true })
        .eq('organization_id', organization.id)
        .eq('slug', framework)
      if (actErr) {
        setError(actErr.message)
        return actErr.message
      }

      await refresh()
      return null
    },
    [supabase, organization?.id, refresh],
  )

  /**
   * Soft-uninstall a pack by setting compliance_packs.is_active = false
   * for the row matching `framework`. Existing executions still hold
   * the slug reference so we don't hard-delete.
   */
  const uninstallPack = useCallback(
    async (framework: string): Promise<string | null> => {
      if (!supabase || !organization?.id) return 'Mangler organisasjon.'
      const { error: updErr } = await supabase
        .from('compliance_packs')
        .update({ is_active: false })
        .eq('organization_id', organization.id)
        .eq('slug', framework)
      if (updErr) {
        setError(updErr.message)
        return updErr.message
      }
      await refresh()
      return null
    },
    [supabase, organization?.id, refresh],
  )

  /**
   * Create an empty internal pack (no templates yet). Used by the
   * "Ny intern pakke" button on the pack grid for admins who want to
   * group their existing templates without cloning a system pack.
   * Returns the new pack id on success.
   */
  const createEmptyInternalPack = useCallback(
    async (
      name: string,
      description?: string,
    ): Promise<{ packId: string | null; error: string | null }> => {
      if (!supabase || !organization?.id) {
        return { packId: null, error: 'Mangler organisasjon.' }
      }
      const trimmedName = name.trim()
      if (!trimmedName) {
        return { packId: null, error: 'Pakkenavn er påkrevd.' }
      }
      const packSlug = `${slugify(trimmedName).slice(0, 60) || 'pakke'}-${Date.now().toString(36)}`
      const { data, error: insErr } = await supabase
        .from('internal_packs')
        .insert({
          organization_id: organization.id,
          slug: packSlug,
          name: trimmedName,
          description: description?.trim() ?? '',
          source_pack_slug: null,
        })
        .select('id')
        .single()
      if (insErr || !data) {
        const msg = insErr?.message ?? 'Kunne ikke opprette pakke.'
        setError(msg)
        return { packId: null, error: msg }
      }
      await refresh()
      return { packId: (data as { id: string }).id, error: null }
    },
    [supabase, organization?.id, refresh],
  )

  /**
   * Tilpass-wizard finalizer. Creates one `internal_packs` row to
   * group the copies and then writes one per-org row for each selected
   * source template — across all six module-side tables:
   *
   *   cl-<id>     → compliance_checklist_templates (new row, is_system=false)
   *   sv-<id>     → survey_org_templates (upsert by (org, catalog_id))
   *   doc-<id>    → document_org_templates (new row, prefixed id)
   *   meet-<id>   → meeting_org_templates (new row, new slug)
   *   reg-<id>-*  → register_types (new row, org-scoped)
   *   course-<id> → learning_courses (new row, source_system_course_id FK)
   *
   * Each newly created row is tagged with the internal_pack_id so the
   * pack appears in the Mal-pakker grid afterwards.
   *
   * Returns per-module counts + an aggregate error if any leg failed.
   * Partial success is normal — survey "copies" are actually
   * activations (the survey override layer is one-row-per-catalog),
   * so re-running the wizard on the same selection is a no-op.
   */
  const createInternalPackFromTemplates = useCallback(
    async (
      sourceTemplateIds: string[],
      packName: string,
      sourcePackSlug?: string | null,
    ): Promise<{
      packId: string | null
      copied: number
      skipped: number
      perModule: Record<
        'checklist' | 'survey' | 'document' | 'meeting' | 'register' | 'course',
        { copied: number; failed: number }
      >
      error: string | null
    }> => {
      const empty = {
        packId: null,
        copied: 0,
        skipped: sourceTemplateIds.length,
        perModule: {
          checklist: { copied: 0, failed: 0 },
          survey: { copied: 0, failed: 0 },
          document: { copied: 0, failed: 0 },
          meeting: { copied: 0, failed: 0 },
          register: { copied: 0, failed: 0 },
          course: { copied: 0, failed: 0 },
        } as const,
        error: 'Mangler organisasjon.' as string | null,
      }
      if (!supabase || !organization?.id) {
        return empty
      }
      if (sourceTemplateIds.length === 0) {
        return { ...empty, error: 'Ingen maler valgt.' }
      }

      // Bucket the selected ids per source module.
      const clIds: string[] = []
      const svIds: string[] = []
      const docIds: string[] = []
      const meetIds: string[] = []
      const regIds: string[] = []
      const courseIds: string[] = []
      for (const id of sourceTemplateIds) {
        if (id.startsWith('cl-')) clIds.push(id.slice('cl-'.length))
        else if (id.startsWith('sv-')) svIds.push(id.slice('sv-'.length))
        else if (id.startsWith('doc-')) docIds.push(id.slice('doc-'.length))
        else if (id.startsWith('meet-')) meetIds.push(id.slice('meet-'.length))
        else if (id.startsWith('reg-')) {
          // reg ids are emitted as `reg-<id>-<packslug>` so we can render
          // them per pack. Strip the trailing -<packslug>.
          const rest = id.slice('reg-'.length)
          const lastDash = rest.lastIndexOf('-')
          regIds.push(lastDash > 0 ? rest.slice(0, lastDash) : rest)
        } else if (id.startsWith('course-')) courseIds.push(id.slice('course-'.length))
      }

      // 1) Create the pack container. The pre-insert trigger fills
      //    organization_id + created_by from auth.uid() if omitted,
      //    but we set organization_id explicitly so RLS sees the
      //    intent on the with-check side.
      const packTag = slugify(packName).slice(0, 60) || 'pakke'
      const packSlug = `${packTag}-${Date.now().toString(36)}`
      const { data: packRow, error: packErr } = await supabase
        .from('internal_packs')
        .insert({
          organization_id: organization.id,
          slug: packSlug,
          name: packName.trim() || 'Intern pakke',
          description: sourcePackSlug
            ? `Tilpasset fra ${sourcePackSlug}-pakken`
            : '',
          source_pack_slug: sourcePackSlug ?? null,
        })
        .select('id, slug, name')
        .single()
      if (packErr || !packRow) {
        const msg = packErr?.message ?? 'Kunne ikke opprette pakke-container.'
        setError(msg)
        return { ...empty, error: msg }
      }
      const packId = (packRow as { id: string }).id

      // Helper: build the slug-suffix shared by all copies for
      // traceability and uniqueness.
      const suffix = `_${packTag}_${Date.now().toString(36)}`

      const perModule = {
        checklist: { copied: 0, failed: 0 },
        survey: { copied: 0, failed: 0 },
        document: { copied: 0, failed: 0 },
        meeting: { copied: 0, failed: 0 },
        register: { copied: 0, failed: 0 },
        course: { copied: 0, failed: 0 },
      }
      const errors: string[] = []

      // 2) Compliance checklist copies.
      if (clIds.length > 0) {
        const { data: srcRows, error: selErr } = await supabase
          .from('compliance_checklist_templates')
          .select('id, pack, slug, name, definition, metadata_schema, law_refs, category_id, cadence_hint')
          .in('id', clIds)
        if (selErr) {
          errors.push(`Sjekkliste: ${selErr.message}`)
          perModule.checklist.failed = clIds.length
        } else {
          const inserts = (srcRows ?? []).map((r) => {
            const row = r as {
              pack: string
              slug: string
              name: string
              definition: unknown
              metadata_schema: unknown
              law_refs: string[] | null
              category_id: string | null
              cadence_hint: string | null
            }
            return {
              organization_id: organization.id,
              pack: row.pack,
              slug: `${row.slug}${suffix}`.slice(0, 120),
              name: `${row.name} (${packName})`,
              definition: row.definition ?? { items: [] },
              metadata_schema: row.metadata_schema ?? { fields: [] },
              law_refs: row.law_refs ?? [],
              is_system: false,
              is_active: true,
              review_status: 'draft' as const,
              category_id: row.category_id,
              cadence_hint: row.cadence_hint,
              internal_pack_id: packId,
            }
          })
          if (inserts.length > 0) {
            const { data: insRows, error: insErr } = await supabase
              .from('compliance_checklist_templates')
              .insert(inserts)
              .select('id')
            if (insErr) {
              errors.push(`Sjekkliste: ${insErr.message}`)
              perModule.checklist.failed = inserts.length
            } else {
              perModule.checklist.copied = (insRows ?? []).length
            }
          }
        }
      }

      // 3) Survey: the override layer is one row per (org, catalog_id),
      //    so we "copy" by upserting an enabled row. The system body
      //    is referenced via catalog_id; we don't duplicate body.
      if (svIds.length > 0) {
        const { data: srcRows, error: selErr } = await supabase
          .from('survey_template_catalog')
          .select('id, pack, law_refs')
          .in('id', svIds)
        if (selErr) {
          errors.push(`Undersøkelse: ${selErr.message}`)
          perModule.survey.failed = svIds.length
        } else {
          const inserts = (srcRows ?? []).map((r) => {
            const row = r as { id: string; pack: string; law_refs: string[] | null }
            return {
              organization_id: organization.id,
              catalog_id: row.id,
              pack: row.pack,
              is_active: true,
              nav_pinned: false,
              review_status: 'draft' as const,
              law_refs: row.law_refs ?? [],
              internal_pack_id: packId,
            }
          })
          if (inserts.length > 0) {
            const { data: upsRows, error: upsErr } = await supabase
              .from('survey_org_templates')
              .upsert(inserts, { onConflict: 'organization_id,catalog_id' })
              .select('id')
            if (upsErr) {
              errors.push(`Undersøkelse: ${upsErr.message}`)
              perModule.survey.failed = inserts.length
            } else {
              perModule.survey.copied = (upsRows ?? []).length
            }
          }
        }
      }

      // 4) Document: new org-scoped row with a prefixed id (text PK).
      if (docIds.length > 0) {
        const { data: srcRows, error: selErr } = await supabase
          .from('document_system_templates')
          .select('id, label, description, category, legal_basis, page_payload')
          .in('id', docIds)
        if (selErr) {
          errors.push(`Dokument: ${selErr.message}`)
          perModule.document.failed = docIds.length
        } else {
          const inserts = (srcRows ?? []).map((r) => {
            const row = r as {
              id: string
              label: string
              description: string
              category: string
              legal_basis: string[] | null
              page_payload: unknown
            }
            return {
              id: `${row.id}-${packTag}-${Math.random().toString(36).slice(2, 8)}`,
              organization_id: organization.id,
              label: `${row.label} (${packName})`,
              description: row.description ?? '',
              category: row.category,
              legal_basis: row.legal_basis ?? [],
              page_payload: row.page_payload ?? {},
              review_status: 'draft' as const,
              nav_pinned: false,
              metadata_schema: { fields: [] },
              internal_pack_id: packId,
            }
          })
          if (inserts.length > 0) {
            const { data: insRows, error: insErr } = await supabase
              .from('document_org_templates')
              .insert(inserts)
              .select('id')
            if (insErr) {
              errors.push(`Dokument: ${insErr.message}`)
              perModule.document.failed = inserts.length
            } else {
              perModule.document.copied = (insRows ?? []).length
            }
          }
        }
      }

      // 5) Meeting: new org row with new slug.
      if (meetIds.length > 0) {
        const { data: srcRows, error: selErr } = await supabase
          .from('meeting_system_templates')
          .select('id, slug, label, framework, frameworks, law_refs, definition, metadata_schema, default_confidentiality_level')
          .in('id', meetIds)
        if (selErr) {
          errors.push(`Møte: ${selErr.message}`)
          perModule.meeting.failed = meetIds.length
        } else {
          const inserts = (srcRows ?? []).map((r) => {
            const row = r as {
              slug: string
              label: string
              framework: string
              frameworks: string[] | null
              law_refs: string[] | null
              definition: unknown
              metadata_schema: unknown
              default_confidentiality_level: string
            }
            return {
              organization_id: organization.id,
              slug: `${row.slug}${suffix}`.slice(0, 120),
              name: `${row.label} (${packName})`,
              framework: row.framework,
              frameworks: row.frameworks ?? [],
              law_refs: row.law_refs ?? [],
              definition: row.definition ?? { agendaItems: [] },
              metadata_schema: row.metadata_schema ?? { fields: [] },
              default_confidentiality_level: row.default_confidentiality_level,
              nav_pinned: false,
              is_active: true,
              review_status: 'draft' as const,
              internal_pack_id: packId,
            }
          })
          if (inserts.length > 0) {
            const { data: insRows, error: insErr } = await supabase
              .from('meeting_org_templates')
              .insert(inserts)
              .select('id')
            if (insErr) {
              errors.push(`Møte: ${insErr.message}`)
              perModule.meeting.failed = inserts.length
            } else {
              perModule.meeting.copied = (insRows ?? []).length
            }
          }
        }
      }

      // 6) Register: new org-scoped row in the dual-purpose register_types table.
      if (regIds.length > 0) {
        const dedupedRegIds = Array.from(new Set(regIds))
        const { data: srcRows, error: selErr } = await supabase
          .from('register_types')
          .select('id, name, description, metadata_schema, regulation_ids, pack_slugs, aml_paragraphs, default_review_cadence_months, default_locale')
          .in('id', dedupedRegIds)
        if (selErr) {
          errors.push(`Register: ${selErr.message}`)
          perModule.register.failed = dedupedRegIds.length
        } else {
          const inserts = (srcRows ?? []).map((r) => {
            const row = r as {
              id: string
              name: string
              description: string | null
              metadata_schema: unknown
              regulation_ids: string[] | null
              pack_slugs: string[] | null
              aml_paragraphs: string[] | null
              default_review_cadence_months: number | null
              default_locale: string
            }
            return {
              id: `${row.id}-${packTag}-${Math.random().toString(36).slice(2, 8)}`,
              organization_id: organization.id,
              name: `${row.name} (${packName})`,
              description: row.description ?? null,
              metadata_schema: row.metadata_schema ?? { fields: [] },
              regulation_ids: row.regulation_ids ?? [],
              pack_slugs: row.pack_slugs ?? [],
              aml_paragraphs: row.aml_paragraphs ?? [],
              default_review_cadence_months: row.default_review_cadence_months,
              is_active: true,
              is_system: false,
              position: 100,
              review_status: 'draft' as const,
              default_locale: row.default_locale,
              internal_pack_id: packId,
            }
          })
          if (inserts.length > 0) {
            const { data: insRows, error: insErr } = await supabase
              .from('register_types')
              .insert(inserts)
              .select('id')
            if (insErr) {
              errors.push(`Register: ${insErr.message}`)
              perModule.register.failed = inserts.length
            } else {
              perModule.register.copied = (insRows ?? []).length
            }
          }
        }
      }

      // 7) Learning: org-scoped course pointing back to the system course.
      if (courseIds.length > 0) {
        const { data: srcRows, error: selErr } = await supabase
          .from('learning_system_courses')
          .select('id, slug, law_refs, required_for_roles, default_locale')
          .in('id', courseIds)
        if (selErr) {
          errors.push(`Kurs: ${selErr.message}`)
          perModule.course.failed = courseIds.length
        } else {
          // Fetch the localized titles so the copied course doesn't
          // ship with just the slug as title.
          const ids = (srcRows ?? []).map((r) => (r as { id: string }).id)
          const { data: localeRows } = await supabase
            .from('learning_system_course_locales')
            .select('system_course_id, locale, title, summary')
            .in('system_course_id', ids)
          const localeByCourse = new Map<string, { title: string; summary: string }>()
          for (const lr of (localeRows ?? []) as {
            system_course_id: string
            locale: string
            title: string
            summary: string | null
          }[]) {
            const existing = localeByCourse.get(lr.system_course_id)
            if (!existing || lr.locale === 'nb') {
              localeByCourse.set(lr.system_course_id, {
                title: lr.title,
                summary: lr.summary ?? '',
              })
            }
          }
          const inserts = (srcRows ?? []).map((r) => {
            const row = r as {
              id: string
              slug: string
              law_refs: unknown
              required_for_roles: string[] | null
              default_locale: string
            }
            const locale = localeByCourse.get(row.id)
            return {
              id: `${row.slug}-${packTag}-${Math.random().toString(36).slice(2, 8)}`,
              organization_id: organization.id,
              title: locale?.title
                ? `${locale.title} (${packName})`
                : `${row.slug} (${packName})`,
              description: locale?.summary ?? '',
              status: 'draft',
              tags: [],
              prerequisite_course_ids: [],
              course_version: 1,
              course_version_minor: 0,
              metadata_schema: { fields: [] },
              law_refs: row.law_refs ?? {},
              required_for_roles: row.required_for_roles ?? [],
              review_status: 'draft' as const,
              internal_pack_id: packId,
            }
          })
          if (inserts.length > 0) {
            const { data: insRows, error: insErr } = await supabase
              .from('learning_courses')
              .insert(inserts)
              .select('id')
            if (insErr) {
              errors.push(`Kurs: ${insErr.message}`)
              perModule.course.failed = inserts.length
            } else {
              perModule.course.copied = (insRows ?? []).length
            }
          }
        }
      }

      const copied =
        perModule.checklist.copied +
        perModule.survey.copied +
        perModule.document.copied +
        perModule.meeting.copied +
        perModule.register.copied +
        perModule.course.copied
      const failedCount =
        perModule.checklist.failed +
        perModule.survey.failed +
        perModule.document.failed +
        perModule.meeting.failed +
        perModule.register.failed +
        perModule.course.failed

      // If nothing landed AND every leg failed, surface the joint error
      // and roll back the pack container so we don't leave an empty
      // shell behind.
      if (copied === 0 && failedCount > 0) {
        await supabase.from('internal_packs').delete().eq('id', packId)
        return {
          packId: null,
          copied: 0,
          skipped: 0,
          perModule,
          error: errors.join(' · '),
        }
      }

      await refresh()
      return {
        packId,
        copied,
        skipped: 0,
        perModule,
        error: errors.length > 0 ? errors.join(' · ') : null,
      }
    },
    [supabase, organization?.id, refresh],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    packs,
    templates,
    loading,
    error,
    refresh,
    installPack,
    uninstallPack,
    createInternalPackFromTemplates,
    createEmptyInternalPack,
  }
}
