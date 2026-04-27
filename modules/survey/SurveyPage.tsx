import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Ghost, Loader2, Plus, Settings, ClipboardList } from 'lucide-react'
import { ModulePageShell, ModuleSectionCard } from '../../src/components/module'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../src/components/layout/layoutTable1PostingsKit'
import { Badge } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import { ComplianceBanner } from '../../src/components/ui/ComplianceBanner'
import { StandardInput } from '../../src/components/ui/Input'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { YesNoToggle } from '../../src/components/ui/FormToggles'
import { InfoBox, WarningBox } from '../../src/components/ui/AlertBox'
import { ALL_SURVEY_TEMPLATES } from '../../src/data/surveyTemplates'
import { useSurvey } from './useSurvey'
import { surveyStatusBadgeVariant, surveyStatusLabel } from './surveyLabels'
import type { SurveyQuestionType, SurveyRow } from './types'

type Props = { supabase: SupabaseClient | null }

const AML_4_3_MANDATORY_KEYWORDS = [
  'trakassering',
  'integritet',
  'medvirkning',
  'sikkerhet',
  'psykososial',
] as const

function isMandatoryAml4_3(text: string): boolean {
  const lower = text.toLowerCase()
  return AML_4_3_MANDATORY_KEYWORDS.some((k) => lower.includes(k))
}

function SurveyListEmpty() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Ghost className="h-12 w-12 text-neutral-300" strokeWidth={1.25} aria-hidden />
      <p className="max-w-sm text-sm text-neutral-500">Ingen undersøkelser opprettet ennå. Opprett den første for å komme i gang.</p>
    </div>
  )
}

export function SurveyPage({ supabase }: Props) {
  const navigate = useNavigate()
  const survey = useSurvey({ supabase })
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [creating, setCreating] = useState(false)

  const templateOptions = useMemo(
    () => [
      { value: '', label: 'Uten mal' },
      ...ALL_SURVEY_TEMPLATES.map((t) => ({ value: t.id, label: `${t.name} (${t.estimatedMinutes} min)` })),
    ],
    [],
  )

  const templateInfo = useMemo(
    () => (selectedTemplate ? ALL_SURVEY_TEMPLATES.find((t) => t.id === selectedTemplate) : undefined),
    [selectedTemplate],
  )

  const { loadSurveys } = survey
  useEffect(() => {
    void loadSurveys()
  }, [loadSurveys])

  const handleCreate = useCallback(async () => {
    if (!title.trim()) return
    setCreating(true)
    const row = await survey.createSurvey({
      title: title.trim(),
      description: description.trim() || null,
      is_anonymous: isAnonymous,
    })

    if (!row) {
      setCreating(false)
      return
    }

    if (selectedTemplate) {
      const tpl = ALL_SURVEY_TEMPLATES.find((t) => t.id === selectedTemplate)
      if (tpl) {
        for (let i = 0; i < tpl.questions.length; i++) {
          const q = tpl.questions[i]
          const qType: SurveyQuestionType =
            q.type === 'likert_5' || q.type === 'likert_7' || q.type === 'scale_10'
              ? 'rating_1_to_5'
              : q.type === 'yes_no'
                ? 'multiple_choice'
                : 'text'
          const mandatory = isMandatoryAml4_3(q.text)
          await survey.upsertQuestion({
            surveyId: row.id,
            questionText: q.text,
            questionType: qType,
            orderIndex: i,
            isRequired: q.required,
            isMandatory: mandatory,
            mandatoryLaw: mandatory ? 'AML_4_3' : null,
          })
        }
      }
    }

    setCreating(false)
    setTitle('')
    setDescription('')
    setSelectedTemplate('')
    setIsAnonymous(false)
    navigate(`/survey/${row.id}`)
  }, [title, description, isAnonymous, selectedTemplate, survey, navigate])

  const rows = survey.surveys

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'Arbeidsplass', to: '/workspace' }, { label: 'Undersøkelser' }]}
      title="Organisasjonsundersøkelser"
      description="Kartlegging av psykososialt arbeidsmiljø — opprett, publiser og analyser svar innenfor virksomheten."
      headerActions={
        survey.canManage ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => navigate('/survey/admin')}>
            <Settings className="h-4 w-4" aria-hidden />
            Modulinnstillinger
          </Button>
        ) : null
      }
    >
      <div className="space-y-6">
        <ComplianceBanner title="Lovkrav og personvern">
          Systematisk kartlegging (AML § 3-1, § 4-1, § 4-3, § 7-2) og oppfølging (IK-forskriften § 5). Resultater
          presenteres for AMU og vernombud. Personvern (GDPR): resultater for grupper vises ikke når antall respondenter
          er under terskelen.
        </ComplianceBanner>

        {survey.error && <WarningBox>{survey.error}</WarningBox>}

        {survey.canManage && (
          <ModuleSectionCard className="p-5 md:p-6">
            <h2 className="mb-2 text-lg font-semibold text-neutral-900">Ny undersøkelse</h2>
            <p className="mb-6 text-sm text-neutral-600">
              Opprett en undersøkelse. Du legger til egne spørsmål og publiserer når den er klar, eller start fra en ferdig
              valider mal.
            </p>
            <div className={WPSTD_FORM_ROW_GRID}>
              <div>
                <p className="text-sm font-medium text-neutral-800">Grunnleggende</p>
                <p className="mt-1 text-sm text-neutral-600">
                  Velg en mal for å importere validerte spørsmål, eller start blank. Du legger til egne spørsmål og
                  publiserer når undersøkelsen er klar.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="survey-title">
                    Tittel
                  </label>
                  <StandardInput
                    id="survey-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="F.eks. Psykososialt klima 2026"
                  />
                </div>
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="survey-desc">
                    Beskrivelse
                  </label>
                  <StandardTextarea
                    id="survey-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Valgfri introduksjon til deltakerne"
                  />
                </div>
                <div>
                  <span className={WPSTD_FORM_FIELD_LABEL}>Anonym undersøkelse</span>
                  <p className="text-xs text-neutral-500">
                    Når aktivert lagres ingen bruker-ID på svar (personvern / GDPR).
                  </p>
                  <div className="mt-2 max-w-xs">
                    <YesNoToggle value={isAnonymous} onChange={setIsAnonymous} />
                  </div>
                </div>
                <div>
                  <span className={WPSTD_FORM_FIELD_LABEL}>Mal (valgfritt)</span>
                  <SearchableSelect
                    value={selectedTemplate}
                    options={templateOptions}
                    onChange={setSelectedTemplate}
                    placeholder="Velg mal eller la stå blank"
                  />
                  {templateInfo && (
                    <InfoBox>
                      {templateInfo.description} · Estimert tid: {templateInfo.estimatedMinutes} min · {templateInfo.scoringNote}
                    </InfoBox>
                  )}
                </div>
                <div>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={creating || !title.trim() || survey.loading}
                    onClick={() => void handleCreate()}
                  >
                    {creating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Oppretter…
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" aria-hidden />
                        Opprett kladd
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </ModuleSectionCard>
        )}

        {!survey.canManage && (
          <p className="text-sm text-neutral-600">
            Du har innsyn i listen. Redigering krever tilgangen «Undersøkelse — administrasjon».
          </p>
        )}

        <ModuleSectionCard className="p-5 md:p-6">
          <h2 className="mb-1 text-lg font-semibold text-neutral-900">Registrerte undersøkelser</h2>
          <p className="mb-4 text-sm text-neutral-600">Åpne en undersøkelse for detaljer, spørsmål, svar og analyse.</p>
          <LayoutTable1PostingsShell
            wrap={false}
            title="Registrerte undersøkelser"
            description="Klikk «Åpne» for å gå til detaljvisningen."
            toolbar={<span className="text-xs text-neutral-500">{rows.length} registrert</span>}
          >
            {survey.loading && rows.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Laster…
              </div>
            ) : rows.length === 0 ? (
              <SurveyListEmpty />
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Oppdatert</th>
                      <th className={`${LAYOUT_TABLE1_POSTINGS_TH} text-right`}>Handling</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r: SurveyRow) => (
                      <tr key={r.id} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                        <td className="px-5 py-3 align-middle text-sm text-neutral-900">
                          <Link to={`/survey/${r.id}`} className="font-medium text-[#1a3d32] hover:underline">
                            {r.title}
                          </Link>
                          {r.description ? (
                            <div className="mt-0.5 max-w-md truncate text-xs font-normal text-neutral-500">
                              {r.description}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-5 py-3 align-middle">
                          <Badge variant={surveyStatusBadgeVariant(r.status)}>{surveyStatusLabel(r.status)}</Badge>
                        </td>
                        <td className="px-5 py-3 align-middle text-xs text-neutral-600">
                          {new Date(r.updated_at).toLocaleString('nb-NO')}
                        </td>
                        <td className="px-5 py-3 text-right align-middle">
                          <Button type="button" variant="secondary" size="sm" onClick={() => navigate(`/survey/${r.id}`)}>
                            <ClipboardList className="h-4 w-4" aria-hidden />
                            Åpne
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </LayoutTable1PostingsShell>
        </ModuleSectionCard>
      </div>
    </ModulePageShell>
  )
}
