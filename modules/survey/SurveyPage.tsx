import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ClipboardList,
  LayoutGrid,
  Loader2,
  Package,
  Plus,
  Settings,
  Truck,
} from 'lucide-react'
import { ModuleLegalBanner, ModulePageShell } from '../../src/components/module'
import { ComplianceBanner } from '../../src/components/ui/ComplianceBanner'
import { SlidePanel } from '../../src/components/layout/SlidePanel'
import { WPSTD_FORM_FIELD_LABEL } from '../../src/components/layout/WorkplaceStandardFormPanel'
import { Button } from '../../src/components/ui/Button'
import { StandardInput } from '../../src/components/ui/Input'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import { YesNoToggle } from '../../src/components/ui/FormToggles'
import { InfoBox, WarningBox } from '../../src/components/ui/AlertBox'
import { Tabs, type TabItem } from '../../src/components/ui/Tabs'
import { ALL_SURVEY_TEMPLATES } from '../../src/data/surveyTemplates'
import { useSurvey } from './useSurvey'
import type { SurveyTemplateCatalogRow } from './surveyTemplateCatalogTypes'
import { SURVEY_TYPE_OPTIONS } from './surveyLabels'
import type { SurveyQuestionType, SurveyType } from './types'
import { SurveyOversiktModuleTab } from './tabs/SurveyOversiktModuleTab'
import { SurveyKampanjerTab } from './tabs/SurveyKampanjerTab'
import { SurveyMalerTab } from './tabs/SurveyMalerTab'
import { SurveyLeverandorerTab } from './tabs/SurveyLeverandorerTab'
import { SURVEY_MODULE_LEGAL_REFERENCES } from './surveyLegalReferences'
import { mandatoryFromCatalogQuestion } from './surveyMandatoryLaw'

type Props = { supabase: SupabaseClient | null }

type ModuleTab = 'oversikt' | 'kampanjer' | 'maler' | 'leverandorer'

export function SurveyPage({ supabase }: Props) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const survey = useSurvey({ supabase })
  const [tab, setTab] = useState<ModuleTab>('oversikt')

  // Create panel state
  const [panelOpen, setPanelOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [surveyType, setSurveyType] = useState<SurveyType>('internal')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [vendorOrgNumber, setVendorOrgNumber] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [purpose, setPurpose] = useState('')
  const [creating, setCreating] = useState(false)

  const templateOptions = useMemo(() => {
    const fromDb = survey.templateCatalog.map((t) => ({
      value: t.id,
      label: `${t.name} (~${t.estimated_minutes} min)`,
    }))
    const ids = new Set(fromDb.map((o) => o.value))
    const fallback = ALL_SURVEY_TEMPLATES.filter((t) => !ids.has(t.id)).map((t) => ({
      value: t.id,
      label: `${t.name} (${t.estimatedMinutes} min)`,
    }))
    return [{ value: '', label: 'Uten mal' }, ...fromDb, ...fallback]
  }, [survey.templateCatalog])

  const templateInfo = useMemo((): SurveyTemplateCatalogRow | undefined => {
    if (!selectedTemplate) return undefined
    const fromCat = survey.templateCatalog.find((t) => t.id === selectedTemplate)
    if (fromCat) return fromCat
    const legacy = ALL_SURVEY_TEMPLATES.find((t) => t.id === selectedTemplate)
    if (!legacy) return undefined
    return {
      id: legacy.id,
      is_system: true,
      name: legacy.name,
      short_name: legacy.shortName,
      description: legacy.description,
      source: legacy.source,
      use_case: legacy.useCase,
      category: legacy.category,
      audience: 'internal',
      estimated_minutes: legacy.estimatedMinutes,
      recommend_anonymous: legacy.recommendAnonymous,
      scoring_note: legacy.scoringNote,
      law_ref: null,
      body: { version: 1, questions: [] },
      is_active: true,
    }
  }, [selectedTemplate, survey.templateCatalog])

  const { loadSurveys, loadTemplateCatalog } = survey
  useEffect(() => {
    void loadSurveys()
  }, [loadSurveys])

  const tabFromUrl = searchParams.get('tab')
  useEffect(() => {
    if (tabFromUrl === 'maler' || tabFromUrl === 'kampanjer' || tabFromUrl === 'leverandorer' || tabFromUrl === 'oversikt') {
      setTab(tabFromUrl)
    }
  }, [tabFromUrl])

  useEffect(() => {
    if (tab === 'maler') void loadTemplateCatalog()
  }, [tab, loadTemplateCatalog])

  const openPanel = useCallback((type: SurveyType = 'internal') => {
    setSurveyType(type)
    setTitle('')
    setDescription('')
    setIsAnonymous(false)
    setStartDate('')
    setEndDate('')
    setVendorName('')
    setVendorOrgNumber('')
    setSelectedTemplate('')
    setPurpose('')
    setPanelOpen(true)
  }, [])

  const closePanel = useCallback(() => {
    setPanelOpen(false)
  }, [])

  const handleCreate = useCallback(async () => {
    if (!title.trim()) return
    setCreating(true)
    const row = await survey.createSurvey({
      title: title.trim(),
      description: description.trim() || null,
      is_anonymous: isAnonymous,
      survey_type: surveyType,
      start_date: startDate || null,
      end_date: endDate || null,
      vendor_name: vendorName.trim() || null,
      vendor_org_number: vendorOrgNumber.trim() || null,
      survey_purpose: purpose.trim() || null,
    })

    if (!row) {
      setCreating(false)
      return
    }

    if (selectedTemplate) {
      const applied = await survey.applyTemplateToSurvey(row.id, selectedTemplate)
      if (!applied) {
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
            const { isMandatory, mandatoryLaw } = mandatoryFromCatalogQuestion(q)
            await survey.upsertQuestion({
              surveyId: row.id,
              questionText: q.text,
              questionType: qType,
              orderIndex: i,
              isRequired: q.required,
              isMandatory,
              mandatoryLaw,
            })
          }
        } else {
          setCreating(false)
          return
        }
      }
    }

    setCreating(false)
    closePanel()
    navigate(`/survey/${row.id}`)
  }, [title, description, isAnonymous, surveyType, startDate, endDate, vendorName, vendorOrgNumber, purpose, selectedTemplate, survey, closePanel, navigate])

  const handleUseTemplate = useCallback(
    (templateId: string) => {
      const tpl = survey.templateCatalog.find((t) => t.id === templateId)
      const legacy = ALL_SURVEY_TEMPLATES.find((t) => t.id === templateId)
      setSelectedTemplate(templateId)
      if (tpl) {
        setTitle(tpl.name)
        setDescription(tpl.description ?? '')
        setIsAnonymous(tpl.recommend_anonymous)
        setSurveyType(tpl.audience === 'external' ? 'external' : 'internal')
        setTab('kampanjer')
        openPanel(tpl.audience === 'external' ? 'external' : 'internal')
      } else if (legacy) {
        setTitle(legacy.name)
        setDescription(legacy.description ?? '')
        setIsAnonymous(legacy.recommendAnonymous)
        setSurveyType('internal')
        setTab('kampanjer')
        openPanel('internal')
      } else {
        setTab('kampanjer')
        openPanel('internal')
      }
    },
    [openPanel, survey.templateCatalog],
  )

  const isExternal = surveyType === 'external'

  const moduleTabs: TabItem[] = useMemo(
    () => [
      { id: 'oversikt', label: 'Oversikt', icon: LayoutGrid },
      {
        id: 'kampanjer',
        label: 'Kampanjer',
        icon: ClipboardList,
        badgeCount: survey.surveys.length > 0 ? survey.surveys.length : undefined,
      },
      { id: 'maler', label: 'Maler', icon: Package },
      {
        id: 'leverandorer',
        label: 'Leverandører',
        icon: Truck,
        badgeCount: survey.surveys.filter((s) => s.survey_type === 'external').length || undefined,
      },
    ],
    [survey.surveys],
  )

  return (
    <>
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'Undersøkelser' }]}
        title="Undersøkelser"
        description="Kartlegg arbeidsmiljø, mål psykososiale forhold, og innhent dokumentasjon fra leverandører."
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            {survey.canManage && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<Settings className="h-4 w-4" />}
                  onClick={() => navigate('/survey/admin')}
                >
                  <span className="hidden sm:inline">Innstillinger</span>
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => openPanel('internal')}
                >
                  Ny undersøkelse
                </Button>
              </>
            )}
          </div>
        }
        tabs={
          <Tabs
            className="w-full md:w-auto"
            overflow="scroll"
            items={moduleTabs}
            activeId={tab}
            onChange={(id) => {
              const next = id as ModuleTab
              setTab(next)
              setSearchParams(
                (prev) => {
                  const p = new URLSearchParams(prev)
                  p.set('tab', next)
                  return p
                },
                { replace: true },
              )
            }}
          />
        }
      >
        <ModuleLegalBanner
          title="Organisasjonsundersøkelser"
          intro={
            <p>
              Kartlegging av arbeidsmiljø, psykososiale forhold og leverandørdokumentasjon forankres i
              arbeidsmiljøloven, personvernregelverket og — for leverandører — åpenhetsloven.
            </p>
          }
          references={SURVEY_MODULE_LEGAL_REFERENCES}
        />

        <ComplianceBanner title="Personvern (GDPR) og rapportering">
          <p>
            Svar brukes til aggregerte rapporter. Små grupper (færre enn terskel) vises ikke. Fritekst vises ikke per
            spørsmål i analysen. Behandle resultater i tråd med formål og lagringstid.
          </p>
        </ComplianceBanner>

        {survey.error && <WarningBox>{survey.error}</WarningBox>}

        {survey.loading && survey.surveys.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Laster undersøkelser…
          </div>
        ) : (
          <>
            {tab === 'oversikt' && (
              <SurveyOversiktModuleTab
                surveys={survey.surveys}
                loading={survey.loading}
                onNewSurvey={() => openPanel('internal')}
              />
            )}
            {tab === 'kampanjer' && (
              <SurveyKampanjerTab
                surveys={survey.surveys}
                loading={survey.loading}
                canManage={survey.canManage}
                onNewSurvey={() => openPanel('internal')}
              />
            )}
            {tab === 'maler' && (
              <SurveyMalerTab
                templates={survey.templateCatalog}
                loading={survey.templateCatalogLoading}
                onUseTemplate={handleUseTemplate}
                onNewTemplate={() => navigate('/survey/templates/org/new')}
                onEditTemplate={(id) => {
                  const t = survey.templateCatalog.find((x) => x.id === id)
                  if (t?.is_system) {
                    navigate(`/survey/templates/org/new?from=${encodeURIComponent(id)}`)
                  } else {
                    navigate(`/survey/templates/org/${encodeURIComponent(id)}`)
                  }
                }}
                canManage={survey.canManage}
              />
            )}
            {tab === 'leverandorer' && (
              <SurveyLeverandorerTab
                surveys={survey.surveys}
                loading={survey.loading}
                canManage={survey.canManage}
                onNewExternalSurvey={() => openPanel('external')}
              />
            )}
          </>
        )}
      </ModulePageShell>

      <SlidePanel
        open={panelOpen}
        onClose={closePanel}
        titleId="survey-create-panel-title"
        title={isExternal ? 'Ny leverandørundersøkelse' : 'Ny undersøkelse'}
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closePanel} disabled={creating}>
              Avbryt
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleCreate()}
              disabled={creating || !title.trim()}
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
        }
      >
        <div className="space-y-5">
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sv-type">
              Type
            </label>
            <SearchableSelect
              value={surveyType}
              options={SURVEY_TYPE_OPTIONS}
              onChange={(v) => setSurveyType(v as SurveyType)}
            />
          </div>

          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sv-purpose-create">
              Formål med undersøkelsen
            </label>
            <p className="mb-1 text-xs text-neutral-500">
              Beskriv kort hva dere vil måle — systemet foreslår deretter relevante spørsmål i byggeren (for eksempel
              «psykososial», «AML», «leverandør»).
            </p>
            <StandardTextarea
              id="sv-purpose-create"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={2}
              placeholder="F.eks. Kartlegge trivsel og belastning før AMU"
            />
          </div>

          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sv-title">
              Tittel <span className="text-red-500">*</span>
            </label>
            <StandardInput
              id="sv-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isExternal ? 'F.eks. HMS-egenerklæring vår 2026' : 'F.eks. Psykososialt klima 2026'}
            />
          </div>

          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sv-desc">
              Beskrivelse
            </label>
            <StandardTextarea
              id="sv-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Valgfri introduksjon til deltakerne"
            />
          </div>

          {isExternal && (
            <>
              <div>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sv-vendor-name">
                  Leverandørnavn
                </label>
                <StandardInput
                  id="sv-vendor-name"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="F.eks. Bygg AS"
                />
              </div>
              <div>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sv-vendor-org">
                  Org.nr. (valgfritt)
                </label>
                <StandardInput
                  id="sv-vendor-org"
                  value={vendorOrgNumber}
                  onChange={(e) => setVendorOrgNumber(e.target.value)}
                  placeholder="9 siffer"
                />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sv-start">
                Startdato
              </label>
              <StandardInput
                id="sv-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sv-end">
                Sluttdato
              </label>
              <StandardInput
                id="sv-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {!isExternal && (
            <>
              <div>
                <span className={WPSTD_FORM_FIELD_LABEL}>Anonym undersøkelse</span>
                <p className="mb-2 text-xs text-neutral-500">
                  Ingen bruker-ID lagres på svar (personvern / GDPR Art. 25).
                </p>
                <YesNoToggle value={isAnonymous} onChange={setIsAnonymous} />
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
                    {templateInfo.description}
                    {templateInfo.estimated_minutes != null && (
                      <> · Estimert tid: ~{templateInfo.estimated_minutes} min</>
                    )}
                    {templateInfo.scoring_note ? <> · {templateInfo.scoring_note}</> : null}
                  </InfoBox>
                )}
              </div>
            </>
          )}
        </div>
      </SlidePanel>
    </>
  )
}
