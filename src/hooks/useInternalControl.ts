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
  AnnualReviewActionDraft,
  AnnualReviewSections,
  AnnualReviewSignature,
  InternalControlAuditEntry,
  RosAssessment,
  RosCategory,
  RosRiskRow,
  RosSignature,
  RosSignatureRole,
  RosWorkspaceCategory,
} from '../types/internalControl'
import { isLegacyAnnualReview, isRosDocumentDraft, isRosRiskRowDraft } from '../types/internalControl'
import { O_ROS_PRESET_HAZARDS } from '../types/internalControl'

const STORAGE_KEY = 'atics-internal-control-v1'
const MODULE_KEY = 'internal_control' as const

/** Felter som kan endres på rad selv etter ROS-lås (metadata / arbeidsflyt). */
const ROS_ROW_META_PATCH_KEYS = new Set(['status', 'riskCategory', 'consequenceCategory'])

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
          description: (r as RosAssessment).description,
          rosCategory: (r as RosAssessment).rosCategory ?? 'general',
          workspaceCategory: (r as RosAssessment).workspaceCategory,
          revisionParentId: (r as RosAssessment).revisionParentId,
          revisionVersion: (r as RosAssessment).revisionVersion,
          signatures: (r as RosAssessment).signatures ?? [],
          locked: (r as RosAssessment).locked ?? false,
          rows: Array.isArray(r.rows)
            ? r.rows.map((row: RosRiskRow) => {
                const rawStatus = (row as RosRiskRow).status ?? (row.done ? 'closed' : 'open')
                let status = rawStatus
                if (rawStatus === 'open') status = 'draft'
                if (rawStatus === 'closed') status = 'finished'
                return {
                  ...row,
                  riskCategory: (row as RosRiskRow).riskCategory ?? '',
                  consequenceCategory: (row as RosRiskRow).consequenceCategory ?? '',
                  redResidualJustification: (row as RosRiskRow).redResidualJustification,
                  status,
                }
              })
            : [],
        }))
      : [],
    annualReviews: Array.isArray(p.annualReviews)
      ? p.annualReviews.map((a) => {
          const ar = a as AnnualReview
          const sigs = ar.signatures ?? []
          const hasManager = sigs.some((s) => s.role === 'manager')
          const hasSafety = sigs.some((s) => s.role === 'safety_rep')
          const legacy = isLegacyAnnualReview(ar)
          let status = ar.status
          let locked = ar.locked
          if (legacy) {
            status = status ?? 'locked'
            locked = locked ?? true
          } else if (hasSafety) {
            status = 'locked'
            locked = true
          } else if (hasManager) {
            status = status ?? 'pending_safety_rep'
            locked = false
          } else {
            status = status ?? 'draft'
            locked = locked ?? false
          }
          return {
            ...ar,
            actionPlanDrafts: ar.actionPlanDrafts ?? [],
            signatures: sigs,
            status,
            locked,
          }
        })
      : [],
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
        status: 'draft' as const,
        riskCategory: '',
        consequenceCategory: '',
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
    summary: '',
    nextReviewDue: `${new Date().getFullYear() + 1}-12-31`,
    status: 'locked',
    locked: true,
    sections: {
      goalsLastYearAchieved: 'yes',
      goalsLastYearComment: 'Hovedmål om vernerunder er nådd.',
      deviationsReview: 'Rapporteringskultur god; åpne avvik følges opp i oppgavelisten.',
      rosReview: 'ROS er revidert for hovedprosesser.',
      sickLeaveReview: 'Fravær innenfor forventning; oppfølging etter rutine.',
      goalsNextYear: 'Fullføre digitale vernerunder i alle avdelinger.',
    },
    actionPlanDrafts: [],
    signatures: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
        description?: string
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
        description: opts?.description?.trim() || undefined,
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
          if (ros.id !== rosId) return ros
          const patchKeys = Object.keys(patch)
          const allowWhenLocked =
            ros.locked && patchKeys.length > 0 && patchKeys.every((k) => ROS_ROW_META_PATCH_KEYS.has(k))
          if (ros.locked && !allowWhenLocked) return ros
          const rows = ros.rows.map((row) => {
            if (row.id !== rowId) return row
            if (!ros.locked && !isRosRiskRowDraft(row)) {
              const onlyMeta = patchKeys.length > 0 && patchKeys.every((k) => ROS_ROW_META_PATCH_KEYS.has(k))
              if (!onlyMeta) return row
            }
            const next = { ...row, ...patch }
            if (patch.severity != null || patch.likelihood != null) {
              next.riskScore = computeRiskScore(next.severity, next.likelihood)
            }
            const rs = next.residualSeverity
            const rl = next.residualLikelihood
            if (rs != null && rl != null && !Number.isNaN(rs) && !Number.isNaN(rl)) {
              next.residualScore = computeRiskScore(rs, rl)
            } else {
              next.residualScore = undefined
            }
            return next
          })
          return { ...ros, rows, updatedAt: new Date().toISOString() }
        }),
      }))
    },
    [setState],
  )

  const updateRosAssessment = useCallback(
    (rosId: string, patch: Partial<Pick<RosAssessment, 'title' | 'description' | 'department' | 'assessor' | 'assessedAt' | 'workspaceCategory' | 'rosCategory'>>) => {
      setState((s) => ({
        ...s,
        rosAssessments: s.rosAssessments.map((ros) => {
          if (ros.id !== rosId) return ros
          if (!isRosDocumentDraft(ros)) return ros
          const next = { ...ros, ...patch, updatedAt: new Date().toISOString() }
          if (patch.title != null) next.title = patch.title.trim()
          if (patch.department != null) next.department = patch.department.trim()
          if (patch.assessor != null) next.assessor = patch.assessor.trim()
          if (patch.description !== undefined) {
            const d = patch.description.trim()
            next.description = d || undefined
          }
          return next
        }),
      }))
    },
    [setState],
  )

  const deleteRosAssessment = useCallback(
    (rosId: string) => {
      setState((s) => {
        const target = s.rosAssessments.find((x) => x.id === rosId)
        if (!target || !isRosDocumentDraft(target)) return s
        return {
          ...s,
          rosAssessments: s.rosAssessments.filter((r) => r.id !== rosId),
          auditTrail: [...s.auditTrail, audit('ros_deleted', `ROS slettet: ${target.title}`, { rosId })],
        }
      })
    },
    [setState],
  )

  const removeRosRow = useCallback(
    (rosId: string, rowId: string) => {
      setState((s) => ({
        ...s,
        rosAssessments: s.rosAssessments.map((ros) => {
          if (ros.id !== rosId || ros.locked) return ros
          const row = ros.rows.find((r) => r.id === rowId)
          if (!row || !isRosRiskRowDraft(row)) return ros
          if (ros.rows.length <= 1) return ros
          return {
            ...ros,
            rows: ros.rows.filter((r) => r.id !== rowId),
            updatedAt: new Date().toISOString(),
          }
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
    (lockedSourceId: string): string | null => {
      let newId: string | null = null
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
        const copyId = crypto.randomUUID()
        newId = copyId
        const copy: RosAssessment = {
          ...src,
          id: copyId,
          title: `${src.title.replace(/\s*\(revisjon v\d+\)\s*$/i, '').trim()} (revisjon v${nextVersion})`,
          description: src.description,
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
      return newId
    },
    [setState],
  )

  const addRosRow = useCallback(
    (rosId: string) => {
      setState((s) => ({
        ...s,
        rosAssessments: s.rosAssessments.map((ros) => {
          if (ros.id !== rosId || ros.locked || !isRosDocumentDraft(ros)) return ros
          return { ...ros, rows: [...ros.rows, emptyRosRow()], updatedAt: new Date().toISOString() }
        }),
      }))
    },
    [setState],
  )

  const addAnnualReview = useCallback(
    (input: Omit<AnnualReview, 'id'>) => {
      const now = new Date().toISOString()
      const a: AnnualReview = {
        ...input,
        id: crypto.randomUUID(),
        status: input.status ?? (isLegacyAnnualReview(input as AnnualReview) ? 'locked' : 'draft'),
        locked: input.locked ?? isLegacyAnnualReview(input as AnnualReview),
        actionPlanDrafts: input.actionPlanDrafts ?? [],
        signatures: input.signatures ?? [],
        createdAt: now,
        updatedAt: now,
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

  const upsertAnnualReview = useCallback(
    (partial: Partial<AnnualReview> & Pick<AnnualReview, 'id'>) => {
      const now = new Date().toISOString()
      setState((s) => {
        const exists = s.annualReviews.some((x) => x.id === partial.id)
        if (exists) {
          return {
            ...s,
            annualReviews: s.annualReviews.map((x) =>
              x.id === partial.id ? { ...x, ...partial, updatedAt: now } : x,
            ),
            auditTrail: [...s.auditTrail, audit('annual_review', 'Årsgjennomgang oppdatert (utkast).', { annualId: partial.id })],
          }
        }
        const a: AnnualReview = {
          year: partial.year ?? new Date().getFullYear(),
          reviewedAt: partial.reviewedAt ?? now.slice(0, 10),
          reviewer: partial.reviewer ?? '',
          summary: partial.summary ?? '',
          nextReviewDue: partial.nextReviewDue ?? '',
          sections: partial.sections,
          actionPlanDrafts: partial.actionPlanDrafts ?? [],
          signatures: partial.signatures ?? [],
          status: partial.status ?? 'draft',
          locked: partial.locked ?? false,
          id: partial.id,
          createdAt: partial.createdAt ?? now,
          updatedAt: now,
        }
        return {
          ...s,
          annualReviews: [a, ...s.annualReviews],
          auditTrail: [...s.auditTrail, audit('annual_review', `Årsgjennomgang ${a.year} opprettet.`, { year: a.year })],
        }
      })
    },
    [setState],
  )

  function annualReviewCompletePayload(a: AnnualReview) {
    return {
      kind: 'annual_review' as const,
      id: a.id,
      year: a.year,
      reviewedAt: a.reviewedAt,
      nextReviewDue: a.nextReviewDue,
      reviewer: a.reviewer,
      sections: a.sections ?? null,
      summaryLegacy: a.summary || null,
      actionPlanDrafts: (a.actionPlanDrafts ?? []).map((d) => ({
        title: d.title,
        description: d.description,
        assignee: d.assignee,
        dueDate: d.dueDate,
      })),
      signatures: (a.signatures ?? []).map((s) => ({
        role: s.role,
        signerName: s.signerName,
        signedAt: s.signedAt,
      })),
      status: a.status ?? 'draft',
      locked: a.locked ?? false,
    }
  }

  function validateAnnualSections(sec: AnnualReviewSections | undefined): string | null {
    if (!sec) return 'Strukturerte felt mangler.'
    if (sec.goalsLastYearAchieved !== 'yes' && sec.goalsLastYearAchieved !== 'no') {
      return 'Velg om fjorårets HMS-mål ble nådd (Ja/Nei).'
    }
    const minLen = 15
    const check = (v: string, label: string) => (v.trim().length < minLen ? `${label} må ha minst ${minLen} tegn.` : null)
    return (
      check(sec.goalsLastYearComment, 'Kommentar til fjorårets mål') ||
      check(sec.deviationsReview, 'Vurdering av avvik') ||
      check(sec.rosReview, 'Vurdering av ROS') ||
      check(sec.sickLeaveReview, 'Vurdering av sykefravær') ||
      check(sec.goalsNextYear, 'Nye HMS-mål')
    )
  }

  const signAnnualReviewManager = useCallback(
    async (
      reviewId: string,
      opts: {
        signerName: string
        signerUserId?: string
        reviewerDisplay: string
        sections: AnnualReviewSections
        nextReviewDue: string
        year: number
        reviewedAt: string
        actionPlanDrafts: AnnualReviewActionDraft[]
        onCreateTasks?: (drafts: AnnualReviewActionDraft[]) => void
      },
    ) => {
      const v = validateAnnualSections(opts.sections)
      if (v) {
        setError(v)
        return false
      }
      const target = state.annualReviews.find((x) => x.id === reviewId)
      if (!target || target.locked || target.signatures?.some((s) => s.role === 'manager')) {
        setError('Kan ikke signere: ugyldig tilstand.')
        return false
      }
      if (isLegacyAnnualReview(target)) {
        setError('Eldre årsgjennomgang uten nye felt kan ikke signeres i det nye flyten — opprett ny.')
        return false
      }
      setError(null)
      const signedAt = new Date().toISOString()
      const nextRev: AnnualReview = {
        ...target,
        year: opts.year,
        reviewedAt: opts.reviewedAt,
        reviewer: opts.reviewerDisplay.trim() || target.reviewer,
        nextReviewDue: opts.nextReviewDue,
        sections: opts.sections,
        actionPlanDrafts: [],
        signatures: [...(target.signatures ?? [])],
        status: 'pending_safety_rep',
        locked: false,
        updatedAt: signedAt,
      }
      const sigPreview: AnnualReviewSignature = {
        role: 'manager',
        signerName: opts.signerName.trim(),
        signerUserId: opts.signerUserId,
        signedAt,
      }
      const withManager = {
        ...nextRev,
        signatures: [...(nextRev.signatures ?? []), sigPreview],
      }
      const documentHashSha256 = await hashDocumentPayload(annualReviewCompletePayload(withManager))
      let level1: AnnualReviewSignature['level1'] | undefined
      if (useRemote && supabase && orgId && userId) {
        const clientIp = await fetchClientIpBestEffort()
        const ins = await insertSystemSignatureEvent(supabase, orgId, userId, {
          resourceType: 'annual_review',
          resourceId: reviewId,
          action: 'annual_review_sign_manager',
          documentHashSha256,
          signerDisplayName: opts.signerName.trim(),
          role: 'manager',
          clientIp,
        })
        if ('error' in ins) {
          setError(ins.error)
          return false
        }
        level1 = ins.evidence
      }
      const sig: AnnualReviewSignature = { ...sigPreview, level1 }
      if (opts.onCreateTasks && opts.actionPlanDrafts.length > 0) {
        opts.onCreateTasks(opts.actionPlanDrafts)
      }
      setState((s) => ({
        ...s,
        annualReviews: s.annualReviews.map((x) =>
          x.id === reviewId
            ? {
                ...x,
                year: opts.year,
                reviewedAt: opts.reviewedAt,
                reviewer: opts.reviewerDisplay.trim() || x.reviewer,
                nextReviewDue: opts.nextReviewDue,
                sections: opts.sections,
                actionPlanDrafts: [],
                signatures: [...(x.signatures ?? []).filter((z) => z.role !== 'manager'), sig],
                status: 'pending_safety_rep',
                locked: false,
                updatedAt: signedAt,
              }
            : x,
        ),
        auditTrail: [
          ...s.auditTrail,
          audit('annual_review_signed_manager', `Årsgjennomgang ${opts.year}: leder signert, venter verneombud/AMU.`, {
            annualId: reviewId,
          }),
        ],
      }))
      return true
    },
    [setState, setError, state.annualReviews, useRemote, supabase, orgId, userId],
  )

  const signAnnualReviewSafetyRep = useCallback(
    async (reviewId: string, opts: { signerName: string; signerUserId?: string }) => {
      const target = state.annualReviews.find((x) => x.id === reviewId)
      if (!target || target.locked || target.status !== 'pending_safety_rep') {
        setError('Kan ikke godkjenne: dokumentet er ikke i «venter verneombud»-status.')
        return false
      }
      if (target.signatures?.some((s) => s.role === 'safety_rep')) {
        setError('Allerede godkjent av verneombud.')
        return false
      }
      if (!target.signatures?.some((s) => s.role === 'manager')) {
        setError('Leder må signere først.')
        return false
      }
      setError(null)
      const signedAt = new Date().toISOString()
      const sigPreview: AnnualReviewSignature = {
        role: 'safety_rep',
        signerName: opts.signerName.trim(),
        signerUserId: opts.signerUserId,
        signedAt,
      }
      const withBoth = {
        ...target,
        signatures: [...(target.signatures ?? []), sigPreview],
        status: 'locked' as const,
        locked: true,
        updatedAt: signedAt,
      }
      const documentHashSha256 = await hashDocumentPayload(annualReviewCompletePayload(withBoth))
      let level1: AnnualReviewSignature['level1'] | undefined
      if (useRemote && supabase && orgId && userId) {
        const clientIp = await fetchClientIpBestEffort()
        const ins = await insertSystemSignatureEvent(supabase, orgId, userId, {
          resourceType: 'annual_review',
          resourceId: reviewId,
          action: 'annual_review_sign_safety_rep',
          documentHashSha256,
          signerDisplayName: opts.signerName.trim(),
          role: 'safety_rep',
          clientIp,
        })
        if ('error' in ins) {
          setError(ins.error)
          return false
        }
        level1 = ins.evidence
      }
      const sig: AnnualReviewSignature = { ...sigPreview, level1 }
      setState((s) => ({
        ...s,
        annualReviews: s.annualReviews.map((x) =>
          x.id === reviewId
            ? {
                ...x,
                signatures: [...(x.signatures ?? []).filter((z) => z.role !== 'safety_rep'), sig],
                status: 'locked',
                locked: true,
                updatedAt: signedAt,
              }
            : x,
        ),
        auditTrail: [
          ...s.auditTrail,
          audit('annual_review_locked', `Årsgjennomgang ${target.year} endelig godkjent (verneombud).`, {
            annualId: reviewId,
          }),
        ],
      }))
      return true
    },
    [setState, setError, state.annualReviews, useRemote, supabase, orgId, userId],
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
    updateRosAssessment,
    deleteRosAssessment,
    updateRosRow,
    removeRosRow,
    addRosRow,
    signRos,
    duplicateRosRevision,
    addAnnualReview,
    upsertAnnualReview,
    signAnnualReviewManager,
    signAnnualReviewSafetyRep,
    resetDemo,
  }
}
