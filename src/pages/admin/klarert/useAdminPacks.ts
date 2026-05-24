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
import { FRAMEWORK_PACK_DEFAULTS, getFrameworkMeta } from './packMetadata'
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
  ) => Promise<{ copied: number; skipped: number; error: string | null }>
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
      const [cpRes, clRes, svRes, docRes, meetRes, regRes, courseRes] = await Promise.all([
        supabase
          .from('compliance_packs')
          .select('slug, short_name, plural_label, description, legal_references, position, is_active, updated_at')
          .eq('organization_id', organization.id)
          .limit(ROW_CAP),
        supabase
          .from('compliance_checklist_templates')
          .select('id, organization_id, pack, name, law_refs, is_active, is_system, current_version_major, current_version_minor')
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
          .select('id, name, pack_slugs, regulation_ids, aml_paragraphs, organization_id, is_system')
          .or(`organization_id.is.null,organization_id.eq.${organization.id}`)
          .eq('is_active', true)
          .limit(ROW_CAP),
        supabase
          .from('learning_system_courses')
          .select('id, slug, law_refs, required_for_roles, default_locale')
          .limit(ROW_CAP),
      ])

      const cpRows = (cpRes.error ? [] : (cpRes.data ?? [])) as CompliancePackRow[]
      const clRows = (clRes.error ? [] : (clRes.data ?? [])) as ChecklistTemplateRow[]
      const svRows = (svRes.error ? [] : (svRes.data ?? [])) as SurveyCatalogRow[]
      const docRows = (docRes.error ? [] : (docRes.data ?? [])) as DocumentTemplateRow[]
      const meetRows = (meetRes.error ? [] : (meetRes.data ?? [])) as MeetingTemplateRow[]
      const regRows = (regRes.error ? [] : (regRes.data ?? [])) as RegisterTypeRow[]
      const courseRows = (courseRes.error ? [] : (courseRes.data ?? [])) as LearningCourseRow[]

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

      // 1) Checklists (per-org templates carry the pack enum directly)
      for (const c of clRows) {
        const version = `${c.current_version_major ?? 1}.${c.current_version_minor ?? 0}`
        collected.push({
          id: `cl-${c.id}`,
          packFramework: normalizeFramework(c.pack),
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

      // 5) Register types (system + per-org). One register may map to
      // multiple packs — emit a row per pack so it shows up everywhere
      // it's listed.
      for (const r of regRows) {
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

      const result: PackSummary[] = []
      for (const fw of allFrameworks) {
        const meta = getFrameworkMeta(fw)
        const cpRow = packsByFw.get(fw)
        const defaults = FRAMEWORK_PACK_DEFAULTS.find((d) => d.framework === fw)
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
        const isInstalled = installedSlugs.has(fw) || (defaults?.installed ?? false)
        // Don't list frameworks that have neither a configured pack row
        // nor any content — they're registry entries with no signal to
        // render. Always include 'internal' so the Tilpass wizard has
        // somewhere to write user-built packs.
        if (totalContents === 0 && !cpRow && !defaults && fw !== 'internal') continue
        result.push({
          id: `pack-${fw}`,
          framework: fw,
          name: cpRow?.plural_label || meta.fallbackName,
          shortName: cpRow?.short_name ?? meta.fallbackName,
          description: cpRow?.description || meta.fallbackDescription,
          icon: meta.icon,
          color: meta.color,
          installed: isInstalled,
          official: fw !== 'internal',
          version: defaults?.version ?? '2026.1',
          lastUpdated: cpRow?.updated_at ?? null,
          lawRefs:
            (cpRow?.legal_references ?? []).map((lr) => lr.code).filter(Boolean) ||
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
   * Tilpass-wizard finalizer. Copies each selected source template
   * into a per-org compliance_checklist_templates row with
   * `is_system = false` so the org can edit freely.
   *
   * Only sjekkliste templates are supported per row today —
   * survey/doc/meeting/learning copies need their own per-table flow
   * because they live in different override tables.
   *
   * Returns the count of successful copies + skipped templates.
   */
  const createInternalPackFromTemplates = useCallback(
    async (
      sourceTemplateIds: string[],
      packName: string,
    ): Promise<{
      copied: number
      skipped: number
      error: string | null
    }> => {
      if (!supabase || !organization?.id) {
        return { copied: 0, skipped: sourceTemplateIds.length, error: 'Mangler organisasjon.' }
      }
      // Only sjekkliste (compliance_checklist_templates) rows can be
      // per-row copied today; ignore the rest with a `skipped` count.
      const clIds = sourceTemplateIds
        .filter((id) => id.startsWith('cl-'))
        .map((id) => id.slice('cl-'.length))
      const skipped = sourceTemplateIds.length - clIds.length

      if (clIds.length === 0) {
        return {
          copied: 0,
          skipped,
          error: skipped > 0
            ? 'Kun sjekkliste-maler støttes for tilpasning i denne versjonen. Bruk de respektive modulene for å tilpasse de andre malene.'
            : 'Ingen maler valgt.',
        }
      }

      // Fetch the source rows so we can rewrite slug + organization_id.
      const { data: srcRows, error: selErr } = await supabase
        .from('compliance_checklist_templates')
        .select('id, pack, slug, name, definition, metadata_schema, law_refs, category_id, cadence_hint')
        .in('id', clIds)
      if (selErr) {
        setError(selErr.message)
        return { copied: 0, skipped, error: selErr.message }
      }

      const packTag = slugify(packName).slice(0, 40) || 'kopi'
      const suffix = `_${packTag}_${Date.now().toString(36)}`
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
        }
      })

      if (inserts.length === 0) {
        return { copied: 0, skipped, error: 'Fant ingen kildemaler å kopiere.' }
      }

      const { error: insErr, data: insRows } = await supabase
        .from('compliance_checklist_templates')
        .insert(inserts)
        .select('id, slug')
      if (insErr) {
        setError(insErr.message)
        return { copied: 0, skipped, error: insErr.message }
      }
      await refresh()
      return { copied: (insRows ?? []).length, skipped, error: null }
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
  }
}
