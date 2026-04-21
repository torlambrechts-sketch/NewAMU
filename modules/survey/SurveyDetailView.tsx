import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ArrowLeft, Ghost, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'
import { SlidePanel } from '../../src/components/layout/SlidePanel'
import { WORKPLACE_MODULE_CARD, WORKPLACE_MODULE_CARD_SHADOW } from '../../src/components/layout/workplaceModuleSurface'
import { WorkplacePageHeading1 } from '../../src/components/layout/WorkplacePageHeading1'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
  LAYOUT_TABLE1_POSTINGS_TD,
} from '../../src/components/layout/layoutTable1PostingsKit'
import { WarningBox } from '../../src/components/ui/AlertBox'
import { Badge } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import { ComplianceBanner } from '../../src/components/ui/ComplianceBanner'
import { YesNoToggle } from '../../src/components/ui/FormToggles'
import { StandardInput } from '../../src/components/ui/Input'
import { SearchableSelect, type SelectOption } from '../../src/components/ui/SearchableSelect'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { Tabs, type TabItem } from '../../src/components/ui/Tabs'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useSurvey } from './useSurvey'
import { buildAnalyticsByQuestionId } from './surveyAnalytics'
import { QUESTION_TYPE_OPTIONS, questionTypeLabel, surveyStatusBadgeVariant, surveyStatusLabel } from './surveyLabels'
import type { OrgSurveyQuestionRow, SurveyQuestionType, SurveyRow } from './types'

type DetailTab = 'oversikt' | 'bygger' | 'svar' | 'analyse'

const TAB_ITEMS: TabItem[] = [
  { id: 'oversikt', label: 'Oversikt' },
  { id: 'bygger', label: 'Bygger' },
  { id: 'svar', label: 'Svar' },
  { id: 'analyse', label: 'Analyse' },
]

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

export function SurveyDetailView({ supabase }: Props) {
  const { surveyId } = useParams<{ surveyId: string }>()
  const navigate = useNavigate()
  const { organization } = useOrgSetupContext()
  const orgId = organization?.id
  const survey = useSurvey({ supabase })
  const [tab, setTab] = useState<DetailTab>('oversikt')
  const [titleEdit, setTitleEdit] = useState('')
  const [descEdit, setDescEdit] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)
  const [nameByUserId, setNameByUserId] = useState<Record<string, string>>({})

  const [panelOpen, setPanelOpen] = useState(false)
  const [editingQ, setEditingQ] = useState<OrgSurveyQuestionRow | null>(null)
  const [qText, setQText] = useState('')
  const [qType, setQType] = useState<SurveyQuestionType>('rating_1_to_5')
  const [qOrder, setQOrder] = useState('0')
  const [qRequired, setQRequired] = useState(true)
  const [qSaving, setQSaving] = useState(false)

  useEffect(() => {
    if (surveyId) void survey.loadSurveyDetail(surveyId)
  }, [surveyId, survey.loadSurveyDetail])

  const s: SurveyRow | null = survey.selectedSurvey

  useEffect(() => {
    if (s) {
      setTitleEdit(s.title)
      setDescEdit(s.description ?? '')
    }
  }, [s])

  useEffect(() => {
    if (!supabase || !orgId || !surveyId) return
    const uids = [...new Set(survey.responses.map((r) => r.user_id).filter((x): x is string => x != null))]
    if (uids.length === 0) {
      setNameByUserId({})
      return
    }
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('organization_id', orgId)
        .in('id', uids)
      if (cancelled) return
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
    return () => {
      cancelled = true
    }
  }, [supabase, orgId, surveyId, survey.responses])

  const questionTypeOptions: SelectOption[] = useMemo(
    () => QUESTION_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    [],
  )

  const analyticsByQuestion = useMemo(
    () => buildAnalyticsByQuestionId(survey.questions, survey.answers),
    [survey.questions, survey.answers],
  )

  const openNewQuestion = useCallback(() => {
    if (!s || !surveyId) return
    setEditingQ(null)
    setQText('')
    setQType('rating_1_to_5')
    setQOrder(String(survey.questions.length))
    setQRequired(true)
    setPanelOpen(true)
  }, [s, surveyId, survey.questions.length])

  const openEditQuestion = useCallback((q: OrgSurveyQuestionRow) => {
    setEditingQ(q)
    setQText(q.question_text)
    setQType(q.question_type)
    setQOrder(String(q.order_index))
    setQRequired(q.is_required)
    setPanelOpen(true)
  }, [])

  const closePanel = useCallback(() => {
    setPanelOpen(false)
    setEditingQ(null)
  }, [])

  const saveQuestion = useCallback(async () => {
    if (!s || !surveyId || !qText.trim()) return
    const order = Number.parseInt(qOrder, 10)
    if (!Number.isFinite(order)) return
    setQSaving(true)
    const row = await survey.upsertQuestion({
      id: editingQ?.id,
      surveyId,
      questionText: qText.trim(),
      questionType: qType,
      orderIndex: order,
      isRequired: qRequired,
    })
    setQSaving(false)
    if (row) closePanel()
  }, [s, surveyId, qText, qType, qOrder, qRequired, editingQ, survey, closePanel])

  const saveMetadata = useCallback(async () => {
    if (!s || !surveyId || !titleEdit.trim()) return
    setSavingMeta(true)
    const ok = await survey.updateSurvey(surveyId, { title: titleEdit.trim(), description: descEdit.trim() || null })
    setSavingMeta(false)
    if (ok) void survey.loadSurveyDetail(surveyId)
  }, [s, surveyId, titleEdit, descEdit, survey])

  const isLocked = !!(s && (s.status === 'active' || s.status === 'closed'))
  const panelTitleId = 'survey-question-panel-title'

  if (!surveyId) {
    return <TabEmpty message="Mangler undersøkelses-ID i URL." />
  }

  if (survey.loading && !s) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-neutral-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Laster undersøkelse…
      </div>
    )
  }

  if (!s) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/survey')}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Tilbake til liste
        </Button>
        <TabEmpty message="Undersøkelsen finnes ikke, eller du har ikke tilgang." />
      </div>
    )
  }

  return (
    <div className="flex flex-col space-y-6">
      <WorkplacePageHeading1
        breadcrumb={[
          { label: 'Arbeidsplass', to: '/workspace' },
          { label: 'Undersøkelser', to: '/survey' },
          { label: s.title },
        ]}
        title={s.title}
        description="Detaljert visning med faner for innstillinger, bygger, svar og analyse."
        headerActions={
          <Button type="button" variant="secondary" size="sm" onClick={() => navigate('/survey')}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Tilbake
          </Button>
        }
      />

      <ComplianceBanner title="Arbeidsmiljøloven Kap. 4 — Psykososialt arbeidsmiljø og Kartlegging">
        Systematisk kartlegging støtter vurdering av psykososiale forhold. Ved anonyme undersøkelser knyttes ikke svar til
        identifiserbare brukere i databasen.
      </ComplianceBanner>

      {survey.error ? <WarningBox>{survey.error}</WarningBox> : null}

      <div className={WORKPLACE_MODULE_CARD} style={WORKPLACE_MODULE_CARD_SHADOW}>
        <div className="p-5 md:p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={surveyStatusBadgeVariant(s.status)}>{surveyStatusLabel(s.status)}</Badge>
              {s.is_anonymous ? <Badge variant="info">Anonym</Badge> : <Badge variant="neutral">Identifisert</Badge>}
            </div>
            <Tabs
              className="w-full md:w-auto"
              items={TAB_ITEMS}
              activeId={tab}
              onChange={(id) => setTab(id as DetailTab)}
            />
          </div>

          {tab === 'oversikt' && (
            <div className="space-y-6 pt-2">
              <div className={WPSTD_FORM_ROW_GRID}>
                <div>
                  <p className="text-sm font-medium text-neutral-800">Innhold</p>
                  <p className="mt-1 text-sm text-neutral-600">Tittel og beskrivelse vises for administratorer. Publisering låser spørsmålene.</p>
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
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={savingMeta}
                      onClick={() => void saveMetadata()}
                    >
                      {savingMeta ? 'Lagrer…' : 'Lagre endringer'}
                    </Button>
                  ) : null}
                </div>
              </div>

              {survey.canManage && s.status === 'draft' ? (
                <div className="rounded-lg border border-neutral-200 bg-neutral-50/80 p-4">
                  <p className="text-sm font-medium text-neutral-800">Publisering</p>
                  <p className="mt-1 text-sm text-neutral-600">Når du publiserer, låses spørsmålene. Svar kan samles inn mens undersøkelsen er aktiv.</p>
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
                </div>
              ) : null}

              {survey.canManage && s.status === 'active' ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
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
                </div>
              ) : null}
            </div>
          )}

          {tab === 'bygger' && (
            <div className="pt-2">
              {survey.questions.length === 0 && !isLocked ? (
                <TabEmpty
                  message="Ingen spørsmål lagt til enda. Legg til spørsmål for å bygge undersøkelsen."
                  footer={
                    survey.canManage ? (
                      <Button type="button" variant="primary" onClick={openNewQuestion}>
                        <Plus className="h-4 w-4" aria-hidden />
                        Legg til spørsmål
                      </Button>
                    ) : null
                  }
                />
              ) : null}
              {survey.questions.length === 0 && isLocked ? (
                <TabEmpty message="Ingen spørsmål i denne undersøkelsen. Kontakt administrator for å få lagt inn spørsmål (gjelder særlig eldre utkast)." />
              ) : null}

              {survey.questions.length > 0 || survey.canManage ? (
                <LayoutTable1PostingsShell
                  wrap={false}
                  title="Spørsmål"
                  description="Rekkefølge, type og veiledning til deltakere. Redigering i eget panel — ikke inne i tabellen."
                  headerActions={
                    survey.canManage && !isLocked ? (
                      <Button type="button" variant="primary" size="sm" onClick={openNewQuestion}>
                        <Plus className="h-4 w-4" aria-hidden />
                        Legg til
                      </Button>
                    ) : isLocked ? (
                      <span className="text-xs text-neutral-500">Spørsmål er låst (publisert/lukket)</span>
                    ) : null
                  }
                  toolbar={
                    <span className="text-xs text-neutral-500">
                      {survey.questions.length} spørsmål · sortert etter indeks
                    </span>
                  }
                >
                  {survey.questions.length === 0 ? null : (
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                          <th className={LAYOUT_TABLE1_POSTINGS_TH}>#</th>
                          <th className={LAYOUT_TABLE1_POSTINGS_TH}>Spørsmål</th>
                          <th className={LAYOUT_TABLE1_POSTINGS_TH}>Type</th>
                          <th className={LAYOUT_TABLE1_POSTINGS_TH}>Må fylles</th>
                          <th className={`${LAYOUT_TABLE1_POSTINGS_TH} text-right`}>Handlinger</th>
                        </tr>
                      </thead>
                      <tbody>
                        {survey.questions.map((q) => (
                          <tr key={q.id} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                            <td className={LAYOUT_TABLE1_POSTINGS_TD}>{q.order_index}</td>
                            <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                              <span className="whitespace-normal text-neutral-900">{q.question_text}</span>
                            </td>
                            <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                              <Badge variant="info">{questionTypeLabel(q.question_type)}</Badge>
                            </td>
                            <td className={LAYOUT_TABLE1_POSTINGS_TD}>{q.is_required ? 'Ja' : 'Nei'}</td>
                            <td className={`${LAYOUT_TABLE1_POSTINGS_TD} text-right`}>
                              {survey.canManage && !isLocked ? (
                                <div className="inline-flex items-center justify-end gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    title="Rediger"
                                    onClick={() => openEditQuestion(q)}
                                  >
                                    <Pencil className="h-4 w-4" aria-hidden />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-600 hover:text-red-800"
                                    title="Slett"
                                    onClick={() => {
                                      if (!surveyId) return
                                      void survey.deleteQuestion(q.id, surveyId)
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" aria-hidden />
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-neutral-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </LayoutTable1PostingsShell>
              ) : null}
            </div>
          )}

          {tab === 'svar' && (
            <div className="pt-2">
              {survey.responses.length === 0 ? (
                <TabEmpty message="Ingen besvarelser mottatt ennå. Svar vises når deltakere har sendt inn." />
              ) : (
                <LayoutTable1PostingsShell
                  wrap={false}
                  title="Mottatte besvarelser"
                  description="Anonyme undersøkelser viser ikke sammenheng med navn. Identifiserte svar kobles til bruker der det er krevet i databasen."
                  toolbar={<span className="text-xs text-neutral-500">{survey.responses.length} svar</span>}
                >
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
                </LayoutTable1PostingsShell>
              )}
            </div>
          )}

          {tab === 'analyse' && (
            <div className="space-y-6 pt-2">
              {survey.questions.length === 0 ? (
                <TabEmpty message="Ingen spørsmål å analysere. Legg til spørsmål i byggeren." />
              ) : survey.answers.length === 0 && survey.responses.length === 0 ? (
                <TabEmpty message="Ingen svar å analysere ennå. Når deltakere svarer, oppdateres visningen her." />
              ) : (
                survey.questions.map((q) => {
                  const a = analyticsByQuestion[q.id]
                  if (q.question_type === 'rating_1_to_5') {
                    const n = a?.numbers.length ?? 0
                    const avg = n > 0 ? a!.numbers.reduce((x, y) => x + y, 0) / n : 0
                    return (
                      <div key={q.id} className="rounded-lg border border-neutral-200/90 bg-white p-5" style={WORKPLACE_MODULE_CARD_SHADOW}>
                        <h3 className="text-sm font-semibold text-neutral-900">{q.question_text}</h3>
                        <p className="mt-1 text-xs text-neutral-500">
                          Gjennomsnitt {n > 0 ? `${avg.toFixed(2)} (n=${n})` : '— (ingen svar)'}
                        </p>
                        {n === 0 ? (
                          <p className="mt-3 text-sm text-neutral-500">Ingen numeriske svar for dette spørsmålet.</p>
                        ) : null}
                        {n > 0 ? (
                          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                            <div
                              className="h-full rounded-full bg-[#1a3d32]"
                              style={{ width: `${Math.min(100, (avg / 5) * 100)}%` }}
                            />
                          </div>
                        ) : null}
                      </div>
                    )
                  }
                  if (q.question_type === 'text') {
                    const c = a?.textCount ?? 0
                    return (
                      <div key={q.id} className="rounded-lg border border-neutral-200/90 bg-white p-5" style={WORKPLACE_MODULE_CARD_SHADOW}>
                        <h3 className="text-sm font-semibold text-neutral-900">{q.question_text}</h3>
                        <p className="mt-1 text-xs text-neutral-500">Fritekst · {c} utfylt svar</p>
                        {c === 0 ? <p className="mt-3 text-sm text-neutral-500">Ingen fritektsvar mottatt.</p> : null}
                      </div>
                    )
                  }
                  const entries = Object.entries(a?.choiceCounts ?? {})
                  return (
                    <div key={q.id} className="rounded-lg border border-neutral-200/90 bg-white p-5" style={WORKPLACE_MODULE_CARD_SHADOW}>
                      <h3 className="text-sm font-semibold text-neutral-900">{q.question_text}</h3>
                      <p className="mt-1 text-xs text-neutral-500">Flervalg · andel av svar (lagret som tekst i databasen)</p>
                      {entries.length === 0 ? <p className="mt-3 text-sm text-neutral-500">Ingen flervalgssvar registrert.</p> : null}
                      {entries.length > 0 ? (
                        <div className="mt-4 space-y-3">
                          {(() => {
                            const total = entries.reduce((s, [, v]) => s + v, 0) || 1
                            return entries
                              .sort((x, y) => y[1] - x[1])
                              .map(([k, v]) => <AnalyseBar key={k} label={k} valuePct={(v / total) * 100} />)
                          })()}
                        </div>
                      ) : null}
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>

      <SlidePanel
        open={panelOpen}
        onClose={closePanel}
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
        </div>
      </SlidePanel>
    </div>
  )
}
