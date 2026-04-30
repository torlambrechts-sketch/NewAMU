import { ModuleSectionCard } from '../../module'
import { Button } from '../../ui/Button'
import { StandardTextarea } from '../../ui/Textarea'
import { StandardInput } from '../../ui/Input'
import { YesNoToggle } from '../../ui/FormToggles'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../../layout/WorkplaceStandardFormPanel'
import type { SurveyModuleSettings } from '../../../../modules/survey/surveyAdminSettingsSchema'

type Props = {
  settings: SurveyModuleSettings
  setSettings: React.Dispatch<React.SetStateAction<SurveyModuleSettings>>
  saving: boolean
  onSave: () => void
}

export function SurveySettingsGenerelt({ settings, setSettings, saving, onSave }: Props) {
  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <h2 className="text-lg font-semibold text-neutral-900">Generelle innstillinger</h2>
      <div className="mt-6 space-y-8">

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Anonymitet som standard</p>
            <p className="mt-1 text-sm text-neutral-600">Nye undersøkelser starter med denne innstillingen — kan overstyres per undersøkelse.</p>
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
            <p className="mt-1 text-sm text-neutral-600">Vises for administratorer øverst i modulen. Støtter enkel HTML.</p>
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="gen-intro">Innledning (HTML)</label>
            <StandardTextarea
              id="gen-intro"
              rows={4}
              value={settings.intro_html ?? ''}
              onChange={(e) => setSettings((p) => ({ ...p, intro_html: e.target.value }))}
              placeholder="<p>Kjære medarbeider…</p>"
            />
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Terskel for svarprosent</p>
            <p className="mt-1 text-sm text-neutral-600">Utløser arbeidsflyt når andelen nås. Sett til 0 for å deaktivere.</p>
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="gen-threshold">Terskel (%)</label>
            <div className="mt-1.5 max-w-[120px]">
              <StandardInput
                id="gen-threshold"
                type="number"
                min={0}
                max={100}
                value={settings.response_rate_threshold_pct ?? 0}
                onChange={(e) => setSettings((p) => ({ ...p, response_rate_threshold_pct: Number(e.target.value) }))}
              />
            </div>
            <p className="mt-1 text-xs text-neutral-500">0 = deaktivert</p>
          </div>
        </div>

        <Button type="button" variant="primary" disabled={saving} onClick={onSave}>
          {saving ? 'Lagrer…' : 'Lagre innstillinger'}
        </Button>
      </div>
    </ModuleSectionCard>
  )
}
