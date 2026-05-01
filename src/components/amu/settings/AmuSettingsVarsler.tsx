import { ModuleSectionCard } from '../../module'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import { StandardTextarea } from '../../ui/Textarea'
import { YesNoToggle } from '../../ui/FormToggles'
import { InfoBox } from '../../ui/AlertBox'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../../layout/WorkplaceStandardFormPanel'
import type { AmuModuleSettings } from '../../../../modules/amu/amuModuleSettingsSchema'

type Props = {
  settings: AmuModuleSettings
  setSettings: React.Dispatch<React.SetStateAction<AmuModuleSettings>>
  saving: boolean
  onSave: () => void
}

export function AmuSettingsVarsler({ settings, setSettings, saving, onSave }: Props) {
  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <h2 className="text-lg font-semibold text-neutral-900">Varsler og e-post</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Konfigurer automatiske varsler til AMU-medlemmer — innkallinger, påminnelser og distribusjon av referater.
      </p>

      <div className="mt-6 space-y-10">

        {/* ── Meeting invites ──────────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-semibold text-neutral-800">Møteinnkalling</h3>
          <p className="mt-0.5 text-sm text-neutral-600">
            Send automatisk innkalling til alle AMU-medlemmer når et møte settes som planlagt.
          </p>
          <div className="mt-4 space-y-6">

            <div className={WPSTD_FORM_ROW_GRID}>
              <div><p className="text-sm font-medium text-neutral-800">Send innkalling automatisk</p></div>
              <div>
                <span className={WPSTD_FORM_FIELD_LABEL}>Automatisk innkalling</span>
                <div className="mt-2 max-w-xs">
                  <YesNoToggle
                    value={settings.notify_on_meeting_scheduled ?? true}
                    onChange={(v) => setSettings((p) => ({ ...p, notify_on_meeting_scheduled: v }))}
                  />
                </div>
              </div>
            </div>

            {settings.notify_on_meeting_scheduled !== false && (
              <>
                <div className={WPSTD_FORM_ROW_GRID}>
                  <div>
                    <p className="text-sm font-medium text-neutral-800">Dager i forveien</p>
                    <p className="mt-1 text-sm text-neutral-600">
                      Innkallingen sendes dette antall dager før møtet. Anbefalt er minst 14 dager (AML §7-2).
                    </p>
                  </div>
                  <div>
                    <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="vars-invite-days">Dager i forveien</label>
                    <div className="mt-1.5 max-w-[120px]">
                      <StandardInput
                        id="vars-invite-days"
                        type="number"
                        min={1}
                        max={60}
                        value={settings.meeting_invite_days_before ?? 14}
                        onChange={(e) => setSettings((p) => ({ ...p, meeting_invite_days_before: Number(e.target.value) }))}
                      />
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">Anbefalt: minst 14 dager</p>
                  </div>
                </div>

                <div className={WPSTD_FORM_ROW_GRID}>
                  <div>
                    <p className="text-sm font-medium text-neutral-800">E-postmal — innkalling</p>
                    <p className="mt-1 text-sm text-neutral-600">
                      Tilgjengelige variabler: <code className="rounded bg-neutral-100 px-1 text-xs">{'{{title}}'}</code>{' '}
                      <code className="rounded bg-neutral-100 px-1 text-xs">{'{{date}}'}</code>{' '}
                      <code className="rounded bg-neutral-100 px-1 text-xs">{'{{location}}'}</code>{' '}
                      <code className="rounded bg-neutral-100 px-1 text-xs">{'{{name}}'}</code>
                    </p>
                  </div>
                  <div>
                    <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="vars-invite-tpl">Innhold (HTML)</label>
                    <StandardTextarea
                      id="vars-invite-tpl"
                      rows={5}
                      value={settings.meeting_invite_email_template ?? ''}
                      onChange={(e) => setSettings((p) => ({ ...p, meeting_invite_email_template: e.target.value }))}
                      placeholder={'<p>Hei {{name}},</p>\n<p>Du er innkalt til AMU-møte <strong>{{title}}</strong> den {{date}}.</p>\n<p>Sted: {{location}}</p>'}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        <hr className="border-neutral-200" />

        {/* ── Reminder ────────────────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-semibold text-neutral-800">Påminnelse</h3>
          <p className="mt-0.5 text-sm text-neutral-600">
            Send en påminnelse til deltakerne kort tid før møtet.
          </p>
          <div className="mt-4 space-y-6">

            <div className={WPSTD_FORM_ROW_GRID}>
              <div><p className="text-sm font-medium text-neutral-800">Aktiver påminnelse</p></div>
              <div>
                <span className={WPSTD_FORM_FIELD_LABEL}>Send påminnelse</span>
                <div className="mt-2 max-w-xs">
                  <YesNoToggle
                    value={settings.reminder_enabled ?? true}
                    onChange={(v) => setSettings((p) => ({ ...p, reminder_enabled: v }))}
                  />
                </div>
              </div>
            </div>

            {settings.reminder_enabled !== false && (
              <div className={WPSTD_FORM_ROW_GRID}>
                <div>
                  <p className="text-sm font-medium text-neutral-800">Dager i forveien</p>
                </div>
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="vars-reminder-days">Dager før møtet</label>
                  <div className="mt-1.5 max-w-[120px]">
                    <StandardInput
                      id="vars-reminder-days"
                      type="number"
                      min={1}
                      max={30}
                      value={settings.reminder_days_before ?? 2}
                      onChange={(e) => setSettings((p) => ({ ...p, reminder_days_before: Number(e.target.value) }))}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <hr className="border-neutral-200" />

        {/* ── Signed minutes distribution ─────────────────────────────── */}
        <section>
          <h3 className="text-sm font-semibold text-neutral-800">Distribusjon av referat</h3>
          <p className="mt-0.5 text-sm text-neutral-600">
            AML §7-2(6) pålegger virksomheten å gjøre signerte referater tilgjengelig for alle arbeidstakere.
          </p>
          <div className="mt-4 space-y-6">

            <div className={WPSTD_FORM_ROW_GRID}>
              <div><p className="text-sm font-medium text-neutral-800">Send referat automatisk ved signering</p></div>
              <div>
                <span className={WPSTD_FORM_FIELD_LABEL}>Automatisk distribusjon</span>
                <div className="mt-2 max-w-xs">
                  <YesNoToggle
                    value={settings.distribute_signed_minutes ?? true}
                    onChange={(v) => setSettings((p) => ({ ...p, distribute_signed_minutes: v }))}
                  />
                </div>
              </div>
            </div>

            {settings.distribute_signed_minutes !== false && (
              <>
                <div className={WPSTD_FORM_ROW_GRID}>
                  <div>
                    <p className="text-sm font-medium text-neutral-800">Send til alle ansatte</p>
                    <p className="mt-1 text-sm text-neutral-600">
                      Hvis deaktivert sendes referatet kun til AMU-medlemmer.
                    </p>
                  </div>
                  <div>
                    <span className={WPSTD_FORM_FIELD_LABEL}>Distribuer til alle ansatte</span>
                    <div className="mt-2 max-w-xs">
                      <YesNoToggle
                        value={settings.distribute_to_all_employees ?? false}
                        onChange={(v) => setSettings((p) => ({ ...p, distribute_to_all_employees: v }))}
                      />
                    </div>
                  </div>
                </div>

                <div className={WPSTD_FORM_ROW_GRID}>
                  <div>
                    <p className="text-sm font-medium text-neutral-800">E-postmal — distribusjon</p>
                    <p className="mt-1 text-sm text-neutral-600">
                      Variabler: <code className="rounded bg-neutral-100 px-1 text-xs">{'{{title}}'}</code>{' '}
                      <code className="rounded bg-neutral-100 px-1 text-xs">{'{{date}}'}</code>{' '}
                      <code className="rounded bg-neutral-100 px-1 text-xs">{'{{link}}'}</code>
                    </p>
                  </div>
                  <div>
                    <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="vars-dist-tpl">Innhold (HTML)</label>
                    <StandardTextarea
                      id="vars-dist-tpl"
                      rows={5}
                      value={settings.distribution_email_template ?? ''}
                      onChange={(e) => setSettings((p) => ({ ...p, distribution_email_template: e.target.value }))}
                      placeholder={'<p>Signert referat fra <strong>{{title}}</strong> ({{date}}) er nå tilgjengelig.</p>\n<p><a href="{{link}}">Les referatet her</a></p>'}
                    />
                  </div>
                </div>
              </>
            )}

            <div className={WPSTD_FORM_ROW_GRID}>
              <div />
              <div>
                <InfoBox>
                  For å sende e-post via arbeidsflyt: sett opp en regel for{' '}
                  <strong>ON_AMU_MEETING_SIGNED</strong> under fanen <strong>Arbeidsflyt</strong>.
                  Det gir mer kontroll over mottakere og innhold.
                </InfoBox>
              </div>
            </div>
          </div>
        </section>

      </div>

      <div className="mt-6">
        <Button type="button" variant="primary" disabled={saving} onClick={onSave}>
          {saving ? 'Lagrer…' : 'Lagre varslingsinnstillinger'}
        </Button>
      </div>
    </ModuleSectionCard>
  )
}
