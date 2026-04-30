import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, BookOpen, Download, GitBranch, Globe,
  LayoutGrid, Loader2, Mail, Plus, Settings, Smartphone, Trash2, Upload,
} from 'lucide-react'
import { SlidePanel } from '../components/layout/SlidePanel'
import { WPSTD_FORM_FIELD_LABEL } from '../components/layout/WorkplaceStandardFormPanel'
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
import { Badge } from '../components/ui/Badge'
import { Tabs, type TabItem } from '../components/ui/Tabs'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { fetchOrgModulePayload, upsertOrgModulePayload } from '../lib/orgModulePayload'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import { buildSurveyOrgTemplateExport, parseSurveyOrgTemplateExport } from '../lib/surveyTemplateJsonImportExport'
import { useSurvey } from '../../modules/survey'
import { QUESTION_TYPE_OPTIONS, questionTypeLabel } from '../../modules/survey/surveyLabels'
import { parseSurveyModuleSettings, type SurveyModuleSettings } from '../../modules/survey/surveyAdminSettingsSchema'
import type { SurveyQuestionBankRow, SurveyQuestionType } from '../../modules/survey/types'
import { WorkflowRulesTab } from '../components/workflow/WorkflowRulesTab'
import { SURVEY_WORKFLOW_TRIGGER_EVENTS } from '../components/workflow/workflowTriggerRegistry'
import { SurveySettingsGenerelt } from '../components/survey/settings/SurveySettingsGenerelt'
import { SurveySettingsUtseende } from '../components/survey/settings/SurveySettingsUtseende'
import { SurveySettingsEpost } from '../components/survey/settings/SurveySettingsEpost'
import { SurveySettingsSms } from '../components/survey/settings/SurveySettingsSms'
import { SurveySettingsIntegrasjoner } from '../components/survey/settings/SurveySettingsIntegrasjoner'

const SETTINGS_KEY = 'survey_settings' as const

type AdminTab = 'generelt' | 'utseende' | 'epost' | 'sms' | 'integrasjoner' | 'sporsmalbank' | 'maler' | 'arbeidsflyt'

const ADMIN_TABS: TabItem[] = [
  { id: 'generelt',      label: 'Generelt',     icon: Settings  },
  { id: 'utseende',      label: 'Utseende',      icon: LayoutGrid },
  { id: 'epost',         label: 'E-post',        icon: Mail      },
  { id: 'sms',           label: 'SMS',           icon: Smartphone },
  { id: 'integrasjoner', label: 'Integrasjoner', icon: Globe     },
  { id: 'sporsmalbank',  label: 'Spørsmålsbank', icon: BookOpen  },
  { id: 'maler',         label: 'Maler',         icon: Download  },
  { id: 'arbeidsflyt',   label: 'Arbeidsflyt',   icon: GitBranch },
]

export function SurveyModuleAdminPage() {
  const navigate = useNavigate()
  const { supabase, can, isAdmin, organization } = useOrgSetupContext()
  const orgId = organization?.id
  const canManage = isAdmin || can('survey.manage')
  const survey = useSurvey({ supabase })
  const { loadQuestionBank } = survey

  const [tab, setTab] = useState<AdminTab>('generelt')
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
    a.href = url; a.download = filename; a.rel = 'noopener'; a.click()
    URL.revokeObjectURL(url)
  }

  function handleExportTemplateJson() {
    setJsonErr(null)
    const tpl = orgTemplates.find((t) => t.id === exportTemplateId)
    if (!tpl) { setJsonErr('Velg en mal å eksportere, eller opprett en under Maler først.'); return }
    downloadJson(`survey-org-template-${tpl.id.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 40)}.json`, buildSurveyOrgTemplateExport(tpl))
  }

  async function handleImportTemplateFile(f: File) {
    setJsonErr(null); setJsonBusy(true)
    try {
      const parsed = parseSurveyOrgTemplateExport(JSON.parse(await f.text()) as unknown)
      if (!parsed) { setJsonErr('Ugyldig fil — forventet klarert-survey-org-template-export-v1.'); return }
      const t = parsed.template
      const row = await survey.saveOrgTemplate({
        name: `${t.name.trim() || 'Importert mal'} (import)`,
        shortName: t.short_name, description: t.description, category: t.category,
        audience: t.audience, estimatedMinutes: t.estimated_minutes,
        recommendAnonymous: t.recommend_anonymous, scoringNote: t.scoring_note,
        lawRef: t.law_ref, body: t.body,
      })
      if (row) setExportTemplateId(row.id)
    } catch (e) {
      setJsonErr(e instanceof Error ? e.message : 'Import feilet.')
    } finally { setJsonBusy(false) }
  }

  const handleSaveSettings = useCallback(async () => {
    if (!supabase || !orgId) return
    setSavingSettings(true); setSettingsError(null)
    try {
      await upsertOrgModulePayload(supabase, orgId, SETTINGS_KEY, {
        default_anonymous: settings.default_anonymous ?? false,
        intro_html: settings.intro_html?.trim() || undefined,
        response_rate_threshold_pct: settings.response_rate_threshold_pct,
        invite_email_subject_template: settings.invite_email_subject_template?.trim() || undefined,
        invite_email_html_template: settings.invite_email_html_template?.trim() || undefined,
        reminder_email_subject_template: settings.reminder_email_subject_template?.trim() || undefined,
        reminder_email_html_template: settings.reminder_email_html_template?.trim() || undefined,
        max_reminders_per_invitation: settings.max_reminders_per_invitation,
        reminder_min_hours_since_last: settings.reminder_min_hours_since_last,
        email_send_delay_ms: settings.email_send_delay_ms,
        survey_layout: settings.survey_layout,
        show_progress_bar: settings.show_progress_bar,
        show_question_numbers: settings.show_question_numbers,
        allow_back_navigation: settings.allow_back_navigation,
        welcome_page_enabled: settings.welcome_page_enabled,
        welcome_page_html: settings.welcome_page_html?.trim() || undefined,
        thankyou_page_html: settings.thankyou_page_html?.trim() || undefined,
        branding_logo_url: settings.branding_logo_url?.trim() || undefined,
        branding_primary_color: settings.branding_primary_color?.trim() || undefined,
        font_size: settings.font_size,
        sms_enabled: settings.sms_enabled,
        sms_provider: settings.sms_provider,
        sms_sender_name: settings.sms_sender_name?.trim() || undefined,
        sms_invite_template: settings.sms_invite_template?.trim() || undefined,
        sms_reminder_template: settings.sms_reminder_template?.trim() || undefined,
        sms_max_reminders: settings.sms_max_reminders,
        webhook_enabled: settings.webhook_enabled,
        webhook_url: settings.webhook_url?.trim() || undefined,
        webhook_secret: settings.webhook_secret?.trim() || undefined,
        webhook_events: settings.webhook_events,
        slack_enabled: settings.slack_enabled,
        slack_webhook_url: settings.slack_webhook_url?.trim() || undefined,
        slack_notify_on_response: settings.slack_notify_on_response,
        slack_notify_on_threshold: settings.slack_notify_on_threshold,
        slack_notify_on_closed: settings.slack_notify_on_closed,
        api_access_enabled: settings.api_access_enabled,
      })
    } catch (e) {
      setSettingsError(getSupabaseErrorMessage(e))
    } finally { setSavingSettings(false) }
  }, [supabase, orgId, settings])

  const handleSaveBank = useCallback(async () => {
    if (!qbCategory.trim() || !qbText.trim()) return
    setQbSaving(true)
    const row = await survey.upsertQuestionBank({ category: qbCategory.trim(), questionText: qbText.trim(), questionType: qbType })
    setQbSaving(false)
    if (row) { setShowAdd(false); setQbCategory(''); setQbText(''); setQbType('rating_1_to_5') }
  }, [qbCategory, qbText, qbType, survey])

  if (!canManage) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'Undersøkelser', to: '/survey' }, { label: 'Innstillinger' }]}
        title="Innstillinger — Undersøkelser"
      >
        <WarningBox>Du har ikke tilgang. Krever rollen «survey.manage» eller administrator.</WarningBox>
      </ModulePageShell>
    )
  }

  const saveProps = { settings, setSettings, saving: savingSettings, onSave: () => void handleSaveSettings() }

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'HMS' }, { label: 'Undersøkelser', to: '/survey' }, { label: 'Innstillinger' }]}
      title="Innstillinger — Undersøkelser"
      description="Konfigurer standardinnstillinger og administrer spørsmålsbanken for hele virksomheten."
      headerActions={
        <Button type="button" variant="secondary" size="sm" onClick={() => navigate('/survey')}>
          <ArrowLeft className="h-4 w-4" /> Tilbake
        </Button>
      }
      tabs={
        <Tabs className="w-full md:w-auto" overflow="scroll" items={ADMIN_TABS} activeId={tab} onChange={(id) => setTab(id as AdminTab)} />
      }
    >
      <div className="space-y-6">
        <ComplianceBanner title="Modulinnstillinger">
          Innhold og standarder lagres for hele organisasjonen. Kun administratorer og personer med
          «survey.manage» kan endre disse innstillingene.
        </ComplianceBanner>

        {settingsError && <WarningBox>{settingsError}</WarningBox>}
        {survey.error && <WarningBox>{survey.error}</WarningBox>}
        {settingsLoading && !['sporsmalbank', 'maler', 'arbeidsflyt'].includes(tab) && (
          <p className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Laster innstillinger…
          </p>
        )}

        {tab === 'generelt'      && <SurveySettingsGenerelt      {...saveProps} />}
        {tab === 'utseende'      && <SurveySettingsUtseende      {...saveProps} />}
        {tab === 'epost'         && <SurveySettingsEpost         {...saveProps} />}
        {tab === 'sms'           && <SurveySettingsSms           {...saveProps} />}
        {tab === 'integrasjoner' && <SurveySettingsIntegrasjoner {...saveProps} />}

        {/* ── Spørsmålsbank ───────────────────────────────────────────── */}
        {tab === 'sporsmalbank' && (
          <ModuleSectionCard className="p-5 md:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-neutral-900">Spørsmålsbank</h2>
              <Button type="button" variant="primary" size="sm" onClick={() => { setQbCategory(''); setQbText(''); setQbType('rating_1_to_5'); setShowAdd(true) }}>
                <Plus className="h-4 w-4" /> Legg til
              </Button>
            </div>
            <LayoutTable1PostingsShell wrap={false} title="Gjenbrukbare spørsmål" description="Hent fra bank i byggeren." toolbar={<span className="text-xs text-neutral-500">{survey.questionBank.length} spørsmål</span>}>
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
                          <td className={LAYOUT_TABLE1_POSTINGS_TD}><span className="whitespace-normal">{r.question_text}</span></td>
                          <td className={LAYOUT_TABLE1_POSTINGS_TD}><Badge variant="neutral">{questionTypeLabel(r.question_type)}</Badge></td>
                          <td className={`${LAYOUT_TABLE1_POSTINGS_TD} text-right`}>
                            <Button type="button" variant="ghost" size="icon" className="text-red-600"
                              onClick={() => { if (typeof window !== 'undefined' && !window.confirm('Slette spørsmålet?')) return; void survey.deleteQuestionBank(r.id) }}
                              aria-label={`Slett: ${r.question_text.slice(0, 40)}`}>
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
        )}

        {/* ── Maler ───────────────────────────────────────────────────── */}
        {tab === 'maler' && (
          <ModuleSectionCard className="p-5 md:p-6">
            <h2 className="text-lg font-semibold text-neutral-900">Organisasjonsmaler — JSON</h2>
            <p className="mt-1 text-sm text-neutral-600">Eksporter og importer egendefinerte undersøkelsesmaler. Filformatet er versjonert.</p>
            <div className="mt-4"><InfoBox>Format: <code className="rounded bg-neutral-100 px-1 text-xs">klarert-survey-org-template-export-v1</code></InfoBox></div>
            {jsonErr && <div className="mt-4"><WarningBox>{jsonErr}</WarningBox></div>}
            {survey.templateCatalogLoading && orgTemplates.length === 0 ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-neutral-500"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Laster maler…</p>
            ) : (
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div className="space-y-3 rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
                  <p className="text-sm font-medium text-neutral-800">Eksporter</p>
                  <div>
                    <span className={WPSTD_FORM_FIELD_LABEL}>Mal</span>
                    <div className="mt-1.5">
                      <SearchableSelect value={exportTemplateId} options={templateExportOptions} onChange={setExportTemplateId} disabled={templateExportOptions.length === 0 || jsonBusy} />
                    </div>
                  </div>
                  <Button type="button" variant="secondary" size="sm" disabled={templateExportOptions.length === 0 || jsonBusy} onClick={() => handleExportTemplateJson()}>
                    <Download className="h-4 w-4" aria-hidden /> Last ned JSON
                  </Button>
                  {templateExportOptions.length === 0 && <p className="text-xs text-neutral-500">Ingen egne maler ennå.</p>}
                </div>
                <div className="space-y-3 rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
                  <p className="text-sm font-medium text-neutral-800">Importer</p>
                  <p className="text-xs text-neutral-600">Oppretter en ny mal med suffikset «(import)».</p>
                  <input ref={templateImportRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleImportTemplateFile(f) }} />
                  <Button type="button" variant="primary" size="sm" disabled={jsonBusy} onClick={() => templateImportRef.current?.click()}>
                    {jsonBusy ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Importerer…</> : <><Upload className="h-4 w-4" aria-hidden />Velg JSON-fil</>}
                  </Button>
                </div>
              </div>
            )}
          </ModuleSectionCard>
        )}

        {/* ── Arbeidsflyt ──────────────────────────────────────────────── */}
        {tab === 'arbeidsflyt' && (
          <ModuleSectionCard className="p-5 md:p-6">
            <div className="mb-3 flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-[#1a3d32]" />
              <h2 className="text-lg font-semibold text-neutral-900">Arbeidsflyt</h2>
            </div>
            <p className="mb-4 text-sm text-neutral-600">Koble hendelser for undersøkelsesmodulen til e-postregler og automatisering.</p>
            <WorkflowRulesTab supabase={supabase} module="survey" triggerEvents={SURVEY_WORKFLOW_TRIGGER_EVENTS.map((e) => ({ value: e.value, label: e.label }))} />
          </ModuleSectionCard>
        )}
      </div>

      <SlidePanel open={showAdd} onClose={() => setShowAdd(false)} title="Nytt spørsmål i bank" titleId="qbank-panel-title"
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>Avbryt</Button>
            <Button type="button" variant="primary" disabled={qbSaving || !qbText.trim() || !qbCategory.trim()} onClick={() => void handleSaveBank()}>
              {qbSaving ? 'Lagrer…' : 'Lagre'}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="qb-cat">Kategori (obligatorisk)</label>
            <StandardInput id="qb-cat" value={qbCategory} onChange={(e) => setQbCategory(e.target.value)} placeholder="F.eks. Jobbkrav" />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="qb-text">Spørsmålstekst (obligatorisk)</label>
            <StandardTextarea id="qb-text" value={qbText} onChange={(e) => setQbText(e.target.value)} rows={3} />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="qb-type">Type</label>
            <SearchableSelect value={qbType} options={typeOptions} onChange={(v) => setQbType(v as SurveyQuestionType)} />
          </div>
        </div>
      </SlidePanel>
    </ModulePageShell>
  )
}
