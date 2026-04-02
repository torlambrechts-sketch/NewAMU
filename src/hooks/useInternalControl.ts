import { useCallback, useEffect, useMemo, useState } from 'react'
import { computeRiskScore, emptyRosRow } from '../data/rosTemplate'
import type { AmlReportKind } from '../types/orgHealth'
import type {
  AnnualReview,
  InternalControlAuditEntry,
  RosAssessment,
  RosRiskRow,
  WhistleCase,
  WhistleCaseStatus,
} from '../types/internalControl'

const STORAGE_KEY = 'atics-internal-control-v1'

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

function load(): InternalControlState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
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
            done: false,
          },
        ],
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
        auditTrail: [
          audit('init', 'Internkontroll-modul initialisert med demo.', { demo: true }),
        ],
      }
    }
    const p = JSON.parse(raw) as InternalControlState
    return {
      whistleCases: Array.isArray(p.whistleCases) ? p.whistleCases : [],
      rosAssessments: Array.isArray(p.rosAssessments) ? p.rosAssessments : [],
      annualReviews: Array.isArray(p.annualReviews) ? p.annualReviews : [],
      auditTrail: Array.isArray(p.auditTrail) ? p.auditTrail : [],
    }
  } catch {
    return { whistleCases: [], rosAssessments: [], annualReviews: [], auditTrail: [] }
  }
}

function save(s: InternalControlState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

export function useInternalControl() {
  const [state, setState] = useState<InternalControlState>(() => load())

  useEffect(() => {
    save(state)
  }, [state])

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
    [],
  )

  /** Opprett sak fra anonym melding (kobling via ID). */
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
            audit(
              'whistle_from_anonymous',
              'Varslingssak opprettet fra anonym AML-melding.',
              { caseId: c.id, reportId: report.id },
            ),
          ],
        }
      })
      return created
    },
    [],
  )

  const updateWhistleStatus = useCallback((caseId: string, status: WhistleCaseStatus) => {
    setState((s) => {
      const extra =
        status === 'internal_review'
          ? audit(
              'whistle_internal_review',
              'Sak satt til intern revisjon (etter virksomhetens rutine).',
              { caseId },
            )
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
  }, [])

  const sendToInternalReview = useCallback(
    (caseId: string) => {
      updateWhistleStatus(caseId, 'internal_review')
    },
    [updateWhistleStatus],
  )

  const updateWhistleNotes = useCallback((caseId: string, internalNotes: string) => {
    setState((s) => ({
      ...s,
      whistleCases: s.whistleCases.map((c) =>
        c.id === caseId ? { ...c, internalNotes, updatedAt: new Date().toISOString() } : c,
      ),
    }))
  }, [])

  const createRosAssessment = useCallback((title: string, department: string, assessor: string) => {
    const r: RosAssessment = {
      id: crypto.randomUUID(),
      title: title.trim(),
      department: department.trim(),
      assessedAt: new Date().toISOString().slice(0, 10),
      assessor: assessor.trim(),
      rows: [emptyRosRow()],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setState((s) => ({
      ...s,
      rosAssessments: [r, ...s.rosAssessments],
      auditTrail: [...s.auditTrail, audit('ros_created', `ROS opprettet: ${r.title}`, { rosId: r.id })],
    }))
    return r
  }, [])

  const updateRosRow = useCallback((rosId: string, rowId: string, patch: Partial<RosRiskRow>) => {
    setState((s) => ({
      ...s,
      rosAssessments: s.rosAssessments.map((ros) => {
        if (ros.id !== rosId) return ros
        const rows = ros.rows.map((row) => {
          if (row.id !== rowId) return row
          const next = { ...row, ...patch }
          if (patch.severity != null || patch.likelihood != null) {
            next.riskScore = computeRiskScore(next.severity, next.likelihood)
          }
          return next
        })
        return { ...ros, rows, updatedAt: new Date().toISOString() }
      }),
    }))
  }, [])

  const addRosRow = useCallback((rosId: string) => {
    setState((s) => ({
      ...s,
      rosAssessments: s.rosAssessments.map((ros) =>
        ros.id === rosId
          ? { ...ros, rows: [...ros.rows, emptyRosRow()], updatedAt: new Date().toISOString() }
          : ros,
      ),
    }))
  }, [])

  const addAnnualReview = useCallback(
    (input: Omit<AnnualReview, 'id'>) => {
      const a: AnnualReview = {
        ...input,
        id: crypto.randomUUID(),
      }
      setState((s) => ({
        ...s,
        annualReviews: [a, ...s.annualReviews],
        auditTrail: [
          ...s.auditTrail,
          audit('annual_review', `Årsgjennomgang ${a.year} registrert.`, { year: a.year }),
        ],
      }))
      return a
    },
    [],
  )

  const stats = useMemo(() => {
    const w = state.whistleCases
    const whistleByStatus: Record<WhistleCaseStatus, number> = {
      received: 0,
      triage: 0,
      investigation: 0,
      internal_review: 0,
      closed: 0,
    }
    for (const c of w) {
      whistleByStatus[c.status]++
    }
    let rosOpenRiskRows = 0
    for (const ros of state.rosAssessments) {
      for (const row of ros.rows) {
        if (!row.done && row.riskScore >= 6) rosOpenRiskRows++
      }
    }
    const today = new Date().toISOString().slice(0, 10)
    const annualSorted = [...state.annualReviews].sort((a, b) => b.year - a.year)
    const nextAnnualDue = annualSorted[0]?.nextReviewDue ?? null
    const annualOverdue = nextAnnualDue != null && nextAnnualDue < today

    return {
      whistleOpen: w.filter((c) => c.status !== 'closed').length,
      whistleInReview: w.filter((c) => c.status === 'internal_review').length,
      whistleByStatus,
      rosCount: state.rosAssessments.length,
      rosOpenRiskRows,
      annualCount: state.annualReviews.length,
      nextAnnualDue,
      annualOverdue,
    }
  }, [state])

  const resetDemo = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setState(load())
  }, [])

  return {
    ...state,
    stats,
    statusLabels,
    createWhistleCase,
    createCaseFromAnonymousReport,
    updateWhistleStatus,
    sendToInternalReview,
    updateWhistleNotes,
    createRosAssessment,
    updateRosRow,
    addRosRow,
    addAnnualReview,
    resetDemo,
  }
}
