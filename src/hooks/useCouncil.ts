// Legacy hook stub — `useCouncil` previously powered the deleted
// CouncilModule page with demo + per-org Council/AMU data. The new
// `modules/meetings` module supersedes everything Council/AMU related.
// This stub keeps callers (dashboards, audit feed, inspector exports)
// compiling and rendering empty states until each consumer is migrated
// to `useMeetings()`.
//
// TODO: migrate every remaining consumer to `useMeetings` and delete
// this file entirely. Tracked via the meetings module port plan.

import { useCallback, useMemo, useState } from 'react'
import type {
  AgendaItem,
  AuditEntryKind,
  BoardMember,
  ComplianceItem,
  CouncilMeeting,
  Election,
} from '../types/council'

type CouncilState = {
  board: BoardMember[]
  elections: Election[]
  meetings: CouncilMeeting[]
  compliance: ComplianceItem[]
}

const EMPTY: CouncilState = {
  board: [],
  elections: [],
  meetings: [],
  compliance: [],
}

const noop = () => {}
const asyncNoop = async () => {}

export type AddMeetingInput = {
  title?: string
  startsAt?: string
  endsAt?: string | null
  location?: string
  agenda?: AgendaItem[]
  invitees?: string[]
}

export function useCouncil() {
  const [state] = useState<CouncilState>(EMPTY)

  const allDecisions = useMemo(() => [] as Array<{ id: string; meetingId: string; text: string; status: string }>, [])

  const refreshCouncil = useCallback(asyncNoop, [])

  return {
    backend: 'local' as const,
    loading: false,
    error: null as string | null,
    refreshCouncil,
    board: state.board,
    elections: state.elections,
    meetings: state.meetings,
    compliance: state.compliance,
    allDecisions,
    addElection: noop as (..._args: unknown[]) => void,
    addCandidate: noop as (..._args: unknown[]) => void,
    vote: noop as (..._args: unknown[]) => void,
    closeElection: noop as (..._args: unknown[]) => void,
    addMeeting: noop as (..._args: unknown[]) => CouncilMeeting | null,
    updateMeeting: noop as (..._args: unknown[]) => void,
    setAgendaItems: noop as (..._args: unknown[]) => void,
    applySuggestedAgenda: noop as (..._args: unknown[]) => void,
    appendAuditEntry: noop as (_kind: AuditEntryKind, _msg: string) => void,
    sendInvitation: noop as (..._args: unknown[]) => void,
    setMeetingAttendance: noop as (..._args: unknown[]) => void,
    setPreparationNotes: noop as (..._args: unknown[]) => void,
    togglePrepChecklist: noop as (..._args: unknown[]) => void,
    addPrepChecklistItem: noop as (..._args: unknown[]) => void,
    toggleCompliance: noop as (..._args: unknown[]) => void,
    setComplianceNotes: noop as (..._args: unknown[]) => void,
    addComplianceItem: noop as (..._args: unknown[]) => void,
    resetToDemoData: asyncNoop,
    signMeetingProtocol: noop as (..._args: unknown[]) => void,
  }
}
