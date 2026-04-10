import { useMemo } from 'react'
import { useCouncil } from './useCouncil'
import { useHse } from './useHse'
import { useInternalControl } from './useInternalControl'
import { useOrgHealth } from './useOrgHealth'
import { useRepresentatives } from './useRepresentatives'
import { useTasks } from './useTasks'

export const WORKSPACE_AUDIT_SOURCES = [
  'all',
  'tasks',
  'internal_control',
  'hse',
  'org_health',
  'council',
  'representatives',
] as const

export type WorkspaceAuditSourceFilter = (typeof WORKSPACE_AUDIT_SOURCES)[number]

export type WorkspaceAuditFeedRow = {
  id: string
  at: string
  source: Exclude<WorkspaceAuditSourceFilter, 'all'>
  sourceLabel: string
  action: string
  message: string
  detail?: string
  linkTo: string
}

const SOURCE_LABELS: Record<Exclude<WorkspaceAuditSourceFilter, 'all'>, string> = {
  tasks: 'Oppgaver',
  internal_control: 'Internkontroll',
  hse: 'HSE / HMS',
  org_health: 'Organisasjonshelse',
  council: 'Arbeidsmiljøråd',
  representatives: 'Representanter',
}

function formatMeetingAuditKind(kind: string) {
  if (kind === 'decision') return 'Vedtak'
  if (kind === 'discussion') return 'Diskusjon'
  return 'Notat'
}

export function parseWorkspaceAuditSourceParam(raw: string | null): WorkspaceAuditSourceFilter {
  if (
    raw === 'tasks' ||
    raw === 'internal_control' ||
    raw === 'hse' ||
    raw === 'org_health' ||
    raw === 'council' ||
    raw === 'representatives'
  ) {
    return raw
  }
  return 'all'
}

export function useWorkspaceAuditFeed() {
  const ts = useTasks()
  const ic = useInternalControl()
  const hse = useHse()
  const oh = useOrgHealth()
  const council = useCouncil()
  const rep = useRepresentatives()

  const rows = useMemo(() => {
    const out: WorkspaceAuditFeedRow[] = []

    for (const a of ts.auditLog) {
      out.push({
        id: `tasks-${a.id}`,
        at: a.at,
        source: 'tasks',
        sourceLabel: SOURCE_LABELS.tasks,
        action: a.action,
        message: a.message,
        detail: a.taskId ? `Oppgave-ID: ${a.taskId}` : undefined,
        linkTo: '/tasks?view=list',
      })
    }

    for (const a of ic.auditTrail) {
      out.push({
        id: `ic-${a.id}`,
        at: a.at,
        source: 'internal_control',
        sourceLabel: SOURCE_LABELS.internal_control,
        action: a.action,
        message: a.message,
        detail: a.meta && Object.keys(a.meta).length ? JSON.stringify(a.meta) : undefined,
        linkTo: '/internal-control?tab=overview',
      })
    }

    for (const a of hse.auditTrail) {
      out.push({
        id: `hse-${a.id}`,
        at: a.at,
        source: 'hse',
        sourceLabel: SOURCE_LABELS.hse,
        action: a.action,
        message: a.summary,
        detail: `${a.entityType}${a.performedBy ? ` · ${a.performedBy}` : ''}`,
        linkTo: '/hse?tab=overview',
      })
    }

    for (const a of oh.auditTrail) {
      out.push({
        id: `oh-${a.id}`,
        at: a.at,
        source: 'org_health',
        sourceLabel: SOURCE_LABELS.org_health,
        action: a.action,
        message: a.message,
        detail: a.meta && Object.keys(a.meta).length ? JSON.stringify(a.meta) : undefined,
        linkTo: '/org-health?tab=overview',
      })
    }

    for (const m of council.meetings) {
      for (const e of m.auditTrail) {
        out.push({
          id: `council-${m.id}-${e.id}`,
          at: e.at,
          source: 'council',
          sourceLabel: SOURCE_LABELS.council,
          action: e.kind,
          message: e.text,
          detail: `${m.title}${e.author ? ` · ${e.author}` : ''} · ${formatMeetingAuditKind(e.kind)}`,
          linkTo: `/council?tab=meetings`,
        })
      }
    }

    for (const a of rep.auditTrail) {
      out.push({
        id: `rep-${a.id}`,
        at: a.at,
        source: 'representatives',
        sourceLabel: SOURCE_LABELS.representatives,
        action: a.action,
        message: a.message,
        detail: a.meta && Object.keys(a.meta).length ? JSON.stringify(a.meta) : undefined,
        linkTo: '/members?tab=overview',
      })
    }

    out.sort((a, b) => b.at.localeCompare(a.at))
    return out
  }, [
    ts.auditLog,
    ic.auditTrail,
    hse.auditTrail,
    oh.auditTrail,
    council.meetings,
    rep.auditTrail,
  ])

  const counts = useMemo(() => {
    const c: Record<Exclude<WorkspaceAuditSourceFilter, 'all'>, number> = {
      tasks: 0,
      internal_control: 0,
      hse: 0,
      org_health: 0,
      council: 0,
      representatives: 0,
    }
    for (const r of rows) {
      c[r.source] += 1
    }
    return c
  }, [rows])

  return { rows, counts, total: rows.length }
}
