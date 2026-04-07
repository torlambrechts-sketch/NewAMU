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
import { fetchClientIpBestEffort, hashDocumentPayload } from '../lib/level1Signature'
import { insertSystemSignatureEvent } from '../lib/recordSystemSignature'
import type {
  AnnualReview,
  InternalControlAuditEntry,
  RosAssessment,
  RosCategory,
  RosRiskRow,
  RosSignature,
  RosSignatureRole,
  RosWorkspaceCategory,
} from '../types/internalControl'
import { O_ROS_PRESET_HAZARDS } from '../types/internalControl'

const STORAGE_KEY = 'atics-internal-control-v1'
const MODULE_KEY = 'internal_control' as const

type InternalControlState = {
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

function normalizeParsed(p: InternalControlState & { whistleCases?: unknown }): InternalControlState {
  return {
    rosAssessments: Array.isArray(p.rosAssessments)
      ? p.rosAssessments.map((r) => ({
          ...r,
          rosCategory: (r as RosAssessment).rosCategory ?? 'general',
          workspaceCategory: (r as RosAssessment).workspaceCategory,
          revisionParentId: (r as RosAssessment).revisionParentId,
          revisionVersion: (r as RosAssessment).revisionVersion,
          signatures: (r as RosAssessment).signatures ?? [],
          locked: (r as RosAssessment).locked ?? false,
          rows: Array.isArray(r.rows)
            ? r.rows.map((row: RosRiskRow) => ({
                ...row,
                redResidualJustification: (row as RosRiskRow).redResidualJustification,
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
  const demoRos: RosAssessment = {
    id: 'demo-ros1',
    title: 'ROS — Kontor og møterom (mal)',
    department: 'Administrasjon',
    assessedAt: new Date().toISOString().slice(0, 10),
    assessor: 'HMS-koordinator (demo)',
    rosCategory: 'general',
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
    revisionVersion: 1,
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
    rosAssessments: [demoRos],
    annualReviews: [demoAnnual],
    auditTrail: [audit('init', 'Internkontroll-modul initialisert med demo.', { demo: true })],
  }
}

function emptyRemoteState(): InternalControlState {
  return { rosAssessments: [], annualReviews: [], auditTrail: [] }
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

  const createRosAssessment = useCallback(
    (
      title: string,
      department: string,
      assessor: string,
      opts?: {
        category?: RosCategory
        seedORosRows?: boolean
        workspaceCategory?: RosWorkspaceCategory
        initialRows?: RosRiskRow[]
      },
    ) => {
      const cat = opts?.category ?? 'general'
      let rows: RosRiskRow[]
      if (opts?.initialRows && opts.initialRows.length > 0) {
        rows = opts.initialRows
      } else if (cat === 'organizational_change' && opts?.seedORosRows) {
        rows = O_ROS_PRESET_HAZARDS.map((h) => ({
          ...emptyRosRow(),
          id: crypto.randomUUID(),
          activity: h.activity,
          hazard: h.hazard,
          existingControls: h.existingControls,
          severity: 3,
          likelihood: 3,
          riskScore: 9,
        }))
      } else {
        rows = [emptyRosRow()]
      }
      const r: RosAssessment = {
        id: crypto.randomUUID(),
        title: title.trim(),
        department: department.trim(),
        assessedAt: new Date().toISOString().slice(0, 10),
        assessor: assessor.trim(),
        rosCategory: cat,
        workspaceCategory: opts?.workspaceCategory,
        rows,
        signatures: [],
        locked: false,
        revisionVersion: 1,
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
    async (
      rosId: string,
      role: RosSignatureRole,
      signerName: string,
      opts?: { onLocked?: (ros: RosAssessment) => void },
    ) => {
      if (!signerName.trim()) return
      const target = state.rosAssessments.find((x) => x.id === rosId)
      if (target?.rosCategory === 'organizational_change' && useRemote && supabase && orgId) {
        const { data, error: se } = await supabase
          .from('hr_ros_org_signoffs')
          .select('blocked')
          .eq('organization_id', orgId)
          .eq('ros_assessment_id', rosId)
          .maybeSingle()
        if (se) console.warn('hr_ros_org_signoffs', se.message)
        if (data?.blocked === true) {
          setError(
            'O-ROS er sperret: begge signaturer (AMU-representant og verneombud) må registreres under HR → O-ROS før ROS kan låses.',
          )
          return
        }
      }
      const redWithoutJust = target?.rows.some(
        (row) =>
          row.residualScore != null &&
          row.residualScore >= 15 &&
          !(row.redResidualJustification && row.redResidualJustification.trim().length >= 10),
      )
      if (redWithoutJust) {
        setError(
          'Kan ikke signere: én eller flere rader har rød restrisiko (15–25) uten utfylt «Strakstiltak / eskalering» (min. 10 tegn).',
        )
        return
      }
      if (!target || target.signatures.some((sig) => sig.role === role)) return
      setError(null)
      const signedAt = new Date().toISOString()
      const name = signerName.trim()
      const signaturesPreview = [...target.signatures, { role, signerName: name, signedAt }]
      const lockedPreview =
        signaturesPreview.some((x) => x.role === 'leader') &&
        signaturesPreview.some((x) => x.role === 'verneombud')
      const rosAfterSign: RosAssessment = {
        ...target,
        signatures: signaturesPreview,
        locked: lockedPreview,
        updatedAt: signedAt,
      }
      const hashPayload = {
        ...rosAfterSign,
        signatures: rosAfterSign.signatures.map((s) => ({
          role: s.role,
          signerName: s.signerName,
          signedAt: s.signedAt,
        })),
      }
      const documentHashSha256 = await hashDocumentPayload(hashPayload)
      let level1: RosSignature['level1'] | undefined
      if (useRemote && supabase && orgId && userId) {
        const clientIp = await fetchClientIpBestEffort()
        const ins = await insertSystemSignatureEvent(supabase, orgId, userId, {
          resourceType: 'ros_assessment',
          resourceId: rosId,
          action: `ros_sign_${role}`,
          documentHashSha256,
          signerDisplayName: name,
          role,
          clientIp,
        })
        if ('error' in ins) {
          setError(ins.error)
          return
        }
        level1 = ins.evidence
      }
      const sig: RosSignature = { role, signerName: name, signedAt, level1 }
      setState((s) => {
        let lockedRos: RosAssessment | null = null
        const nextAssessments = s.rosAssessments.map((ros) => {
          if (ros.id !== rosId) return ros
          if (ros.signatures.some((x) => x.role === role)) return ros
          const signatures = [...ros.signatures, sig]
          const locked = signatures.some((x) => x.role === 'leader') && signatures.some((x) => x.role === 'verneombud')
          const updated = { ...ros, signatures, locked, updatedAt: signedAt }
          if (locked) lockedRos = updated
          return updated
        })
        if (lockedRos && opts?.onLocked) {
          queueMicrotask(() => opts.onLocked!(lockedRos!))
        }
        return {
          ...s,
          rosAssessments: nextAssessments,
          auditTrail: [...s.auditTrail, audit('ros_signed', `ROS signert av ${signerName} (${role})`, { rosId, role })],
        }
      })
    },
    [setState, state.rosAssessments, useRemote, supabase, orgId, userId],
  )

  const duplicateRosRevision = useCallback(
    (lockedSourceId: string) => {
      setState((s) => {
        const src = s.rosAssessments.find((x) => x.id === lockedSourceId)
        if (!src?.locked) return s
        let maxRev = src.revisionVersion ?? 1
        for (const r of s.rosAssessments) {
          if (r.id === lockedSourceId) maxRev = Math.max(maxRev, r.revisionVersion ?? 1)
          if (r.revisionParentId === lockedSourceId) maxRev = Math.max(maxRev, r.revisionVersion ?? 1)
        }
        const nextVersion = maxRev + 1
        const cloneRows = src.rows.map((row) => ({
          ...row,
          id: crypto.randomUUID(),
        }))
        const copy: RosAssessment = {
          ...src,
          id: crypto.randomUUID(),
          title: `${src.title.replace(/\s*\(revisjon v\d+\)\s*$/i, '').trim()} (revisjon v${nextVersion})`,
          assessedAt: new Date().toISOString().slice(0, 10),
          rows: cloneRows,
          signatures: [],
          locked: false,
          revisionParentId: lockedSourceId,
          revisionVersion: nextVersion,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        return {
          ...s,
          rosAssessments: [copy, ...s.rosAssessments],
          auditTrail: [
            ...s.auditTrail,
            audit('ros_revision', `Ny ROS-revisjon v${nextVersion} fra låst dokument`, {
              rosId: copy.id,
              parentId: lockedSourceId,
            }),
          ],
        }
      })
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
    return {
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
    loading: useRemote ? loading : false,
    error: useRemote ? error : null,
    backend: useRemote ? ('supabase' as const) : ('local' as const),
    createRosAssessment,
    updateRosRow,
    addRosRow,
    signRos,
    duplicateRosRevision,
    addAnnualReview,
    resetDemo,
  }
}
