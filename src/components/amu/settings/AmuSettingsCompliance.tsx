import { ModuleSectionCard } from '../../module'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
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

/**
 * Compliance & opplæring — collects HMS-training (FOR § 3-18), action-item
 * escalation, deviation-to-AMU thresholds and document retention rules so the
 * organisation can document a defensible internal-control system.
 */
export function AmuSettingsCompliance({ settings, setSettings, saving, onSave }: Props) {
  return (
    <ModuleSectionCard className="overflow-hidden p-0">
      <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-4">
        <h2 className="text-base font-semibold text-neutral-900">Etterlevelse og opplæring</h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          HMS-opplæring (FOR § 3-18), eskalering av aktivpunkter, terskel for å bringe avvik inn for AMU,
          samt dokumentasjons- og oppbevaringskrav (Internkontrollforskriften, GDPR).
        </p>
      </div>

      <div className="divide-y divide-neutral-100">

        {/* ── HMS-training (FOR § 3-18) ──────────────────────────────────── */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Varsel før HMS-kurs utløper</p>
            <p className="mt-1 text-sm text-neutral-600">
              Forskrift om organisering, ledelse og medvirkning § 3-18 krever 40 timers HMS-opplæring for
              AMU-medlemmer og verneombud. Systemet starter advarsel dette antallet dager før utløp.
            </p>
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="cmp-hms-warn">Dager før utløp</label>
            <div className="mt-1.5 max-w-[120px]">
              <StandardInput
                id="cmp-hms-warn"
                type="number"
                min={0}
                max={365}
                value={settings.hms_training_warning_days ?? 90}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, hms_training_warning_days: Number(e.target.value) }))
                }
              />
            </div>
            <p className="mt-1 text-xs text-neutral-500">Anbefalt: 90 dager</p>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Send påminnelse om opplæring</p>
            <p className="mt-1 text-sm text-neutral-600">
              Generer e-postvarsel til medlemmet og admin når kurset nærmer seg utløp.
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <span className={WPSTD_FORM_FIELD_LABEL}>Aktiver påminnelse</span>
              <div className="mt-2 max-w-xs">
                <YesNoToggle
                  value={settings.notify_hms_training_expiring ?? true}
                  onChange={(v) => setSettings((p) => ({ ...p, notify_hms_training_expiring: v }))}
                />
              </div>
            </div>
            {settings.notify_hms_training_expiring !== false && (
              <div>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="cmp-hms-rem">Dager før første påminnelse</label>
                <div className="mt-1.5 max-w-[120px]">
                  <StandardInput
                    id="cmp-hms-rem"
                    type="number"
                    min={1}
                    max={365}
                    value={settings.hms_training_reminder_days ?? 60}
                    onChange={(e) =>
                      setSettings((p) => ({ ...p, hms_training_reminder_days: Number(e.target.value) }))
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Blokker stemmerett ved utløpt kurs</p>
            <p className="mt-1 text-sm text-neutral-600">
              Strengt regime: medlemmer uten gyldig 40-timers HMS-kurs kan ikke avgi stemme i AMU. Vises som
              «ikke-stemmeberettiget» i live-møtet til kurset er gjennomført.
            </p>
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Blokker stemmerett</span>
            <div className="mt-2 max-w-xs">
              <YesNoToggle
                value={settings.hms_training_block_voting_when_expired ?? false}
                onChange={(v) => setSettings((p) => ({ ...p, hms_training_block_voting_when_expired: v }))}
              />
            </div>
          </div>
        </div>

        {/* ── Avvik / risikoterskel ─────────────────────────────────────── */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Risikoterskel for AMU-behandling</p>
            <p className="mt-1 text-sm text-neutral-600">
              Avvik med risikoscore (RPN) over denne terskelen havner automatisk i «kritiske saker»-køen og
              må behandles på neste møte (AML § 5-1, IK-f § 5 nr. 6).
            </p>
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="cmp-rpn">Risikoscore (1–25)</label>
            <div className="mt-1.5 max-w-[120px]">
              <StandardInput
                id="cmp-rpn"
                type="number"
                min={1}
                max={25}
                value={settings.agenda_deviation_rpn_threshold ?? 9}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, agenda_deviation_rpn_threshold: Number(e.target.value) }))
                }
              />
            </div>
            <p className="mt-1 text-xs text-neutral-500">Standardterskel: 9 (medium-høy)</p>
          </div>
        </div>

        {/* ── Action items / escalation ─────────────────────────────────── */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Karenstid for forfalt aktivpunkt</p>
            <p className="mt-1 text-sm text-neutral-600">
              Antall dager etter frist før et aktivpunkt markeres som forfalt på dashboardet.
            </p>
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="cmp-grace">Dager</label>
            <div className="mt-1.5 max-w-[120px]">
              <StandardInput
                id="cmp-grace"
                type="number"
                min={0}
                max={60}
                value={settings.action_overdue_grace_days ?? 7}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, action_overdue_grace_days: Number(e.target.value) }))
                }
              />
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Eskaler til AMU-leder</p>
            <p className="mt-1 text-sm text-neutral-600">
              Når et aktivpunkt har vært forfalt såpass mange dager varsles AMU-leder, og punktet legges
              automatisk på neste sakliste.
            </p>
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="cmp-esc">Dager etter forfallsdato</label>
            <div className="mt-1.5 max-w-[120px]">
              <StandardInput
                id="cmp-esc"
                type="number"
                min={1}
                max={180}
                value={settings.action_escalation_days ?? 30}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, action_escalation_days: Number(e.target.value) }))
                }
              />
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Opprett avvik ved manglende oppfølging</p>
            <p className="mt-1 text-sm text-neutral-600">
              Når et aktivpunkt fra AMU forblir åpent etter eskalering, opprettes et avvik automatisk
              for å sikre sporbarhet (IK-f § 5 nr. 7).
            </p>
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Auto-opprett avvik</span>
            <div className="mt-2 max-w-xs">
              <YesNoToggle
                value={settings.action_overdue_creates_deviation ?? false}
                onChange={(v) => setSettings((p) => ({ ...p, action_overdue_creates_deviation: v }))}
              />
            </div>
          </div>
        </div>

        {/* ── Retention ─────────────────────────────────────────────────── */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Oppbevaring av kladder</p>
            <p className="mt-1 text-sm text-neutral-600">
              Møtekladder uten signert referat slettes automatisk etter dette antallet dager (GDPR art. 5
              «lagringsbegrensning»).
            </p>
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="cmp-draft-ret">Dager</label>
            <div className="mt-1.5 max-w-[120px]">
              <StandardInput
                id="cmp-draft-ret"
                type="number"
                min={30}
                max={3650}
                value={settings.draft_retention_days ?? 365}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, draft_retention_days: Number(e.target.value) }))
                }
              />
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Oppbevaring av signerte referater</p>
            <p className="mt-1 text-sm text-neutral-600">
              Signerte AMU-referater og årsrapporter regnes som HMS-dokumentasjon og bør oppbevares så lenge
              de er relevante (anbefalt minimum 10 år, jf. internkontrollforskriften § 5 nr. 8).
            </p>
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="cmp-rec-ret">År</label>
            <div className="mt-1.5 max-w-[120px]">
              <StandardInput
                id="cmp-rec-ret"
                type="number"
                min={1}
                max={50}
                value={settings.signed_record_retention_years ?? 10}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, signed_record_retention_years: Number(e.target.value) }))
                }
              />
            </div>
            <p className="mt-1 text-xs text-neutral-500">Anbefalt minimum: 10 år</p>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div />
          <div>
            <InfoBox>
              Disse innstillingene utgjør en del av virksomhetens internkontroll (IK-f § 5 nr. 8) og bør
              gjennomgås årlig av AMU sammen med BHT.
            </InfoBox>
          </div>
        </div>

      </div>

      <div className="border-t border-neutral-100 bg-neutral-50/60 px-5 py-4">
        <Button type="button" variant="primary" disabled={saving} onClick={onSave}>
          {saving ? 'Lagrer…' : 'Lagre etterlevelsesinnstillinger'}
        </Button>
      </div>
    </ModuleSectionCard>
  )
}
