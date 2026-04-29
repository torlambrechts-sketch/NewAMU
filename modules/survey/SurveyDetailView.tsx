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
import { surveyStatusBadgeVariant, surveyStatusLabel } from './surveyLabels'
import { buildAnalyticsByQuestionId } from './surveyAnalytics'
import { globalQuestionIdOrder } from './surveyQuestionGlobalOrder'
import { SurveySectionBuilder } from './SurveySectionBuilder'
import { SurveyQuestionFormFields, type QuestionDraft } from './SurveyQuestionFormFields'
import { defaultQuestionPayload } from './surveyQuestionDefaults'
import { SurveyAmuTab } from './tabs/SurveyAmuTab'
import { SurveyDistribusjonTab } from './tabs/SurveyDistribusjonTab'
import { SurveyTiltakTab } from './tabs/SurveyTiltakTab'
import { SURVEY_DETAIL_EXTRA_LEGAL_REFERENCES, SURVEY_MODULE_LEGAL_REFERENCES } from './surveyLegalReferences'
import { orgQuestionToCatalogQuestion } from './surveyTemplateCatalogHelpers'
import type { OrgSurveyQuestionRow, SurveyAmuReviewRow, SurveyQuestionType, SurveyRow } from './types'

function mergeQuestionConfig(
  baseConfig: Record<string, unknown>,
  extraJson: string,
): { config: Record<string, unknown>; error: string | null } {
  let extra: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(extraJson || '{}') as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      extra = parsed as Record<string, unknown>
    }
  } catch {
    return { config: baseConfig, error: 'Ugyldig JSON i logikk/validering.' }
  }
  const cfg = { ...baseConfig, ...extra }
  return { config: cfg, error: null }
}

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

function amuComplianceSteps(s: SurveyRow, amu: SurveyAmuReviewRow | null) {
  return [
    { ok: s.status === 'closed', label: 'Undersøkelsen er lukket' },
    { ok: Boolean(amu?.meeting_date?.trim()), label: 'Møtedato for AMU-gjennomgang er registrert' },
    { ok: Boolean(amu?.amu_chair_signed_at), label: 'AMU-leder har signert protokoll' },
    { ok: Boolean(amu?.vo_signed_at), label: 'Verneombud har signert protokoll' },
  ]
}

function OversiktTab({
  survey,
  s,
  onOpenAmuTab,
}: {
  survey: UseSurveyState
  s: SurveyRow
  onOpenAmuTab: () => void
}) {
  const [titleEdit, setTitleEdit] = useState(s.title)
  const [descEdit, setDescEdit] = useState(s.description ?? '')
  const [savingMeta, setSavingMeta] = useState(false)

  const amuGate = useMemo(() => {
    if (s.survey_type !== 'internal' || !s.amu_review_required) return null
    const steps = amuComplianceSteps(s, survey.amuReview)
    const complete = steps.every((x) => x.ok)
    return { steps, complete }
  }, [s.survey_type, s.amu_review_required, s.status, survey.amuReview])

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

      {amuGate ? (
        <ModuleSectionCard className="p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-neutral-800">AMU og dokumentasjon (AML § 7-2)</p>
              <p className="mt-1 text-sm text-neutral-600">
                Resultatene regnes som fullstendig fulgt opp i AMU når alle punktene under er oppfylt. Aggregerte tall
                leveres til AMU — ikke enkelt svar.
              </p>
            </div>
            <Badge variant={amuGate.complete ? 'success' : 'warning'}>
              {amuGate.complete ? 'Oppfylt' : 'Mangler'}
            </Badge>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {amuGate.steps.map((step) => (
              <li key={step.label} className="flex items-start gap-2">
                <span className={step.ok ? 'text-emerald-600' : 'text-neutral-400'} aria-hidden>
                  {step.ok ? '✓' : '○'}
                </span>
                <span className={step.ok ? 'text-neutral-800' : 'text-neutral-600'}>{step.label}</span>
              </li>
            ))}
          </ul>
          {!amuGate.complete ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={onOpenAmuTab}>
                Gå til AMU-gjennomgang
              </Button>
            </div>
          ) : null}
        </ModuleSectionCard>
      ) : s.survey_type === 'internal' && !s.amu_review_required ? (
        <InfoBox>
          AMU-gjennomgang er ikke påkrevd for denne undersøkelsen. Dokumenter likevel behandling i AMU dersom dere bruker
          resultatene i årsrapport eller tiltaksplan.
        </InfoBox>
      ) : null}

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
  openNewQuestion: (sectionId: string | null) => void
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
      <SurveySectionBuilder
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

  const orderedQuestions = useMemo(() => {
    const order = globalQuestionIdOrder(survey.questions, s.id, survey.surveySections)
    const m = new Map(survey.questions.map((q) => [q.id, q]))
    return order.map((id) => m.get(id)).filter((q): q is OrgSurveyQuestionRow => q != null)
  }, [survey.questions, survey.surveySections, s.id])

  const sectionTitleById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const sec of survey.surveySections) map[sec.id] = sec.title
    return map
  }, [survey.surveySections])

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
        orderedQuestions.map((q, qi) => {
          const a = analyticsByQuestion[q.id]
          const isNumeric =
            q.question_type === 'rating_1_to_5' ||
            q.question_type === 'rating_1_to_10' ||
            q.question_type === 'nps' ||
            q.question_type === 'rating_visual' ||
            q.question_type === 'likert_scale'
          const isChoice =
            q.question_type === 'multiple_choice' ||
            q.question_type === 'yes_no' ||
            q.question_type === 'single_select' ||
            q.question_type === 'multi_select' ||
            q.question_type === 'dropdown' ||
            q.question_type === 'image_choice'
          const isTextLike =
            q.question_type === 'text' ||
            q.question_type === 'long_text' ||
            q.question_type === 'short_text' ||
            q.question_type === 'email' ||
            q.question_type === 'number' ||
            q.question_type === 'slider' ||
            q.question_type === 'datetime' ||
            q.question_type === 'signature' ||
            q.question_type === 'file_upload' ||
            q.question_type === 'matrix' ||
            q.question_type === 'ranking'

          const n = isNumeric
            ? a?.numbers.length ?? 0
            : isChoice
              ? (Object.values(a?.choiceCounts ?? {}) as number[]).reduce(
                  (sum, v) => sum + (typeof v === 'number' ? v : 0),
                  0,
                )
              : 0

          const prev = orderedQuestions[qi - 1]
          const showSection =
            survey.surveySections.length > 0 &&
            (prev?.section_id ?? null) !== (q.section_id ?? null) &&
            q.section_id != null

          const sectionHeader =
            showSection && q.section_id ? (
              <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-neutral-500 first:mt-0">
                {sectionTitleById[q.section_id] ?? 'Seksjon'}
              </h3>
            ) : null

          if (isTextLike) {
            const c = a?.textCount ?? 0
            return (
              <div key={q.id}>
                {sectionHeader}
                <div className="rounded-lg border border-neutral-200/90 bg-white p-5" style={WORKPLACE_MODULE_CARD_SHADOW}>
                  <h3 className="text-sm font-semibold text-neutral-900">{q.question_text}</h3>
                  <p className="mt-2 text-sm text-neutral-500">
                    Strukturert/tekst · {c} utfylte svar. Detaljer vises ikke (GDPR).
                  </p>
                  {c === 0 ? <p className="mt-3 text-sm text-neutral-500">Ingen svar mottatt.</p> : null}
                </div>
              </div>
            )
          }

          if (n < threshold) {
            return (
              <div key={q.id}>
                {sectionHeader}
                <div className="rounded-lg border border-neutral-200 bg-white p-5" style={WORKPLACE_MODULE_CARD_SHADOW}>
                  <h3 className="text-sm font-semibold text-neutral-900">{q.question_text}</h3>
                  <div className="mt-3 flex items-center gap-2 text-sm text-neutral-400">
                    <EyeOff className="h-4 w-4" aria-hidden />
                    <span>
                      Skjult — under {threshold} svar (n={n}). GDPR Art. 25.
                    </span>
                  </div>
                </div>
              </div>
            )
          }

          if (isNumeric) {
            const cfg = q.config as { scaleMin?: number; scaleMax?: number } | undefined
            let smin = cfg?.scaleMin ?? 1
            let smax = cfg?.scaleMax ?? 5
            if (q.question_type === 'nps' || q.question_type === 'rating_1_to_10') {
              smin = cfg?.scaleMin ?? 0
              smax = cfg?.scaleMax ?? 10
            } else if (q.question_type === 'rating_1_to_5' || q.question_type === 'likert_scale') {
              smin = cfg?.scaleMin ?? 1
              smax = cfg?.scaleMax ?? 5
            } else if (q.question_type === 'rating_visual') {
              smin = 1
              smax = typeof cfg?.scaleMax === 'number' ? cfg.scaleMax : 5
            }
            const span = Math.max(1, smax - smin)
            const avg = n > 0 && a ? a.numbers.reduce((x: number, y: number) => x + y, 0) / n : 0
            return (
              <div key={q.id}>
                {sectionHeader}
                <div className="rounded-lg border border-neutral-200/90 bg-white p-5" style={WORKPLACE_MODULE_CARD_SHADOW}>
                  <h3 className="text-sm font-semibold text-neutral-900">{q.question_text}</h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    Gjennomsnitt {n > 0 ? `${avg.toFixed(2)} (n=${n})` : '—'}
                  </p>
                  {n === 0 ? (
                    <p className="mt-3 text-sm text-neutral-500">Ingen numeriske svar for dette spørsmålet.</p>
                  ) : null}
                  {n > 0 ? (
                    <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full rounded-full bg-[#1a3d32]"
                        style={{ width: `${Math.min(100, ((avg - smin) / span) * 100)}%` }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            )
          }

          const entries = Object.entries(a?.choiceCounts ?? {}) as [string, number][]
          const total = entries.reduce((s2, [, v]) => s2 + v, 0) || 1
          return (
            <div key={q.id}>
              {sectionHeader}
              <div className="rounded-lg border border-neutral-200/90 bg-white p-5" style={WORKPLACE_MODULE_CARD_SHADOW}>
                <h3 className="text-sm font-semibold text-neutral-900">{q.question_text}</h3>
                <p className="mt-1 text-xs text-neutral-500">Valg · andel av svar</p>
                {entries.length === 0 ? (
                  <p className="mt-3 text-sm text-neutral-500">Ingen valgsvar registrert.</p>
                ) : null}
                {entries.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {entries
                      .sort((x, y) => y[1] - x[1])
                      .map(([k, v]) => <AnalyseBar key={k} label={k} valuePct={(v / total) * 100} />)}
                  </div>
                ) : null}
              </div>
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
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft>({
    questionText: '',
    questionType: 'rating_1_to_5',
    orderIndex: 0,
    isRequired: true,
    sectionId: null,
    config: {},
  })
  const [qOptionsLines, setQOptionsLines] = useState('')
  const [qConfigExtraJson, setQConfigExtraJson] = useState('{}')
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

  const sectionSelectOptions = useMemo(
    () => survey.surveySections.map((sec) => ({ value: sec.id, label: sec.title })),
    [survey.surveySections],
  )

  const nextQuestionOrderIndex = useCallback(
    (sectionId: string | null) => {
      const list = survey.questions.filter(
        (q) => q.survey_id === surveyId && (sectionId === null ? q.section_id == null : q.section_id === sectionId),
      )
      if (list.length === 0) return 0
      return Math.max(...list.map((q) => q.order_index)) + 1
    },
    [survey.questions, surveyId],
  )

  const openNewQuestion = useCallback(
    (sectionId: string | null = null) => {
      if (!s || !surveyId) return
      const baseType: SurveyQuestionType = 'rating_1_to_5'
      const defaults = defaultQuestionPayload(baseType)
      setEditingQ(null)
      setQuestionDraft({
        questionText: defaults.questionText,
        questionType: baseType,
        orderIndex: nextQuestionOrderIndex(sectionId),
        isRequired: true,
        sectionId,
        config: defaults.config,
      })
      setQOptionsLines('')
      setQConfigExtraJson('{}')
      setPanelOpen(true)
    },
    [s, surveyId, nextQuestionOrderIndex],
  )

  const openEditQuestion = useCallback((q: OrgSurveyQuestionRow) => {
    setEditingQ(q)
    setQuestionDraft({
      questionText: q.question_text,
      questionType: q.question_type,
      orderIndex: q.order_index,
      isRequired: q.is_required,
      sectionId: q.section_id ?? null,
      config:
        q.config && typeof q.config === 'object' && !Array.isArray(q.config)
          ? { ...(q.config as Record<string, unknown>) }
          : {},
    })
    const opts = (q.config as { options?: string[] } | undefined)?.options
    setQOptionsLines(Array.isArray(opts) ? opts.join('\n') : '')
    const cfg = q.config && typeof q.config === 'object' && !Array.isArray(q.config) ? { ...(q.config as object) } : {}
    const logicJump = 'logic_jump' in cfg ? { logic_jump: (cfg as { logic_jump?: unknown }).logic_jump } : {}
    const valRules =
      'validation_rules' in cfg ? { validation_rules: (cfg as { validation_rules?: unknown }).validation_rules } : {}
    try {
      setQConfigExtraJson(JSON.stringify({ ...logicJump, ...valRules }, null, 2))
    } catch {
      setQConfigExtraJson('{}')
    }
    setPanelOpen(true)
  }, [])

  const closePanel = useCallback(() => {
    setQuestionPanelError(null)
    setPanelOpen(false)
    setEditingQ(null)
  }, [])

  const saveQuestion = useCallback(async () => {
    if (!s || !surveyId || !questionDraft.questionText.trim()) return
    let baseConfig = { ...questionDraft.config }
    const needsOpts = (
      ['multiple_choice', 'single_select', 'multi_select', 'dropdown'] as SurveyQuestionType[]
    ).includes(questionDraft.questionType)
    if (needsOpts) {
      const opts = qOptionsLines
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
      baseConfig = { ...baseConfig, options: opts.length > 0 ? opts : ['Alternativ 1', 'Alternativ 2'] }
    }
    const merged = mergeQuestionConfig(baseConfig, qConfigExtraJson)
    if (merged.error) {
      setQuestionPanelError(merged.error)
      return
    }
    setQuestionPanelError(null)
    setQSaving(true)
    const row = await survey.upsertQuestion({
      id: editingQ?.id,
      surveyId,
      questionText: questionDraft.questionText.trim(),
      questionType: questionDraft.questionType,
      orderIndex: questionDraft.orderIndex,
      isRequired: questionDraft.isRequired,
      isMandatory: editingQ?.is_mandatory,
      mandatoryLaw: editingQ?.mandatory_law,
      config: merged.config,
      sectionId: questionDraft.sectionId,
    })
    setQSaving(false)
    if (row) closePanel()
  }, [
    s,
    surveyId,
    questionDraft,
    qOptionsLines,
    qConfigExtraJson,
    editingQ,
    survey,
    closePanel,
  ])

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
            <OversiktTab key={s.id} survey={survey} s={s} onOpenAmuTab={() => setTab('amu')} />
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
            <Button
              type="button"
              variant="primary"
              onClick={() => void saveQuestion()}
              disabled={qSaving || !questionDraft.questionText.trim()}
            >
              {qSaving ? 'Lagrer…' : 'Lagre'}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          {questionPanelError ? <WarningBox>{questionPanelError}</WarningBox> : null}
          <SurveyQuestionFormFields
            draft={questionDraft}
            onChange={(patch) => setQuestionDraft((d) => ({ ...d, ...patch }))}
            sectionOptions={sectionSelectOptions}
            optionsLines={qOptionsLines}
            onOptionsLinesChange={setQOptionsLines}
            configJson={qConfigExtraJson}
            onConfigJsonChange={setQConfigExtraJson}
          />

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
