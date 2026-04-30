import { ModuleSectionCard } from '../../module'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import { StandardTextarea } from '../../ui/Textarea'
import { YesNoToggle } from '../../ui/FormToggles'
import { InfoBox } from '../../ui/AlertBox'
import { SearchableSelect, type SelectOption } from '../../ui/SearchableSelect'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../../layout/WorkplaceStandardFormPanel'
import type { SurveyModuleSettings } from '../../../../modules/survey/surveyAdminSettingsSchema'

const SMS_PROVIDER_OPTIONS: SelectOption[] = [
  { value: 'twilio', label: 'Twilio' },
  { value: 'vonage', label: 'Vonage (Nexmo)' },
  { value: 'messagebird', label: 'MessageBird' },
  { value: 'custom', label: 'Egendefinert' },
]

type Props = {
  settings: SurveyModuleSettings
  setSettings: React.Dispatch<React.SetStateAction<SurveyModuleSettings>>
  saving: boolean
  onSave: () => void
}

export function SurveySettingsSms({ settings, setSettings, saving, onSave }: Props) {
  const smsOn = settings.sms_enabled ?? false
  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <h2 className="text-lg font-semibold text-neutral-900">SMS-varsling</h2>
      <p className="mt-1 text-sm text-neutral-600">Send invitasjoner og påminnelser via SMS i tillegg til e-post.</p>
      <div className="mt-6 space-y-8">

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Aktiver SMS</p>
            <p className="mt-1 text-sm text-neutral-600">Krever API-oppsett hos valgt leverandør.</p>
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>SMS-varsling</span>
            <div className="mt-2">
              <YesNoToggle value={smsOn} onChange={(v) => setSettings((p) => ({ ...p, sms_enabled: v }))} />
            </div>
          </div>
        </div>

        {smsOn && (
          <>
            <div className={WPSTD_FORM_ROW_GRID}>
              <div><p className="text-sm font-medium text-neutral-800">Leverandør og avsender</p></div>
              <div className="space-y-3">
                <div>
                  <span className={WPSTD_FORM_FIELD_LABEL}>SMS-leverandør</span>
                  <div className="mt-1.5">
                    <SearchableSelect value={settings.sms_provider ?? 'twilio'} options={SMS_PROVIDER_OPTIONS} onChange={(v) => setSettings((p) => ({ ...p, sms_provider: v as SurveyModuleSettings['sms_provider'] }))} />
                  </div>
                </div>
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sms-sender">Avsendernavn (maks 11 tegn)</label>
                  <StandardInput id="sms-sender" maxLength={11} value={settings.sms_sender_name ?? ''} onChange={(e) => setSettings((p) => ({ ...p, sms_sender_name: e.target.value }))} placeholder="Virksomhet" />
                  <p className="mt-1 text-xs text-neutral-500">{(settings.sms_sender_name ?? '').length}/11 tegn</p>
                </div>
              </div>
            </div>

            <div className={WPSTD_FORM_ROW_GRID}>
              <div>
                <p className="text-sm font-medium text-neutral-800">Meldingstekster</p>
                <div className="mt-2">
                  <InfoBox>Variabler: <code className="rounded bg-neutral-100 px-1 text-xs">{'{{name}}'}</code> <code className="rounded bg-neutral-100 px-1 text-xs">{'{{link}}'}</code></InfoBox>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sms-invite">Invitasjon</label>
                  <StandardTextarea id="sms-invite" rows={3} maxLength={160} value={settings.sms_invite_template ?? ''} onChange={(e) => setSettings((p) => ({ ...p, sms_invite_template: e.target.value }))} placeholder="Hei {{name}}, du er invitert: {{link}}" />
                  <p className="mt-1 text-xs text-neutral-500">{(settings.sms_invite_template ?? '').length}/160 tegn</p>
                </div>
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sms-reminder">Påminnelse</label>
                  <StandardTextarea id="sms-reminder" rows={3} maxLength={160} value={settings.sms_reminder_template ?? ''} onChange={(e) => setSettings((p) => ({ ...p, sms_reminder_template: e.target.value }))} placeholder="Hei {{name}}, påminnelse om undersøkelse: {{link}}" />
                  <p className="mt-1 text-xs text-neutral-500">{(settings.sms_reminder_template ?? '').length}/160 tegn</p>
                </div>
              </div>
            </div>

            <div className={WPSTD_FORM_ROW_GRID}>
              <div><p className="text-sm font-medium text-neutral-800">Maks SMS-påminnelser</p></div>
              <div>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sms-max">Påminnelser per invitasjon</label>
                <div className="mt-1.5 max-w-[120px]">
                  <StandardInput id="sms-max" type="number" min={0} max={5} value={settings.sms_max_reminders ?? 2} onChange={(e) => setSettings((p) => ({ ...p, sms_max_reminders: Number(e.target.value) }))} />
                </div>
              </div>
            </div>
          </>
        )}

        <Button type="button" variant="primary" disabled={saving} onClick={onSave}>
          {saving ? 'Lagrer…' : 'Lagre SMS-innstillinger'}
        </Button>
      </div>
    </ModuleSectionCard>
  )
}
