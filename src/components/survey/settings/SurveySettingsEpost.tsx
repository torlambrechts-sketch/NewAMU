import { ModuleSectionCard } from '../../module'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import { StandardTextarea } from '../../ui/Textarea'
import { InfoBox } from '../../ui/AlertBox'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../../layout/WorkplaceStandardFormPanel'
import type { SurveyModuleSettings } from '../../../../modules/survey/surveyAdminSettingsSchema'

type Props = {
  settings: SurveyModuleSettings
  setSettings: React.Dispatch<React.SetStateAction<SurveyModuleSettings>>
  saving: boolean
  onSave: () => void
}

export function SurveySettingsEpost({ settings, setSettings, saving, onSave }: Props) {
  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <h2 className="text-lg font-semibold text-neutral-900">E-postinnstillinger</h2>
      <div className="mt-2">
        <InfoBox>
          Variabler: <code className="rounded bg-neutral-100 px-1 text-xs">{'{{title}}'}</code>{' '}
          <code className="rounded bg-neutral-100 px-1 text-xs">{'{{link}}'}</code>{' '}
          <code className="rounded bg-neutral-100 px-1 text-xs">{'{{name}}'}</code>
        </InfoBox>
      </div>
      <div className="mt-6 space-y-8">

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Invitasjons-e-post</p>
            <p className="mt-1 text-sm text-neutral-600">Sendes når en deltaker inviteres.</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ep-inv-subj">Emne</label>
              <StandardInput id="ep-inv-subj" value={settings.invite_email_subject_template ?? ''} onChange={(e) => setSettings((p) => ({ ...p, invite_email_subject_template: e.target.value }))} placeholder="Du er invitert: {{title}}" />
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ep-inv-body">Innhold (HTML)</label>
              <StandardTextarea id="ep-inv-body" rows={6} value={settings.invite_email_html_template ?? ''} onChange={(e) => setSettings((p) => ({ ...p, invite_email_html_template: e.target.value }))} placeholder="<p>Hei {{name}},</p><p><a href='{{link}}'>Svar her</a></p>" />
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Påminnelses-e-post</p>
            <p className="mt-1 text-sm text-neutral-600">Sendes automatisk til deltakere som ikke har svart.</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ep-rem-subj">Emne</label>
              <StandardInput id="ep-rem-subj" value={settings.reminder_email_subject_template ?? ''} onChange={(e) => setSettings((p) => ({ ...p, reminder_email_subject_template: e.target.value }))} placeholder="Påminnelse: {{title}}" />
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ep-rem-body">Innhold (HTML)</label>
              <StandardTextarea id="ep-rem-body" rows={6} value={settings.reminder_email_html_template ?? ''} onChange={(e) => setSettings((p) => ({ ...p, reminder_email_html_template: e.target.value }))} placeholder="<p>Hei {{name}}, vi minner om undersøkelsen…</p>" />
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Påminnelsesregler</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ep-max-rem">Maks påminnelser</label>
              <StandardInput id="ep-max-rem" type="number" min={0} max={20} value={settings.max_reminders_per_invitation ?? 3} onChange={(e) => setSettings((p) => ({ ...p, max_reminders_per_invitation: Number(e.target.value) }))} />
              <p className="mt-1 text-xs text-neutral-500">0 = ubegrenset</p>
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ep-min-hrs">Min. timer mellom</label>
              <StandardInput id="ep-min-hrs" type="number" min={0} max={8760} value={settings.reminder_min_hours_since_last ?? 48} onChange={(e) => setSettings((p) => ({ ...p, reminder_min_hours_since_last: Number(e.target.value) }))} />
              <p className="mt-1 text-xs text-neutral-500">timer</p>
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ep-delay">Forsinkelse per e-post</label>
              <StandardInput id="ep-delay" type="number" min={0} max={60000} value={settings.email_send_delay_ms ?? 200} onChange={(e) => setSettings((p) => ({ ...p, email_send_delay_ms: Number(e.target.value) }))} />
              <p className="mt-1 text-xs text-neutral-500">millisekunder</p>
            </div>
          </div>
        </div>

        <Button type="button" variant="primary" disabled={saving} onClick={onSave}>
          {saving ? 'Lagrer…' : 'Lagre e-postinnstillinger'}
        </Button>
      </div>
    </ModuleSectionCard>
  )
}
