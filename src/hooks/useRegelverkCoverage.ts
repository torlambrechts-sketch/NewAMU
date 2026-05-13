// useRegelverkCoverage — bygger mapping fra lawRef-streng til alle ressurser
// (kurs, dokumenter, surveys, sjekklister, ROS, tasks, møter) som dekker
// kravet via sin law_refs/legal_refs/law_ref-felt.
//
// Hver oppføring er tagget som enten:
//   - 'template'  = bibliotek-mal (system eller per-org) som kan aktiveres
//                   via provisjonering. Wizards' module_picker viser disse.
//   - 'instance'  = faktisk publisert ressurs i orgen. Regelverk-dekning-
//                   dashbordet bruker disse som signal på reell dekning.

import { useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'

export type CoverageEntry = {
  kind:
    | 'course_system'
    | 'course_org'
    | 'document'
    | 'document_template'
    | 'survey'
    | 'checklist_template'
    | 'checklist_item'
    | 'ros'
    | 'task'
    | 'meeting_template'
  id: string
  title: string
  status?: string
  link?: string
  source: 'template' | 'instance'
  /** ISO timestamp of last meaningful update — used by the regelverk-dashboard
   *  to decide if an instance is fresh enough to count as proof of compliance. */
  lastSeenAt?: string
}

export type CoverageMap = Map<string, CoverageEntry[]>

function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string')
  if (typeof v === 'string') return [v]
  return []
}

// Normaliser law-ref slik at "AML §3-1" og "AML § 3-1" matcher samme bucket
function normalizeLawRef(ref: string): string {
  return ref
    .replace(/\s+/g, ' ')
    .replace(/§\s*/g, '§ ')
    .trim()
}

export function useRegelverkCoverage() {
  const { supabase, organization } = useOrgSetupContext()
  const [coverage, setCoverage] = useState<CoverageMap>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase || !organization?.id) return
    let cancelled = false
    const orgId = organization.id

    void Promise.all([
      // Læring — system courses + locales for tittel
      supabase
        .from('learning_system_courses')
        .select('id, slug, law_refs'),
      supabase
        .from('learning_system_course_locales')
        .select('system_course_id, title')
        .eq('locale', 'nb'),
      // Læring — org-spesifikke kurs (instance)
      supabase
        .from('learning_courses')
        .select('id, title, law_refs, status, updated_at')
        .eq('organization_id', orgId),
      // Dokumenter — faktiske wiki-sider (instance)
      supabase
        .from('wiki_pages')
        .select('id, title, legal_refs, status, updated_at')
        .eq('organization_id', orgId),
      // Dokument-maler — system-katalog (template)
      supabase
        .from('document_system_templates')
        .select('id, label, legal_basis'),
      // Dokument-maler — per-org tilpasninger (template)
      supabase
        .from('document_org_templates')
        .select('id, label, legal_basis')
        .eq('organization_id', orgId),
      // Survey-template-katalog (template) — leser BÅDE law_refs[] (nytt
      // standardfelt jf. CLAUDE.md) og law_ref (legacy singular).
      supabase
        .from('survey_template_catalog')
        .select('id, name, law_ref, law_refs, body')
        .eq('is_system', true),
      // Compliance-sjekklister (template)
      supabase
        .from('compliance_checklist_templates')
        .select('id, name, law_refs, definition'),
      // ROS (instance) — bruker law_domains
      supabase
        .from('ros_analyses')
        .select('id, title, law_domains, status')
        .eq('organization_id', orgId),
      // Tasks (instance) — law_refs
      supabase
        .from('task_items')
        .select('id, title, law_refs, status')
        .eq('organization_id', orgId)
        .limit(500),
      // Meeting templates (template)
      supabase
        .from('meeting_system_templates')
        .select('id, title, law_refs'),
    ]).then(([
      sysCoursesRes, locRes, orgCoursesRes,
      docsRes, docSysTplRes, docOrgTplRes,
      surveysRes, checklistsRes,
      rosRes, tasksRes, meetingsRes,
    ]) => {
      if (cancelled) return

      const map: CoverageMap = new Map()
      const add = (ref: string, entry: CoverageEntry) => {
        const norm = normalizeLawRef(ref)
        if (!norm) return
        if (!map.has(norm)) map.set(norm, [])
        map.get(norm)!.push(entry)
      }

      // System courses (template) → tittel via locales
      const titleByCourseId = new Map<string, string>()
      for (const r of (locRes.data ?? []) as { system_course_id: string; title: string }[]) {
        titleByCourseId.set(r.system_course_id, r.title)
      }
      for (const c of (sysCoursesRes.data ?? []) as { id: string; slug: string; law_refs: unknown }[]) {
        const title = titleByCourseId.get(c.id) ?? c.slug
        for (const ref of asArray(c.law_refs)) {
          add(ref, { kind: 'course_system', id: c.id, title, source: 'template' })
        }
      }

      // Org-courses (instance)
      for (const c of (orgCoursesRes.data ?? []) as { id: string; title: string; law_refs: unknown; status: string; updated_at: string }[]) {
        for (const ref of asArray(c.law_refs)) {
          add(ref, { kind: 'course_org', id: c.id, title: c.title, status: c.status, source: 'instance', lastSeenAt: c.updated_at })
        }
      }

      // Documents (instance) — faktiske wiki-sider
      for (const d of (docsRes.data ?? []) as { id: string; title: string; legal_refs: string[] | null; status: string; updated_at: string }[]) {
        for (const ref of asArray(d.legal_refs)) {
          add(ref, { kind: 'document', id: d.id, title: d.title, status: d.status, source: 'instance', lastSeenAt: d.updated_at })
        }
      }

      // Dokument-maler (template) — system + per-org. Legal_basis er tilsvarende
      // legal_refs men på malen i stedet for instansen.
      for (const t of (docSysTplRes.data ?? []) as { id: string; label: string; legal_basis: string[] | null }[]) {
        for (const ref of asArray(t.legal_basis)) {
          add(ref, { kind: 'document_template', id: t.id, title: t.label, source: 'template' })
        }
      }
      for (const t of (docOrgTplRes.data ?? []) as { id: string; label: string; legal_basis: string[] | null }[]) {
        for (const ref of asArray(t.legal_basis)) {
          add(ref, { kind: 'document_template', id: t.id, title: t.label, source: 'template' })
        }
      }

      // Surveys (template) — law_refs[] (nytt) + law_ref (legacy) + per-question
      for (const s of (surveysRes.data ?? []) as {
        id: string
        name: string
        law_ref: string | null
        law_refs: string[] | null
        body: { questions?: Array<{ law_ref?: string; law_refs?: string[] }> } | null
      }[]) {
        const refs = new Set<string>()
        for (const r of asArray(s.law_refs)) refs.add(r)
        if (s.law_ref) refs.add(s.law_ref)
        for (const ref of refs) {
          add(ref, { kind: 'survey', id: s.id, title: s.name, source: 'template' })
        }
        const questions = s.body?.questions ?? []
        for (const q of questions) {
          const qRefs = new Set<string>()
          for (const r of asArray(q.law_refs)) qRefs.add(r)
          if (q.law_ref) qRefs.add(q.law_ref)
          for (const ref of qRefs) {
            add(ref, { kind: 'survey', id: s.id, title: `${s.name} (Q)`, source: 'template' })
          }
        }
      }

      // Compliance checklists (template) — top + items
      for (const c of (checklistsRes.data ?? []) as { id: string; name: string; law_refs: string[] | null; definition: { items?: Array<{ law_ref?: string; key?: string }> } | null }[]) {
        for (const ref of asArray(c.law_refs)) {
          add(ref, { kind: 'checklist_template', id: c.id, title: c.name, source: 'template' })
        }
        const items = c.definition?.items ?? []
        for (const item of items) {
          if (item.law_ref) {
            add(item.law_ref, {
              kind: 'checklist_item',
              id: c.id,
              title: `${c.name} — ${item.key ?? 'item'}`,
              source: 'template',
            })
          }
        }
      }

      // ROS (instance) — law_domains er bredt (eks: 'AML', 'BVL').
      for (const r of (rosRes.data ?? []) as { id: string; title: string; law_domains: string[] | null; status: string }[]) {
        for (const dom of asArray(r.law_domains)) {
          add(dom, { kind: 'ros', id: r.id, title: r.title, status: r.status, source: 'instance' })
        }
      }

      // Tasks (instance)
      for (const t of (tasksRes.data ?? []) as { id: string; title: string; law_refs: string[] | null; status: string }[]) {
        for (const ref of asArray(t.law_refs)) {
          add(ref, { kind: 'task', id: t.id, title: t.title, status: t.status, source: 'instance' })
        }
      }

      // Meeting system templates (template)
      for (const m of (meetingsRes.data ?? []) as { id: string; title: string; law_refs: unknown }[]) {
        for (const ref of asArray(m.law_refs)) {
          add(ref, { kind: 'meeting_template', id: m.id, title: m.title, source: 'template' })
        }
      }

      setCoverage(map)
      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [supabase, organization?.id])

  return useMemo(() => ({ coverage, loading, normalizeLawRef }), [coverage, loading])
}
