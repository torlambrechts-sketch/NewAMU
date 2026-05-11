import { useMemo } from 'react'
import { useHse } from './useHse'
import { useInternalControl } from './useInternalControl'
import { useOrgHealth } from './useOrgHealth'
import { useRepresentatives } from './useRepresentatives'
import { useMeetings } from '../../modules/meetings'
export const WORKSPACE_AUDIT_SOURCES = [
  'all',
  'tasks',
  'internal_control',
  'hse',
  'org_health',
  'meetings',
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
  meetings: 'Møter',
  representatives: 'Representanter',
}

export function parseWorkspaceAuditSourceParam(raw: string | null): WorkspaceAuditSourceFilter {
  if (
    raw === 'tasks' ||
    raw === 'internal_control' ||
    raw === 'hse' ||
    raw === 'org_health' ||
    raw === 'meetings' ||
    raw === 'representatives'
  ) {
    return raw
  }
  return 'all'
}

export function useWorkspaceAuditFeed() {
  const ic = useInternalControl()
  const hse = useHse()
  const oh = useOrgHealth()
  const rep = useRepresentatives()
  const meetings = useMeetings()

  const rows = useMemo(() => {
    const out: WorkspaceAuditFeedRow[] = []



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

    // Møter — emit "opprettet" and "protokoll signert" events from the
    // loaded meetings list. Decisions / agenda-level audit events live
    // on the meeting_decisions / meeting_agenda_items child rows; a
    // cross-meeting decisions feed needs a supabase view (tracked as
    // future H-phase work). For the workspace audit feed, the two
    // meeting-level lifecycle events are the most actionable signal.
    for (const m of meetings.meetings ?? []) {
      out.push({
        id: `meeting-created-${m.id}`,
        at: m.created_at,
        source: 'meetings',
        sourceLabel: SOURCE_LABELS.meetings,
        action: 'opprettet',
        message: `Møte opprettet: ${m.title}`,
        detail: m.scheduled_at ? `Planlagt ${new Date(m.scheduled_at).toLocaleString('nb-NO')}` : undefined,
        linkTo: `/meetings/${m.id}`,
      })
      if (m.protocol_signed_at) {
        out.push({
          id: `meeting-signed-${m.id}`,
          at: m.protocol_signed_at,
          source: 'meetings',
          sourceLabel: SOURCE_LABELS.meetings,
          action: 'signert',
          message: `Protokoll signert: ${m.title}`,
          detail: m.protocol_signed_by ? `Av medlem ${m.protocol_signed_by.slice(0, 8)}` : undefined,
          linkTo: `/meetings/${m.id}`,
        })
      }
      if (m.status === 'cancelled') {
        out.push({
          id: `meeting-cancelled-${m.id}`,
          at: m.updated_at,
          source: 'meetings',
          sourceLabel: SOURCE_LABELS.meetings,
          action: 'avlyst',
          message: `Møte avlyst: ${m.title}`,
          linkTo: `/meetings/${m.id}`,
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
    ic.auditTrail,
    hse.auditTrail,
    oh.auditTrail,
    meetings.meetings,
    rep.auditTrail,
  ])

  const counts = useMemo(() => {
    const c: Record<Exclude<WorkspaceAuditSourceFilter, 'all'>, number> = {
      tasks: 0,
      internal_control: 0,
      hse: 0,
      org_health: 0,
      meetings: 0,
      representatives: 0,
    }
    for (const r of rows) {
      c[r.source] += 1
    }
    return c
  }, [rows])

  return { rows, counts, total: rows.length }
}
