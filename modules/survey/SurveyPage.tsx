import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  BarChart3,
  ClipboardList,
  LayoutGrid,
  Loader2,
  Package,
  Plus,
  Settings,
  Truck,
} from 'lucide-react'
import { ModuleLegalBanner, ModulePageShell } from '../../src/components/module'
import { SlidePanel } from '../../src/components/layout/SlidePanel'
import { WPSTD_FORM_FIELD_LABEL } from '../../src/components/layout/WorkplaceStandardFormPanel'
import { Button } from '../../src/components/ui/Button'
import { StandardInput } from '../../src/components/ui/Input'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import { YesNoToggle } from '../../src/components/ui/FormToggles'
import { InfoBox, WarningBox } from '../../src/components/ui/AlertBox'
import { Tabs, type TabItem } from '../../src/components/ui/Tabs'
import { useSurvey } from './useSurvey'
import { useSurveyPacks, findLicensedPack } from './useSurveyPacks'
import { useSurveyOrgTemplates } from './useSurveyOrgTemplates'
import { useSurveyCategories } from './useSurveyCategories'
import type { SurveyTemplateCatalogRow } from './surveyTemplateCatalogTypes'
import { SURVEY_TYPE_OPTIONS } from './surveyLabels'
import type { SurveyPackSlug, SurveyType } from './types'
import { SurveyOversiktModuleTab } from './tabs/SurveyOversiktModuleTab'
import { SurveyKampanjerTab } from './tabs/SurveyKampanjerTab'
import { SurveyMalerTab } from './tabs/SurveyMalerTab'
import { SurveyLeverandorerTab } from './tabs/SurveyLeverandorerTab'
import { SurveyAnalyseOverviewTab } from './tabs/SurveyAnalyseOverviewTab'
import { SurveyHubLanding } from './SurveyHubLanding'
import { SurveyHubRecordsShell } from './SurveyHubRecordsShell'
import { SURVEY_MODULE_LEGAL_REFERENCES } from './surveyLegalReferences'


type Props = { supabase: SupabaseClient | null }

type ModuleTab = 'oversikt' | 'kampanjer' | 'maler' | 'leverandorer' | 'analyse'

export function SurveyPage({ supabase }: Props) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const survey = useSurvey({ supabase })
  const { packs } = useSurveyPacks({ supabase })
  const orgTemplates = useSurveyOrgTemplates({ supabase })
  const surveyCategories = useSurveyCategories({ supabase })
  const slugParam = searchParams.get('pack')
  const templateParam = searchParams.get('template')
  // Pack mode requires an explicit ?pack= so /survey with no params falls to
  // the neutral hub instead of defaulting to packs[0] (Leverandør).
  const activePack = useMemo(
    () =>
      slugParam
        ? findLicensedPack(packs, (slugParam as SurveyPackSlug | null) ?? null)
        : null,
    [packs, slugParam],
  )
  const activeTemplate = useMemo(
    () =>
      templateParam
        ? survey.templateCatalog.find((t) => t.id === templateParam) ?? null
        : null,
    [templateParam, survey.templateCatalog],
  )
  const mode: 'template' | 'pack' | 'hub' = activeTemplate
    ? 'template'
    : activePack
    ? 'pack'
    : 'hub'
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

  const scopedTemplates = useMemo(() => {
    if (activeTemplate) return [activeTemplate]
    if (activePack) return survey.templateCatalog.filter((t) => t.pack === activePack.slug)
    return survey.templateCatalog
  }, [survey.templateCatalog, activePack, activeTemplate])

  const scopedSurveys = useMemo(() => {
    if (activeTemplate) return survey.surveys.filter((s) => s.catalog_id === activeTemplate.id)
    if (activePack) return survey.surveys.filter((s) => s.pack === activePack.slug)
    return survey.surveys
  }, [survey.surveys, activePack, activeTemplate])

  const templateOptions = useMemo(() => {
    const fromDb = scopedTemplates.map((t) => ({
      value: t.id,
      label: `${t.name} (~${t.estimated_minutes} min)`,
    }))
    return [{ value: '', label: 'Uten mal' }, ...fromDb]
  }, [scopedTemplates])

  const templateInfo = useMemo((): SurveyTemplateCatalogRow | undefined => {
    if (!selectedTemplate) return undefined
    return survey.templateCatalog.find((t) => t.id === selectedTemplate)
  }, [selectedTemplate, survey.templateCatalog])

  // Maps catalogId → categoryId for the Records-shell category rail.
  // Resolved through the org-template override layer (pinnedById).
  const categoryByCatalogId = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const tpl of survey.templateCatalog) {
      const override = orgTemplates.templates.find((t) => t.catalogId === tpl.id)
      m.set(tpl.id, override?.categoryId ?? null)
    }
    return m
  }, [survey.templateCatalog, orgTemplates.templates])

  const { loadSurveys, loadTemplateCatalog } = survey
  useEffect(() => {
    void loadSurveys()
    // Load templates eagerly so the template+pack URL params resolve on first
    // render and the hub landing has tiles to show.
    void loadTemplateCatalog()
  }, [loadSurveys, loadTemplateCatalog])

  const tabFromUrl = searchParams.get('tab')
  useEffect(() => {
    if (tabFromUrl === 'maler' || tabFromUrl === 'kampanjer' || tabFromUrl === 'leverandorer' || tabFromUrl === 'oversikt' || tabFromUrl === 'analyse') {
      setTab(tabFromUrl)
    }
  }, [tabFromUrl])

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
      pack: activePack?.slug,
    })

    if (!row) {
      setCreating(false)
      return
    }

    if (selectedTemplate) {
      await survey.applyTemplateToSurvey(row.id, selectedTemplate)
    }

    setCreating(false)
    closePanel()
    navigate(`/survey/${row.id}`)
  }, [title, description, isAnonymous, surveyType, startDate, endDate, vendorName, vendorOrgNumber, purpose, selectedTemplate, activePack, survey, closePanel, navigate])

  const handleUseTemplate = useCallback(
    (templateId: string) => {
      const tpl = survey.templateCatalog.find((t) => t.id === templateId)
      setSelectedTemplate(templateId)
      if (tpl) {
        setTitle(tpl.name)
        setDescription(tpl.description ?? '')
        setIsAnonymous(tpl.recommend_anonymous)
        setSurveyType(tpl.audience === 'external' ? 'external' : 'internal')
        openPanel(tpl.audience === 'external' ? 'external' : 'internal')
      } else {
        openPanel('internal')
      }
      setTab('kampanjer')
    },
    [openPanel, survey.templateCatalog],
  )

  const handlePrimaryCreate = useCallback(() => {
    if (activeTemplate) {
      handleUseTemplate(activeTemplate.id)
      return
    }
    openPanel(activePack?.slug === 'vendor' ? 'external' : 'internal')
  }, [activeTemplate, activePack, handleUseTemplate, openPanel])

  const isExternal = surveyType === 'external'

  const moduleTabs: TabItem[] = useMemo(() => {
    if (mode === 'template') {
      return [
        { id: 'oversikt', label: 'Oversikt', icon: LayoutGrid },
        {
          id: 'kampanjer',
          label: 'Kjøringer',
          icon: ClipboardList,
          badgeCount: scopedSurveys.length > 0 ? scopedSurveys.length : undefined,
        },
        { id: 'analyse', label: 'Analyse', icon: BarChart3 },
      ]
    }
    return [
      { id: 'oversikt', label: 'Oversikt', icon: LayoutGrid },
      {
        id: 'kampanjer',
        label: activePack?.plural_label ?? 'Kampanjer',
        icon: ClipboardList,
        badgeCount: scopedSurveys.length > 0 ? scopedSurveys.length : undefined,
      },
      { id: 'maler', label: 'Maler', icon: Package },
      {
        id: 'leverandorer',
        label: 'Leverandører',
        icon: Truck,
        badgeCount:
          scopedSurveys.filter((s) => s.survey_type === 'external').length || undefined,
      },
      { id: 'analyse', label: 'Analyse', icon: BarChart3 },
    ]
  }, [scopedSurveys, activePack, mode])

  const headerTitle = activeTemplate?.name ?? activePack?.plural_label ?? 'Undersøkelser'
  const headerDescription =
    activeTemplate?.description ??
    activePack?.description ??
    'Velg en mal eller pakke for å starte. Maler markert i menyen vises som faste valg.'
  const headerCtaLabel = activeTemplate
    ? `Ny ${activeTemplate.short_name ?? activeTemplate.name}`
    : activePack?.cta_label ?? 'Ny undersøkelse'
  const headerLegalRefs =
    activePack?.legal_references && activePack.legal_references.length > 0
      ? activePack.legal_references
      : SURVEY_MODULE_LEGAL_REFERENCES
  const headerBreadcrumb = activeTemplate
    ? [{ label: 'HMS' }, { label: 'Undersøkelser', to: '/survey' }, { label: activeTemplate.name }]
    : [{ label: 'HMS' }, { label: headerTitle }]

  return (
    <>
      <ModulePageShell
        breadcrumb={headerBreadcrumb}
        title={headerTitle}
        description={headerDescription}
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            {survey.canManage && (
              <>
                {mode === 'hub' ? (
                  <Button
                    type="button"
                    variant="secondary"
                    icon={<BarChart3 className="h-4 w-4" />}
                    onClick={() => navigate('/survey/analyse')}
                  >
                    <span className="hidden sm:inline">Analyse</span>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  icon={<Settings className="h-4 w-4" />}
                  onClick={() => navigate('/survey/admin')}
                >
                  <span className="hidden sm:inline">Innstillinger</span>
                </Button>
                {mode !== 'hub' ? (
                  <Button
                    type="button"
                    variant="primary"
                    icon={<Plus className="h-4 w-4" />}
                    onClick={handlePrimaryCreate}
                  >
                    {headerCtaLabel}
                  </Button>
                ) : null}
              </>
            )}
          </div>
        }
        tabs={
          mode === 'hub' ? null : (
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
          )
        }
      >
        {mode !== 'hub' ? (
          <ModuleLegalBanner
            title={headerTitle}
            intro={<p>{headerDescription}</p>}
            references={headerLegalRefs}
          />
        ) : null}

        {survey.error && <WarningBox>{survey.error}</WarningBox>}

        {mode === 'hub' ? (
          <SurveyHubRecordsShell
            surveys={survey.surveys}
            templates={survey.templateCatalog}
            categories={surveyCategories.categories}
            categoryByCatalogId={categoryByCatalogId}
            loading={survey.templateCatalogLoading || survey.loading}
            canManage={survey.canManage}
            onNewSurvey={() => openPanel('internal')}
            onNavigate={(path) => navigate(path)}
          />
        ) : survey.loading && scopedSurveys.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Laster undersøkelser…
          </div>
        ) : (
          <>
            {tab === 'oversikt' && (
              <SurveyOversiktModuleTab
                surveys={scopedSurveys}
                loading={survey.loading}
                onNewSurvey={handlePrimaryCreate}
              />
            )}
            {tab === 'kampanjer' && (
              <SurveyKampanjerTab
                surveys={scopedSurveys}
                loading={survey.loading}
                canManage={survey.canManage}
                onNewSurvey={handlePrimaryCreate}
              />
            )}
            {mode === 'pack' && tab === 'maler' && (
              <SurveyMalerTab
                templates={scopedTemplates}
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
            {mode === 'pack' && tab === 'leverandorer' && (
              <SurveyLeverandorerTab
                surveys={scopedSurveys}
                loading={survey.loading}
                canManage={survey.canManage}
                onNewExternalSurvey={() => openPanel('external')}
              />
            )}
            {tab === 'analyse' && (
              <SurveyAnalyseOverviewTab
                surveys={scopedSurveys}
                loading={survey.loading}
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
