import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LABOR_METRIC_DEFINITIONS } from '../data/orgHealthMetrics'
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
  AmlReportKind,
  AnonymousAmlReport,
  LaborMetricEntry,
  NavSickLeaveReport,
  OrgHealthAuditEntry,
  OrgHealthAuditAction,
  Survey,
  SurveyQuestion,
  SurveyResponse,
} from '../types/orgHealth'

const STORAGE_KEY = 'atics-org-health-v2'
const LEGACY_KEY = 'atics-org-health-v1'
const MODULE_KEY = 'org_health' as const
const PERSIST_DEBOUNCE_MS = 450

/** Gjennomsnitt per respondent (snitt av psykologisk trygghet-spørsmål), deretter snitt av respondentene */
function psychSafetySummaryForSurvey(survey: Survey, responses: SurveyResponse[]): { mean: number | null; n: number } {
  const qIds = survey.questions
    .filter((q) => {
      const sub = (q.subscale ?? '').toLowerCase()
      return sub.includes('psykologisk') && sub.includes('trygg')
    })
    .map((q) => q.id)
  if (!qIds.length) return { mean: null, n: 0 }
  const rel = responses.filter((r) => r.surveyId === survey.id)
  const perResp: number[] = []
  for (const r of rel) {
    let s = 0
    let c = 0
    for (const qid of qIds) {
      const v = r.answers[qid]
      if (typeof v === 'number' && !Number.isNaN(v)) {
        s += v
        c += 1
      }
    }
    if (c > 0) perResp.push(s / c)
  }
  if (!perResp.length) return { mean: null, n: 0 }
  const mean = perResp.reduce((a, b) => a + b, 0) / perResp.length
  return { mean, n: perResp.length }
}

export type SurveyCloseSideEffect =
  | {
      kind: 'low_psychological_safety'
      surveyId: string
      surveyTitle: string
      targetLabel?: string
      responseCount: number
      psychSafetyMean: number
    }

type OrgHealthState = {
  surveys: Survey[]
  responses: SurveyResponse[]
  navReports: NavSickLeaveReport[]
  laborMetrics: LaborMetricEntry[]
  auditTrail: OrgHealthAuditEntry[]
  responseTokens: Record<string, string[]>
  anonymousAmlReports: AnonymousAmlReport[]
}

function auditEntry(
  action: OrgHealthAuditAction,
  message: string,
  meta?: Record<string, string | number | boolean>,
): OrgHealthAuditEntry {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    action,
    message,
    meta,
  }
}

const defaultQuestions: SurveyQuestion[] = [
  {
    id: 'q1',
    text: 'Hvordan vurderer du det psykososiale miljøet på arbeidsplassen?',
    type: 'likert_5',
    required: true,
  },
  {
    id: 'q2',
    text: 'Opplever du at du kan si fra om arbeidsmiljøproblemer uten negative konsekvenser?',
    type: 'likert_5',
    required: true,
  },
  {
    id: 'q3',
    text: 'Har du forslag til forbedring av arbeidsmiljøet?',
    type: 'text',
    required: false,
  },
]

const seedSurvey: Survey = {
  id: 'sv-seed',
  title: 'Arbeidsmiljøpulse 2026',
  description: 'Kort undersøkelse — svarene brukes til å prioritere tiltak.',
  anonymous: true,
  status: 'open',
  questions: defaultQuestions,
  createdAt: new Date().toISOString(),
  openedAt: new Date().toISOString(),
}

const seedNav: NavSickLeaveReport[] = [
  {
    id: 'nav1',
    periodLabel: 'Januar 2026',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    sickLeavePercent: 4.2,
    selfCertifiedDays: 42,
    documentedSickDays: 28,
    employeeCount: 120,
    notes: 'Importert fra NAV A-melding / egen rapport (eksempel).',
    sourceNote: 'Manuell registrering — koble til faktisk NAV-eksport i produksjon.',
    createdAt: new Date().toISOString(),
  },
]

function normalizeParsed(p: OrgHealthState): OrgHealthState {
  return {
    surveys: Array.isArray(p.surveys) ? p.surveys : [],
    responses: Array.isArray(p.responses) ? p.responses : [],
    navReports: Array.isArray(p.navReports) ? p.navReports : [],
    laborMetrics: Array.isArray(p.laborMetrics) ? p.laborMetrics : [],
    auditTrail: Array.isArray(p.auditTrail) ? p.auditTrail : [],
    responseTokens: p.responseTokens && typeof p.responseTokens === 'object' ? p.responseTokens : {},
    anonymousAmlReports: Array.isArray(p.anonymousAmlReports) ? p.anonymousAmlReports : [],
  }
}

function migrateLegacy(parsed: Record<string, unknown>): OrgHealthState {
  return normalizeParsed({
    surveys: Array.isArray(parsed.surveys) && (parsed.surveys as unknown[]).length ? (parsed.surveys as Survey[]) : [seedSurvey],
    responses: Array.isArray(parsed.responses) ? (parsed.responses as SurveyResponse[]) : [],
    navReports: Array.isArray(parsed.navReports) ? (parsed.navReports as NavSickLeaveReport[]) : seedNav,
    laborMetrics: Array.isArray(parsed.laborMetrics) ? (parsed.laborMetrics as LaborMetricEntry[]) : [],
    auditTrail: Array.isArray(parsed.auditTrail) ? (parsed.auditTrail as OrgHealthAuditEntry[]) : [],
    responseTokens:
      parsed.responseTokens && typeof parsed.responseTokens === 'object'
        ? (parsed.responseTokens as Record<string, string[]>)
        : {},
    anonymousAmlReports: [],
  })
}

function seedDemoLocal(): OrgHealthState {
  return {
    surveys: [seedSurvey],
    responses: [],
    navReports: seedNav,
    laborMetrics: [],
    auditTrail: [
      auditEntry('survey_created', 'Organisasjonshelse-modul initialisert med eksempelundersøkelse.', {
        demo: true,
      }),
    ],
    responseTokens: {},
    anonymousAmlReports: [],
  }
}

function emptyRemoteState(): OrgHealthState {
  return {
    surveys: [],
    responses: [],
    navReports: [],
    laborMetrics: [],
    auditTrail: [],
    responseTokens: {},
    anonymousAmlReports: [],
  }
}

function loadLocal(): OrgHealthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const legacyRaw = localStorage.getItem(LEGACY_KEY)
      if (legacyRaw) {
        try {
          const parsed = JSON.parse(legacyRaw) as Record<string, unknown>
          const migrated = migrateLegacy(parsed)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
          return migrated
        } catch {
          /* fall through */
        }
      }
      return seedDemoLocal()
    }
    const p = JSON.parse(raw) as OrgHealthState
    const n = normalizeParsed(p)
    return {
      ...n,
      surveys: n.surveys.length ? n.surveys : [seedSurvey],
      navReports: n.navReports.length ? n.navReports : seedNav,
    }
  } catch {
    return seedDemoLocal()
  }
}

function saveLocal(state: OrgHealthState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function getResponseToken(orgScopedKey: string | null) {
  const k = orgScopedKey ? `atics-orghealth-responder:${orgScopedKey}` : 'atics-orghealth-responder'
  let t = sessionStorage.getItem(k)
  if (!t) {
    t = crypto.randomUUID()
    sessionStorage.setItem(k, t)
  }
  return t
}

function computeNextRun(schedule: import('../types/orgHealth').SurveySchedule, from: string): string {
  const base = new Date(from)
  switch (schedule.kind) {
    case 'once':
      return schedule.startsAt
    case 'weekly': {
      const d = new Date(base)
      d.setDate(d.getDate() + 7 * (schedule.intervalN ?? 1))
      return d.toISOString()
    }
    case 'monthly': {
      const d = new Date(base)
      d.setMonth(d.getMonth() + (schedule.intervalN ?? 1))
      return d.toISOString()
    }
    case 'quarterly': {
      const d = new Date(base)
      d.setMonth(d.getMonth() + 3)
      return d.toISOString()
    }
    case 'yearly': {
      const d = new Date(base)
      d.setFullYear(d.getFullYear() + 1)
      return d.toISOString()
    }
    case 'custom': {
      const d = new Date(base)
      d.setDate(d.getDate() + (schedule.intervalN ?? 30))
      return d.toISOString()
    }
    default:
      return base.toISOString()
  }
}

export function useOrgHealth() {
  const { supabase, organization, user } = useOrgSetupContext()
  const orgId = organization?.id
  const userId = user?.id
  const useRemote = !!(supabase && orgId && userId)
  const responseTokenScope = useRemote ? orgId : null

  const initialRemote =
    useRemote && orgId && userId ? readOrgModuleSnap<OrgHealthState>(MODULE_KEY, orgId, userId) : null
  const [localState, setLocalState] = useState<OrgHealthState>(() => loadLocal())
  const [remoteState, setRemoteState] = useState<OrgHealthState>(() => initialRemote ?? emptyRemoteState())
  const [loading, setLoading] = useState(useRemote)
  const [error, setError] = useState<string | null>(null)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const state = useRemote ? remoteState : localState
  const setState = useRemote ? setRemoteState : setLocalState

  const refreshOrgHealth = useCallback(async () => {
    if (!supabase || !orgId || !userId) return
    setLoading(true)
    setError(null)
    try {
      const payload = await fetchOrgModulePayload<OrgHealthState>(supabase, orgId, MODULE_KEY)
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
    void refreshOrgHealth()
  }, [useRemote, refreshOrgHealth])

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

  const appendAudit = useCallback(
    (action: OrgHealthAuditAction, message: string, meta?: Record<string, string | number | boolean>) => {
      setState((s) => ({
        ...s,
        auditTrail: [...s.auditTrail, auditEntry(action, message, meta)],
      }))
    },
    [setState],
  )

  const createSurvey = useCallback(
    (title: string, description: string, anonymous: boolean, useDefaultQuestions: boolean) => {
      const questions: SurveyQuestion[] = useDefaultQuestions
        ? defaultQuestions.map((q) => ({ ...q, id: crypto.randomUUID() }))
        : []
      const s: Survey = {
        id: crypto.randomUUID(),
        title: title.trim(),
        description: description.trim(),
        anonymous,
        status: 'draft',
        questions,
        createdAt: new Date().toISOString(),
      }
      setState((st) => ({ ...st, surveys: [s, ...st.surveys] }))
      appendAudit('survey_created', `Undersøkelse opprettet: «${s.title}»`, {
        anonymous,
        surveyId: s.id,
      })
      return s
    },
    [appendAudit, setState],
  )

  const createSurveyFromTemplate = useCallback(
    (
      templateId: string,
      templateQuestions: SurveyQuestion[],
      title: string,
      description: string,
      anonymous: boolean,
      targetGroupId?: string,
      targetGroupLabel?: string,
    ) => {
      const questions = templateQuestions.map((q) => ({ ...q, id: crypto.randomUUID() }))
      const s: Survey = {
        id: crypto.randomUUID(),
        title: title.trim(),
        description: description.trim(),
        anonymous,
        status: 'draft',
        questions,
        templateId,
        targetGroupId,
        targetGroupLabel,
        createdAt: new Date().toISOString(),
      }
      setState((st) => ({ ...st, surveys: [s, ...st.surveys] }))
      appendAudit('survey_created', `Undersøkelse opprettet fra mal: «${s.title}»`, {
        anonymous,
        surveyId: s.id,
        templateId,
        targetGroupId: targetGroupId ?? '',
      })
      return s
    },
    [appendAudit, setState],
  )

  const updateSurvey = useCallback(
    (id: string, patch: Partial<Survey>) => {
      setState((st) => ({
        ...st,
        surveys: st.surveys.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      }))
    },
    [setState],
  )

  const markSurveyAmuShared = useCallback(
    (surveyId: string) => {
      const at = new Date().toISOString()
      setState((st) => ({
        ...st,
        surveys: st.surveys.map((s) => (s.id === surveyId ? { ...s, amuSharedSummaryAt: at } : s)),
      }))
      appendAudit(
        'survey_amu_summary_exported',
        'Statistisk sammendrag klargjort for AMU (uten rå fritekst).',
        { surveyId },
      )
    },
    [appendAudit, setState],
  )

  const setSchedule = useCallback(
    (surveyId: string, schedule: import('../types/orgHealth').SurveySchedule | undefined) => {
      setState((st) => ({
        ...st,
        surveys: st.surveys.map((sv) =>
          sv.id !== surveyId
            ? sv
            : {
                ...sv,
                schedule: schedule ? { ...schedule, nextRunAt: schedule.startsAt, runCount: 0 } : undefined,
              },
        ),
      }))
      appendAudit(
        'settings_updated',
        schedule ? `Tidsplan satt for undersøkelse: ${schedule.kind}` : 'Tidsplan fjernet fra undersøkelse',
        { surveyId },
      )
    },
    [appendAudit, setState],
  )

  const checkAndTriggerSchedules = useCallback(() => {
    const now = new Date().toISOString()
    setState((st) => {
      let changed = false
      const surveys = st.surveys.map((sv) => {
        const sched = sv.schedule
        if (!sched || !sched.enabled) return sv
        if (!sched.nextRunAt || sched.nextRunAt > now) return sv
        if (sched.endsAt && sched.endsAt < now) {
          changed = true
          return { ...sv, schedule: { ...sched, enabled: false } }
        }
        const isRecurring = sched.kind !== 'once'
        const nextRun = isRecurring ? computeNextRun(sched, sched.nextRunAt) : undefined
        const updatedSchedule = {
          ...sched,
          lastTriggeredAt: now,
          runCount: sched.runCount + 1,
          nextRunAt: nextRun,
          enabled: isRecurring,
        }
        changed = true
        return {
          ...sv,
          status: 'open' as const,
          openedAt: now,
          closedAt: undefined,
          schedule: updatedSchedule,
        }
      })
      return changed ? { ...st, surveys } : st
    })
  }, [setState])

  const addQuestion = useCallback(
    (surveyId: string, text: string, type: SurveyQuestion['type'], required: boolean) => {
      const q: SurveyQuestion = {
        id: crypto.randomUUID(),
        text: text.trim(),
        type,
        required,
      }
      if (!q.text) return
      setState((s) => ({
        ...s,
        surveys: s.surveys.map((sv) => (sv.id === surveyId ? { ...sv, questions: [...sv.questions, q] } : sv)),
      }))
    },
    [setState],
  )

  const openSurvey = useCallback(
    (surveyId: string) => {
      setState((s) => ({
        ...s,
        surveys: s.surveys.map((sv) =>
          sv.id === surveyId ? { ...sv, status: 'open' as const, openedAt: new Date().toISOString() } : sv,
        ),
        responseTokens: { ...s.responseTokens, [surveyId]: s.responseTokens[surveyId] ?? [] },
      }))
      appendAudit('survey_opened', 'Undersøkelse åpnet for svar.', { surveyId })
    },
    [appendAudit, setState],
  )

  const closeSurvey = useCallback(
    (
      surveyId: string,
      opts?: {
        onLowPsychSafety?: (ev: SurveyCloseSideEffect) => void
      },
    ) => {
      const lowSafetyHolder: { current: SurveyCloseSideEffect | null } = { current: null }
      setState((s) => {
        const sv = s.surveys.find((x) => x.id === surveyId)
        if (!sv) return s
        const closedAt = new Date().toISOString()
        const responses = s.responses.filter((r) => r.surveyId === surveyId)
        const { mean, n } = psychSafetySummaryForSurvey(sv, responses)
        let nextSv: Survey = { ...sv, status: 'closed' as const, closedAt }
        const triggerLow =
          mean != null &&
          mean < 3 &&
          n >= 5 &&
          !sv.lowPsychSafetyTaskCreatedAt &&
          (sv.templateId === 'tpl-google-rework' ||
            sv.questions.some((q) => (q.subscale ?? '').toLowerCase().includes('psykologisk trygghet')))
        if (triggerLow) {
          nextSv = { ...nextSv, lowPsychSafetyTaskCreatedAt: closedAt }
          lowSafetyHolder.current = {
            kind: 'low_psychological_safety',
            surveyId: sv.id,
            surveyTitle: sv.title,
            targetLabel: sv.targetGroupLabel,
            responseCount: n,
            psychSafetyMean: Math.round(mean * 100) / 100,
          }
        }
        return {
          ...s,
          surveys: s.surveys.map((x) => (x.id === surveyId ? nextSv : x)),
        }
      })
      appendAudit('survey_closed', 'Undersøkelse lukket.', { surveyId })
      const effect = lowSafetyHolder.current
      if (effect) {
        appendAudit(
          'survey_auto_followup_task',
          'Lav score på psykologisk trygghet — oppfølgingsoppgave anbefales (AML § 3-1).',
          {
            surveyId,
            mean: effect.psychSafetyMean,
            n: effect.responseCount,
          },
        )
        if (opts?.onLowPsychSafety) queueMicrotask(() => opts.onLowPsychSafety?.(effect))
      }
    },
    [appendAudit, setState],
  )

  const submitResponse = useCallback(
    (surveyId: string, answers: Record<string, number | string>) => {
      const token = getResponseToken(responseTokenScope)
      let added = false
      let anonymous = false
      setState((s) => {
        const sv = s.surveys.find((x) => x.id === surveyId)
        if (!sv || sv.status !== 'open') return s
        anonymous = sv.anonymous
        const tokens = s.responseTokens[surveyId] ?? []
        if (tokens.includes(token)) return s
        const storedAnswers = { ...answers }
        const anonymousTextProvided: Record<string, boolean> = {}
        if (sv.anonymous) {
          for (const q of sv.questions) {
            if (q.type === 'text') {
              const raw = answers[q.id]
              anonymousTextProvided[q.id] = typeof raw === 'string' && raw.trim().length > 0
              delete storedAnswers[q.id]
            }
          }
        }
        const r: SurveyResponse = {
          id: crypto.randomUUID(),
          surveyId,
          answers: storedAnswers,
          anonymousTextProvided: sv.anonymous ? anonymousTextProvided : undefined,
          submittedAt: new Date().toISOString(),
          responseToken: token,
        }
        added = true
        return {
          ...s,
          responses: [...s.responses, r],
          responseTokens: { ...s.responseTokens, [surveyId]: [...tokens, token] },
        }
      })
      if (added) {
        appendAudit('response_submitted', 'Svar registrert (aggregert i rapporter).', {
          surveyId,
          anonymous,
        })
      }
      return added
    },
    [appendAudit, setState, responseTokenScope],
  )

  const addNavReport = useCallback(
    (partial: Omit<NavSickLeaveReport, 'id' | 'createdAt'>) => {
      const r: NavSickLeaveReport = {
        ...partial,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      }
      setState((s) => ({ ...s, navReports: [r, ...s.navReports] }))
      appendAudit('nav_report_added', `NAV/sykefravær registrert for ${r.periodLabel}.`, {
        period: r.periodLabel,
      })
    },
    [appendAudit, setState],
  )

  const addLaborMetric = useCallback(
    (partial: Omit<LaborMetricEntry, 'id' | 'createdAt'>) => {
      const e: LaborMetricEntry = {
        ...partial,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      }
      setState((s) => ({ ...s, laborMetrics: [e, ...s.laborMetrics] }))
      appendAudit('labor_metric_added', `Indikator registrert: ${partial.metricKey}`, {
        metricKey: partial.metricKey,
      })
    },
    [appendAudit, setState],
  )

  const aggregates = useMemo(() => {
    const bySurvey: Record<
      string,
      {
        count: number
        likertMeans: Record<string, number>
        subscaleMeans: Record<string, number>
        textSamples: Record<string, string[]>
        anonymousTextCount: Record<string, number>
      }
    > = {}

    for (const r of state.responses) {
      const sv = state.surveys.find((s) => s.id === r.surveyId)
      if (!bySurvey[r.surveyId]) {
        bySurvey[r.surveyId] = {
          count: 0,
          likertMeans: {},
          subscaleMeans: {},
          textSamples: {},
          anonymousTextCount: {},
        }
      }
      const agg = bySurvey[r.surveyId]
      agg.count += 1
      for (const q of sv?.questions ?? []) {
        const v = r.answers[q.id]
        const isLikert = q.type === 'likert_5' || q.type === 'likert_7' || q.type === 'scale_10'
        if (isLikert && typeof v === 'number') {
          if (agg.likertMeans[q.id] === undefined) agg.likertMeans[q.id] = 0
          agg.likertMeans[q.id] += v
        }
        if (q.type === 'text') {
          if (sv?.anonymous) {
            const had = r.anonymousTextProvided?.[q.id] === true
            if (had) {
              agg.anonymousTextCount[q.id] = (agg.anonymousTextCount[q.id] ?? 0) + 1
            }
          } else if (typeof v === 'string' && v.trim()) {
            if (!agg.textSamples[q.id]) agg.textSamples[q.id] = []
            agg.textSamples[q.id].push(v.trim())
          }
        }
      }
    }

    for (const sid of Object.keys(bySurvey)) {
      const sv = state.surveys.find((s) => s.id === sid)
      const agg = bySurvey[sid]
      for (const q of sv?.questions ?? []) {
        const isLikert = q.type === 'likert_5' || q.type === 'likert_7' || q.type === 'scale_10'
        if (isLikert && agg.likertMeans[q.id] !== undefined && agg.count > 0) {
          agg.likertMeans[q.id] = Math.round((agg.likertMeans[q.id] / agg.count) * 100) / 100
        }
      }
      const subSums: Record<string, number> = {}
      const subCounts: Record<string, number> = {}
      for (const q of sv?.questions ?? []) {
        const isLikert = q.type === 'likert_5' || q.type === 'likert_7' || q.type === 'scale_10'
        const sub = q.subscale?.trim()
        if (!sub || !isLikert) continue
        const m = agg.likertMeans[q.id]
        if (m === undefined) continue
        subSums[sub] = (subSums[sub] ?? 0) + m
        subCounts[sub] = (subCounts[sub] ?? 0) + 1
      }
      for (const sub of Object.keys(subSums)) {
        const c = subCounts[sub] ?? 1
        agg.subscaleMeans[sub] = Math.round((subSums[sub] / c) * 100) / 100
      }
    }

    return bySurvey
  }, [state.responses, state.surveys])

  const navSummary = useMemo(() => {
    const reports = state.navReports
    if (!reports.length) return { latestPercent: null as number | null, avgPercent: null as number | null }
    const withPct = reports.filter((r) => r.sickLeavePercent != null)
    const latest = withPct[0]?.sickLeavePercent ?? null
    const avg =
      withPct.length > 0
        ? Math.round((withPct.reduce((a, b) => a + (b.sickLeavePercent ?? 0), 0) / withPct.length) * 100) / 100
        : null
    return { latestPercent: latest, avgPercent: avg }
  }, [state.navReports])

  const resetDemo = useCallback(async () => {
    const next: OrgHealthState = {
      surveys: [seedSurvey],
      responses: [],
      navReports: seedNav,
      laborMetrics: [],
      auditTrail: [auditEntry('survey_created', 'Demodata tilbakestilt.')],
      responseTokens: {},
      anonymousAmlReports: [],
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
    setLocalState(next)
    saveLocal(next)
  }, [useRemote, supabase, orgId, userId])

  /** Anonym AML ligger nå under arbeidsplassrapportering — beholdes som no-op for eldre kall. */
  const submitAnonymousAmlReport = useCallback(
    (_kind: AmlReportKind, _options: { detailsIndicated: boolean; urgency: AnonymousAmlReport['urgency'] }): boolean => {
      void _kind
      void _options
      return false
    },
    [],
  )

  const { anonymousAmlReports: _unusedLegacyAml, ...restState } = state
  void _unusedLegacyAml

  return {
    ...restState,
    aggregates,
    navSummary,
    loading: useRemote ? loading : false,
    error: useRemote ? error : null,
    backend: useRemote ? ('supabase' as const) : ('local' as const),
    createSurvey,
    createSurveyFromTemplate,
    updateSurvey,
    addQuestion,
    openSurvey,
    closeSurvey,
    setSchedule,
    checkAndTriggerSchedules,
    submitResponse,
    addNavReport,
    addLaborMetric,
    submitAnonymousAmlReport,
    resetDemo,
    markSurveyAmuShared,
    metricDefinitions: LABOR_METRIC_DEFINITIONS,
  }
}
