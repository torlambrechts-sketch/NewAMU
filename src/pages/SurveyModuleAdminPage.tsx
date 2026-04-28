import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, GitBranch, Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { SlidePanel } from '../components/layout/SlidePanel'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_ROW_GRID,
} from '../components/layout/WorkplaceStandardFormPanel'
import { LayoutTable1PostingsShell } from '../components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
  LAYOUT_TABLE1_POSTINGS_TD,
} from '../components/layout/layoutTable1PostingsKit'
import { ModulePageShell, ModuleSectionCard } from '../components/module'
import { InfoBox, WarningBox } from '../components/ui/AlertBox'
import { Button } from '../components/ui/Button'
import { ComplianceBanner } from '../components/ui/ComplianceBanner'
import { StandardInput } from '../components/ui/Input'
import { SearchableSelect, type SelectOption } from '../components/ui/SearchableSelect'
import { StandardTextarea } from '../components/ui/Textarea'
import { YesNoToggle } from '../components/ui/FormToggles'
import { Badge } from '../components/ui/Badge'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { fetchOrgModulePayload, upsertOrgModulePayload } from '../lib/orgModulePayload'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import {
  buildSurveyOrgTemplateExport,
  parseSurveyOrgTemplateExport,
} from '../lib/surveyTemplateJsonImportExport'
import { useSurvey } from '../../modules/survey'
import { QUESTION_TYPE_OPTIONS, questionTypeLabel } from '../../modules/survey/surveyLabels'
import { parseSurveyModuleSettings, type SurveyModuleSettings } from '../../modules/survey/surveyAdminSettingsSchema'
import type { SurveyQuestionBankRow, SurveyQuestionType } from '../../modules/survey/types'
import { WorkflowRulesTab } from '../components/workflow/WorkflowRulesTab'
import { SURVEY_WORKFLOW_TRIGGER_EVENTS } from '../components/workflow/workflowTriggerRegistry'

const SETTINGS_KEY = 'survey_settings' as const

export function SurveyModuleAdminPage() {
  const navigate = useNavigate()
  const { supabase, can, isAdmin, organization } = useOrgSetupContext()
  const orgId = organization?.id
  const canManage = isAdmin || can('survey.manage')
  const survey = useSurvey({ supabase })
  const { loadQuestionBank } = survey

  const [settings, setSettings] = useState<SurveyModuleSettings>(() => parseSurveyModuleSettings({}))
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  const [showAdd, setShowAdd] = useState(false)
  const [qbCategory, setQbCategory] = useState('')
  const [qbText, setQbText] = useState('')
  const [qbType, setQbType] = useState<SurveyQuestionType>('rating_1_to_5')
  const [qbSaving, setQbSaving] = useState(false)

  const templateImportRef = useRef<HTMLInputElement>(null)
  const [jsonBusy, setJsonBusy] = useState(false)
  const [jsonErr, setJsonErr] = useState<string | null>(null)
  const [exportTemplateId, setExportTemplateId] = useState('')

  const typeOptions: SelectOption[] = QUESTION_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))

  const orgTemplates = useMemo(
    () => survey.templateCatalog.filter((t) => !t.is_system),
    [survey.templateCatalog],
  )

  const templateExportOptions: SelectOption[] = useMemo(
    () => orgTemplates.map((t) => ({ value: t.id, label: t.name })),
    [orgTemplates],
  )

  const loadSettings = useCallback(async () => {
    if (!supabase || !orgId) return
    setSettingsError(null)
    try {
      const raw = await fetchOrgModulePayload<Record<string, unknown>>(supabase, orgId, SETTINGS_KEY)
      setSettings(parseSurveyModuleSettings(raw))
    } catch (e) {
      setSettingsError(getSupabaseErrorMessage(e))
    } finally {
      setSettingsLoading(false)
    }
  }, [supabase, orgId])

  useEffect(() => {
    if (!exportTemplateId && templateExportOptions.length > 0) setExportTemplateId(templateExportOptions[0]!.value)
  }, [exportTemplateId, templateExportOptions])

  useEffect(() => {
    if (canManage && orgId) {
      void loadSettings()
      void loadQuestionBank()
      void survey.loadTemplateCatalog()
    }
  }, [canManage, orgId, loadSettings, loadQuestionBank, survey.loadTemplateCatalog])

  function downloadJson(filename: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleExportTemplateJson() {
    setJsonErr(null)
    const tpl = orgTemplates.find((t) => t.id === exportTemplateId)
    if (!tpl) {
      setJsonErr('Velg en egenorganisasjonsmal å eksportere, eller opprett en under Maler først.')
      return
    }
    const safe = tpl.id.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 40)
    downloadJson(`survey-org-template-${safe}.json`, buildSurveyOrgTemplateExport(tpl))
  }

  async function handleImportTemplateFile(f: File) {
    setJsonErr(null)
    setJsonBusy(true)
    try {
      const text = await f.text()
      const parsed = parseSurveyOrgTemplateExport(JSON.parse(text) as unknown)
      if (!parsed) {
        setJsonErr(
          'Ugyldig fil — forventet klarert-survey-org-template-export-v1 (JSON med name, category, audience og body.questions).',
        )
        return
      }
      const t = parsed.template
      const baseName = t.name.trim() || 'Importert mal'
      const row = await survey.saveOrgTemplate({
        name: `${baseName} (import)`,
        shortName: t.short_name,
        description: t.description,
        category: t.category,
        audience: t.audience,
        estimatedMinutes: t.estimated_minutes,
        recommendAnonymous: t.recommend_anonymous,
        scoringNote: t.scoring_note,
        lawRef: t.law_ref,
        body: t.body,
      })
      if (row) {
        setExportTemplateId(row.id)
      }
    } catch (e) {
      setJsonErr(e instanceof Error ? e.message : 'Import av mal feilet.')
    } finally {
      setJsonBusy(false)
    }
  }

  const handleSaveSettings = useCallback(async () => {
    if (!supabase || !orgId) return
    setSavingSettings(true)
    setSettingsError(null)
    try {
      await upsertOrgModulePayload(supabase, orgId, SETTINGS_KEY, {
        default_anonymous: settings.default_anonymous ?? false,
        intro_html: settings.intro_html?.trim() || undefined,
      })
    } catch (e) {
      setSettingsError(getSupabaseErrorMessage(e))
    } finally {
      setSavingSettings(false)
    }
  }, [supabase, orgId, settings])

  const handleSaveBank = useCallback(async () => {
    if (!qbCategory.trim() || !qbText.trim()) return
    setQbSaving(true)
    const row = await survey.upsertQuestionBank({
      category: qbCategory.trim(),
      questionText: qbText.trim(),
      questionType: qbType,
    })
    setQbSaving(false)
    if (row) {
      setShowAdd(false)
      setQbCategory('')
      setQbText('')
      setQbType('rating_1_to_5')
    }
  }, [qbCategory, qbText, qbType, survey])

  if (!canManage) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'HMS' },
          { label: 'Undersøkelser', to: '/survey' },
          { label: 'Modulinnstillinger' },
        ]}
        title="Modulinnstillinger — Undersøkelser"
        description="Konfigurer standardinnstillinger og administrer spørsmålsbanken for hele virksomheten."
      >
        <WarningBox>
          Du har ikke tilgang til modulinnstillinger. Krever rollen «survey.manage» eller administrator.
        </WarningBox>
      </ModulePageShell>
    )
  }

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'HMS' },
        { label: 'Undersøkelser', to: '/survey' },
        { label: 'Modulinnstillinger' },
      ]}
      title="Modulinnstillinger — Undersøkelser"
      description="Konfigurer standardinnstillinger og administrer spørsmålsbanken for hele virksomheten."
      headerActions={
        <Button type="button" variant="secondary" size="sm" onClick={() => navigate('/survey')}>
          <ArrowLeft className="h-4 w-4" />
          Tilbake
        </Button>
      }
    >
      <div className="space-y-6">
        <ComplianceBanner title="Modul for kartlegging">
          Innhold og standarder lagres for organisasjonen. Kun administratorer og personer med
          «survey.manage» endrer disse innstillingene.
        </ComplianceBanner>

        {settingsError && <WarningBox>{settingsError}</WarningBox>}
        {survey.error && <WarningBox>{survey.error}</WarningBox>}

        <ModuleSectionCard className="p-5 md:p-6">
          <h2 className="text-lg font-semibold text-neutral-900">Generelle innstillinger</h2>
          {settingsLoading ? <p className="mt-2 text-sm text-neutral-500">Laster innstillinger…</p> : null}
          <div className="mt-6 space-y-8">
            <div className={WPSTD_FORM_ROW_GRID}>
              <div>
                <p className="text-sm font-medium text-neutral-800">Standardinnstilling — anonymitet</p>
                <p className="mt-1 text-sm text-neutral-600">
                  Nye undersøkelser starter med denne innstillingen. Den kan overstyres per undersøkelse.
                </p>
              </div>
              <div>
                <span className={WPSTD_FORM_FIELD_LABEL}>Anonym som standard</span>
                <div className="mt-2 max-w-xs">
                  <YesNoToggle
                    value={settings.default_anonymous ?? false}
                    onChange={(v) => setSettings((p) => ({ ...p, default_anonymous: v }))}
                  />
                </div>
              </div>
            </div>

            <div className={WPSTD_FORM_ROW_GRID}>
              <div>
                <p className="text-sm font-medium text-neutral-800">Innledningsekst</p>
                <p className="mt-1 text-sm text-neutral-600">
                  HTML-tekst som vises for administratorer (lagres sammen med modulens innstillinger). Kan
                  inneholde enkle formateringskoder.
                </p>
              </div>
              <div>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="intro-html">
                  Innledning (HTML)
                </label>
                <StandardTextarea
                  id="intro-html"
                  rows={5}
                  value={settings.intro_html ?? ''}
                  onChange={(e) => setSettings((p) => ({ ...p, intro_html: e.target.value }))}
                  placeholder="<p>Kjære medarbeider…</p>"
                />
              </div>
            </div>

            <Button type="button" variant="primary" disabled={savingSettings} onClick={() => void handleSaveSettings()}>
              {savingSettings ? 'Lagrer…' : 'Lagre innstillinger'}
            </Button>
          </div>
        </ModuleSectionCard>

        <ModuleSectionCard className="p-5 md:p-6">
          <h2 className="text-lg font-semibold text-neutral-900">Organisasjonsmaler — JSON</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Eksporter og importer egendefinerte undersøkelsesmaler (ikke systemmaler). Filformatet er versjonert og kan
            brukes til sikkerhetskopiering eller deling mellom miljøer.
          </p>
          <div className="mt-4">
            <InfoBox>
              Format: <code className="rounded bg-neutral-100 px-1 text-xs">klarert-survey-org-template-export-v1</code>
              — samme struktur som ved eksport fra denne siden.
            </InfoBox>
          </div>

          {jsonErr ? (
            <div className="mt-4">
              <WarningBox>{jsonErr}</WarningBox>
            </div>
          ) : null}

          {survey.templateCatalogLoading && orgTemplates.length === 0 ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Laster organisasjonsmaler…
            </p>
          ) : (
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="space-y-3 rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
                <p className="text-sm font-medium text-neutral-800">Eksporter</p>
                <p className="text-xs text-neutral-600">Velg en egen mal og last ned JSON.</p>
                <div>
                  <span className={WPSTD_FORM_FIELD_LABEL}>Mal</span>
                  <div className="mt-1.5">
                    <SearchableSelect
                      value={exportTemplateId}
                      options={templateExportOptions}
                      onChange={setExportTemplateId}
                      disabled={templateExportOptions.length === 0 || jsonBusy}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={templateExportOptions.length === 0 || jsonBusy}
                  onClick={() => handleExportTemplateJson()}
                >
                  <Download className="h-4 w-4" aria-hidden />
                  Last ned JSON
                </Button>
                {templateExportOptions.length === 0 ? (
                  <p className="text-xs text-neutral-500">
                    Ingen egne maler ennå. Opprett en under Undersøkelser → Maler, eller importer en fil til høyre.
                  </p>
                ) : null}
              </div>

              <div className="space-y-3 rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
                <p className="text-sm font-medium text-neutral-800">Importer</p>
                <p className="text-xs text-neutral-600">
                  Oppretter en ny organisasjonsmal med suffikset «(import)». Eksisterende maler overskrives ikke.
                </p>
                <input
                  ref={templateImportRef}
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (f) void handleImportTemplateFile(f)
                  }}
                />
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={jsonBusy}
                  onClick={() => templateImportRef.current?.click()}
                >
                  {jsonBusy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Importerer…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" aria-hidden />
                      Velg JSON-fil
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </ModuleSectionCard>

        <ModuleSectionCard className="p-5 md:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-neutral-900">Spørsmålsbank</h2>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                setQbCategory('')
                setQbText('')
                setQbType('rating_1_to_5')
                setShowAdd(true)
              }}
            >
              <Plus className="h-4 w-4" />
              Legg til
            </Button>
          </div>

          <LayoutTable1PostingsShell
            wrap={false}
            title="Gjenbrukbare spørsmål"
            description="Bruk disse når du bygger nye undersøkelser (hent fra bank i byggeren)."
            toolbar={<span className="text-xs text-neutral-500">{survey.questionBank.length} spørsmål</span>}
          >
            {survey.loading && survey.questionBank.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-500">Laster…</p>
            ) : survey.questionBank.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-500">Ingen spørsmål i banken ennå.</p>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Kategori</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Spørsmål</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Type</th>
                      <th className={`${LAYOUT_TABLE1_POSTINGS_TH} text-right`}>Handlinger</th>
                    </tr>
                  </thead>
                  <tbody>
                    {survey.questionBank.map((r: SurveyQuestionBankRow) => (
                      <tr key={r.id} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                        <td className={LAYOUT_TABLE1_POSTINGS_TD}>{r.category}</td>
                        <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                          <span className="whitespace-normal text-neutral-900">{r.question_text}</span>
                        </td>
                        <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                          <Badge variant="neutral">{questionTypeLabel(r.question_type)}</Badge>
                        </td>
                        <td className={`${LAYOUT_TABLE1_POSTINGS_TD} text-right`}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (
                                typeof window !== 'undefined' &&
                                !window.confirm('Slette spørsmålet fra banken?')
                              ) {
                                return
                              }
                              void survey.deleteQuestionBank(r.id)
                            }}
                            aria-label={`Slett spørsmål: ${r.question_text.slice(0, 40)}…`}
                            title="Slett"
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
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

        <ModuleSectionCard className="p-5 md:p-6">
          <div className="mb-3 flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-[#1a3d32]" />
            <h2 className="text-lg font-semibold text-neutral-900">Arbeidsflyt</h2>
          </div>
          <p className="mb-4 text-sm text-neutral-600">Koble hendelser for undersøkelsesmodulen til e-postregler.</p>
          <WorkflowRulesTab
            supabase={supabase}
            module="survey"
            triggerEvents={SURVEY_WORKFLOW_TRIGGER_EVENTS.map((e) => ({ value: e.value, label: e.label }))}
          />
        </ModuleSectionCard>
      </div>

      <SlidePanel
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Nytt spørsmål i bank"
        titleId="qbank-panel-title"
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>
              Avbryt
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={qbSaving || !qbText.trim() || !qbCategory.trim()}
              onClick={() => void handleSaveBank()}
            >
              {qbSaving ? 'Lagrer…' : 'Lagre'}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="qb-cat">
              Kategori (obligatorisk)
            </label>
            <StandardInput
              id="qb-cat"
              value={qbCategory}
              onChange={(e) => setQbCategory(e.target.value)}
              placeholder="F.eks. Jobbkrav"
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="qb-text">
              Spørsmålstekst (obligatorisk)
            </label>
            <StandardTextarea id="qb-text" value={qbText} onChange={(e) => setQbText(e.target.value)} rows={3} />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="qb-type">
              Type
            </label>
            <SearchableSelect
              value={qbType}
              options={typeOptions}
              onChange={(v) => setQbType(v as SurveyQuestionType)}
            />
          </div>
        </div>
      </SlidePanel>
    </ModulePageShell>
  )
}
