// useAmlHubData — composes the live data the AML hub page needs.
//
// Inputs:
//   • useRegelverkCoverage    (coverage per law_ref)
//   • useTaskItemsData        (org tasks, filtered to AML-tagged)
//
// Outputs:
//   • per-module status (green/amber/red) + open/overdue counts
//   • aggregate score (pct covered + module status totals)
//   • tasks list (sorted, AML-tagged, last 30-day window for "due soon")

import { useMemo } from 'react'
import {
  useRegelverkCoverage,
  type CoverageEntry,
} from '../../../../hooks/useRegelverkCoverage'
import { useTaskItemsData } from '../../../../../modules/tasks/useTaskItemsData'
import { AML_MODULES, type AmlModuleDef, type AmlModuleStatus } from './amlModuleCatalog'

function normalize(ref: string): string {
  return ref.replace(/\s+/g, ' ').replace(/§\s*/g, '§ ').trim()
}

export type AmlModuleLive = AmlModuleDef & {
  status: AmlModuleStatus
  progress: number
  artefactCount: number
  open: number
  overdue: number
}

export type AmlHubScore = {
  pct: number
  modulesGreen: number
  modulesAmber: number
  modulesRed: number
  tasksOpen: number
  tasksOverdue: number
  tasksDueSoon: number
}

export type AmlTaskRow = {
  id: string
  title: string
  module: string
  law: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  owner: string
  due: string | null
  overdue: boolean
  daysLate: number | null
}

const SEVERITY_BY_PRIORITY: Record<string, AmlTaskRow['severity']> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
}

// templateKind → module id mapping. useTaskItemsData doesn't surface
// law_refs (the DB has them but the hook strips them out), so we
// bucket by template kind which is good enough for the v1 hub. Tasks
// without a matching templateKind fall into the bucket named by their
// kind so the table never goes blank.
const KIND_TO_MODULE: Record<string, string> = {
  avvik: 'avvik',
  nestenulykke: 'avvik',
  tiltak: 'ros',
  risiko: 'ros',
  sykefravær: 'sykefravar',
  oppgave: 'opplaering',
  forslag: 'opplaering',
}

const KIND_LABEL: Record<string, string> = {
  avvik: 'Avvik',
  nestenulykke: 'Nestenulykke',
  tiltak: 'Tiltak',
  risiko: 'ROS-analyser',
  sykefravær: 'Sykefravær',
  oppgave: 'Oppgave',
  forslag: 'Forslag',
}

function diffDays(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

function formatDueDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' }).replace('.', '.')
}

export function useAmlHubData(): {
  modules: AmlModuleLive[]
  score: AmlHubScore
  tasks: AmlTaskRow[]
  loading: boolean
} {
  const { coverage, loading: coverageLoading } = useRegelverkCoverage()
  const tasksApi = useTaskItemsData()

  const tasks = useMemo<AmlTaskRow[]>(() => {
    const now = new Date()
    const rows: AmlTaskRow[] = []
    for (const t of tasksApi.items) {
      // Skip terminal-state tasks (CAPA lifecycle § 10.2).
      if (t.status === 'cancelled' || t.status === 'effectiveness_verified') continue
      const kindStr = t.templateKind ?? ''
      const moduleId = KIND_TO_MODULE[kindStr] ?? null
      const matched = moduleId ? AML_MODULES.find((m) => m.id === moduleId) ?? null : null
      const moduleLabel = matched?.title ?? KIND_LABEL[kindStr] ?? 'Generelt'
      const lawLabel = matched?.law ?? '—'
      const dueIso = t.dueDate ?? t.slaDueAt ?? null
      const dueDate = dueIso ? new Date(dueIso) : null
      const overdue = !!(dueDate && dueDate.getTime() < now.getTime())
      const daysLate = overdue && dueDate ? Math.max(1, diffDays(now, dueDate)) : null
      rows.push({
        id: t.id,
        title: t.title,
        module: moduleLabel,
        law: lawLabel,
        severity: SEVERITY_BY_PRIORITY[t.priority] ?? 'medium',
        owner: t.assigneeName ?? t.ownerName ?? matched?.owner ?? '—',
        due: formatDueDate(dueIso),
        overdue,
        daysLate,
      })
    }
    rows.sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
      const order = { critical: 0, high: 1, medium: 2, low: 3 }
      return order[a.severity] - order[b.severity]
    })
    return rows
  }, [tasksApi.items])

  const modules = useMemo<AmlModuleLive[]>(() => {
    return AML_MODULES.map((mod) => {
      const entriesByRef = new Map<string, CoverageEntry[]>()
      for (const ref of mod.lawRefs) {
        const norm = normalize(ref)
        if (entriesByRef.has(norm)) continue
        entriesByRef.set(norm, coverage.get(norm) ?? [])
      }
      const totalRefs = entriesByRef.size
      const refsWithCoverage = [...entriesByRef.values()].filter(
        (entries) => entries.length > 0,
      ).length
      const totalArtefacts = [...entriesByRef.values()].reduce(
        (sum, entries) => sum + dedupCount(entries),
        0,
      )
      const open = tasks.filter((t) => t.module === mod.title).length
      const overdue = tasks.filter((t) => t.module === mod.title && t.overdue).length
      let status: AmlModuleStatus = 'red'
      if (totalRefs > 0 && refsWithCoverage === totalRefs && overdue === 0) status = 'green'
      else if (refsWithCoverage > 0) status = 'amber'
      const progress = totalRefs === 0 ? 0 : Math.round((refsWithCoverage / totalRefs) * 100)
      const metricValue = totalArtefacts > 0 ? `${totalArtefacts}` : mod.metric.valueFallback
      return {
        ...mod,
        status,
        progress,
        artefactCount: totalArtefacts,
        open,
        overdue,
        metric: { ...mod.metric, valueFallback: metricValue },
      }
    })
  }, [coverage, tasks])

  const score = useMemo<AmlHubScore>(() => {
    const allRefs = new Set<string>()
    for (const m of AML_MODULES) for (const r of m.lawRefs) allRefs.add(normalize(r))
    let covered = 0
    for (const r of allRefs) if ((coverage.get(r)?.length ?? 0) > 0) covered += 1
    const pct = allRefs.size === 0 ? 0 : Math.round((covered / allRefs.size) * 100)
    const modulesGreen = modules.filter((m) => m.status === 'green').length
    const modulesAmber = modules.filter((m) => m.status === 'amber').length
    const modulesRed = modules.filter((m) => m.status === 'red').length

    const tasksOpen = tasks.length
    const tasksOverdue = tasks.filter((t) => t.overdue).length
    // due-soon = within 14 days. We don't have raw ISO on the row;
    // recompute from tasksApi.items for accuracy.
    const inTwoWeeks = new Date()
    inTwoWeeks.setDate(inTwoWeeks.getDate() + 14)
    const now = new Date()
    const tasksDueSoon = tasksApi.items.filter((t) => {
      if (t.status === 'cancelled' || t.status === 'effectiveness_verified') return false
      const iso = t.dueDate ?? t.slaDueAt ?? null
      if (!iso) return false
      const d = new Date(iso)
      return d.getTime() >= now.getTime() && d.getTime() <= inTwoWeeks.getTime()
    }).length

    return { pct, modulesGreen, modulesAmber, modulesRed, tasksOpen, tasksOverdue, tasksDueSoon }
  }, [coverage, modules, tasks, tasksApi.items])

  return {
    modules,
    score,
    tasks,
    loading: coverageLoading,
  }
}

// Dedup coverage entries by `${kind}:${id}` — same pattern as
// useInternkontrollDatasets so the artefact count for a single template
// with multiple law-ref-tagged items doesn't get inflated.
function dedupCount(entries: CoverageEntry[]): number {
  const seen = new Set<string>()
  for (const e of entries) seen.add(`${e.kind}:${e.id}`)
  return seen.size
}
