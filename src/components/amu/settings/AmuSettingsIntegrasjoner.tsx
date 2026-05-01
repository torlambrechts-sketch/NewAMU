import { ModuleSectionCard } from '../../module'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import { YesNoToggle } from '../../ui/FormToggles'
import { InfoBox } from '../../ui/AlertBox'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../../layout/WorkplaceStandardFormPanel'
import type { AmuModuleSettings } from '../../../../modules/amu/amuModuleSettingsSchema'

const WEBHOOK_EVENTS = [
  { value: 'meeting_scheduled',   label: 'Møte planlagt' },
  { value: 'meeting_signed',      label: 'Referat signert' },
  { value: 'decision_created',    label: 'Vedtak fattet' },
  { value: 'critical_item_added', label: 'Kritisk sak registrert' },
  { value: 'member_added',        label: 'Nytt AMU-medlem lagt til' },
  { value: 'member_expired',      label: 'Medlemsmandat utløpt' },
  { value: 'annual_report_signed', label: 'Årsrapport signert' },
]

function toggleEvent(current: string[] | undefined, value: string): string[] {
  const arr = current ?? []
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
}

type Props = {
  settings: AmuModuleSettings
  setSettings: React.Dispatch<React.SetStateAction<AmuModuleSettings>>
  saving: boolean
  onSave: () => void
}

export function AmuSettingsIntegrasjoner({ settings, setSettings, saving, onSave }: Props) {
  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <h2 className="text-lg font-semibold text-neutral-900">Integrasjoner</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Koble AMU-modulen til eksterne systemer via webhook, Slack, kalender og API.
      </p>

      <div className="mt-6 space-y-10">

        {/* ── Webhook ─────────────────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-semibold text-neutral-800">Webhook</h3>
          <p className="mt-0.5 text-sm text-neutral-600">
            Send AMU-hendelser til et eksternt endepunkt (HTTP POST, JSON-payload).
            Nyttig for å koble til HR-systemer, intranett eller egne løsninger.
          </p>
          <div className="mt-4 space-y-6">

            <div className={WPSTD_FORM_ROW_GRID}>
              <div><p className="text-sm font-medium text-neutral-800">Aktiver webhook</p></div>
              <div>
                <span className={WPSTD_FORM_FIELD_LABEL}>Webhook</span>
                <div className="mt-2 max-w-xs">
                  <YesNoToggle
                    value={settings.webhook_enabled ?? false}
                    onChange={(v) => setSettings((p) => ({ ...p, webhook_enabled: v }))}
                  />
                </div>
              </div>
            </div>

            {settings.webhook_enabled && (
              <>
                <div className={WPSTD_FORM_ROW_GRID}>
                  <div><p className="text-sm font-medium text-neutral-800">Endepunkt</p></div>
                  <div className="space-y-3">
                    <div>
                      <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="int-wh-url">URL</label>
                      <StandardInput
                        id="int-wh-url"
                        type="url"
                        value={settings.webhook_url ?? ''}
                        onChange={(e) => setSettings((p) => ({ ...p, webhook_url: e.target.value }))}
                        placeholder="https://example.com/hooks/amu"
                      />
                    </div>
                    <div>
                      <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="int-wh-secret">Signeringshemmelighet</label>
                      <StandardInput
                        id="int-wh-secret"
                        type="password"
                        value={settings.webhook_secret ?? ''}
                        onChange={(e) => setSettings((p) => ({ ...p, webhook_secret: e.target.value }))}
                        placeholder="Valgfritt — sendes som X-AMU-Signature"
                      />
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
          <p className="mt-0.5 text-sm text-neutral-600">
            Send AMU-varsler til en Slack-kanal via innkommende webhook. Praktisk for å holde
            relevante team oppdatert om møter og vedtak.
          </p>
          <div className="mt-4 space-y-6">

            <div className={WPSTD_FORM_ROW_GRID}>
              <div><p className="text-sm font-medium text-neutral-800">Aktiver Slack</p></div>
              <div>
                <span className={WPSTD_FORM_FIELD_LABEL}>Slack-varsling</span>
                <div className="mt-2 max-w-xs">
                  <YesNoToggle
                    value={settings.slack_enabled ?? false}
                    onChange={(v) => setSettings((p) => ({ ...p, slack_enabled: v }))}
                  />
                </div>
              </div>
            </div>

            {settings.slack_enabled && (
              <>
                <div className={WPSTD_FORM_ROW_GRID}>
                  <div><p className="text-sm font-medium text-neutral-800">Webhook-URL</p></div>
                  <div>
                    <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="int-sl-url">Slack innkommende webhook</label>
                    <StandardInput
                      id="int-sl-url"
                      type="url"
                      value={settings.slack_webhook_url ?? ''}
                      onChange={(e) => setSettings((p) => ({ ...p, slack_webhook_url: e.target.value }))}
                      placeholder="https://hooks.slack.com/services/…"
                    />
                  </div>
                </div>

                <div className={WPSTD_FORM_ROW_GRID}>
                  <div><p className="text-sm font-medium text-neutral-800">Varsle om</p></div>
                  <div className="space-y-2">
                    {([
                      { key: 'slack_notify_on_meeting_signed' as const, label: 'Referat signert' },
                      { key: 'slack_notify_on_decision' as const,       label: 'Vedtak fattet' },
                      { key: 'slack_notify_on_critical_item' as const,  label: 'Kritisk sak registrert' },
                    ]).map(({ key, label }) => (
                      <label key={key} className="flex cursor-pointer items-center gap-2.5 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          className="rounded border-neutral-300 text-[#1a3d32] focus:ring-[#1a3d32]/30"
                          checked={settings[key] ?? false}
                          onChange={(e) => setSettings((p) => ({ ...p, [key]: e.target.checked }))}
                        />
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

        {/* ── Calendar ────────────────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-semibold text-neutral-800">Kalendersynkronisering</h3>
          <p className="mt-0.5 text-sm text-neutral-600">
            Generer en iCal-feed som AMU-medlemmer kan abonnere på i Outlook, Google Calendar eller lignende.
          </p>
          <div className="mt-4">
            <div className={WPSTD_FORM_ROW_GRID}>
              <div><p className="text-sm font-medium text-neutral-800">Aktiver iCal-feed</p></div>
              <div>
                <span className={WPSTD_FORM_FIELD_LABEL}>iCal-feed</span>
                <div className="mt-2 max-w-xs">
                  <YesNoToggle
                    value={settings.calendar_ical_enabled ?? false}
                    onChange={(v) => setSettings((p) => ({ ...p, calendar_ical_enabled: v }))}
                  />
                </div>
                {settings.calendar_ical_enabled && (
                  <div className="mt-3">
                    <InfoBox>
                      iCal-URL genereres per bruker under <strong>Min profil → Kalenderintegrasjoner</strong>.
                      Feed-en inneholder kun møter brukeren er invitert til.
                    </InfoBox>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <hr className="border-neutral-200" />

        {/* ── API ─────────────────────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-semibold text-neutral-800">API-tilgang</h3>
          <p className="mt-0.5 text-sm text-neutral-600">
            Gi eksterne systemer lesetilgang til AMU-data via REST API — nyttig for rapporteringsverktøy,
            BI-dashboards eller HR-systemintegrasjoner.
          </p>
          <div className="mt-4">
            <div className={WPSTD_FORM_ROW_GRID}>
              <div><p className="text-sm font-medium text-neutral-800">Aktiver API</p></div>
              <div>
                <span className={WPSTD_FORM_FIELD_LABEL}>API-tilgang</span>
                <div className="mt-2 max-w-xs">
                  <YesNoToggle
                    value={settings.api_access_enabled ?? false}
                    onChange={(v) => setSettings((p) => ({ ...p, api_access_enabled: v }))}
                  />
                </div>
                {settings.api_access_enabled && (
                  <div className="mt-3">
                    <InfoBox>
                      API-nøkler administreres under <strong>Innstillinger → API-tilgang</strong>.
                      Tilgjengelig endepunkt:{' '}
                      <code className="rounded bg-neutral-100 px-1 text-xs">/api/v1/amu</code>
                    </InfoBox>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

      </div>

      <div className="mt-6">
        <Button type="button" variant="primary" disabled={saving} onClick={onSave}>
          {saving ? 'Lagrer…' : 'Lagre integrasjoner'}
        </Button>
      </div>
    </ModuleSectionCard>
  )
}
