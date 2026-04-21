import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, GitBranch, ListChecks, Settings } from 'lucide-react'
import { ModulePageShell } from '../components/module/ModulePageShell'
import { Tabs as UITabs } from '../components/ui/Tabs'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_ROW_GRID,
} from '../components/layout/WorkplaceStandardFormPanel'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
  LAYOUT_TABLE1_POSTINGS_TD,
} from '../components/layout/layoutTable1PostingsKit'
import { WorkflowRulesTab } from '../components/workflow/WorkflowRulesTab'
import { SURVEY_WORKFLOW_TRIGGER_EVENTS } from '../components/workflow/workflowTriggerRegistry'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { fetchOrgModulePayload, upsertOrgModulePayload } from '../lib/orgModulePayload'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import { useSurvey } from '../../modules/survey'
import { QUESTION_TYPE_OPTIONS, questionTypeLabel } from '../../modules/survey/surveyLabels'
import { parseSurveyModuleSettings, type SurveyModuleSettings } from '../../modules/survey/surveyAdminSettingsSchema'
import { WarningBox } from '../components/ui/AlertBox'
import { Button } from '../components/ui/Button'
import { StandardInput } from '../components/ui/Input'
import { SearchableSelect, type SelectOption } from '../components/ui/SearchableSelect'
import { StandardTextarea } from '../components/ui/Textarea'
import { YesNoToggle } from '../components/ui/FormToggles'
import type { SurveyQuestionBankRow, SurveyQuestionType } from '../../modules/survey/types'

const SETTINGS_KEY = 'survey_settings' as const

type AdminTab = 'generelt' | 'sporsmalsbank' | 'arbeidsflyt'

export function SurveyModuleAdminPage() {
  const navigate = useNavigate()
  const { supabase, can, isAdmin, organization } = useOrgSetupContext()
  const orgId = organization?.id
  const canManage = isAdmin || can('survey.manage')
  const survey = useSurvey({ supabase })

  const [tab, setTab] = useState<AdminTab>('generelt')
  const [settings, setSettings] = useState<SurveyModuleSettings>(() => parseSurveyModuleSettings({}))
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsSaveBusy, setSettingsSaveBusy] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  const [bankForm, setBankForm] = useState<{
    id?: string
    category: string
    questionText: string
    questionType: SurveyQuestionType
  }>({ category: '', questionText: '', questionType: 'rating_1_to_5' })
  const [bankSaving, setBankSaving] = useState(false)

  const typeOptions: SelectOption[] = QUESTION_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))

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
    if (canManage) {
      void loadSettings()
      void survey.loadQuestionBank()
    }
  }, [canManage, loadSettings, survey.loadQuestionBank])

  const saveSettings = useCallback(async () => {
    if (!supabase || !orgId) return
    setSettingsSaveBusy(true)
    setSettingsError(null)
    try {
      await upsertOrgModulePayload(supabase, orgId, SETTINGS_KEY, settings)
    } catch (e) {
      setSettingsError(getSupabaseErrorMessage(e))
    } finally {
      setSettingsSaveBusy(false)
    }
  }, [supabase, orgId, settings])

  const saveBankRow = useCallback(async () => {
    if (!bankForm.category.trim() || !bankForm.questionText.trim()) return
    setBankSaving(true)
    const row = await survey.upsertQuestionBank({
      id: bankForm.id,
      category: bankForm.category.trim(),
      questionText: bankForm.questionText.trim(),
      questionType: bankForm.questionType,
    })
    setBankSaving(false)
    if (row) {
      setBankForm({ category: '', questionText: '', questionType: 'rating_1_to_5' })
    }
  }, [bankForm, survey])

  const startEditBank = useCallback((row: SurveyQuestionBankRow) => {
    setTab('sporsmalsbank')
    setBankForm({
      id: row.id,
      category: row.category,
      questionText: row.question_text,
      questionType: row.question_type,
    })
  }, [])

  const clearBankForm = useCallback(() => {
    setBankForm({ category: '', questionText: '', questionType: 'rating_1_to_5' })
  }, [])

  if (!canManage) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'HMS' },
          { label: 'Undersøkelser', to: '/survey' },
          { label: 'Innstillinger' },
        ]}
        title="Innstillinger: undersøkelser"
      >
        <WarningBox>
          Du har ikke tilgang til undersøkelsesmodulens innstillinger. Kontakt administrator.
        </WarningBox>
      </ModulePageShell>
    )
  }

  const tabsUiItems = [
    { id: 'generelt', label: 'Generelt', icon: Settings },
    { id: 'sporsmalsbank', label: 'Spørsmålsbank', icon: ListChecks },
    { id: 'arbeidsflyt', label: 'Arbeidsflyt', icon: GitBranch },
  ]

  const showHookError = survey.error
  const showSettingsError = settingsError

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'HMS' },
        { label: 'Undersøkelser', to: '/survey' },
        { label: 'Innstillinger' },
      ]}
      title="Innstillinger: undersøkelser"
      description="Globale valg, gjenbrukbare spørsmål og arbeidsflyt for modulen."
      headerActions={
        <Button
          type="button"
          variant="secondary"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate('/survey')}
        >
          Tilbake til modul
        </Button>
      }
      tabs={
        <UITabs
          items={tabsUiItems}
          activeId={tab}
          onChange={(id) => setTab(id as AdminTab)}
          overflow="scroll"
        />
      }
    >
      {showSettingsError ? <WarningBox>{showSettingsError}</WarningBox> : null}
      {showHookError ? <WarningBox>{showHookError}</WarningBox> : null}

      {tab === 'generelt' && (
          <div className="space-y-6">
            {settingsLoading ? <p className="text-sm text-neutral-500">Laster innstillinger…</p> : null}
            <div className={WPSTD_FORM_ROW_GRID}>
              <div>
                <p className="text-sm font-medium text-neutral-800">Introduksjonstekst (valgfritt)</p>
                <p className="mt-1 text-sm text-neutral-600">
                  Valgfri intern veiledning til HMS/HR ved bruk av modulen (lagres som tekst).
                </p>
              </div>
              <div>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sv-admin-intro">
                  Tekst
                </label>
                <StandardTextarea
                  id="sv-admin-intro"
                  rows={6}
                  value={settings.intro_html ?? ''}
                  onChange={(e) => setSettings((p) => ({ ...p, intro_html: e.target.value }))}
                  placeholder="Kort veiledning til arbeidsgiver om kartlegging etter kapittel 4 i AML …"
                />
                <p className="mt-1 text-xs text-neutral-500">
                  Standard for nye undersøkelser: anonymitet kan overstyres i hver enkelt undersøkelse.
                </p>
                <div className="mt-4 max-w-sm">
                  <span className={WPSTD_FORM_FIELD_LABEL}>Nye undersøkelser: standard anonym</span>
                  <p className="text-xs text-neutral-500">Påminnelse; faktisk lagring per undersøkelse forblir kilden.</p>
                  <div className="mt-2">
                    <YesNoToggle
                      value={settings.default_anonymous ?? false}
                      onChange={(v) => setSettings((p) => ({ ...p, default_anonymous: v }))}
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <Button type="button" variant="primary" disabled={settingsSaveBusy} onClick={() => void saveSettings()}>
                    {settingsSaveBusy ? 'Lagrer…' : 'Lagre innstillinger'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'sporsmalsbank' && (
          <div className="space-y-6">
            <p className="text-sm text-neutral-600">
              Fyll inn fritekst for kategorier (f.eks. &quot;Belastning&quot; eller &quot;Ledelse&quot;). Ingen forhåndsdefinert liste.
            </p>
            <div className="rounded-lg border border-neutral-200/90 bg-white p-4" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <h3 className="text-sm font-semibold text-neutral-900">
                {bankForm.id ? 'Rediger spørsmål i banken' : 'Nytt spørsmål i banken'}
              </h3>
              <div className="mt-4 space-y-4">
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sv-bank-cat">
                    Kategori
                  </label>
                  <StandardInput
                    id="sv-bank-cat"
                    value={bankForm.category}
                    onChange={(e) => setBankForm((b) => ({ ...b, category: e.target.value }))}
                    placeholder="Egen kategori, f.eks. Psykososialt klima"
                  />
                </div>
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sv-bank-q">
                    Spørsmålstekst
                  </label>
                  <StandardTextarea
                    id="sv-bank-q"
                    rows={3}
                    value={bankForm.questionText}
                    onChange={(e) => setBankForm((b) => ({ ...b, questionText: e.target.value }))}
                    placeholder="Hvordan opplever du arbeidspresset?"
                  />
                </div>
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sv-bank-type">
                    Spørsmålstype
                  </label>
                  <SearchableSelect
                    value={bankForm.questionType}
                    options={typeOptions}
                    onChange={(v) => setBankForm((b) => ({ ...b, questionType: v as SurveyQuestionType }))}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    disabled={bankSaving}
                    onClick={() => void saveBankRow()}
                  >
                    {bankSaving ? 'Lagrer…' : bankForm.id ? 'Oppdater' : 'Legg til i banken'}
                  </Button>
                  {bankForm.id ? (
                    <Button type="button" variant="secondary" onClick={clearBankForm}>
                      Avbryt redigering
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      void survey.loadQuestionBank()
                    }}
                  >
                    Oppdater liste
                  </Button>
                </div>
              </div>
            </div>

            {survey.loading && survey.questionBank.length === 0 ? (
              <p className="text-sm text-neutral-500">Laster spørsmålsbank…</p>
            ) : survey.questionBank.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-neutral-500">
                <p>Ingen gjenbrukbare spørsmål i banken ennå.</p>
                <p className="max-w-md">Opprett forslag over som kan hentes inn når byggeren får støtte for &quot;fra bank&quot; i undersøkelsen.</p>
              </div>
            ) : (
              <div className="min-w-0 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Kategori</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Spørsmål</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Type</th>
                      <th className={`${LAYOUT_TABLE1_POSTINGS_TH} text-right`}>Handlinger</th>
                    </tr>
                  </thead>
                  <tbody>
                    {survey.questionBank.map((r) => (
                      <tr key={r.id} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                        <td className={LAYOUT_TABLE1_POSTINGS_TD}>{r.category}</td>
                        <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                          <span className="whitespace-normal text-neutral-900">{r.question_text}</span>
                        </td>
                        <td className={LAYOUT_TABLE1_POSTINGS_TD}>{questionTypeLabel(r.question_type)}</td>
                        <td className={`${LAYOUT_TABLE1_POSTINGS_TD} text-right`}>
                          <div className="inline-flex items-center justify-end gap-1">
                            <Button type="button" variant="secondary" size="sm" onClick={() => startEditBank(r)}>
                              Rediger
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                void survey.deleteQuestionBank(r.id)
                              }}
                            >
                              Slett
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      {tab === 'arbeidsflyt' && (
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Hendelser: <code className="text-xs">ON_SURVEY_PUBLISHED</code>, <code className="text-xs">ON_SURVEY_CLOSED</code>,{' '}
            <code className="text-xs">ON_SURVEY_RESPONSE_SUBMITTED</code> — kobles til databasetrigger og{' '}
            <code className="text-xs">workflow_dispatch_db_event</code>. Manuell gjenkalling av de samme hendelsene kan gjøres fra undersøkelsens
            detaljvisning når det trengs.
          </p>
          <WorkflowRulesTab
            supabase={supabase}
            module="survey"
            triggerEvents={SURVEY_WORKFLOW_TRIGGER_EVENTS.map((e) => ({ value: e.value, label: e.label }))}
          />
        </div>
      )}
    </ModulePageShell>
  )
}
