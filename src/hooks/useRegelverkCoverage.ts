// useRegelverkCoverage — bygger mapping fra lawRef-streng til alle ressurser
// (kurs, dokumenter, surveys, sjekklister, ROS, tasks, møter) som dekker
// kravet via sin law_refs/legal_refs/law_ref-felt.
//
// Brukes av RegelverkCoveragePage til å vise per-§ dekning.

import { useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'

export type CoverageEntry = {
  kind: 'course_system' | 'course_org' | 'document' | 'survey' | 'checklist_template' | 'checklist_item' | 'ros' | 'task' | 'meeting_template'
  id: string
  title: string
  status?: string
  link?: string
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
      // Læring — org-spesifikke kurs
      supabase
        .from('learning_courses')
        .select('id, title, law_refs, status')
        .eq('organization_id', orgId),
      // Dokumenter
      supabase
        .from('wiki_pages')
        .select('id, title, legal_refs, status')
        .eq('organization_id', orgId),
      // Survey-template-katalog (system)
      supabase
        .from('survey_template_catalog')
        .select('id, name, law_ref, body')
        .eq('is_system', true),
      // Compliance-sjekklister
      supabase
        .from('compliance_checklist_templates')
        .select('id, name, law_refs, definition'),
      // ROS — bruker law_domains
      supabase
        .from('ros_analyses')
        .select('id, title, law_domains, status')
        .eq('organization_id', orgId),
      // Tasks (avvik) — law_refs
      supabase
        .from('task_items')
        .select('id, title, law_refs, status')
        .eq('organization_id', orgId)
        .limit(500),
      // Meeting templates
      supabase
        .from('meeting_system_templates')
        .select('id, title, law_refs'),
    ]).then(([
      sysCoursesRes, locRes, orgCoursesRes,
      docsRes, surveysRes, checklistsRes,
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

      // System courses → tittel via locales
      const titleByCourseId = new Map<string, string>()
      for (const r of (locRes.data ?? []) as { system_course_id: string; title: string }[]) {
        titleByCourseId.set(r.system_course_id, r.title)
      }
      for (const c of (sysCoursesRes.data ?? []) as { id: string; slug: string; law_refs: unknown }[]) {
        const title = titleByCourseId.get(c.id) ?? c.slug
        for (const ref of asArray(c.law_refs)) {
          add(ref, { kind: 'course_system', id: c.id, title })
        }
      }

      // Org-courses
      for (const c of (orgCoursesRes.data ?? []) as { id: string; title: string; law_refs: unknown; status: string }[]) {
        for (const ref of asArray(c.law_refs)) {
          add(ref, { kind: 'course_org', id: c.id, title: c.title, status: c.status })
        }
      }

      // Documents
      for (const d of (docsRes.data ?? []) as { id: string; title: string; legal_refs: string[] | null; status: string }[]) {
        for (const ref of asArray(d.legal_refs)) {
          add(ref, { kind: 'document', id: d.id, title: d.title, status: d.status })
        }
      }

      // Surveys — top-level + per-question
      for (const s of (surveysRes.data ?? []) as { id: string; name: string; law_ref: string | null; body: { questions?: Array<{ law_ref?: string }> } | null }[]) {
        if (s.law_ref) add(s.law_ref, { kind: 'survey', id: s.id, title: s.name })
        const questions = s.body?.questions ?? []
        for (const q of questions) {
          if (q.law_ref) add(q.law_ref, { kind: 'survey', id: s.id, title: `${s.name} (Q)` })
        }
      }

      // Compliance checklists — top + items
      for (const c of (checklistsRes.data ?? []) as { id: string; name: string; law_refs: string[] | null; definition: { items?: Array<{ law_ref?: string; key?: string }> } | null }[]) {
        for (const ref of asArray(c.law_refs)) {
          add(ref, { kind: 'checklist_template', id: c.id, title: c.name })
        }
        const items = c.definition?.items ?? []
        for (const item of items) {
          if (item.law_ref) add(item.law_ref, { kind: 'checklist_item', id: c.id, title: `${c.name} — ${item.key ?? 'item'}` })
        }
      }

      // ROS — law_domains er bredt (eks: 'AML', 'BVL'); brukes for filtrering
      // Mapper hver til "AML" som bucket-prefiks
      for (const r of (rosRes.data ?? []) as { id: string; title: string; law_domains: string[] | null; status: string }[]) {
        for (const dom of asArray(r.law_domains)) {
          add(dom, { kind: 'ros', id: r.id, title: r.title, status: r.status })
        }
      }

      // Tasks
      for (const t of (tasksRes.data ?? []) as { id: string; title: string; law_refs: string[] | null; status: string }[]) {
        for (const ref of asArray(t.law_refs)) {
          add(ref, { kind: 'task', id: t.id, title: t.title, status: t.status })
        }
      }

      // Meeting system templates
      for (const m of (meetingsRes.data ?? []) as { id: string; title: string; law_refs: unknown }[]) {
        for (const ref of asArray(m.law_refs)) {
          add(ref, { kind: 'meeting_template', id: m.id, title: m.title })
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
