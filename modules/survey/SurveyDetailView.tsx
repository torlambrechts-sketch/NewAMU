import { useCallback, useEffect, useMemo, useState, useRef, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ArrowLeft, EyeOff, Ghost, Save, Trash2 } from 'lucide-react'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'
import { SlidePanel } from '../../src/components/layout/SlidePanel'
import { WORKPLACE_MODULE_CARD_SHADOW } from '../../src/components/layout/workplaceModuleSurface'
import {
  ModuleLegalBanner,
  ModulePageShell,
  ModulePageEmpty,
  ModuleSectionCard,
} from '../../src/components/module'
import { InfoBox, WarningBox } from '../../src/components/ui/AlertBox'
import { Badge } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import { YesNoToggle } from '../../src/components/ui/FormToggles'
import { StandardInput } from '../../src/components/ui/Input'
import { SearchableSelect, type SelectOption } from '../../src/components/ui/SearchableSelect'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { Tabs, type TabItem } from '../../src/components/ui/Tabs'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { SURVEY_K_ANONYMITY_MIN } from '../../src/lib/orgSurveyKAnonymity'
import { useSurvey } from './useSurvey'
import type { UseSurveyState } from './useSurvey'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
  LAYOUT_TABLE1_POSTINGS_TD,
} from '../../src/components/layout/layoutTable1PostingsKit'
import { buildAnalyticsByQuestionId } from './surveyAnalytics'
import { QUESTION_TYPE_OPTIONS, surveyStatusBadgeVariant, surveyStatusLabel } from './surveyLabels'
import { SurveyBuilderStage } from './SurveyBuilderStage'
import { SurveyAmuTab } from './tabs/SurveyAmuTab'
import { SurveyDistribusjonTab } from './tabs/SurveyDistribusjonTab'
import { SurveyTiltakTab } from './tabs/SurveyTiltakTab'
import { SURVEY_DETAIL_EXTRA_LEGAL_REFERENCES, SURVEY_MODULE_LEGAL_REFERENCES } from './surveyLegalReferences'
import { orgQuestionToCatalogQuestion } from './surveyTemplateCatalogHelpers'
import type { OrgSurveyQuestionRow, SurveyAmuReviewRow, SurveyQuestionType, SurveyRow } from './types'

type DetailTab = 'oversikt' | 'bygger' | 'distribusjon' | 'svar' | 'analyse' | 'amu' | 'tiltak'

function buildTabs(
  responseCount: number,
  actionCount: number,
  amuReview: SurveyAmuReviewRow | null,
  pendingInvites: number,
): TabItem[] {
  return [
    { id: 'oversikt', label: 'Oversikt' },
    { id: 'bygger', label: 'Bygger' },
    {
      id: 'distribusjon',
      label: 'Distribusjon',
      badgeCount: pendingInvites > 0 ? pendingInvites : undefined,
    },
    { id: 'svar', label: 'Svar', badgeCount: responseCount > 0 ? responseCount : undefined },
    { id: 'analyse', label: 'Analyse' },
    {
      id: 'amu',
      label: 'AMU-gjennomgang',
      badgeCount: amuReview && !amuReview.amu_chair_signed_at ? 1 : undefined,
    },
    {
      id: 'tiltak',
      label: 'Handlingsplan',
      badgeCount: actionCount > 0 ? actionCount : undefined,
    },
  ]
}

type Props = { supabase: SupabaseClient | null }

function TabEmpty({ message, footer }: { message: string; footer?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Ghost className="h-12 w-12 text-neutral-300" strokeWidth={1.25} aria-hidden />
      <p className="max-w-md text-sm text-neutral-500">{message}</p>
      {footer}
    </div>
  )
}

function AnalyseBar({ label, valuePct }: { label: string; valuePct: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-neutral-600">
        <span className="min-w-0 truncate pr-2">{label}</span>
        <span className="shrink-0 font-medium text-neutral-800">{Math.round(valuePct)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-[#1a3d32] transition-[width]"
          style={{ width: `${Math.min(100, Math.max(0, valuePct))}%` }}
        />
      </div>
    </div>
  )
}

function OversiktTab({
  survey,
  s,
}: {
  survey: UseSurveyState
  s: SurveyRow
}) {
  const [titleEdit, setTitleEdit] = useState(s.title)
  const [descEdit, setDescEdit] = useState(s.description ?? '')
  const [savingMeta, setSavingMeta] = useState(false)

  const saveMetadata = useCallback(async () => {
    if (!titleEdit.trim()) return
    setSavingMeta(true)
    const ok = await survey.updateSurvey(s.id, { title: titleEdit.trim(), description: descEdit.trim() || null })
    setSavingMeta(false)
    if (ok) void survey.loadSurveyDetail(s.id)
  }, [s.id, titleEdit, descEdit, survey])

  return (
    <div className="space-y-6">
      <ModuleSectionCard className="p-5 md:p-6">
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Innhold</p>
            <p className="mt-1 text-sm text-neutral-600">
              Tittel og beskrivelse vises for administratorer. Publisering låser spørsmålene.
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sv-title">
                Tittel
              </label>
              <StandardInput
                id="sv-title"
                value={titleEdit}
                onChange={(e) => setTitleEdit(e.target.value)}
                disabled={!survey.canManage || s.status === 'closed'}
              />
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sv-desc">
                Beskrivelse
              </label>
              <StandardTextarea
                id="sv-desc"
                value={descEdit}
                onChange={(e) => setDescEdit(e.target.value)}
                rows={4}
                disabled={!survey.canManage || s.status === 'closed'}
              />
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sv-anon">
                Anonym undersøkelse
              </label>
              <p className="text-xs text-neutral-500">Når aktivt lagres ingen bruker-ID på svar (personvern).</p>
              <div className="mt-2 max-w-xs">
                <YesNoToggle
                  value={s.is_anonymous}
                  onChange={(v) => {
                    if (!survey.canManage) return
                    if (s.status !== 'draft') {
                      return
                    }
                    void survey.updateSurvey(s.id, { is_anonymous: v })
                  }}
                />
              </div>
            </div>
            {survey.canManage && s.status === 'draft' ? (
              <Button type="button" variant="secondary" disabled={savingMeta} onClick={() => void saveMetadata()}>
                {savingMeta ? 'Lagrer…' : 'Lagre endringer'}
              </Button>
            ) : null}
          </div>
        </div>
      </ModuleSectionCard>

      {survey.canManage && s.status === 'draft' ? (
        <ModuleSectionCard className="p-5 md:p-6">
          <p className="text-sm font-medium text-neutral-800">Publisering</p>
          <p className="mt-1 text-sm text-neutral-600">
            Når du publiserer, låses spørsmålene. Svar kan samles inn mens undersøkelsen er aktiv.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="primary" onClick={() => void survey.publishSurvey(s.id)}>
              Publiser
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void survey.dispatchOnSurveyPublished(s.id)
              }}
            >
              Kjør arbeidsflyt (publisert)
            </Button>
          </div>
        </ModuleSectionCard>
      ) : null}

      {survey.canManage && s.status === 'active' ? (
        <ModuleSectionCard className="border-amber-200 bg-amber-50/60 p-5 md:p-6">
          <p className="text-sm font-medium text-amber-950">Lukk undersøkelsen</p>
          <p className="mt-1 text-sm text-amber-900/80">Lukk når innsamlingen er ferdig. Nye svar stoppes.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => void survey.closeSurvey(s.id)}>
              Lukk undersøkelse
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                void survey.dispatchOnSurveyClosed(s.id)
              }}
            >
              Kjør arbeidsflyt (lukket)
            </Button>
          </div>
        </ModuleSectionCard>
      ) : null}
    </div>
  )
}

function ByggerTab({
  survey,
  surveyId,
  isLocked,
  openNewQuestion,
  openEditQuestion,
}: {
  survey: UseSurveyState
  surveyId: string
  isLocked: boolean
  openNewQuestion: () => void
  openEditQuestion: (q: OrgSurveyQuestionRow) => void
}) {
  if (!survey.canManage) {
    return (
      <TabEmpty message="Du har ikke tilgang til å redigere spørsmål. Kontakt en administrator med survey.manage." />
    )
  }

  return (
    <div className="space-y-4">
      {isLocked ? (
        <InfoBox>Undersøkelsen er publisert eller lukket — spørsmål kan ikke legges til eller endres.</InfoBox>
      ) : null}
      <SurveyBuilderStage
        survey={survey}
        surveyId={surveyId}
        isLocked={isLocked}
        onEditQuestion={openEditQuestion}
        onAddQuestion={openNewQuestion}
      />
    </div>
  )
}

function SvarTab({
  survey,
  s,
  nameByUserId,
}: {
  survey: UseSurveyState
  s: SurveyRow
  nameByUserId: Record<string, string>
}) {
  return (
    <div>
      {survey.responses.length === 0 ? (
        <TabEmpty message="Ingen besvarelser mottatt ennå. Svar vises når deltakere har sendt inn." />
      ) : (
        <LayoutTable1PostingsShell
          wrap={false}
          title="Mottatte besvarelser"
          description="Anonyme undersøkelser viser ikke sammenheng med navn. Identifiserte svar kobles til bruker der det er krevet i databasen."
          toolbar={<span className="text-xs text-neutral-500">{survey.responses.length} svar</span>}
        >
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Rund</th>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Innsendt</th>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Deltaker</th>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Nøkkel</th>
                </tr>
              </thead>
              <tbody>
                {survey.responses.map((r, idx) => (
                  <tr key={r.id} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                    <td className={LAYOUT_TABLE1_POSTINGS_TD}>{idx + 1}</td>
                    <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                      {new Date(r.submitted_at).toLocaleString('nb-NO')}
                    </td>
                    <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                      {s.is_anonymous || r.user_id == null ? (
                        <span className="text-neutral-500">Anonym besvarelse</span>
                      ) : (
                        <span>{nameByUserId[r.user_id!] ?? 'Bruker'}</span>
                      )}
                    </td>
                    <td className={LAYOUT_TABLE1_POSTINGS_TD} title={r.id}>
                      {r.id.slice(0, 8)}…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LayoutTable1PostingsShell>
      )}
    </div>
  )
}

function AnalyseTab({ survey, s }: { survey: UseSurveyState; s: SurveyRow }) {
  const threshold = Math.max(s.anonymity_threshold ?? SURVEY_K_ANONYMITY_MIN, SURVEY_K_ANONYMITY_MIN)
  const analyticsByQuestion = useMemo(
    () => buildAnalyticsByQuestionId(survey.questions, survey.answers),
    [survey.questions, survey.answers],
  )

  return (
    <div className="w-full space-y-6">
      <InfoBox>
        Resultater vises kun for spørsmål med {threshold} eller flere svar. Fritekst svar vises aldri i klartekst
        (særlige kategorier, GDPR). Grupper under terskelen vises som skjult.
      </InfoBox>

      {survey.questions.length === 0 ? (
        <TabEmpty message="Ingen spørsmål å analysere. Legg til spørsmål i byggeren." />
      ) : survey.answers.length === 0 && survey.responses.length === 0 ? (
        <TabEmpty message="Ingen svar å analysere ennå. Når deltakere svarer, oppdateres visningen her." />
      ) : (
        survey.questions.map((q) => {
          const a = analyticsByQuestion[q.id]
          const n =
            q.question_type === 'rating_1_to_5' || q.question_type === 'rating_1_to_10'
              ? a?.numbers.length ?? 0
              : q.question_type === 'multiple_choice' ||
                  q.question_type === 'yes_no' ||
                  q.question_type === 'single_select' ||
                  q.question_type === 'multi_select'
                ? Object.values(a?.choiceCounts ?? {}).reduce((sum, v) => sum + v, 0)
                : 0

          if (q.question_type === 'text') {
            const c = a?.textCount ?? 0
            return (
              <div
                key={q.id}
                className="rounded-lg border border-neutral-200/90 bg-white p-5"
                style={WORKPLACE_MODULE_CARD_SHADOW}
              >
                <h3 className="text-sm font-semibold text-neutral-900">{q.question_text}</h3>
                <p className="mt-2 text-sm text-neutral-500">
                  Fritekst · {c} utfylt svar. Individuelle svar vises ikke (GDPR).
                </p>
                {c === 0 ? <p className="mt-3 text-sm text-neutral-500">Ingen fritektsvar mottatt.</p> : null}
              </div>
            )
          }

          if (n < threshold) {
            return (
              <div
                key={q.id}
                className="rounded-lg border border-neutral-200 bg-white p-5"
                style={WORKPLACE_MODULE_CARD_SHADOW}
              >
                <h3 className="text-sm font-semibold text-neutral-900">{q.question_text}</h3>
                <div className="mt-3 flex items-center gap-2 text-sm text-neutral-400">
                  <EyeOff className="h-4 w-4" aria-hidden />
                  <span>
                    Skjult — under {threshold} svar (n={n}). GDPR Art. 25.
                  </span>
                </div>
              </div>
            )
          }

          if (q.question_type === 'rating_1_to_5' || q.question_type === 'rating_1_to_10') {
            const cfg = q.config as { scaleMin?: number; scaleMax?: number } | undefined
            const smin = cfg?.scaleMin ?? (q.question_type === 'rating_1_to_10' ? 0 : 1)
            const smax = cfg?.scaleMax ?? (q.question_type === 'rating_1_to_10' ? 10 : 5)
            const span = Math.max(1, smax - smin)
            const avg = n > 0 ? a!.numbers.reduce((x, y) => x + y, 0) / n : 0
            return (
              <div
                key={q.id}
                className="rounded-lg border border-neutral-200/90 bg-white p-5"
                style={WORKPLACE_MODULE_CARD_SHADOW}
              >
                <h3 className="text-sm font-semibold text-neutral-900">{q.question_text}</h3>
                <p className="mt-1 text-xs text-neutral-500">Gjennomsnitt {n > 0 ? `${avg.toFixed(2)} (n=${n})` : '—'}</p>
                {n === 0 ? <p className="mt-3 text-sm text-neutral-500">Ingen numeriske svar for dette spørsmålet.</p> : null}
                {n > 0 ? (
                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full bg-[#1a3d32]"
                      style={{ width: `${Math.min(100, ((avg - smin) / span) * 100)}%` }}
                    />
                  </div>
                ) : null}
              </div>
            )
          }

          const entries = Object.entries(a?.choiceCounts ?? {})
          const total = entries.reduce((s2, [, v]) => s2 + v, 0) || 1
          return (
            <div key={q.id} className="rounded-lg border border-neutral-200/90 bg-white p-5" style={WORKPLACE_MODULE_CARD_SHADOW}>
              <h3 className="text-sm font-semibold text-neutral-900">{q.question_text}</h3>
              <p className="mt-1 text-xs text-neutral-500">Flervalg · andel av svar</p>
              {entries.length === 0 ? <p className="mt-3 text-sm text-neutral-500">Ingen flervalgssvar registrert.</p> : null}
              {entries.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {entries
                    .sort((x, y) => y[1] - x[1])
                    .map(([k, v]) => <AnalyseBar key={k} label={k} valuePct={(v / total) * 100} />)}
                </div>
              ) : null}
            </div>
          )
        })
      )}
    </div>
  )
}

export function SurveyDetailView({ supabase }: Props) {
  const { surveyId } = useParams<{ surveyId: string }>()
  const navigate = useNavigate()
  const { organization } = useOrgSetupContext()
  const orgId = organization?.id
  const survey = useSurvey({ supabase })
  const [tab, setTab] = useState<DetailTab>('oversikt')
  const [nameByUserId, setNameByUserId] = useState<Record<string, string>>({})
  const profileFetchId = useRef(0)

  const [panelOpen, setPanelOpen] = useState(false)
  const [editingQ, setEditingQ] = useState<OrgSurveyQuestionRow | null>(null)
  const [qText, setQText] = useState('')
  const [qType, setQType] = useState<SurveyQuestionType>('rating_1_to_5')
  const [qOrder, setQOrder] = useState('0')
  const [qRequired, setQRequired] = useState(true)
  const [qOptionsLines, setQOptionsLines] = useState('')
  const [qConfigJson, setQConfigJson] = useState('{}')
  const [qSaving, setQSaving] = useState(false)
  const [questionPanelError, setQuestionPanelError] = useState<string | null>(null)
  const [templateSaving, setTemplateSaving] = useState(false)

  const { loadSurveyDetail } = survey
  useEffect(() => {
    if (surveyId) void loadSurveyDetail(surveyId)
  }, [surveyId, loadSurveyDetail])

  const s: SurveyRow | null = survey.selectedSurvey

  const pendingInviteCount = useMemo(
    () => survey.invitations.filter((i) => i.status === 'pending').length,
    [survey.invitations],
  )

  const tabs = useMemo(
    () =>
      buildTabs(
        survey.responses.length,
        survey.actionPlans.filter((p) => p.status !== 'closed').length,
        survey.amuReview,
        pendingInviteCount,
      ),
    [survey.responses.length, survey.actionPlans, survey.amuReview, pendingInviteCount],
  )

  useEffect(() => {
    if (!supabase || !orgId || !surveyId) return
    const uids = [...new Set(survey.responses.map((r) => r.user_id).filter((x): x is string => x != null))]
    const requestId = ++profileFetchId.current
    if (uids.length === 0) {
      queueMicrotask(() => {
        if (requestId === profileFetchId.current) setNameByUserId({})
      })
      return
    }
    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('organization_id', orgId)
        .in('id', uids)
      if (requestId !== profileFetchId.current) return
      if (error) {
        return
      }
      const next: Record<string, string> = {}
      for (const row of data ?? []) {
        const p = row as { id: string; display_name: string }
        next[p.id] = p.display_name
      }
      setNameByUserId(next)
    })()
  }, [supabase, orgId, surveyId, survey.responses])

  const questionTypeOptions: SelectOption[] = useMemo(
    () => QUESTION_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    [],
  )

  const openNewQuestion = useCallback(() => {
    if (!s || !surveyId) return
    setEditingQ(null)
    setQText('')
    setQType('rating_1_to_5')
    setQOrder(String(survey.questions.length))
    setQRequired(true)
    setQOptionsLines('')
    setQConfigJson('{}')
    setPanelOpen(true)
  }, [s, surveyId, survey.questions.length])

  const openEditQuestion = useCallback((q: OrgSurveyQuestionRow) => {
    setEditingQ(q)
    setQText(q.question_text)
    setQType(q.question_type)
    setQOrder(String(q.order_index))
    setQRequired(q.is_required)
    const opts = (q.config as { options?: string[] } | undefined)?.options
    setQOptionsLines(Array.isArray(opts) ? opts.join('\n') : '')
    try {
      setQConfigJson(JSON.stringify(q.config ?? {}, null, 2))
    } catch {
      setQConfigJson('{}')
    }
    setPanelOpen(true)
  }, [])

  const closePanel = useCallback(() => {
    setQuestionPanelError(null)
    setPanelOpen(false)
    setEditingQ(null)
  }, [])

  const saveQuestion = useCallback(async () => {
    if (!s || !surveyId || !qText.trim()) return
    const order = Number.parseInt(qOrder, 10)
    if (!Number.isFinite(order)) return
    let config: Record<string, unknown> = {}
    try {
      const parsed = JSON.parse(qConfigJson || '{}') as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        config = parsed as Record<string, unknown>
      }
    } catch {
      setQuestionPanelError('Ugyldig JSON i avansert konfigurasjon.')
      return
    }
    const optionTypes: SurveyQuestionType[] = ['multiple_choice', 'single_select', 'multi_select']
    if (optionTypes.includes(qType)) {
      const opts = qOptionsLines
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
      config = { ...config, options: opts.length > 0 ? opts : ['Alternativ 1', 'Alternativ 2'] }
    }
    setQuestionPanelError(null)
    setQSaving(true)
    const row = await survey.upsertQuestion({
      id: editingQ?.id,
      surveyId,
      questionText: qText.trim(),
      questionType: qType,
      orderIndex: order,
      isRequired: qRequired,
      isMandatory: editingQ?.is_mandatory,
      mandatoryLaw: editingQ?.mandatory_law,
      config,
    })
    setQSaving(false)
    if (row) closePanel()
  }, [s, surveyId, qText, qType, qOrder, qRequired, qOptionsLines, qConfigJson, editingQ, survey, closePanel])

  const saveAsOrgTemplate = useCallback(async () => {
    if (!s || !surveyId || !survey.canManage) return
    if (s.status !== 'draft') return
    if (survey.questions.length === 0) return
    const defaultName = s.title.trim() || 'Organisasjonsmal'
    const nameInput =
      typeof window !== 'undefined' ? window.prompt('Navn på organisasjonsmal:', defaultName) : defaultName
    if (nameInput == null) return
    const name = nameInput.trim()
    if (!name) return
    setTemplateSaving(true)
    const sorted = [...survey.questions].sort((a, b) => a.order_index - b.order_index)
    const body = {
      version: 1 as const,
      questions: sorted.map((q, i) => orgQuestionToCatalogQuestion(q, i)),
    }
    const row = await survey.saveOrgTemplate({
      name,
      shortName: null,
      description: s.description,
      category: 'custom',
      audience: s.survey_type === 'external' ? 'external' : 'internal',
      body,
    })
    setTemplateSaving(false)
    if (row) navigate(`/survey/templates/org/${row.id}`)
  }, [s, surveyId, survey, navigate])

  const isLocked = !!(s && (s.status === 'active' || s.status === 'closed'))
  const panelTitleId = 'survey-question-panel-title'

  const legalReferences = useMemo(
    () => [...SURVEY_MODULE_LEGAL_REFERENCES, ...SURVEY_DETAIL_EXTRA_LEGAL_REFERENCES],
    [],
  )

  if (!surveyId) {
    return <ModulePageEmpty title="Mangler undersøkelses-ID" onBack={() => navigate('/survey')} backLabel="Tilbake til listen" />
  }

  if (!s && !survey.loading) {
    return (
      <ModulePageEmpty
        title="Undersøkelsen finnes ikke, eller du har ikke tilgang."
        onBack={() => navigate('/survey')}
        backLabel="Tilbake til listen"
      />
    )
  }

  if (!s) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'Undersøkelser', to: '/survey' }, { label: 'Laster' }]}
        title="Laster…"
        description="Henter detaljer."
        headerActions={
          <Button type="button" variant="secondary" size="sm" onClick={() => navigate('/survey')}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Tilbake
          </Button>
        }
        loading
        loadingLabel="Laster undersøkelse…"
      >
        {null}
      </ModulePageShell>
    )
  }

  return (
    <>
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'Undersøkelser', to: '/survey' }, { label: s.title }]}
        title={s.title}
        description={s.description ?? 'Detaljert visning — innstillinger, spørsmål, svar og analyse.'}
        headerActions={
          <Button type="button" variant="secondary" size="sm" onClick={() => navigate('/survey')}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Tilbake
          </Button>
        }
        tabs={<Tabs className="w-full md:w-auto" items={tabs} activeId={tab} onChange={(id) => setTab(id as DetailTab)} />}
        loading={false}
      >
        <div className="w-full space-y-6">
          <div className="mb-2 flex flex-wrap items-center gap-3 border-b border-neutral-200 pb-4">
            <Badge variant={surveyStatusBadgeVariant(s.status)}>{surveyStatusLabel(s.status)}</Badge>
            {s.is_anonymous ? <Badge variant="info">Anonym</Badge> : <Badge variant="neutral">Identifisert</Badge>}
          </div>

          <ModuleLegalBanner
            title="Regelverk for denne undersøkelsen"
            intro={
              <p>
                {s.survey_type === 'external'
                  ? 'Leverandørundersøkelsen støtter dokumentasjonskrav (åpenhetsloven, internkontroll).'
                  : 'Ansattundersøkelsen støtter systematisk kartlegging av arbeidsmiljø (AML kap. 4) og følges opp i AMU etter behov.'}
              </p>
            }
            references={legalReferences}
          />

          {survey.error ? <WarningBox>{survey.error}</WarningBox> : null}

          {tab === 'oversikt' && (
            <OversiktTab key={s.id} survey={survey} s={s} />
          )}

          {tab === 'bygger' && survey.canManage && s.status === 'draft' && !isLocked ? (
            <div className="rounded-lg border border-[#1a3d32]/20 bg-[#f7faf8] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-neutral-700">
                  Lagre denne spørsmålslisten som gjenbrukbar mal under Maler.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={templateSaving || survey.questions.length === 0}
                  onClick={() => void saveAsOrgTemplate()}
                >
                  <Save className="h-4 w-4" aria-hidden />
                  {templateSaving ? 'Lagrer mal…' : 'Lagre som organisasjonsmal'}
                </Button>
              </div>
            </div>
          ) : null}

          {tab === 'bygger' && (
            <ByggerTab
              survey={survey}
              surveyId={s.id}
              isLocked={isLocked}
              openNewQuestion={openNewQuestion}
              openEditQuestion={openEditQuestion}
            />
          )}

          {tab === 'distribusjon' && <SurveyDistribusjonTab survey={survey} s={s} />}

          {tab === 'svar' && <SvarTab survey={survey} s={s} nameByUserId={nameByUserId} />}

          {tab === 'analyse' && <AnalyseTab survey={survey} s={s} />}

          {tab === 'amu' && <SurveyAmuTab survey={survey} s={s} />}

          {tab === 'tiltak' && <SurveyTiltakTab survey={survey} s={s} />}
        </div>
      </ModulePageShell>

      <SlidePanel
        open={panelOpen}
        onClose={() => {
          setQuestionPanelError(null)
          closePanel()
        }}
        titleId={panelTitleId}
        title={editingQ ? 'Rediger spørsmål' : 'Nytt spørsmål'}
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closePanel} disabled={qSaving}>
              Avbryt
            </Button>
            <Button type="button" variant="primary" onClick={() => void saveQuestion()} disabled={qSaving || !qText.trim()}>
              {qSaving ? 'Lagrer…' : 'Lagre'}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          {questionPanelError ? <WarningBox>{questionPanelError}</WarningBox> : null}
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="q-text">
              Spørsmålstekst
            </label>
            <StandardTextarea id="q-text" value={qText} onChange={(e) => setQText(e.target.value)} rows={3} />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="q-type-sel">
              Spørsmålstype
            </label>
            <SearchableSelect
              value={qType}
              options={questionTypeOptions}
              onChange={(v) => setQType(v as SurveyQuestionType)}
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="q-ord">
              Sortering (indeks)
            </label>
            <StandardInput
              id="q-ord"
              type="number"
              value={qOrder}
              onChange={(e) => setQOrder(e.target.value)}
              min={0}
            />
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Må fylles ut</span>
            <div className="mt-2 max-w-xs">
              <YesNoToggle value={qRequired} onChange={(v) => setQRequired(v)} />
            </div>
          </div>

          {(['multiple_choice', 'single_select', 'multi_select'] as SurveyQuestionType[]).includes(qType) ? (
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="q-opts">
                Alternativer (én per linje)
              </label>
              <StandardTextarea
                id="q-opts"
                value={qOptionsLines}
                onChange={(e) => setQOptionsLines(e.target.value)}
                rows={5}
                placeholder="Ja&#10;Nei&#10;Vet ikke"
              />
            </div>
          ) : null}

          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="q-config-json">
              Avansert (JSON: skala, ankere …)
            </label>
            <StandardTextarea
              id="q-config-json"
              value={qConfigJson}
              onChange={(e) => setQConfigJson(e.target.value)}
              rows={6}
              className="font-mono text-xs"
              placeholder='{"scaleMin":1,"scaleMax":5,"anchors":{"low":"…","high":"…"}}'
            />
            <p className="mt-1 text-xs text-neutral-500">
              Tom <code className="rounded bg-neutral-100 px-1">{'{}'}</code> er tillatt. Alternativer for flervalg settes over.
            </p>
          </div>

          {editingQ && survey.canManage && !editingQ.is_mandatory ? (
            <div className="border-t border-neutral-100 pt-4">
              <Button
                type="button"
                variant="ghost"
                className="text-red-600 hover:text-red-800"
                onClick={() => {
                  void survey.deleteQuestion(editingQ.id, surveyId!)
                  closePanel()
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                Slett spørsmål
              </Button>
            </div>
          ) : null}
        </div>
      </SlidePanel>
    </>
  )
}
