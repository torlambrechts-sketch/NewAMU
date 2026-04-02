import { useCallback, useEffect, useMemo, useState } from 'react'
import { LABOR_METRIC_DEFINITIONS } from '../data/orgHealthMetrics'
import {
  buildEmployeeEngagementQuestions,
  buildNpsPulseQuestions,
  E_INTRO,
  NPS_INTRO,
} from '../data/surveyTemplates'
import {
  buildPsykosocialQuestions,
  PSYKOSOCIAL_SURVEY_INTRO,
} from '../data/psykosocialSurveyTemplate'
import {
  choiceDistribution,
  computeNpsBreakdown,
  type NpsBreakdown,
  surveyFollowUpTaskDescription,
} from '../lib/surveyAnalytics'
import { dimensionMeansForResponses, itemNormalizedMeans } from '../lib/psykosocialAggregate'
import type {
  AmlReportKind,
  AnonymousAmlReport,
  LaborMetricEntry,
  NavSickLeaveReport,
  OrgHealthAuditEntry,
  OrgHealthAuditAction,
  Survey,
  SurveyPurpose,
  SurveyQuestion,
  SurveyResponse,
} from '../types/orgHealth'

const STORAGE_KEY = 'atics-org-health-v2'
const LEGACY_KEY = 'atics-org-health-v1'

type OrgHealthState = {
  surveys: Survey[]
  responses: SurveyResponse[]
  navReports: NavSickLeaveReport[]
  laborMetrics: LaborMetricEntry[]
  auditTrail: OrgHealthAuditEntry[]
  /** surveyId -> response tokens for duplicate prevention */
  responseTokens: Record<string, string[]>
  /** Anonymous AML-aligned reports (no free-text content stored) */
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

const defaultQuestionsGeneral: SurveyQuestion[] = [
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
  title: 'Psykososial kartlegging 2026',
  description: PSYKOSOCIAL_SURVEY_INTRO,
  anonymous: true,
  status: 'open',
  purpose: 'psykosocial_aml',
  questions: buildPsykosocialQuestions(),
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

function inferSurveyPurpose(sv: Survey): SurveyPurpose {
  if (sv.purpose) return sv.purpose
  const hasDim = sv.questions.some((q) => q.dimension != null)
  if (hasDim) return 'psykosocial_aml'
  const hasNps = sv.questions.some((q) => q.type === 'nps_11')
  if (hasNps && sv.questions.length <= 5) return 'nps_pulse'
  return 'general'
}

function normalizeSurvey(sv: Survey): Survey {
  return {
    ...sv,
    purpose: inferSurveyPurpose(sv),
    targetAudienceNote: sv.targetAudienceNote,
    expectedPopulation: sv.expectedPopulation ?? null,
    followUpPlan: sv.followUpPlan,
  }
}

/** Oppgrader gammel seed-undersøkelse til psykososial mal når ingen svar finnes (unngå å knekke eksisterende data). */
function maybeUpgradeSeedSurvey(surveys: Survey[], responses: SurveyResponse[]): Survey[] {
  return surveys.map((s) => {
    if (s.id !== 'sv-seed') return s
    const hasOldShort = s.questions.some((q) => q.id === 'q1' && !q.dimension)
    const hasResponses = responses.some((r) => r.surveyId === 'sv-seed')
    if (hasOldShort && !hasResponses) {
      return {
        ...s,
        title: 'Psykososial kartlegging 2026',
        description: PSYKOSOCIAL_SURVEY_INTRO,
        purpose: 'psykosocial_aml',
        questions: buildPsykosocialQuestions(),
      }
    }
    return s
  })
}

function migrateLegacy(parsed: Record<string, unknown>): OrgHealthState {
  const responses = Array.isArray(parsed.responses) ? (parsed.responses as SurveyResponse[]) : []
  const rawSurveys = Array.isArray(parsed.surveys) && (parsed.surveys as unknown[]).length ? (parsed.surveys as Survey[]) : [seedSurvey]
  const upgraded = maybeUpgradeSeedSurvey(rawSurveys.map((s) => normalizeSurvey(s)), responses)
  return {
    surveys: upgraded,
    responses,
    navReports: Array.isArray(parsed.navReports) ? (parsed.navReports as NavSickLeaveReport[]) : seedNav,
    laborMetrics: Array.isArray(parsed.laborMetrics) ? (parsed.laborMetrics as LaborMetricEntry[]) : [],
    auditTrail: Array.isArray(parsed.auditTrail) ? (parsed.auditTrail as OrgHealthAuditEntry[]) : [],
    responseTokens:
      parsed.responseTokens && typeof parsed.responseTokens === 'object'
        ? (parsed.responseTokens as Record<string, string[]>)
        : {},
    anonymousAmlReports: [],
  }
}

function load(): OrgHealthState {
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
    const p = JSON.parse(raw) as OrgHealthState
    const responses = Array.isArray(p.responses) ? p.responses : []
    const surveysRaw = Array.isArray(p.surveys) && p.surveys.length ? p.surveys.map(normalizeSurvey) : [seedSurvey]
    return {
      surveys: maybeUpgradeSeedSurvey(surveysRaw, responses),
      responses,
      navReports: Array.isArray(p.navReports) ? p.navReports : seedNav,
      laborMetrics: Array.isArray(p.laborMetrics) ? p.laborMetrics : [],
      auditTrail: Array.isArray(p.auditTrail) ? p.auditTrail : [],
      responseTokens: p.responseTokens && typeof p.responseTokens === 'object' ? p.responseTokens : {},
      anonymousAmlReports: Array.isArray(p.anonymousAmlReports) ? p.anonymousAmlReports : [],
    }
  } catch {
    return {
      surveys: [seedSurvey],
      responses: [],
      navReports: seedNav,
      laborMetrics: [],
      auditTrail: [],
      responseTokens: {},
      anonymousAmlReports: [],
    }
  }
}

function save(state: OrgHealthState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function getResponseToken(): string {
  const k = 'atics-orghealth-responder'
  let t = sessionStorage.getItem(k)
  if (!t) {
    t = crypto.randomUUID()
    sessionStorage.setItem(k, t)
  }
  return t
}

export function useOrgHealth() {
  const [state, setState] = useState<OrgHealthState>(() => load())

  useEffect(() => {
    save(state)
  }, [state])

  const appendAudit = useCallback(
    (action: OrgHealthAuditAction, message: string, meta?: Record<string, string | number | boolean>) => {
      setState((s) => ({
        ...s,
        auditTrail: [...s.auditTrail, auditEntry(action, message, meta)],
      }))
    },
    [],
  )

  const createSurvey = useCallback(
    (
      title: string,
      description: string,
      anonymous: boolean,
      template: 'empty' | 'general_short' | 'psykosocial_aml' | 'employee_engagement' | 'nps_pulse',
      planning?: {
        targetAudienceNote?: string
        expectedPopulation?: number | null
        followUpPlan?: string
      },
    ) => {
      let questions: SurveyQuestion[] = []
      let purpose: SurveyPurpose | undefined
      let desc = description.trim()
      if (template === 'general_short') {
        questions = defaultQuestionsGeneral.map((q) => ({ ...q, id: crypto.randomUUID() }))
        purpose = 'general'
      } else if (template === 'psykosocial_aml') {
        questions = buildPsykosocialQuestions()
        purpose = 'psykosocial_aml'
        if (!desc) desc = PSYKOSOCIAL_SURVEY_INTRO
      } else if (template === 'employee_engagement') {
        questions = buildEmployeeEngagementQuestions()
        purpose = 'employee_engagement'
        if (!desc) desc = E_INTRO
      } else if (template === 'nps_pulse') {
        questions = buildNpsPulseQuestions()
        purpose = 'nps_pulse'
        if (!desc) desc = NPS_INTRO
      }
      const s: Survey = {
        id: crypto.randomUUID(),
        title: title.trim(),
        description: desc,
        anonymous,
        status: 'draft',
        purpose,
        questions,
        targetAudienceNote: planning?.targetAudienceNote?.trim() || undefined,
        expectedPopulation:
          planning?.expectedPopulation != null && planning.expectedPopulation > 0
            ? planning.expectedPopulation
            : null,
        followUpPlan: planning?.followUpPlan?.trim() || undefined,
        createdAt: new Date().toISOString(),
      }
      setState((st) => ({ ...st, surveys: [s, ...st.surveys] }))
      appendAudit('survey_created', `Undersøkelse opprettet: «${s.title}»`, {
        anonymous,
        surveyId: s.id,
        purpose: purpose ?? 'empty',
      })
      return s
    },
    [appendAudit],
  )

  const addQuestion = useCallback(
    (
      surveyId: string,
      text: string,
      type: SurveyQuestion['type'],
      required: boolean,
      options?: string[],
    ) => {
      const q: SurveyQuestion = {
        id: crypto.randomUUID(),
        text: text.trim(),
        type,
        required: type === 'section' ? false : required,
        ...(type === 'single_choice' && options?.length ? { options } : {}),
        ...(type === 'nps_11'
          ? {
              npsLowLabel: '0 — ikke sannsynlig',
              npsHighLabel: '10 — svært sannsynlig',
            }
          : {}),
      }
      if (!q.text && type !== 'section') return
      if (type === 'section' && !q.text) return
      setState((s) => ({
        ...s,
        surveys: s.surveys.map((sv) =>
          sv.id === surveyId ? { ...sv, questions: [...sv.questions, q] } : sv,
        ),
      }))
    },
    [],
  )

  const updateSurvey = useCallback(
    (
      surveyId: string,
      patch: Partial<
        Pick<
          Survey,
          | 'title'
          | 'description'
          | 'anonymous'
          | 'targetAudienceNote'
          | 'expectedPopulation'
          | 'followUpPlan'
          | 'questions'
        >
      >,
    ) => {
      setState((s) => {
        const sv = s.surveys.find((x) => x.id === surveyId)
        if (!sv) return s
        const isDraft = sv.status === 'draft'
        const allowed: Partial<Survey> = {}
        if (patch.title != null) allowed.title = patch.title
        if (patch.description != null) allowed.description = patch.description
        if (patch.anonymous != null) allowed.anonymous = patch.anonymous
        if (patch.targetAudienceNote !== undefined) allowed.targetAudienceNote = patch.targetAudienceNote
        if (patch.expectedPopulation !== undefined) allowed.expectedPopulation = patch.expectedPopulation
        if (patch.followUpPlan !== undefined) allowed.followUpPlan = patch.followUpPlan
        if (isDraft && patch.questions != null) allowed.questions = patch.questions
        return {
          ...s,
          surveys: s.surveys.map((x) => (x.id === surveyId ? { ...x, ...allowed } : x)),
        }
      })
      appendAudit('survey_follow_up_updated', 'Undersøkelse oppdatert.', { surveyId })
    },
    [appendAudit],
  )

  const openSurvey = useCallback(
    (surveyId: string) => {
      setState((s) => ({
        ...s,
        surveys: s.surveys.map((sv) =>
          sv.id === surveyId
            ? { ...sv, status: 'open' as const, openedAt: new Date().toISOString() }
            : sv,
        ),
        responseTokens: { ...s.responseTokens, [surveyId]: s.responseTokens[surveyId] ?? [] },
      }))
      appendAudit('survey_opened', 'Undersøkelse åpnet for svar.', { surveyId })
    },
    [appendAudit],
  )

  const closeSurvey = useCallback(
    (surveyId: string) => {
      setState((s) => ({
        ...s,
        surveys: s.surveys.map((sv) =>
          sv.id === surveyId
            ? { ...sv, status: 'closed' as const, closedAt: new Date().toISOString() }
            : sv,
        ),
      }))
      appendAudit('survey_closed', 'Undersøkelse lukket.', { surveyId })
    },
    [appendAudit],
  )

  const submitResponse = useCallback(
    (surveyId: string, answers: Record<string, number | string>) => {
      const token = getResponseToken()
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
              anonymousTextProvided[q.id] =
                typeof raw === 'string' && raw.trim().length > 0
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
    [appendAudit],
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
    [appendAudit],
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
    [appendAudit],
  )

  const aggregates = useMemo(() => {
    const bySurvey: Record<
      string,
      {
        count: number
        likertMeans: Record<string, number>
        /** Normalisert 1–5 der høyere = bedre (snitt av alle svar) */
        likertMeansNormalized?: Record<string, number>
        textSamples: Record<string, string[]>
        anonymousTextCount: Record<string, number>
        dimensionMeans?: Partial<Record<string, number>>
        psykosocialIndex?: number | null
        npsByQuestionId?: Record<string, NpsBreakdown>
        choiceStats?: Record<string, { option: string; count: number; pct: number }[]>
        responseRate?: number | null
      }
    > = {}

    const responsesBySurvey: Record<string, SurveyResponse[]> = {}
    for (const r of state.responses) {
      if (!responsesBySurvey[r.surveyId]) responsesBySurvey[r.surveyId] = []
      responsesBySurvey[r.surveyId].push(r)
    }

    for (const r of state.responses) {
      const sv = state.surveys.find((s) => s.id === r.surveyId)
      if (!bySurvey[r.surveyId]) {
        bySurvey[r.surveyId] = {
          count: 0,
          likertMeans: {},
          textSamples: {},
          anonymousTextCount: {},
        }
      }
      const agg = bySurvey[r.surveyId]
      agg.count += 1
      for (const q of sv?.questions ?? []) {
        if (q.type === 'section') continue
        const v = r.answers[q.id]
        if (q.type === 'likert_5' && typeof v === 'number') {
          if (!agg.likertMeans[q.id]) {
            agg.likertMeans[q.id] = 0
          }
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
        if (q.type === 'likert_5' && agg.likertMeans[q.id] !== undefined && agg.count > 0) {
          agg.likertMeans[q.id] = Math.round((agg.likertMeans[q.id] / agg.count) * 100) / 100
        }
      }
      const list = responsesBySurvey[sid] ?? []
      if (sv && list.length > 0) {
        agg.likertMeansNormalized = itemNormalizedMeans(sv, list)
        const dm = dimensionMeansForResponses(sv, list)
        if (Object.keys(dm.dimensionMeans).length > 0) {
          agg.dimensionMeans = dm.dimensionMeans as Record<string, number>
          agg.psykosocialIndex = dm.psykosocialIndex
        }
        const npsByQuestionId: Record<string, NpsBreakdown> = {}
        for (const q of sv.questions) {
          if (q.type === 'nps_11') {
            npsByQuestionId[q.id] = computeNpsBreakdown(q.id, list)
          }
        }
        if (Object.keys(npsByQuestionId).length > 0) {
          ;(agg as { npsByQuestionId?: typeof npsByQuestionId }).npsByQuestionId = npsByQuestionId
        }
        const choices: Record<string, { option: string; count: number; pct: number }[]> = {}
        for (const q of sv.questions) {
          if (q.type === 'single_choice' && q.options?.length) {
            choices[q.id] = choiceDistribution(q.id, q.options, list)
          }
        }
        if (Object.keys(choices).length > 0) {
          ;(agg as { choiceStats?: typeof choices }).choiceStats = choices
        }
        const exp = sv.expectedPopulation
        if (typeof exp === 'number' && exp > 0) {
          ;(agg as { responseRate?: number | null }).responseRate = Math.round((agg.count / exp) * 1000) / 10
        }
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
        ? Math.round(
            (withPct.reduce((a, b) => a + (b.sickLeavePercent ?? 0), 0) / withPct.length) * 100,
          ) / 100
        : null
    return { latestPercent: latest, avgPercent: avg }
  }, [state.navReports])

  const resetDemo = useCallback(() => {
    const next: OrgHealthState = {
      surveys: [seedSurvey],
      responses: [],
      navReports: seedNav,
      laborMetrics: [],
      auditTrail: [auditEntry('survey_created', 'Demodata tilbakestilt.')],
      responseTokens: {},
      anonymousAmlReports: [],
    }
    setState(next)
    save(next)
  }, [])

  const submitAnonymousAmlReport = useCallback(
    (
      kind: AmlReportKind,
      options: { detailsIndicated: boolean; urgency: AnonymousAmlReport['urgency'] },
    ): boolean => {
      const r: AnonymousAmlReport = {
        id: crypto.randomUUID(),
        kind,
        submittedAt: new Date().toISOString(),
        detailsIndicated: options.detailsIndicated,
        urgency: options.urgency,
      }
      setState((s) => ({
        ...s,
        anonymousAmlReports: [r, ...s.anonymousAmlReports],
      }))
      appendAudit('anonymous_aml_report', 'Anonym AML-henvendelse registrert (kun kategori, ikke innhold).', {
        kind,
        urgency: options.urgency,
        detailsIndicated: options.detailsIndicated,
      })
      return true
    },
    [appendAudit],
  )

  const amlReportStats = useMemo(() => {
    const byKind: Partial<Record<AmlReportKind, number>> = {}
    for (const r of state.anonymousAmlReports) {
      byKind[r.kind] = (byKind[r.kind] ?? 0) + 1
    }
    return {
      total: state.anonymousAmlReports.length,
      byKind,
      lastAt: state.anonymousAmlReports[0]?.submittedAt ?? null,
    }
  }, [state.anonymousAmlReports])

  return {
    ...state,
    aggregates,
    navSummary,
    amlReportStats,
    createSurvey,
    updateSurvey,
    addQuestion,
    openSurvey,
    closeSurvey,
    submitResponse,
    addNavReport,
    addLaborMetric,
    submitAnonymousAmlReport,
    resetDemo,
    metricDefinitions: LABOR_METRIC_DEFINITIONS,
    surveyFollowUpTaskDescription,
  }
}
