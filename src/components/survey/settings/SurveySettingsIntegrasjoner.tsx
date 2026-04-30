import { ModuleSectionCard } from '../../module'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import { YesNoToggle } from '../../ui/FormToggles'
import { InfoBox } from '../../ui/AlertBox'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../../layout/WorkplaceStandardFormPanel'
import type { SurveyModuleSettings } from '../../../../modules/survey/surveyAdminSettingsSchema'

const WEBHOOK_EVENTS = [
  { value: 'response_submitted',  label: 'Svar innsendt' },
  { value: 'survey_completed',    label: 'Undersøkelse fullført (100 %)' },
  { value: 'threshold_reached',   label: 'Svarprosent nådd terskel' },
  { value: 'survey_closed',       label: 'Undersøkelse lukket' },
  { value: 'invitation_sent',     label: 'Invitasjon sendt' },
  { value: 'reminder_sent',       label: 'Påminnelse sendt' },
]

function toggleEvent(current: string[] | undefined, value: string): string[] {
  const arr = current ?? []
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
}

type Props = {
  settings: SurveyModuleSettings
  setSettings: React.Dispatch<React.SetStateAction<SurveyModuleSettings>>
  saving: boolean
  onSave: () => void
}

export function SurveySettingsIntegrasjoner({ settings, setSettings, saving, onSave }: Props) {
  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <h2 className="text-lg font-semibold text-neutral-900">Integrasjoner</h2>
      <div className="mt-6 space-y-10">

        {/* ── Webhook ─────────────────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-semibold text-neutral-800">Webhook</h3>
          <p className="mt-0.5 text-sm text-neutral-600">Send hendelser til et eksternt endepunkt (HTTP POST, JSON).</p>
          <div className="mt-4 space-y-6">
            <div className={WPSTD_FORM_ROW_GRID}>
              <div><p className="text-sm font-medium text-neutral-800">Aktiver webhook</p></div>
              <div>
                <span className={WPSTD_FORM_FIELD_LABEL}>Webhook</span>
                <div className="mt-2">
                  <YesNoToggle value={settings.webhook_enabled ?? false} onChange={(v) => setSettings((p) => ({ ...p, webhook_enabled: v }))} />
                </div>
              </div>
            </div>

            {settings.webhook_enabled && (
              <>
                <div className={WPSTD_FORM_ROW_GRID}>
                  <div><p className="text-sm font-medium text-neutral-800">Endepunkt</p></div>
                  <div className="space-y-3">
                    <div>
                      <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="wh-url">URL</label>
                      <StandardInput id="wh-url" type="url" value={settings.webhook_url ?? ''} onChange={(e) => setSettings((p) => ({ ...p, webhook_url: e.target.value }))} placeholder="https://example.com/hooks/survey" />
                    </div>
                    <div>
                      <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="wh-secret">Signeringshemmelighet</label>
                      <StandardInput id="wh-secret" type="password" value={settings.webhook_secret ?? ''} onChange={(e) => setSettings((p) => ({ ...p, webhook_secret: e.target.value }))} placeholder="Valgfritt — sendes som X-Survey-Signature" />
                    </div>
                  </div>
                </div>
                <div className={WPSTD_FORM_ROW_GRID}>
                  <div><p className="text-sm font-medium text-neutral-800">Hendelser</p></div>
                  <div className="space-y-2">
                    {WEBHOOK_EVENTS.map((ev) => (
                      <label key={ev.value} className="flex cursor-pointer items-center gap-2.5 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          className="rounded border-neutral-300 text-[#1a3d32] focus:ring-[#1a3d32]/30"
                          checked={(settings.webhook_events ?? []).includes(ev.value)}
                          onChange={() => setSettings((p) => ({ ...p, webhook_events: toggleEvent(p.webhook_events, ev.value) }))}
                        />
                        {ev.label}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        <hr className="border-neutral-200" />

        {/* ── Slack ───────────────────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-semibold text-neutral-800">Slack</h3>
          <p className="mt-0.5 text-sm text-neutral-600">Send varsler til en Slack-kanal via innkommende webhook.</p>
          <div className="mt-4 space-y-6">
            <div className={WPSTD_FORM_ROW_GRID}>
              <div><p className="text-sm font-medium text-neutral-800">Aktiver Slack</p></div>
              <div>
                <span className={WPSTD_FORM_FIELD_LABEL}>Slack-varsling</span>
                <div className="mt-2">
                  <YesNoToggle value={settings.slack_enabled ?? false} onChange={(v) => setSettings((p) => ({ ...p, slack_enabled: v }))} />
                </div>
              </div>
            </div>
            {settings.slack_enabled && (
              <>
                <div className={WPSTD_FORM_ROW_GRID}>
                  <div><p className="text-sm font-medium text-neutral-800">Webhook-URL</p></div>
                  <div>
                    <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sl-url">Slack innkommende webhook</label>
                    <StandardInput id="sl-url" type="url" value={settings.slack_webhook_url ?? ''} onChange={(e) => setSettings((p) => ({ ...p, slack_webhook_url: e.target.value }))} placeholder="https://hooks.slack.com/services/…" />
                  </div>
                </div>
                <div className={WPSTD_FORM_ROW_GRID}>
                  <div><p className="text-sm font-medium text-neutral-800">Varsle om</p></div>
                  <div className="space-y-2">
                    {([
                      { key: 'slack_notify_on_response' as const,  label: 'Nytt svar mottatt' },
                      { key: 'slack_notify_on_threshold' as const,  label: 'Svarprosent nådd terskel' },
                      { key: 'slack_notify_on_closed' as const,     label: 'Undersøkelse lukket' },
                    ]).map(({ key, label }) => (
                      <label key={key} className="flex cursor-pointer items-center gap-2.5 text-sm text-neutral-700">
                        <input type="checkbox" className="rounded border-neutral-300 text-[#1a3d32] focus:ring-[#1a3d32]/30" checked={settings[key] ?? false} onChange={(e) => setSettings((p) => ({ ...p, [key]: e.target.checked }))} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        <hr className="border-neutral-200" />

        {/* ── API ─────────────────────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-semibold text-neutral-800">API-tilgang</h3>
          <p className="mt-0.5 text-sm text-neutral-600">Gi eksterne systemer lesetilgang til undersøkelsesdata via REST API.</p>
          <div className="mt-4">
            <div className={WPSTD_FORM_ROW_GRID}>
              <div><p className="text-sm font-medium text-neutral-800">Aktiver API</p></div>
              <div>
                <span className={WPSTD_FORM_FIELD_LABEL}>API-tilgang</span>
                <div className="mt-2">
                  <YesNoToggle value={settings.api_access_enabled ?? false} onChange={(v) => setSettings((p) => ({ ...p, api_access_enabled: v }))} />
                </div>
                {settings.api_access_enabled && (
                  <div className="mt-3">
                    <InfoBox>API-nøkler administreres under <strong>Innstillinger → API-tilgang</strong>. Endepunkt: <code className="rounded bg-neutral-100 px-1 text-xs">/api/v1/surveys</code></InfoBox>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <Button type="button" variant="primary" disabled={saving} onClick={onSave}>
          {saving ? 'Lagrer…' : 'Lagre integrasjoner'}
        </Button>
      </div>
    </ModuleSectionCard>
  )
}
