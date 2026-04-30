import { useCallback, useEffect, useMemo, useState, useRef, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ArrowLeft, CheckCircle2, Eye, Ghost, Save, Trash2 } from 'lucide-react'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'
import { SlidePanel } from '../../src/components/layout/SlidePanel'
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
import { useSurvey } from './useSurvey'
import type { UseSurveyState } from './useSurvey'
import { SurveyResponseReadPanel } from './SurveyResponseReadPanel'
import { surveyStatusBadgeVariant, surveyStatusLabel } from './surveyLabels'
import { globalQuestionIdOrder } from './surveyQuestionGlobalOrder'
import { SurveySectionBuilder } from './SurveySectionBuilder'
import { SurveyQuestionFormFields, type QuestionDraft } from './SurveyQuestionFormFields'
import { defaultQuestionPayload } from './surveyQuestionDefaults'
import { SurveyAmuTab } from './tabs/SurveyAmuTab'
import { SurveyDistribusjonTab } from './tabs/SurveyDistribusjonTab'
import { SurveyTiltakTab } from './tabs/SurveyTiltakTab'
import { SURVEY_DETAIL_EXTRA_LEGAL_REFERENCES, SURVEY_MODULE_LEGAL_REFERENCES } from './surveyLegalReferences'
import { orgQuestionToCatalogQuestion } from './surveyTemplateCatalogHelpers'
import { suggestionsForSurveyPurpose, type PurposeSuggestion } from './surveyPurposeSuggestions'
import { SurveyAnalyseTab } from './SurveyAnalyseTab'
import type { OrgSurveyQuestionRow, OrgSurveyResponseRow, SurveyAmuReviewRow, SurveyQuestionType, SurveyRow } from './types'

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
    return { config: baseConfig, error: 'Ugyldig JSON i teknisk konfigurasjon.' }
  }
  const cfg = { ...baseConfig, ...extra }
  return { config: cfg, error: null }
}

/** Fjerner felter som lagres i sidens JSON-sløyfe (showIf, logic_jump, validation_rules). */
function configForQuestionForm(base: Record<string, unknown>): Record<string, unknown> {
  const c = { ...base }
  delete c.showIf
  delete c.logic_jump
  delete c.validation_rules
  return c
}

function extraJsonFromStoredQuestionConfig(cfg: Record<string, unknown> | undefined): string {
  if (!cfg || typeof cfg !== 'object') return '{}'
  const o: Record<string, unknown> = {}
  if (cfg.showIf != null) o.showIf = cfg.showIf
  if (cfg.logic_jump != null) o.logic_jump = cfg.logic_jump
  if (cfg.validation_rules != null) o.validation_rules = cfg.validation_rules
  try {
    return JSON.stringify(o, null, 2)
  } catch {
    return '{}'
  }
}

type DetailTab = 'oversikt' | 'bygger' | 'distribusjon' | 'svar' | 'analyse' | 'amu' | 'tiltak'

function surveyWorkflowSteps(params: {
  status: SurveyRow['status']
  responseCount: number
}) {
  const { status, responseCount } = params
  const published = status === 'active' || status === 'closed' || status === 'archived'
  return [
    { id: 'draft', label: 'Kladd og spørsmål', done: published },
    { id: 'pub', label: 'Publisert / åpen', done: published },
    { id: 'resp', label: 'Mottar svar', done: responseCount > 0 },
    { id: 'anl', label: 'Analyse', done: responseCount > 0 },
    { id: 'closed', label: 'Lukket', done: status === 'closed' || status === 'archived' },
  ]
}

function buildTabs(
  responseCount: number,
  actionCount: number,
  amuReview: SurveyAmuReviewRow | null,
  pendingInvites: number,
  hideAmuAndTiltak: boolean,
): TabItem[] {
  const items: TabItem[] = [
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
  if (hideAmuAndTiltak) {
    return items.filter((t) => t.id !== 'amu' && t.id !== 'tiltak')
  }
  return items
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
  isOrgAdmin,
}: {
  survey: UseSurveyState
  s: SurveyRow
  onOpenAmuTab: () => void
  isOrgAdmin: boolean
}) {
  const [titleEdit, setTitleEdit] = useState(s.title)
  const [descEdit, setDescEdit] = useState(s.description ?? '')
  const [purposeEdit, setPurposeEdit] = useState(s.survey_purpose ?? '')
  const [amuSummaryEdit, setAmuSummaryEdit] = useState(s.survey_amu_summary ?? '')
  const [savingMeta, setSavingMeta] = useState(false)

  const amuGate = useMemo(() => {
    if (s.survey_type !== 'internal' || !s.amu_review_required) return null
    const steps = amuComplianceSteps(s, survey.amuReview)
    const complete = steps.every((x) => x.ok)
    return { steps, complete }
  }, [s, survey.amuReview])

  const saveMetadata = useCallback(async () => {
    if (!titleEdit.trim()) return
    setSavingMeta(true)
    const ok = await survey.updateSurvey(s.id, {
      title: titleEdit.trim(),
      description: descEdit.trim() || null,
      survey_purpose: purposeEdit.trim() || null,
      survey_amu_summary: amuSummaryEdit.trim() || null,
    })
    setSavingMeta(false)
    if (ok) void survey.loadSurveyDetail(s.id)
  }, [s.id, titleEdit, descEdit, purposeEdit, amuSummaryEdit, survey])

  const amuBriefingText = useMemo(() => {
    const lines: string[] = []
    lines.push(`Undersøkelse: ${s.title}`)
    if (purposeEdit.trim()) lines.push(`Formål: ${purposeEdit.trim()}`)
    if (amuSummaryEdit.trim()) lines.push(`Oppsummering til AMU: ${amuSummaryEdit.trim()}`)
    lines.push('')
    lines.push('Status i portalen:')
    for (const step of amuComplianceSteps(s, survey.amuReview)) {
      lines.push(`${step.ok ? '✓' : '○'} ${step.label}`)
    }
    lines.push('')
    lines.push(
      'Personvern: presenter kun aggregerte tall for AMU. Ikke del enkeltvise fritekstsvar uten egen vurdering.',
    )
    return lines.join('\n')
  }, [s, survey.amuReview, purposeEdit, amuSummaryEdit])

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
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sv-purpose">
                Formål med undersøkelsen
              </label>
              <p className="text-xs text-neutral-500">
                Skriv kort hva dere vil finne ut av — brukes til forslag når dere legger til spørsmål i byggeren (for
                eksempel «psykososialt klima», «AML», «leverandør»).
              </p>
              <StandardTextarea
                id="sv-purpose"
                value={purposeEdit}
                onChange={(e) => setPurposeEdit(e.target.value)}
                rows={2}
                disabled={!survey.canManage || s.status === 'closed'}
                placeholder="F.eks. Kartlegge trivsel og belastning før årsrapport til AMU"
              />
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sv-amu-sum">
                Kort tekst til AMU / årsrapport (valgfritt)
              </label>
              <p className="text-xs text-neutral-500">
                Kan limes inn som innledning når dere presenter tall — ikke personidentifiserende.
              </p>
              <StandardTextarea
                id="sv-amu-sum"
                value={amuSummaryEdit}
                onChange={(e) => setAmuSummaryEdit(e.target.value)}
                rows={3}
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(amuBriefingText)
                }}
              >
                Kopier AMU-utkast til utklippstavlen
              </Button>
            </div>
          ) : (
            <div className="mt-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(amuBriefingText)
                }}
              >
                Kopier AMU-utkast til utklippstavlen
              </Button>
            </div>
          )}
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
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                if (
                  typeof window !== 'undefined' &&
                  !window.confirm(
                    'Vil du publisere undersøkelsen? Spørsmålene låses og kan ikke endres etterpå.',
                  )
                ) {
                  return
                }
                void survey.publishSurvey(s.id)
              }}
            >
              Publiser
            </Button>
            {isOrgAdmin ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  void survey.dispatchOnSurveyPublished(s.id)
                }}
              >
                Kjør arbeidsflyt (publisert)
              </Button>
            ) : null}
          </div>
        </ModuleSectionCard>
      ) : null}

      {survey.canManage && s.status === 'active' ? (
        <ModuleSectionCard className="border-amber-200 bg-amber-50/60 p-5 md:p-6">
          <p className="text-sm font-medium text-amber-950">Lukk undersøkelsen</p>
          <p className="mt-1 text-sm text-amber-900/80">Lukk når innsamlingen er ferdig. Nye svar stoppes.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (
                  typeof window !== 'undefined' &&
                  !window.confirm(
                    'Vil du lukke undersøkelsen? Ingen nye svar kan sendes inn etter lukking.',
                  )
                ) {
                  return
                }
                void survey.closeSurvey(s.id)
              }}
            >
              Lukk undersøkelse
            </Button>
            {isOrgAdmin ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  void survey.dispatchOnSurveyClosed(s.id)
                }}
              >
                Kjør arbeidsflyt (lukket)
              </Button>
            ) : null}
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
  onOpenResponse,
}: {
  survey: UseSurveyState
  s: SurveyRow
  nameByUserId: Record<string, string>
  onOpenResponse: (r: OrgSurveyResponseRow) => void
}) {
  const canViewIndividual = !s.is_anonymous

  return (
    <div>
      {survey.responses.length === 0 ? (
        <TabEmpty message="Ingen besvarelser mottatt ennå. Svar vises når deltakere har sendt inn." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200/80 bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight text-neutral-900">Mottatte besvarelser</h2>
              <p className="mt-1 text-sm text-neutral-600">
                {canViewIndividual
                  ? 'Identifiserte undersøkelser: åpne en rad for å se alle svar i sidefeltet.'
                  : 'Anonyme undersøkelser viser ikke sammenheng med navn eller enkeltvise svar.'}
              </p>
            </div>
            <span className="text-xs text-neutral-500">{survey.responses.length} svar</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                  <th className="py-3 pl-5 pr-4">#</th>
                  <th className="py-3 pr-4">Innsendt</th>
                  <th className="py-3 pr-4">Deltaker</th>
                  <th className="py-3 pr-5 text-right">Handling</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {survey.responses.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-neutral-50/80">
                    <td className="py-3.5 pl-5 pr-4 tabular-nums text-neutral-600">{idx + 1}</td>
                    <td className="py-3.5 pr-4 text-neutral-700">
                      {new Date(r.submitted_at).toLocaleString('nb-NO')}
                    </td>
                    <td className="py-3.5 pr-4">
                      {s.is_anonymous || r.user_id == null ? (
                        <span className="text-neutral-500">Anonym besvarelse</span>
                      ) : (
                        <span className="font-medium text-neutral-900">{nameByUserId[r.user_id!] ?? 'Bruker'}</span>
                      )}
                    </td>
                    <td className="py-3.5 pr-5 text-right">
                      {canViewIndividual && r.user_id != null ? (
                        <button
                          type="button"
                          onClick={() => onOpenResponse(r)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-700 shadow-sm hover:bg-neutral-50"
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden />
                          Se svar
                        </button>
                      ) : (
                        <span className="text-xs text-neutral-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}


export function SurveyDetailView({ supabase }: Props) {
  const { surveyId } = useParams<{ surveyId: string }>()
  const navigate = useNavigate()
  const { organization, profile } = useOrgSetupContext()
  const isOrgAdmin = profile?.is_org_admin === true
  const orgId = organization?.id
  const survey = useSurvey({ supabase })
  const [tab, setTab] = useState<DetailTab>('oversikt')
  const [nameByUserId, setNameByUserId] = useState<Record<string, string>>({})
  const profileFetchId = useRef(0)

  const [panelOpen, setPanelOpen] = useState(false)
  const [responsePanelOpen, setResponsePanelOpen] = useState(false)
  const [viewingResponse, setViewingResponse] = useState<OrgSurveyResponseRow | null>(null)
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

  const hideAmuAndTiltak =
    s?.survey_type !== 'internal' || Boolean((s?.vendor_name ?? '').trim()) || Boolean((s?.vendor_org_number ?? '').trim())

  const tabs = useMemo(
    () =>
      buildTabs(
        survey.responses.length,
        survey.actionPlans.filter((p) => p.status !== 'closed').length,
        survey.amuReview,
        pendingInviteCount,
        hideAmuAndTiltak,
      ),
    [
      survey.responses.length,
      survey.actionPlans,
      survey.amuReview,
      pendingInviteCount,
      hideAmuAndTiltak,
    ],
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

  const responseParticipantLabel = useMemo(() => {
    if (!viewingResponse) return ''
    if (!s || s.is_anonymous || viewingResponse.user_id == null) return 'Anonym besvarelse'
    return nameByUserId[viewingResponse.user_id] ?? 'Bruker'
  }, [viewingResponse, s, nameByUserId])

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
    const rawCfg =
      q.config && typeof q.config === 'object' && !Array.isArray(q.config)
        ? { ...(q.config as Record<string, unknown>) }
        : {}
    setQuestionDraft({
      questionText: q.question_text,
      questionType: q.question_type,
      orderIndex: q.order_index,
      isRequired: q.is_required,
      sectionId: q.section_id ?? null,
      config: configForQuestionForm(rawCfg),
    })
    const opts = (q.config as { options?: string[] } | undefined)?.options
    setQOptionsLines(Array.isArray(opts) ? opts.join('\n') : '')
    setQConfigExtraJson(extraJsonFromStoredQuestionConfig(rawCfg))
    setPanelOpen(true)
  }, [])

  const closeResponsePanel = useCallback(() => {
    setResponsePanelOpen(false)
    setViewingResponse(null)
  }, [])

  const openResponsePanel = useCallback((r: OrgSurveyResponseRow) => {
    setViewingResponse(r)
    setResponsePanelOpen(true)
  }, [])

  const closePanel = useCallback(() => {
    setQuestionPanelError(null)
    setPanelOpen(false)
    setEditingQ(null)
  }, [])

  const saveQuestion = useCallback(async () => {
    if (!s || !surveyId || !questionDraft.questionText.trim()) return
    let baseConfig = configForQuestionForm({ ...questionDraft.config })
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

  const purposeSuggestions = useMemo(
    () =>
      suggestionsForSurveyPurpose(
        survey.selectedSurvey?.survey_purpose ?? null,
        survey.selectedSurvey?.survey_type ?? 'internal',
      ),
    [survey.selectedSurvey?.survey_purpose, survey.selectedSurvey?.survey_type],
  )

  const conditionQuestionOptions = useMemo(() => {
    if (!surveyId) return []
    const order = globalQuestionIdOrder(survey.questions, surveyId, survey.surveySections)
    const m = new Map(survey.questions.map((q) => [q.id, q]))
    return order
      .map((id) => m.get(id))
      .filter((q): q is OrgSurveyQuestionRow => q != null)
      .map((q) => ({ id: q.id, label: q.question_text || 'Uten tittel' }))
  }, [survey.questions, survey.surveySections, surveyId])

  const applyPurposeSuggestion = useCallback((p: PurposeSuggestion) => {
    const payload = defaultQuestionPayload(p.questionType)
    setQuestionDraft((d) => ({
      ...d,
      questionText: p.questionText,
      questionType: p.questionType,
      config: payload.config,
    }))
    if (['multiple_choice', 'single_select', 'multi_select', 'dropdown'].includes(p.questionType)) {
      const opts = (payload.config as { options?: string[] }).options
      setQOptionsLines(Array.isArray(opts) ? opts.join('\n') : '')
    } else {
      setQOptionsLines('')
    }
  }, [])

  const isLocked = !!(s && (s.status === 'active' || s.status === 'closed'))
  const panelTitleId = 'survey-question-panel-title'
  const responsePanelTitleId = 'survey-response-read-panel-title'

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
        tabs={
          <Tabs
            className="w-full md:w-auto"
            items={tabs}
            activeId={tab}
            onChange={(id) => {
              const next = id as DetailTab
              if (hideAmuAndTiltak && (next === 'amu' || next === 'tiltak')) {
                setTab('oversikt')
                return
              }
              setTab(next)
            }}
          />
        }
        loading={false}
      >
        <div className="w-full space-y-6">
          <div className="mb-2 flex flex-wrap items-center gap-3 border-b border-neutral-200 pb-4">
            <Badge variant={surveyStatusBadgeVariant(s.status)}>{surveyStatusLabel(s.status)}</Badge>
            {s.is_anonymous ? <Badge variant="info">Anonym</Badge> : <Badge variant="neutral">Identifisert</Badge>}
          </div>

          <div className="overflow-hidden rounded-lg border border-neutral-200/80 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Fremdrift</p>
              <span className="rounded-full bg-[#1a3d32] px-2 py-0.5 text-[10px] font-bold text-white">
                {surveyWorkflowSteps({ status: s.status, responseCount: survey.responses.length }).filter((x) => x.done).length}
                /5
              </span>
            </div>
            <ul className="divide-y divide-neutral-100">
              {surveyWorkflowSteps({
                status: s.status,
                responseCount: survey.responses.length,
              }).map((st, i) => (
                <li key={st.id} className="flex gap-3 px-4 py-3">
                  <div
                    className={[
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                      st.done ? 'bg-emerald-600 text-white' : 'border border-neutral-200 bg-neutral-50 text-neutral-500',
                    ].join(' ')}
                    aria-hidden
                  >
                    {st.done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${st.done ? 'font-medium text-neutral-900' : 'text-neutral-700'}`}>{st.label}</p>
                    <p className="mt-0.5 text-xs text-neutral-400">{st.done ? 'Fullført' : 'Venter'}</p>
                  </div>
                </li>
              ))}
            </ul>
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
            <OversiktTab
              key={`${s.id}:${s.updated_at}`}
              survey={survey}
              s={s}
              onOpenAmuTab={() => setTab('amu')}
              isOrgAdmin={isOrgAdmin}
            />
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

          {tab === 'svar' && (
            <SvarTab survey={survey} s={s} nameByUserId={nameByUserId} onOpenResponse={openResponsePanel} />
          )}

          {tab === 'analyse' && <SurveyAnalyseTab survey={survey} s={s} supabase={supabase} />}

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
            purposeSuggestions={purposeSuggestions}
            onApplySuggestion={applyPurposeSuggestion}
            conditionQuestionOptions={conditionQuestionOptions}
            currentQuestionId={editingQ?.id ?? null}
            showAdvancedJson={isOrgAdmin}
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

      <SlidePanel
        open={responsePanelOpen && viewingResponse != null}
        onClose={closeResponsePanel}
        titleId={responsePanelTitleId}
        title="Besvarelse"
        footer={
          <div className="flex w-full justify-end">
            <Button type="button" variant="secondary" onClick={closeResponsePanel}>
              Lukk
            </Button>
          </div>
        }
      >
        {viewingResponse ? (
          <SurveyResponseReadPanel
            response={viewingResponse}
            questions={survey.questions}
            sections={survey.surveySections}
            answers={survey.answers}
            participantLabel={responseParticipantLabel}
          />
        ) : null}
      </SlidePanel>
    </>
  )
}
