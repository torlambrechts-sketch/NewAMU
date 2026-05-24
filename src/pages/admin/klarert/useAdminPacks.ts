// Loads template packs for the Mal-pakker section.
//
// The "pack" concept aggregates per-framework content from:
//   - compliance_packs (per-org pack configuration)
//   - survey_template_catalog (system survey templates)
//   - document_system_templates (system docs)
//   - meeting_system_templates (system meetings)
//   - register_types (org_id NULL = system)
//   - learning_system_courses (system courses)
//
// Each template surface stores law refs in a slightly different column;
// the loader maps them via the framework constants in packMetadata.

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
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

interface SurveyCatalogRow {
  id: string
  slug: string
  name: string
  framework: string | null
  law_refs: string[] | null
  questions_count: number | null
  version: number | null
}

interface DocumentTemplateRow {
  id: string
  slug: string
  name: string
  framework: string | null
  legal_basis: string[] | null
  version: number | null
}

interface MeetingTemplateRow {
  id: string
  slug: string
  name: string
  framework: string | null
  law_refs: string[] | null
  version: number | null
}

interface RegisterTypeRow {
  id: string
  slug: string
  name: string
  framework: string | null
  regulation_ids: string[] | null
  organization_id: string | null
}

interface LearningCourseRow {
  id: string
  slug: string
  name: string
  framework: string | null
  law_refs: unknown
  version: number | null
}

export interface AdminPacksResult {
  packs: PackSummary[]
  templates: PackTemplateRow[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

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
      const collected: PackTemplateRow[] = []

      // 1) Compliance packs — per-org content config
      const cpRes = await supabase
        .from('compliance_packs')
        .select('slug, short_name, plural_label, description, legal_references, position, is_active, updated_at')
        .eq('organization_id', organization.id)
      const cpRows = ((cpRes.data ?? []) as CompliancePackRow[]).filter(() => !cpRes.error)
      const installedSlugs = new Set(cpRows.filter((r) => r.is_active).map((r) => r.slug))

      // 2) Survey catalog (system-wide)
      const svRes = await supabase
        .from('survey_template_catalog')
        .select('id, slug, name, framework, law_refs, questions_count, version')
      if (!svRes.error && svRes.data) {
        for (const s of svRes.data as SurveyCatalogRow[]) {
          collected.push({
            id: `sv-${s.id}`,
            packFramework: s.framework ?? 'aml-amu',
            module: 'undersokelse',
            moduleLabel: 'Undersøkelse',
            name: s.name,
            lawRefs: safelyParseLawRefs(s.law_refs),
            itemCount: s.questions_count ?? 0,
            version: s.version ? String(s.version) : '1.0',
            isSystem: true,
          })
        }
      }

      // 3) Document system templates
      const docRes = await supabase
        .from('document_system_templates')
        .select('id, slug, name, framework, legal_basis, version')
      if (!docRes.error && docRes.data) {
        for (const d of docRes.data as DocumentTemplateRow[]) {
          collected.push({
            id: `doc-${d.id}`,
            packFramework: d.framework ?? 'aml-amu',
            module: 'dokument',
            moduleLabel: 'Dokument',
            name: d.name,
            lawRefs: safelyParseLawRefs(d.legal_basis),
            itemCount: 0,
            version: d.version ? String(d.version) : '1.0',
            isSystem: true,
          })
        }
      }

      // 4) Meeting system templates
      const meetRes = await supabase
        .from('meeting_system_templates')
        .select('id, slug, name, framework, law_refs, version')
      if (!meetRes.error && meetRes.data) {
        for (const m of meetRes.data as MeetingTemplateRow[]) {
          collected.push({
            id: `meet-${m.id}`,
            packFramework: m.framework ?? 'aml-amu',
            module: 'mote',
            moduleLabel: 'Møte',
            name: m.name,
            lawRefs: safelyParseLawRefs(m.law_refs),
            itemCount: 0,
            version: m.version ? String(m.version) : '1.0',
            isSystem: true,
          })
        }
      }

      // 5) Register types (system rows: organization_id IS NULL)
      const regRes = await supabase
        .from('register_types')
        .select('id, slug, name, framework, regulation_ids, organization_id')
        .or(`organization_id.is.null,organization_id.eq.${organization.id}`)
      if (!regRes.error && regRes.data) {
        for (const r of regRes.data as RegisterTypeRow[]) {
          collected.push({
            id: `reg-${r.id}`,
            packFramework: r.framework ?? 'aml-amu',
            module: 'register',
            moduleLabel: 'Register',
            name: r.name,
            lawRefs: safelyParseLawRefs(r.regulation_ids),
            itemCount: 0,
            version: '1.0',
            isSystem: r.organization_id == null,
          })
        }
      }

      // 6) Learning system courses
      const courseRes = await supabase
        .from('learning_system_courses')
        .select('id, slug, name, framework, law_refs, version')
      if (!courseRes.error && courseRes.data) {
        for (const c of courseRes.data as LearningCourseRow[]) {
          collected.push({
            id: `course-${c.id}`,
            packFramework: c.framework ?? 'aml-amu',
            module: 'kurs',
            moduleLabel: 'Kurs',
            name: c.name,
            lawRefs: safelyParseLawRefs(c.law_refs),
            itemCount: 0,
            version: c.version ? String(c.version) : '1.0',
            isSystem: true,
          })
        }
      }

      // Build the per-framework pack summaries.
      const allFrameworks = new Set<string>([
        ...FRAMEWORK_PACK_DEFAULTS.map((f) => f.framework),
        ...collected.map((t) => t.packFramework),
        ...cpRows.map((r) => r.slug),
      ])

      const result: PackSummary[] = []
      for (const fw of allFrameworks) {
        const meta = getFrameworkMeta(fw)
        const pack = cpRows.find((r) => r.slug === fw)
        const defaults = FRAMEWORK_PACK_DEFAULTS.find((d) => d.framework === fw)
        const myTemplates = collected.filter((t) => t.packFramework === fw)
        const contents = {
          checklist: pack && pack.is_active ? Math.max(2, Math.round((meta.lawRefs.length || 1) * 2.5)) : 0,
          survey: myTemplates.filter((t) => t.module === 'undersokelse').length,
          document: myTemplates.filter((t) => t.module === 'dokument').length,
          meeting: myTemplates.filter((t) => t.module === 'mote').length,
          register: myTemplates.filter((t) => t.module === 'register').length,
          course: myTemplates.filter((t) => t.module === 'kurs').length,
        }
        const isInstalled = installedSlugs.has(fw) || (defaults?.installed ?? false)
        result.push({
          id: `pack-${fw}`,
          framework: fw,
          name: pack?.short_name ? pack.plural_label || meta.fallbackName : meta.fallbackName,
          shortName: pack?.short_name ?? meta.fallbackName,
          description: pack?.description || meta.fallbackDescription,
          icon: meta.icon,
          color: meta.color,
          installed: isInstalled,
          official: fw !== 'internal',
          version: defaults?.version ?? '2026.1',
          lastUpdated: pack?.updated_at ?? null,
          lawRefs:
            (pack?.legal_references ?? []).map((lr) => lr.code).filter(Boolean) ||
            meta.lawRefs,
          contents,
        })
      }

      // Order: installed first, then by name.
      result.sort((a, b) => {
        if (a.installed !== b.installed) return a.installed ? -1 : 1
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

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { packs, templates, loading, error, refresh }
}
