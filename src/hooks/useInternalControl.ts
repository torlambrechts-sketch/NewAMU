import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { computeRiskScore, emptyRosRow } from '../data/rosTemplate'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import {
  clearOrgModuleSnap,
  fetchOrgModulePayload,
  readOrgModuleSnap,
  upsertOrgModulePayload,
  writeOrgModuleSnap,
} from '../lib/orgModulePayload'
import { useOrgSetupContext } from './useOrgSetupContext'
import type { AmlReportKind } from '../types/orgHealth'
import type {
  AnnualReview,
  InternalControlAuditEntry,
  RosAssessment,
  RosRiskRow,
  RosSignature,
  RosSignatureRole,
  WhistleCase,
  WhistleCaseStatus,
} from '../types/internalControl'

const STORAGE_KEY = 'atics-internal-control-v1'
const MODULE_KEY = 'internal_control' as const

type InternalControlState = {
  whistleCases: WhistleCase[]
  rosAssessments: RosAssessment[]
  annualReviews: AnnualReview[]
  auditTrail: InternalControlAuditEntry[]
}

function audit(
  action: string,
  message: string,
  meta?: Record<string, string | number | boolean>,
): InternalControlAuditEntry {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    action,
    message,
    meta,
  }
}

const statusLabels: Record<WhistleCaseStatus, string> = {
  received: 'Mottatt',
  triage: 'Vurdering',
  investigation: 'Undersøkelse',
  internal_review: 'Intern revisjon',
  closed: 'Avsluttet',
}

function normalizeParsed(p: InternalControlState): InternalControlState {
  return {
    whistleCases: Array.isArray(p.whistleCases) ? p.whistleCases : [],
    rosAssessments: Array.isArray(p.rosAssessments)
      ? p.rosAssessments.map((r) => ({
          ...r,
          signatures: (r as RosAssessment).signatures ?? [],
          locked: (r as RosAssessment).locked ?? false,
          rows: Array.isArray(r.rows)
            ? r.rows.map((row: RosRiskRow) => ({
                ...row,
                status: (row as RosRiskRow).status ?? (row.done ? 'closed' : 'open'),
              }))
            : [],
        }))
      : [],
    annualReviews: Array.isArray(p.annualReviews) ? p.annualReviews : [],
    auditTrail: Array.isArray(p.auditTrail) ? p.auditTrail : [],
  }
}

function seedDemoInternalControl(): InternalControlState {
  const demoCase: WhistleCase = {
    id: 'demo-w1',
    title: 'Eksempel: Oppfølging anonym henvendelse',
    categoryKind: 'psychosocial',
    status: 'triage',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    assignee: 'HR / HMS',
    internalNotes: 'Demo-sak — erstatt med reell prosess.',
  }
  const demoRos: RosAssessment = {
    id: 'demo-ros1',
    title: 'ROS — Kontor og møterom (mal)',
    department: 'Administrasjon',
    assessedAt: new Date().toISOString().slice(0, 10),
    assessor: 'HMS-koordinator (demo)',
    rows: [
      {
        ...emptyRosRow(),
        id: 'r1',
        activity: 'Skjermarbeid',
        hazard: 'Belastningsskader, øye',
        existingControls: 'Justerbar stol, pauser',
        severity: 3,
        likelihood: 3,
        riskScore: 9,
        proposedMeasures: 'Dokumenterte pauserutiner',
        responsible: 'Leder',
        dueDate: '',
        status: 'open' as const,
      },
    ],
    signatures: [],
    locked: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const demoAnnual: AnnualReview = {
    id: 'demo-ar1',
    year: new Date().getFullYear(),
    reviewedAt: new Date().toISOString().slice(0, 10),
    reviewer: 'Ledergruppe (demo)',
    summary: 'Årlig gjennomgang av internkontrollen er dokumentert (eksempel).',
    nextReviewDue: `${new Date().getFullYear() + 1}-12-31`,
  }
  return {
    whistleCases: [demoCase],
    rosAssessments: [demoRos],
    annualReviews: [demoAnnual],
    auditTrail: [audit('init', 'Internkontroll-modul initialisert med demo.', { demo: true })],
  }
}

function emptyRemoteState(): InternalControlState {
  return { whistleCases: [], rosAssessments: [], annualReviews: [], auditTrail: [] }
}

function loadLocal(): InternalControlState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedDemoInternalControl()
    const p = JSON.parse(raw) as InternalControlState
    return normalizeParsed(p)
  } catch {
    return emptyRemoteState()
  }
}

function saveLocal(s: InternalControlState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

const PERSIST_DEBOUNCE_MS = 450

export function useInternalControl() {
  const { supabase, organization, user } = useOrgSetupContext()
  const orgId = organization?.id
  const userId = user?.id
  const useRemote = !!(supabase && orgId && userId)

  const initialRemote =
    useRemote && orgId && userId ? readOrgModuleSnap<InternalControlState>(MODULE_KEY, orgId, userId) : null
  const [localState, setLocalState] = useState<InternalControlState>(() => loadLocal())
  const [remoteState, setRemoteState] = useState<InternalControlState>(() => initialRemote ?? emptyRemoteState())
  const [loading, setLoading] = useState(useRemote)
  const [error, setError] = useState<string | null>(null)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const state = useRemote ? remoteState : localState
  const setState = useRemote ? setRemoteState : setLocalState

  const refreshInternalControl = useCallback(async () => {
    if (!supabase || !orgId || !userId) return
    setLoading(true)
    setError(null)
    try {
      const payload = await fetchOrgModulePayload<InternalControlState>(supabase, orgId, MODULE_KEY)
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
    void refreshInternalControl()
  }, [useRemote, refreshInternalControl])

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

  const createWhistleCase = useCallback(
    (input: {
      title: string
      categoryKind?: AmlReportKind
      assignee?: string
      sourceAnonymousReportId?: string
    }) => {
      const c: WhistleCase = {
        id: crypto.randomUUID(),
        title: input.title.trim(),
        categoryKind: input.categoryKind,
        status: 'received',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        assignee: input.assignee?.trim() || 'Ikke tildelt',
        internalNotes: '',
        sourceAnonymousReportId: input.sourceAnonymousReportId,
      }
      setState((s) => ({
        ...s,
        whistleCases: [c, ...s.whistleCases],
        auditTrail: [
          ...s.auditTrail,
          audit('whistle_created', `Varslingssak opprettet: ${c.title}`, { caseId: c.id }),
        ],
      }))
      return c
    },
    [setState],
  )

  const createCaseFromAnonymousReport = useCallback(
    (report: { id: string; kind: AmlReportKind; submittedAt: string; urgency: string }) => {
      let created: WhistleCase | null = null
      setState((s) => {
        if (s.whistleCases.some((c) => c.sourceAnonymousReportId === report.id)) return s
        const title = `Oppfølging anonym melding (${report.id.slice(0, 8)})`
        const c: WhistleCase = {
          id: crypto.randomUUID(),
          title,
          categoryKind: report.kind,
          status: 'received',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          assignee: 'HR / HMS',
          internalNotes: `Koblet til anonym melding ${report.id}. Innsendt: ${report.submittedAt}. Hastegrad oppgitt: ${report.urgency}.`,
          sourceAnonymousReportId: report.id,
        }
        created = c
        return {
          ...s,
          whistleCases: [c, ...s.whistleCases],
          auditTrail: [
            ...s.auditTrail,
            audit('whistle_from_anonymous', 'Varslingssak opprettet fra anonym AML-melding.', {
              caseId: c.id,
              reportId: report.id,
            }),
          ],
        }
      })
      return created
    },
    [setState],
  )

  const updateWhistleStatus = useCallback(
    (caseId: string, status: WhistleCaseStatus) => {
      setState((s) => {
        const extra =
          status === 'internal_review'
            ? audit('whistle_internal_review', 'Sak satt til intern revisjon (etter virksomhetens rutine).', {
                caseId,
              })
            : null
        return {
          ...s,
          whistleCases: s.whistleCases.map((c) =>
            c.id === caseId ? { ...c, status, updatedAt: new Date().toISOString() } : c,
          ),
          auditTrail: [
            ...s.auditTrail,
            audit('whistle_status', `Status endret til ${statusLabels[status]}`, { caseId, status }),
            ...(extra ? [extra] : []),
          ],
        }
      })
    },
    [setState],
  )

  const sendToInternalReview = useCallback(
    (caseId: string) => {
      updateWhistleStatus(caseId, 'internal_review')
    },
    [updateWhistleStatus],
  )

  const updateWhistleNotes = useCallback(
    (caseId: string, internalNotes: string) => {
      setState((s) => ({
        ...s,
        whistleCases: s.whistleCases.map((c) =>
          c.id === caseId ? { ...c, internalNotes, updatedAt: new Date().toISOString() } : c,
        ),
      }))
    },
    [setState],
  )

  const createRosAssessment = useCallback(
    (title: string, department: string, assessor: string) => {
      const r: RosAssessment = {
        id: crypto.randomUUID(),
        title: title.trim(),
        department: department.trim(),
        assessedAt: new Date().toISOString().slice(0, 10),
        assessor: assessor.trim(),
        rows: [emptyRosRow()],
        signatures: [],
        locked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setState((s) => ({
        ...s,
        rosAssessments: [r, ...s.rosAssessments],
        auditTrail: [...s.auditTrail, audit('ros_created', `ROS opprettet: ${r.title}`, { rosId: r.id })],
      }))
      return r
    },
    [setState],
  )

  const updateRosRow = useCallback(
    (rosId: string, rowId: string, patch: Partial<RosRiskRow>) => {
      setState((s) => ({
        ...s,
        rosAssessments: s.rosAssessments.map((ros) => {
          if (ros.id !== rosId || ros.locked) return ros
          const rows = ros.rows.map((row) => {
            if (row.id !== rowId) return row
            const next = { ...row, ...patch }
            if (patch.severity != null || patch.likelihood != null) {
              next.riskScore = computeRiskScore(next.severity, next.likelihood)
            }
            if (patch.residualSeverity != null || patch.residualLikelihood != null) {
              const rs = next.residualSeverity ?? next.severity
              const rl = next.residualLikelihood ?? next.likelihood
              next.residualScore = computeRiskScore(rs, rl)
            }
            return next
          })
          return { ...ros, rows, updatedAt: new Date().toISOString() }
        }),
      }))
    },
    [setState],
  )

  const signRos = useCallback(
    (rosId: string, role: RosSignatureRole, signerName: string) => {
      if (!signerName.trim()) return
      setState((s) => ({
        ...s,
        rosAssessments: s.rosAssessments.map((ros) => {
          if (ros.id !== rosId) return ros
          if (ros.signatures.some((sig) => sig.role === role)) return ros
          const sig: RosSignature = { role, signerName: signerName.trim(), signedAt: new Date().toISOString() }
          const signatures = [...ros.signatures, sig]
          const locked =
            signatures.some((x) => x.role === 'leader') && signatures.some((x) => x.role === 'verneombud')
          return { ...ros, signatures, locked, updatedAt: new Date().toISOString() }
        }),
        auditTrail: [...s.auditTrail, audit('ros_signed', `ROS signert av ${signerName} (${role})`, { rosId, role })],
      }))
    },
    [setState],
  )

  const addRosRow = useCallback(
    (rosId: string) => {
      setState((s) => ({
        ...s,
        rosAssessments: s.rosAssessments.map((ros) =>
          ros.id === rosId
            ? { ...ros, rows: [...ros.rows, emptyRosRow()], updatedAt: new Date().toISOString() }
            : ros,
        ),
      }))
    },
    [setState],
  )

  const addAnnualReview = useCallback(
    (input: Omit<AnnualReview, 'id'>) => {
      const a: AnnualReview = {
        ...input,
        id: crypto.randomUUID(),
      }
      setState((s) => ({
        ...s,
        annualReviews: [a, ...s.annualReviews],
        auditTrail: [...s.auditTrail, audit('annual_review', `Årsgjennomgang ${a.year} registrert.`, { year: a.year })],
      }))
      return a
    },
    [setState],
  )

  const stats = useMemo(() => {
    const w = state.whistleCases
    return {
      whistleOpen: w.filter((c) => c.status !== 'closed').length,
      whistleInReview: w.filter((c) => c.status === 'internal_review').length,
      rosCount: state.rosAssessments.length,
      annualCount: state.annualReviews.length,
    }
  }, [state])

  const resetDemo = useCallback(async () => {
    const next = seedDemoInternalControl()
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

  return {
    ...state,
    stats,
    statusLabels,
    loading: useRemote ? loading : false,
    error: useRemote ? error : null,
    backend: useRemote ? ('supabase' as const) : ('local' as const),
    createWhistleCase,
    createCaseFromAnonymousReport,
    updateWhistleStatus,
    sendToInternalReview,
    updateWhistleNotes,
    createRosAssessment,
    updateRosRow,
    addRosRow,
    signRos,
    addAnnualReview,
    resetDemo,
  }
}
