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
import type { SurveyTemplateCatalogRow } from './surveyTemplateCatalogTypes'
import { SURVEY_TYPE_OPTIONS } from './surveyLabels'
import type { SurveyPackSlug, SurveyType } from './types'
import { SurveyOversiktModuleTab } from './tabs/SurveyOversiktModuleTab'
import { SurveyKampanjerTab } from './tabs/SurveyKampanjerTab'
import { SurveyMalerTab } from './tabs/SurveyMalerTab'
import { SurveyLeverandorerTab } from './tabs/SurveyLeverandorerTab'
import { SurveyAnalyseOverviewTab } from './tabs/SurveyAnalyseOverviewTab'
import { SURVEY_MODULE_LEGAL_REFERENCES } from './surveyLegalReferences'


type Props = { supabase: SupabaseClient | null }

type ModuleTab = 'oversikt' | 'kampanjer' | 'maler' | 'leverandorer' | 'analyse'

export function SurveyPage({ supabase }: Props) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const survey = useSurvey({ supabase })
  const { packs } = useSurveyPacks({ supabase })
  const slugParam = searchParams.get('pack')
  const activePack = useMemo(
    () => findLicensedPack(packs, (slugParam as SurveyPackSlug | null) ?? null),
    [packs, slugParam],
  )
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

  const packScopedTemplates = useMemo(() => {
    if (!activePack) return survey.templateCatalog
    return survey.templateCatalog.filter((t) => t.pack === activePack.slug)
  }, [survey.templateCatalog, activePack])

  const packScopedSurveys = useMemo(() => {
    if (!activePack) return survey.surveys
    return survey.surveys.filter((s) => s.pack === activePack.slug)
  }, [survey.surveys, activePack])

  const templateOptions = useMemo(() => {
    const fromDb = packScopedTemplates.map((t) => ({
      value: t.id,
      label: `${t.name} (~${t.estimated_minutes} min)`,
    }))
    return [{ value: '', label: 'Uten mal' }, ...fromDb]
  }, [packScopedTemplates])

  const templateInfo = useMemo((): SurveyTemplateCatalogRow | undefined => {
    if (!selectedTemplate) return undefined
    return survey.templateCatalog.find((t) => t.id === selectedTemplate)
  }, [selectedTemplate, survey.templateCatalog])

  const { loadSurveys, loadTemplateCatalog } = survey
  useEffect(() => {
    void loadSurveys()
  }, [loadSurveys])

  const tabFromUrl = searchParams.get('tab')
  useEffect(() => {
    if (tabFromUrl === 'maler' || tabFromUrl === 'kampanjer' || tabFromUrl === 'leverandorer' || tabFromUrl === 'oversikt' || tabFromUrl === 'analyse') {
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

  const isExternal = surveyType === 'external'

  const moduleTabs: TabItem[] = useMemo(
    () => [
      { id: 'oversikt', label: 'Oversikt', icon: LayoutGrid },
      {
        id: 'kampanjer',
        label: activePack?.plural_label ?? 'Kampanjer',
        icon: ClipboardList,
        badgeCount: packScopedSurveys.length > 0 ? packScopedSurveys.length : undefined,
      },
      { id: 'maler', label: 'Maler', icon: Package },
      {
        id: 'leverandorer',
        label: 'Leverandører',
        icon: Truck,
        badgeCount:
          packScopedSurveys.filter((s) => s.survey_type === 'external').length || undefined,
      },
      { id: 'analyse', label: 'Analyse', icon: BarChart3 },
    ],
    [packScopedSurveys, activePack],
  )

  const packTitle = activePack?.plural_label ?? 'Undersøkelser'
  const packDescription =
    activePack?.description ??
    'Kartlegg arbeidsmiljø, mål psykososiale forhold, og innhent dokumentasjon fra leverandører.'
  const packCtaLabel = activePack?.cta_label ?? 'Ny undersøkelse'
  const packLegalRefs =
    activePack?.legal_references && activePack.legal_references.length > 0
      ? activePack.legal_references
      : SURVEY_MODULE_LEGAL_REFERENCES

  return (
    <>
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: packTitle }]}
        title={packTitle}
        description={packDescription}
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            {survey.canManage && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  icon={<Settings className="h-4 w-4" />}
                  onClick={() => navigate('/survey/admin')}
                >
                  <span className="hidden sm:inline">Innstillinger</span>
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => openPanel(activePack?.slug === 'vendor' ? 'external' : 'internal')}
                >
                  {packCtaLabel}
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
          title={packTitle}
          intro={<p>{packDescription}</p>}
          references={packLegalRefs}
        />

        {survey.error && <WarningBox>{survey.error}</WarningBox>}

        {survey.loading && packScopedSurveys.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Laster undersøkelser…
          </div>
        ) : (
          <>
            {tab === 'oversikt' && (
              <SurveyOversiktModuleTab
                surveys={packScopedSurveys}
                loading={survey.loading}
                onNewSurvey={() => openPanel(activePack?.slug === 'vendor' ? 'external' : 'internal')}
              />
            )}
            {tab === 'kampanjer' && (
              <SurveyKampanjerTab
                surveys={packScopedSurveys}
                loading={survey.loading}
                canManage={survey.canManage}
                onNewSurvey={() => openPanel(activePack?.slug === 'vendor' ? 'external' : 'internal')}
              />
            )}
            {tab === 'maler' && (
              <SurveyMalerTab
                templates={packScopedTemplates}
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
                surveys={packScopedSurveys}
                loading={survey.loading}
                canManage={survey.canManage}
                onNewExternalSurvey={() => openPanel('external')}
              />
            )}
            {tab === 'analyse' && (
              <SurveyAnalyseOverviewTab
                surveys={packScopedSurveys}
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
