import { ModuleSectionCard } from '../../module'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import { YesNoToggle } from '../../ui/FormToggles'
import { SearchableSelect, type SelectOption } from '../../ui/SearchableSelect'
import { InfoBox } from '../../ui/AlertBox'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../../layout/WorkplaceStandardFormPanel'
import type { AmuModuleSettings } from '../../../../modules/amu/amuModuleSettingsSchema'

const CADENCE_OPTIONS: SelectOption[] = [
  { value: 'every_meeting', label: 'Hvert AMU-møte (kvartalsvis)' },
  { value: 'quarterly',     label: 'Kvartalsrapport — uavhengig av møter' },
  { value: 'annual',        label: 'Årlig — kun i årsrapporten' },
]

type Props = {
  settings: AmuModuleSettings
  setSettings: React.Dispatch<React.SetStateAction<AmuModuleSettings>>
  saving: boolean
  onSave: () => void
}

export function AmuSettingsVarsling({ settings, setSettings, saving, onSave }: Props) {
  return (
    <ModuleSectionCard className="overflow-hidden p-0">
      <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-4">
        <h2 className="text-base font-semibold text-neutral-900">Varsling og taushetsplikt</h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          Hvordan varslingssaker (AML kap. 2 A) presenteres for AMU — uten å avsløre identitet til varsler eller
          omvarslede. Innstillingene gjelder også behandling av sensitive personopplysninger på møtet.
        </p>
      </div>

      <div className="divide-y divide-neutral-100">

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Rapporteringskadens</p>
            <p className="mt-1 text-sm text-neutral-600">
              AML § 2 A-3 krever at AMU får aggregert oversikt over varslingssaker. Velg hvor ofte oversikten
              automatisk legges på sakslisten.
            </p>
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Kadens</span>
            <div className="mt-1.5">
              <SearchableSelect
                value={settings.whistleblowing_report_cadence ?? 'every_meeting'}
                options={CADENCE_OPTIONS}
                onChange={(v) =>
                  setSettings((p) => ({
                    ...p,
                    whistleblowing_report_cadence: v as AmuModuleSettings['whistleblowing_report_cadence'],
                  }))
                }
              />
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Tving anonymisering</p>
            <p className="mt-1 text-sm text-neutral-600">
              Når aktivert vises kun antall, kategori og status — aldri navn, rolle eller tekst som kan
              identifisere enkeltpersoner. Anbefales for å overholde GDPR art. 5 og verne varsler.
            </p>
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Anonymiser alltid</span>
            <div className="mt-2 max-w-xs">
              <YesNoToggle
                value={settings.whistleblowing_force_anonymisation ?? true}
                onChange={(v) => setSettings((p) => ({ ...p, whistleblowing_force_anonymisation: v }))}
              />
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Minste gruppestørrelse</p>
            <p className="mt-1 text-sm text-neutral-600">
              Statistikk vises bare når minst dette antallet saker eksisterer i en kategori (k-anonymitet).
              Mindre kohorter vises som «&lt; n».
            </p>
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="vrs-min-group">Antall</label>
            <div className="mt-1.5 max-w-[120px]">
              <StandardInput
                id="vrs-min-group"
                type="number"
                min={1}
                max={50}
                value={settings.whistleblowing_min_group_size ?? 5}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, whistleblowing_min_group_size: Number(e.target.value) }))
                }
              />
            </div>
            <p className="mt-1 text-xs text-neutral-500">Anbefalt: 5</p>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Behandlingsfrist</p>
            <p className="mt-1 text-sm text-neutral-600">
              AML § 2 A-3 krever «forsvarlig undersøkelse innen rimelig tid». Arbeidstilsynet anbefaler
              maksimalt 90 dager. Saker som overskrider fristen eskaleres automatisk.
            </p>
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="vrs-deadline">Antall dager</label>
            <div className="mt-1.5 max-w-[120px]">
              <StandardInput
                id="vrs-deadline"
                type="number"
                min={7}
                max={365}
                value={settings.whistleblowing_close_deadline_days ?? 90}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, whistleblowing_close_deadline_days: Number(e.target.value) }))
                }
              />
            </div>
            <p className="mt-1 text-xs text-neutral-500">Anbefalt: 90 dager</p>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Varsel ved alvorlig sak</p>
            <p className="mt-1 text-sm text-neutral-600">
              Send umiddelbart varsel til AMU-leder når en sak markeres alvorlig (f.eks. trakassering,
              diskriminering, alvorlige sikkerhetsbrudd).
            </p>
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Direkte varsel</span>
            <div className="mt-2 max-w-xs">
              <YesNoToggle
                value={settings.whistleblowing_notify_leader_on_high ?? true}
                onChange={(v) => setSettings((p) => ({ ...p, whistleblowing_notify_leader_on_high: v }))}
              />
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Varsel ved fristbrudd</p>
            <p className="mt-1 text-sm text-neutral-600">
              Generer aktivpunkt på neste AMU-møte når en varslingssak overskrider behandlingsfristen.
            </p>
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Eskalering</span>
            <div className="mt-2 max-w-xs">
              <YesNoToggle
                value={settings.whistleblowing_notify_on_overdue ?? true}
                onChange={(v) => setSettings((p) => ({ ...p, whistleblowing_notify_on_overdue: v }))}
              />
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Forslag fra ansatte</p>
            <p className="mt-1 text-sm text-neutral-600">
              AML § 4-2 gir ansatte rett til å fremme saker. Aktiver innboks for forslag og angi om de kan
              sendes anonymt.
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <span className={WPSTD_FORM_FIELD_LABEL}>Aktiver forslagsinnboks</span>
              <div className="mt-2 max-w-xs">
                <YesNoToggle
                  value={settings.allow_employee_topic_proposals ?? true}
                  onChange={(v) => setSettings((p) => ({ ...p, allow_employee_topic_proposals: v }))}
                />
              </div>
            </div>
            {settings.allow_employee_topic_proposals !== false && (
              <div>
                <span className={WPSTD_FORM_FIELD_LABEL}>Tillat anonyme forslag</span>
                <div className="mt-2 max-w-xs">
                  <YesNoToggle
                    value={settings.allow_anonymous_proposals ?? true}
                    onChange={(v) => setSettings((p) => ({ ...p, allow_anonymous_proposals: v }))}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Taushetspliktbanner</p>
            <p className="mt-1 text-sm text-neutral-600">
              Vis eksplisitt påminnelse om taushetsplikt (Forvaltningsloven § 13) når saker med personopplysninger
              åpnes i live-møtet.
            </p>
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Vis banner</span>
            <div className="mt-2 max-w-xs">
              <YesNoToggle
                value={settings.show_confidentiality_banner ?? true}
                onChange={(v) => setSettings((p) => ({ ...p, show_confidentiality_banner: v }))}
              />
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Krev signert taushetserklæring</p>
            <p className="mt-1 text-sm text-neutral-600">
              Nye AMU-medlemmer må signere taushetserklæring (BankID) før de får tilgang til varslings- eller
              personalsakene i møtet.
            </p>
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Krev signering</span>
            <div className="mt-2 max-w-xs">
              <YesNoToggle
                value={settings.require_signed_confidentiality ?? false}
                onChange={(v) => setSettings((p) => ({ ...p, require_signed_confidentiality: v }))}
              />
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div />
          <div>
            <InfoBox>
              Detaljerte varslingssaker behandles i <strong>Varsling</strong>-modulen — AMU ser kun aggregert
              statistikk. Sett opp arbeidsflyt på <strong>ON_WHISTLEBLOWING_OVERDUE</strong> for å automatisere
              eskalering.
            </InfoBox>
          </div>
        </div>

      </div>

      <div className="border-t border-neutral-100 bg-neutral-50/60 px-5 py-4">
        <Button type="button" variant="primary" disabled={saving} onClick={onSave}>
          {saving ? 'Lagrer…' : 'Lagre varslingsinnstillinger'}
        </Button>
      </div>
    </ModuleSectionCard>
  )
}
