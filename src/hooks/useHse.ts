import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AML_VERNEOMBUD_STRUCTURE,
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
import type {
  ChecklistItemDetail,
  ChecklistItemStatus,
  ChecklistTemplate,
  CorrectiveAction,
  HseAuditAction,
  HseAuditEntry,
  HseProtocolSignature,
  Incident,
  Inspection,
  SafetyRound,
  SafetyRoundApproval,
  SjaAnalysis,
  SjaHazardRow,
  SjaSignature,
  SickLeaveCase,
  SickLeaveMilestone,
  SickLeaveMilestoneKind,
  SickLeaveMessage,
  TrainingRecord,
} from '../types/hse'

const STORAGE_KEY = 'atics-hse-v2'
const MODULE_KEY = 'hse' as const
const PERSIST_DEBOUNCE_MS = 450

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

const emptyChecklist = (): Record<string, ChecklistItemStatus> => {
  const m: Record<string, ChecklistItemStatus> = {}
  for (const it of DEFAULT_SAFETY_ROUND_CHECKLIST) {
    m[it.id] = 'na'
  }
  return m
}

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
      ? p.safetyRounds.map((sr) => ({
          ...sr,
          itemDetails: (sr as SafetyRound).itemDetails ?? {},
          status: (sr as SafetyRound).status ?? ('in_progress' as const),
        }))
      : [],
    inspections: Array.isArray(p.inspections) ? p.inspections : [],
    incidents: Array.isArray(p.incidents) ? p.incidents : [],
    sjaAnalyses: Array.isArray(p.sjaAnalyses) ? p.sjaAnalyses : [],
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
  const { supabase, organization, user } = useOrgSetupContext()
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

  const createSafetyRound = useCallback(
    (partial: Omit<SafetyRound, 'id' | 'createdAt' | 'updatedAt' | 'items' | 'itemDetails' | 'status'>) => {
      const now = new Date().toISOString()
      const sr: SafetyRound = {
        ...partial,
        id: crypto.randomUUID(),
        items: emptyChecklist(),
        itemDetails: {},
        status: 'in_progress',
        createdAt: now,
        updatedAt: now,
      }
      const entry = auditEntry('safety_round_created', 'safety_round', sr.id, `Vernerunde opprettet: «${sr.title}»`, {
        location: sr.location,
        conductedBy: sr.conductedBy,
        conductedAt: sr.conductedAt,
        templateId: SAFETY_ROUND_TEMPLATE_ID,
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
        const entry = auditEntry('safety_round_updated', 'safety_round', roundId, 'Vernerunde sendt til leder for godkjenning')
        return {
          ...s,
          safetyRounds: s.safetyRounds.map((x) =>
            x.id === roundId ? { ...x, status: 'pending_approval' as const, submittedForApprovalAt: now, updatedAt: now } : x,
          ),
          auditTrail: [...s.auditTrail, entry],
        }
      })
    },
    [setState],
  )

  const approveRound = useCallback(
    (roundId: string, approval: SafetyRoundApproval) => {
      setState((s) => {
        const entry = auditEntry(
          'safety_round_updated',
          'safety_round',
          roundId,
          `Vernerunde godkjent av ${approval.approverName}`,
          { approverName: approval.approverName },
        )
        return {
          ...s,
          safetyRounds: s.safetyRounds.map((x) =>
            x.id === roundId ? { ...x, status: 'approved' as const, approval, updatedAt: new Date().toISOString() } : x,
          ),
          auditTrail: [...s.auditTrail, entry],
        }
      })
    },
    [setState],
  )

  const createInspection = useCallback(
    (partial: Omit<Inspection, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString()
      const ins: Inspection = {
        ...partial,
        protocolSignatures: partial.protocolSignatures ?? [],
        id: crypto.randomUUID(),
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

  const signInspectionProtocol = useCallback(
    (inspectionId: string, signerName: string, role: HseProtocolSignature['role']) => {
      const name = signerName.trim()
      if (!name) return false
      const sig: HseProtocolSignature = { signerName: name, signedAt: new Date().toISOString(), role }
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
    [setState],
  )

  const createIncident = useCallback(
    (partial: Omit<Incident, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString()
      const inc: Incident = { ...partial, id: crypto.randomUUID(), createdAt: now, updatedAt: now }
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
    [setState],
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
        const entry = auditEntry('sja_updated', 'sja', id, 'SJA oppdatert', { status: patch.status ?? null })
        return {
          ...s,
          sjaAnalyses: s.sjaAnalyses.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x)),
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
        sjaAnalyses: s.sjaAnalyses.map((x) =>
          x.id === sjaId ? { ...x, rows: [...x.rows, newRow], updatedAt: new Date().toISOString() } : x,
        ),
      }))
    },
    [setState],
  )

  const updateSjaRow = useCallback(
    (sjaId: string, rowId: string, patch: Partial<SjaHazardRow>) => {
      setState((s) => ({
        ...s,
        sjaAnalyses: s.sjaAnalyses.map((x) =>
          x.id === sjaId
            ? {
                ...x,
                rows: x.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
                updatedAt: new Date().toISOString(),
              }
            : x,
        ),
      }))
    },
    [setState],
  )

  const signSja = useCallback(
    (sjaId: string, sig: Omit<SjaSignature, 'signedAt'>) => {
      const signature: SjaSignature = { ...sig, signedAt: new Date().toISOString() }
      setState((s) => {
        const entry = auditEntry('sja_approved', 'sja', sjaId, `SJA signert: ${sig.signerName} (${sig.role})`)
        return {
          ...s,
          sjaAnalyses: s.sjaAnalyses.map((x) =>
            x.id === sjaId ? { ...x, signatures: [...x.signatures, signature], updatedAt: new Date().toISOString() } : x,
          ),
          auditTrail: [...s.auditTrail, entry],
        }
      })
    },
    [setState],
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
          injuredPerson: inc.injuredPerson ? '[anonymisert]' : undefined,
          witnesses: inc.witnesses ? '[anonymisert]' : undefined,
          experienceDetail: inc.experienceDetail ? '[anonymisert]' : undefined,
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
      openSja: state.sjaAnalyses.filter((s) => s.status === 'draft').length,
      trainingRecords: state.trainingRecords.length,
      expiredTraining,
      activeSickLeave: state.sickLeaveCases.filter((c) => c.status === 'active' || c.status === 'partial').length,
      overdueMilestones: overdueMs,
      auditEntries: state.auditTrail.length,
    }
  }, [state])

  const checklistTemplate = DEFAULT_SAFETY_ROUND_CHECKLIST
  const amlStructure = AML_VERNEOMBUD_STRUCTURE

  return {
    ...state,
    checklistTemplate,
    amlStructure,
    stats,
    loading: useRemote ? loading : false,
    error: useRemote ? error : null,
    backend: useRemote ? ('supabase' as const) : ('local' as const),
    createSafetyRound,
    updateSafetyRound,
    setChecklistStatus,
    setChecklistItemDetail,
    submitRoundForApproval,
    approveRound,
    createInspection,
    updateInspection,
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
