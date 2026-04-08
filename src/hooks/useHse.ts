import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CHECKLIST_TEMPLATES,
  DEFAULT_SAFETY_ROUND_CHECKLIST,
  SAFETY_ROUND_TEMPLATE_ID,
} from '../data/hseTemplates'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import {
  clearOrgModuleSnap,
  fetchOrgModulePayload,
  readOrgModuleSnap,
  upsertOrgModulePayload,
  writeOrgModuleSnap,
} from '../lib/orgModulePayload'
import { useOrgSetupContext } from './useOrgSetupContext'
import { fetchClientIpBestEffort, hashDocumentPayload } from '../lib/level1Signature'
import { insertSystemSignatureEvent } from '../lib/recordSystemSignature'
import type {
  ChecklistItemDetail,
  ChecklistItemStatus,
  ChecklistTemplate,
  CorrectiveAction,
  HseChecklistItem,
  HseAuditAction,
  HseAuditEntry,
  HseProtocolSignature,
  Incident,
  Inspection,
  InspectionAttachment,
  InspectionFinding,
  SafetyRound,
  SafetyRoundSignature,
  SafetyRoundSignatureRole,
  SjaAnalysis,
  SjaHazardRow,
  SjaSignature,
  SickLeaveCase,
  SickLeaveMilestone,
  SickLeaveMilestoneKind,
  SickLeaveMessage,
  TrainingRecord,
} from '../types/hse'
import type { Task as KanbanTask } from '../types/task'

type KanbanTaskSeed = Omit<KanbanTask, 'id' | 'createdAt'> & Partial<Pick<KanbanTask, 'id' | 'createdAt'>>

const STORAGE_KEY = 'atics-hse-v2'
const MODULE_KEY = 'hse' as const
const PERSIST_DEBOUNCE_MS = 450

function recomputeSjaStatus(merged: SjaAnalysis): SjaAnalysis['status'] {
  if (merged.status === 'closed') return 'closed'
  const parts = merged.participantEmployeeIds ?? []
  const rows = merged.rows ?? []
  if (parts.length === 0) {
    if (merged.status === 'approved') return 'approved'
    return 'draft'
  }
  if (rows.length === 0) return 'draft'
  const allWorkers = parts.every((pid) =>
    merged.signatures.some((s) => s.signerEmployeeId === pid && s.role === 'worker'),
  )
  const leaderOk =
    !merged.workLeaderEmployeeId ||
    merged.signatures.some(
      (s) => s.signerEmployeeId === merged.workLeaderEmployeeId && s.role === 'foreman',
    )
  if (allWorkers && leaderOk) return 'approved'
  return 'awaiting_participants'
}

type HseState = {
  safetyRounds: SafetyRound[]
  inspections: Inspection[]
  incidents: Incident[]
  sjaAnalyses: SjaAnalysis[]
  trainingRecords: TrainingRecord[]
  checklistTemplates: ChecklistTemplate[]
  sickLeaveCases: SickLeaveCase[]
  auditTrail: HseAuditEntry[]
}

function auditEntry(
  action: HseAuditAction,
  entityType: HseAuditEntry['entityType'],
  entityId: string,
  summary: string,
  detail?: Record<string, string | number | boolean | null>,
  performedBy?: string,
): HseAuditEntry {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    action,
    entityType,
    entityId,
    summary,
    detail,
    performedBy,
  }
}

function emptyChecklistForItems(items: HseChecklistItem[]): Record<string, ChecklistItemStatus> {
  const m: Record<string, ChecklistItemStatus> = {}
  for (const it of items) {
    m[it.id] = 'na'
  }
  return m
}

const emptyChecklist = (): Record<string, ChecklistItemStatus> =>
  emptyChecklistForItems(DEFAULT_SAFETY_ROUND_CHECKLIST)

const MILESTONE_DEFS: { kind: SickLeaveMilestoneKind; label: string; lawRef: string; daysOffset: number }[] = [
  { kind: 'contact_day_4', label: 'Kontakt med ansatt (dag 4)', lawRef: 'AML §4-6 nr. 1, NAV-krav', daysOffset: 4 },
  { kind: 'followup_plan_4wk', label: 'Oppfølgingsplan utarbeidet (4 uker)', lawRef: 'AML §4-6 nr. 1 — frist 4 uker', daysOffset: 28 },
  { kind: 'dialog_meeting_7wk', label: 'Dialogmøte 1 avholdt (7 uker)', lawRef: 'AML §4-6 nr. 2 — frist 7 uker', daysOffset: 49 },
  { kind: 'nav_report_9wk', label: 'Meldt til NAV (9 uker)', lawRef: 'Sykmeldingsforskriften §8, 9-ukersmelding', daysOffset: 63 },
  { kind: 'dialog_meeting_26wk', label: 'Dialogmøte 2 (26 uker)', lawRef: 'AML §4-6 nr. 3 — frist 26 uker', daysOffset: 182 },
  { kind: 'activity_plan_1yr', label: 'Aktivitetsplan vurdert (12 måneder)', lawRef: 'AML §4-6 — langtidssykmelding', daysOffset: 365 },
]

function buildMilestones(sickFrom: string): SickLeaveMilestone[] {
  const base = new Date(sickFrom)
  return MILESTONE_DEFS.map((def) => {
    const due = new Date(base)
    due.setDate(due.getDate() + def.daysOffset)
    return {
      kind: def.kind,
      label: def.label,
      lawRef: def.lawRef,
      dueAt: due.toISOString().slice(0, 10),
    }
  })
}

function normalizeParsed(p: HseState): HseState {
  return {
    safetyRounds: Array.isArray(p.safetyRounds)
      ? p.safetyRounds.map((sr) => {
          const r = sr as SafetyRound
          let status = r.status ?? 'in_progress'
          if (status === 'pending_approval') status = 'pending_verneombud'
          const sigs = r.signatures ?? []
          const issueSynced = r.issueTasksSynced ?? false
          return {
            ...r,
            itemDetails: r.itemDetails ?? {},
            status,
            signatures: sigs,
            checklistTemplateId: r.checklistTemplateId ?? SAFETY_ROUND_TEMPLATE_ID,
            issueTasksSynced: issueSynced,
          }
        })
      : [],
    inspections: Array.isArray(p.inspections)
      ? p.inspections.map((raw) => {
          const ins = raw as Inspection
          return {
            ...ins,
            concreteFindings: Array.isArray(ins.concreteFindings) ? ins.concreteFindings : [],
            attachments: Array.isArray(ins.attachments) ? ins.attachments : [],
            protocolSignatures: ins.protocolSignatures ?? [],
            locked: ins.locked ?? false,
            findingTasksSynced: ins.findingTasksSynced ?? false,
          }
        })
      : [],
    incidents: Array.isArray(p.incidents)
      ? p.incidents.map((raw) => {
          const inc = raw as Incident
          return {
            ...inc,
            evidencePhotos: Array.isArray(inc.evidencePhotos) ? inc.evidencePhotos : [],
          }
        })
      : [],
    sjaAnalyses: Array.isArray(p.sjaAnalyses)
      ? p.sjaAnalyses.map((raw) => {
          const s = raw as SjaAnalysis
          const rows = (s.rows ?? []).map((r) => ({
            ...r,
            responsibleEmployeeId: r.responsibleEmployeeId,
          }))
          const base: SjaAnalysis = {
            ...s,
            rows,
            participantEmployeeIds: Array.isArray(s.participantEmployeeIds) ? s.participantEmployeeIds : [],
            status: (s.status as SjaAnalysis['status']) ?? 'draft',
            involvesHotWork: s.involvesHotWork ?? false,
            requiresLoto: s.requiresLoto ?? false,
          }
          return { ...base, status: base.status === 'closed' ? 'closed' : recomputeSjaStatus(base) }
        })
      : [],
    trainingRecords: Array.isArray(p.trainingRecords) ? p.trainingRecords : [],
    checklistTemplates:
      Array.isArray(p.checklistTemplates) && p.checklistTemplates.length ? p.checklistTemplates : CHECKLIST_TEMPLATES,
    sickLeaveCases: Array.isArray(p.sickLeaveCases) ? p.sickLeaveCases : [],
    auditTrail: Array.isArray(p.auditTrail) ? p.auditTrail : [],
  }
}

function seedDemoHse(): HseState {
  const sr: SafetyRound = {
    id: 'demo-sr1',
    title: 'Vernerunde — Produksjon (demo)',
    conductedAt: new Date().toISOString().slice(0, 16),
    location: 'Produksjon, hall A',
    conductedBy: 'Verneombud (demo)',
    items: emptyChecklist(),
    itemDetails: {},
    notes: 'Eksempelrunde. Erstatt med faktiske observasjoner.',
    status: 'in_progress',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const demoSickFrom = new Date()
  demoSickFrom.setDate(demoSickFrom.getDate() - 30)
  const demoSickFromStr = demoSickFrom.toISOString().slice(0, 10)
  const demoCase: SickLeaveCase = {
    id: 'demo-sl1',
    employeeName: 'Demo Ansatt',
    department: 'Avdeling A',
    managerName: 'Demo Leder',
    sickFrom: demoSickFromStr,
    status: 'active',
    sicknessDegree: 100,
    accommodationNotes: '',
    portalMessages: [],
    milestones: buildMilestones(demoSickFromStr),
    consentRecorded: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const initialAudit: HseAuditEntry[] = [
    auditEntry('module_init', 'system', 'hse', 'HSE-modul initialisert.', { templateVersion: SAFETY_ROUND_TEMPLATE_ID }),
    auditEntry('safety_round_created', 'safety_round', sr.id, `Vernerunde opprettet: «${sr.title}»`),
    auditEntry('sick_leave_created', 'sick_leave', demoCase.id, `Sykefraværssak opprettet: ${demoCase.employeeName}`),
  ]
  return {
    safetyRounds: [sr],
    inspections: [],
    incidents: [],
    sjaAnalyses: [],
    trainingRecords: [],
    checklistTemplates: CHECKLIST_TEMPLATES,
    sickLeaveCases: [demoCase],
    auditTrail: initialAudit,
  }
}

function emptyRemoteState(): HseState {
  return {
    safetyRounds: [],
    inspections: [],
    incidents: [],
    sjaAnalyses: [],
    trainingRecords: [],
    checklistTemplates: CHECKLIST_TEMPLATES,
    sickLeaveCases: [],
    auditTrail: [],
  }
}

function loadLocal(): HseState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedDemoHse()
    const p = JSON.parse(raw) as HseState
    return normalizeParsed(p)
  } catch {
    return {
      safetyRounds: [],
      inspections: [],
      incidents: [],
      sjaAnalyses: [],
      trainingRecords: [],
      checklistTemplates: CHECKLIST_TEMPLATES,
      sickLeaveCases: [],
      auditTrail: [],
    }
  }
}

function saveLocal(state: HseState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function useHse() {
  const { supabase, organization, user, profile } = useOrgSetupContext()
  const orgId = organization?.id
  const userId = user?.id
  const useRemote = !!(supabase && orgId && userId)

  const initialRemote =
    useRemote && orgId && userId ? readOrgModuleSnap<HseState>(MODULE_KEY, orgId, userId) : null
  const [localState, setLocalState] = useState<HseState>(() => loadLocal())
  const [remoteState, setRemoteState] = useState<HseState>(() => initialRemote ?? emptyRemoteState())
  const [loading, setLoading] = useState(useRemote)
  const [error, setError] = useState<string | null>(null)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const state = useRemote ? remoteState : localState
  const setState = useRemote ? setRemoteState : setLocalState

  const refreshHse = useCallback(async () => {
    if (!supabase || !orgId || !userId) return
    setLoading(true)
    setError(null)
    try {
      const payload = await fetchOrgModulePayload<HseState>(supabase, orgId, MODULE_KEY)
      const next = payload ? normalizeParsed(payload) : emptyRemoteState()
      setRemoteState(next)
      writeOrgModuleSnap(MODULE_KEY, orgId, userId, next)
    } catch (e) {
      setError(getSupabaseErrorMessage(e))
      clearOrgModuleSnap(MODULE_KEY, orgId, userId)
      setRemoteState(emptyRemoteState())
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId, userId])

  useEffect(() => {
    if (!useRemote) {
      setLoading(false)
      return
    }
    void refreshHse()
  }, [useRemote, refreshHse])

  useEffect(() => {
    if (!useRemote) {
      saveLocal(localState)
    }
  }, [useRemote, localState])

  useEffect(() => {
    if (!useRemote || !supabase || !orgId) return
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      void (async () => {
        try {
          await upsertOrgModulePayload(supabase, orgId, MODULE_KEY, remoteState)
          if (userId) writeOrgModuleSnap(MODULE_KEY, orgId, userId, remoteState)
        } catch (e) {
          setError(getSupabaseErrorMessage(e))
        }
      })()
    }, PERSIST_DEBOUNCE_MS)
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current)
    }
  }, [useRemote, supabase, orgId, userId, remoteState])

  const checklistTemplatesRef = useRef(state.checklistTemplates)
  checklistTemplatesRef.current = state.checklistTemplates

  const createSafetyRound = useCallback(
    (partial: Omit<SafetyRound, 'id' | 'createdAt' | 'updatedAt' | 'items' | 'itemDetails' | 'status' | 'signatures' | 'issueTasksSynced'> & { checklistTemplateId?: string }) => {
      const now = new Date().toISOString()
      const tid = partial.checklistTemplateId ?? SAFETY_ROUND_TEMPLATE_ID
      const tpl = checklistTemplatesRef.current.find((t) => t.id === tid)
      const items = tpl?.items ?? DEFAULT_SAFETY_ROUND_CHECKLIST
      const sr: SafetyRound = {
        ...partial,
        checklistTemplateId: tid,
        conductedBy: partial.conductedBy?.trim() ? partial.conductedBy.trim() : '—',
        id: crypto.randomUUID(),
        items: emptyChecklistForItems(items),
        itemDetails: {},
        status: 'in_progress',
        signatures: [],
        issueTasksSynced: false,
        createdAt: now,
        updatedAt: now,
      }
      const entry = auditEntry('safety_round_created', 'safety_round', sr.id, `Vernerunde opprettet: «${sr.title}»`, {
        location: sr.location,
        conductedBy: sr.conductedBy,
        conductedAt: sr.conductedAt,
        templateId: tid,
      })
      setState((s) => ({ ...s, safetyRounds: [sr, ...s.safetyRounds], auditTrail: [...s.auditTrail, entry] }))
      return sr
    },
    [setState],
  )

  const updateSafetyRound = useCallback(
    (id: string, patch: Partial<SafetyRound>) => {
      setState((s) => {
        const prev = s.safetyRounds.find((x) => x.id === id)
        if (!prev) return s
        const merged = { ...prev, ...patch, updatedAt: new Date().toISOString() }
        const entry = auditEntry('safety_round_updated', 'safety_round', id, `Vernerunde oppdatert: «${merged.title}»`, {
          notesLen: merged.notes.length,
          itemsChecked: Object.values(merged.items).filter((v) => v !== 'na').length,
        })
        return {
          ...s,
          safetyRounds: s.safetyRounds.map((x) => (x.id === id ? merged : x)),
          auditTrail: [...s.auditTrail, entry],
        }
      })
    },
    [setState],
  )

  const setChecklistStatus = useCallback(
    (roundId: string, itemId: string, status: ChecklistItemStatus) => {
      setState((s) => {
        const sr = s.safetyRounds.find((x) => x.id === roundId)
        if (!sr) return s
        const items = { ...sr.items, [itemId]: status }
        const itemDetails =
          status !== 'issue'
            ? Object.fromEntries(Object.entries(sr.itemDetails ?? {}).filter(([k]) => k !== itemId))
            : (sr.itemDetails ?? {})
        const entry = auditEntry('safety_round_updated', 'safety_round', roundId, 'Sjekklistepunkt oppdatert', {
          itemId,
          status,
          previousStatus: sr.items[itemId] ?? 'na',
        })
        return {
          ...s,
          safetyRounds: s.safetyRounds.map((x) =>
            x.id === roundId ? { ...x, items, itemDetails, updatedAt: new Date().toISOString() } : x,
          ),
          auditTrail: [...s.auditTrail, entry],
        }
      })
    },
    [setState],
  )

  const setChecklistItemDetail = useCallback(
    (roundId: string, itemId: string, detail: Partial<ChecklistItemDetail>) => {
      setState((s) => {
        const sr = s.safetyRounds.find((x) => x.id === roundId)
        if (!sr) return s
        const existing = (sr.itemDetails ?? {})[itemId] ?? { description: '', assignee: '', dueDate: '' }
        const itemDetails = { ...(sr.itemDetails ?? {}), [itemId]: { ...existing, ...detail } }
        return {
          ...s,
          safetyRounds: s.safetyRounds.map((x) =>
            x.id === roundId ? { ...x, itemDetails, updatedAt: new Date().toISOString() } : x,
          ),
        }
      })
    },
    [setState],
  )

  const submitRoundForApproval = useCallback(
    (roundId: string) => {
      setState((s) => {
        const now = new Date().toISOString()
        const entry = auditEntry(
          'safety_round_updated',
          'safety_round',
          roundId,
          'Vernerunde sendt til signering (leder + verneombud)',
        )
        return {
          ...s,
          safetyRounds: s.safetyRounds.map((x) =>
            x.id === roundId
              ? { ...x, status: 'pending_verneombud' as const, submittedForApprovalAt: now, updatedAt: now }
              : x,
          ),
          auditTrail: [...s.auditTrail, entry],
        }
      })
    },
    [setState],
  )

  const safetyRoundDocumentPayload = useCallback((round: SafetyRound) => {
    const tpl = checklistTemplatesRef.current.find((t) => t.id === (round.checklistTemplateId ?? SAFETY_ROUND_TEMPLATE_ID))
    const checklistIds = (tpl?.items ?? DEFAULT_SAFETY_ROUND_CHECKLIST).map((i) => i.id)
    const itemsOrdered = Object.fromEntries(checklistIds.map((id) => [id, round.items[id] ?? 'na']))
    const detailsOrdered: Record<string, ChecklistItemDetail> = {}
    for (const id of checklistIds) {
      const d = round.itemDetails?.[id]
      if (d) detailsOrdered[id] = d
    }
    return {
      docKind: 'hse_safety_round' as const,
      roundId: round.id,
      title: round.title,
      conductedAt: round.conductedAt,
      location: round.location,
      department: round.department ?? '',
      conductedBy: round.conductedBy,
      checklistTemplateId: round.checklistTemplateId ?? SAFETY_ROUND_TEMPLATE_ID,
      items: itemsOrdered,
      itemDetails: detailsOrdered,
      notes: round.notes,
      status: round.status,
      submittedForApprovalAt: round.submittedForApprovalAt ?? null,
      signatures: (round.signatures ?? []).map((s) => ({
        role: s.role,
        signerName: s.signerName,
        signerUserId: s.signerUserId ?? null,
        signedAt: s.signedAt,
      })),
    }
  }, [])

  const signSafetyRound = useCallback(
    async (
      roundId: string,
      role: SafetyRoundSignatureRole,
    ): Promise<{ ok: true; seeds: KanbanTaskSeed[] } | { ok: false }> => {
      setError(null)
      const round = state.safetyRounds.find((x) => x.id === roundId)
      if (!round || round.status === 'approved') return { ok: false }
      if ((round.signatures ?? []).some((s) => s.role === role)) return { ok: false }
      if (userId) {
        const other = (round.signatures ?? []).find((s) => s.role !== role && s.signerUserId === userId)
        if (other) {
          setError('Samme innloggede bruker kan ikke signere både som leder og verneombud (AML § 3-1 medvirkning).')
          return { ok: false }
        }
      }

      const issueTpl = checklistTemplatesRef.current.find((t) => t.id === (round.checklistTemplateId ?? SAFETY_ROUND_TEMPLATE_ID))
      const checklistItems = issueTpl?.items ?? DEFAULT_SAFETY_ROUND_CHECKLIST
      const issueRows = checklistItems.filter((item) => round.items[item.id] === 'issue')
      if (issueRows.some((item) => !(round.itemDetails?.[item.id]?.description ?? '').trim())) {
        setError('Fyll inn beskrivelse for alle punkter med avvik før signering.')
        return { ok: false }
      }

      const displayName =
        profile?.display_name?.trim() || user?.email?.trim() || 'Bruker'
      const signedAt = new Date().toISOString()
      const sigPreview: SafetyRoundSignature = {
        role,
        signerName: displayName,
        signerUserId: user?.id,
        signedAt,
      }
      const signaturesNext = [...(round.signatures ?? []), sigPreview]
      const hasMgmt = signaturesNext.some((s) => s.role === 'management')
      const hasVo = signaturesNext.some((s) => s.role === 'safety_rep')
      const bothSigned = hasMgmt && hasVo

      const roundAfter: SafetyRound = {
        ...round,
        signatures: signaturesNext,
        status: bothSigned ? 'approved' : round.status,
        updatedAt: signedAt,
      }
      const hashPayload = {
        ...safetyRoundDocumentPayload(roundAfter),
        status: bothSigned ? ('approved' as const) : roundAfter.status,
        signatures: signaturesNext.map((s) => ({
          role: s.role,
          signerName: s.signerName,
          signerUserId: s.signerUserId ?? null,
          signedAt: s.signedAt,
        })),
      }
      const documentHashSha256 = await hashDocumentPayload(hashPayload)
      let level1: SafetyRoundSignature['level1'] | undefined
      if (useRemote && supabase && orgId && userId) {
        const clientIp = await fetchClientIpBestEffort()
        const row = await insertSystemSignatureEvent(supabase, orgId, userId, {
          resourceType: 'hse_safety_round',
          resourceId: roundId,
          action: role === 'management' ? 'hse_safety_round_sign_management' : 'hse_safety_round_sign_safety_rep',
          documentHashSha256,
          signerDisplayName: displayName,
          role,
          clientIp,
        })
        if ('error' in row) {
          setError(row.error)
          return { ok: false }
        }
        level1 = row.evidence
      }
      const sigWithMeta: SafetyRoundSignature = { ...sigPreview, level1 }

      let seeds: KanbanTaskSeed[] = []
      if (bothSigned && !round.issueTasksSynced) {
        seeds = issueRows.map((item) => {
          const det = round.itemDetails?.[item.id]
          const assignee = det?.assignee?.trim() || 'Verneombud / HMS'
          const due = det?.dueDate?.trim() || '—'
          return {
            title: `Vernerunde-avvik: ${item.label.slice(0, 72)}${item.label.length > 72 ? '…' : ''}`,
            description: [
              `Runde: ${round.title}`,
              `Lokasjon: ${round.location}`,
              det?.description ?? '',
              det?.photoUrl ? `Bilde: ${det.photoUrl}` : '',
              round.notes ? `Notater: ${round.notes}` : '',
            ]
              .filter(Boolean)
              .join('\n\n'),
            status: 'todo' as const,
            assignee,
            ownerRole: 'Vernerunde / avvik',
            dueDate: due,
            module: 'hse' as const,
            sourceType: 'hse_safety_round' as const,
            sourceId: round.id,
            sourceLabel: `${round.title} — ${item.label}`,
            requiresManagementSignOff: false,
          }
        })
      }

      setState((s) => {
        const cur = s.safetyRounds.find((x) => x.id === roundId)
        if (!cur || cur.status === 'approved') return s
        if ((cur.signatures ?? []).some((x) => x.role === role)) return s
        const sigs = [...(cur.signatures ?? []), sigWithMeta]
        const mgmt = sigs.some((x) => x.role === 'management')
        const vo = sigs.some((x) => x.role === 'safety_rep')
        const locked = mgmt && vo
        const entry = auditEntry(
          'safety_round_updated',
          'safety_round',
          roundId,
          locked
            ? `Vernerunde låst (nivå 1): leder + verneombud signert — ${seeds.length} oppgave(r) til Kanban`
            : `Vernerunde signert (${role === 'management' ? 'leder' : 'verneombud'}): ${displayName}`,
          { role, locked, taskCount: seeds.length },
        )
        return {
          ...s,
          safetyRounds: s.safetyRounds.map((x) =>
            x.id === roundId
              ? {
                  ...x,
                  signatures: sigs,
                  status: locked ? ('approved' as const) : x.status,
                  issueTasksSynced: locked ? true : x.issueTasksSynced,
                  updatedAt: signedAt,
                }
              : x,
          ),
          auditTrail: [...s.auditTrail, entry],
        }
      })

      return bothSigned ? { ok: true, seeds } : { ok: true, seeds: [] }
    },
    [
      state.safetyRounds,
      setState,
      setError,
      useRemote,
      supabase,
      orgId,
      userId,
      user,
      profile,
      safetyRoundDocumentPayload,
    ],
  )

  const createInspection = useCallback(
    (partial: Omit<Inspection, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
      const now = new Date().toISOString()
      const ins: Inspection = {
        ...partial,
        concreteFindings: partial.concreteFindings ?? [],
        attachments: partial.attachments ?? [],
        protocolSignatures: partial.protocolSignatures ?? [],
        locked: partial.locked ?? false,
        findingTasksSynced: partial.findingTasksSynced ?? false,
        id: partial.id ?? crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      }
      const entry = auditEntry('inspection_created', 'inspection', ins.id, `Inspeksjon registrert: «${ins.title}» (${ins.kind})`, {
        scope: ins.scope.slice(0, 200),
        status: ins.status,
      })
      setState((s) => ({ ...s, inspections: [ins, ...s.inspections], auditTrail: [...s.auditTrail, entry] }))
      return ins
    },
    [setState],
  )

  const updateInspection = useCallback(
    (id: string, patch: Partial<Inspection>) => {
      setState((s) => {
        const cur = s.inspections.find((x) => x.id === id)
        if (!cur || cur.locked) return s
        const entry = auditEntry('inspection_updated', 'inspection', id, 'Inspeksjon oppdatert', { status: patch.status ?? null })
        return {
          ...s,
          inspections: s.inspections.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x)),
          auditTrail: [...s.auditTrail, entry],
        }
      })
    },
    [setState],
  )

  const addInspectionFinding = useCallback(
    (inspectionId: string, description: string) => {
      const desc = description.trim()
      if (!desc) return null
      const fid = crypto.randomUUID()
      const now = new Date().toISOString()
      const row: InspectionFinding = { id: fid, description: desc, status: 'open', createdAt: now }
      setState((s) => ({
        ...s,
        inspections: s.inspections.map((x) =>
          x.id === inspectionId && !x.locked
            ? { ...x, concreteFindings: [...(x.concreteFindings ?? []), row], updatedAt: now }
            : x,
        ),
      }))
      return fid
    },
    [setState],
  )

  const updateInspectionFinding = useCallback(
    (inspectionId: string, findingId: string, patch: Partial<Pick<InspectionFinding, 'description' | 'status' | 'photoPath' | 'photoUrl'>>) => {
      setState((s) => ({
        ...s,
        inspections: s.inspections.map((x) => {
          if (x.id !== inspectionId || x.locked) return x
          return {
            ...x,
            concreteFindings: (x.concreteFindings ?? []).map((f) =>
              f.id === findingId ? { ...f, ...patch, resolvedAt: patch.status === 'resolved' ? new Date().toISOString() : f.resolvedAt } : f,
            ),
            updatedAt: new Date().toISOString(),
          }
        }),
      }))
    },
    [setState],
  )

  const removeInspectionFinding = useCallback(
    (inspectionId: string, findingId: string) => {
      setState((s) => ({
        ...s,
        inspections: s.inspections.map((x) =>
          x.id === inspectionId && !x.locked
            ? {
                ...x,
                concreteFindings: (x.concreteFindings ?? []).filter((f) => f.id !== findingId),
                updatedAt: new Date().toISOString(),
              }
            : x,
        ),
      }))
    },
    [setState],
  )

  const addInspectionAttachment = useCallback(
    (inspectionId: string, att: Omit<InspectionAttachment, 'id' | 'uploadedAt'>) => {
      const now = new Date().toISOString()
      const row = { ...att, id: crypto.randomUUID(), uploadedAt: now }
      setState((s) => ({
        ...s,
        inspections: s.inspections.map((x) =>
          x.id === inspectionId && !x.locked
            ? { ...x, attachments: [...(x.attachments ?? []), row], updatedAt: now }
            : x,
        ),
      }))
      return row.id
    },
    [setState],
  )

  const removeInspectionAttachment = useCallback(
    (inspectionId: string, attachmentId: string) => {
      setState((s) => ({
        ...s,
        inspections: s.inspections.map((x) =>
          x.id === inspectionId && !x.locked
            ? {
                ...x,
                attachments: (x.attachments ?? []).filter((a) => a.id !== attachmentId),
                updatedAt: new Date().toISOString(),
              }
            : x,
        ),
      }))
    },
    [setState],
  )

  const linkInspectionFindingTasks = useCallback(
    (inspectionId: string, links: { findingId: string; taskId: string }[]) => {
      setState((s) => ({
        ...s,
        inspections: s.inspections.map((x) => {
          if (x.id !== inspectionId) return x
          const map = new Map(links.map((l) => [l.findingId, l.taskId]))
          return {
            ...x,
            concreteFindings: (x.concreteFindings ?? []).map((f) => {
              const tid = map.get(f.id)
              return tid ? { ...f, linkedTaskId: tid } : f
            }),
            updatedAt: new Date().toISOString(),
          }
        }),
      }))
    },
    [setState],
  )

  const inspectionDocumentPayload = useCallback((ins: Inspection, protocolSignatures: HseProtocolSignature[], closure?: HseProtocolSignature) => ({
    docKind: 'hse_inspection_document' as const,
    inspectionId: ins.id,
    title: ins.title,
    inspectionKind: ins.kind,
    conductedAt: ins.conductedAt,
    scope: ins.scope,
    findingsSummary: ins.findings,
    followUp: ins.followUp,
    status: ins.status,
    responsible: ins.responsible,
    responsibleEmployeeId: ins.responsibleEmployeeId ?? null,
    subjectKind: ins.subjectKind ?? 'free_text',
    subjectUnitId: ins.subjectUnitId ?? null,
    subjectLabel: ins.subjectLabel ?? null,
    concreteFindings: (ins.concreteFindings ?? []).map((f) => ({
      id: f.id,
      description: f.description,
      status: f.status,
      photoPath: f.photoPath ?? null,
    })),
    attachments: (ins.attachments ?? []).map((a) => ({ id: a.id, kind: a.kind, path: a.path, fileName: a.fileName })),
    protocolSignatures: protocolSignatures.map((s) => ({ signerName: s.signerName, signedAt: s.signedAt, role: s.role })),
    closureSignature: closure
      ? { signerName: closure.signerName, signedAt: closure.signedAt, role: closure.role }
      : null,
    locked: ins.locked ?? false,
  }), [])

  const finalizeInspectionClose = useCallback(
    async (inspectionId: string, signerName: string): Promise<{ ok: true; seeds: { findingId: string; task: KanbanTaskSeed }[] } | { ok: false }> => {
      const name = signerName.trim()
      if (!name) return { ok: false }
      setError(null)
      const ins = state.inspections.find((x) => x.id === inspectionId)
      if (!ins || ins.locked || ins.status !== 'closed') return { ok: false }

      const signedAt = new Date().toISOString()
      const closureSig: HseProtocolSignature = { signerName: name, signedAt, role: 'inspector' }
      const protos = ins.protocolSignatures ?? []
      const hashPayload = inspectionDocumentPayload({ ...ins, locked: true, status: 'closed' }, protos, closureSig)
      const documentHashSha256 = await hashDocumentPayload(hashPayload)
      let level1: HseProtocolSignature['level1'] | undefined
      if (useRemote && supabase && orgId && userId) {
        const clientIp = await fetchClientIpBestEffort()
        const row = await insertSystemSignatureEvent(supabase, orgId, userId, {
          resourceType: 'hse_inspection',
          resourceId: inspectionId,
          action: 'hse_inspection_close_finalize',
          documentHashSha256,
          signerDisplayName: name,
          role: 'inspector',
          clientIp,
        })
        if ('error' in row) {
          setError(row.error)
          return { ok: false }
        }
        level1 = row.evidence
      }
      const closureWithMeta: HseProtocolSignature = { ...closureSig, level1 }

      const openFindings = (ins.concreteFindings ?? []).filter((f) => f.status === 'open')
      const seeds: { findingId: string; task: KanbanTaskSeed }[] = openFindings.map((f) => ({
        findingId: f.id,
        task: {
          title: `Avvik: ${ins.title.slice(0, 36)}${ins.title.length > 36 ? '…' : ''} — ${f.description.slice(0, 48)}${f.description.length > 48 ? '…' : ''}`,
          description: [f.description, f.photoUrl ? `Vedlegg: ${f.photoUrl}` : '', ins.followUp ? `Oppfølging (inspeksjon): ${ins.followUp}` : '']
            .filter(Boolean)
            .join('\n\n'),
          status: 'todo',
          assignee: ins.responsible || 'Unassigned',
          assigneeEmployeeId: ins.responsibleEmployeeId,
          ownerRole: 'HMS / inspeksjon',
          dueDate: '—',
          module: 'hse',
          sourceType: 'hse_inspection_finding',
          sourceId: f.id,
          sourceLabel: ins.title,
          requiresManagementSignOff: ins.kind === 'external',
        },
      }))

      setState((s) => {
        const entry = auditEntry(
          'inspection_updated',
          'inspection',
          inspectionId,
          `Inspeksjon låst og signert (nivå 1): ${name}`,
          { locked: true, findingsTaskCount: seeds.length },
        )
        return {
          ...s,
          inspections: s.inspections.map((x) =>
            x.id === inspectionId
              ? {
                  ...x,
                  locked: true,
                  closureSignature: closureWithMeta,
                  findingTasksSynced: seeds.length > 0,
                  updatedAt: new Date().toISOString(),
                }
              : x,
          ),
          auditTrail: [...s.auditTrail, entry],
        }
      })

      return { ok: true, seeds }
    },
    [state.inspections, setState, useRemote, supabase, orgId, userId, inspectionDocumentPayload],
  )

  const signInspectionProtocol = useCallback(
    async (inspectionId: string, signerName: string, role: HseProtocolSignature['role']) => {
      const name = signerName.trim()
      if (!name) return false
      setError(null)
      const ins = state.inspections.find((x) => x.id === inspectionId)
      if (!ins || ins.locked) return false
      const signedAt = new Date().toISOString()
      const proposed = [
        ...(ins.protocolSignatures ?? []).map(({ signerName: sn, signedAt: sa, role: r }) => ({
          signerName: sn,
          signedAt: sa,
          role: r,
        })),
        { signerName: name, signedAt, role },
      ]
      const hashPayload = {
        docKind: 'hse_inspection_protocol' as const,
        inspectionId: ins.id,
        title: ins.title,
        inspectionKind: ins.kind,
        conductedAt: ins.conductedAt,
        scope: ins.scope,
        findings: ins.findings,
        followUp: ins.followUp,
        status: ins.status,
        responsible: ins.responsible,
        responsibleEmployeeId: ins.responsibleEmployeeId ?? null,
        subjectKind: ins.subjectKind ?? null,
        subjectUnitId: ins.subjectUnitId ?? null,
        subjectLabel: ins.subjectLabel ?? null,
        concreteFindings: ins.concreteFindings ?? [],
        attachments: ins.attachments ?? [],
        protocolSignatures: proposed,
      }
      const documentHashSha256 = await hashDocumentPayload(hashPayload)
      let level1: HseProtocolSignature['level1'] | undefined
      if (useRemote && supabase && orgId && userId) {
        const clientIp = await fetchClientIpBestEffort()
        const row = await insertSystemSignatureEvent(supabase, orgId, userId, {
          resourceType: 'hse_inspection',
          resourceId: inspectionId,
          action: `hse_inspection_protocol_sign_${role}`,
          documentHashSha256,
          signerDisplayName: name,
          role,
          clientIp,
        })
        if ('error' in row) {
          setError(row.error)
          return false
        }
        level1 = row.evidence
      }
      const sig: HseProtocolSignature = { signerName: name, signedAt, role, level1 }
      setState((s) => {
        const entry = auditEntry(
          'inspection_updated',
          'inspection',
          inspectionId,
          `Inspeksjonsprotokoll signert (${role}): ${name}`,
          { role },
        )
        return {
          ...s,
          inspections: s.inspections.map((x) =>
            x.id === inspectionId
              ? { ...x, protocolSignatures: [...(x.protocolSignatures ?? []), sig], updatedAt: new Date().toISOString() }
              : x,
          ),
          auditTrail: [...s.auditTrail, entry],
        }
      })
      return true
    },
    [setState, state.inspections, useRemote, supabase, orgId, userId],
  )

  const createIncident = useCallback(
    (partial: Omit<Incident, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString()
      const inc: Incident = {
        ...partial,
        evidencePhotos: partial.evidencePhotos ?? [],
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        createdByUserId: partial.createdByUserId ?? userId,
      }
      const kindLabels: Record<string, string> = {
        incident: 'Hendelse',
        near_miss: 'Nestenulykke',
        violence: 'Vold',
        threat: 'Trussel',
        deviation: 'Avvik',
      }
      const entry = auditEntry(
        'incident_created',
        'incident',
        inc.id,
        `${kindLabels[inc.kind] ?? 'Hendelse'} registrert — ${inc.severity}`,
        { severity: inc.severity, occurredAt: inc.occurredAt, location: inc.location.slice(0, 120), kind: inc.kind },
      )
      setState((s) => ({ ...s, incidents: [inc, ...s.incidents], auditTrail: [...s.auditTrail, entry] }))
      return inc
    },
    [setState, userId],
  )

  const updateIncident = useCallback(
    (id: string, patch: Partial<Incident>) => {
      setState((s) => {
        const entry = auditEntry('incident_updated', 'incident', id, 'Hendelse oppdatert', { status: patch.status ?? null })
        return {
          ...s,
          incidents: s.incidents.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x)),
          auditTrail: [...s.auditTrail, entry],
        }
      })
    },
    [setState],
  )

  const addCorrectiveAction = useCallback(
    (incidentId: string, action: Omit<CorrectiveAction, 'id'>) => {
      setState((s) => {
        const inc = s.incidents.find((x) => x.id === incidentId)
        if (!inc) return s
        const ca: CorrectiveAction = { ...action, id: crypto.randomUUID() }
        const updated = { ...inc, correctiveActions: [...inc.correctiveActions, ca], updatedAt: new Date().toISOString() }
        const entry = auditEntry('incident_updated', 'incident', incidentId, `Tiltak lagt til: ${ca.description.slice(0, 80)}`)
        return {
          ...s,
          incidents: s.incidents.map((x) => (x.id === incidentId ? updated : x)),
          auditTrail: [...s.auditTrail, entry],
        }
      })
    },
    [setState],
  )

  const createSickLeaveCase = useCallback(
    (partial: Omit<SickLeaveCase, 'id' | 'createdAt' | 'updatedAt' | 'milestones' | 'portalMessages'>) => {
      const now = new Date().toISOString()
      const sc: SickLeaveCase = {
        ...partial,
        id: crypto.randomUUID(),
        milestones: buildMilestones(partial.sickFrom),
        portalMessages: [],
        createdAt: now,
        updatedAt: now,
      }
      const entry = auditEntry('sick_leave_created', 'sick_leave', sc.id, `Sykefraværssak opprettet: ${sc.employeeName}`, {
        department: sc.department,
        sickFrom: sc.sickFrom,
        degree: sc.sicknessDegree,
      })
      setState((s) => ({ ...s, sickLeaveCases: [sc, ...s.sickLeaveCases], auditTrail: [...s.auditTrail, entry] }))
      return sc
    },
    [setState],
  )

  const updateSickLeaveCase = useCallback(
    (id: string, patch: Partial<SickLeaveCase>) => {
      setState((s) => {
        const entry = auditEntry('sick_leave_updated', 'sick_leave', id, 'Sykefraværssak oppdatert', { status: patch.status ?? null })
        return {
          ...s,
          sickLeaveCases: s.sickLeaveCases.map((x) =>
            x.id === id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x,
          ),
          auditTrail: [...s.auditTrail, entry],
        }
      })
    },
    [setState],
  )

  const completeMilestone = useCallback(
    (caseId: string, kind: SickLeaveMilestoneKind, note?: string) => {
      setState((s) => {
        const sc = s.sickLeaveCases.find((x) => x.id === caseId)
        if (!sc) return s
        const now = new Date().toISOString()
        const milestones = sc.milestones.map((m) =>
          m.kind === kind ? { ...m, completedAt: now, note: note ?? m.note } : m,
        )
        const entry = auditEntry(
          'sick_leave_milestone_completed',
          'sick_leave',
          caseId,
          `Milepæl fullført: ${milestones.find((m) => m.kind === kind)?.label ?? kind}`,
          { kind, completedAt: now },
        )
        return {
          ...s,
          sickLeaveCases: s.sickLeaveCases.map((x) => (x.id === caseId ? { ...x, milestones, updatedAt: now } : x)),
          auditTrail: [...s.auditTrail, entry],
        }
      })
    },
    [setState],
  )

  const addPortalMessage = useCallback(
    (caseId: string, senderRole: SickLeaveMessage['senderRole'], senderName: string, text: string) => {
      if (!text.trim()) return
      const msg: SickLeaveMessage = { id: crypto.randomUUID(), sentAt: new Date().toISOString(), senderRole, senderName, text: text.trim() }
      setState((s) => ({
        ...s,
        sickLeaveCases: s.sickLeaveCases.map((x) =>
          x.id === caseId ? { ...x, portalMessages: [...x.portalMessages, msg], updatedAt: new Date().toISOString() } : x,
        ),
      }))
    },
    [setState],
  )

  const createSja = useCallback(
    (partial: Omit<SjaAnalysis, 'id' | 'createdAt' | 'updatedAt' | 'signatures'>) => {
      const now = new Date().toISOString()
      const sja: SjaAnalysis = { ...partial, id: crypto.randomUUID(), signatures: [], createdAt: now, updatedAt: now }
      const entry = auditEntry('sja_created', 'sja', sja.id, `SJA opprettet: «${sja.title}»`, { location: sja.location, department: sja.department })
      setState((s) => ({ ...s, sjaAnalyses: [sja, ...s.sjaAnalyses], auditTrail: [...s.auditTrail, entry] }))
      return sja
    },
    [setState],
  )

  const updateSja = useCallback(
    (id: string, patch: Partial<SjaAnalysis>) => {
      setState((s) => {
        const cur = s.sjaAnalyses.find((x) => x.id === id)
        if (!cur) return s
        const merged: SjaAnalysis = { ...cur, ...patch, updatedAt: new Date().toISOString() }
        const nextStatus =
          patch.status === 'closed' || merged.status === 'closed'
            ? 'closed'
            : recomputeSjaStatus(merged)
        const final = { ...merged, status: nextStatus }
        const entry = auditEntry('sja_updated', 'sja', id, 'SJA oppdatert', { status: final.status })
        return {
          ...s,
          sjaAnalyses: s.sjaAnalyses.map((x) => (x.id === id ? final : x)),
          auditTrail: [...s.auditTrail, entry],
        }
      })
    },
    [setState],
  )

  const addSjaRow = useCallback(
    (sjaId: string, row: Omit<SjaHazardRow, 'id'>) => {
      const newRow: SjaHazardRow = { ...row, id: crypto.randomUUID() }
      setState((s) => ({
        ...s,
        sjaAnalyses: s.sjaAnalyses.map((x) => {
          if (x.id !== sjaId) return x
          const merged = { ...x, rows: [...x.rows, newRow], updatedAt: new Date().toISOString() }
          return { ...merged, status: recomputeSjaStatus(merged) }
        }),
      }))
    },
    [setState],
  )

  const updateSjaRow = useCallback(
    (sjaId: string, rowId: string, patch: Partial<SjaHazardRow>) => {
      setState((s) => ({
        ...s,
        sjaAnalyses: s.sjaAnalyses.map((x) => {
          if (x.id !== sjaId) return x
          const merged = {
            ...x,
            rows: x.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
            updatedAt: new Date().toISOString(),
          }
          return { ...merged, status: recomputeSjaStatus(merged) }
        }),
      }))
    },
    [setState],
  )

  const signSja = useCallback(
    async (sjaId: string, sig: Omit<SjaSignature, 'signedAt' | 'level1'>) => {
      setError(null)
      if (!sig.signerName.trim()) return false
      const sja = state.sjaAnalyses.find((x) => x.id === sjaId)
      if (!sja) return false
      if (sig.signerEmployeeId && sig.role === 'worker') {
        const dup = sja.signatures.some((x) => x.signerEmployeeId === sig.signerEmployeeId && x.role === 'worker')
        if (dup) return false
      }
      if (sig.signerEmployeeId && sig.role === 'foreman' && sja.workLeaderEmployeeId === sig.signerEmployeeId) {
        const dup = sja.signatures.some(
          (x) => x.signerEmployeeId === sig.signerEmployeeId && x.role === 'foreman',
        )
        if (dup) return false
      }
      const signedAt = new Date().toISOString()
      const sigPreview: SjaSignature = {
        ...sig,
        signerName: sig.signerName.trim(),
        signedAt,
        signerUserId: userId,
      }
      const proposedSigs = [
        ...sja.signatures.map((x) => ({
          signerName: x.signerName,
          signedAt: x.signedAt,
          role: x.role,
          signerEmployeeId: x.signerEmployeeId,
          signerUserId: x.signerUserId,
        })),
        {
          signerName: sigPreview.signerName,
          signedAt,
          role: sigPreview.role,
          signerEmployeeId: sigPreview.signerEmployeeId,
          signerUserId: sigPreview.signerUserId,
        },
      ]
      const hashPayload = {
        kind: 'hse_sja' as const,
        sjaId: sja.id,
        title: sja.title,
        jobDescription: sja.jobDescription,
        location: sja.location,
        department: sja.department,
        departmentId: sja.departmentId,
        plannedAt: sja.plannedAt,
        conductedBy: sja.conductedBy,
        workLeaderEmployeeId: sja.workLeaderEmployeeId,
        participantEmployeeIds: sja.participantEmployeeIds,
        participants: sja.participants,
        rows: sja.rows,
        status: sja.status,
        conclusion: sja.conclusion,
        involvesHotWork: sja.involvesHotWork,
        requiresLoto: sja.requiresLoto,
        signatures: proposedSigs,
      }
      const documentHashSha256 = await hashDocumentPayload(hashPayload)
      let level1: SjaSignature['level1'] | undefined
      if (useRemote && supabase && orgId && userId) {
        const clientIp = await fetchClientIpBestEffort()
        const row = await insertSystemSignatureEvent(supabase, orgId, userId, {
          resourceType: 'hse_sja',
          resourceId: sjaId,
          action: `hse_sja_sign_${sig.role}`,
          documentHashSha256,
          signerDisplayName: sigPreview.signerName,
          role: sig.role,
          clientIp,
        })
        if ('error' in row) {
          setError(row.error)
          return false
        }
        level1 = row.evidence
      }
      const signature: SjaSignature = { ...sigPreview, level1 }
      setState((s) => {
        const cur = s.sjaAnalyses.find((x) => x.id === sjaId)
        if (!cur) return s
        const merged: SjaAnalysis = {
          ...cur,
          signatures: [...cur.signatures, signature],
          updatedAt: new Date().toISOString(),
        }
        const nextStatus = recomputeSjaStatus(merged)
        const final = { ...merged, status: nextStatus }
        const entry = auditEntry(
          'sja_approved',
          'sja',
          sjaId,
          `SJA signert: ${signature.signerName} (${signature.role}) — status ${final.status}`,
        )
        return {
          ...s,
          sjaAnalyses: s.sjaAnalyses.map((x) => (x.id === sjaId ? final : x)),
          auditTrail: [...s.auditTrail, entry],
        }
      })
      return true
    },
    [setState, state.sjaAnalyses, useRemote, supabase, orgId, userId],
  )

  const addChecklistTemplate = useCallback(
    (tpl: Omit<ChecklistTemplate, 'id' | 'createdAt'>) => {
      const t: ChecklistTemplate = { ...tpl, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
      setState((s) => ({ ...s, checklistTemplates: [...s.checklistTemplates, t] }))
      return t
    },
    [setState],
  )

  const createTrainingRecord = useCallback(
    (partial: Omit<TrainingRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString()
      const rec: TrainingRecord = { ...partial, id: crypto.randomUUID(), createdAt: now, updatedAt: now }
      const entry = auditEntry('training_created', 'training', rec.id, `Opplæring registrert: ${rec.employeeName} — ${rec.trainingKind}`, {
        kind: rec.trainingKind,
        department: rec.department,
      })
      setState((s) => ({ ...s, trainingRecords: [rec, ...s.trainingRecords], auditTrail: [...s.auditTrail, entry] }))
      return rec
    },
    [setState],
  )

  const updateTrainingRecord = useCallback(
    (id: string, patch: Partial<TrainingRecord>) => {
      setState((s) => {
        const entry = auditEntry('training_updated', 'training', id, 'Opplæringspost oppdatert')
        return {
          ...s,
          trainingRecords: s.trainingRecords.map((x) =>
            x.id === id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x,
          ),
          auditTrail: [...s.auditTrail, entry],
        }
      })
    },
    [setState],
  )

  const anonymiseIncident = useCallback(
    (id: string) => {
      setState((s) => {
        const inc = s.incidents.find((x) => x.id === id)
        if (!inc) return s
        const anonymised = {
          ...inc,
          reportedBy: '[anonymisert]',
          reportedByEmployeeId: undefined,
          nearestLeaderEmployeeId: undefined,
          injuredPerson: inc.injuredPerson ? '[anonymisert]' : undefined,
          witnesses: inc.witnesses ? '[anonymisert]' : undefined,
          experienceDetail: inc.experienceDetail ? '[anonymisert]' : undefined,
          evidencePhotos: [],
          updatedAt: new Date().toISOString(),
        }
        const entry = auditEntry('incident_anonymised', 'incident', id, 'Personopplysninger anonymisert (GDPR)', {
          originalReportedBy: inc.reportedBy.slice(0, 20),
        })
        return {
          ...s,
          incidents: s.incidents.map((x) => (x.id === id ? anonymised : x)),
          auditTrail: [...s.auditTrail, entry],
        }
      })
    },
    [setState],
  )

  const anonymiseSickLeave = useCallback(
    (id: string) => {
      setState((s) => {
        const sc = s.sickLeaveCases.find((x) => x.id === id)
        if (!sc) return s
        const anonymised: SickLeaveCase = {
          ...sc,
          employeeName: '[anonymisert]',
          employeeId: undefined,
          accommodationNotes: '[anonymisert — GDPR]',
          portalMessages: [],
          updatedAt: new Date().toISOString(),
        }
        const entry = auditEntry('sick_leave_anonymised', 'sick_leave', id, 'Sykefraværssak anonymisert (GDPR)', { department: sc.department })
        return {
          ...s,
          sickLeaveCases: s.sickLeaveCases.map((x) => (x.id === id ? anonymised : x)),
          auditTrail: [...s.auditTrail, entry],
        }
      })
    },
    [setState],
  )

  const exportJson = useCallback((): string => {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 2,
      safetyRounds: state.safetyRounds,
      inspections: state.inspections,
      incidents: state.incidents,
      sjaAnalyses: state.sjaAnalyses,
      trainingRecords: state.trainingRecords,
      sickLeaveCases: state.sickLeaveCases.map((sc) => ({
        ...sc,
        portalMessages: '[redacted — GDPR]',
        accommodationNotes: '[redacted — GDPR]',
      })),
      auditTrail: state.auditTrail,
    }
    const entry = auditEntry('data_exported', 'system', 'hse-export', 'Fullstendig HSE-eksport gjennomført (JSON)')
    setState((s) => ({ ...s, auditTrail: [...s.auditTrail, entry] }))
    return JSON.stringify(payload, null, 2)
  }, [state, setState])

  const resetDemo = useCallback(async () => {
    const base = seedDemoHse()
    const next = {
      ...base,
      auditTrail: [...base.auditTrail, auditEntry('demo_reset', 'system', 'hse', 'Demodata tilbakestilt.')],
    }
    if (useRemote && supabase && orgId) {
      try {
        setError(null)
        await upsertOrgModulePayload(supabase, orgId, MODULE_KEY, next)
        setRemoteState(next)
        if (userId) writeOrgModuleSnap(MODULE_KEY, orgId, userId, next)
      } catch (e) {
        setError(getSupabaseErrorMessage(e))
      }
      return
    }
    localStorage.removeItem(STORAGE_KEY)
    setLocalState(loadLocal())
  }, [useRemote, supabase, orgId, userId])

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const overdueMs = state.sickLeaveCases
      .filter((c) => c.status === 'active' || c.status === 'partial')
      .flatMap((c) => c.milestones)
      .filter((m) => !m.completedAt && m.dueAt < today).length
    const expiredTraining = state.trainingRecords.filter((r) => r.expiresAt && r.expiresAt < today).length

    return {
      rounds: state.safetyRounds.length,
      inspections: state.inspections.length,
      incidents: state.incidents.length,
      violence: state.incidents.filter((i) => i.kind === 'violence' || i.kind === 'threat').length,
      openInspections: state.inspections.filter((i) => i.status === 'open').length,
      sjaCount: state.sjaAnalyses.length,
      openSja: state.sjaAnalyses.filter((s) => s.status === 'draft' || s.status === 'awaiting_participants').length,
      trainingRecords: state.trainingRecords.length,
      expiredTraining,
      activeSickLeave: state.sickLeaveCases.filter((c) => c.status === 'active' || c.status === 'partial').length,
      overdueMilestones: overdueMs,
      auditEntries: state.auditTrail.length,
    }
  }, [state])

  const checklistTemplate = DEFAULT_SAFETY_ROUND_CHECKLIST

  return {
    ...state,
    checklistTemplate,
    stats,
    loading: useRemote ? loading : false,
    error: useRemote ? error : null,
    backend: useRemote ? ('supabase' as const) : ('local' as const),
    createSafetyRound,
    updateSafetyRound,
    setChecklistStatus,
    setChecklistItemDetail,
    submitRoundForApproval,
    signSafetyRound,
    createInspection,
    updateInspection,
    addInspectionFinding,
    updateInspectionFinding,
    removeInspectionFinding,
    addInspectionAttachment,
    removeInspectionAttachment,
    linkInspectionFindingTasks,
    finalizeInspectionClose,
    signInspectionProtocol,
    createIncident,
    updateIncident,
    addCorrectiveAction,
    createSja,
    updateSja,
    addSjaRow,
    updateSjaRow,
    signSja,
    addChecklistTemplate,
    createTrainingRecord,
    updateTrainingRecord,
    anonymiseIncident,
    anonymiseSickLeave,
    exportJson,
    createSickLeaveCase,
    updateSickLeaveCase,
    completeMilestone,
    addPortalMessage,
    resetDemo,
  }
}
