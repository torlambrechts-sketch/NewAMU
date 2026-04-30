import { ModuleSectionCard } from '../../module'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import { StandardTextarea } from '../../ui/Textarea'
import { YesNoToggle } from '../../ui/FormToggles'
import { SearchableSelect, type SelectOption } from '../../ui/SearchableSelect'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../../layout/WorkplaceStandardFormPanel'
import type { SurveyModuleSettings } from '../../../../modules/survey/surveyAdminSettingsSchema'

const LAYOUT_OPTIONS: SelectOption[] = [
  { value: 'paginated', label: 'Paginert — én side per seksjon' },
  { value: 'single_page', label: 'Én lang side (ruller)' },
  { value: 'one_per_page', label: 'Ett spørsmål om gangen' },
]

const FONT_SIZE_OPTIONS: SelectOption[] = [
  { value: 'small', label: 'Liten' },
  { value: 'medium', label: 'Normal' },
  { value: 'large', label: 'Stor (tilgjengelighet)' },
]

type Props = {
  settings: SurveyModuleSettings
  setSettings: React.Dispatch<React.SetStateAction<SurveyModuleSettings>>
  saving: boolean
  onSave: () => void
}

export function SurveySettingsUtseende({ settings, setSettings, saving, onSave }: Props) {
  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <h2 className="text-lg font-semibold text-neutral-900">Utseende og layout</h2>
      <div className="mt-6 space-y-8">

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Visningsformat</p>
            <p className="mt-1 text-sm text-neutral-600">Hvordan spørsmål presenteres for respondenten.</p>
          </div>
          <div className="space-y-4">
            <div>
              <span className={WPSTD_FORM_FIELD_LABEL}>Layout</span>
              <div className="mt-1.5">
                <SearchableSelect
                  value={settings.survey_layout ?? 'paginated'}
                  options={LAYOUT_OPTIONS}
                  onChange={(v) => setSettings((p) => ({ ...p, survey_layout: v as SurveyModuleSettings['survey_layout'] }))}
                />
              </div>
            </div>
            <div>
              <span className={WPSTD_FORM_FIELD_LABEL}>Skriftstørrelse</span>
              <div className="mt-1.5">
                <SearchableSelect
                  value={settings.font_size ?? 'medium'}
                  options={FONT_SIZE_OPTIONS}
                  onChange={(v) => setSettings((p) => ({ ...p, font_size: v as SurveyModuleSettings['font_size'] }))}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div><p className="text-sm font-medium text-neutral-800">Navigasjon og fremdrift</p></div>
          <div className="space-y-3">
            {([
              { key: 'show_progress_bar' as const,    label: 'Vis fremdriftslinje',    def: true },
              { key: 'show_question_numbers' as const, label: 'Vis spørsmålsnummer',    def: true },
              { key: 'allow_back_navigation' as const, label: 'Tillat tilbakenavigering', def: true },
            ]).map(({ key, label, def }) => (
              <div key={key}>
                <span className={WPSTD_FORM_FIELD_LABEL}>{label}</span>
                <div className="mt-2">
                  <YesNoToggle value={settings[key] ?? def} onChange={(v) => setSettings((p) => ({ ...p, [key]: v }))} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Velkomstside</p>
            <p className="mt-1 text-sm text-neutral-600">Vises før første spørsmål.</p>
          </div>
          <div className="space-y-3">
            <div>
              <span className={WPSTD_FORM_FIELD_LABEL}>Aktiver velkomstside</span>
              <div className="mt-2">
                <YesNoToggle value={settings.welcome_page_enabled ?? false} onChange={(v) => setSettings((p) => ({ ...p, welcome_page_enabled: v }))} />
              </div>
            </div>
            {settings.welcome_page_enabled && (
              <div>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ut-welcome">Innhold (HTML)</label>
                <StandardTextarea
                  id="ut-welcome"
                  rows={4}
                  value={settings.welcome_page_html ?? ''}
                  onChange={(e) => setSettings((p) => ({ ...p, welcome_page_html: e.target.value }))}
                  placeholder="<h2>Velkommen!</h2><p>Undersøkelsen tar ca. 5 minutter…</p>"
                />
              </div>
            )}
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Takkeside</p>
            <p className="mt-1 text-sm text-neutral-600">Vises etter innsendt svar.</p>
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ut-thanks">Innhold (HTML)</label>
            <StandardTextarea
              id="ut-thanks"
              rows={4}
              value={settings.thankyou_page_html ?? ''}
              onChange={(e) => setSettings((p) => ({ ...p, thankyou_page_html: e.target.value }))}
              placeholder="<h2>Takk for ditt svar!</h2>"
            />
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Merkevare</p>
            <p className="mt-1 text-sm text-neutral-600">Logo og aksentfarge i respondentvisningen.</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ut-logo">Logo-URL</label>
              <StandardInput id="ut-logo" type="url" value={settings.branding_logo_url ?? ''} onChange={(e) => setSettings((p) => ({ ...p, branding_logo_url: e.target.value }))} placeholder="https://example.com/logo.png" />
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ut-color">Primærfarge (hex)</label>
              <div className="mt-1.5 flex items-center gap-2">
                <StandardInput id="ut-color" value={settings.branding_primary_color ?? ''} onChange={(e) => setSettings((p) => ({ ...p, branding_primary_color: e.target.value }))} placeholder="#1a3d32" className="max-w-[160px]" />
                {settings.branding_primary_color && (
                  <span className="h-8 w-8 rounded border border-neutral-200" style={{ backgroundColor: settings.branding_primary_color }} aria-hidden />
                )}
              </div>
            </div>
          </div>
        </div>

        <Button type="button" variant="primary" disabled={saving} onClick={onSave}>
          {saving ? 'Lagrer…' : 'Lagre utseende'}
        </Button>
      </div>
    </ModuleSectionCard>
  )
}
